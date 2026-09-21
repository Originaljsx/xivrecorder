/**
 * FFXIV Log Handler — CC match and raid pull detection.
 *
 * Watches IINACT log events and manages activity lifecycles for:
 *   - Crystalline Conflict matches (CC)
 *   - Raid/trial encounter pulls (PvE)
 *
 * CC Match Lifecycle:
 *   1. Zone change (type 01) to a CC territory -> prepare for match
 *   2. AddCombatant (type 03) events -> collect player info and teams
 *   3. ActorControl (type 33) command 40000001 -> match start
 *   4. ActorControl (type 33) command 40000002 -> match end
 *
 * CC Result Detection:
 *   Tactical Crystal push: the crystal's position (type 270/271/261) is
 *   projected onto the lane between the two spawn clusters. The team that
 *   pushed it furthest towards the enemy goal wins (this is the game's own
 *   time-out rule; verified against PvpStats history on real matches).
 *   ActorControl 40000007 ordering is logged but never used as a result.
 *
 * Teams are relative (1 = local player's team, 2 = enemy). After the video
 * is saved, PvpStatsLink may replace the result and team labels with the
 * authoritative ones from the PvpStats plugin.
 *
 * Raid Pull Lifecycle:
 *   1. Zone change (type 01) to a Savage/Ultimate zone -> duty instance armed
 *   2. InCombat (type 260) inGameCombat 0→1 -> pull start
 *      (or first NetworkAbility from player to NPC for ACT compatibility)
 *   3. InCombat inGameCombat 1→0 -> pull end
 *   4. ActorControl VICTORY (40000003) / FADE_OUT (40000005) -> result
 */
import { EventEmitter } from 'events';
import LogHandler from './LogHandler';
import IINACTLogWatcher from './IINACTLogWatcher';
import ACTLogLine from './ACTLogLine';
import CCMatch from '../activitys/CCMatch';
import RaidEncounter from '../activitys/RaidEncounter';
import Combatant from '../main/Combatant';
import { ActorControlType } from '../main/constants';
import { VideoCategory } from '../types/VideoCategory';
import {
  isCCTerritory,
  isPlayerEntity,
  isTacticalCrystal,
  assignTeamsBySpawn,
  teamForPosition,
  crystalProgressAlongLane,
  Point2,
  SpawnTeams,
} from './ffxivutils';

export default class FFXIVLogHandler extends EventEmitter {
  private watcher: IINACTLogWatcher;


  /** The player's own entity ID, from ChangePrimaryPlayer (type 02). */
  private playerEntityId: string | undefined;

  /** The player's name, from ChangePrimaryPlayer (type 02). */
  private playerName: string | undefined;

  /** Current zone ID, from ChangeZone (type 01). */
  private currentZoneId: number | undefined;

  /** Current zone name. */
  private currentZoneName: string | undefined;

  /** Whether we're in a CC territory and expecting a match. */
  private inCCZone = false;

  /** Whether match has formally started via ActorControl commence. */
  private matchStarted = false;

  /** Entity ID of the Tactical Crystal in the current match. */
  private crystalEntityId: string | undefined;

  /** Last known arena position of the Tactical Crystal. */
  private crystalLast: Point2 | undefined;

  /** Number of crystal position samples seen since match start. */
  private crystalSamples = 0;

  /** Furthest the crystal was pushed towards the enemy goal (arena units). */
  private friendlyPush = 0;

  /** Furthest the crystal was pushed towards our goal (arena units). */
  private enemyPush = 0;

  /** Spawn-cluster team assignment, computed at match start. */
  private spawnTeams: SpawnTeams | undefined;

  /** Spawn positions of players seen in the CC zone, keyed by entity ID. */
  private spawnPositions = new Map<string, Point2>();

  /** Whether we're in a duty instance (received COMMENCE in non-CC zone). */
  private inDutyInstance = false;

  /** Whether the player is currently in game combat (from InCombat type 260). */
  private inGameCombat = false;

  /** Pull counter within the current duty instance. */
  private pullCount = 0;

  /** Raid pull result, set by VICTORY/FADE_OUT before InCombat drops. */
  private raidResult: boolean | undefined;

  /** Countdown duration in seconds from the most recent /countdown command. */
  private countdownSeconds: number | undefined;

  /** data0 of each TEAM_RESULT (0x40000007) ActorControl, in arrival order. */
  private ccTeamResultOrder: number[] = [];

  /** Deferred match end timer (allows TEAM_RESULT to arrive after MATCH_END). */
  private matchEndTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(logDir: string) {
    super();
    this.watcher = new IINACTLogWatcher(logDir, 30);
    this.setupEventHandlers();
  }

  /**
   * Start watching for log events.
   */
  async start() {
    await this.watcher.watch();
    console.info('[FFXIVLogHandler] Started watching IINACT logs');
  }

  /**
   * Stop watching.
   */
  async stop() {
    await this.watcher.unwatch();
    console.info('[FFXIVLogHandler] Stopped watching IINACT logs');
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this.watcher.unwatch();
    this.watcher.removeAllListeners();
    this.removeAllListeners();
  }

  private setupEventHandlers() {
    // Type 02: ChangePrimaryPlayer
    this.watcher.on('2', (line: ACTLogLine) => this.handleChangePrimaryPlayer(line));

    // Type 01: ChangeZone
    this.watcher.on('1', (line: ACTLogLine) => this.handleChangeZone(line));

    // Type 03: AddCombatant
    this.watcher.on('3', (line: ACTLogLine) => this.handleAddCombatant(line));

    // Type 33: ActorControl (NetworkActorControlExtra uses OverlayPlugin type 273)
    this.watcher.on('33', (line: ACTLogLine) => this.handleActorControl(line));

    // Type 21: NetworkAbility (detects first combat action for raid pull start)
    this.watcher.on('21', (line: ACTLogLine) => this.handleNetworkAbility(line));

    // Type 25: NetworkDeath
    this.watcher.on('25', (line: ACTLogLine) => this.handleNetworkDeath(line));

    // Type 260: InCombat (tracks combat state for raid pulls — IINACT only)
    this.watcher.on('260', (line: ACTLogLine) => this.handleInCombat(line));

    // Type 00: ChatMessage (detects countdown for dynamic pre-pull buffer)
    this.watcher.on('0', (line: ACTLogLine) => this.handleChatMessage(line));

    // Type 270: ActorMove / 271: ActorSetPos (tracks Tactical Crystal movement)
    this.watcher.on('270', (line: ACTLogLine) => this.handleActorMove(line));
    this.watcher.on('271', (line: ACTLogLine) => this.handleActorMove(line));

    // Type 261: CombatantMemory (position changes for tracked combatants)
    this.watcher.on('261', (line: ACTLogLine) => this.handleCombatantMemory(line));

    // Timeout — force stop if no activity for a long time
    this.watcher.on('timeout', () => {
      if (LogHandler.isActivityInProgress()) {
        console.warn('[FFXIVLogHandler] Log timeout, forcing activity end');
        LogHandler.forceEndActivity();
        this.resetMatchState();
      }
    });
  }

  /**
   * Type 02: ChangePrimaryPlayer
   * Format: 02|timestamp|entityId|name|hash
   *
   * Stores the player's entity ID so we can identify them in AddCombatant.
   */
  private handleChangePrimaryPlayer(line: ACTLogLine) {
    this.playerEntityId = line.field(0);
    this.playerName = line.field(1);
    console.info(
      '[FFXIVLogHandler] Primary player:',
      this.playerName,
      this.playerEntityId,
    );
  }

  /**
   * Type 01: ChangeZone
   * Format: 01|timestamp|zoneId(hex)|zoneName|hash
   *
   * If zone is a CC territory, prepare for match.
   * If zone is NOT CC and we had an active match, force end it.
   */
  private handleChangeZone(line: ACTLogLine) {
    const zoneIdHex = line.field(0);
    const zoneName = line.field(1);
    const zoneId = parseInt(zoneIdHex, 16);

    console.info(
      '[FFXIVLogHandler] Zone change:',
      zoneName,
      `(0x${zoneIdHex}=${zoneId})`,
    );

    this.currentZoneId = zoneId;
    this.currentZoneName = zoneName;

    if (isCCTerritory(zoneId)) {
      if (!this.inCCZone) {
        console.info('[FFXIVLogHandler] Entered CC zone:', zoneName);
        this.inCCZone = true;
        this.emit('cc-zone-enter', { zoneId, zoneName });
      }
      // Don't start the activity yet — wait for ActorControl commence.
      // But emit an event so the recorder can start buffering.
      this.emit('start-buffer');
      return;
    }

    // Non-CC zone. Handle leaving CC if we were in one.
    if (this.inCCZone) {
      console.info('[FFXIVLogHandler] Left CC zone');
      this.inCCZone = false;

      if (LogHandler.isActivityInProgress() && !LogHandler.overrunning) {
        this.emit('force-end');
        this.endCCMatch(line.timestamp, false);
      }

      this.resetMatchState();
    }

    // Raid zone enter/leave. The duty-instance flag is gated on the zone
    // suffix alone — the ActorControl COMMENCE event is unreliable across
    // IINACT versions and not emitted at all in some Ultimates (e.g. TOP).
    if (this.isRaidZone()) {
      if (!this.inDutyInstance) {
        console.info(
          '[FFXIVLogHandler] Entered raid duty instance:',
          zoneName,
        );
        this.inDutyInstance = true;
        this.pullCount = 0;
        this.raidResult = undefined;
        this.emit('start-buffer');
      }
    } else if (this.inDutyInstance || this.inGameCombat) {
      console.info('[FFXIVLogHandler] Left duty instance zone');

      if (LogHandler.isActivityInProgress() && !LogHandler.overrunning) {
        this.endRaidPull(new Date(), false);
      }

      this.resetRaidState();
    }
  }

  /**
   * Type 03: AddCombatant
   * Format: 03|timestamp|entityId|name|jobId(hex)|level|ownerId|worldId|worldName|
   *         npcNameId|npcBaseId|currentHp|maxHp|currentMp|maxMp|?|?|posX|posY|posZ|heading|hash
   *
   * Collect player combatants when in a CC zone.
   */
  private handleAddCombatant(line: ACTLogLine) {
    if (!this.inCCZone) return;

    const entityId = line.field(0);
    const name = line.field(1);
    const npcNameId = line.fieldInt(7);
    // posX/posY are at field indices 15/16 (13,14 are empty fields before pos)
    const posX = line.fieldFloat(15);
    const posY = line.fieldFloat(16);

    // Detect the Tactical Crystal NPC for result tracking.
    if (isTacticalCrystal(npcNameId, name)) {
      this.crystalEntityId = entityId;
      console.info('[FFXIVLogHandler] Tactical Crystal detected:', entityId);
      this.recordCrystalPosition({ x: posX, y: posY });
      return;
    }

    // Only care about player entities (10xxxxxx), not NPCs (40xxxxxx).
    if (!isPlayerEntity(entityId)) return;

    const jobIdHex = line.field(2);
    const jobId = parseInt(jobIdHex, 16);
    const level = line.fieldInt(3);
    const worldName = line.field(6);

    const combatant = new Combatant(entityId);
    combatant.name = name;
    combatant.jobId = jobId;
    combatant.level = level;
    combatant.worldName = worldName;
    combatant.spawnX = posX;
    combatant.spawnY = posY;

    // Remember spawn positions. Before the match starts everyone is confined
    // to their base, so these split cleanly into two clusters.
    if (!this.matchStarted) {
      this.spawnPositions.set(entityId, { x: posX, y: posY });
    }

    if (this.spawnTeams) {
      // Late arrival after teams were computed: nearest cluster wins.
      combatant.teamId =
        this.spawnTeams.teamById.get(entityId) ??
        teamForPosition({ x: posX, y: posY }, this.spawnTeams);
    }

    // If there's already an activity, add to it.
    // Otherwise, store for when the match starts.
    if (LogHandler.activity) {
      LogHandler.activity.addCombatant(combatant);
    }

    // Store in our pending combatants map for when match starts.
    if (!this._pendingCombatants) {
      this._pendingCombatants = new Map();
    }
    this._pendingCombatants.set(entityId, combatant);

    console.debug(
      '[FFXIVLogHandler] AddCombatant:',
      name,
      `job=0x${jobIdHex}`,
      `team=${combatant.teamId ?? '?'}`,
      `pos=(${posX}, ${posY})`,
    );
  }

