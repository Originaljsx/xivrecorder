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

/**
 * Determine team from spawn X position in CC.
 * Positive X = Team Astra, Negative X = Team Umbra.
 */
export function getTeamFromPosition(posX: number): number {
  return posX >= 0 ? 1 : 2; // 1 = Astra, 2 = Umbra
}
