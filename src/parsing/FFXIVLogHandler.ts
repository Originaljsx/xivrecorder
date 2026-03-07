/**
 * FFXIV Log Handler — Crystalline Conflict match detection.
 *
 * Watches IINACT log events and manages the CC match activity lifecycle.
 *
 * CC Match Lifecycle (from actual IINACT log analysis):
 *   1. Zone change (type 01) to a CC territory -> prepare for match
 *   2. AddCombatant (type 03) events -> collect player info and teams
 *   3. ActorControl (type 33) command 40000001 -> match start
 *   4. ActorControl (type 33) command 40000002 -> match end
 *   5. Zone change away from CC territory -> force stop if still active
 *
 * Player identification:
 *   - ChangePrimaryPlayer (type 02) provides the player's entity ID
 *   - AddCombatant (type 03) provides job, world, position for team detection
 *   - Teams determined by spawn X position (positive = Astra, negative = Umbra)
 */
import { EventEmitter } from 'events';
import LogHandler from './LogHandler';
import IINACTLogWatcher from './IINACTLogWatcher';
import ACTLogLine from './ACTLogLine';
import CCMatch from '../activitys/CCMatch';
import Combatant from '../main/Combatant';
import { ActorControlType } from '../main/constants';
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

    // Type 25: NetworkDeath
    this.watcher.on('25', (line: ACTLogLine) => this.handleNetworkDeath(line));

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

    // Only care about player entities (10xxxxxx), not NPCs (40xxxxxx).
    if (!isPlayerEntity(entityId)) return;

    const name = line.field(1);
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
      const timerSec = line.fieldHex(2);
      console.info(
        '[FFXIVLogHandler] CC match commence! Timer:',
        timerSec,
        'seconds',
      );
      this.startCCMatch(line.timestamp);
    } else if (command === ActorControlType.MATCH_END) {
      console.info('[FFXIVLogHandler] CC match ended');
      this.endCCMatch(line.timestamp, true);
    }
  }

  /**
   * Type 25: NetworkDeath
   * Format: 25|timestamp|targetId|targetName|sourceId|sourceName|hash
   */
  private handleNetworkDeath(line: ACTLogLine) {
    if (!LogHandler.activity || !this.matchStarted) return;

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

    // Set end time on the activity.
    LogHandler.activity.end(timestamp, LogHandler.activity.result);

    const metadata = LogHandler.activity.getMetadata();
    console.info(
      '[FFXIVLogHandler] Match ended.',
      `Duration: ${metadata.duration.toFixed(1)}s`,
      `Deaths: ${metadata.deaths?.length ?? 0}`,
      `Combatants: ${metadata.combatants.length}`,
    );

    this.emit('activity-end', LogHandler.activity);

    if (normal) {
      await LogHandler.endActivity();
    } else {
      // Force end — activity already has endDate set, just clear state.
      LogHandler.overrunning = false;
      LogHandler.activity = undefined;
    }

    this.matchStarted = false;
  }

  /**
   * Reset internal match tracking state.
   */
  private resetMatchState() {
    this.matchStarted = false;
    this._pendingCombatants = undefined;
  }

  /**
   * Feed a raw log line directly (for testing).
   */
  public feedLine(line: string) {
    this.watcher.handleLogLine(line);
  }
}