  /** Pending combatants collected before match start. */
  private _pendingCombatants?: Map<string, Combatant>;

  /**
   * Type 33: ActorControl
   * Format: 33|timestamp|instanceContentType|command(hex)|data0|data1|data2|data3|hash
   *
   * Key commands:
   *   40000004 = preparation (30 sec countdown)
   *   40000001 = commence (match start, data = timer seconds)
   *   40000002 = match end
   */
  private handleActorControl(line: ACTLogLine) {
    const commandHex = line.field(1);
    const command = parseInt(commandHex, 16);

    if (command === ActorControlType.PREPARATION) {
      const countdownSec = line.fieldHex(2);
      console.info(
        '[FFXIVLogHandler] CC preparation countdown:',
        countdownSec,
        'seconds',
      );
      this.emit('preparation', countdownSec);
    } else if (command === ActorControlType.COMMENCE) {
      if (this.inCCZone) {
        const timerSec = line.fieldHex(2);
        console.info(
          '[FFXIVLogHandler] CC match commence! Timer:',
          timerSec,
          'seconds',
        );
        this.startCCMatch(line.timestamp);
      }
      // Note: COMMENCE in raid zones is intentionally not handled here.
      // Some duties (notably TOP Ultimate) never emit it. The duty-instance
      // flag is set on zone enter instead — see handleChangeZone.
    } else if (command === ActorControlType.MATCH_END) {
      console.info('[FFXIVLogHandler] CC match ended');
      // Defer match end slightly to allow TEAM_RESULT events to arrive
      // (they appear on the next lines, same timestamp, same processing chunk).
      const matchEndTimestamp = line.timestamp;
      this.matchEndTimer = setTimeout(() => {
        this.matchEndTimer = undefined;
        this.endCCMatch(matchEndTimestamp, true);
      }, 0);
    } else if (command === ActorControlType.TEAM_RESULT) {
      // 0x40000007 fires twice after MATCH_END (once per team, data0 = 0/1).
      // In the one real log we have they arrive as 00 then 01, so the order
      // may just be enumeration rather than "winner first". We record the
      // order for diagnostics and only use it as a last resort.
      const teamIndex = line.fieldHex(2);
      this.ccTeamResultOrder.push(teamIndex);
      console.info(
        '[FFXIVLogHandler] TEAM_RESULT event',
        `data0=${teamIndex}`,
        `data1=${line.field(3)} data2=${line.field(4)} data3=${line.field(5)}`,
      );

      // Once both have arrived, fire the deferred match end.
      if (this.matchEndTimer && this.ccTeamResultOrder.length >= 2) {
        clearTimeout(this.matchEndTimer);
        this.matchEndTimer = undefined;
        this.endCCMatch(line.timestamp, true);
      }
    } else if (command === ActorControlType.VICTORY) {
      console.info('[FFXIVLogHandler] Victory detected (boss killed)');
      this.raidResult = true;
      // End the pull immediately — works for both ACT and IINACT.
      if (LogHandler.isActivityInProgress() && this.inDutyInstance) {
        this.inGameCombat = false;
        this.endRaidPull(new Date(), true);
      }
    } else if (command === ActorControlType.FADE_OUT) {
      console.info('[FFXIVLogHandler] Fade out detected (wipe)');
      this.raidResult = false;
      // End the pull immediately — works for both ACT and IINACT.
      if (LogHandler.isActivityInProgress() && this.inDutyInstance) {
        this.inGameCombat = false;
        this.endRaidPull(new Date(), true);
      }
    } else if (command === ActorControlType.RECOMMENCE) {
      console.info('[FFXIVLogHandler] Recommence (ready for next pull)');
      this.raidResult = undefined;
    }
  }

