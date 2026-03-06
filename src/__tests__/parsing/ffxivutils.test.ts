import {
  isPlayerEntity,
  isEnemyEntity,
  isCCTerritory,
  getTeamFromPosition,
} from '../../parsing/ffxivutils';

describe('ffxivutils', () => {
  describe('isPlayerEntity', () => {
    it('returns true for player entity IDs (10xxxxxx)', () => {
      expect(isPlayerEntity('1032524C')).toBe(true);
      expect(isPlayerEntity('103199CA')).toBe(true);
      expect(isPlayerEntity('10000000')).toBe(true);
    });

    it('returns false for NPC entity IDs (40xxxxxx)', () => {
      expect(isPlayerEntity('40000724')).toBe(false);
      expect(isPlayerEntity('4000E39A')).toBe(false);
    });

    it('returns false for other IDs', () => {
      expect(isPlayerEntity('E0000000')).toBe(false);
      expect(isPlayerEntity('80039C5D')).toBe(false);
      expect(isPlayerEntity('')).toBe(false);
    });
  });

  describe('isEnemyEntity', () => {
    it('returns true for enemy entity IDs (40xxxxxx)', () => {
      expect(isEnemyEntity('40000724')).toBe(true);
      expect(isEnemyEntity('4000E39A')).toBe(true);
    });

    it('returns false for player entity IDs', () => {
      expect(isEnemyEntity('1032524C')).toBe(false);
    });
  });

  describe('isCCTerritory', () => {
    it('returns true for ranked/casual CC territories', () => {
      expect(isCCTerritory(1032)).toBe(true); // The Palaistra
      expect(isCCTerritory(1033)).toBe(true); // The Volcanic Heart
      expect(isCCTerritory(1034)).toBe(true); // Cloud Nine
      expect(isCCTerritory(1116)).toBe(true); // Clockwork Castletown
      expect(isCCTerritory(1138)).toBe(true); // The Red Sands
      expect(isCCTerritory(1293)).toBe(true); // Bayside Battleground
    });

    it('returns true for custom CC territories', () => {
      expect(isCCTerritory(1058)).toBe(true);
      expect(isCCTerritory(1059)).toBe(true);
      expect(isCCTerritory(1060)).toBe(true);
      expect(isCCTerritory(1117)).toBe(true);
      expect(isCCTerritory(1139)).toBe(true);
      expect(isCCTerritory(1294)).toBe(true);
    });

    it('returns false for non-CC zones', () => {
      expect(isCCTerritory(132)).toBe(false); // New Gridania (0x84)
      expect(isCCTerritory(152)).toBe(false); // East Shroud (0x98)
      expect(isCCTerritory(0)).toBe(false);
    });
  });

  describe('getTeamFromPosition', () => {
    it('returns team 1 (Astra) for positive X', () => {
      expect(getTeamFromPosition(92.33)).toBe(1);
      expect(getTeamFromPosition(89.15)).toBe(1);
      expect(getTeamFromPosition(0)).toBe(1); // Zero is Astra
    });

    it('returns team 2 (Umbra) for negative X', () => {
      expect(getTeamFromPosition(-87.67)).toBe(2);
      expect(getTeamFromPosition(-90.85)).toBe(2);
      expect(getTeamFromPosition(-0.01)).toBe(2);
    });
  });
});
