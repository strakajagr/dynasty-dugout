// src/components/player/PlayerOverviewTab.js - FIXED WITH COLOR SERVICE
import React from 'react';
import { dynastyTheme } from '../../services/colorService';

const PlayerOverviewTab = ({ player, leagueStats, rollingStats, isPitcher }) => {
  const formatStat = (value, decimals = 3) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (decimals === 0) return Math.floor(value).toString();
      return value.toFixed(decimals);
    }
    return value;
  };

  // Use either leagueStats or stats from player object
  const stats = leagueStats || player?.stats_current || player;
  const last14Days = rollingStats || player?.last_14_days || player?.stats_prior;

  if (!stats) {
    return (
      <div>
        <h3 className={dynastyTheme.components.heading.h3}>
          2025 Season Overview
        </h3>
        <p className={dynastyTheme.classes.text.neutralLight}>No season statistics available</p>
      </div>
    );
  }

  const statCards = isPitcher ? [
    { label: 'Games', value: stats.games_played || stats.games || 0 },
    { label: 'Innings', value: formatStat(stats.innings_pitched || stats.ip, 1) },
    { label: 'ERA', value: formatStat(stats.era, 2) },
    { label: 'WHIP', value: formatStat(stats.whip, 3) },
    { label: 'Wins', value: stats.wins || stats.w || 0 },
    { label: 'Saves', value: stats.saves || stats.sv || stats.s || 0 },
    { label: 'Strikeouts', value: stats.strikeouts_pitched || stats.strikeouts || stats.k || 0 },
    { label: 'Quality Starts', value: stats.quality_starts || stats.qs || 0 }
  ] : [
    { label: 'Games', value: stats.games_played || stats.games || 0 },
    { label: 'AVG', value: formatStat(stats.batting_avg || stats.avg, 3) },
    { label: 'Home Runs', value: stats.home_runs || stats.hr || 0 },
    { label: 'RBIs', value: stats.rbi || stats.rbis || 0 },
    { label: 'Runs', value: stats.runs || stats.r || 0 },
    { label: 'Stolen Bases', value: stats.stolen_bases || stats.sb || 0 },
    { label: 'OBP', value: formatStat(stats.obp, 3) },
    { label: 'OPS', value: formatStat(stats.ops, 3) }
  ];

  return (
    <div>
      <h3 className={dynastyTheme.components.heading.h3}>
        2025 Season Overview (League Database)
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {statCards.map(({ label, value }) => (
          <div key={label} className={dynastyTheme.components.statCard.container}>
            <div className={dynastyTheme.components.statCard.value}>
              {value}
            </div>
            <div className={dynastyTheme.components.statCard.label}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Last 14 Days if available */}
      {last14Days && (
        <div className="mt-8">
          <h4 className={dynastyTheme.components.heading.h4}>
            Last 14 Days Performance (Rolling Stats)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {isPitcher ? [
              { label: 'Games', value: last14Days.games_played || last14Days.games || 0 },
              { label: 'ERA', value: formatStat(last14Days.era, 2) },
              { label: 'WHIP', value: formatStat(last14Days.whip, 3) },
              { label: 'Wins', value: last14Days.wins || 0 },
              { label: 'Strikeouts', value: last14Days.strikeouts_pitched || last14Days.strikeouts || 0 },
              { label: 'Innings', value: formatStat(last14Days.innings_pitched || last14Days.ip, 1) }
            ] : [
              { label: 'Games', value: last14Days.games_played || last14Days.games || 0 },
              { label: 'AVG', value: formatStat(last14Days.avg || last14Days.batting_avg, 3) },
              { label: 'HR', value: last14Days.home_runs || last14Days.hr || 0 },
              { label: 'RBI', value: last14Days.rbi || 0 },
              { label: 'Runs', value: last14Days.runs || last14Days.r || 0 },
              { label: 'SB', value: last14Days.stolen_bases || last14Days.sb || 0 }
            ].map(({ label, value }) => (
              <div key={label} className={dynastyTheme.components.statCard.container}>
                <div className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
                  {value}
                </div>
                <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerOverviewTab;