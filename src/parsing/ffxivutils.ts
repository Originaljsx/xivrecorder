/**
 * FFXIV-specific utility functions for log parsing.
 */

import { ccTerritoryIds } from '../main/constants';

/**
 * Check if an entity ID belongs to a player character.
 * Player entity IDs have the form 10xxxxxx.
 */
export function isPlayerEntity(entityId: string): boolean {
  return entityId.length === 8 && entityId.startsWith('10');
}

/**
 * Check if an entity ID belongs to an enemy/NPC.
 * Enemy entity IDs have the form 40xxxxxx.
 */
export function isEnemyEntity(entityId: string): boolean {
  return entityId.length === 8 && entityId.startsWith('40');
}

/**
 * Check if a territory/zone ID corresponds to a Crystalline Conflict arena.
 */
export function isCCTerritory(zoneId: number): boolean {
  return ccTerritoryIds.has(zoneId);
}

/** BNpcName row ID of the Tactical Crystal (language independent). */
export const TACTICAL_CRYSTAL_NAME_ID = 11350;

/**
 * Check if an AddCombatant line describes the Tactical Crystal. Prefer the
 * npcNameId (stable across client languages) and fall back to the English
 * name for older logs / test fixtures.
 */
export function isTacticalCrystal(npcNameId: number, name: string): boolean {
  return npcNameId === TACTICAL_CRYSTAL_NAME_ID || name === 'Tactical Crystal';
}

/** A 2D point on the arena floor (log X/Y; log Z is height). */
export type Point2 = { x: number; y: number };

/**
 * Result of splitting the players into their two spawn groups.
 *
 * Team IDs are relative: 1 is the local player's team, 2 is the enemy team.
 * The log has no signal for which side is Astra/Umbra, so we don't pretend
 * to know. PvpStatsLink can later relabel them with real team names.
 */
export type SpawnTeams = {
  teamById: Map<string, number>;
  friendlyCentroid: Point2;
  enemyCentroid: Point2;
};

function centroid(points: Point2[]): Point2 {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function dist2(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Split players into two teams by their spawn positions.
 *
 * In Crystalline Conflict both teams are confined to their own base until the
 * match commences, so at zone-in every player sits in one of two tight
 * clusters at opposite ends of the lane. We seed one cluster with the local
 * player and the other with the player furthest from them, then run a couple
 * of k-means passes to settle the centroids.
 *
 * Returns undefined if there's no local player position to anchor on or
 * fewer than two players.
 */
export function assignTeamsBySpawn(
  positions: Map<string, Point2>,
  localEntityId: string | undefined,
): SpawnTeams | undefined {
  if (!localEntityId) return undefined;
  const local = positions.get(localEntityId);
  if (!local || positions.size < 2) return undefined;

  // Seed: local player vs furthest player.
  let enemySeed: Point2 | undefined;
  let bestDist = -1;
  positions.forEach((p, id) => {
    if (id === localEntityId) return;
    const d = dist2(p, local);
    if (d > bestDist) {
      bestDist = d;
      enemySeed = p;
    }
  });
  if (!enemySeed) return undefined;

  let friendlyCentroid: Point2 = local;
  let enemyCentroid: Point2 = enemySeed;
  const teamById = new Map<string, number>();

  for (let pass = 0; pass < 3; pass++) {
    const friendly: Point2[] = [];
    const enemy: Point2[] = [];

    positions.forEach((p, id) => {
      // Never let the local player drift to the enemy cluster.
      const isFriendly =
        id === localEntityId ||
        dist2(p, friendlyCentroid) <= dist2(p, enemyCentroid);
      teamById.set(id, isFriendly ? 1 : 2);
      (isFriendly ? friendly : enemy).push(p);
    });

    if (enemy.length === 0) break;
    friendlyCentroid = centroid(friendly);
    enemyCentroid = centroid(enemy);
  }

  return { teamById, friendlyCentroid, enemyCentroid };
}

/**
 * Assign a single late-arriving player to the nearest spawn centroid.
 */
export function teamForPosition(p: Point2, teams: SpawnTeams): number {
  return dist2(p, teams.friendlyCentroid) <= dist2(p, teams.enemyCentroid)
    ? 1
    : 2;
}

/**
 * Project a crystal position onto the lane axis.
 *
 * The lane runs from the friendly spawn to the enemy spawn; the crystal
 * starts at the midpoint. Positive values mean the crystal has been pushed
 * towards the enemy goal (the local player's team is winning progress),
 * negative values mean the enemy has pushed it towards our goal.
 *
 * Returned in the same units as the arena coordinates.
 */
export function crystalProgressAlongLane(
  crystal: Point2,
  teams: SpawnTeams,
): number {
  const ax = teams.enemyCentroid.x - teams.friendlyCentroid.x;
  const ay = teams.enemyCentroid.y - teams.friendlyCentroid.y;
  const len = Math.hypot(ax, ay);
  if (len === 0) return 0;

  const mid = {
    x: (teams.enemyCentroid.x + teams.friendlyCentroid.x) / 2,
    y: (teams.enemyCentroid.y + teams.friendlyCentroid.y) / 2,
  };

  return ((crystal.x - mid.x) * ax + (crystal.y - mid.y) * ay) / len;
}
