import React from 'react';
import { PvpStatsPlayer, PvpStatsTeam, RendererVideo } from 'main/types';

interface IProps {
  video: RendererVideo;
}

const fmt = (n: number | undefined) => {
  if (n === undefined) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return String(n);
};

const fmtTime = (s: number | undefined) => {
  if (s === undefined) return '-';
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

const teamColor = (team: 'Astra' | 'Umbra') =>
  team === 'Astra' ? 'text-sky-300' : 'text-rose-300';

const barColor = (team: 'Astra' | 'Umbra') =>
  team === 'Astra' ? 'bg-sky-400' : 'bg-rose-400';

/**
 * Scoreboard for a Crystalline Conflict recording, using the data imported
 * from the PvpStats plugin. Shown in the side drawer.
 */
const MatchStats = (props: IProps) => {
  const { video } = props;
  const stats = video.pvpStats;
  const localName = video.player?._name;

  if (!stats) {
    return (
      <div className="px-3 py-2 text-xs text-foreground-lighter">
        No PvpStats data linked for this match.
        {video.resultSource && (
          <span> Result source: {video.resultSource}.</span>
        )}
      </div>
    );
  }

  const winner = stats.winner;
  const local = stats.localTeam;
  const won = local && winner === local;

  const renderHeader = () => {
    const astra = stats.teams.Astra?.progress ?? 0;
    const umbra = stats.teams.Umbra?.progress ?? 0;

    return (
      <div className="flex flex-col gap-y-1 px-3 pt-2">
        <div className="flex items-center justify-between text-sm font-bold text-foreground">
          <span>
            {stats.arena ?? video.zoneName}
            {stats.matchType ? ` · ${stats.matchType}` : ''}
            {stats.isOvertime ? ' · OT' : ''}
          </span>
          <span className={won ? 'text-green-400' : 'text-red-400'}>
            {local ? (won ? 'WIN' : 'LOSS') : winner}
          </span>
        </div>
        <div className="flex items-center gap-x-2 text-xs text-foreground">
          <span className={`w-14 text-right ${teamColor('Astra')}`}>
            {astra.toFixed(1)}%
          </span>
          <div className="flex flex-1 h-2 rounded bg-background overflow-hidden">
            <div
              className={barColor('Astra')}
              style={{ width: `${astra / 2}%` }}
            />
            <div className="flex-1" />
            <div
              className={barColor('Umbra')}
              style={{ width: `${umbra / 2}%` }}
            />
          </div>
          <span className={`w-14 ${teamColor('Umbra')}`}>
            {umbra.toFixed(1)}%
          </span>
        </div>
        {stats.rankBefore && stats.rankBefore.tier !== 'None' && (
          <div className="text-xs text-foreground-lighter">
            Rank: {stats.rankBefore.tier} {stats.rankBefore.riser}★
            {stats.rankBefore.stars} ({stats.rankBefore.credit}) →{' '}
            {stats.rankAfter?.tier} {stats.rankAfter?.riser}★
            {stats.rankAfter?.stars} ({stats.rankAfter?.credit})
          </div>
        )}
      </div>
    );
  };

  const renderPlayer = (p: PvpStatsPlayer) => {
    const isLocal = p.name === localName;
    return (
      <tr
        key={`${p.name} ${p.world}`}
        className={isLocal ? 'bg-background font-bold' : ''}
      >
        <td className="px-1 py-[1px] text-left whitespace-nowrap">
          <span className="text-foreground-lighter mr-1">{p.job}</span>
          <span className="truncate">{p.name}</span>
        </td>
        <td className="px-1 text-right">{p.kills ?? '-'}</td>
        <td className="px-1 text-right">{p.deaths ?? '-'}</td>
        <td className="px-1 text-right">{p.assists ?? '-'}</td>
        <td className="px-1 text-right">{fmt(p.damageDealt)}</td>
        <td className="px-1 text-right">{fmt(p.damageTaken)}</td>
        <td className="px-1 text-right">{fmt(p.hpRestored)}</td>
        <td className="px-1 text-right">{fmtTime(p.timeOnCrystal)}</td>
      </tr>
    );
  };

  const renderTeam = (name: 'Astra' | 'Umbra', team: PvpStatsTeam | undefined) => {
    if (!team) return null;
    const isLocalTeam = local === name;

    return (
      <div key={name} className="px-2">
        <div
          className={`flex items-center justify-between text-xs font-bold px-1 pt-2 ${teamColor(name)}`}
        >
          <span>
            {name}
            {isLocalTeam ? ' (you)' : ''}
            {winner === name ? ' · winner' : ''}
          </span>
          <span className="text-foreground-lighter font-normal">
            {team.kills ?? '-'} / {team.deaths ?? '-'} / {team.assists ?? '-'}
          </span>
        </div>
        <table className="w-full text-[11px] text-foreground">
          <thead className="text-foreground-lighter">
            <tr>
              <th className="px-1 text-left font-normal">Player</th>
              <th className="px-1 text-right font-normal">K</th>
              <th className="px-1 text-right font-normal">D</th>
              <th className="px-1 text-right font-normal">A</th>
              <th className="px-1 text-right font-normal">Dmg</th>
              <th className="px-1 text-right font-normal">Taken</th>
              <th className="px-1 text-right font-normal">Heal</th>
              <th className="px-1 text-right font-normal">Crystal</th>
            </tr>
          </thead>
          <tbody>{team.players.map(renderPlayer)}</tbody>
        </table>
      </div>
    );
  };

  // Show the local player's team first.
  const order: ('Astra' | 'Umbra')[] =
    local === 'Umbra' ? ['Umbra', 'Astra'] : ['Astra', 'Umbra'];

  return (
    <div className="flex flex-col w-full pb-2">
      {renderHeader()}
      {order.map((t) => renderTeam(t, stats.teams[t]))}
    </div>
  );
};

export default MatchStats;
