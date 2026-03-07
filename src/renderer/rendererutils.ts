/**
 * Please keep this file FREE from filesystem/Node JS process related code as it
 * is used in both the backend and the frontend, and the frontend does not have
 * access to import 'fs', for example.
 */
import { ffxivJobs } from 'main/constants';
import {
  MarkerColors,
  DeathMarkers,
  Encoder,
  EncoderType,
  PlayerDeathType,
  RendererVideo,
  VideoMarker,
  RawCombatant,
  StorageFilter,
  AudioSource,
  AppState,
} from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import { ESupportedEncoders } from 'main/obsEnums';
import {
  PTTEventType,
  PTTKeyPressEvent,
  UiohookKeyMap,
} from 'types/KeyTypesUIOHook';
import { ConfigurationSchema } from 'config/configSchema';
import { getLocalePhrase, Language } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getVideoResult = (video: RendererVideo): boolean => {
  return video.result;
};

/**
 * Returns a string of the form MM:SS.
 */
const getFormattedDuration = (video: RendererVideo) => {
  const { duration } = video;

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.round(duration % 60);

  const formattedHours = hours < 10 ? `0${hours}` : hours;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;

  if (hours > 0) {
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }

  return `${formattedMinutes}:${formattedSeconds}`;
};

/**
 * Get a color for an FFXIV job role.
 */
const getJobRoleColor = (jobId: number | undefined): string => {
  if (jobId === undefined) return '#999999';
  const job = ffxivJobs[jobId];
  if (!job) return '#999999';

  switch (job.role) {
    case 'tank':
      return '#3d5a80';
    case 'healer':
      return '#2d6a4f';
    case 'dps':
      return '#9d0208';
    default:
      return '#999999';
  }
};

/**
 * Get the job abbreviation for a job ID.
 */
const getJobAbbreviation = (jobId: number | undefined): string => {
  if (jobId === undefined) return '???';
  const job = ffxivJobs[jobId];
  return job ? job.abbreviation : '???';
};

/**
 * Return an array of death markers for a video.
 */
const getOwnDeathMarkers = (video: RendererVideo, language: Language) => {
  const videoMarkers: VideoMarker[] = [];
  const { player } = video;

  if (video.deaths === undefined) {
    return videoMarkers;
  }

  video.deaths.forEach((death: PlayerDeathType) => {
    const name = death.name;
    let markerText = getLocalePhrase(language, Phrase.Death);
    markerText += ` (${name})`;
    const color = MarkerColors.LOSS;

    if (!player || !player._name) {
      return;
    }

    if (player._name === name) {
      videoMarkers.push({
        time: death.timestamp as unknown as number,
        text: markerText,
        color,
        duration: 5,
      });
    }
  });

  return videoMarkers;
};

/**
 * Return an array of death markers for a video.
 */
const getAllDeathMarkers = (video: RendererVideo, language: Language) => {
  const videoMarkers: VideoMarker[] = [];

  if (video.deaths === undefined) {
    return videoMarkers;
  }

  video.deaths.forEach((death: PlayerDeathType) => {
    const name = death.name;
    let markerText = getLocalePhrase(language, Phrase.Death);
    markerText += ` (${name})`;
    const color = MarkerColors.LOSS;

    videoMarkers.push({
      time: death.timestamp as unknown as number,
      text: markerText,
      color,
      duration: 5,
    });
  });

  return videoMarkers;
};

const isCCUtil = (video: RendererVideo) => {
  const { category, parentCategory } = video;

  return (
    category === VideoCategory.CrystallineConflict ||
    parentCategory === VideoCategory.CrystallineConflict
  );
};

const isClip = (video: RendererVideo) => {
  const { category } = video;
  return category === VideoCategory.Clips;
};

const getResultColor = (video: RendererVideo) => {
  const { result } = video;

  if (result) {
    return 'hsl(var(--success))';
  }

  return 'hsl(var(--error))';
};

const getPlayerName = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return '';
  }

  if (player._name === undefined) {
    return '';
  }

  return player._name;
};

const getPlayerWorldName = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return '';
  }

  if (player._worldName === undefined) {
    return '';
  }

  return player._worldName;
};

const getPlayerJobId = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return 0;
  }

  if (player._jobId === undefined) {
    return 0;
  }

  return player._jobId;
};

const getPlayerTeamID = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return 0;
  }

  if (player._teamId === undefined) {
    return 0;
  }

  return player._teamId;
};

