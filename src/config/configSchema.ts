import { Phrase } from 'localisation/phrases';
import { AudioSource, AudioSourceType } from 'main/types';
import { defaultAudioTrack } from 'main/constants';

export type ConfigurationSchema = {
  storagePath: string;
  bufferStoragePath: string;
  separateBufferPath: boolean;
  iinactLogPath: string;
  maxStorage: number;
  monitorIndex: number;
  selectedCategory: number;
  audioSources: AudioSource[];
  startUp: boolean;
  startMinimized: boolean;
  obsOutputResolution: string;
  obsFPS: number;
  obsForceMono: boolean;
  obsQuality: string;
  obsCaptureMode: string;
  obsRecEncoder: string;
  recordCrystallineConflict: boolean;
  recordRaids: boolean;
  linkPvpStats: boolean;
  captureCursor: boolean;
  minimizeOnQuit: boolean;
  minimizeToTray: boolean;
  chatOverlayEnabled: boolean;
  chatOverlayOwnImage: boolean;
  chatOverlayOwnImagePath: string;
  chatOverlayScale: number;
  chatOverlayXPosition: number;
  chatOverlayYPosition: number;
  chatOverlayCropX: number;
  chatOverlayCropY: number;
  deathMarkers: number;
  pushToTalk: boolean;
  pushToTalkKey: number;
  pushToTalkMouseButton: number;
  pushToTalkModifiers: string;
  pushToTalkReleaseDelay: number;
  obsAudioSuppression: boolean;
  language: string;
  hideEmptyCategories: boolean;
  hardwareAcceleration: boolean;
  forceSdr: boolean;
  videoSourceScale: number;
  videoSourceXPosition: number;
  videoSourceYPosition: number;
  manualRecord: boolean;
  manualRecordHotKey: number;
  manualRecordHotKeyModifiers: string;
  manualRecordSoundAlert: boolean;
  firstTimeSetup: boolean;
};

export type ConfigurationSchemaKey = keyof ConfigurationSchema;

/**
 * Config schema. The descriptions may get displayed in the UI.
 */
