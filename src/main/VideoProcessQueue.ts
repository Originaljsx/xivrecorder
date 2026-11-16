import path from 'path';
import { getBaseConfig } from '../utils/configUtils';
import DiskSizeMonitor from '../storage/DiskSizeMonitor';
import ConfigService from '../config/ConfigService';
import { SaveStatus, VideoQueueItem } from './types';
import {
  writeMetadataFile,
  getFileInfo,
  fixPathWhenPackaged,
  tryUnlink,
} from './util';
import PvpStatsLink from './PvpStatsLink';
import { VideoCategory } from '../types/VideoCategory';
import { send } from './main';
import ffmpeg from 'fluent-ffmpeg';
import DiskClient from 'storage/DiskClient';
import Recorder from './Recorder';

const atomicQueue = require('atomic-queue');
const devMode = process.env.NODE_ENV === 'development';
const isDebug = devMode || process.env.DEBUG_PROD === 'true';

// Use the dynamically linked ffmpeg.exe we package with OBS in noobs. This
// allows us to avoid including a static ffmpeg.exe which is an extra 60MB.
const ffmpegPathRel = 'node_modules/noobs/dist/bin/ffmpeg.exe';

let ffmpegPathAbs = devMode
  ? path.resolve(__dirname, '../../release/app/', ffmpegPathRel)
  : path.resolve(__dirname, '../../', ffmpegPathRel);

ffmpegPathAbs = fixPathWhenPackaged(ffmpegPathAbs);
ffmpeg.setFfmpegPath(ffmpegPathAbs);

/**
 * A queue for cutting videos to size.
 */
export default class VideoProcessQueue {
  /**
   * Singleton instance.
   */
  private static instance: VideoProcessQueue;

  /**
   * Singleton instance accessor.
   */
  public static getInstance() {
    if (!this.instance) this.instance = new this();
    return this.instance;
  }

  /**
   * Atomic queue object for queueing cutting of videos.
   */
  private videoQueue: any;

  /**
   * Config service handle.
   */
  private cfg = ConfigService.getInstance();

  /**
   * Constructor.
   */
  private constructor() {
    this.videoQueue = this.createVideoQueue();
  }

  private createVideoQueue() {
    const worker = this.processVideoQueueItem.bind(this);
    const settings = { concurrency: 1 };
    const queue = atomicQueue(worker, settings);

    /* eslint-disable prettier/prettier */
    queue
      .on('error', VideoProcessQueue.errorProcessingVideo)
      .on('idle', () => {this.videoQueueEmpty()});
         
    queue.pool
      .on('start', (data: VideoQueueItem) => { this.startedProcessingVideo(data) })
      .on('finish', (_: unknown, data: VideoQueueItem) => { this.finishProcessingVideo(data) });
    /* eslint-enable prettier/prettier */

    return queue;
  }

  /**
   * Add a video to the queue for processing, the processing it undergoes is
   * dictated by the input. This is the only public method on this class.
   */
  public queueVideo = async (item: VideoQueueItem) => {
    console.info('[VideoProcessQueue] Queuing video for processing', item);
    this.videoQueue.write(item);
  };

  /**
   * Process a video by cutting it to size and saving it to disk, also
   * writes out the metadata JSON file.
   */
  private async processVideoQueueItem(
    data: VideoQueueItem,
    done: () => void,
  ): Promise<void> {
    try {
      const outputDir = this.cfg.get<string>('storagePath');

      // In a lot of cases this is basically just a copy. But this also
      // covers the cases where we're cutting a section off the end of
      // the video due to a timeout.
      const videoPath = await this.cutVideo(
        data.source,
        outputDir,
        data.suffix,
        data.offset,
        data.duration,
        data.clip,
      );

      // Record the on-disk size and the encoder used, handy for comparing
      // encoder / quality settings against each other.
      const metadata = { ...data.metadata };

      try {
        const stats = await getFileInfo(videoPath);
        metadata.size = stats.size;
      } catch (error) {
        console.warn('[VideoProcessQueue] Unable to stat output', error);
      }

      if (!metadata.encoder && !data.clip) {
        metadata.encoder = this.cfg.get<string>('obsRecEncoder');
      }

      await writeMetadataFile(videoPath, metadata);

      if (metadata.category === VideoCategory.CrystallineConflict) {
        // Fire and forget: pulls the scoreboard/result from PvpStats once
        // the plugin has written the match, retrying for a few minutes.
        PvpStatsLink.getInstance().linkVideo(videoPath);
      }
    } catch (error) {
      console.error(
        '[VideoProcessQueue] Error processing video:',
        String(error),
      );
    }

    done();
  }

  /**
   * Log an error processing the video.
   */
  private static errorProcessingVideo(err: unknown) {
    console.error('[VideoProcessQueue] Error processing video', String(err));
  }

  /**
   * Log we are starting the processing and update the saving status icon.
   */
  private startedProcessingVideo(item: VideoQueueItem) {
    console.info('[VideoProcessQueue] Now processing video', item.source);
    send('updateSaveStatus', SaveStatus.Saving);
  }

  /**
   * Log we are done, and update the saving status icon and refresh the
   * frontend.
   */
  private async finishProcessingVideo(item: VideoQueueItem) {
    console.info('[VideoProcessQueue] Finished processing video', item.source);
    send('updateSaveStatus', SaveStatus.NotSaving);
    DiskClient.getInstance().refreshStatus();
    DiskClient.getInstance().refreshVideos();

    // Delete the source file if it's not a clip. Clips source files should be retained.
    if (!item.clip) {
      console.info('[VideoProcessQueue] Deleting source file', item.source);
      let success = await tryUnlink(item.source);

      if (!success) {
        // Wait a couple of seconds and try again.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        success = await tryUnlink(item.source);
      }

      if (!success) {
        // Not much else to do than log it.
        console.warn('[VideoProcessQueue] Failed to delete src', item.source);
      }
    }
  }

