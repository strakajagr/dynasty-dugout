// src/services/tables/tileGridComponent.js
// Reusable grid component for tile displays (benchmarking, comparisons, etc.)

import React from 'react';
import { dynastyTheme } from '../colorService';

/**
 * Reusable grid component for displaying performance benchmarks in tiles
 * Used by multiple tiles on the game logs page
 */
export const TilePerformanceGrid = ({ 
  data, 
  role = 'starter',
  showLeague = true 
}) => {
  // Return early if no data
  if (!data || !data.player) {
    return (
      <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
        No performance data available
      </div>
    );
  }

  const { player, mlb_benchmark, league_benchmark, comparisons } = data;

  // Determine column headers based on role
  const getHeaders = (role) => {
    if (role === 'starter') return ['W', 'ERA', 'WHIP', 'K', 'QS', 'BB/9'];
    if (role === 'closer') return ['SV', 'ERA', 'WHIP', 'K', 'K/9', 'BB/9'];
    return ['HLD', 'ERA', 'WHIP', 'K', 'K/9', 'BB/9'];
  };

  // Get stat keys in order
  const getStatKeys = (role) => {
    if (role === 'starter') return ['wins', 'era', 'whip', 'strikeouts', 'quality_starts', 'bb_per_9'];
    if (role === 'closer') return ['saves', 'era', 'whip', 'strikeouts', 'k_per_9', 'bb_per_9'];
    return ['holds', 'era', 'whip', 'strikeouts', 'k_per_9', 'bb_per_9'];
  };

  const headers = getHeaders(role || player.role);
  const statKeys = getStatKeys(role || player.role);

  // Format number display
  const formatStat = (value, key) => {
    if (value === null || value === undefined) return '0';
    if (key === 'era' || key === 'whip' || key === 'bb_per_9' || key === 'k_per_9') {
      return Number(value).toFixed(2);
    }
    return Math.round(value).toString();
  };

  // Get color based on comparison
  const getStatColor = (comparison, stat) => {
    if (!comparison || !comparison[stat]) return dynastyTheme.classes.text.white;
    if (comparison[stat] === 'better') return dynastyTheme.classes.text.success;
    if (comparison[stat] === 'worse') return dynastyTheme.classes.text.error;
    return dynastyTheme.classes.text.white;
  };

  // Get trend indicator
  const getTrendIndicator = (comparisons) => {
    if (!comparisons?.vs_mlb) return '';
    const betterCount = Object.values(comparisons.vs_mlb).filter(v => v === 'better').length;
    const totalStats = Object.keys(comparisons.vs_mlb).length;
    if (betterCount > totalStats * 0.6) return '↑';
    if (betterCount < totalStats * 0.4) return '↓';
    return '→';
  };

  const trendIndicator = getTrendIndicator(comparisons);
  const trendColor = trendIndicator === '↑' ? dynastyTheme.classes.text.success : 
                     trendIndicator === '↓' ? dynastyTheme.classes.text.error : 
                     dynastyTheme.classes.text.neutral;

  return (
    <div className="space-y-1">
      {/* Headers */}
      <div className="grid grid-cols-7 gap-1 text-xs font-bold">
        <div></div>  {/* Empty cell for row labels */}
        {headers.map(h => (
          <div key={h} className={`text-center ${dynastyTheme.classes.text.primary}`}>
            {h}
          </div>
        ))}
      </div>
      
      {/* Player row */}
      <div className="grid grid-cols-7 gap-1 text-xs items-center">
        <div className={`${dynastyTheme.classes.text.white} flex items-center`}>
          You:
          {trendIndicator && (
            <span className={`ml-1 text-sm ${trendColor}`}>{trendIndicator}</span>
          )}
        </div>
        {statKeys.map(key => (
          <div 
            key={key}
            className={`text-center ${getStatColor(comparisons?.vs_mlb, key)}`}
          >
            {formatStat(player.stats?.[key], key)}
          </div>
        ))}
      </div>
      
      {/* MLB benchmark row */}
      {mlb_benchmark && (
        <div className="grid grid-cols-7 gap-1 text-xs">
          <div className={dynastyTheme.classes.text.neutralLight}>MLB:</div>
          {statKeys.map(key => (
            <div key={key} className={`text-center ${dynastyTheme.classes.text.neutralLight}`}>
              {formatStat(mlb_benchmark.stats?.[key], key)}
            </div>
          ))}
        </div>
      )}
      
      {/* League benchmark row (if present and enabled) */}
      {showLeague && league_benchmark && (
        <div className="grid grid-cols-7 gap-1 text-xs">
          <div className={dynastyTheme.classes.text.neutralLight}>League:</div>
          {statKeys.map(key => (
            <div key={key} className={`text-center ${dynastyTheme.classes.text.neutralLight}`}>
              {formatStat(league_benchmark.stats?.[key], key)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Hitter performance grid component (for hitter tiles)
 */
export const TileHitterGrid = ({ 
  data, 
  showLeague = true 
}) => {
  // Return early if no data
  if (!data || !data.player) {
    return (
      <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
        No performance data available
      </div>
    );
  }

  const { player, mlb_benchmark, league_benchmark, comparisons } = data;

  // Headers for hitters
  const headers = ['AVG', 'OPS', 'HR', 'RBI', 'R', 'SB'];
  const statKeys = ['avg', 'ops', 'home_runs', 'rbi', 'runs', 'stolen_bases'];

  // Format number display
  const formatStat = (value, key) => {
    if (value === null || value === undefined) return '0';
    if (key === 'avg' || key === 'ops') {
      return Number(value).toFixed(3);
    }
    return Math.round(value).toString();
  };

  // Get color based on comparison
  const getStatColor = (comparison, stat) => {
    if (!comparison || !comparison[stat]) return dynastyTheme.classes.text.white;
    if (comparison[stat] === 'better') return dynastyTheme.classes.text.success;
    if (comparison[stat] === 'worse') return dynastyTheme.classes.text.error;
    return dynastyTheme.classes.text.white;
  };

  // Get trend indicator
  const getTrendIndicator = (comparisons) => {
    if (!comparisons?.vs_mlb) return '';
    const betterCount = Object.values(comparisons.vs_mlb).filter(v => v === 'better').length;
    const totalStats = Object.keys(comparisons.vs_mlb).length;
    if (betterCount > totalStats * 0.6) return '↑';
    if (betterCount < totalStats * 0.4) return '↓';
    return '→';
  };

  const trendIndicator = getTrendIndicator(comparisons);
  const trendColor = trendIndicator === '↑' ? dynastyTheme.classes.text.success : 
                     trendIndicator === '↓' ? dynastyTheme.classes.text.error : 
                     dynastyTheme.classes.text.neutral;

  return (
    <div className="space-y-1">
      {/* Headers */}
      <div className="grid grid-cols-7 gap-1 text-xs font-bold">
        <div></div>  {/* Empty cell for row labels */}
        {headers.map(h => (
          <div key={h} className={`text-center ${dynastyTheme.classes.text.primary}`}>
            {h}
          </div>
        ))}
      </div>
      
      {/* Player row */}
      <div className="grid grid-cols-7 gap-1 text-xs items-center">
        <div className={`${dynastyTheme.classes.text.white} flex items-center`}>
          You:
          {trendIndicator && (
            <span className={`ml-1 text-sm ${trendColor}`}>{trendIndicator}</span>
          )}
        </div>
        {statKeys.map(key => (
          <div 
            key={key}
            className={`text-center ${getStatColor(comparisons?.vs_mlb, key)}`}
          >
            {formatStat(player.stats?.[key], key)}
          </div>
        ))}
      </div>
      
      {/* MLB benchmark row */}
      {mlb_benchmark && (
        <div className="grid grid-cols-7 gap-1 text-xs">
          <div className={dynastyTheme.classes.text.neutralLight}>MLB:</div>
          {statKeys.map(key => (
            <div key={key} className={`text-center ${dynastyTheme.classes.text.neutralLight}`}>
              {formatStat(mlb_benchmark.stats?.[key], key)}
            </div>
          ))}
        </div>
      )}
      
      {/* League benchmark row (if present and enabled) */}
      {showLeague && league_benchmark && (
        <div className="grid grid-cols-7 gap-1 text-xs">
          <div className={dynastyTheme.classes.text.neutralLight}>League:</div>
          {statKeys.map(key => (
            <div key={key} className={`text-center ${dynastyTheme.classes.text.neutralLight}`}>
              {formatStat(league_benchmark.stats?.[key], key)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Export both components
export default {
  TilePerformanceGrid,
  TileHitterGrid
};