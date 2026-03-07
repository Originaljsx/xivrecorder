import Poller from './Poller';
import FFXIVLogHandler from '../parsing/FFXIVLogHandler';

let testRunning = false;

/**
 * Function to invoke if the user clicks the "run a test" button
 * in the GUI. Simulates a CC match by sending IINACT log lines
 * to the FFXIVLogHandler.
 */
export const runRecordingTest = (
  logHandler: FFXIVLogHandler,
  endTest = true,
) => {
  console.info('[test] User pressed the test button!');

  if (!endTest) {
    console.info(
      '[test] The test will NOT end on its own and needs to be stopped manually.',
    );
  }

  if (testRunning) {
    console.info('[test] Test already running, not starting test.');
    return;
  }

  if (!Poller.getInstance().isFFXIVRunning()) {
    console.info("[test] FFXIV isn't running, not starting test.");
    return;
  }

  console.info('[test] FFXIV is running, starting test.');
  testRunning = true;

  const now = new Date();
  const ts = now.toISOString();

  // Simulate ChangePrimaryPlayer
  const playerLine = `02|${ts}|1032524C|Test Player|def456`;
  logHandler.feedLine(playerLine);

  // Simulate zone change to Cloud Nine (CC arena, territory 1034 = 0x40A)
  const zoneChangeLine = `01|${ts}|40A|Cloud Nine|abc123`;
  logHandler.feedLine(zoneChangeLine);

  // Simulate AddCombatant lines for both teams.
  // Format: 03|ts|entityId|name|jobId(hex)|level|ownerId|worldId|worldName|
  //         npcNameId|npcBaseId|currentHp|maxHp|currentMp|maxMp|?|?|posX|posY|posZ|heading|hash
  // field(15) = posX: positive X = Team Astra, negative X = Team Umbra.
  const combatants = [
    `03|${ts}|1032524C|Test Player|1E|90|0000|28|Excalibur|0|0|60000|60000|10000|10000|||92.33|-88.18|12.00|-0.00|hash1`,
    `03|${ts}|10AAAAAA|Ally One|23|90|0000|28|Excalibur|0|0|58500|58500|10000|10000|||89.15|-88.81|12.00|-0.00|hash2`,
    `03|${ts}|10BBBBBB|Enemy One|19|90|0000|28|Excalibur|0|0|52500|52500|10000|10000|||-87.67|91.82|12.00|-3.14|hash3`,
    `03|${ts}|10CCCCCC|Enemy Two|22|90|0000|28|Excalibur|0|0|61500|61500|10000|10000|||-100.10|89.52|12.00|-3.14|hash4`,
  ];

  combatants.forEach((line) => logHandler.feedLine(line));

  // Simulate match commence (ActorControl 0x40000001, timer=300sec).
  // Format: 33|ts|entityId|command|data0|data1|data2|data3|hash
  const commenceLine = `33|${ts}|80039C5D|40000001|12C|00|00|00|hash5`;
  logHandler.feedLine(commenceLine);

  if (!endTest) {
    return;
  }

  // After 5 seconds, simulate match end.
  setTimeout(() => {
    const endTs = new Date().toISOString();

    // Match end (ActorControl 0x40000002)
    const endLine = `33|${endTs}|80039C5D|40000002|12|00|00|00|hash6`;
    logHandler.feedLine(endLine);

    // Zone change away from CC
    const leaveZoneLine = `01|${endTs}|46|New Gridania|hash7`;
    logHandler.feedLine(leaveZoneLine);

    testRunning = false;
  }, 5 * 1000);
};