  /**
   * Type 21: NetworkAbility
   * Format: 21|timestamp|sourceId|sourceName|abilityId|abilityName|targetId|targetName|...
   *
   * In raid duty instances, the first ability used on an NPC target after
   * COMMENCE signals the start of a pull. This works with both ACT and IINACT
   * (ACT does not emit type 260 InCombat events).
   */
  private handleNetworkAbility(line: ACTLogLine) {
    if (!this.inDutyInstance || this.inCCZone) return;
    // Already in combat — no need to start again.
    if (this.inGameCombat || LogHandler.isActivityInProgress()) return;

    const sourceId = line.field(0);
    const targetId = line.field(4);

    // Only care about player attacking an NPC (boss).
    if (!isPlayerEntity(sourceId)) return;
    if (!targetId || isPlayerEntity(targetId)) return;

    // First combat action on a boss — start the pull.
    this.inGameCombat = true;
    this.pullCount++;
    console.info(
      '[FFXIVLogHandler] First combat action detected, pull',
      this.pullCount,
    );
    this.startRaidPull(line.timestamp);
  }

  /**
   * Type 25: NetworkDeath
   * Format: 25|timestamp|targetId|targetName|sourceId|sourceName|hash
   */
  private handleNetworkDeath(line: ACTLogLine) {
    if (!LogHandler.activity || (!this.matchStarted && !this.inGameCombat)) return;

    const targetId = line.field(0);
    const targetName = line.field(1);
    const sourceName = line.field(3);

    // Only track player deaths.
    if (!isPlayerEntity(targetId)) return;

    LogHandler.activity.addDeath({
      name: targetName,
      timestamp: line.timestamp,
      killerName: sourceName || undefined,
    });

    console.debug('[FFXIVLogHandler] Player death:', targetName, 'by', sourceName);
  }

  /**
   * Type 270: ActorMove / Type 271: ActorSetPos
   * Format: 27x|timestamp|entityId|heading|unk1|unk2|posX|posY|posZ|hash
   *
   * Tracks the Tactical Crystal position to determine match result.
   */
  private handleActorMove(line: ACTLogLine) {
    if (!this.crystalEntityId) return;
    if (line.field(0) !== this.crystalEntityId) return;

    this.recordCrystalPosition({
      x: line.fieldFloat(4),
      y: line.fieldFloat(5),
    });
  }

  /**
   * Type 261: CombatantMemory
   * Format: 261|timestamp|Change|entityId|key|value|key|value|...|hash
   *
   * OverlayPlugin emits position deltas here for tracked combatants, which
   * gives us a second source of crystal movement in case 270 is sparse.
   */
  private handleCombatantMemory(line: ACTLogLine) {
    if (!this.crystalEntityId) return;
    if (line.field(0) !== 'Change') return;
    if (line.field(1) !== this.crystalEntityId) return;

    let x: number | undefined;
    let y: number | undefined;

    for (let i = 2; i < line.dataFieldCount; i += 2) {
      const key = line.field(i);
      if (key === 'PosX') x = line.fieldFloat(i + 1);
      else if (key === 'PosY') y = line.fieldFloat(i + 1);
    }

    if (x === undefined && y === undefined) return;

    this.recordCrystalPosition({
      x: x ?? this.crystalLast?.x ?? 0,
      y: y ?? this.crystalLast?.y ?? 0,
    });
  }

