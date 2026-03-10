import {
  BaseConfig,
  ObsVideoConfig,
  ObsAudioConfig,
  ObsOverlayConfig,
  Metadata,
  CloudConfig,
  AudioSource,
} from 'main/types';
import path from 'path';
import ConfigService from '../config/ConfigService';
import { VideoCategory } from '../types/VideoCategory';
import { ESupportedEncoders } from '../main/obsEnums';
import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import {
  checkDisk,
  exists,
  isFolderOwned,
  takeOwnershipBufferDir,
  takeOwnershipStorageDir,
} from 'main/util';

const allowRecordCategory = (cfg: ConfigService, category: VideoCategory) => {
  if (category === VideoCategory.Clips) {
    console.info('[configUtils] Clips are never recorded directly');
    return false;
  }

  if (category === VideoCategory.CrystallineConflict) {
    const allowed = cfg.get<boolean>('recordCrystallineConflict');

    if (!allowed) {
      console.info('[configUtils] Configured to not record CC');
      return false;
    }

    console.info('[configUtils] Good to record CC');
    return true;
  }

  if (category === VideoCategory.Raids) {
    const allowed = cfg.get<boolean>('recordRaids');

    if (!allowed) {
      console.info('[configUtils] Configured to not record raids');
      return false;
    }

    console.info('[configUtils] Good to record raids');
    return true;
  }

  if (category === VideoCategory.Manual) {
    const allowed = cfg.get<boolean>('manualRecord');

    if (!allowed) {
      console.info('[configUtils] Manual recording not enabled');
      return false;
    }

    console.info('[configUtils] Good to record manual');
    return true;
  }

  console.info('[configUtils] Unrecognised category', category);
  return false;
};

const shouldUpload = (cfg: ConfigService, metadata: Metadata) => {
  const { category } = metadata;

  const upload = cfg.get<boolean>('cloudUpload');

  if (!upload) {
    console.info('[configUtils] Cloud upload is disabled');
    return false;
  }

  if (category === VideoCategory.Clips) {
    const uploadClips = cfg.get<boolean>('cloudUploadClips');
    console.info('[configUtils] Upload clip?', uploadClips);
    return uploadClips;
  }

  console.info('[configUtils] Good to upload:', category);
  return true;
};

const getBaseConfig = (cfg: ConfigService): BaseConfig => {
  const storagePath = cfg.getPath('storagePath');
  let obsPath: string;

  if (cfg.get<boolean>('separateBufferPath')) {
    obsPath = cfg.getPath('bufferStoragePath');
  } else {
    obsPath = path.join(storagePath, '.temp');
  }

  // Encoder migration for deprecated encoders.
  let obsRecEncoder = cfg.get<string>('obsRecEncoder');

  if (obsRecEncoder === 'amd_amf_h264') {
    obsRecEncoder = ESupportedEncoders.AMD_H264;
    cfg.set('obsRecEncoder', obsRecEncoder);
  }

  if (obsRecEncoder === 'jim_nvenc') {
    obsRecEncoder = ESupportedEncoders.NVENC_H264;
    cfg.set('obsRecEncoder', obsRecEncoder);
  }

  if (obsRecEncoder === 'jim_av1_nvenc') {
    obsRecEncoder = ESupportedEncoders.NVENC_AV1;
    cfg.set('obsRecEncoder', obsRecEncoder);
  }

  return {
    storagePath: cfg.get<string>('storagePath'),
    maxStorage: cfg.get<number>('maxStorage'),
    obsPath,
    obsOutputResolution: cfg.get<string>('obsOutputResolution'),
    obsFPS: cfg.get<number>('obsFPS'),
    obsQuality: cfg.get<string>('obsQuality'),
    obsRecEncoder,
    iinactLogPath: cfg.get<string>('iinactLogPath'),
    recordCrystallineConflict: cfg.get<boolean>('recordCrystallineConflict'),
    recordRaids: cfg.get<boolean>('recordRaids'),
  };
};

const getObsVideoConfig = (cfg: ConfigService): ObsVideoConfig => {
  return {
    obsCaptureMode: cfg.get<string>('obsCaptureMode'),
    monitorIndex: cfg.get<number>('monitorIndex'),
    captureCursor: cfg.get<boolean>('captureCursor'),
    forceSdr: cfg.get<boolean>('forceSdr'),
    videoSourceScale: cfg.get<number>('videoSourceScale'),
    videoSourceXPosition: cfg.get<number>('videoSourceXPosition'),
    videoSourceYPosition: cfg.get<number>('videoSourceYPosition'),
  };
};

