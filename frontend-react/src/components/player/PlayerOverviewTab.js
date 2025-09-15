// src/components/player/PlayerOverviewTab.js - USES BACKEND FIELD NAMES
import React from 'react';
import { dynastyTheme } from '../../services/colorService';
import { getCurrentSeason } from '../../utils/seasonUtils';

const PlayerOverviewTab = ({ player, season_stats, rolling_14_day, isPitcher }) => {
  // Get current season from utility
  const currentSeason = getCurrentSeason();
  
  // More robust formatStat that handles all edge cases
  const formatStat = (value, decimals = 3) => {
    // Handle null/undefined
    if (value === null || value === undefined) return '-';
    
    // Handle objects - extract value if possible
    if (typeof value === 'object' && value !== null) {
      console.log('formatStat received object:', value);
      
      // If it has a 'value' property, use that
      if ('value' in value) {
        return formatStat(value.value, decimals);
      }
      
      // If it has a 'label' property, it's the wrong structure
      if ('label' in value) {
        console.error('formatStat received label/value object, returning dash');
        return '-';
      }
      
      // For any other object, return dash
      return '-';
    }
    
    // Handle numbers
    if (typeof value === 'number') {
      if (decimals === 0) return Math.floor(value).toString();
      return value.toFixed(decimals);
    }
    
    // Handle strings that might be numbers
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        if (decimals === 0) return Math.floor(num).toString();
        return num.toFixed(decimals);
      }
    }
    
    // Return string values as-is
    return String(value);
  };

  // Helper to safely get a stat value from potentially nested structure
  const getStat = (stats, statName, isPitcher) => {
    if (!stats) return null;
    
    // For pitchers, check nested pitching object first
    if (isPitcher && stats.pitching && statName !== 'games_played' && statName !== 'games') {
      // Look in pitching sub-object for pitcher-specific stats
      if (stats.pitching[statName] !== undefined) {
        return stats.pitching[statName];
      }
    }
    
    // Check top level
    if (stats[statName] !== undefined) {
      return stats[statName];
    }
    
    // Check alternate names
    const alternates = {
      'innings_pitched': ['ip'],
      'batting_avg': ['avg'],
      'home_runs': ['hr'],
      'stolen_bases': ['sb'],
      'strikeouts_pitched': ['strikeouts', 'k'],
      'wins': ['w'],
      'saves': ['sv', 's'],
      'quality_starts': ['qs'],
      'rbi': ['rbis'],
      'runs': ['r']
    };
    
    if (alternates[statName]) {
      for (const alt of alternates[statName]) {
        if (stats[alt] !== undefined) return stats[alt];
        if (isPitcher && stats.pitching && stats.pitching[alt] !== undefined) {
          return stats.pitching[alt];
        }
      }
    }
    
    return null;
  };

  // Use BACKEND field names
  const stats = season_stats || player?.stats_current || player;
  const last14Days = rolling_14_day || player?.last_14_days || player?.stats_prior;

  // Debug logging
  console.log('PlayerOverviewTab received season_stats:', season_stats);
  console.log('PlayerOverviewTab received rolling_14_day:', rolling_14_day);
  console.log('Is pitcher?', isPitcher);
  if (stats?.pitching) {
    console.log('Found nested pitching object:', stats.pitching);
  }

  if (!stats) {
    return (
      <div>
        <h3 className={dynastyTheme.components.heading.h3}>
          {currentSeason} Season Overview
        </h3>
        <p className={dynastyTheme.classes.text.neutralLight}>No season statistics available</p>
      </div>
    );
  }

  // Build stat cards with safe stat extraction
  const statCards = isPitcher ? [
    { label: 'Games', value: formatStat(getStat(stats, 'games_played', isPitcher) || getStat(stats, 'games', isPitcher) || 0, 0) },
    { label: 'Innings', value: formatStat(getStat(stats, 'innings_pitched', isPitcher), 1) },
    { label: 'ERA', value: formatStat(getStat(stats, 'era', isPitcher), 2) },
    { label: 'WHIP', value: formatStat(getStat(stats, 'whip', isPitcher), 3) },
    { label: 'Wins', value: formatStat(getStat(stats, 'wins', isPitcher) || 0, 0) },
    { label: 'Saves', value: formatStat(getStat(stats, 'saves', isPitcher) || 0, 0) },
    { label: 'Strikeouts', value: formatStat(getStat(stats, 'strikeouts_pitched', isPitcher) || 0, 0) },
    { label: 'Quality Starts', value: formatStat(getStat(stats, 'quality_starts', isPitcher) || 0, 0) }
  ] : [
    { label: 'Games', value: formatStat(getStat(stats, 'games_played', isPitcher) || getStat(stats, 'games', isPitcher) || 0, 0) },
    { label: 'AVG', value: formatStat(getStat(stats, 'batting_avg', isPitcher), 3) },
    { label: 'Home Runs', value: formatStat(getStat(stats, 'home_runs', isPitcher) || 0, 0) },
    { label: 'RBIs', value: formatStat(getStat(stats, 'rbi', isPitcher) || 0, 0) },
    { label: 'Runs', value: formatStat(getStat(stats, 'runs', isPitcher) || 0, 0) },
    { label: 'Stolen Bases', value: formatStat(getStat(stats, 'stolen_bases', isPitcher) || 0, 0) },
    { label: 'OBP', value: formatStat(getStat(stats, 'obp', isPitcher), 3) },
    { label: 'OPS', value: formatStat(getStat(stats, 'ops', isPitcher), 3) }
  ];

  // Debug stat cards
  console.log('Generated stat cards:', statCards);

  return (
    <div>
      <h3 className={dynastyTheme.components.heading.h3}>
        {currentSeason} Season Overview (League Database)
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {statCards.map(({ label, value }) => {
          // Extra safety check before rendering
          const safeValue = typeof value === 'object' ? '-' : value;
          
          return (
            <div key={label} className={dynastyTheme.components.statCard.container}>
              <div className={dynastyTheme.components.statCard.value}>
                {safeValue}
              </div>
              <div className={dynastyTheme.components.statCard.label}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Last 14 Days if available */}
      {last14Days && (
        <div className="mt-8">
          <h4 className={dynastyTheme.components.heading.h4}>
            Last 14 Days Performance (Rolling Stats)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {(isPitcher ? [
              { label: 'Games', value: formatStat(getStat(last14Days, 'games', isPitcher) || 0, 0) },
              { label: 'ERA', value: formatStat(getStat(last14Days, 'era', isPitcher), 2) },
              { label: 'WHIP', value: formatStat(getStat(last14Days, 'whip', isPitcher), 3) },
              { label: 'Wins', value: formatStat(getStat(last14Days, 'wins', isPitcher) || 0, 0) },
              { label: 'Strikeouts', value: formatStat(getStat(last14Days, 'strikeouts_pitched', isPitcher) || 0, 0) },
              { label: 'Innings', value: formatStat(getStat(last14Days, 'innings_pitched', isPitcher), 1) }
            ] : [
              { label: 'Games', value: formatStat(getStat(last14Days, 'games', isPitcher) || 0, 0) },
              { label: 'AVG', value: formatStat(getStat(last14Days, 'batting_avg', isPitcher), 3) },
              { label: 'HR', value: formatStat(getStat(last14Days, 'home_runs', isPitcher) || 0, 0) },
              { label: 'RBI', value: formatStat(getStat(last14Days, 'rbi', isPitcher) || 0, 0) },
              { label: 'Runs', value: formatStat(getStat(last14Days, 'runs', isPitcher) || 0, 0) },
              { label: 'SB', value: formatStat(getStat(last14Days, 'stolen_bases', isPitcher) || 0, 0) }
            ]).map(({ label, value }) => {
              // Extra safety check before rendering
              const safeValue = typeof value === 'object' ? '-' : value;
              
              return (
                <div key={label} className={dynastyTheme.components.statCard.container}>
                  <div className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
                    {safeValue}
                  </div>
                  <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerOverviewTab;