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
 * Raid Pull Lifecycle:
 *   1. Zone change (type 01) to an instanced duty
 *   2. ActorControl COMMENCE (40000001) in non-CC zone -> duty instance detected
 *   3. InCombat (type 260) inGameCombat 0→1 -> pull start
 *   4. InCombat inGameCombat 1→0 -> pull end
 *   5. ActorControl VICTORY (40000003) / FADE_OUT (40000005) -> result
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
  getTeamFromPosition,
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

  /** Last known X position of the Tactical Crystal. */
  private crystalLastX: number | undefined;

  /** Whether we're in a duty instance (received COMMENCE in non-CC zone). */
  private inDutyInstance = false;

  /** Whether the player is currently in game combat (from InCombat type 260). */
  private inGameCombat = false;

  /** Pull counter within the current duty instance. */
  private pullCount = 0;

  /** Raid pull result, set by VICTORY/FADE_OUT before InCombat drops. */
  private raidResult: boolean | undefined;

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

    // Type 270: NpcPosition (tracks Tactical Crystal movement)
    this.watcher.on('270', (line: ACTLogLine) => this.handleNpcPosition(line));

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
    } else {
      // Force-end any active raid pull on zone change.
      if (this.inDutyInstance || this.inGameCombat) {
        console.info('[FFXIVLogHandler] Left duty instance zone');

        if (LogHandler.isActivityInProgress() && !LogHandler.overrunning) {
          this.endRaidPull(new Date(), false);
        }

        this.resetRaidState();
      }

      if (this.inCCZone || LogHandler.isActivityInProgress()) {
        console.info('[FFXIVLogHandler] Left CC zone');
        this.inCCZone = false;

        if (LogHandler.isActivityInProgress() && !LogHandler.overrunning) {
          // Player left the arena — force end the match.
          this.emit('force-end');
          this.endCCMatch(line.timestamp, false);
        }

        this.resetMatchState();
      }
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

    // Detect the Tactical Crystal NPC for result tracking.
    if (name === 'Tactical Crystal') {
      this.crystalEntityId = entityId;
      this.crystalLastX = undefined;
      console.info('[FFXIVLogHandler] Tactical Crystal detected:', entityId);
      return;
    }

    // Only care about player entities (10xxxxxx), not NPCs (40xxxxxx).
    if (!isPlayerEntity(entityId)) return;

    const jobIdHex = line.field(2);
    const jobId = parseInt(jobIdHex, 16);
    const level = line.fieldInt(3);
    const worldName = line.field(6);
    // posX is at field index 15 (indices 13,14 are empty fields before pos)
    const posX = line.fieldFloat(15);

    const combatant = new Combatant(entityId);
    combatant.name = name;
    combatant.jobId = jobId;
    combatant.level = level;
    combatant.worldName = worldName;
    combatant.teamId = getTeamFromPosition(posX);

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
      `team=${combatant.teamId}`,
      `pos=(${posX})`,
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
      } else if (this.isRaidZone()) {
        // COMMENCE in a raid zone = duty instance for pull tracking.
        console.info('[FFXIVLogHandler] Raid duty instance commenced:', this.currentZoneName);
        this.inDutyInstance = true;
        this.pullCount = 0;
        this.raidResult = undefined;
      }
    } else if (command === ActorControlType.MATCH_END) {
      console.info('[FFXIVLogHandler] CC match ended');
      this.endCCMatch(line.timestamp, true);
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
   * Type 270: NpcPosition
   * Format: 270|timestamp|entityId|heading|flag1|flag2|posX|posY|posZ|hash
   *
   * Tracks the Tactical Crystal position to determine match result.
   */
  private handleNpcPosition(line: ACTLogLine) {
    if (!this.crystalEntityId) return;

    const entityId = line.field(0);
    if (entityId !== this.crystalEntityId) return;

    this.crystalLastX = line.fieldFloat(4);
  }

  /**
   * Determine CC match result from crystal position and player team.
   * Crystal pushed to negative X = Astra wins, positive X = Umbra wins.
   * Returns true if the player's team won.
   */
  private determineCCResult(): boolean {
    if (this.crystalLastX === undefined || !this.playerEntityId) {
      console.warn('[FFXIVLogHandler] Cannot determine result: missing crystal position or player');
      return false;
    }

    const player = LogHandler.activity?.getCombatant(this.playerEntityId);
    if (!player?.teamId) {
      console.warn('[FFXIVLogHandler] Cannot determine result: player team unknown');
      return false;
    }

    // Crystal at negative X = pushed toward Umbra side = Astra (team 1) wins
    // Crystal at positive X = pushed toward Astra side = Umbra (team 2) wins
    const astraWon = this.crystalLastX < 0;
    const playerIsAstra = player.teamId === 1;
    const playerWon = astraWon === playerIsAstra;

    console.info(
      '[FFXIVLogHandler] Match result:',
      `crystal X=${this.crystalLastX.toFixed(2)}`,
      `${astraWon ? 'Astra' : 'Umbra'} wins,`,
      `player team=${playerIsAstra ? 'Astra' : 'Umbra'},`,
      `result=${playerWon ? 'WIN' : 'LOSS'}`,
    );

    return playerWon;
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
    // The 5-second pre-pull buffer is handled via the Activity's bufferSeconds.
    const now = new Date();

    const encounter = new RaidEncounter(
      now,
      this.currentZoneId!,
      this.currentZoneName || 'Unknown',
      this.pullCount,
    );

    if (this.playerEntityId) {
      encounter.playerEntityId = this.playerEntityId;
    }

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

    // Add any pending combatants collected from AddCombatant events.
    if (this._pendingCombatants) {
      for (const combatant of this._pendingCombatants.values()) {
        match.addCombatant(combatant);
      }
    }

    await LogHandler.startActivity(match);
    this.matchStarted = true;
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

    // Determine match result from crystal position.
    const result = this.determineCCResult();
    LogHandler.activity.end(timestamp, result);

    const metadata = LogHandler.activity.getMetadata();
    console.info(
      '[FFXIVLogHandler] Match ended.',
      `Duration: ${metadata.duration.toFixed(1)}s`,
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
    this.crystalLastX = undefined;
    this.resetRaidState();
  }

  /**
   * Feed a raw log line directly (for testing).
   */
  public feedLine(line: string) {
    this.watcher.handleLogLine(line);
  }
}
