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
    recordRaids: true,
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
import RaidEncounter from '../../activitys/RaidEncounter';

describe('FFXIVLogHandler — Raid Pull Detection', () => {
  let handler: FFXIVLogHandler;
  const events: { name: string; data?: any }[] = [];

  beforeEach(() => {
    jest.useFakeTimers();

    // Reset static state between tests.
    LogHandler.activity = undefined;
    LogHandler.overrunning = false;
    LogHandler.setStateChangeCallback(() => {});
    events.length = 0;

    handler = new FFXIVLogHandler('C:\\dummy');

    handler.on('activity-start', (d) =>
      events.push({ name: 'activity-start', data: d }),
    );
    handler.on('activity-end', (d) =>
      events.push({ name: 'activity-end', data: d }),
    );
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  function feed(line: string) {
    handler.feedLine(line);
  }

  /** Set up player + zone + COMMENCE for a raid duty instance. */
  function enterDutyInstance() {
    feed(
      '02|2026-03-10T20:34:34.2140000+00:00|107C5CF7|Crow Xo|hash',
    );
    feed(
      '01|2026-03-10T20:34:48.2780000+00:00|2B7|Deltascape V1.0 (Savage)|hash',
    );
    feed(
      '33|2026-03-10T20:34:59.7240000+00:00|80037565|40000001|1518|00|00|00|hash',
    );
  }

  describe('basic pull lifecycle', () => {
    it('starts a raid pull on InCombat 0→1 in duty instance', () => {
      enterDutyInstance();

      // InCombat: inGameCombat = 1
      feed(
        '260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash',
      );

      expect(LogHandler.activity).toBeDefined();
      expect(LogHandler.activity).toBeInstanceOf(RaidEncounter);
    });

    it('ends a raid pull on InCombat 1→0', () => {
      enterDutyInstance();

      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');
      expect(LogHandler.activity).toBeDefined();

      feed('260|2026-03-10T20:35:31.2540000+00:00|1|0|0|1|hash');

      expect(events.some((e) => e.name === 'activity-end')).toBe(true);
    });

    it('sets zone name and ID on the encounter', () => {
      enterDutyInstance();
      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');

      const encounter = LogHandler.activity as RaidEncounter;
      expect(encounter.zoneName).toBe('Deltascape V1.0 (Savage)');
      expect(encounter.zoneID).toBe(0x2b7);
    });

    it('sets player entity ID on the encounter', () => {
      enterDutyInstance();
      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');

      const encounter = LogHandler.activity as RaidEncounter;
      expect(encounter.playerEntityId).toBe('107C5CF7');
    });
  });

  describe('pull counting', () => {
    it('increments pull count across multiple pulls', () => {
      enterDutyInstance();

      // Pull 1
      feed('260|2026-03-10T20:35:01.0000000+00:00|1|1|0|1|hash');
      expect((LogHandler.activity as RaidEncounter).pullNumber).toBe(1);
      feed('260|2026-03-10T20:35:31.0000000+00:00|1|0|0|1|hash');

      // Pull 2
      feed('260|2026-03-10T20:36:01.0000000+00:00|1|1|0|1|hash');
      expect((LogHandler.activity as RaidEncounter).pullNumber).toBe(2);
      feed('260|2026-03-10T20:36:31.0000000+00:00|1|0|0|1|hash');

      // Pull 3
      feed('260|2026-03-10T20:37:01.0000000+00:00|1|1|0|1|hash');
      expect((LogHandler.activity as RaidEncounter).pullNumber).toBe(3);
    });
  });

  describe('result detection', () => {
    it('detects wipe via FADE_OUT before InCombat drops', () => {
      enterDutyInstance();

      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');

      // FADE_OUT (wipe)
      feed(
        '33|2026-03-10T20:35:31.5580000+00:00|80037565|40000005|00|00|00|00|hash',
      );

      // Combat ends
      feed('260|2026-03-10T20:35:31.2540000+00:00|1|0|0|1|hash');

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(false); // Wipe
    });

    it('detects kill via VICTORY before InCombat drops', () => {
      enterDutyInstance();

      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');

      // VICTORY (boss killed)
      feed(
        '33|2026-03-10T20:35:31.5580000+00:00|80037565|40000003|00|00|00|00|hash',
      );

      // Combat ends
      feed('260|2026-03-10T20:35:31.2540000+00:00|1|0|0|1|hash');

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(true); // Kill
    });

    it('defaults to wipe when no VICTORY or FADE_OUT received', () => {
      enterDutyInstance();

      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');
      feed('260|2026-03-10T20:35:31.2540000+00:00|1|0|0|1|hash');

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(false); // Default wipe
    });
  });

  describe('InCombat ignored outside duty instance', () => {
    it('ignores InCombat when not in duty instance', () => {
      feed(
        '02|2026-03-10T20:34:34.2140000+00:00|107C5CF7|Crow Xo|hash',
      );
      feed(
        '01|2026-03-10T20:34:48.2780000+00:00|2B7|Deltascape V1.0 (Savage)|hash',
      );
      // No COMMENCE — not in duty instance yet

      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');

      expect(LogHandler.activity).toBeUndefined();
    });

    it('ignores InCombat in CC zone', () => {
      feed(
        '02|2026-03-10T20:34:34.2140000+00:00|107C5CF7|Crow Xo|hash',
      );
      // Enter CC zone
      feed('01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|hash');

      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');

      expect(LogHandler.activity).toBeUndefined();
    });
  });

  describe('zone change force-ends active pull', () => {
    it('force-ends raid pull on zone change', () => {
      enterDutyInstance();

      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');
      expect(LogHandler.activity).toBeDefined();

      // Zone change away
      feed(
        '01|2026-03-10T20:36:00.0000000+00:00|281|Shirogane|hash',
      );

      expect(LogHandler.activity).toBeUndefined();
    });
  });

  describe('death tracking during raids', () => {
    it('tracks player deaths during a raid pull', () => {
      enterDutyInstance();

      feed('260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|hash');

      // Player death
      feed(
        '25|2026-03-10T20:35:20.0000000+00:00|107C5CF7|Crow Xo|40000001|Alte Roite|hash',
      );

      // End the pull so we can inspect metadata
      feed('260|2026-03-10T20:35:31.2540000+00:00|1|0|0|1|hash');

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      const metadata = endEvent!.data.getMetadata();
      expect(metadata.deaths).toBeDefined();
      expect(metadata.deaths!.length).toBe(1);
      expect(metadata.deaths![0].name).toBe('Crow Xo');
      expect(metadata.deaths![0].killerName).toBe('Alte Roite');
    });
  });

  describe('RECOMMENCE resets result for next pull', () => {
    it('resets raidResult after RECOMMENCE', () => {
      enterDutyInstance();

      // Pull 1 with FADE_OUT
      feed('260|2026-03-10T20:35:01.0000000+00:00|1|1|0|1|hash');
      feed(
        '33|2026-03-10T20:35:31.5580000+00:00|80037565|40000005|00|00|00|00|hash',
      );
      feed('260|2026-03-10T20:35:31.0000000+00:00|1|0|0|1|hash');

      // RECOMMENCE
      feed(
        '33|2026-03-10T20:35:41.7860000+00:00|80037565|40000006|14F9|14|00|00|hash',
      );

      // Pull 2 — should default to wipe (no VICTORY/FADE_OUT yet)
      feed('260|2026-03-10T20:36:01.0000000+00:00|1|1|0|1|hash');

      // Then VICTORY
      feed(
        '33|2026-03-10T20:36:31.5580000+00:00|80037565|40000003|00|00|00|00|hash',
      );
      feed('260|2026-03-10T20:36:31.0000000+00:00|1|0|0|1|hash');

      // Last event should be a kill
      const endEvents = events.filter((e) => e.name === 'activity-end');
      expect(endEvents.length).toBe(2);
      expect(endEvents[0].data.result).toBe(false); // Pull 1: wipe
      expect(endEvents[1].data.result).toBe(true); // Pull 2: kill
    });
  });

  describe('full PVE encounter from example log', () => {
    it('processes a complete raid wipe lifecycle', () => {
      // From PVE example log: Network_30009_20260310.log
      feed(
        '02|2026-03-10T20:34:34.2140000+00:00|107C5CF7|Crow Xo|958f44bdb090fe47',
      );

      // Zone to Shirogane first
      feed(
        '01|2026-03-10T20:34:34.2140000+00:00|281|Shirogane|bf20a7abbfb91abc',
      );

      // Zone to Deltascape V1.0 (Savage)
      feed(
        '01|2026-03-10T20:34:48.2780000+00:00|2B7|Deltascape V1.0 (Savage)|fb471bb3ae61a44f',
      );
      feed(
        '02|2026-03-10T20:34:48.2780000+00:00|107C5CF7|Crow Xo|70c4181e3f0b5eb9',
      );

      // Second zone change (actual load)
      feed(
        '01|2026-03-10T20:34:56.8970000+00:00|2B7|Deltascape V1.0 (Savage)|fbe23e51eac490c6',
      );

      // COMMENCE
      feed(
        '33|2026-03-10T20:34:59.7240000+00:00|80037565|40000001|1518|00|00|00|3a940ec523a43e97',
      );

      // InCombat — game combat starts
      feed(
        '260|2026-03-10T20:35:01.3920000+00:00|1|1|0|1|416a7de29dbed619',
      );

      expect(LogHandler.activity).toBeDefined();
      expect(LogHandler.activity).toBeInstanceOf(RaidEncounter);

      const encounter = LogHandler.activity as RaidEncounter;
      expect(encounter.zoneName).toBe('Deltascape V1.0 (Savage)');
      expect(encounter.pullNumber).toBe(1);
      expect(encounter.playerEntityId).toBe('107C5CF7');

      // FADE_OUT (wipe)
      feed(
        '33|2026-03-10T20:35:31.5580000+00:00|80037565|40000005|00|00|00|00|8d649d7d83a7d7ed',
      );

      // InCombat — game combat ends
      feed(
        '260|2026-03-10T20:35:31.2540000+00:00|1|0|0|1|0ebf91b159882bce',
      );

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(false); // Wipe

      const metadata = endEvent!.data.getMetadata();
      expect(metadata.category).toBe('Raids');
      expect(metadata.zoneName).toBe('Deltascape V1.0 (Savage)');
      expect(metadata.tag).toBe('Pull 1');

      // RECOMMENCE — ready for next pull
      feed(
        '33|2026-03-10T20:35:41.7860000+00:00|80037565|40000006|14F9|14|00|00|18de0cb194d56187',
      );
    });
  });
});
