import { ConfigurationSchema } from 'config/configSchema';
import { AudioSource } from 'main/types';
import * as React from 'react';

export const getConfigValue = <T>(configKey: string): T => {
  return window.electron.ipcRenderer.sendSync('config', [
    'get',
    configKey,
  ]) as T;
};

export const setConfigValue = (configKey: string, value: any): void => {
  window.electron.ipcRenderer.sendMessage('config', ['set', configKey, value]);
};

export const setConfigValues = (dict: { [key: string]: any }): void => {
  window.electron.ipcRenderer.sendMessage('config', ['set_values', dict]);
};

export const getSettings = (): ConfigurationSchema => {
  /* eslint-disable prettier/prettier */
  const configValues = {
    storagePath: getConfigValue<string>('storagePath'),
    bufferStoragePath: getConfigValue<string>('bufferStoragePath'),
    separateBufferPath: getConfigValue<boolean>('separateBufferPath'),
    iinactLogPath: getConfigValue<string>('iinactLogPath'),
    maxStorage: getConfigValue<number>('maxStorage'),
    monitorIndex: getConfigValue<number>('monitorIndex'),
    audioSources: getConfigValue<AudioSource[]>('audioSources'),
    startUp: getConfigValue<boolean>('startUp'),
    startMinimized: getConfigValue<boolean>('startMinimized'),
    obsOutputResolution: getConfigValue<string>('obsOutputResolution'),
    obsFPS: getConfigValue<number>('obsFPS'),
    obsForceMono: getConfigValue<boolean>('obsForceMono'),
    obsQuality: getConfigValue<string>('obsQuality'),
    obsCaptureMode: getConfigValue<string>('obsCaptureMode'),
    obsRecEncoder: getConfigValue<string>('obsRecEncoder'),
    recordCrystallineConflict: getConfigValue<boolean>('recordCrystallineConflict'),
    recordRaids: getConfigValue<boolean>('recordRaids'),
    captureCursor: getConfigValue<boolean>('captureCursor'),
    minimizeOnQuit: getConfigValue<boolean>('minimizeOnQuit'),
    minimizeToTray: getConfigValue<boolean>('minimizeToTray'),
    chatOverlayEnabled: getConfigValue<boolean>('chatOverlayEnabled'),
    chatOverlayOwnImage: getConfigValue<boolean>('chatOverlayOwnImage'),
    chatOverlayOwnImagePath: getConfigValue<string>('chatOverlayOwnImagePath'),
    chatOverlayScale: getConfigValue<number>('chatOverlayScale'),
    chatOverlayXPosition: getConfigValue<number>('chatOverlayXPosition'),
    chatOverlayYPosition: getConfigValue<number>('chatOverlayYPosition'),
    chatOverlayCropX: getConfigValue<number>('chatOverlayCropX'),
    chatOverlayCropY: getConfigValue<number>('chatOverlayCropY'),
    selectedCategory: getConfigValue<number>('selectedCategory'),
    deathMarkers: getConfigValue<number>('deathMarkers'),
    pushToTalk: getConfigValue<boolean>('pushToTalk'),
    pushToTalkKey: getConfigValue<number>('pushToTalkKey'),
    pushToTalkMouseButton: getConfigValue<number>('pushToTalkMouseButton'),
    pushToTalkModifiers: getConfigValue<string>('pushToTalkModifiers'),
    pushToTalkReleaseDelay: getConfigValue<number>('pushToTalkReleaseDelay'),
    obsAudioSuppression: getConfigValue<boolean>('obsAudioSuppression'),
    cloudStorage: getConfigValue<boolean>('cloudStorage'),
    cloudUpload: getConfigValue<boolean>('cloudUpload'),
    cloudUploadClips: getConfigValue<boolean>('cloudUploadClips'),
    cloudAccountName: getConfigValue<string>('cloudAccountName'),
    cloudAccountPassword: getConfigValue<string>('cloudAccountPassword'),
    cloudGuildName: getConfigValue<string>('cloudGuildName'),
    language: getConfigValue<string>('language'),
    hideEmptyCategories: getConfigValue<boolean>('hideEmptyCategories'),
    hardwareAcceleration: getConfigValue<boolean>('hardwareAcceleration'),
    forceSdr: getConfigValue<boolean>('forceSdr'),
    videoSourceScale: getConfigValue<number>('videoSourceScale'),
    videoSourceXPosition: getConfigValue<number>('videoSourceXPosition'),
    videoSourceYPosition: getConfigValue<number>('videoSourceYPosition'),
    manualRecord: getConfigValue<boolean>('manualRecord'),
    manualRecordHotKey: getConfigValue<number>('manualRecordHotKey'),
    manualRecordHotKeyModifiers: getConfigValue<string>('manualRecordHotKeyModifiers'),
    manualRecordSoundAlert: getConfigValue<boolean>('manualRecordSoundAlert'),
    manualRecordUpload: getConfigValue<boolean>('manualRecordUpload'),
    chatUserNameAgreed: getConfigValue<string>('chatUserNameAgreed'),
    firstTimeSetup: getConfigValue<boolean>('firstTimeSetup'),
    /* eslint-enable prettier/prettier */
  };

  return configValues;
};

export const useSettings = (): [
  ConfigurationSchema,
  React.Dispatch<React.SetStateAction<ConfigurationSchema>>,
] => {
  const configValues = getSettings();
  return React.useState<ConfigurationSchema>(configValues);
};
