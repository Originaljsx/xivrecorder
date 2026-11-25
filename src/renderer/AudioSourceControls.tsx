import { AppState, AudioSource, AudioSourceType } from 'main/types';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { configSchema } from 'config/configSchema';
import {
  AppWindow,
  AudioLines,
  Gamepad2,
  Info,
  MicVocal,
  PlusIcon,
  Speaker,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { useSettings, setConfigValues } from './useSettings';
import {
  getAudioSourceChoices,
  getKeyByValue,
  getKeyModifiersString,
  getNextKeyOrMouseEvent,
  getPTTKeyPressEventFromConfig,
} from './rendererutils';
import { PTTKeyPressEvent, UiohookKeyMap } from '../types/KeyTypesUIOHook';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import Slider from './components/Slider/Slider';
import Switch from './components/Switch/Switch';
import { Input } from './components/Input/Input';
import Progress from './components/Progress/Progress';
import { Button } from './components/Button/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/Select/Select';

import { ObsListItem } from 'noobs';
import { Phrase } from 'localisation/phrases';
import {
  defaultAudioTrack,
  ffxivAudioWindow,
  ffxivExecutable,
  obsAudioTracks,
} from 'main/constants';
import { ToggleGroup, ToggleGroupItem } from './components/ToggleGroup/ToggleGroup';

const ipc = window.electron.ipcRenderer;

/**
 * Is this source the per-application capture of the FFXIV game? Matching is by
 * executable, so the window title / class part of the device string can vary.
 */
const isGameAudioSource = (src: AudioSource) =>
  src.type === AudioSourceType.PROCESS &&
  typeof src.device === 'string' &&
  src.device.toLowerCase().endsWith(`:${ffxivExecutable}`);

/**
 * The name OBS gives the FFXIV window in its window list.
 */
const gameAudioFriendlyName = `[${ffxivExecutable}]: FINAL FANTASY XIV`;
let debounceTimer: NodeJS.Timeout | undefined;

interface IProps {
  appState: AppState;
  setPreviewEnabled: Dispatch<SetStateAction<boolean>>;
}

const AudioSourceControls = (props: IProps) => {
  const { appState, setPreviewEnabled } = props;
  const { language } = appState;
  const [config, setConfig] = useSettings();
  const initialRender = useRef(true);
  const audioChoicesLoaded = useRef(false);
  const pttInputRef = useRef<HTMLInputElement>(null);

  // Available choices per source.
  const [sourceChoices, setSourceChoices] = useState<
    Record<string, ObsListItem[]>
  >({});

  // Volmeter data.
  const [sourceMagnitude, setSourceMagnitude] = useState<
    Record<string, number>
  >({});


  // We will block adding new sources if we have a partially
  // configured process source (speakers and mics can both
  // default to "default" so this only effects process sources).
  let sourcesAreFullyDefined = true;

  config.audioSources.forEach((src) => {
    if (!src.device) {
      sourcesAreFullyDefined = false;
    }
  });

  const [pttHotKeyFieldFocused, setPttHotKeyFieldFocused] = useState(false);

  const [pttHotKey, setPttHotKey] = useState<PTTKeyPressEvent>(
    getPTTKeyPressEventFromConfig(config),
  );

  const [localReleaseDelay, setLocalReleaseDelay] = useState(
    config.pushToTalkReleaseDelay,
  );

  useEffect(() => {
    if (initialRender.current) return;
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      setConfigValues({
        pushToTalk: config.pushToTalk,
        pushToTalkKey: config.pushToTalkKey,
        pushToTalkMouseButton: config.pushToTalkMouseButton,
        pushToTalkModifiers: config.pushToTalkModifiers,
        pushToTalkReleaseDelay: config.pushToTalkReleaseDelay,
      });

      // These parameters require a full audio reconfigure once
      // the config is applied.
      ipc.reconfigureAudio();
    }, 500);
  }, [
    config.pushToTalk,
    config.pushToTalkKey,
    config.pushToTalkMouseButton,
    config.pushToTalkModifiers,
    config.pushToTalkReleaseDelay,
  ]);

  useEffect(() => {
    // No reconfigure required for these parameters, we
    // do it via IPC call.
    if (initialRender.current) return;

    setConfigValues({
      audioSources: config.audioSources,
      obsAudioSuppression: config.obsAudioSuppression,
      obsForceMono: config.obsForceMono,
    });
  }, [config.audioSources, config.obsAudioSuppression, config.obsForceMono]);

  useEffect(() => {
    if (initialRender.current) return;

    const setPushToTalkKey = (event: PTTKeyPressEvent) => {
      setConfig((prevState) => {
        return {
          ...prevState,
          pushToTalkKey: event.keyCode,
          pushToTalkMouseButton: event.mouseButton,
          pushToTalkModifiers: getKeyModifiersString(event),
        };
      });
    };

    const listenNextKeyPress = async () => {
      if (pttHotKeyFieldFocused) {
        const keyPressEvent = await getNextKeyOrMouseEvent();
        setPttHotKeyFieldFocused(false);
        setPttHotKey(keyPressEvent);
        setPushToTalkKey(keyPressEvent);
        pttInputRef.current?.blur();
      }
    };

    listenNextKeyPress();
  }, [pttHotKeyFieldFocused, setConfig]);

  useEffect(() => {
    initialRender.current = false;
  }, []);

  const volmeterRefresh = (id: string, magnitude: number) => {
    setSourceMagnitude((prev) => {
      prev[id] = magnitude;
      return { ...prev };
    });
  };

  // On initial load we don't know the available choices for existing
  // sources in the config, so retrieve it here.
  const initAudioSourceChoices = async () => {
    const promises = config.audioSources.map(async (s) => ({
      id: s.id,
      choices: await getAudioSourceChoices(s),
    }));

    const choices = await Promise.all(promises);
    const updated: Record<string, ObsListItem[]> = {};

    choices.forEach((choice) => {
      updated[choice.id] = choice.choices;
    });

    setSourceChoices(updated);
    audioChoicesLoaded.current = true;
  };

  useEffect(() => {
    ipc.on('volmeter', (id: unknown, magnitude: unknown) =>
      volmeterRefresh(id as string, magnitude as number),
    );

    const initAudioSettings = async () => {
      await ipc.audioSettingsOpen();
      await initAudioSourceChoices();
    };

    // Attach the audio devices so volmeter bars show
    // even if FFXIV is closed.
    initAudioSettings();

    return () => {
      ipc.removeAllListeners('volmeter');

      // Remove the audio devices so Windows can still sleep on unmounting.
      ipc.audioSettingsClosed();
    };
  }, []);

  const setForceMono = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsForceMono: checked,
      };
    });

    ipc.setForceMono(checked);
  };

  const setPushToTalk = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        pushToTalk: checked,
      };
    });
  };

  const setAudioSuppression = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsAudioSuppression: checked,
      };
    });

    ipc.setAudioSuppression(checked);
  };

  const getMonoSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.MonoInputLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.obsForceMono.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={config.obsForceMono}
            onCheckedChange={setForceMono}
          />
        </div>
      </div>
    );
  };

  const getPushToTalkSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.PushToTalkLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.pushToTalk.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch checked={config.pushToTalk} onCheckedChange={setPushToTalk} />
        </div>
      </div>
    );
  };

  const getKeyPressEventString = (event: PTTKeyPressEvent) => {
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

  const getHotkeyString = () => {
    if (pttHotKeyFieldFocused) {
      return getLocalePhrase(appState.language, Phrase.PressAnyKeyCombination);
    }

    if (pttHotKey !== null) {
      return `${getKeyPressEventString(pttHotKey)} (${getLocalePhrase(
        appState.language,
        Phrase.ClickToRebind,
      )})`;
    }

    return getLocalePhrase(appState.language, Phrase.ClickToBind);
  };

  const getPushToTalkSelect = () => {
    return (
      <div className="flex flex-col">
        <Label htmlFor="pttKey" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.PushToTalkKeyLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.pushToTalkKey.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="pttKey"
          ref={pttInputRef}
          value={getHotkeyString()}
          onFocus={() => setPttHotKeyFieldFocused(true)}
          onBlur={() => setPttHotKeyFieldFocused(false)}
          readOnly
        />
      </div>
    );
  };

  const getAudioSuppressionSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.AudioSuppressionLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.obsAudioSuppression.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={config.obsAudioSuppression}
            onCheckedChange={setAudioSuppression}
          />
        </div>
      </div>
    );
  };

  useEffect(() => {
    setLocalReleaseDelay(config.pushToTalkReleaseDelay);
  }, [config.pushToTalkReleaseDelay]);

  const commitReleaseDelay = (newValue: number[]) => {
    const ms = newValue[0];
    if (typeof ms !== 'number') return;
    setConfig((prev) => ({ ...prev, pushToTalkReleaseDelay: ms }));
  };

  const getPushToTalkReleaseDelaySlider = () => (
    <div className="flex flex-col w-[300px]">
      <Label className="flex items-center">
        {getLocalePhrase(appState.language, Phrase.PushToTalkReleaseDelayLabel)}
        <Tooltip
          content={getLocalePhrase(
            appState.language,
            configSchema.pushToTalkReleaseDelay.description,
          )}
          side="right"
        >
          <Info size={20} className="inline-flex ml-2" />
        </Tooltip>
      </Label>
      <div className="flex h-10 items-center gap-x-2 text-foreground-lighter">
        <Slider
          id="release-delay-slider"
          key={`release-delay-${config.pushToTalkReleaseDelay}`}
          defaultValue={[config.pushToTalkReleaseDelay]}
          value={[localReleaseDelay]}
          onValueChange={(vals) => setLocalReleaseDelay(vals[0])}
          onValueCommit={commitReleaseDelay}
          min={0}
          max={2000}
          step={1}
          withTooltip={false}
          className="w-[80px]"
        />
        <span className="text-sm text-foreground-lighter tabular-nums min-w-[60px] text-right whitespace-nowrap">
          {localReleaseDelay > 999
            ? `${(localReleaseDelay / 1000).toFixed(2)}s`
            : `${localReleaseDelay} ms`}
        </span>
      </div>
    </div>
  );

  const setSourceDevice = (src: AudioSource, device: string) => {
    const idx = config.audioSources.indexOf(src);
    if (idx === -1) return;

    const choice = sourceChoices[src.id].find((item) => item.value === device);
    if (!choice) return;

    setConfig((prev) => ({
      ...prev,
      audioSources: prev.audioSources.map((s) =>
        s.id === src.id ? { ...s, device, friendly: choice.name } : s,
      ),
    }));

    if (src.type === AudioSourceType.PROCESS) {
      ipc.setAudioSourceWindow(src.id, device);
    } else {
      ipc.setAudioSourceDevice(src.id, device);
    }
  };

  const setSourceAudioTracks = (src: AudioSource, values: string[]) => {
    const tracks = values.reduce((mask, value) => mask | Number(value), 0);

    // Keep at least one track assigned to each source.
    if (tracks === 0) return;

    setConfig((prev) => ({
      ...prev,
      audioSources: prev.audioSources.map((source) =>
        source.id === src.id ? { ...source, tracks } : source,
      ),
    }));

    ipc.setAudioSourceTracks(src.id, tracks);
  };

  const renderSourceType = (src: AudioSource) => {
    if (isGameAudioSource(src)) {
      return (
        <Tooltip content={getLocalePhrase(language, Phrase.GameAudioLabel)}>
          <div className="flex justify-center items-center text-foreground-lighter gap-x-1">
            <Gamepad2 />
          </div>
        </Tooltip>
      );
    }

    if (src.type === AudioSourceType.OUTPUT) {
      return (
        <div className="flex justify-center items-center  text-foreground-lighter gap-x-1">
          <Speaker />
        </div>
      );
    }

    if (src.type === AudioSourceType.INPUT) {
      return (
        <div className="flex justify-center items-center text-foreground-lighter gap-x-1">
          <MicVocal />
        </div>
      );
    }

    if (src.type === AudioSourceType.PROCESS) {
      return (
        <div className="flex justify-center items-center text-foreground-lighter gap-x-1">
          <AppWindow />
        </div>
      );
    }
  };

  const renderSourceDeviceSelect = (src: AudioSource) => {
    if (typeof src.device === 'number') {
      // Stupid typeguard. This can't happen.
      return <></>;
    }

    const choices: ObsListItem[] = [];

    if (sourceChoices[src.id]) {
      // Deduplicate on the name field.
      sourceChoices[src.id].forEach((choice) => {
        if (!choices.find((item) => item.name === choice.name)) {
          choices.push(choice);
        }
      });
    }

    const renderSelectItems = () => {
      if (!audioChoicesLoaded.current) {
        return <></>;
      }

      if (typeof src.device === 'number') {
        // Stupid typeguard. This can't happen.
        return <></>;
      }

      const found = choices.find((tt) => tt.value === src.device);

      const items = choices.map((tt) => (
        <SelectItem key={tt.name} value={String(tt.value)}>
          {tt.name}
        </SelectItem>
      ));

      // If we don't find the device currently selected add it so it
      // renders with a warning. Don't do the warning this for process
      // as it's common for the windows to change and we do exe
      // matching anyway.
      if (!found && src.device) {
        let text = src.device;

        if (isGameAudioSource(src)) {
          // The game isn't running so OBS doesn't list its window, but we
          // match on the executable so it will still be captured.
          text = gameAudioFriendlyName;
        } else if (src.type !== AudioSourceType.PROCESS) {
          text = `⚠ ${getLocalePhrase(language, Phrase.UnknownDevice)}: ${
            src.friendly
          }`;
        }

        items.push(
          <SelectItem key="custom" value={src.device}>
            {text}
          </SelectItem>,
        );
      }

      return items;
    };

    return (
      <div className="flex flex-col w-[500px]">
        <Select
          value={src.device}
          onValueChange={(value) => setSourceDevice(src, value)}
          onOpenChange={(open) => setPreviewEnabled(!open)}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                src.type !== AudioSourceType.PROCESS
                  ? getLocalePhrase(language, Phrase.SelectADevice)
                  : getLocalePhrase(language, Phrase.SelectAnApplication)
              }
            />
          </SelectTrigger>
          <SelectContent>{renderSelectItems()}</SelectContent>
        </Select>
      </div>
    );
  };

  const renderSourceTrackSelect = (src: AudioSource) => {
    const tracks = src.tracks ?? defaultAudioTrack;

    const selectedTracks = obsAudioTracks
      .filter((track) => tracks & track)
      .map(String);

    return (
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="default"
        value={selectedTracks}
        onValueChange={(values) => setSourceAudioTracks(src, values)}
      >
        {obsAudioTracks.map((track, index) => (
          <ToggleGroupItem
            key={track}
            value={String(track)}
            className="h-10 w-10 flex-none px-0 tabular-nums"
          >
            {index + 1}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  };

  const removeSource = (src: AudioSource) => {
    const idx = config.audioSources.indexOf(src);
    if (idx === -1) return;

    setConfig((prev) => ({
      ...prev,
      audioSources: prev.audioSources.filter((s) => s.id !== src.id),
    }));

    setSourceChoices((prev) => {
      const clone = { ...prev };
      delete clone[src.id];
      return clone;
    });

    setSourceMagnitude((prev) => {
      const clone = { ...prev };
      delete clone[src.id];
      return clone;
    });

    ipc.deleteAudioSource(src.id);
  };

  const renderDeleteSourceButton = (src: AudioSource) => {
    return (
      <Button onClick={() => removeSource(src)} variant="ghost" size="sm">
        <X color="red" opacity={0.5} />
      </Button>
    );
  };

  const updateSource = (src: AudioSource, changes: Partial<AudioSource>) => {
    setConfig((prev) => ({
      ...prev,
      audioSources: prev.audioSources.map((s) =>
        s.id === src.id ? { ...s, ...changes } : s,
      ),
    }));
  };

  const toggleMute = (src: AudioSource) => {
    const muted = !src.muted;
    // Unmuting a source left at 0% would look like nothing happened.
    const volume = !muted && src.volume === 0 ? 1 : src.volume;
    updateSource(src, { muted, volume });
    ipc.setAudioSourceVolume(src.id, muted ? 0 : volume);
  };

  const setSourceVolume = (src: AudioSource, percent: number) => {
    const volume = percent / 100;
    // Moving the slider unmutes, like most volume mixers.
    updateSource(src, { volume, muted: false });
    ipc.setAudioSourceVolume(src.id, volume);
  };

  const renderSourceVolume = (src: AudioSource) => {
    const val = Math.round(src.volume * 100);
    const muted = Boolean(src.muted);
    let icon;

    if (muted || val === 0) {
      icon = <VolumeX color={muted ? 'red' : undefined} />;
    } else if (val < 50) {
      icon = <Volume1 />;
    } else {
      icon = <Volume2 />;
    }

    const tooltip = getLocalePhrase(
      language,
      muted ? Phrase.UnmuteSourceTooltip : Phrase.MuteSourceTooltip,
    );

    return (
      <div className="flex items-center gap-x-2">
        <Tooltip content={tooltip} side="top">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleMute(src)}
            aria-label={tooltip}
            aria-pressed={muted}
          >
            {icon}
          </Button>
        </Tooltip>
        <Slider
          value={[val]}
          max={100}
          step={1}
          withTooltip={false}
          className={`w-[90px] ${muted ? 'opacity-40' : ''}`}
          onValueChange={(newValue) => setSourceVolume(src, newValue[0])}
        />
        <span className="text-sm text-foreground-lighter tabular-nums w-[40px] text-right">
          {muted ? '-' : `${val}%`}
        </span>
      </div>
    );
  };

  const renderSourceRow = (src: AudioSource) => {
    const magnitude = src.muted ? 0 : sourceMagnitude[src.id] ?? 0;

    return (
      <tr key={src.id}>
        <td className="px-2">{renderSourceType(src)}</td>
        <td className="px-2">{renderSourceDeviceSelect(src)}</td>
        <td className="px-2">{renderSourceTrackSelect(src)}</td>
        <td className="px-2">
          <div className="relative h-[38px] w-[150px]">
            <Progress
              className="h-full w-full rounded-sm"
              value={100 * magnitude}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <AudioLines className="text-foreground-lighter" size={18} />
            </div>
          </div>
        </td>
        <td className="px-2">{renderSourceVolume(src)}</td>
        <td>{renderDeleteSourceButton(src)}</td>
      </tr>
    );
  };

  const addSource = async (type: AudioSourceType, gameAudio = false) => {
    const ids = config.audioSources.map((src) => src.id);
    let idx = 1;

    // Find the next available name.
    while (ids.includes(`XIVRecorder Audio Source ${idx}`)) {
      idx++;
    }

    const id = `XIVRecorder Audio Source ${idx}`;
    const name = await ipc.createAudioSource(id, type);

    let device: string | undefined;
    let friendly: string | undefined;

    if (gameAudio) {
      // Capture only the FFXIV game. This works even if the game is not
      // currently running, as OBS matches on the executable name.
      device = ffxivAudioWindow;
      friendly = gameAudioFriendlyName;
      ipc.setAudioSourceWindow(name, device);
    } else if (type !== AudioSourceType.PROCESS) {
      device = 'default';
      friendly = device;
    }

    const src: AudioSource = {
      id: name, // Careful to not assume we got the name we asked for.
      type,
      friendly,
      device,
      volume: 1,
      tracks: defaultAudioTrack,
    };

    const choices = await getAudioSourceChoices(src);

    setConfig((prev) => ({
      ...prev,
      audioSources: [...prev.audioSources, src],
    }));

    setSourceChoices((prev) => ({
      ...prev,
      [src.id]: choices,
    }));
  };

  const renderSourceTable = () => {
    const header = (phrase: Phrase, tooltip?: Phrase) => (
      <th className="px-2 pb-1 text-left">
        <Label className="flex items-center">
          {getLocalePhrase(language, phrase)}
          {tooltip !== undefined && (
            <Tooltip content={getLocalePhrase(language, tooltip)} side="top">
              <Info size={16} className="inline-flex ml-2" />
            </Tooltip>
          )}
        </Label>
      </th>
    );

    return (
      <table className="table-auto w-max">
        <thead>
          <tr>
            <th />
            {header(Phrase.SourceHeading)}
            {header(Phrase.AudioTracksLabel, Phrase.AudioTracksDescription)}
            <th />
            {header(Phrase.AudioVolumeLabel)}
            <th />
          </tr>
        </thead>
        <tbody>
          {config.audioSources.map(renderSourceRow)}
          <tr>
            <td colSpan={6}></td>
          </tr>
        </tbody>
      </table>
    );
  };

  const haveGameAudioSource = config.audioSources.some(isGameAudioSource);

  const renderHelpText = () => {
    return (
      <div className="flex flex-col text-sm text-foreground-lighter mx-2">
        {getLocalePhrase(language, Phrase.NoAudioSourcesText)}
      </div>
    );
  };

  const getSourcesSection = () => {
    return (
      <div className="flex flex-col gap-y-2">
        {config.audioSources.length > 0 && renderSourceTable()}
        {config.audioSources.length < 1 && renderHelpText()}
        <div className="flex gap-2 mx-2">
          <Tooltip
            content={getLocalePhrase(language, Phrase.GameAudioDescription)}
          >
            <div>
              <Button
                onClick={() => addSource(AudioSourceType.PROCESS, true)}
                disabled={!sourcesAreFullyDefined || haveGameAudioSource}
                variant="outline"
              >
                <PlusIcon className="px-0" />
                {getLocalePhrase(language, Phrase.GameAudioLabel)}
              </Button>
            </div>
          </Tooltip>
          <Button
            onClick={() => addSource(AudioSourceType.OUTPUT)}
            disabled={!sourcesAreFullyDefined}
            variant="outline"
          >
            <PlusIcon className="px-0" />
            {getLocalePhrase(language, Phrase.AddSpeakerButtonText)}
          </Button>
          <Button
            onClick={() => addSource(AudioSourceType.INPUT)}
            disabled={!sourcesAreFullyDefined}
            variant="outline"
          >
            <PlusIcon className="px-0" />
            {getLocalePhrase(language, Phrase.AddMicrophoneButtonText)}
          </Button>
          <Button
            onClick={() => addSource(AudioSourceType.PROCESS)}
            disabled={!sourcesAreFullyDefined}
            variant="outline"
          >
            <PlusIcon className="px-0" />
            {getLocalePhrase(language, Phrase.AddApplicationButtonText)}
          </Button>
        </div>
        <div className="flex flex-col text-sm text-foreground-lighter mx-2 max-w-[900px]">
          {getLocalePhrase(language, Phrase.AudioSourcesHelpText)}
        </div>
      </div>
    );
  };

  const getSettingsSection = () => {
    return (
      <div className="flex gap-y-8 flex-col m-4">
        <div className="flex items-center content-start w-full gap-10 flex-wrap">
          {getAudioSuppressionSwitch()}
          {getMonoSwitch()}
          {getPushToTalkSwitch()}
          {config.pushToTalk && (
            <>
              {getPushToTalkSelect()}
              {getPushToTalkReleaseDelaySlider()}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {getSourcesSection()}
      {getSettingsSection()}
    </div>
  );
};

export default AudioSourceControls;
