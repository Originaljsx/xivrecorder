# XIV Recorder

XIV Recorder is a desktop screen recorder for Final Fantasy XIV. It watches IINACT log files for combat events, automatically records them, and presents a user interface to review your recordings.

It currently supports recording:
- **Crystalline Conflict** (CC) PvP matches
- **Savage & Ultimate** raid boss pulls (each pull is a separate recording)

## Important

- **FFXIV does not have built-in combat logging.** XIV Recorder relies on a third-party parser (IINACT or ACT) to generate log files that it reads from. You must have one of these installed and running for XIV Recorder to work.
- **XIV Recorder must be open before you enter the instance.** It needs to be running and watching for log events when you zone in, otherwise it will miss the zone change and duty commence events needed to start recording.

## How to Use

### 1. Download & Install

Download and run the most recent XIV Recorder installer from the [Releases](https://github.com/Originaljsx/xivrecorder/releases) page.

### 2. Set Up IINACT (Log Parser)

Since FFXIV has no native combat log, you need a third-party parser to generate log files for XIV Recorder to read. IINACT is the recommended option — it runs as a Dalamud plugin inside the game and writes network log files that XIV Recorder monitors for combat events.

#### Get set up with Dalamud

Before you can install IINACT, you need Dalamud set up and installed.

- **Windows**: Use [XIVLauncher](https://goatcorp.github.io/)
- **macOS**: Use [XIV on Mac](https://www.xivmac.com/)
- **Linux / Steam Deck**: Use [XIVLauncher.Core](https://github.com/goatcorp/XIVLauncher.Core)

#### Add the IINACT repository

IINACT is a third-party Dalamud plugin. To install it, you need to add its plugin repository.

1. Open Final Fantasy XIV and verify Dalamud has loaded (the Dalamud logo appears in the top left corner of the title screen).
2. Hover over the Dalamud icon and click **Plugin Installer**, then click **Settings**.
3. Navigate to the **Experimental** tab and scroll to **Custom Plugin Repositories**.
4. Paste the following URL into an available text field:
   ```
   https://raw.githubusercontent.com/marzent/IINACT/main/repo.json
   ```
5. Click **+**, then click the **Save** (diskette) icon.
6. Ensure the **Enabled** checkbox next to IINACT is ticked.

#### Install and enable IINACT

1. Close Settings and go back to **Plugin Installer**. It should refresh automatically.
2. Search for **IINACT** and click to install it.
3. IINACT should now be installed and enabled.

#### Configure IINACT logging

1. Run the `/iinact` command in the FFXIV chat to open IINACT settings.
2. **Change the logging filter from None to Party.** This is required for XIV Recorder to detect combat events.

For more details, see the [IINACT installation guide](https://www.iinact.com/installation/).

> **Alternative**: You can also use [ACT](https://advancedcombattracker.com/) with the OverlayPlugin as a third-party alternative to IINACT via Dalamud.

If you run into IINACT issues, report them at: https://github.com/marzent/IINACT

### 2b. (Optional, recommended) Install PvpStats for CC results & scoreboards

The IINACT log has no reliable win/loss signal for Crystalline Conflict. If you also run the
[PvpStats](https://github.com/wrath16/PvpStats) Dalamud plugin, XIV Recorder imports the
official result and the full end-of-match scoreboard into every CC recording.

1. Run `/xlplugins` in the FFXIV chat, search for **PvpStats** and install it. It is on the
   official Dalamud plugin list, so no extra repository is needed.
2. Keep it enabled while you play. PvpStats saves every CC match to its own database on your PC.
3. That's it. XIV Recorder finds the PvpStats database automatically and links each recording
   to its match a few seconds after the video is saved. Nothing to configure, no extra plugin
   from XIV Recorder itself. You can turn this off in **Settings → Import PvpStats results**.

### 3. Configure XIV Recorder

1. Launch XIV Recorder and click the **Settings** button.
2. Create a folder on your PC to store recordings.
3. Set the **Storage Path** to the folder you created.
4. Check the **IINACT Log Path**. XIV Recorder detects your IINACT log directory on first launch
   (including a OneDrive-redirected Documents folder) and warns you if the configured folder has
   no `Network_*.log` files but IINACT is writing somewhere else.
5. Enable the content types you want to record (Crystalline Conflict, Raids).
6. Click the **Scene** button to configure OBS recording settings:
   - Select your desired output resolution.
   - Set up audio (see [Audio](#audio) below).
   - Select a hardware encoder if available (recommended for performance, see
     [Video quality and file size](#video-quality-and-file-size)).

### Audio

On the **Scene** page, under **Audio**, add one or more sources:

| Source | Records |
|---|---|
| **FFXIV Game Audio** | Only the sound from Final Fantasy XIV. Discord, music and notifications are left out. Works even if the game isn't running yet. Needs Windows 10 (2004) or newer. |
| **Speaker** | Everything your PC plays (game, Discord, music, ...). |
| **Microphone** | Your voice. Supports push to talk, noise suppression and forcing mono. |
| **Application** | Any other single program, e.g. Discord only. |

For game sound only, remove the Speaker source and add **FFXIV Game Audio**. For game sound plus
your voice, add **FFXIV Game Audio** and a **Microphone**.

Each source can be routed to any of six audio **tracks** in the recording. Track 1 is what you
hear when playing back in XIV Recorder (and in most players), so keep every source you want to
hear on track 1. The other tracks are handy in a video editor, e.g. put the game on tracks 1 and
2 and your microphone on tracks 1 and 3 to get a full mix plus separate game and voice tracks.

### Video quality and file size

- **Encoder**: hardware encoders (NVIDIA, AMD, Intel) barely affect your in-game FPS and are
  strongly recommended. **H.265 (HEVC)** and **AV1** produce noticeably smaller files than
  H.264 at the same quality; they need **Hardware Rendering** enabled (Settings → Application)
  to play back inside XIV Recorder. The wand button picks a sensible default for your PC.
- **FPS**: 60 gives smooth playback; 30 roughly halves file size and encoder load.
- **Quality**: High is a good balance. Each step down saves a good chunk of disk space.
- **Max Disk Storage**: the oldest unlocked recordings are deleted automatically to stay under
  the limit. Lock a recording (padlock button) to keep it forever.

Each recording's metadata stores the encoder used and the file size, which makes it easy to
compare settings.

### 4. Testing It Works

With FFXIV running and XIV Recorder configured, you can test recording by clicking the test icon. This runs a short test of the recording function.

### 5. Viewing a CC recording's stats

Select a Crystalline Conflict recording and open the side panel (arrow button at the top right of
the video page). If the match was linked to PvpStats you'll see the arena, match type, win/loss,
the Astra/Umbra crystal progress, your rank change (ranked only) and both teams' scoreboards:
job, kills, deaths, assists, damage dealt, damage taken, healing and time on the crystal. Your
own row is highlighted and your team is listed first.

## Supported Content

| Content Type | Support |
|---|---|
| Crystalline Conflict (Ranked/Casual/Custom) | Yes |
| CC scoreboard via PvpStats | Yes (optional plugin) |
| Savage Raids | Yes |
| Ultimate Raids | Yes |
| Normal Raids | No |
| Dungeons | No |
| Trials | No |

## Supported Platforms

| OS | Support |
|---|---|
| Windows | Yes |
| Mac | No |
| Linux | No |

## How It Works

### Crystalline Conflict
- Detects zone entry into a CC arena
- Records from match start (ActorControl COMMENCE) through match end
- Teams are derived from spawn positions: everyone in your base at zone-in is your team
- Match result, in order of preference:
  1. **PvpStats link** (recommended, see below): the official result and teams straight from
     the game's own end-of-match data, as captured by PvpStats.
  2. **Tactical Crystal push**: without PvpStats, the crystal's position is tracked along the
     lane between the two spawns and whichever team pushed it furthest towards the enemy goal
     wins. This is the game's own time-out rule. It is right on every decisive match, but on a
     dead-even game (progress within about 0.1) it can go either way, and a true tie decided by
     tiebreaker can't be resolved from the log at all. When PvpStats data arrives it overrides
     this guess.
  3. If neither is available the recording is tagged as a loss with `resultSource: unknown` in
     its metadata.
- Every recording's metadata records which method produced its result (`resultSource`:
  `pvpstats`, `crystal` or `unknown`).

### PvpStats integration

[PvpStats](https://github.com/wrath16/PvpStats) is a Dalamud plugin that records every CC match
(result, teams, per-player stats) into a local LiteDB database at
`%APPDATA%\XIVLauncher\pluginConfigs\PvpStats\data.db`. XIV Recorder reads that database, so
no in-game plugin other than IINACT and PvpStats is required.

How the link works:

1. **Export.** XIV Recorder ships a small self-contained helper, `pvpstats-export.exe`
   (source in `tools/pvpstats-export`, .NET 8 + LiteDB). It copies `data.db` and its write-ahead
   log to a temp folder, so PvpStats' own lock is never touched and the newest matches are
   included, then exports matches newer than a given time as JSON.
2. **Correlate.** Each CC recording stores the match's COMMENCE time and territory ID. A
   recording is linked to the PvpStats match whose start time is within two minutes on the same
   arena; the closest one wins. Both sides use the same in-game commence event, so in practice
   they agree to within a second.
3. **Apply.** The recording's metadata gets a `pvpStats` block with the arena, match type,
   winner, your team, overtime flag, duration, rank before/after and both teams' player stats.
   The win/loss flag is set from it (`resultSource: pvpstats`), and the recorder's relative
   team numbers are relabelled to the real Astra/Umbra teams by player name.
4. **Timing.** The link runs right after a CC video is saved and retries at 5 s, 20 s, 60 s and
   3 min in case PvpStats hasn't written the match yet. Every start-up also runs a backfill over
   any CC recordings that don't have PvpStats data yet, so older videos get linked when you
   install this version or PvpStats later.
5. **Display.** The side panel on the video page renders the `pvpStats` block as a scoreboard.

The link is on by default and can be disabled in Settings (**Import PvpStats results**). If
PvpStats isn't installed or its database isn't found, XIV Recorder logs why and falls back to
the crystal-push result.

### Savage & Ultimate Raids
- Detects duty instance entry via ActorControl COMMENCE in Savage/Ultimate zones
- Each boss pull is recorded separately (combat start to combat end via InCombat events)
- Includes a 5-second pre-pull buffer and 2-second post-combat overrun
- Detects kill vs wipe via VICTORY/FADE_OUT events
- Pull counter tracks pull numbers within a duty session

## Bug Reports & Suggestions

Please [create an issue](https://github.com/Originaljsx/xivrecorder/issues) if you encounter bugs or have feature suggestions.

## Contributing

If you're interested in contributing, feel free to submit a PR or open an issue to discuss changes.

## Acknowledgements

XIV Recorder started as a fork of Warcraft Recorder by aza547, adapted for FFXIV with
permission. Thank you to its author and contributors. The recording functionality is powered by
[OBS](https://obsproject.com/) via the [noobs](https://www.npmjs.com/package/noobs) native
Node.js bindings.
