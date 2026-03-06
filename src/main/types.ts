/**
 * Core types for xiv-recorder.
 * Adapted from wow-recorder's types.ts, removing WoW-specific types.
 */

/** Application recording status. */
export enum RecStatus {
  WaitingForFFXIV,
  Recording,
  ReadyToRecord,
  InvalidConfig,
  FatalError,
  Overrunning,
}

/** Microphone status. */
export enum MicStatus {
  NONE,
  LISTENING,
  MUTED,
}

/** Video save status. */
export enum SaveStatus {
  NONE,
  SAVING,
}

/** UI page navigation. */
export enum Pages {
  None,
  Settings,
  SceneEditor,
}

/** Storage filter options. */
export enum StorageFilter {
  DISK = 'disk',
  CLOUD = 'cloud',
}

/** FFXIV process events. */
export enum FFXIVProcessEvent {
  STARTED = 'ffxiv-started',
  STOPPED = 'ffxiv-stopped',
}

/** Sound alert options. */
export enum SoundAlerts {
  NONE = 0,
  START = 1,
  STOP = 2,
  BOTH = 3,
}

/** Death marker display options. */
export enum DeathMarkers {
  NONE = 0,
  OWN = 1,
  ALL = 2,
}

/** OBS encoder type. */
export enum EncoderType {
  Hardware = 0,
  Software = 1,
}

/** Audio source type. */
export enum AudioSourceType {
  input_capture = 'wasapi_input_capture',
  output_capture = 'wasapi_output_capture',
  process_capture = 'wasapi_process_output_capture',
}

/** OBS scene items. */
export enum SceneItem {
  game_capture = 'game_capture',
  chat_overlay = 'chat_overlay',
}

/** A player death event. */
export type PlayerDeathType = {
  name: string;
  timestamp: Date;
  killerName?: string;
};

/** File info for log watching. */
export type FileInfo = {
  name: string;
  size: number;
};

/** Item in the video processing queue. */
export type VideoQueueItem = {
  source: string;
  suffix: string;
  offset?: number;
};

/**
 * FFXIV combatant data from AddCombatant (type 03) log lines.
 */
export type RawCombatant = {
  _entityId: string;
  _name?: string;
  _jobId?: number;
  _level?: number;
  _worldName?: string;
  _teamId?: number;
};

/**
 * Metadata stored alongside each video recording.
 */
export type Metadata = {
  category: string;
  zoneID?: number;
  zoneName?: string;
  encounterName?: string;
  result: boolean;
  duration: number;
  deaths: PlayerDeathType[];
  combatants: RawCombatant[];
  player?: RawCombatant;
  overrun: number;
  date: number;
  uniqueHash: string;
};

/** Video data as seen by the renderer. */
export type RendererVideo = {
  index: number;
  fullPath: string;
  imageSrc: string;
  category: string;
  parentCategory: string;
  tag?: string;
  date: Date;
  duration: number;
  result: boolean;
  isProtected: boolean;
  encounter?: string;
  zone?: string;
  player?: RawCombatant;
  combatants: RawCombatant[];
  deaths?: PlayerDeathType[];
  multiPov: boolean;
  cloud: boolean;
  uniqueHash: string;
};

/** Application state for the renderer. */
export type AppState = {
  page: Pages;
  category: string;
};

/** Cloud sync status. */
export type CloudStatus = {
  connected: boolean;
  usageMB: number;
  limitMB: number;
};

/** Audio source configuration. */
export type AudioSource = {
  id: string;
  label: string;
  type: AudioSourceType;
};

/** Base config type (partial, for settings UI). */
export type BaseConfig = {
  storagePath: string;
  iinactLogPath: string;
  recordCrystallineConflict: boolean;
};

/** OBS video config. */
export type ObsVideoConfig = {
  baseWidth: number;
  baseHeight: number;
  outputWidth: number;
  outputHeight: number;
  fps: number;
};

/** OBS audio config. */
export type ObsAudioConfig = {
  sources: AudioSource[];
  suppression: boolean;
  forceMono: boolean;
  pushToTalk: boolean;
};

/** OBS overlay config. */
export type ObsOverlayConfig = {
  enabled: boolean;
  chatOverlayWidth: number;
  chatOverlayHeight: number;
  chatOverlayXPosition: number;
  chatOverlayYPosition: number;
};

/** Cloud config. */
export type CloudConfig = {
  cloudStorage: boolean;
  cloudUpload: boolean;
  cloudAccountName: string;
  cloudAccountPassword: string;
  cloudGuildName: string;
};