const getVideoTime = (video: RendererVideo) => {
  const { start, mtime } = video;
  const date = start ? new Date(start) : new Date(mtime);

  const hours = date
    .getHours()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const mins = date
    .getMinutes()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const timeAsString = `${hours}:${mins}`;
  return timeAsString;
};

const videoToDate = (video: RendererVideo) => {
  let date;

  if (video.clippedAt) {
    date = new Date(video.clippedAt);
  } else if (video.start) {
    date = new Date(video.start);
  } else {
    date = new Date(video.mtime);
  }

  return date;
};

const dateToHumanReadable = (date: Date) => {
  const day = date.getDate();
  const month = months[date.getMonth()].slice(0, 3);
  const dateAsString = `${day} ${month}`;

  const hours = date
    .getHours()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const mins = date
    .getMinutes()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const timeAsString = `${hours}:${mins}`;

  return `${timeAsString} ${dateAsString}`;
};

const getVideoDate = (video: RendererVideo) => {
  let date;

  if (video.clippedAt) {
    date = new Date(video.clippedAt);
  } else if (video.start) {
    date = new Date(video.start);
  } else {
    date = new Date(video.mtime);
  }

  const day = date.getDate();
  const month = months[date.getMonth()].slice(0, 3);
  const dateAsString = `${day} ${month}`;
  return dateAsString;
};

/**
 * Standardizes device names to an array of strings and filters by known devices.
 */
const standardizeAudioDeviceNames = (
  deviceNames: string[] | string,
): string[] => {
  let normalizedDeviceNames: string[];

  if (typeof deviceNames === 'string') {
    normalizedDeviceNames = deviceNames.split(',');
  } else {
    normalizedDeviceNames = deviceNames;
  }

  return normalizedDeviceNames;
};

const isHighRes = (res: string) => {
  const resolutions = res.split('x');
  const [width, height] = resolutions;

  if (parseInt(width, 10) >= 4000 || parseInt(height, 10) >= 4000) {
    return true;
  }

  return false;
};

const encoderFilter = (enc: string, highRes: boolean) => {
  const encoder = enc as ESupportedEncoders;

  if (!Object.values(ESupportedEncoders).includes(encoder)) {
    return false;
  }

  if (highRes) {
    return (
      encoder === ESupportedEncoders.OBS_X264 ||
      encoder === ESupportedEncoders.AMD_AV1 ||
      encoder === ESupportedEncoders.NVENC_AV1 ||
      encoder === ESupportedEncoders.QSV_AV1
    );
  }

  return true;
};

const mapEncoderToString = (enc: Encoder, lang: Language) => {
  let encoderAsString = enc.name;

  switch (enc.type) {
    case EncoderType.HARDWARE:
      encoderAsString += ` (${getLocalePhrase(lang, Phrase.Hardware)})`;
      break;
    case EncoderType.SOFTWARE:
      encoderAsString += ` (${getLocalePhrase(lang, Phrase.Software)})`;
      break;
    default:
      break;
  }

  return encoderAsString;
};

const getFriendlyEncoderName = (enc: ESupportedEncoders) => {
  switch (enc) {
    case ESupportedEncoders.OBS_X264:
      return 'OBS H.264';
    case ESupportedEncoders.NVENC_H264:
      return 'NVIDIA H.264';
    case ESupportedEncoders.NVENC_AV1:
      return 'NVIDIA AV1';
    case ESupportedEncoders.AMD_H264:
      return 'AMD H.264';
    case ESupportedEncoders.AMD_AV1:
      return 'AMD AV1';
    case ESupportedEncoders.QSV_H264:
      return 'Intel H.264';
    case ESupportedEncoders.QSV_AV1:
      return 'Intel AV1';
    default:
      throw new Error('Unknown Encoder');
  }
};

const mapStringToEncoder = (enc: string): Encoder => {
  const value = enc as ESupportedEncoders;
  const isHardwareEncoder = value !== ESupportedEncoders.OBS_X264;
  const type = isHardwareEncoder ? EncoderType.HARDWARE : EncoderType.SOFTWARE;
  const name = getFriendlyEncoderName(value);
  return { name, value, type };
};

const pathSelect = async (): Promise<string> => {
  const ipc = window.electron.ipcRenderer;
  const path = await ipc.invoke('selectPath', []);
  return path;
};

const fileSelect = async (): Promise<string> => {
  const ipc = window.electron.ipcRenderer;
  const path = await ipc.invoke('selectFile', []);
  return path;
};