  /**
   * Record a crystal position sample and update the push extremes.
   * Only samples taken after the match has commenced count towards the
   * result; before that the crystal is parked at the centre anyway.
   */
  private recordCrystalPosition(p: Point2) {
    this.crystalLast = p;
    if (!this.matchStarted || !this.spawnTeams) return;

    this.crystalSamples++;
    const progress = crystalProgressAlongLane(p, this.spawnTeams);
    if (progress > this.friendlyPush) this.friendlyPush = progress;
    if (-progress > this.enemyPush) this.enemyPush = -progress;
  }

  /**
   * Type 00: ChatMessage
   * Format: 00|timestamp|chatCode|sender|message|hash
   *
   * Detects countdown messages to set the pre-pull buffer duration.
   * The first message (code 0139) has the full countdown:
   *   "Battle commencing in 16 seconds! (PlayerNameServer)"
   * Subsequent messages (code 0039) show 10, 5, then "Engage!".
   */
  private handleChatMessage(line: ACTLogLine) {
    if (!this.inDutyInstance || this.inCCZone) return;

    const message = line.field(2);
    const match = message.match(/^Battle commencing in (\d+) seconds!/);

    if (match) {
      const seconds = parseInt(match[1], 10);

      // Only store the first (longest) countdown value per pull.
      if (this.countdownSeconds === undefined) {
        this.countdownSeconds = seconds;
        console.info(
          '[FFXIVLogHandler] Countdown detected:',
          seconds,
          'seconds',
        );
      }
    }
  }

  /**
   * Determine CC match result. Returns the result and how it was derived.
   *
   * Crystal push: the crystal's furthest excursion towards each goal is
   * measured along the lane between the two spawn clusters. The team with the
   * larger push wins — this matches the game's own time-out rule, and every
   * completed match in the author's PvpStats history agrees with it.
   *
   * TEAM_RESULT ordering is unverified and only used when no crystal samples
   * were logged (e.g. an IINACT build that doesn't emit ActorMove lines).
   */
  private determineCCResult(): { result: boolean; source: string } {
    if (!this.spawnTeams) {
      console.warn(
        '[FFXIVLogHandler] Cannot determine result: teams unknown.',
        `playerEntityId=${this.playerEntityId}`,
        `spawnPositions=${this.spawnPositions.size}`,
      );
      return { result: false, source: 'unknown' };
    }

    // Method 1: crystal push along the lane.
    if (this.crystalSamples > 0) {
      const playerWon = this.friendlyPush >= this.enemyPush;
      console.info(
        '[FFXIVLogHandler] Match result (crystal push):',
        `ours=${this.friendlyPush.toFixed(2)}`,
        `theirs=${this.enemyPush.toFixed(2)}`,
        `samples=${this.crystalSamples}`,
        `result=${playerWon ? 'WIN' : 'LOSS'}`,
      );

      if (this.ccTeamResultOrder.length > 0) {
        console.info(
          '[FFXIVLogHandler] TEAM_RESULT order for this match:',
          this.ccTeamResultOrder.join(','),
        );
      }

      return { result: playerWon, source: 'crystal' };
    }

    // Method 2: TEAM_RESULT ordering heuristic (unverified).
    if (this.ccTeamResultOrder.length > 0) {
      console.warn(
        '[FFXIVLogHandler] No crystal samples; falling back to TEAM_RESULT',
        'order heuristic, which is unverified:',
        this.ccTeamResultOrder.join(','),
      );
      // Without a team-name mapping this can't be resolved to the local
      // player's team, so record it as unknown rather than guess.
      return { result: false, source: 'team-result-unresolved' };
    }

    console.warn(
      '[FFXIVLogHandler] Cannot determine result: no crystal samples and no TEAM_RESULT.',
    );
    return { result: false, source: 'unknown' };
  }

  /**
   * Check if the current zone is a recordable raid (Savage or Ultimate).
   */
  private isRaidZone(): boolean {
    if (!this.currentZoneName) return false;
    return (
      this.currentZoneName.endsWith('(Savage)') ||
      this.currentZoneName.endsWith('(Ultimate)')
    );
  }

