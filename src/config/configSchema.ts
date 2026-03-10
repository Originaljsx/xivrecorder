import { AudioSource, AudioSourceType } from 'main/types';

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
  cloudStorage: boolean;
  cloudUpload: boolean;
  cloudUploadClips: boolean;
  cloudAccountName: string;
  cloudAccountPassword: string;
  cloudGuildName: string;
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
  manualRecordUpload: boolean;
  chatUserNameAgreed: string;
  firstTimeSetup: boolean;
};

export type ConfigurationSchemaKey = keyof ConfigurationSchema;

/**
 * Config schema. The descriptions may get displayed in the UI.
 */
export const configSchema: Record<string, any> = {
  storagePath: {
    description: 'Path to store recorded videos',
    type: 'string',
    default: '',
  },
  separateBufferPath: {
    description: 'Use a separate path for OBS buffer files',
    type: 'boolean',
    default: false,
  },
  bufferStoragePath: {
    description: 'Path for OBS buffer files',
    type: 'string',
    default: '',
  },
  iinactLogPath: {
    description: 'Path to IINACT log directory',
    type: 'string',
    default: '',
  },
  maxStorage: {
    description: 'Maximum storage in GB',
    type: 'integer',
    default: 50,
    minimum: 0,
  },
  monitorIndex: {
    description: 'Monitor index for capture',
    type: 'integer',
    default: 0,
    minimum: 1,
    maximum: 4,
  },
  selectedCategory: {
    description: 'Currently selected video category',
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
      },
    ],
  },
  startUp: {
    description: 'Start on Windows login',
    type: 'boolean',
    default: false,
  },
  startMinimized: {
    description: 'Start minimized to tray',
    type: 'boolean',
    default: false,
  },
  obsOutputResolution: {
    description: 'OBS output resolution',
    type: 'string',
    default: '1920x1080',
  },
  obsFPS: {
    description: 'OBS frames per second',
    type: 'integer',
    default: 60,
    minimum: 15,
    maximum: 120,
  },
  obsForceMono: {
    description: 'Force mono audio output',
    type: 'boolean',
    default: false,
  },
  obsQuality: {
    description: 'OBS recording quality (CRF value)',
    type: 'string',
    default: 'High',
  },
  obsCaptureMode: {
    description: 'OBS capture mode',
    type: 'string',
    default: 'game_capture',
  },
  obsRecEncoder: {
    description: 'OBS recording encoder',
    type: 'string',
    default: 'obs_x264',
  },
  recordCrystallineConflict: {
    description: 'Record Crystalline Conflict matches',
    type: 'boolean',
    default: true,
  },
  recordRaids: {
    description: 'Record raid and trial boss pulls',
    type: 'boolean',
    default: true,
  },
  captureCursor: {
    description: 'Capture mouse cursor in recordings',
    type: 'boolean',
    default: false,
  },
  minimizeOnQuit: {
    description: 'Minimize to tray on close',
    type: 'boolean',
    default: false,
  },
  minimizeToTray: {
    description: 'Minimize to system tray',
    type: 'boolean',
    default: false,
  },
  chatOverlayEnabled: {
    description: 'Enable chat overlay on recordings',
    type: 'boolean',
    default: false,
  },
  chatOverlayOwnImage: {
    description: 'Use custom image for chat overlay',
    type: 'boolean',
    default: false,
  },
  chatOverlayOwnImagePath: {
    description: 'Path to custom chat overlay image',
    type: 'string',
    default: '',
  },
  chatOverlayScale: {
    description: 'Chat overlay scale',
    type: 'number',
    default: 1,
  },
  chatOverlayXPosition: {
    description: 'Chat overlay X position',
    type: 'number',
    default: 0,
  },
  chatOverlayYPosition: {
    description: 'Chat overlay Y position',
    type: 'number',
    default: 0,
  },
  chatOverlayCropX: {
    description: 'Chat overlay X crop',
    type: 'number',
    default: 0,
  },
  chatOverlayCropY: {
    description: 'Chat overlay Y crop',
    type: 'number',
    default: 0,
  },
  deathMarkers: {
    description: 'Show death markers on video timeline',
    type: 'integer',
    default: 0,
  },
  pushToTalk: {
    description: 'Enable push-to-talk for mic recording',
    type: 'boolean',
    default: false,
  },
  pushToTalkKey: {
    description: 'Push-to-talk key code',
    type: 'integer',
    default: 0,
  },
  pushToTalkMouseButton: {
    description: 'Push-to-talk mouse button',
    type: 'integer',
    default: 0,
  },
  pushToTalkModifiers: {
    description: 'Push-to-talk modifier keys',
    type: 'string',
    default: '',
  },
  pushToTalkReleaseDelay: {
    description: 'Push-to-talk release delay in ms',
    type: 'integer',
    default: 400,
  },
  obsAudioSuppression: {
    description: 'Enable audio noise suppression',
    type: 'boolean',
    default: false,
  },
  cloudStorage: {
    description: 'Enable cloud storage',
    type: 'boolean',
    default: false,
  },
  cloudUpload: {
    description: 'Enable cloud upload',
    type: 'boolean',
    default: false,
  },
  cloudUploadClips: {
    description: 'Upload clips to cloud',
    type: 'boolean',
    default: false,
  },
  cloudAccountName: {
    description: 'Cloud account name',
    type: 'string',
    default: '',
  },
  cloudAccountPassword: {
    description: 'Cloud account password',
    type: 'string',
    default: '',
  },
  cloudGuildName: {
    description: 'Cloud guild name',
    type: 'string',
    default: '',
  },
  language: {
    description: 'Application language',
    type: 'string',
    default: 'English',
  },
  hideEmptyCategories: {
    description: 'Hide categories with no videos',
    type: 'boolean',
    default: false,
  },
  hardwareAcceleration: {
    description: 'Enable hardware acceleration for the app',
    type: 'boolean',
    default: true,
  },
  forceSdr: {
    description: 'Force SDR color space',
    type: 'boolean',
    default: false,
  },
  videoSourceScale: {
    description: 'Video source scale',
    type: 'number',
    default: 1,
  },
  videoSourceXPosition: {
    description: 'Video source X position',
    type: 'number',
    default: 0,
  },
  videoSourceYPosition: {
    description: 'Video source Y position',
    type: 'number',
    default: 0,
  },
  manualRecord: {
    description: 'Enable manual recording',
    type: 'boolean',
    default: false,
  },
  manualRecordHotKey: {
    description: 'Manual recording hotkey code',
    type: 'integer',
    default: 0,
  },
  manualRecordHotKeyModifiers: {
    description: 'Manual recording hotkey modifiers',
    type: 'string',
    default: '',
  },
  manualRecordSoundAlert: {
    description: 'Play sound when manual recording starts/stops',
    type: 'boolean',
    default: false,
  },
  manualRecordUpload: {
    description: 'Upload manual recordings to cloud',
    type: 'boolean',
    default: false,
  },
  chatUserNameAgreed: {
    description: 'Chat username agreed',
    type: 'string',
    default: '',
  },
  firstTimeSetup: {
    description: 'Whether this is the first time setup',
    type: 'boolean',
    default: true,
  },
};