const imageSelect = async (): Promise<string> => {
  const ipc = window.electron.ipcRenderer;
  const path = await ipc.invoke('selectImage', []);
  return path;
};

const convertNumToDeathMarkers = (n: number) => {
  if (n === 2) return DeathMarkers.ALL;
  if (n === 1) return DeathMarkers.OWN;
  return DeathMarkers.NONE;
};

const convertDeathMarkersToNum = (d: DeathMarkers) => {
  if (d === DeathMarkers.ALL) return 2;
  if (d === DeathMarkers.OWN) return 1;
  return 0;
};

const getPTTKeyPressEventFromConfig = (
  config: ConfigurationSchema,
): PTTKeyPressEvent => {
  const ctrl = config.pushToTalkModifiers.includes('ctrl');
  const win = config.pushToTalkModifiers.includes('win');
  const shift = config.pushToTalkModifiers.includes('shift');
  const alt = config.pushToTalkModifiers.includes('alt');

  const type =
    config.pushToTalkKey > 0
      ? PTTEventType.EVENT_KEY_PRESSED
      : PTTEventType.EVENT_MOUSE_PRESSED;

  return {
    altKey: alt,
    ctrlKey: ctrl,
    metaKey: win,
    shiftKey: shift,
    keyCode: config.pushToTalkKey,
    mouseButton: config.pushToTalkMouseButton,
    type,
  };
};

const getManualRecordHotKeyFromConfig = (
  config: ConfigurationSchema,
): PTTKeyPressEvent => {
  const ctrl = config.manualRecordHotKeyModifiers.includes('ctrl');
  const win = config.manualRecordHotKeyModifiers.includes('win');
  const shift = config.manualRecordHotKeyModifiers.includes('shift');
  const alt = config.manualRecordHotKeyModifiers.includes('alt');

  return {
    altKey: alt,
    ctrlKey: ctrl,
    metaKey: win,
    shiftKey: shift,
    keyCode: config.manualRecordHotKey,
    mouseButton: -1,
    type: PTTEventType.EVENT_KEY_PRESSED,
  };
};

const getKeyByValue = (object: any, value: any) => {
  return Object.keys(object).find((key) => object[key] === value);
};

const getKeyModifiersString = (keyevent: PTTKeyPressEvent) => {
  const modifiers: string[] = [];

  if (keyevent.altKey) {
    modifiers.push('alt');
  }
  if (keyevent.ctrlKey) {
    modifiers.push('ctrl');
  }
  if (keyevent.shiftKey) {
    modifiers.push('shift');
  }
  if (keyevent.metaKey) {
    modifiers.push('win');
  }

  return modifiers.join(',');
};

const getNextKeyOrMouseEvent = async (): Promise<PTTKeyPressEvent> => {
  const ipc = window.electron.ipcRenderer;
  return ipc.invoke('getNextKeyPress', []);
};

const secToMmSs = (s: number) => {
  const rounded = Math.round(s);
  const mins = Math.floor(rounded / 60);
  const secs = rounded - mins * 60;

  const ss = secs.toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });

  const mm = mins.toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });

  return `${mm}:${ss}`;
};

/**
 * Get a result text appropriate for the video category.
 */
const getVideoResultText = (
  video: RendererVideo,
  language: Language,
): string => {
  const { result } = video;

  return result
    ? getLocalePhrase(language, Phrase.Win)
    : getLocalePhrase(language, Phrase.Loss);
};

const getCategoryFromConfig = (config: ConfigurationSchema) => {
  const categories = Object.values(VideoCategory);
  return categories[config.selectedCategory];
};

const getCategoryIndex = (category: VideoCategory) => {
  const categories = Object.values(VideoCategory);
  return categories.indexOf(category);
};

const getVideoCategoryFilter = (category: VideoCategory) => {
  return (video: RendererVideo) => video.category === category;
};

const getVideoStorageFilter = (filter: StorageFilter) => {
  if (filter === StorageFilter.DISK) return (rv: RendererVideo) => !rv.cloud;
  if (filter === StorageFilter.CLOUD) return (rv: RendererVideo) => rv.cloud;
  return () => true;
};

const getFirstInCategory = (
  videos: RendererVideo[],
  category: VideoCategory,
) => {
  return videos.find((video) => video.category === category);
};

/**
 * Stop an event propagating higher.
 */
const stopPropagation = (event: React.MouseEvent<HTMLElement>) => {
  event.stopPropagation();
  event.preventDefault();
};