export const configSchema: Record<string, any> = {
  storagePath: {
    description: Phrase.StoragePathDescription,
    type: 'string',
    default: '',
  },
  separateBufferPath: {
    description: Phrase.SeparateBufferPathDescription,
    type: 'boolean',
    default: false,
  },
  bufferStoragePath: {
    description: Phrase.BufferStoragePathDescription,
    type: 'string',
    default: '',
  },
  iinactLogPath: {
    description: 'Path to IINACT log directory',
    type: 'string',
    default: '',
  },
  maxStorage: {
    description: Phrase.MaxStorageDescription,
    type: 'integer',
    default: 50,
    minimum: 0,
  },
  monitorIndex: {
    description: Phrase.MonitorIndexDescription,
    type: 'integer',
    default: 0,
    minimum: 1,
    maximum: 4,
  },
  selectedCategory: {
    description: Phrase.SelectedCategoryDescription,
    type: 'integer',
    default: 1,
  },
  audioSources: {
    description: 'Audio capture sources',
    type: 'array',
    default: [
      {
        id: 'XIVRecorder Audio Source 1',
        friendly: 'default',
        device: 'default',
        volume: 1,
        type: AudioSourceType.OUTPUT,
        tracks: defaultAudioTrack,
      },
    ],
  },
  startUp: {
    description: Phrase.StartUpDescription,
    type: 'boolean',
    default: false,
  },
  startMinimized: {
    description: Phrase.StartMinimizedDescription,
    type: 'boolean',
    default: false,
  },
  obsOutputResolution: {
    description: Phrase.ObsOutputResolutionDescription,
    type: 'string',
    default: '1920x1080',
  },
  obsFPS: {
    description: Phrase.ObsFPSDescription,
    type: 'integer',
    default: 60,
    minimum: 15,
    maximum: 120,
  },
  obsForceMono: {
    description: Phrase.ObsForceMonoDescription,
    type: 'boolean',
    default: false,
  },
  obsQuality: {
    description: Phrase.ObsQualityDescription,
    type: 'string',
    default: 'High',
  },
  obsCaptureMode: {
    description: Phrase.ObsCaptureModeDescription,
    type: 'string',
    default: 'game_capture',
  },
  obsRecEncoder: {
    description: Phrase.ObsRecEncoderDescription,
    type: 'string',
    default: 'obs_x264',
  },
  recordCrystallineConflict: {
    description: 'Record Crystalline Conflict matches',
    type: 'boolean',
    default: true,
  },
  recordRaids: {
    description: Phrase.RecordRaidsDescription,
    type: 'boolean',
    default: true,
  },
  linkPvpStats: {
    description:
      'Import Crystalline Conflict results and scoreboards from the PvpStats Dalamud plugin',
    type: 'boolean',
    default: true,
  },
  captureCursor: {
    description: Phrase.CaptureCursorDescription,
    type: 'boolean',
    default: false,
  },
  minimizeOnQuit: {
    description: Phrase.MinimizeOnQuitDescription,
    type: 'boolean',
    default: false,
  },
  minimizeToTray: {
    description: Phrase.MinimizeToTrayDescription,
    type: 'boolean',
    default: false,
  },
  chatOverlayEnabled: {
    description: Phrase.ChatOverlayEnabledDescription,
    type: 'boolean',
    default: false,
  },
  chatOverlayOwnImage: {
    description: Phrase.ChatOverlayOwnImageDescription,
    type: 'boolean',
    default: false,
  },
  chatOverlayOwnImagePath: {
    description: Phrase.ChatOverlayOwnImagePathDescription,
    type: 'string',
    default: '',
  },
  chatOverlayScale: {
    description: Phrase.ChatOverlayScaleDescription,
    type: 'number',
    default: 1,
  },
  chatOverlayXPosition: {
    description: Phrase.ChatOverlayXPositionDescription,
    type: 'number',
    default: 0,
  },
  chatOverlayYPosition: {
    description: Phrase.ChatOverlayYPositionDescription,
    type: 'number',
    default: 0,
  },
  chatOverlayCropX: {
    description: Phrase.ChatOverlayCropXDescription,
    type: 'number',
    default: 0,
  },
  chatOverlayCropY: {
    description: Phrase.ChatOverlayCropYDescription,
    type: 'number',
    default: 0,
  },
  deathMarkers: {
    description: Phrase.DeathMarkersDescription,
    type: 'integer',
    default: 0,
  },
  pushToTalk: {
    description: Phrase.PushToTalkDescription,
    type: 'boolean',
    default: false,
  },
  pushToTalkKey: {
    description: Phrase.PushToTalkKeyDescription,
    type: 'integer',
    default: 0,
  },
  pushToTalkMouseButton: {
    description: Phrase.PushToTalkMouseButtonDescription,
    type: 'integer',
    default: 0,
  },
  pushToTalkModifiers: {
    description: Phrase.PushToTalkModifiersDescription,
    type: 'string',
    default: '',
  },
  pushToTalkReleaseDelay: {
    description: Phrase.PushToTalkReleaseDelayDescription,
    type: 'integer',
    default: 400,
  },
  obsAudioSuppression: {
    description: Phrase.ObsAudioSuppressionDescription,
    type: 'boolean',
    default: false,
  },
  language: {
    description: Phrase.LanguageDescription,
    type: 'string',
    default: 'English',
  },
  hideEmptyCategories: {
    description: Phrase.HideEmptyCategoriesDescription,
    type: 'boolean',
    default: false,
  },
  hardwareAcceleration: {
    description: Phrase.HardwareAccelerationDescription,
    type: 'boolean',
    default: true,
  },
  forceSdr: {
    description: Phrase.ForceSdrDescription,
    type: 'boolean',
    default: false,
  },
  videoSourceScale: {
    description: Phrase.VideoSourceScaleDescription,
    type: 'number',
    default: 1,
  },
  videoSourceXPosition: {
    description: Phrase.VideoSourceXPositionDescription,
    type: 'number',
    default: 0,
  },
  videoSourceYPosition: {
    description: Phrase.VideoSourceYPositionDescription,
    type: 'number',
    default: 0,
  },
  manualRecord: {
    description: Phrase.ManualRecordDescription,
    type: 'boolean',
    default: false,
  },
  manualRecordHotKey: {
    description: Phrase.ManualRecordHotKeyDescription,
    type: 'integer',
    default: 0,
  },
  manualRecordHotKeyModifiers: {
    description: 'Manual recording hotkey modifiers',
    type: 'string',
    default: '',
  },
  manualRecordSoundAlert: {
    description: Phrase.ManualRecordSoundAlertDescription,
    type: 'boolean',
    default: false,
  },
  firstTimeSetup: {
    description: Phrase.FirstTimeSetupDescription,
    type: 'boolean',
    default: true,
  },
};
