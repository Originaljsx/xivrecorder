import CCMatch from '../../activitys/CCMatch';
import Combatant from '../../main/Combatant';

describe('CCMatch', () => {
  it('creates a match with correct arena name', () => {
    const match = new CCMatch(new Date(), 1034);
    expect(match.zoneName).toBe('Cloud Nine');
    expect(match.category).toBe('Crystalline Conflict');
  });

  it('identifies ranked vs custom matches', () => {
    const ranked = new CCMatch(new Date(), 1034);
    expect(ranked.isCustom).toBe(false);

    const custom = new CCMatch(new Date(), 1060);
    expect(custom.isCustom).toBe(true);
  });

  it('generates correct file name', () => {
    const match = new CCMatch(new Date(), 1034);
    match.playerEntityId = '1032524C';

    const player = new Combatant('1032524C');
    player.name = 'Hinanawi Tenshi';
    player.jobId = 0x1e;
    player.teamId = 1;
    match.addCombatant(player);

    expect(match.getFileName()).toBe(
      'Hinanawi Tenshi - Cloud Nine - CC Match',
    );
  });

  it('generates correct file name for custom match', () => {
    const match = new CCMatch(new Date(), 1060);
    match.playerEntityId = '1032524C';

    const player = new Combatant('1032524C');
    player.name = 'Hinanawi Tenshi';
    match.addCombatant(player);

    expect(match.getFileName()).toBe(
      'Hinanawi Tenshi - Cloud Nine - Custom CC',
    );
  });

  it('computes match duration', () => {
    const start = new Date('2026-03-06T10:32:24.786-08:00');
    const end = new Date('2026-03-06T10:34:51.508-08:00');

    const match = new CCMatch(start, 1034);
    match.end(end, true);

    // ~146.7 seconds + 3 second overrun
    expect(match.duration).toBeGreaterThan(146);
    expect(match.duration).toBeLessThan(150);
  });

  it('tracks player deaths', () => {
    const match = new CCMatch(new Date(), 1034);
    match.addDeath({
      name: 'Amimi Ami',
      timestamp: new Date(),
      killerName: 'Hinanawi Tenshi',
    });

    expect(match.deaths.length).toBe(1);
    expect(match.deaths[0].name).toBe('Amimi Ami');
    expect(match.deaths[0].killerName).toBe('Hinanawi Tenshi');
  });

  it('generates metadata with all fields', () => {
    const start = new Date('2026-03-06T10:32:24.786-08:00');
    const end = new Date('2026-03-06T10:34:51.508-08:00');

    const match = new CCMatch(start, 1034);
    match.playerEntityId = '1032524C';

    const player = new Combatant('1032524C');
    player.name = 'Hinanawi Tenshi';
    player.jobId = 0x1e;
    player.teamId = 1;
    player.worldName = 'Fenrir';
    match.addCombatant(player);

    match.end(end, true);

    const meta = match.getMetadata();
    expect(meta.category).toBe('Crystalline Conflict');
    expect(meta.zoneName).toBe('Cloud Nine');
    expect(meta.zoneID).toBe(1034);
    expect(meta.combatants.length).toBe(1);
    expect(meta.player?._entityId).toBe('1032524C');
    expect(meta.player?._name).toBe('Hinanawi Tenshi');
    expect(meta.duration).toBeGreaterThan(0);
    expect(meta.uniqueHash).toBeDefined();
  });

  it('maps all CC territories to arena names', () => {
    const territories = [
      { id: 1032, name: 'The Palaistra' },
      { id: 1033, name: 'The Volcanic Heart' },
      { id: 1034, name: 'Cloud Nine' },
      { id: 1116, name: 'Clockwork Castletown' },
      { id: 1138, name: 'The Red Sands' },
      { id: 1293, name: 'Bayside Battleground' },
      // Custom variants
      { id: 1058, name: 'The Palaistra' },
      { id: 1059, name: 'The Volcanic Heart' },
      { id: 1060, name: 'Cloud Nine' },
      { id: 1117, name: 'Clockwork Castletown' },
      { id: 1139, name: 'The Red Sands' },
      { id: 1294, name: 'Bayside Battleground' },
    ];

    for (const { id, name } of territories) {
      const match = new CCMatch(new Date(), id);
      expect(match.zoneName).toBe(name);
    }
  });
});
