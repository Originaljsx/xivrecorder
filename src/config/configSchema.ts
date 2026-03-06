/**
 * Configuration schema for xiv-recorder.
 * Adapted from wow-recorder, removing WoW-specific options.
 */
import { defaultIINACTLogPath, obsResolutions } from '../main/constants';

/**
 * Type definition for the configuration schema.
 */
export type ConfigurationSchema = {
  // Storage
  storagePath: string;
  bufferStoragePath: string;
  separateBufferPath: boolean;

  // IINACT
  iinactLogPath: string;

  // Recording categories
  recordCrystallineConflict: boolean;

  // OBS
  obsOutputResolution: string;
  obsFPS: number;
  obsQuality: number;
  obsCaptureMode: string;
  obsRecEncoder: number;

  // Audio
  audioSources: string;
  obsAudioSuppression: boolean;
  obsForceMono: boolean;
  pushToTalk: boolean;

  // Chat overlay
  chatOverlayEnabled: boolean;
  chatOverlayWidth: number;
  chatOverlayHeight: number;
  chatOverlayXPosition: number;
  chatOverlayYPosition: number;

  // Manual recording
  manualRecord: boolean;
  manualRecordHotKey: string;
  manualRecordSoundAlert: number;

  // Cloud
  cloudStorage: boolean;
  cloudUpload: boolean;
  cloudAccountName: string;
  cloudAccountPassword: string;
  cloudGuildName: string;

  // UI
  language: string;
  hideEmptyCategories: boolean;
  hardwareAcceleration: boolean;

  // Buffer
  bufferSeconds: number;

  // Markers
  deathMarkers: number;

  // Minimize
  startMinimized: boolean;
  minimizeOnQuit: boolean;
  minimizeToTray: boolean;
};

/**
 * Default values for all configuration options.
 */
export const configDefaults: ConfigurationSchema = {
  storagePath: '',
  bufferStoragePath: '',
  separateBufferPath: false,

  iinactLogPath: defaultIINACTLogPath(),

  recordCrystallineConflict: true,

  obsOutputResolution: '1920x1080',
  obsFPS: 60,
  obsQuality: 20,
  obsCaptureMode: 'game_capture',
  obsRecEncoder: 0,

  audioSources: '[]',
  obsAudioSuppression: false,
  obsForceMono: false,
  pushToTalk: false,

  chatOverlayEnabled: false,
  chatOverlayWidth: 400,
  chatOverlayHeight: 250,
  chatOverlayXPosition: 0,
  chatOverlayYPosition: 0,

  manualRecord: false,
  manualRecordHotKey: '',
  manualRecordSoundAlert: 0,

  cloudStorage: false,
  cloudUpload: false,
  cloudAccountName: '',
  cloudAccountPassword: '',
  cloudGuildName: '',

  language: 'English',
  hideEmptyCategories: false,
  hardwareAcceleration: true,

  bufferSeconds: 20,

  deathMarkers: 0,

  startMinimized: false,
  minimizeOnQuit: false,
  minimizeToTray: false,
};

/**
 * Which config keys affect which recording categories.
 */
export const categoryRecordingSettings: Record<string, string> = {
  'Crystalline Conflict': 'recordCrystallineConflict',
};
