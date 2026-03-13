// Mock Electron main process module to prevent top-level side effects
jest.mock('../../main/main', () => ({
  send: jest.fn(),
  getNativeWindowHandle: jest.fn(),
  playSoundAlert: jest.fn(),
}));

// Mock ConfigService so we don't need ElectronStore
jest.mock('../../config/ConfigService', () => {
  const mockConfig: Record<string, any> = {
    recordCrystallineConflict: true,
    manualRecord: true,
    obsOutputResolution: '1920x1080',
    bufferStoragePath: '/tmp/buffer',
    storagePath: '/tmp/storage',
  };
  return {
    __esModule: true,
    default: {
      getInstance: () => ({
        get: jest.fn((key: string) => mockConfig[key]),
        getNumber: jest.fn((key: string) => mockConfig[key] ?? 0),
        getString: jest.fn((key: string) => mockConfig[key] ?? ''),
        getPath: jest.fn((key: string) => mockConfig[key] ?? ''),
        set: jest.fn(),
        has: jest.fn().mockReturnValue(true),
        on: jest.fn(),
        emit: jest.fn(),
      }),
    },
  };
});

// Mock Recorder so start/stop don't need OBS
jest.mock('../../main/Recorder', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      startRecording: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      startBuffer: jest.fn(),
      getAndClearLastFile: jest.fn().mockReturnValue(''),
    }),
  },
}));

// Mock Poller
jest.mock('../../utils/Poller', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      isFFXIVRunning: jest.fn().mockReturnValue(false),
    }),
  },
}));

// Mock VideoProcessQueue
jest.mock('../../main/VideoProcessQueue', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      queueVideo: jest.fn(),
    }),
  },
}));

// Mock emitErrorReport from util
jest.mock('../../main/util', () => ({
  emitErrorReport: jest.fn(),
  checkDisk: jest.fn(),
  exists: jest.fn(),
  isFolderOwned: jest.fn(),
  takeOwnershipBufferDir: jest.fn(),
  takeOwnershipStorageDir: jest.fn(),
}));

import FFXIVLogHandler from '../../parsing/FFXIVLogHandler';
import LogHandler from '../../parsing/LogHandler';
import CCMatch from '../../activitys/CCMatch';

