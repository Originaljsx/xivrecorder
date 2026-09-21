/**
 * Links Crystalline Conflict recordings to matches tracked by the PvpStats
 * Dalamud plugin (https://github.com/wrath16/PvpStats).
 *
 * PvpStats reads the game's end-of-match packet, so it knows the real
 * result, team assignments and the full scoreboard. It stores everything in
 * a LiteDB database under the Dalamud plugin config folder. We can't read
 * LiteDB from Node directly, so a small bundled helper (tools/pvpstats-export)
 * copies the database and dumps recent matches as JSON.
 *
 * A recording is matched to a PvpStats entry by the match start time (both
 * come from the same COMMENCE event) and the territory ID. When linked, the
 * recording's metadata gains a `pvpStats` scoreboard, its result is replaced
 * by PvpStats' authoritative one, and the combatants are relabelled with real
 * Astra (1) / Umbra (2) team IDs.
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import ConfigService from '../config/ConfigService';
import DiskClient from '../storage/DiskClient';
import { Metadata, PvpStatsMatch } from './types';
import {
  getAssetPath,
  getMetadataForVideo,
  getSortedVideos,
  writeMetadataFile,
} from './util';
import { VideoCategory } from '../types/VideoCategory';

/** How far apart the recording and PvpStats match start may be. */
export const MATCH_WINDOW_MS = 2 * 60 * 1000;

/** Retry schedule after a recording is saved; PvpStats writes on match end. */
const RETRY_DELAYS_MS = [5_000, 20_000, 60_000, 180_000];

export default class PvpStatsLink {
  private static instance: PvpStatsLink;

  /** Videos with a link attempt in flight, keyed by video path. */
  private inFlight = new Set<string>();

  public static getInstance() {
    if (!PvpStatsLink.instance) {
      PvpStatsLink.instance = new PvpStatsLink();
    }
    return PvpStatsLink.instance;
  }

  /**
   * Where PvpStats keeps its database, if the plugin is installed.
   */
  public databaseDir(): string | undefined {
    const dir = path.join(
      app.getPath('appData'),
      'XIVLauncher',
      'pluginConfigs',
      'PvpStats',
    );

    return fs.existsSync(path.join(dir, 'data.db')) ? dir : undefined;
  }

  public helperPath(): string {
    return getAssetPath('pvpstats-export', 'pvpstats-export.exe');
  }

  public enabled(): boolean {
    const cfg = ConfigService.getInstance();

    if (!cfg.get<boolean>('linkPvpStats')) {
      console.info('[PvpStatsLink] Disabled in settings');
      return false;
    }

    if (process.platform !== 'win32') {
      console.info('[PvpStatsLink] Not on Windows, skipping');
      return false;
    }

    const dir = this.databaseDir();
    if (!dir) {
      console.info('[PvpStatsLink] PvpStats database not found');
      return false;
    }

    const helper = this.helperPath();
    if (!fs.existsSync(helper)) {
      console.warn('[PvpStatsLink] Helper missing at', helper);
      return false;
    }

    return true;
  }

