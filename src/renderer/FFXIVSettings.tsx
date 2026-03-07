import { configSchema, ConfigurationSchema } from 'config/configSchema';
import React, { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValues } from './useSettings';
import { pathSelect } from './rendererutils';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Input } from './components/Input/Input';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Info } from 'lucide-react';
import { Phrase } from 'localisation/phrases';

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const ipc = window.electron.ipcRenderer;

const FFXIVSettings = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const initialRender = useRef(true);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      iinactLogPath: config.iinactLogPath,
      recordCrystallineConflict: config.recordCrystallineConflict,
    });

    ipc.reconfigureBase();
  }, [config.iinactLogPath, config.recordCrystallineConflict]);

  const setIINACTLogPath = async () => {
    const newPath = await pathSelect();

    if (newPath === '') {
      return;
    }

    setConfig((prev) => ({
      ...prev,
      iinactLogPath: newPath,
    }));
  };

  const setRecordCC = (checked: boolean) => {
    setConfig((prev) => ({
      ...prev,
      recordCrystallineConflict: checked,
    }));
  };

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col w-[500px]">
        <Label htmlFor="iinactLogPath" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.RetailLogPathLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              Phrase.RetailLogPathDescription,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="iinactLogPath"
          value={config.iinactLogPath}
          onClick={setIINACTLogPath}
          required
          readOnly
        />
        {config.iinactLogPath === '' && (
          <span className="text-error text-sm">
            {getLocalePhrase(
              appState.language,
              Phrase.InvalidRetailLogPathText,
            )}
          </span>
        )}
      </div>

      <div className="flex flex-col w-[200px]">
        <Label
          htmlFor="recordCrystallineConflict"
          className="flex items-center"
        >
          {getLocalePhrase(appState.language, Phrase.RecordRetailLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              Phrase.RecordRetailDescription,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={Boolean(config.recordCrystallineConflict)}
            name="recordCrystallineConflict"
            onCheckedChange={setRecordCC}
          />
        </div>
      </div>
    </div>
  );
};

export default FFXIVSettings;
