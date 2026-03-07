declare module 'noobs' {
  const noobs: {
    [key: string]: any;
  };

  export default noobs;

  export type ObsData = Record<string, any>;
  export type SceneItemPosition = Record<string, any>;
  export type Signal = Record<string, any>;
  export type SourceDimensions = Record<string, any>;

  export interface ObsProperty {
    name: string;
    type: string;
    items?: ObsListItem[];
    [key: string]: any;
  }

  export interface ObsListItem {
    name: string;
    value: string;
    [key: string]: any;
  }

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
}
