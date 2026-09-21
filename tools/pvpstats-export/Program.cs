// pvpstats-export: dumps Crystalline Conflict matches from the PvpStats
// Dalamud plugin's LiteDB database as JSON, for XIV Recorder.
//
// Usage: pvpstats-export <pvpstats-config-dir> <output.json> [sinceUnixMs]
//
// The database is copied (data.db + data-log.db) to a temp folder before
// opening so we never contend with the plugin's own file handle, and so the
// write-ahead log is applied to the copy rather than the live file.
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using LiteDB;

if (args.Length < 2)
{
    Console.Error.WriteLine("usage: pvpstats-export <pvpstats-dir> <output.json> [sinceUnixMs]");
    return 2;
}

var dir = args[0];
var outFile = args[1];
long sinceMs = args.Length > 2 && long.TryParse(args[2], out var s) ? s : 0;

var src = Path.Combine(dir, "data.db");
if (!File.Exists(src))
{
    Console.Error.WriteLine($"not found: {src}");
    return 3;
}

var temp = Path.Combine(Path.GetTempPath(), "xivrecorder-pvpstats-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(temp);

try
{
    File.Copy(src, Path.Combine(temp, "data.db"));
    var log = Path.Combine(dir, "data-log.db");
    if (File.Exists(log) && new FileInfo(log).Length > 0)
    {
        File.Copy(log, Path.Combine(temp, "data-log.db"));
    }

    var results = new JsonArray();

    using (var db = new LiteDatabase($"Filename={Path.Combine(temp, "data.db")};ReadOnly=false"))
    {
        var col = db.GetCollection("ccmatch");
        foreach (var doc in col.FindAll())
        {
            var match = Convert(doc);
            if (match == null) continue;
            var start = match["matchStart"]?.GetValue<long?>() ?? match["dutyStart"]?.GetValue<long?>() ?? 0;
            if (start < sinceMs) continue;
            results.Add(match);
        }
    }

    File.WriteAllText(outFile, results.ToJsonString(new JsonSerializerOptions { WriteIndented = false }));
    Console.WriteLine($"exported {results.Count} matches");
    return 0;
}
catch (Exception e)
{
    Console.Error.WriteLine(e.ToString());
    return 1;
}
finally
{
    try { Directory.Delete(temp, true); } catch { /* best effort */ }
}

static long? Ms(BsonValue v) => v.IsDateTime ? new DateTimeOffset(v.AsDateTime.ToUniversalTime()).ToUnixTimeMilliseconds() : null;

static string? Alias(BsonValue v)
{
    if (!v.IsDocument) return null;
    var d = v.AsDocument;
    var name = d["Name"].IsString ? d["Name"].AsString : "";
    var world = d["HomeWorld"].IsString ? d["HomeWorld"].AsString : "";
    return string.IsNullOrEmpty(name) ? null : $"{name} {world}".Trim();
}

static JsonObject? Convert(BsonDocument doc)
{
    if (!doc["IsCompleted"].AsBoolean) return null;

    var teams = new JsonObject();
    var postTeams = doc["PostMatch"].IsDocument ? doc["PostMatch"].AsDocument["Teams"] : BsonValue.Null;

    foreach (var teamName in new[] { "Astra", "Umbra" })
    {
        var team = doc["Teams"].IsDocument ? doc["Teams"].AsDocument[teamName] : BsonValue.Null;
        var post = postTeams.IsDocument ? postTeams.AsDocument[teamName] : BsonValue.Null;
        if (!team.IsDocument) continue;

        var players = new JsonArray();
        var statsByAlias = new Dictionary<string, BsonDocument>();

        if (post.IsDocument && post.AsDocument["PlayerStats"].IsArray)
        {
            foreach (var ps in post.AsDocument["PlayerStats"].AsArray)
            {
                if (!ps.IsDocument) continue;
                var a = Alias(ps.AsDocument["Player"]);
                if (a != null) statsByAlias[a] = ps.AsDocument;
            }
        }

        if (team.AsDocument["Players"].IsArray)
        {
            foreach (var p in team.AsDocument["Players"].AsArray)
            {
                if (!p.IsDocument) continue;
                var pd = p.AsDocument;
                var alias = Alias(pd["Alias"]) ?? "";
                var aliasDoc = pd["Alias"].IsDocument ? pd["Alias"].AsDocument : new BsonDocument();
                statsByAlias.TryGetValue(alias, out var st);

                var player = new JsonObject
                {
                    ["name"] = aliasDoc["Name"].IsString ? aliasDoc["Name"].AsString : "",
                    ["world"] = aliasDoc["HomeWorld"].IsString ? aliasDoc["HomeWorld"].AsString : "",
                    ["job"] = pd["Job"].IsString ? pd["Job"].AsString : "",
                    ["jobId"] = pd["ClassJobId"].IsNumber ? pd["ClassJobId"].AsInt32 : 0,
                    ["team"] = teamName,
                };

                if (pd["Rank"].IsDocument)
                {
                    var r = pd["Rank"].AsDocument;
                    player["rankTier"] = r["Tier"].IsString ? r["Tier"].AsString : "None";
                    player["rankRiser"] = r["Riser"].IsNumber ? r["Riser"].AsInt32 : 0;
                }

                if (st != null)
                {
                    player["kills"] = st["Kills"].IsNumber ? st["Kills"].AsInt32 : 0;
                    player["deaths"] = st["Deaths"].IsNumber ? st["Deaths"].AsInt32 : 0;
                    player["assists"] = st["Assists"].IsNumber ? st["Assists"].AsInt32 : 0;
                    player["damageDealt"] = st["DamageDealt"].IsNumber ? st["DamageDealt"].AsInt64 : 0;
                    player["damageTaken"] = st["DamageTaken"].IsNumber ? st["DamageTaken"].AsInt64 : 0;
                    player["hpRestored"] = st["HPRestored"].IsNumber ? st["HPRestored"].AsInt64 : 0;
                    // TimeOnCrystal is a .NET TimeSpan (ticks, 100ns).
                    player["timeOnCrystal"] = st["TimeOnCrystal"].IsNumber ? st["TimeOnCrystal"].AsInt64 / 10_000_000.0 : 0;
                }

                players.Add(player);
            }
        }

        var t = new JsonObject
        {
            ["progress"] = team.AsDocument["Progress"].IsNumber ? team.AsDocument["Progress"].AsDouble : 0,
            ["players"] = players,
        };

        if (post.IsDocument && post.AsDocument["TeamStats"].IsDocument)
        {
            var ts = post.AsDocument["TeamStats"].AsDocument;
            t["kills"] = ts["Kills"].IsNumber ? ts["Kills"].AsInt32 : 0;
            t["deaths"] = ts["Deaths"].IsNumber ? ts["Deaths"].AsInt32 : 0;
            t["assists"] = ts["Assists"].IsNumber ? ts["Assists"].AsInt32 : 0;
            t["damageDealt"] = ts["DamageDealt"].IsNumber ? ts["DamageDealt"].AsInt64 : 0;
            t["damageTaken"] = ts["DamageTaken"].IsNumber ? ts["DamageTaken"].AsInt64 : 0;
            t["hpRestored"] = ts["HPRestored"].IsNumber ? ts["HPRestored"].AsInt64 : 0;
        }

        teams[teamName] = t;
    }

    var o = new JsonObject
    {
        ["id"] = doc["_id"].IsObjectId ? doc["_id"].AsObjectId.ToString() : doc["_id"].ToString(),
        ["dutyStart"] = Ms(doc["DutyStartTime"]),
        ["matchStart"] = Ms(doc["MatchStartTime"]),
        ["matchEnd"] = Ms(doc["MatchEndTime"]),
        ["arena"] = doc["Arena"].IsString ? doc["Arena"].AsString : null,
        ["matchType"] = doc["MatchType"].IsString ? doc["MatchType"].AsString : null,
        ["territoryId"] = doc["TerritoryId"].IsNumber ? doc["TerritoryId"].AsInt32 : 0,
        ["winner"] = doc["MatchWinner"].IsString ? doc["MatchWinner"].AsString : "Unknown",
        ["localPlayer"] = Alias(doc["LocalPlayer"]),
        ["isOvertime"] = doc["IsOvertime"].IsBoolean && doc["IsOvertime"].AsBoolean,
        ["teams"] = teams,
    };

    if (doc["PostMatch"].IsDocument)
    {
        var pm = doc["PostMatch"].AsDocument;
        if (pm["MatchDuration"].IsNumber) o["duration"] = pm["MatchDuration"].AsInt64 / 10_000_000.0;
        foreach (var (key, field) in new[] { ("rankBefore", "RankBefore"), ("rankAfter", "RankAfter") })
        {
            if (!pm[field].IsDocument) continue;
            var r = pm[field].AsDocument;
            o[key] = new JsonObject
            {
                ["tier"] = r["Tier"].IsString ? r["Tier"].AsString : "None",
                ["riser"] = r["Riser"].IsNumber ? r["Riser"].AsInt32 : 0,
                ["stars"] = r["Stars"].IsNumber ? r["Stars"].AsInt32 : 0,
                ["credit"] = r["Credit"].IsNumber ? r["Credit"].AsInt32 : 0,
            };
        }
    }

    // Local player's team, derived from the roster.
    var local = o["localPlayer"]?.GetValue<string>();
    if (local != null)
    {
        foreach (var teamName in new[] { "Astra", "Umbra" })
        {
            if (teams[teamName]?["players"] is JsonArray arr &&
                arr.Any(p => $"{p?["name"]} {p?["world"]}".Trim() == local))
            {
                o["localTeam"] = teamName;
            }
        }
    }

    return o;
}