  /**
   * Run the helper and return matches that started at or after `sinceMs`.
   */
  public async fetchMatches(sinceMs: number): Promise<PvpStatsMatch[]> {
    const dir = this.databaseDir();
    if (!dir) return [];

    const out = path.join(
      app.getPath('temp'),
      `xivrecorder-pvpstats-${Date.now()}.json`,
    );

    await new Promise<void>((resolve, reject) => {
      execFile(
        this.helperPath(),
        [dir, out, String(Math.max(0, Math.floor(sinceMs)))],
        { timeout: 60_000, windowsHide: true },
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(`${error.message} ${stderr}`.trim()));
          } else {
            resolve();
          }
        },
      );
    });

    try {
      const json = await fs.promises.readFile(out, 'utf-8');
      return JSON.parse(json) as PvpStatsMatch[];
    } finally {
      fs.promises.unlink(out).catch(() => {});
    }
  }

  /**
   * Pick the PvpStats match that corresponds to a recording, or undefined.
   */
  public static correlate(
    metadata: Metadata,
    matches: PvpStatsMatch[],
  ): PvpStatsMatch | undefined {
    const start = metadata.date ?? metadata.start;
    if (!start) return undefined;

    let best: PvpStatsMatch | undefined;
    let bestDelta = Number.POSITIVE_INFINITY;

    for (const m of matches) {
      const mStart = m.matchStart ?? m.dutyStart;
      if (!mStart) continue;

      if (metadata.zoneID && m.territoryId && m.territoryId !== metadata.zoneID) {
        continue;
      }

      const delta = Math.abs(mStart - start);
      if (delta <= MATCH_WINDOW_MS && delta < bestDelta) {
        best = m;
        bestDelta = delta;
      }
    }

    return best;
  }

  /**
   * Merge a PvpStats match into a recording's metadata. Returns a new object.
   */
  public static apply(metadata: Metadata, match: PvpStatsMatch): Metadata {
    const teamIdFor = new Map<string, number>();
    for (const [teamName, team] of Object.entries(match.teams)) {
      const id = teamName === 'Astra' ? 1 : 2;
      for (const p of team?.players ?? []) teamIdFor.set(p.name, id);
    }

    const relabel = (c: Metadata['combatants'][number]) => {
      const id = c._name ? teamIdFor.get(c._name) : undefined;
      return id ? { ...c, _teamId: id } : c;
    };

    const updated: Metadata = {
      ...metadata,
      pvpStats: match,
      combatants: metadata.combatants.map(relabel),
      player: metadata.player ? relabel(metadata.player) : metadata.player,
      winner: match.winner,
      localTeam: match.localTeam,
    };

    if (match.localTeam && (match.winner === 'Astra' || match.winner === 'Umbra')) {
      updated.result = match.winner === match.localTeam;
      updated.resultSource = 'pvpstats';
    }

    return updated;
  }

  /**
   * Link one freshly saved recording, retrying while PvpStats catches up.
   */
  public async linkVideo(videoPath: string, attempt = 0): Promise<boolean> {
    if (!this.enabled()) return false;
    if (attempt === 0 && this.inFlight.has(videoPath)) return false;
    this.inFlight.add(videoPath);

    try {
      const metadata = await getMetadataForVideo(videoPath);
      if (metadata.pvpStats) return true;

      const start = metadata.date ?? metadata.start;
      if (!start) return false;

      const matches = await this.fetchMatches(start - MATCH_WINDOW_MS);
      const match = PvpStatsLink.correlate(metadata, matches);

      if (match) {
        await writeMetadataFile(videoPath, PvpStatsLink.apply(metadata, match));
        console.info(
          '[PvpStatsLink] Linked',
          path.basename(videoPath),
          `-> ${match.arena} ${match.winner} wins, local team ${match.localTeam}`,
        );
        await DiskClient.getInstance().refreshVideos();
        return true;
      }

      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.info(
          '[PvpStatsLink] No PvpStats match yet for',
          path.basename(videoPath),
          `retrying in ${delay / 1000}s`,
        );
        setTimeout(() => {
          this.linkVideo(videoPath, attempt + 1).catch((e) =>
            console.warn('[PvpStatsLink] Retry failed:', String(e)),
          );
        }, delay);
        return false;
      }

      console.warn('[PvpStatsLink] Gave up linking', path.basename(videoPath));
      return false;
    } catch (e) {
      console.warn('[PvpStatsLink] Link failed:', String(e));
      return false;
    } finally {
      // Only the final attempt (or a success) clears the in-flight marker.
      if (attempt >= RETRY_DELAYS_MS.length) this.inFlight.delete(videoPath);
    }
  }

  /**
   * Link every CC recording on disk that has no scoreboard yet. One helper
   * run covers all of them.
   */
  public async linkAllUnlinked(): Promise<number> {
    console.info('[PvpStatsLink] Checking for CC recordings to backfill');
    if (!this.enabled()) return 0;

    const storageDir = ConfigService.getInstance().get<string>('storagePath');
    if (!storageDir) return 0;

    const pending: { videoPath: string; metadata: Metadata }[] = [];

    try {
      const videos = await getSortedVideos(storageDir);

      for (const video of videos) {
        try {
          const metadata = await getMetadataForVideo(video.name);
          if (metadata.category !== VideoCategory.CrystallineConflict) continue;
          if (metadata.pvpStats) continue;
          if (!(metadata.date ?? metadata.start)) continue;
          pending.push({ videoPath: video.name, metadata });
        } catch {
          // Metadata missing or unreadable; skip.
        }
      }

      if (pending.length === 0) return 0;

      const oldest = Math.min(
        ...pending.map((p) => (p.metadata.date ?? p.metadata.start) as number),
      );

      const matches = await this.fetchMatches(oldest - MATCH_WINDOW_MS);
      let linked = 0;

      for (const { videoPath, metadata } of pending) {
        const match = PvpStatsLink.correlate(metadata, matches);
        if (!match) continue;
        await writeMetadataFile(videoPath, PvpStatsLink.apply(metadata, match));
        linked++;
      }

      console.info(
        '[PvpStatsLink] Backfill linked',
        linked,
        'of',
        pending.length,
        'CC recordings',
      );

      if (linked > 0) await DiskClient.getInstance().refreshVideos();
      return linked;
    } catch (e) {
      console.warn('[PvpStatsLink] Backfill failed:', String(e));
      return 0;
    }
  }
}
