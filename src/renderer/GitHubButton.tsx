import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Phrase } from 'localisation/phrases';
import { projectUrl } from 'main/constants';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
}

/**
 * Opens the XIV Recorder project page, for help, bug reports and releases.
 */
export default function GitHubButton(props: IProps) {
  const { appState } = props;

  const openProjectURL = () => {
    ipc.sendMessage('openURL', [projectUrl]);
  };

  return (
    <Tooltip
      content={getLocalePhrase(appState.language, Phrase.GitHubButtonLabel)}
      side="top"
    >
      <Button
        id="github-button"
        type="button"
        onClick={openProjectURL}
        variant="ghost"
        size="icon"
      >
        <FontAwesomeIcon icon={faGithub} size="lg" />
      </Button>
    </Tooltip>
  );
}