  /**
   * Run actions on the queue being empty.
   */
  private async videoQueueEmpty() {
    console.info('[VideoProcessQueue] Video processing queue empty');

    // Run the size monitor.
    const sizeMonitor = new DiskSizeMonitor();
    await sizeMonitor.run();

    // Tidy the recording dir.
    const cfg = ConfigService.getInstance();
    const { obsPath } = getBaseConfig(cfg);
    await Recorder.getInstance().cleanup(obsPath);

    // Update the frontend with the new usage.
    DiskClient.getInstance().refreshStatus();
  }

  /**
   * Sanitize a filename and replace all invalid characters with a space.
   *
   * Multiple consecutive invalid characters will be replaced by a single space.
   * Multiple consecutive spaces will be replaced by a single space.
   */
  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/|?*]/g, ' ') // Replace all invalid characters with space
      .replace(/ +/g, ' '); // Replace multiple spaces with a single space
  }

  /**
   * Returns the full path for a video cut operation's output file.
   */
  private static getOutputVideoPath(
    sourceFile: string,
    outputDir: string,
    suffix: string | undefined,
  ) {
    // Can be either ".mp4" if clipping or ".mkv" if regular recording.
    const extension = sourceFile.slice(-4);
    let videoName = path.basename(sourceFile, extension);

    if (suffix) {
      videoName += ' - ';
      videoName += suffix;
    }

    videoName = VideoProcessQueue.sanitizeFilename(videoName);
    // Always output MP4. MKV is just an intermediate format.
    return path.join(outputDir, `${videoName}.mp4`);
  }

  /**
   * This can be called either to cut a clip, or to cut a video on
   * finishing. Keep in mind that a video finishing may have a duration
   * less than the source video, if the recording was stopped by a log
   * timeout.
   */
  private async cutVideo(
    srcFile: string,
    outputDir: string,
    suffix: string | undefined,
    offset: number,
    duration: number,
    clip: boolean,
  ): Promise<string> {
    console.info('[VideoProcessQueue] Cutting video:', {
      srcFile,
      outputDir,
      suffix,
      offset,
      duration,
      clip,
    });

    let start = offset;

    if (offset < 0) {
      console.warn('[VideoProcessQueue] Negative offset set to zero');
      start = 0; // Sanity check.
    }

    const outputPath = VideoProcessQueue.getOutputVideoPath(
      srcFile,
      outputDir,
      suffix,
    );

    let fn = ffmpeg(srcFile)
      .setStartTime(start)
      // Crucially we copy the video and audio, so we don't do any
      // re-encoding which would take time and CPU.
      .withVideoCodec('copy')
      .withAudioCodec('copy')
      // Map all streams from the input. FFmpeg otherwise selects only one
      // audio stream, and recordings contain up to six audio tracks.
      .outputOption('-map 0')
      // Avoid any negative timestamps, which can cause issues with
      // some players, but does extend the video slightly depending on
      // the keyframe alignment.
      .outputOption('-avoid_negative_ts make_zero')
      // Move the moov atom to the start of the file for faster playback
      // start and seeking.
      .outputOption('-movflags +faststart')
      .output(outputPath);

    // Only apply duration trimming for clips. For regular recordings, the
    // OBS file is already stopped at the right time, but may include
    // pre-match buffer content at the start. Trimming by duration would
    // cut off the end of the match by the amount of buffer included.
    if (clip) {
      fn = fn.setDuration(duration);
    }

    console.time('[VideoProcessQueue] Video cut took:');
    await VideoProcessQueue.ffmpegWrapper(fn, 'Video cut');
    console.timeEnd('[VideoProcessQueue] Video cut took:');
    return outputPath;
  }

  /**
   * An async wrapper around ffmpeg-fluent to avoid a bunch of horrible promise
   * wrapping indented code being repeated.
   *
   * @param fn the ffmpeg function to wrap
   * @param descr a description of the command for logging
   */
  private static async ffmpegWrapper(fn: ffmpeg.FfmpegCommand, descr: string) {
    return new Promise<void>((resolve, reject) => {
      const handleErr = (err: unknown) => {
        const msg = `[VideoProcessQueue] ${descr} failed! ${String(err)}`;
        console.error(msg);
        reject(msg);
      };

      const handleEnd = async (err: unknown) => {
        if (err) handleErr(err);
        resolve();
      };

      const handleStart = (cmd: string) =>
        console.info('[VideoProcessQueue] FFmpeg command:', cmd);

      const handleStderr = (cmd: string) => {
        // This is very verbose, so just do it if we're in debug mode.
        if (isDebug) console.info('[VideoProcessQueue] FFmpeg stderr:', cmd);
      };

      const onProgress = (progress: {
        frames: number;
        currentFps: number;
        currentKbps: number;
        targetSize: number;
        timemark: string;
        percent?: number | undefined;
      }) => {
        console.info(
          '[VideoProcessQueue] Ffmpeg task:',
          descr,
          'progress:',
          progress.percent?.toFixed(0),
          '%',
        );
      };

      fn.on('start', handleStart)
        .on('end', handleEnd)
        .on('error', handleErr)
        .on('stderr', handleStderr)
        .on('progress', onProgress)
        .run();
    });
  }
}
