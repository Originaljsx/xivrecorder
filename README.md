# XIV Recorder

XIV Recorder is a desktop screen recorder for Final Fantasy XIV. It watches IINACT log files for combat events, automatically records them, and presents a user interface to review your recordings.

It currently supports recording:
- **Crystalline Conflict** (CC) PvP matches
- **Savage & Ultimate** raid boss pulls (each pull is a separate recording)

## Credits

This project is built on top of [Warcraft Recorder](https://github.com/aza547/wow-recorder) by [aza547](https://github.com/aza547), adapted for FFXIV with permission. The OBS-based recording engine and UI framework come from that project. Thank you to aza547 and all wow-recorder contributors for making this possible.

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

### 3. Configure XIV Recorder

1. Launch XIV Recorder and click the **Settings** button.
2. Create a folder on your PC to store recordings.
3. Set the **Storage Path** to the folder you created.
4. Set the **IINACT Log Path** to your IINACT log directory (default: `Documents\IINACT`).
5. Enable the content types you want to record (Crystalline Conflict, Raids).
6. Click the **Scene** button to configure OBS recording settings:
   - Select your desired output resolution.
   - Add your speakers and/or microphone if you want audio.
   - Select a hardware encoder if available (recommended for performance).

### 4. Testing It Works

With FFXIV running and XIV Recorder configured, you can test recording by clicking the test icon. This runs a short test of the recording function.

## Supported Content

| Content Type | Support |
|---|---|
| Crystalline Conflict (Ranked/Casual/Custom) | Yes |
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
- Tracks player teams, deaths, and match result (win/loss via Tactical Crystal position)

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

This project is adapted from [wow-recorder](https://github.com/aza547/wow-recorder). The recording functionality is powered by [OBS](https://obsproject.com/) via the [noobs](https://github.com/niclas-AE/noobs) native Node.js bindings.