describe('FFXIVLogHandler', () => {
  let handler: FFXIVLogHandler;
  const events: { name: string; data?: any }[] = [];

  beforeEach(() => {
    jest.useFakeTimers();

    // Reset static state between tests.
    LogHandler.activity = undefined;
    LogHandler.overrunning = false;
    LogHandler.setStateChangeCallback(() => {});
    events.length = 0;

    // Create handler with a dummy directory (we'll feed lines directly).
    handler = new FFXIVLogHandler('C:\\dummy');

    handler.on('cc-zone-enter', (d) => events.push({ name: 'cc-zone-enter', data: d }));
    handler.on('start-buffer', () => events.push({ name: 'start-buffer' }));
    handler.on('activity-start', (d) => events.push({ name: 'activity-start', data: d }));
    handler.on('activity-end', (d) => events.push({ name: 'activity-end', data: d }));
    handler.on('force-end', () => events.push({ name: 'force-end' }));
    handler.on('preparation', (d) => events.push({ name: 'preparation', data: d }));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  function feed(line: string) {
    handler.feedLine(line);
  }

  describe('ChangePrimaryPlayer handling', () => {
    it('stores the player entity ID', () => {
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');
      // The handler stores it internally — verify by starting a match.
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');
      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');

      expect(LogHandler.activity).toBeDefined();
      expect(LogHandler.activity!.playerEntityId).toBe('1032524C');
    });
  });

  describe('CC match lifecycle', () => {
    it('detects CC zone entry', () => {
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');

      const enterEvent = events.find((e) => e.name === 'cc-zone-enter');
      expect(enterEvent).toBeDefined();
      expect(enterEvent!.data.zoneId).toBe(0x40a); // 1034
      expect(enterEvent!.data.zoneName).toBe('Cloud Nine');
    });

    it('emits start-buffer when entering CC zone', () => {
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');

      expect(events.some((e) => e.name === 'start-buffer')).toBe(true);
    });

    it('starts match on ActorControl COMMENCE', () => {
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');
      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');

      // LogHandler.activity is set synchronously inside startActivity,
      // before the async recorder call.
      expect(LogHandler.activity).toBeDefined();
      expect(LogHandler.activity).toBeInstanceOf(CCMatch);
    });

    it('ends match on ActorControl MATCH_END', () => {
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');
      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000002|12|00|00|00|hash');
      // MATCH_END defers via setTimeout(0) to wait for TEAM_RESULT
      jest.runAllTimers();

      expect(events.some((e) => e.name === 'activity-end')).toBe(true);
    });

    it('force ends match on zone change away from CC', () => {
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');
      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');
      // Zone away without MATCH_END first
      feed('01|2026-03-06T10:35:01.5600000-08:00|84|New Gridania|hash');

      expect(events.some((e) => e.name === 'force-end')).toBe(true);
      expect(LogHandler.activity).toBeUndefined();
    });

    it('emits preparation event', () => {
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');
      feed('33|2026-03-06T10:31:54.7970000-08:00|80039C5D|40000004|1E|00|00|00|hash');

      const prepEvent = events.find((e) => e.name === 'preparation');
      expect(prepEvent).toBeDefined();
      expect(prepEvent!.data).toBe(0x1e); // 30 seconds
    });
  });

  describe('combatant tracking', () => {
    it('collects player combatants during CC zone', () => {
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');

      // Add player combatants
      feed('03|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|1E|52|0000|2E|Fenrir|0|0|60000|60000|10000|10000|||92.33|-88.18|12.00|-0.00|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|10075825|Amimi Ami|22|3A|0000|3B|Ifrit|0|0|61500|61500|10000|10000|||-87.67|91.82|12.00|-3.14|hash');

      // NPC combatant — should be ignored
      feed('03|2026-03-06T10:31:51.9220000-08:00|40000724|Tactical Crystal|00|1|0000|00||11350|14470|100|100|100|10000|||0.00|0.00|1.00|-0.00|hash');

      // Start match
      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');

      const match = LogHandler.activity as CCMatch;
      expect(match).toBeDefined();

      // Should have the 2 player combatants, not the NPC
      expect(match.combatantMap.size).toBe(2);

      const player = match.getCombatant('1032524C');
      expect(player).toBeDefined();
      expect(player!.name).toBe('Hinanawi Tenshi');
      expect(player!.jobId).toBe(0x1e); // NIN
      expect(player!.teamId).toBe(1); // Astra (positive X)
      expect(player!.worldName).toBe('Fenrir');

      const enemy = match.getCombatant('10075825');
      expect(enemy).toBeDefined();
      expect(enemy!.name).toBe('Amimi Ami');
      expect(enemy!.teamId).toBe(2); // Umbra (negative X)
    });
  });

  describe('match result detection', () => {
    it('detects win via TEAM_RESULT (Astra player, team 0 wins)', () => {
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');

      // Player on Astra (positive X)
      feed('03|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|1E|52|0000|2E|Fenrir|0|0|60000|60000|10000|10000|||92.33|-88.18|12.00|-0.00|hash');

      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');

      // MATCH_END followed by TEAM_RESULT (winning team = 0 = Astra)
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000002|12|00|00|00|hash');
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000007|00|00|00|00|hash');
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000007|01|00|00|00|hash');

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(true); // Win
    });

    it('detects loss via TEAM_RESULT (Astra player, team 1 wins)', () => {
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');

      // Player on Astra (positive X)
      feed('03|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|1E|52|0000|2E|Fenrir|0|0|60000|60000|10000|10000|||92.33|-88.18|12.00|-0.00|hash');

      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');

      // MATCH_END followed by TEAM_RESULT (winning team = 1 = Umbra)
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000002|12|00|00|00|hash');
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000007|01|00|00|00|hash');
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000007|00|00|00|00|hash');

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(false); // Loss
    });

    it('falls back to crystal position when TEAM_RESULT not available (win)', () => {
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');

      // Player on Astra (positive X)
      feed('03|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|1E|52|0000|2E|Fenrir|0|0|60000|60000|10000|10000|||92.33|-88.18|12.00|-0.00|hash');
      // Tactical Crystal
      feed('03|2026-03-06T10:31:51.9220000-08:00|40000C79|Tactical Crystal|00|1|0000|00||11350|14470|100|100|100|10000|||0.00|0.00|1.00|-0.00|hash');

      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');

      // Crystal pushed to negative X (Umbra side) = Astra wins
      feed('270|2026-03-06T10:34:50.0000000-08:00|40000C79|-1.5709|0000|001E|-80.0641|29.9839|4.0436|hash');

      // MATCH_END without TEAM_RESULT — needs timer flush
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000002|12|00|00|00|hash');
      jest.runAllTimers();

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(true); // Win via crystal fallback
    });

    it('falls back to crystal position when TEAM_RESULT not available (loss)', () => {
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');

      feed('03|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|1E|52|0000|2E|Fenrir|0|0|60000|60000|10000|10000|||92.33|-88.18|12.00|-0.00|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|40000C79|Tactical Crystal|00|1|0000|00||11350|14470|100|100|100|10000|||0.00|0.00|1.00|-0.00|hash');

      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');

      // Crystal pushed to positive X (Astra side) = Umbra wins
      feed('270|2026-03-06T10:34:50.0000000-08:00|40000C79|-1.5709|0000|001E|75.1234|29.9839|4.0436|hash');

      // MATCH_END without TEAM_RESULT — needs timer flush
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000002|12|00|00|00|hash');
      jest.runAllTimers();

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(false); // Loss via crystal fallback
    });
  });

  describe('full CC match from real log data', () => {
    it('processes a complete CC match lifecycle', () => {
      // Simulate the real match from the user's log
      feed('02|2026-03-06T10:30:15.2040000-08:00|1032524C|Hinanawi Tenshi|hash');
      feed('01|2026-03-06T10:30:15.2040000-08:00|84|New Gridania|hash');

      // First zone into CC (loading screen)
      feed('01|2026-03-06T10:31:21.0060000-08:00|40A|Cloud Nine|hash');
      expect(events.some((e) => e.name === 'cc-zone-enter')).toBe(true);

      // Second zone into CC (actual arena load)
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');
      feed('02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|hash');

      // Add all 10 players
      feed('03|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|1E|52|0000|2E|Fenrir|0|0|60000|60000|10000|10000|||92.33|-88.18|12.00|-0.00|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|103199CA|Astro Phyllite|23|3A|0000|1E|Unicorn|0|0|58500|58500|10000|10000|||89.15|-88.81|12.00|-0.00|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|1035B305|Shania Jackson|18|5A|0000|2D|Carbuncle|0|0|55500|55500|10000|10000|||89.35|-86.88|12.00|-0.00|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|10315A70|Ahiru Pal|22|64|0000|1F|Yojimbo|0|0|61500|61500|10000|10000|||88.34|-90.48|12.00|-0.00|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|100E5E50|Kai Sumeragi|19|64|0000|1D|Shinryu|0|0|52500|52500|10000|10000|||86.06|-92.22|12.00|-0.00|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|10075825|Amimi Ami|22|3A|0000|3B|Ifrit|0|0|61500|61500|10000|10000|||-87.67|91.82|12.00|-3.14|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|100F8629|Clavellina Hart|15|64|0000|3A|Garuda|0|0|66000|66000|10000|10000|||-90.85|91.18|12.00|-3.14|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|1033B03E|Maca Llam|1F|64|0000|20|Zeromus|0|0|58500|58500|10000|10000|||-90.65|93.12|12.00|-3.14|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|102DC29B|Ryu Rock|29|64|0000|3C|Ramuh|0|0|61500|61500|10000|10000|||-94.80|89.22|11.98|3.14|hash');
      feed('03|2026-03-06T10:31:51.9220000-08:00|1006AE64|Sui Ca|19|64|0000|2C|Anima|0|0|52500|52500|10000|10000|||-91.66|89.52|12.00|-3.14|hash');

      // Preparation countdown (30 sec)
      feed('33|2026-03-06T10:31:54.7970000-08:00|80039C5D|40000004|1E|00|00|00|hash');

      // Match start
      feed('33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|hash');

      const match = LogHandler.activity as CCMatch;
      expect(match).toBeDefined();
      expect(match.combatantMap.size).toBe(10);
      expect(match.playerEntityId).toBe('1032524C');

      // Verify teams
      const astraPlayers = Array.from(match.combatantMap.values()).filter(
        (c) => c.teamId === 1,
      );
      const umbraPlayers = Array.from(match.combatantMap.values()).filter(
        (c) => c.teamId === 2,
      );
      expect(astraPlayers.length).toBe(5);
      expect(umbraPlayers.length).toBe(5);

      // Crystal position tracking
      feed('03|2026-03-06T10:31:51.9220000-08:00|40000724|Tactical Crystal|00|1|0000|00||11350|14470|100|100|100|10000|||0.00|0.00|1.00|-0.00|hash');
      feed('270|2026-03-06T10:34:50.0000000-08:00|40000724|-1.5709|0000|001E|-80.0641|29.9839|4.0436|hash');

      // Match end + TEAM_RESULT (Astra = team 0 wins)
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000002|12|00|00|00|hash');
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000007|00|00|00|00|hash');
      feed('33|2026-03-06T10:34:51.5080000-08:00|80039C5D|40000007|01|00|00|00|hash');

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();

      // Verify the match metadata
      const activity = endEvent!.data;
      expect(activity.getMetadata().zoneName).toBe('Cloud Nine');
      expect(activity.getMetadata().combatants.length).toBe(10);
      expect(activity.getMetadata().result).toBe(true); // Astra player won
    });
  });
});