  /**
   * Type 260: InCombat
   * Format: 260|timestamp|inACTCombat|inGameCombat|isACTChanged|isGameChanged|hash
   *
   * Tracks in-game combat state for raid pull detection.
   */
  private handleInCombat(line: ACTLogLine) {
    // Only care about duty instances, not CC zones.
    // This event is IINACT-only — ACT does not emit type 260.
    if (!this.inDutyInstance || this.inCCZone) return;

    // InCombat has two independent flags: inACTCombat and inGameCombat.
    // They toggle at different times, producing intermediate states like
    // (ACT=1, game=0). We only care about actual game combat transitions
    // to avoid false pull starts/stops.
    const isGameChanged = line.field(3) === '1';
    if (!isGameChanged) return;

    const inGameCombat = line.field(1) === '1';

    if (inGameCombat && !this.inGameCombat) {
      // Combat started. If a pull was already started via NetworkAbility,
      // just update the flag without starting a duplicate.
      this.inGameCombat = true;
      if (!LogHandler.isActivityInProgress()) {
        this.pullCount++;
        console.info(
          '[FFXIVLogHandler] Combat started (InCombat), pull',
          this.pullCount,
        );
        this.startRaidPull(line.timestamp);
      }
    } else if (!inGameCombat && this.inGameCombat) {
      // Combat ended. If FADE_OUT/VICTORY already ended the pull, skip.
      this.inGameCombat = false;
      if (LogHandler.isActivityInProgress()) {
        console.info('[FFXIVLogHandler] Combat ended (InCombat)');
        this.endRaidPull(new Date(), true);
      }
    }
  }

  /**
   * Start a raid pull activity.
   */
  private async startRaidPull(_timestamp: Date) {
    if (LogHandler.isActivityInProgress()) {
      console.warn('[FFXIVLogHandler] Pull start but activity already in progress');
      return;
    }

    // Use current time as the actual combat start for duration calculation.
    // Pre-pull buffer: use countdown duration if available, else default 5s.
    const now = new Date();
    const bufferSeconds = this.countdownSeconds ?? 5;
    this.countdownSeconds = undefined;

    const encounter = new RaidEncounter(
      now,
      this.currentZoneId!,
      this.currentZoneName || 'Unknown',
      this.pullCount,
      bufferSeconds,
    );

    if (this.playerEntityId) {
      encounter.playerEntityId = this.playerEntityId;
    }

    console.info(
      '[FFXIVLogHandler] Starting pull with',
      bufferSeconds,
      'second pre-pull buffer',
    );

    await LogHandler.startActivity(encounter);
    this.emit('activity-start', encounter);
  }

  /**
   * End the current raid pull.
   */
  private async endRaidPull(timestamp: Date, normal: boolean) {
    if (!LogHandler.activity) {
      console.warn('[FFXIVLogHandler] endRaidPull called with no active activity');
      return;
    }

    const result = this.raidResult ?? false;
    LogHandler.activity.end(timestamp, result);

    const metadata = LogHandler.activity.getMetadata();
    console.info(
      '[FFXIVLogHandler] Pull ended.',
      `Duration: ${metadata.duration.toFixed(1)}s`,
      `Result: ${result ? 'KILL' : 'WIPE'}`,
      `Deaths: ${metadata.deaths?.length ?? 0}`,
    );

    this.emit('activity-end', LogHandler.activity);

    if (!normal) {
      // Force end — skip overrun so the recording stops immediately.
      LogHandler.activity.overrun = 0;
    }

    await LogHandler.endActivity();

    // Reset result for next pull.
    this.raidResult = undefined;
  }

  /**
   * Reset raid-related state.
   */
  private resetRaidState() {
    this.inDutyInstance = false;
    this.inGameCombat = false;
    this.pullCount = 0;
    this.raidResult = undefined;
    this.countdownSeconds = undefined;
  }

