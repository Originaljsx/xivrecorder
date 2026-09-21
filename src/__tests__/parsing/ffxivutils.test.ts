import {
  isPlayerEntity,
  isEnemyEntity,
  isCCTerritory,
  isTacticalCrystal,
  assignTeamsBySpawn,
  teamForPosition,
  crystalProgressAlongLane,
  Point2,
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

  describe('isTacticalCrystal', () => {
    it('matches by npcNameId regardless of client language', () => {
      expect(isTacticalCrystal(11350, 'Taktischer Kristall')).toBe(true);
    });

    it('falls back to the English name', () => {
      expect(isTacticalCrystal(0, 'Tactical Crystal')).toBe(true);
    });

    it('rejects other NPCs', () => {
      expect(isTacticalCrystal(1234, 'Striking Dummy')).toBe(false);
    });
  });

  describe('assignTeamsBySpawn', () => {
    // Spawns from the real Cloud Nine fixture: two diagonal clusters.
    const positions = new Map<string, Point2>([
      ['1032524C', { x: 92.33, y: -88.18 }],
      ['103199CA', { x: 89.15, y: -88.81 }],
      ['1035B305', { x: 89.35, y: -86.88 }],
      ['10315A70', { x: 88.34, y: -90.48 }],
      ['100E5E50', { x: 86.06, y: -92.22 }],
      ['10075825', { x: -87.67, y: 91.82 }],
      ['100F8629', { x: -90.85, y: 91.18 }],
      ['1033B03E', { x: -90.65, y: 93.12 }],
      ['102DC29B', { x: -94.8, y: 89.22 }],
      ['1006AE64', { x: -91.66, y: 89.52 }],
    ]);

    it('splits players into the local team (1) and the enemy team (2)', () => {
      const teams = assignTeamsBySpawn(positions, '1032524C');
      expect(teams).toBeDefined();
      const ids = teams!.teamById;
      expect(ids.get('1032524C')).toBe(1);
      expect(ids.get('103199CA')).toBe(1);
      expect(ids.get('100E5E50')).toBe(1);
      expect(ids.get('10075825')).toBe(2);
      expect(ids.get('1006AE64')).toBe(2);
      expect([...ids.values()].filter((t) => t === 1).length).toBe(5);
      expect([...ids.values()].filter((t) => t === 2).length).toBe(5);
    });

    it('is relative to the local player', () => {
      const teams = assignTeamsBySpawn(positions, '10075825');
      expect(teams!.teamById.get('10075825')).toBe(1);
      expect(teams!.teamById.get('1032524C')).toBe(2);
      expect(teams!.friendlyCentroid.x).toBeLessThan(0);
      expect(teams!.enemyCentroid.x).toBeGreaterThan(0);
    });

    it('handles a north-south lane (Palaistra style)', () => {
      const ns = new Map<string, Point2>([
        ['10000001', { x: 1, y: 100 }],
        ['10000002', { x: -2, y: 98 }],
        ['10000003', { x: 0, y: -101 }],
        ['10000004', { x: 3, y: -99 }],
      ]);
      const teams = assignTeamsBySpawn(ns, '10000001');
      expect(teams!.teamById.get('10000002')).toBe(1);
      expect(teams!.teamById.get('10000003')).toBe(2);
      expect(teams!.teamById.get('10000004')).toBe(2);
    });

    it('returns undefined without a local player position', () => {
      expect(assignTeamsBySpawn(positions, undefined)).toBeUndefined();
      expect(assignTeamsBySpawn(positions, 'DEADBEEF')).toBeUndefined();
    });

    it('assigns late arrivals to the nearest cluster', () => {
      const teams = assignTeamsBySpawn(positions, '1032524C')!;
      expect(teamForPosition({ x: 80, y: -80 }, teams)).toBe(1);
      expect(teamForPosition({ x: -80, y: 80 }, teams)).toBe(2);
    });
  });

  describe('crystalProgressAlongLane', () => {
    const teams = {
      teamById: new Map<string, number>(),
      friendlyCentroid: { x: 0, y: -100 },
      enemyCentroid: { x: 0, y: 100 },
    };

    it('is zero at the centre', () => {
      expect(crystalProgressAlongLane({ x: 0, y: 0 }, teams)).toBeCloseTo(0);
    });

    it('is positive towards the enemy goal', () => {
      expect(crystalProgressAlongLane({ x: 0, y: 40 }, teams)).toBeCloseTo(40);
    });

    it('is negative towards our goal', () => {
      expect(crystalProgressAlongLane({ x: 5, y: -60 }, teams)).toBeCloseTo(-60);
    });

    it('ignores movement perpendicular to the lane', () => {
      expect(crystalProgressAlongLane({ x: 30, y: 0 }, teams)).toBeCloseTo(0);
    });
  });
});