const povNameSort = (a: RendererVideo, b: RendererVideo) => {
  const playerA = a.player?._name;
  const playerB = b.player?._name;

  if (!playerA || !playerB) return 0;
  return playerA.localeCompare(playerB);
};

const povDiskFirstNameSort = (a: RendererVideo, b: RendererVideo) => {
  const diskA = !a.cloud;
  const diskB = !b.cloud;

  if (diskA && !diskB) {
    return -1;
  }

  if (diskB && !diskA) {
    return 1;
  }

  return povNameSort(a, b);
};

const povCloudFirstNameSort = (a: RendererVideo, b: RendererVideo) => {
  const diskA = !a.cloud;
  const diskB = !b.cloud;

  if (diskA && !diskB) {
    return 1;
  }

  if (diskB && !diskA) {
    return -1;
  }

  return povNameSort(a, b);
};

const combatantNameSort = (a: RawCombatant, b: RawCombatant) => {
  const playerA = a._name;
  const playerB = b._name;
  if (!playerA || !playerB) return 0;
  return playerA.localeCompare(playerB);
};

const areDatesWithinSeconds = (d1: Date, d2: Date, sec: number) => {
  const differenceMilliseconds = Math.abs(d1.getTime() - d2.getTime());
  return differenceMilliseconds <= sec * 1000;
};

const toFixedDigits = (n: number, d: number) =>
  n.toLocaleString('en-US', { minimumIntegerDigits: d, useGrouping: false });

const countUniqueViewpoints = (video: RendererVideo) => {
  const povs = [video, ...video.multiPov];

  const unique = povs.filter(
    (item, index, self) =>
      self.findIndex((i) => i.player?._name === item.player?._name) === index,
  );

  return unique.length;
};

// Retrieve the available choices for this source from libobs.
const getAudioSourceChoices = async (src: AudioSource) => {
  const ipc = window.electron.ipcRenderer;
  const properties = await ipc.getAudioSourceProperties(src.id);

  const devices = properties.find(
    (prop) => prop.name === 'device_id' || prop.name === 'window',
  );

  if (!devices || devices.type !== 'list') {
    return [];
  }

  return devices.items ?? [];
};

const getKeyPressEventString = (
  event: PTTKeyPressEvent,
  appState: AppState,
) => {
  const keys: string[] = [];

  if (event.altKey) keys.push('Alt');
  if (event.ctrlKey) keys.push('Ctrl');
  if (event.shiftKey) keys.push('Shift');
  if (event.metaKey) keys.push('Win');

  const { keyCode, mouseButton } = event;

  if (keyCode > 0) {
    const key = getKeyByValue(UiohookKeyMap, keyCode);
    if (key !== undefined) keys.push(key);
  } else if (mouseButton > 0) {
    keys.push(
      `${getLocalePhrase(appState.language, Phrase.Mouse)} ${
        event.mouseButton
      }`,
    );
  }

  return keys.join('+');
};

const videoMatch = (a: RendererVideo, b: RendererVideo) =>
  a.videoName === b.videoName && a.cloud === b.cloud;

const videoMatchName = (a: RendererVideo, name: string) => a.videoName === name;

export {
  getFormattedDuration,
  getVideoResult,
  getJobRoleColor,
  getJobAbbreviation,
  getVideoResultText,
  isCCUtil,
  isClip,
  getResultColor,
  getPlayerName,
  getPlayerWorldName,
  getPlayerJobId,
  getPlayerTeamID,
  getVideoTime,
  getVideoDate,
  standardizeAudioDeviceNames,
  encoderFilter,
  mapEncoderToString,
  mapStringToEncoder,
  pathSelect,
  fileSelect,
  imageSelect,
  convertNumToDeathMarkers,
  convertDeathMarkersToNum,
  getAllDeathMarkers,
  getOwnDeathMarkers,
  isHighRes,
  getPTTKeyPressEventFromConfig,
  getManualRecordHotKeyFromConfig,
  getKeyByValue,
  getKeyModifiersString,
  getNextKeyOrMouseEvent,
  secToMmSs,
  getCategoryFromConfig,
  getVideoCategoryFilter,
  getCategoryIndex,
  getFirstInCategory,
  stopPropagation,
  povCloudFirstNameSort,
  povDiskFirstNameSort,
  areDatesWithinSeconds,
  toFixedDigits,
  combatantNameSort,
  countUniqueViewpoints,
  videoToDate,
  dateToHumanReadable,
  getVideoStorageFilter,
  getAudioSourceChoices,
  getKeyPressEventString,
  videoMatch,
  videoMatchName,
};