const getObsAudioConfig = (cfg: ConfigService): ObsAudioConfig => {
  return {
    audioSources: cfg.get<AudioSource[]>('audioSources'),
    obsAudioSuppression: cfg.get<boolean>('obsAudioSuppression'),
    obsForceMono: cfg.get<boolean>('obsForceMono'),
    pushToTalk: cfg.get<boolean>('pushToTalk'),
    pushToTalkKey: cfg.get<number>('pushToTalkKey'),
    pushToTalkMouseButton: cfg.get<number>('pushToTalkMouseButton'),
    pushToTalkModifiers: cfg.get<string>('pushToTalkModifiers'),
  };
};

const getOverlayConfig = (cfg: ConfigService): ObsOverlayConfig => {
  return {
    chatOverlayEnabled: cfg.get<boolean>('chatOverlayEnabled'),
    chatOverlayOwnImage: cfg.get<boolean>('chatOverlayOwnImage'),
    chatOverlayOwnImagePath: cfg.get<string>('chatOverlayOwnImagePath'),
    chatOverlayScale: cfg.get<number>('chatOverlayScale'),
    chatOverlayXPosition: cfg.get<number>('chatOverlayXPosition'),
    chatOverlayYPosition: cfg.get<number>('chatOverlayYPosition'),
    chatOverlayCropX: cfg.get<number>('chatOverlayCropX'),
    chatOverlayCropY: cfg.get<number>('chatOverlayCropY'),
  };
};

const getCloudConfig = (): CloudConfig => {
  const cfg = ConfigService.getInstance();

  return {
    cloudStorage: cfg.get<boolean>('cloudStorage'),
    cloudUpload: cfg.get<boolean>('cloudUpload'),
    cloudAccountName: cfg.get<string>('cloudAccountName'),
    cloudAccountPassword: cfg.get<string>('cloudAccountPassword'),
    cloudGuildName: cfg.get<string>('cloudGuildName'),
  };
};

const getLocaleError = (phrase: Phrase) => {
  const lang = ConfigService.getInstance().get<string>('language') as Language;
  return getLocalePhrase(lang, phrase);
};

const validateBaseConfig = async (config: BaseConfig) => {
  const { storagePath, maxStorage, obsPath, iinactLogPath } = config;

  if (!storagePath) {
    console.warn('[Manager] storagePath is falsy', storagePath);
    const error = getLocaleError(Phrase.ErrorStoragePathInvalid);
    throw new Error(error);
  }

  if (storagePath.includes('#')) {
    console.warn('[Manager] storagePath contains #', storagePath);
    const error = getLocaleError(Phrase.ErrorStoragePathInvalid);
    throw new Error(error);
  }

  const storagePathExists = await exists(storagePath);

  if (!storagePathExists) {
    console.warn('[Manager] storagePath does not exist', storagePath);
    const error = getLocaleError(Phrase.ErrorStoragePathInvalid);
    throw new Error(error);
  }

  await checkDisk(storagePath, maxStorage);

  if (!obsPath) {
    console.warn('[Manager] obsPath is falsy', obsPath);
    const error = getLocaleError(Phrase.ErrorBufferPathInvalid);
    throw new Error(error);
  }

  const obsParentDir = path.dirname(obsPath);
  const obsParentDirExists = await exists(obsParentDir);

  if (!obsParentDirExists) {
    console.warn('[Manager] obsPath does not exist', obsPath);
    const error = getLocaleError(Phrase.ErrorBufferPathInvalid);
    throw new Error(error);
  }

  if (path.resolve(storagePath) === path.resolve(obsPath)) {
    console.warn('[Manager] storagePath is the same as obsPath');
    const error = getLocaleError(Phrase.ErrorStoragePathSameAsBufferPath);
    throw new Error(error);
  }

  const obsDirExists = await exists(obsPath);

  if (obsDirExists) {
    await checkDisk(obsPath, 10);
  } else {
    const parentDir = path.dirname(obsPath);
    await checkDisk(parentDir, 10);
  }

  const storagePathOwned = await isFolderOwned(storagePath);

  if (!storagePathOwned) {
    await takeOwnershipStorageDir(storagePath);
  }

  if (obsDirExists && !(await isFolderOwned(obsPath))) {
    await takeOwnershipBufferDir(obsPath);
  }

  // Validate IINACT log path.
  if (iinactLogPath) {
    const logPathExists = await exists(iinactLogPath);

    if (!logPathExists) {
      console.warn('[Manager] IINACT log path does not exist:', iinactLogPath);
      throw new Error(
        `IINACT log directory not found: ${iinactLogPath}. Make sure IINACT is installed and the log path is correct.`,
      );
    }
  }
};

export {
  allowRecordCategory,
  shouldUpload,
  getBaseConfig,
  getObsVideoConfig,
  getObsAudioConfig,
  getOverlayConfig,
  getCloudConfig,
  validateBaseConfig,
  getLocaleError,
};
