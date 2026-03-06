/**
 * English translation strings for xiv-recorder.
 */
import { Phrase } from './phrases';

export type Translations = Partial<Record<Phrase, string>>;

export const ENGLISH: Translations = {
  // Navigation
  [Phrase.CrystallineConflict]: 'Crystalline Conflict',
  [Phrase.Manual]: 'Manual',
  [Phrase.Clips]: 'Clips',
  [Phrase.Settings]: 'Settings',
  [Phrase.SceneEditor]: 'Scene Editor',

  // Status
  [Phrase.WaitingForFFXIV]: 'Waiting for FFXIV',
  [Phrase.ReadyToRecord]: 'Ready to Record',
  [Phrase.Recording]: 'Recording',
  [Phrase.InvalidConfig]: 'Invalid Configuration',
  [Phrase.FatalError]: 'Fatal Error',
  [Phrase.Overrunning]: 'Finishing Recording...',
  [Phrase.SavingVideo]: 'Saving Video...',
  [Phrase.MicListening]: 'Microphone Active',
  [Phrase.MicMuted]: 'Microphone Muted',
  [Phrase.MicNone]: 'No Microphone',

  // Settings: Sections
  [Phrase.SettingsGeneral]: 'General',
  [Phrase.SettingsApplication]: 'Application',
  [Phrase.SettingsGame]: 'Game',
  [Phrase.SettingsAdvanced]: 'Advanced',

  // Settings: Fields
  [Phrase.StoragePath]: 'Storage Path',
  [Phrase.StoragePathDescription]:
    'The directory where recordings will be saved.',
  [Phrase.BufferStoragePath]: 'Buffer Storage Path',
  [Phrase.BufferStoragePathDescription]:
    'Optional separate path for the recording buffer. Useful if you want the buffer on a faster drive.',
  [Phrase.SeparateBufferPath]: 'Use Separate Buffer Path',
  [Phrase.SeparateBufferPathDescription]:
    'Enable to use a separate path for the recording buffer.',

  [Phrase.IINACTLogPath]: 'IINACT Log Path',
  [Phrase.IINACTLogPathDescription]:
    'Path to the IINACT network log directory. Default: Documents\\IINACT. Make sure IINACT log filter is set to "party".',

  [Phrase.RecordCrystallineConflict]: 'Record Crystalline Conflict',
  [Phrase.RecordCrystallineConflictDescription]:
    'Automatically record Crystalline Conflict PvP matches.',

  [Phrase.Resolution]: 'Output Resolution',
  [Phrase.ResolutionDescription]: 'The resolution of the recorded video.',
  [Phrase.FPS]: 'FPS',
  [Phrase.FPSDescription]: 'Frames per second for the recording.',
  [Phrase.Quality]: 'Quality',
  [Phrase.QualityDescription]:
    'Recording quality (CRF value). Lower = higher quality, larger files.',
  [Phrase.Encoder]: 'Encoder',
  [Phrase.EncoderDescription]:
    'Video encoder to use. Hardware encoding is faster but may produce larger files.',
  [Phrase.EncoderHardware]: 'Hardware (GPU)',
  [Phrase.EncoderSoftware]: 'Software (CPU)',

  [Phrase.Language]: 'Language',
  [Phrase.LanguageDescription]: 'Application display language.',
  [Phrase.HideEmptyCategories]: 'Hide Empty Categories',
  [Phrase.HideEmptyCategoriesDescription]:
    'Hide categories with no recordings from the side menu.',

  [Phrase.BufferSeconds]: 'Buffer Duration (seconds)',
  [Phrase.BufferSecondsDescription]:
    'How many seconds of video to keep in the buffer before a match starts.',

  [Phrase.ManualRecord]: 'Manual Recording',
  [Phrase.ManualRecordDescription]:
    'Enable manual recording with a hotkey.',

  [Phrase.StartMinimized]: 'Start Minimized',
  [Phrase.StartMinimizedDescription]:
    'Start the application minimized to the system tray.',
  [Phrase.MinimizeOnQuit]: 'Minimize on Close',
  [Phrase.MinimizeOnQuitDescription]:
    'Minimize to tray instead of quitting when closing the window.',
  [Phrase.MinimizeToTray]: 'Minimize to Tray',
  [Phrase.MinimizeToTrayDescription]:
    'Minimize to the system tray instead of the taskbar.',

  // Activity
  [Phrase.NoVideosFound]: 'No videos found',
  [Phrase.Duration]: 'Duration',
  [Phrase.Date]: 'Date',
  [Phrase.Arena]: 'Arena',
  [Phrase.Result]: 'Result',
  [Phrase.Win]: 'Win',
  [Phrase.Loss]: 'Loss',
  [Phrase.Unknown]: 'Unknown',
  [Phrase.Deaths]: 'Deaths',
  [Phrase.Combatants]: 'Combatants',

  // Actions
  [Phrase.Delete]: 'Delete',
  [Phrase.DeleteConfirm]: 'Are you sure you want to delete this recording?',
  [Phrase.Cancel]: 'Cancel',
  [Phrase.Save]: 'Save',
  [Phrase.Browse]: 'Browse',
  [Phrase.Test]: 'Test',
  [Phrase.Logs]: 'Logs',
};
