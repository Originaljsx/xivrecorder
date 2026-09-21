jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/tmp'), isPackaged: false },
}));
jest.mock('../../config/ConfigService', () => ({
  __esModule: true,
  default: { getInstance: () => ({ get: jest.fn() }) },
}));
jest.mock('../../storage/DiskClient', () => ({
  __esModule: true,
  default: { getInstance: () => ({ refreshVideos: jest.fn() }) },
}));
jest.mock('../../main/util', () => ({
  getAssetPath: jest.fn(),
  getMetadataForVideo: jest.fn(),
  getSortedVideos: jest.fn(),
  writeMetadataFile: jest.fn(),
}));

import PvpStatsLink, { MATCH_WINDOW_MS } from '../../main/PvpStatsLink';
import { Metadata, PvpStatsMatch } from '../../main/types';
import { VideoCategory } from '../../types/VideoCategory';

const start = Date.parse('2026-09-19T14:34:36.140Z');

const match: PvpStatsMatch = {
  id: 'abc',
  dutyStart: start - 65_000,
  matchStart: start + 1_500,
  matchEnd: start + 439_000,
  arena: 'RedSands',
  matchType: 'Custom',
  territoryId: 1139,
  winner: 'Astra',
  localPlayer: 'Original Dsi Alexander',
  localTeam: 'Umbra',
  teams: {
    Astra: {
      progress: 73.1,
      players: [{ name: 'Enemy One', world: 'Belias', job: 'PLD', jobId: 19, team: 'Astra', kills: 2 }],
    },
    Umbra: {
      progress: 45.8,
      players: [{ name: 'Original Dsi', world: 'Alexander', job: 'SCH', jobId: 28, team: 'Umbra', deaths: 3 }],
    },
  },
};

const metadata: Metadata = {
  category: VideoCategory.CrystallineConflict,
  duration: 441,
  date: start,
  result: true,
  resultSource: 'crystal',
  zoneID: 1139,
  zoneName: 'The Red Sands',
  overrun: 6,
  player: { _entityId: '1007F267', _name: 'Original Dsi', _teamId: 1 },
  combatants: [
    { _entityId: '1007F267', _name: 'Original Dsi', _teamId: 1 },
    { _entityId: '10000001', _name: 'Enemy One', _teamId: 2 },
    { _entityId: '10000002', _name: 'Stranger', _teamId: 2 },
  ],
};

describe('PvpStatsLink.correlate', () => {
  it('matches by start time within the window and same territory', () => {
    expect(PvpStatsLink.correlate(metadata, [match])).toBe(match);
  });

  it('rejects a match in a different territory', () => {
    const other = { ...match, territoryId: 1032 };
    expect(PvpStatsLink.correlate(metadata, [other])).toBeUndefined();
  });

  it('rejects a match too far away in time', () => {
    const late = { ...match, matchStart: start + MATCH_WINDOW_MS + 1 };
    expect(PvpStatsLink.correlate(metadata, [late])).toBeUndefined();
  });

  it('prefers the closest match', () => {
    const earlier = { ...match, id: 'earlier', matchStart: start - 60_000 };
    expect(PvpStatsLink.correlate(metadata, [earlier, match])).toBe(match);
  });

  it('returns undefined without a start time', () => {
    const noStart = { ...metadata, date: undefined, start: undefined };
    expect(PvpStatsLink.correlate(noStart, [match])).toBeUndefined();
  });
});

describe('PvpStatsLink.apply', () => {
  it('sets the authoritative result and scoreboard', () => {
    const out = PvpStatsLink.apply(metadata, match);
    expect(out.pvpStats).toBe(match);
    expect(out.result).toBe(false); // Umbra local, Astra won
    expect(out.resultSource).toBe('pvpstats');
    expect(out.localTeam).toBe('Umbra');
    expect(out.winner).toBe('Astra');
  });

  it('relabels combatants with real team IDs (Astra=1, Umbra=2)', () => {
    const out = PvpStatsLink.apply(metadata, match);
    expect(out.player?._teamId).toBe(2);
    expect(out.combatants.find((c) => c._name === 'Enemy One')?._teamId).toBe(1);
    // Unknown names keep their relative label.
    expect(out.combatants.find((c) => c._name === 'Stranger')?._teamId).toBe(2);
  });

  it('leaves the result alone when the winner is unknown', () => {
    const draw = { ...match, winner: 'Unknown' as const };
    const out = PvpStatsLink.apply(metadata, draw);
    expect(out.result).toBe(true);
    expect(out.resultSource).toBe('crystal');
    expect(out.pvpStats).toBe(draw);
  });

  it('does not mutate the input', () => {
    const copy = JSON.parse(JSON.stringify(metadata));
    PvpStatsLink.apply(metadata, match);
    expect(metadata).toEqual(copy);
  });
});
