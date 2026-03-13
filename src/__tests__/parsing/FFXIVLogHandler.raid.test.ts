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

  describe('InCombat isGameChanged filter', () => {
    it('ignores InCombat events where only ACT combat changed', () => {
      enterDutyInstance();

      // NetworkAbility starts pull (player → NPC boss)
      feed(
        '21|2026-03-12T18:20:38.6310000-05:00|106B41F1|Yurii Himura|906F|Heartbreak Shot|400091E4|Red Hot|724003|hash',
      );

      expect(LogHandler.activity).toBeDefined();

      // InCombat: ACT combat changed (isACTChanged=1), but game combat
      // did NOT change (isGameChanged=0). inGameCombat=0 here is the
      // intermediate state — should NOT end the pull.
      feed('260|2026-03-12T18:20:38.3720000-05:00|1|0|1|0|hash');

      // Pull should still be active — not ended by the intermediate state
      expect(LogHandler.activity).toBeDefined();
    });

    it('correctly ends pull when game combat actually changes to 0', () => {
      enterDutyInstance();

      // Start pull via ability
      feed(
        '21|2026-03-12T18:20:38.6310000-05:00|106B41F1|Yurii Himura|906F|Heartbreak Shot|400091E4|Red Hot|724003|hash',
      );

      // Intermediate InCombat (ACT changed, game didn't) — should be ignored
      feed('260|2026-03-12T18:20:38.3720000-05:00|1|0|1|0|hash');
      expect(LogHandler.activity).toBeDefined();

      // Game combat turns ON (isGameChanged=1) — should NOT end pull
      feed('260|2026-03-12T18:20:39.6780000-05:00|1|1|0|1|hash');
      expect(LogHandler.activity).toBeDefined();

      // Game combat turns OFF (isGameChanged=1) — should end pull
      feed('260|2026-03-12T18:20:59.7090000-05:00|1|0|0|1|hash');
      expect(events.some((e) => e.name === 'activity-end')).toBe(true);
    });
  });

  describe('ACT compatibility (no InCombat events)', () => {
    it('starts pull on first NetworkAbility against NPC', () => {
      enterDutyInstance();

      // Player attacks boss (type 21: sourceId=player, targetId=NPC)
      feed(
        '21|2026-03-12T12:53:50.7130000-07:00|106950F6|Original Dsi|5EFA|Eukrasian Dosis III|4000147A|Erichthonios|326A0E|hash',
      );

      expect(LogHandler.activity).toBeDefined();
      expect(LogHandler.activity).toBeInstanceOf(RaidEncounter);
      expect((LogHandler.activity as RaidEncounter).pullNumber).toBe(1);
    });

    it('ends pull on FADE_OUT without InCombat', () => {
      enterDutyInstance();

      // Pull start via ability
      feed(
        '21|2026-03-12T12:53:50.7130000-07:00|106950F6|Original Dsi|5EFA|Eukrasian Dosis III|4000147A|Erichthonios|326A0E|hash',
      );

      // FADE_OUT ends the pull directly
      feed(
        '33|2026-03-12T12:53:56.0540000-07:00|800375A0|40000005|00|00|00|00|hash',
      );

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(false); // Wipe
    });

    it('ends pull on VICTORY without InCombat', () => {
      enterDutyInstance();

      feed(
        '21|2026-03-12T12:53:50.7130000-07:00|106950F6|Original Dsi|5EFA|Eukrasian Dosis III|4000147A|Erichthonios|326A0E|hash',
      );

      feed(
        '33|2026-03-12T12:53:56.0540000-07:00|800375A0|40000003|00|00|00|00|hash',
      );

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(true); // Kill
    });

    it('supports multiple pulls via ACT flow', () => {
      enterDutyInstance();

      // Pull 1: ability → FADE_OUT
      feed(
        '21|2026-03-12T12:53:50.0000000-07:00|106950F6|Original Dsi|5EFA|Eukrasian Dosis III|4000147A|Erichthonios|326A0E|hash',
      );
      feed(
        '33|2026-03-12T12:53:56.0000000-07:00|800375A0|40000005|00|00|00|00|hash',
      );

      // RECOMMENCE
      feed(
        '33|2026-03-12T12:54:06.0000000-07:00|800375A0|40000006|1512|14|00|00|hash',
      );

      // Pull 2: ability → VICTORY
      feed(
        '21|2026-03-12T12:54:26.0000000-07:00|106950F6|Original Dsi|5EFA|Eukrasian Dosis III|4000147A|Erichthonios|326A0E|hash',
      );
      feed(
        '33|2026-03-12T12:54:56.0000000-07:00|800375A0|40000003|00|00|00|00|hash',
      );

      const endEvents = events.filter((e) => e.name === 'activity-end');
      expect(endEvents.length).toBe(2);
      expect(endEvents[0].data.result).toBe(false); // Pull 1: wipe
      expect(endEvents[1].data.result).toBe(true); // Pull 2: kill
    });

    it('ignores NPC-on-NPC abilities', () => {
      enterDutyInstance();

      // NPC attacks NPC — should not start a pull
      feed(
        '21|2026-03-12T12:53:50.0000000-07:00|4000147A|Erichthonios|368|attack|4000147B|Erichthonios|0|hash',
      );

      expect(LogHandler.activity).toBeUndefined();
    });

    it('ignores player-on-player abilities', () => {
      enterDutyInstance();

      // Player attacks player — should not start a pull
      feed(
        '21|2026-03-12T12:53:50.0000000-07:00|106950F6|Original Dsi|5EE2|Eukrasia|106950F6|Original Dsi|3E|hash',
      );

      expect(LogHandler.activity).toBeUndefined();
    });

    it('full ACT log sequence from real data', () => {
      // From ACT log: Network_30101_20260312.log
      feed(
        '02|2026-03-12T12:52:49.1390000-07:00|106950F6|Original Dsi|0cfc82971cdf3b30',
      );
      feed(
        '01|2026-03-12T12:52:49.1390000-07:00|FA|Wolves\' Den Pier|9a86893a70e7764d',
      );

      // Zone to Asphodelos (Savage)
      feed(
        '01|2026-03-12T12:53:27.3080000-07:00|3EB|Asphodelos: The First Circle (Savage)|a0c41fa62504a07a',
      );
      feed(
        '02|2026-03-12T12:53:27.3080000-07:00|106950F6|Original Dsi|8455b94bd09d69bb',
      );
      feed(
        '01|2026-03-12T12:53:46.9330000-07:00|3EB|Asphodelos: The First Circle (Savage)|aa45bf0af1e2373d',
      );

      // COMMENCE
      feed(
        '33|2026-03-12T12:53:49.8670000-07:00|800375A0|40000001|1518|00|00|00|717043cb95fda05e',
      );

      // First ability on boss — pull starts
      feed(
        '21|2026-03-12T12:53:50.7130000-07:00|106950F6|Original Dsi|5EFA|Eukrasian Dosis III|4000147A|Erichthonios|326A0E|hash',
      );

      expect(LogHandler.activity).toBeDefined();
      expect(LogHandler.activity).toBeInstanceOf(RaidEncounter);
      const encounter = LogHandler.activity as RaidEncounter;
      expect(encounter.zoneName).toBe('Asphodelos: The First Circle (Savage)');
      expect(encounter.pullNumber).toBe(1);

      // FADE_OUT — wipe
      feed(
        '33|2026-03-12T12:53:56.0540000-07:00|800375A0|40000005|00|00|00|00|8c4e1ae88a4c7e92',
      );

      const endEvent = events.find((e) => e.name === 'activity-end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.result).toBe(false);

      const metadata = endEvent!.data.getMetadata();
      expect(metadata.category).toBe('Raids');
      expect(metadata.zoneName).toBe('Asphodelos: The First Circle (Savage)');
      expect(metadata.tag).toBe('Pull 1');
    });
  });

  describe('countdown-based pre-pull buffer', () => {
    it('uses countdown duration as buffer when countdown is present', () => {
      enterDutyInstance();

      // Countdown: 22 seconds
      feed(
        '00|2026-03-12T18:20:17.0000000-05:00|0139||Battle commencing in 22 seconds! (Qata MewrilahJenova)|hash',
      );

      // Pull starts via InCombat
      feed('260|2026-03-12T18:20:39.0000000-05:00|1|1|0|1|hash');

      const encounter = LogHandler.activity as RaidEncounter;
      expect(encounter).toBeDefined();
      expect(encounter.bufferSeconds).toBe(22);
    });

    it('uses default 5s buffer when no countdown is present', () => {
      enterDutyInstance();

      // No countdown — pull starts directly
      feed('260|2026-03-12T18:20:39.0000000-05:00|1|1|0|1|hash');

      const encounter = LogHandler.activity as RaidEncounter;
      expect(encounter).toBeDefined();
      expect(encounter.bufferSeconds).toBe(5);
    });

    it('countdown is consumed after pull — next pull without countdown gets 5s', () => {
      enterDutyInstance();

      // Pull 1 with countdown
      feed(
        '00|2026-03-12T18:20:17.0000000-05:00|0139||Battle commencing in 16 seconds! (Qata MewrilahJenova)|hash',
      );
      feed('260|2026-03-12T18:20:39.0000000-05:00|1|1|0|1|hash');
      expect((LogHandler.activity as RaidEncounter).bufferSeconds).toBe(16);

      // End pull 1
      feed('260|2026-03-12T18:21:00.0000000-05:00|1|0|0|1|hash');

      // Pull 2 without countdown
      feed('260|2026-03-12T18:22:00.0000000-05:00|1|1|0|1|hash');
      expect((LogHandler.activity as RaidEncounter).bufferSeconds).toBe(5);
    });

    it('ignores countdown messages outside duty instance', () => {
      // Set up player + zone but NO COMMENCE
      feed(
        '02|2026-03-10T20:34:34.2140000+00:00|107C5CF7|Crow Xo|hash',
      );
      feed(
        '01|2026-03-10T20:34:48.2780000+00:00|2B7|Deltascape V1.0 (Savage)|hash',
      );

      // Countdown before COMMENCE — should be ignored
      feed(
        '00|2026-03-10T20:34:50.0000000+00:00|0139||Battle commencing in 15 seconds! (Crow XoServer)|hash',
      );

      // Now COMMENCE
      feed(
        '33|2026-03-10T20:34:59.7240000+00:00|80037565|40000001|1518|00|00|00|hash',
      );

      // Pull starts — should use default 5s since countdown was before duty instance
      feed('260|2026-03-10T20:35:01.0000000+00:00|1|1|0|1|hash');
      expect((LogHandler.activity as RaidEncounter).bufferSeconds).toBe(5);
    });

    it('uses first countdown value when multiple countdowns fire', () => {
      enterDutyInstance();

      // First countdown message (full duration)
      feed(
        '00|2026-03-12T18:20:17.0000000-05:00|0139||Battle commencing in 22 seconds! (Qata MewrilahJenova)|hash',
      );
      // Follow-up messages
      feed(
        '00|2026-03-12T18:20:29.0000000-05:00|0039||Battle commencing in 10 seconds!|hash',
      );
      feed(
        '00|2026-03-12T18:20:34.0000000-05:00|0039||Battle commencing in 5 seconds!|hash',
      );

      feed('260|2026-03-12T18:20:39.0000000-05:00|1|1|0|1|hash');

      const encounter = LogHandler.activity as RaidEncounter;
      expect(encounter.bufferSeconds).toBe(22);
    });

    it('works with NetworkAbility pull start (ACT compatibility)', () => {
      enterDutyInstance();

      // Countdown
      feed(
        '00|2026-03-12T18:20:17.0000000-05:00|0139||Battle commencing in 18 seconds! (SomePlayer)|hash',
      );

      // Pull starts via ability (no InCombat — ACT flow)
      feed(
        '21|2026-03-12T18:20:35.0000000-05:00|106950F6|Original Dsi|5EFA|Eukrasian Dosis III|4000147A|Erichthonios|326A0E|hash',
      );

      const encounter = LogHandler.activity as RaidEncounter;
      expect(encounter).toBeDefined();
      expect(encounter.bufferSeconds).toBe(18);
    });
  });
});
