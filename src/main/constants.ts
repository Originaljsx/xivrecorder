/**
 * FFXIV constants for xiv-recorder.
 */

/**
 * Crystalline Conflict territory IDs.
 * From PvpStats MatchHelper.cs:
 * https://github.com/wrath16/PvpStats/blob/master/PvpStats/Helpers/MatchHelper.cs
 */
export const ccTerritories: Record<number, string> = {
  // Ranked / Casual
  1032: 'The Palaistra',
  1033: 'The Volcanic Heart',
  1034: 'Cloud Nine',
  1116: 'Clockwork Castletown',
  1138: 'The Red Sands',
  1293: 'Bayside Battleground',
  // Custom
  1058: 'The Palaistra',
  1059: 'The Volcanic Heart',
  1060: 'Cloud Nine',
  1117: 'Clockwork Castletown',
  1139: 'The Red Sands',
  1294: 'Bayside Battleground',
};

/** Set of all CC territory IDs for fast lookup. */
export const ccTerritoryIds = new Set(
  Object.keys(ccTerritories).map(Number),
);

/** Set of ranked/casual CC territory IDs (not custom). */
export const ccRankedCasualIds = new Set([1032, 1033, 1034, 1116, 1138, 1293]);

/** Set of custom CC territory IDs. */
export const ccCustomIds = new Set([1058, 1059, 1060, 1117, 1139, 1294]);

/**
 * ActorControl command IDs relevant to PvP.
 */
export const ActorControlType = {
  /** Match preparation countdown (30 sec before start). Data = seconds. */
  PREPARATION: 0x40000004,
  /** Match commence / start. Data = timer in seconds (e.g. 300 for 5 min). */
  COMMENCE: 0x40000001,
  /** Match end. */
  MATCH_END: 0x40000002,
  /** Team result (appears twice, once per team). */
  TEAM_RESULT: 0x40000007,
  /** Post-match. */
  POST_MATCH: 0x80000022,
  /** Victory — boss killed (standard raids/trials). */
  VICTORY: 0x40000003,
  /** Fade out — wipe detected. */
  FADE_OUT: 0x40000005,
  /** Recommence — restart after wipe. */
  RECOMMENCE: 0x40000006,
} as const;

/**
 * FFXIV job database.
 * ID (decimal) -> { abbreviation, name, role }
 */
export const ffxivJobs: Record<
  number,
  { abbreviation: string; name: string; role: 'tank' | 'healer' | 'dps' }
> = {
  // Tanks
  0x13: { abbreviation: 'PLD', name: 'Paladin', role: 'tank' },
  0x15: { abbreviation: 'WAR', name: 'Warrior', role: 'tank' },
  0x20: { abbreviation: 'DRK', name: 'Dark Knight', role: 'tank' },
  0x25: { abbreviation: 'GNB', name: 'Gunbreaker', role: 'tank' },

  // Healers
  0x18: { abbreviation: 'WHM', name: 'White Mage', role: 'healer' },
  0x1c: { abbreviation: 'SCH', name: 'Scholar', role: 'healer' },
  0x23: { abbreviation: 'AST', name: 'Astrologian', role: 'healer' },
  0x28: { abbreviation: 'SGE', name: 'Sage', role: 'healer' },

  // Melee DPS
  0x14: { abbreviation: 'MNK', name: 'Monk', role: 'dps' },
  0x16: { abbreviation: 'DRG', name: 'Dragoon', role: 'dps' },
  0x1e: { abbreviation: 'NIN', name: 'Ninja', role: 'dps' },
  0x22: { abbreviation: 'SAM', name: 'Samurai', role: 'dps' },
  0x27: { abbreviation: 'RPR', name: 'Reaper', role: 'dps' },
  0x29: { abbreviation: 'VPR', name: 'Viper', role: 'dps' },

  // Physical Ranged DPS
  0x17: { abbreviation: 'BRD', name: 'Bard', role: 'dps' },
  0x1f: { abbreviation: 'MCH', name: 'Machinist', role: 'dps' },
  0x26: { abbreviation: 'DNC', name: 'Dancer', role: 'dps' },

  // Magical Ranged DPS
  0x19: { abbreviation: 'BLM', name: 'Black Mage', role: 'dps' },
  0x1b: { abbreviation: 'SMN', name: 'Summoner', role: 'dps' },
  0x1d: { abbreviation: 'RDM', name: 'Red Mage', role: 'dps' },
  0x2a: { abbreviation: 'PCT', name: 'Pictomancer', role: 'dps' },

  // Blue Mage (limited job, unlikely in CC but included for completeness)
  0x24: { abbreviation: 'BLU', name: 'Blue Mage', role: 'dps' },
};

/**
 * OBS resolution options. Reused from wow-recorder as-is since
 * these are not game-specific.
 */
export const obsResolutions = [
  '1024x768',
  '1152x864',
  '1176x664',
  '1280x720',
  '1280x768',
  '1280x800',
  '1280x960',
  '1280x1024',
  '1360x768',
  '1366x768',
  '1440x900',
  '1440x1080',
  '1600x900',
  '1600x1024',
  '1600x1200',
  '1680x1050',
  '1768x992',
  '1920x1080',
  '1920x1200',
  '2560x1080',
  '2560x1440',
  '2560x1600',
  '3440x1440',
  '3840x1080',
  '3840x1600',
  '3840x2160',
];

/**
 * Default IINACT log directory path.
 */
export const defaultIINACTLogPath = () => {
  const home =
    process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Default';
  return `${home}\\Documents\\IINACT`;
};
