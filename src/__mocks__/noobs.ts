const noobs = {
  Init: jest.fn(),
  Shutdown: jest.fn(),
  SetBuffering: jest.fn(),
  InitPreview: jest.fn(),
  SetDrawSourceOutline: jest.fn(),
  CreateSource: jest.fn().mockReturnValue('mock-source'),
  DeleteSource: jest.fn(),
  AddSourceToScene: jest.fn(),
  RemoveSourceFromScene: jest.fn(),
  GetSourceSettings: jest.fn().mockReturnValue({}),
  SetSourceSettings: jest.fn(),
  GetSourceProperties: jest.fn().mockReturnValue([]),
  SetSourcePos: jest.fn(),
  GetSourcePos: jest.fn().mockReturnValue({ x: 0, y: 0, width: 0, height: 0 }),
  SetSourceVolume: jest.fn(),
  SetForceMono: jest.fn(),
  SetAudioSuppression: jest.fn(),
  SetVolmeterEnabled: jest.fn(),
  ResetVideoContext: jest.fn(),
  SetRecordingCfg: jest.fn(),
  SetVideoEncoder: jest.fn(),
  ListVideoEncoders: jest.fn().mockReturnValue([]),
  ConfigurePreview: jest.fn(),
  ShowPreview: jest.fn(),
  HidePreview: jest.fn(),
  DisablePreview: jest.fn(),
  GetPreviewInfo: jest.fn().mockReturnValue({
    canvasWidth: 1920,
    canvasHeight: 1080,
  }),
  StartBuffer: jest.fn(),
  StartRecording: jest.fn(),
  StopRecording: jest.fn(),
  ForceStopRecording: jest.fn(),
  GetLastRecording: jest.fn().mockReturnValue(''),
  SetMuteAudioInputs: jest.fn(),
};

export default noobs;

export type ObsData = Record<string, any>;
export type SceneItemPosition = Record<string, any>;
export type Signal = Record<string, any>;
export type SourceDimensions = Record<string, any>;

export const enum ERecordingState {
  None = 0,
  Recording = 1,
  Paused = 2,
}

export const enum ESourceType {
  Input = 0,
  Filter = 1,
  Transition = 2,
  Scene = 3,
}