  /**
   * Start a CC match activity.
   */
  private async startCCMatch(timestamp: Date) {
    if (!this.currentZoneId || !isCCTerritory(this.currentZoneId)) {
      console.warn(
        '[FFXIVLogHandler] Commence received but not in a CC zone',
      );
      return;
    }

    if (this.matchStarted) {
      console.warn('[FFXIVLogHandler] Commence received but match already started');
      return;
    }

    const match = new CCMatch(timestamp, this.currentZoneId);

    // Set the player entity ID.
    if (this.playerEntityId) {
      match.playerEntityId = this.playerEntityId;
    }

    // Split players into the two spawn clusters.
    this.spawnTeams = assignTeamsBySpawn(
      this.spawnPositions,
      this.playerEntityId,
    );

    if (this.spawnTeams) {
      const t = this.spawnTeams;
      console.info(
        '[FFXIVLogHandler] Spawn teams:',
        `friendly=(${t.friendlyCentroid.x.toFixed(1)}, ${t.friendlyCentroid.y.toFixed(1)})`,
        `enemy=(${t.enemyCentroid.x.toFixed(1)}, ${t.enemyCentroid.y.toFixed(1)})`,
        `players=${t.teamById.size}`,
      );
    } else {
      console.warn(
        '[FFXIVLogHandler] Could not derive teams from spawn positions',
        `player=${this.playerEntityId}`,
        `positions=${this.spawnPositions.size}`,
      );
    }

    // Add any pending combatants collected from AddCombatant events.
    if (this._pendingCombatants) {
      for (const combatant of this._pendingCombatants.values()) {
        if (this.spawnTeams) {
          combatant.teamId = this.spawnTeams.teamById.get(combatant.entityId);
        }
        match.addCombatant(combatant);
      }
    }

    // Mark started before awaiting so crystal samples in the same log chunk
    // as COMMENCE are counted (line processing is synchronous per chunk).
    this.matchStarted = true;
    this.friendlyPush = 0;
    this.enemyPush = 0;
    this.crystalSamples = 0;

    await LogHandler.startActivity(match);
    this.emit('activity-start', match);
  }

  /**
   * End the current CC match.
   */
  private async endCCMatch(timestamp: Date, normal: boolean) {
    if (!LogHandler.activity) {
      console.warn('[FFXIVLogHandler] endCCMatch called with no active activity');
      return;
    }

    const { result, source } = this.determineCCResult();
    LogHandler.activity.end(timestamp, result);
    if (LogHandler.activity instanceof CCMatch) {
      LogHandler.activity.resultSource = source;
    }

    const metadata = LogHandler.activity.getMetadata();
    console.info(
      '[FFXIVLogHandler] Match ended.',
      `Duration: ${metadata.duration.toFixed(1)}s`,
      `Result: ${result ? 'WIN' : 'LOSS'} (${source})`,
      `Deaths: ${metadata.deaths?.length ?? 0}`,
      `Combatants: ${metadata.combatants.length}`,
    );

    this.emit('activity-end', LogHandler.activity);

    if (!normal) {
      // Force end — skip overrun so the recording stops immediately.
      LogHandler.activity.overrun = 0;
    }

    await LogHandler.endActivity();
    this.matchStarted = false;
  }

  /**
   * Reset internal match tracking state.
   */
  private resetMatchState() {
    this.matchStarted = false;
    this._pendingCombatants = undefined;
    this.crystalEntityId = undefined;
    this.crystalLast = undefined;
    this.crystalSamples = 0;
    this.friendlyPush = 0;
    this.enemyPush = 0;
    this.spawnTeams = undefined;
    this.spawnPositions = new Map();
    this.ccTeamResultOrder = [];
    if (this.matchEndTimer) {
      clearTimeout(this.matchEndTimer);
      this.matchEndTimer = undefined;
    }
    this.resetRaidState();
  }

  /**
   * Feed a raw log line directly (for testing).
   */
  public feedLine(line: string) {
    this.watcher.handleLogLine(line);
  }
}
