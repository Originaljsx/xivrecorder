import { VideoCategory } from 'types/VideoCategory';
import { useEffect, useRef } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import { AppState, DeathMarkers } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';
import { setConfigValues } from './useSettings';
import {
  convertNumToDeathMarkers,
  convertDeathMarkersToNum,
} from './rendererutils';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import Label from './components/Label/Label';

interface IProps {
  config: ConfigurationSchema;
  setConfig: React.Dispatch<React.SetStateAction<ConfigurationSchema>>;
  category: VideoCategory;
  appState: AppState;
}

const VideoMarkerToggles = (props: IProps) => {
  const initialRender = useRef(true);
  const { config, setConfig, appState } = props;
  const deathMarkers = convertNumToDeathMarkers(config.deathMarkers);

  useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      deathMarkers: config.deathMarkers,
    });
  }, [config.deathMarkers]);

  const setDeaths = (value: DeathMarkers) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        deathMarkers: convertDeathMarkersToNum(value),
      };
    });
  };

  const renderDeathSelection = () => {
    return (
      <div>
        <Label>
          {getLocalePhrase(appState.language, Phrase.ShowDeathsLabel)}
        </Label>
        <ToggleGroup
          type="single"
          value={deathMarkers}
          size="sm"
          onValueChange={setDeaths}
          variant="outline"
          className="border border-background"
        >
          <ToggleGroupItem value={DeathMarkers.ALL}>
            {getLocalePhrase(appState.language, Phrase.All)}
          </ToggleGroupItem>
          <ToggleGroupItem value={DeathMarkers.OWN}>
            {getLocalePhrase(appState.language, Phrase.Own)}
          </ToggleGroupItem>
          <ToggleGroupItem value={DeathMarkers.NONE}>
            {getLocalePhrase(appState.language, Phrase.None)}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-x-2">
      {renderDeathSelection()}
    </div>
  );
};

export default VideoMarkerToggles;
