// src/services/tables/teamStatsColumns.js - TEAM STATS COLUMNS WITH POSITION SLOTS AND 3-LINE FORMAT
import React from 'react';
import { ExternalLink, Zap, Activity, Move, Trash2, ArrowLeftRight } from 'lucide-react';
import { dynastyTheme } from '../colorService';
import { renderDefault, renderFloat1, renderFloat2, renderFloat3, renderAvg } from './DynastyTable';

// Helper for 3-row border styling
const get3RowBorderClass = (row) => {
  if (row.statType === 'accrued') {
    return `border-b border-yellow-500/20`;
  }
  return '';
};

// Helper for font sizing and style on rows 2 and 3 (rolling and accrued)
const getStatRowFontClass = (row) => {
  // Row 1 (season) = normal size
  if (row.statType === 'season') return '';
  
  // Rows 2 & 3 (rolling, accrued) = smaller and italic
  return 'text-xs italic';
};

/**
 * Create columns for team stats active lineup with 3-line format per position slot
 * Uses position slot structure like MyRoster
 */
export const createTeamStatsActiveLineupColumns = ({
  statConfigs = [],
  onPlayerClick,
  showHistoricalBadge = false,
  isPitcher = false,
  onMovePlayer,
  onDropPlayer,
  onTradePlayer,
  hasBenchSlots = false,
  leagueSettings = {}
}) => {
  const columns = [
    // Position Label
    {
      key: 'slotPosition',
      title: 'POS',
      width: 35,  // POS header
      cellPadding: 'py-0 px-1',
      sortable: false,
      className: (row, index) => {
        let classes = [];
        if (row.statType === 'accrued') {
          classes.push('border-b border-yellow-500/20');
        }
        return classes.join(' ');
      },
      render: (_, row) => {
        // Show position on middle row (rolling) for vertical centering
        if (row.statType === 'rolling') {
          return (
            <div className="flex items-center justify-center h-full">
              <span className={`${dynastyTheme.classes.text.primary} text-xs font-bold uppercase tracking-wide`}>
                {row.slotPosition || '?'}
              </span>
            </div>
          );
        }
        return null;
      }
    },
    
    // Player Name with stat type indicator
    {
      key: 'player_name',
      title: 'Player',
      width: 60,  // 50% NARROWER
      sortable: false,
      allowOverflow: true,
      className: (row, index) => {
        let classes = [];
        if (row.statType === 'accrued') {
          classes.push('border-b border-yellow-500/20');
        }
        return classes.join(' ');
      },
      render: (_, row) => {
        // Season row - show player or "Empty"
        if (row.statType === 'season') {
          if (!row.player) {
            return (
              <span className={`${dynastyTheme.classes.text.neutralDark} text-sm italic`}>
                Empty
              </span>
            );
          }
          
          const player = row.player;
          return (
            <button
              onClick={() => onPlayerClick(player)}
              className={`text-left ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transitionFast} flex items-center w-full group`}
            >
              <div className="flex-1 min-w-0">
                <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate flex items-center gap-2`}>
                  {player.info?.first_name} {player.info?.last_name}
                  {player.trend === 'hot' && <Zap className="w-3 h-3 text-red-400" />}
                  {player.trend === 'cold' && <Activity className="w-3 h-3 text-blue-400" />}
                  {showHistoricalBadge && player.is_historical && (
                    <span className="px-2 py-0.5 rounded text-xs bg-neutral-700 text-neutral-300">
                      Alumni
                    </span>
                  )}
                </div>
              </div>
              <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          );
        } else {
          // 14-Day and Accrued rows - show stat type label
          return (
            <div className={`text-left text-[10px] font-normal opacity-50 ${
              row.statType === 'rolling' 
                ? 'text-yellow-400'
                : 'text-cyan-400'
            }`}>
              {row.statType === 'rolling' ? '↗ 14-Day' : '✓ Accrued'}
            </div>
          );
        }
      }
    },
    
    // Team
    {
      key: 'team',
      title: 'Team',
      width: 40,  // Team header
      cellPadding: 'py-0 px-1',
      sortable: false,
      className: (row, index) => {
        let classes = [];
        if (row.statType === 'accrued') {
          classes.push('border-b border-yellow-500/20');
        }
        return classes.join(' ');
      },
      render: (_, row) => {
        // Show team on middle row (rolling) for vertical centering
        if (row.statType === 'rolling' && row.player) {
          return (
            <div className="flex items-center justify-center h-full">
              <span className={`${dynastyTheme.classes.text.white} text-xs`}>
                {row.player.mlb_team || '-'}
              </span>
            </div>
          );
        }
        return null;
      }
    }
  ];

  // Add static stat columns (G, AB, H for batters OR G, GS for pitchers)
  if (isPitcher) {
    // Pitchers: G, GS
    columns.push({
      key: 'games_played',
      title: 'G',
      width: 35,
      cellPadding: 'py-0 px-1',
      sortable: false,
      isStatColumn: true,
      className: get3RowBorderClass,
      render: (_, row) => {
        if (!row.player) return null;
        
        let statsData;
        if (row.statType === 'season') statsData = row.player.season_stats;
        else if (row.statType === 'rolling') statsData = row.player.rolling_14_day;
        else if (row.statType === 'accrued') statsData = row.player.accrued_stats;
        
        if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        
        const value = row.statType === 'accrued' 
          ? (statsData.active_games_played || statsData.games_played)
          : statsData.games_played;
        
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        const colorClass = row.statType === 'season' 
          ? dynastyTheme.classes.text.white
          : row.statType === 'rolling' ? 'text-yellow-500/70' : 'text-cyan-500/60';
        const fontClass = getStatRowFontClass(row);
        
        return <span className={`${colorClass} ${fontClass} font-mono text-sm`}>{renderDefault(value)}</span>;
      }
    });
    
    columns.push({
      key: 'games_started',
      title: 'GS',
      width: 35,
      cellPadding: 'py-0 px-1',
      sortable: false,
      isStatColumn: true,
      className: get3RowBorderClass,
      render: (_, row) => {
        if (!row.player) return null;
        
        let statsData;
        if (row.statType === 'season') statsData = row.player.season_stats;
        else if (row.statType === 'rolling') statsData = row.player.rolling_14_day;
        else if (row.statType === 'accrued') statsData = row.player.accrued_stats;
        
        if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        
        const value = row.statType === 'accrued' 
          ? (statsData.active_games_started || statsData.games_started)
          : statsData.games_started;
        
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        const colorClass = row.statType === 'season' 
          ? dynastyTheme.classes.text.white
          : row.statType === 'rolling' ? 'text-yellow-500/70' : 'text-cyan-500/60';
        const fontClass = getStatRowFontClass(row);
        
        return <span className={`${colorClass} ${fontClass} font-mono text-sm`}>{renderDefault(value)}</span>;
      }
    });
  } else {
    // Batters: G, AB, H
    const staticBatterStats = [
      { field: 'games_played', label: 'G', width: 35 },
      { field: 'at_bats', label: 'AB', width: 35 },
      { field: 'hits', label: 'H', width: 35 }
    ];
    
    staticBatterStats.forEach(stat => {
      columns.push({
        key: stat.field,
        title: stat.label,
        width: stat.width,
        cellPadding: 'py-0 px-1',
        sortable: false,
        isStatColumn: true,
        className: (row, index) => {
          let classes = [];
          if (row.statType === 'accrued') {
            classes.push('border-b border-yellow-500/20');
          }
          return classes.join(' ');
        },
        render: (_, row) => {
          if (!row.player) return null;
          
          let statsData;
          if (row.statType === 'season') statsData = row.player.season_stats;
          else if (row.statType === 'rolling') statsData = row.player.rolling_14_day;
          else if (row.statType === 'accrued') statsData = row.player.accrued_stats;
          
          if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          
          const value = row.statType === 'accrued' 
            ? (statsData[`active_${stat.field}`] || statsData[stat.field])
            : statsData[stat.field];
          
          if (value === undefined || value === null) {
            return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          }
          
          const colorClass = row.statType === 'season' 
            ? dynastyTheme.classes.text.white
            : row.statType === 'rolling' ? 'text-yellow-500/70' : 'text-cyan-500/60';
          const fontClass = getStatRowFontClass(row);
          
          return <span className={`${colorClass} ${fontClass} font-mono text-sm`}>{renderDefault(value)}</span>;
        }
      });
    });
  }

  // Add dynamic stat columns from league settings
  statConfigs.forEach((config) => {
    columns.push({
      key: `stats.${config.field}`,
      title: config.label,
      width: 35,
      cellPadding: 'py-0 px-1',
      sortable: false,
      isStatColumn: true,
      className: (row, index) => {
        let classes = [];
        if (row.statType === 'accrued') {
          classes.push('border-b border-yellow-500/20');
        }
        return classes.join(' ');
      },
      render: (_, row) => {
        if (!row.player) return null;
        
        let statsData;
        if (row.statType === 'season') statsData = row.player.season_stats;
        else if (row.statType === 'rolling') statsData = row.player.rolling_14_day;
        else if (row.statType === 'accrued') statsData = row.player.accrued_stats;
        
        if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        
        const value = row.statType === 'accrued' 
          ? (statsData[`active_${config.field}`] || statsData[config.field])
          : statsData[config.field];
        
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        // FORMAT BASED ON CONFIG decimals AND prefix (not 'format' property)
        let formattedValue;
        if (config.decimals === 3 && config.prefix === '.') {
          formattedValue = renderAvg(value);
        } else if (config.decimals === 3) {
          formattedValue = renderFloat3(value);
        } else if (config.decimals === 2) {
          formattedValue = renderFloat2(value);
        } else if (config.decimals === 1) {
          formattedValue = renderFloat1(value);
        } else {
          formattedValue = renderDefault(value);
        }
        
        const colorClass = row.statType === 'season' 
          ? dynastyTheme.classes.text.white
          : row.statType === 'rolling' ? 'text-yellow-500/70' : 'text-cyan-500/60';
        const fontClass = getStatRowFontClass(row);
        
        return <span className={`${colorClass} ${fontClass} font-mono text-sm`}>{formattedValue}</span>;
      }
    });
  });

  // PRICE column (from salary engine)
  columns.push({
    key: 'price',
    title: 'Price',
    width: 35,
    cellPadding: 'py-0 px-1',
    sortable: false,
    className: (row, index) => {
      let classes = [];
      if (row.statType === 'accrued') {
        classes.push('border-b border-yellow-500/20');
      }
      return classes.join(' ');
    },
    render: (_, row) => {
      // Show price on middle row (rolling) for vertical centering
      if (row.statType !== 'rolling' || !row.player) return null;
      
      const price = row.player.financial?.market_price || 0;
      
      return (
        <div className="flex items-center justify-center h-full">
          <span className={`${dynastyTheme.classes.text.warning} font-semibold text-sm`}>
            ${price}
          </span>
        </div>
      );
    }
  });

  // Salary column
  columns.push({
    key: 'salary',
    title: 'Salary',
    width: 40,
    cellPadding: 'py-0 px-1',
    sortable: false,
    className: (row, index) => {
      let classes = [];
      if (row.statType === 'accrued') {
        classes.push('border-b border-yellow-500/20');
      }
      return classes.join(' ');
    },
    render: (_, row) => {
      // Show salary on middle row (rolling) for vertical centering
      if (row.statType !== 'rolling' || !row.player) return null;
      
      const salary = row.player.salary || 0;
      
      return (
        <div className="flex items-center justify-center h-full">
          <span className={`${dynastyTheme.classes.text.success} font-semibold text-sm`}>
            ${salary}
          </span>
        </div>
      );
    }
  });

  // Contract column
  columns.push({
    key: 'contract',
    title: 'Contract',
    width: 50,
    cellPadding: 'py-0 px-1',
    sortable: false,
    className: (row, index) => {
      let classes = [];
      if (row.statType === 'accrued') {
        classes.push('border-b border-yellow-500/20');
      }
      return classes.join(' ');
    },
    render: (_, row) => {
      // Show contract on middle row (rolling) for vertical centering
      if (row.statType !== 'rolling' || !row.player) return null;
      
      const years = row.player.contract_years || 0;
      
      if (!years) return (
        <div className="flex items-center justify-center h-full">
          <span className={dynastyTheme.classes.text.neutralDark}>-</span>
        </div>
      );
      
      return (
        <div className="flex items-center justify-center h-full">
          <span className={`${dynastyTheme.classes.text.white} font-semibold text-sm`}>
            {years}yr
          </span>
        </div>
      );
    }
  });

  // Actions column
  columns.push({
    key: 'actions',
    title: 'Actions',
    width: 70,
    cellPadding: 'py-0 px-1',
    sortable: false,
    className: (row, index) => {
      let classes = [];
      if (row.statType === 'accrued') {
        classes.push('border-b border-yellow-500/20');
      }
      return classes.join(' ');
    },
    render: (_, row) => {
      // Show actions on middle row (rolling) for vertical centering
      if (row.statType !== 'rolling' || !row.player) return null;
      
      const player = row.player;
      const rosterStatus = player.roster_status || 'active';
      
      // Determine if player is eligible for moves
      const canMove = hasBenchSlots || 
                     (leagueSettings.enableMinors && player.minors_eligible) || 
                     (leagueSettings.enableDL && player.dl_eligible);
      
      return (
        <div className="flex items-center justify-center h-full gap-1">
          <button
            onClick={() => onMovePlayer && onMovePlayer(player)}
            disabled={!canMove}
            className={`p-1 text-xs rounded transition-all ${
              canMove 
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 cursor-pointer'
                : 'bg-gray-700/20 text-gray-600 cursor-not-allowed opacity-50'
            }`}
            title={!canMove ? 'No bench slots or special positions available' : 'Move player'}
          >
            <Move className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDropPlayer && onDropPlayer(player)}
            className="p-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
            title="Drop player"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => onTradePlayer && onTradePlayer(player)}
            className="p-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
            title="Trade player"
          >
            <ArrowLeftRight className="w-3 h-3" />
          </button>
        </div>
      );
    }
  });

  return columns;
};

/**
 * Create columns for non-lineup players (bench, historical, etc.)
 * This is a simpler format without position slots
 */
export const createTeamStatsReserveColumns = ({
  statConfigs = [],
  onPlayerClick,
  showHistoricalBadge = false,
  isPitcher = false
}) => {
  const columns = [
    // POS column FIRST!
    {
      key: 'position',
      title: 'POS',
      width: 30,
      cellPadding: 'py-0 px-1',
      sortable: false,
      className: (row, index) => {
        let classes = [];
        if (row.statType === 'accrued') {
          classes.push('border-b border-yellow-500/20');
        }
        return classes.join(' ');
      },
      render: (_, row) => {
        if (row.statType === 'season' && row.playerData) {
          return (
            <span className={`${dynastyTheme.classes.text.primary} text-xs font-bold uppercase tracking-wide`}>
              {row.playerData.position || '?'}
            </span>
          );
        }
        return null;
      }
    },
    // Player Name
    {
      key: 'player_name',
      title: 'Player',
      width: 48,
      sortable: false,
      allowOverflow: true,
      className: (row, index) => {
        let classes = [];
        if (row.statType === 'accrued') {
          classes.push('border-b border-yellow-500/20');
        }
        return classes.join(' ');
      },
      render: (_, row) => {
        if (row.statType === 'season') {
          return (
            <button
              onClick={() => onPlayerClick(row.playerData)}
              className={`text-right ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transitionFast} flex items-center w-full group justify-end`}
            >
              <ExternalLink className="w-3 h-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate text-right`}>
                  {row.playerData.info?.first_name} {row.playerData.info?.last_name}
                  {showHistoricalBadge && row.playerData.is_historical && (
                    <span className="ml-2 px-2 py-0.5 rounded text-xs bg-neutral-700 text-neutral-300">
                      Alumni
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        } else {
          return (
            <div className={`text-xs pr-1 font-semibold text-right ${
              row.statType === 'rolling' ? 'text-yellow-400' : 'text-cyan-400'
            }`}>
              {row.statType === 'rolling' ? '↗ 14-Day' : '✓ Accrued'}
            </div>
          );
        }
      }
    }
  ];

  // Add Team column
  columns.push({
    key: 'team',
    title: 'Team',
    width: 50,
    cellPadding: 'py-0 px-1',
    sortable: false,
    className: (row) => {
      if (row.statType === 'accrued') {
        return `border-b border-yellow-500/20`;
      }
      return '';
    },
    render: (_, row) => {
      if (row.statType === 'season' && row.playerData) {
        return (
          <span className={`${dynastyTheme.classes.text.neutralLight} text-xs`}>
            {row.playerData.mlb_team || '-'}
          </span>
        );
      }
      return null;
    }
  });

  // Add static stat columns based on player type
  if (isPitcher) {
    // Pitchers: G, GS
    const staticPitcherStats = [
      { field: 'games_played', label: 'G', width: 45 },
      { field: 'games_started', label: 'GS', width: 45 }
    ];
    
    staticPitcherStats.forEach(stat => {
      columns.push({
        key: stat.field,
        title: stat.label,
        width: stat.width,
        cellPadding: 'py-0 px-1',
        sortable: false,
        isStatColumn: true,
        className: (row) => {
          if (row.statType === 'accrued') {
            return `border-b border-yellow-500/20`;
          }
          return '';
        },
        render: (_, row) => {
          let statsData;
          if (row.statType === 'season') statsData = row.playerData.season_stats;
          else if (row.statType === 'rolling') statsData = row.playerData.rolling_14_day;
          else if (row.statType === 'accrued') statsData = row.playerData.accrued_stats;
          
          if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          
          const value = row.statType === 'accrued' 
            ? (statsData[`active_${stat.field}`] || statsData[stat.field])
            : statsData[stat.field];
          
          if (value === undefined || value === null) {
            return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          }
          
          const colorClass = row.statType === 'season' 
            ? dynastyTheme.classes.text.white
            : row.statType === 'rolling' ? 'text-yellow-400' : 'text-cyan-400';
          const fontClass = getStatRowFontClass(row);
          
          return <span className={`${colorClass} ${fontClass} font-mono text-sm`}>{renderDefault(value)}</span>;
        }
      });
    });
  } else {
    // Batters: G, AB, H
    const staticBatterStats = [
      { field: 'games_played', label: 'G', width: 45 },
      { field: 'at_bats', label: 'AB', width: 45 },
      { field: 'hits', label: 'H', width: 45 }
    ];
    
    staticBatterStats.forEach(stat => {
      columns.push({
        key: stat.field,
        title: stat.label,
        width: stat.width,
        cellPadding: 'py-0 px-1',
        sortable: false,
        isStatColumn: true,
        className: (row) => {
          if (row.statType === 'accrued') {
            return `border-b border-yellow-500/20`;
          }
          return '';
        },
        render: (_, row) => {
          let statsData;
          if (row.statType === 'season') statsData = row.playerData.season_stats;
          else if (row.statType === 'rolling') statsData = row.playerData.rolling_14_day;
          else if (row.statType === 'accrued') statsData = row.playerData.accrued_stats;
          
          if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          
          const value = row.statType === 'accrued' 
            ? (statsData[`active_${stat.field}`] || statsData[stat.field])
            : statsData[stat.field];
          
          if (value === undefined || value === null) {
            return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          }
          
          const colorClass = row.statType === 'season' 
            ? dynastyTheme.classes.text.white
            : row.statType === 'rolling' ? 'text-yellow-400' : 'text-cyan-400';
          const fontClass = getStatRowFontClass(row);
          
          return <span className={`${colorClass} ${fontClass} font-mono text-sm`}>{renderDefault(value)}</span>;
        }
      });
    });
  }

  // Add dynamic stat columns from league settings
  statConfigs.forEach((config) => {
    columns.push({
      key: `stats.${config.field}`,
      title: config.label,
      width: 50,
      cellPadding: 'py-0 px-1',
      sortable: false,
      isStatColumn: true,
      className: (row) => {
        if (row.statType === 'accrued') {
          return `border-b border-yellow-500/20`;
        }
        return '';
      },
      render: (_, row) => {
        let statsData;
        if (row.statType === 'season') statsData = row.playerData.season_stats;
        else if (row.statType === 'rolling') statsData = row.playerData.rolling_14_day;
        else if (row.statType === 'accrued') statsData = row.playerData.accrued_stats;
        
        if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        
        const value = row.statType === 'accrued' 
          ? (statsData[`active_${config.field}`] || statsData[config.field])
          : statsData[config.field];
        
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        // FORMAT BASED ON CONFIG decimals AND prefix (not 'format' property)
        let formattedValue;
        if (config.decimals === 3 && config.prefix === '.') {
          formattedValue = renderAvg(value);
        } else if (config.decimals === 3) {
          formattedValue = renderFloat3(value);
        } else if (config.decimals === 2) {
          formattedValue = renderFloat2(value);
        } else if (config.decimals === 1) {
          formattedValue = renderFloat1(value);
        } else {
          formattedValue = renderDefault(value);
        }
        
        const colorClass = row.statType === 'season' 
          ? dynastyTheme.classes.text.white
          : row.statType === 'rolling' ? 'text-yellow-400' : 'text-cyan-400';
        const fontClass = getStatRowFontClass(row);
        
        return <span className={`${colorClass} ${fontClass} font-mono text-sm`}>{formattedValue}</span>;
      }
    });
  });

  // PRICE column
  columns.push({
    key: 'price',
    title: 'Price',
    width: 55,
    cellPadding: 'py-0 px-1',
    sortable: false,
    className: (row) => {
      if (row.statType === 'accrued') {
        return `border-b border-yellow-500/20`;
      }
      return '';
    },
    render: (_, row) => {
      if (row.statType !== 'season') return null;
      
      const price = row.playerData.financial?.market_price || 0;
      
      return (
        <span className={`${dynastyTheme.classes.text.warning} font-medium text-sm`}>
          ${price}
        </span>
      );
    }
  });

  // Salary column
  columns.push({
    key: 'salary',
    title: 'Salary',
    width: 55,
    cellPadding: 'py-0 px-1',
    sortable: false,
    className: (row) => {
      if (row.statType === 'accrued') {
        return `border-b border-yellow-500/20`;
      }
      return '';
    },
    render: (_, row) => {
      if (row.statType !== 'season') return null;
      
      const salary = row.playerData.salary || 0;
      
      return (
        <span className={`${dynastyTheme.classes.text.success} font-medium text-sm`}>
          ${salary}
        </span>
      );
    }
  });

  // Contract column
  columns.push({
    key: 'contract',
    title: 'Contract',
    width: 60,
    cellPadding: 'py-0 px-1',
    sortable: false,
    className: (row) => {
      if (row.statType === 'accrued') {
        return `border-b border-yellow-500/20`;
      }
      return '';
    },
    render: (_, row) => {
      if (row.statType !== 'season') return null;
      
      const years = row.playerData.contract_years || 0;
      
      if (!years) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
      
      return (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
          {years}yr
        </span>
      );
    }
  });

  return columns;
};

/**
 * Transform position slot data into 3-line format for DynastyTable
 * Each position slot becomes 3 rows: Season, 14-Day, Accrued
 * ALWAYS creates all 3 rows even for empty slots (so position shows on rolling row)
 */
export const transformPositionSlotsToThreeLineFormat = (positionSlots) => {
  const rows = [];
  
  positionSlots.forEach(slot => {
    const baseRow = {
      slotPosition: slot.slotPosition,
      slotId: slot.slotId,
      player: slot.player
    };
    
    // Row 1: Season stats
    rows.push({
      id: `${slot.slotId}-season`,
      statType: 'season',
      ...baseRow
    });
    
    // Row 2: 14-Day rolling stats (ALWAYS create, even for empty slots)
    rows.push({
      id: `${slot.slotId}-rolling`,
      statType: 'rolling',
      ...baseRow
    });
    
    // Row 3: Accrued stats (ALWAYS create, even for empty slots)
    rows.push({
      id: `${slot.slotId}-accrued`,
      statType: 'accrued',
      ...baseRow
    });
  });
  
  return rows;
};

/**
 * Transform player list into 3-line format (for non-position-slot sections)
 */
export const transformPlayersToThreeLineFormat = (players) => {
  const rows = [];
  
  players.forEach(player => {
    // Row 1: Season stats
    rows.push({
      id: `${player.mlb_player_id}-season`,
      statType: 'season',
      playerData: player
    });
    
    // Row 2: 14-Day rolling stats
    rows.push({
      id: `${player.mlb_player_id}-rolling`,
      statType: 'rolling',
      playerData: player
    });
    
    // Row 3: Accrued stats
    rows.push({
      id: `${player.mlb_player_id}-accrued`,
      statType: 'accrued',
      playerData: player
    });
  });
  
  return rows;
};

/**
 * Helper to separate current roster from historical players
 * NOW WORKS WITH CANONICAL API STRUCTURE
 */
export const separateCurrentAndHistorical = (players) => {
  const current = [];
  const historical = [];
  
  players.forEach(player => {
    // Check for historical flag OR missing roster status in CANONICAL structure
    const rosterStatus = player.roster?.status || player.league_context?.roster_status;
    const isHistorical = player.is_historical || !rosterStatus;
    
    if (isHistorical) {
      historical.push({
        ...player,
        is_historical: true
      });
    } else {
      current.push(player);
    }
  });
  
  return { current, historical };
};

// ========================================
// ACCRUED ONLY MODE - SINGLE ROW FORMAT
// ========================================

/**
 * Create columns for ACCRUED ONLY mode - active lineup
 * Single row per player with ONLY accrued stats, normal styling (not italic/smaller)
 */
export const createTeamStatsActiveLineupColumnsAccruedOnly = ({
  statConfigs = [],
  onPlayerClick,
  showHistoricalBadge = false,
  isPitcher = false,
  onMovePlayer,
  onDropPlayer,
  onTradePlayer,
  hasBenchSlots = false,
  leagueSettings = {}
}) => {
  const columns = [
    // Position Label
    {
      key: 'slotPosition',
      title: 'POS',
      width: 35,
      cellPadding: 'py-1 px-1',
      sortable: false,
      render: (_, row) => {
        if (row.isTotalsRow) {
          return (
            <div className="flex items-center justify-center h-full">
              <span className={`${dynastyTheme.classes.text.primary} text-sm font-bold uppercase`}>
                TOTAL
              </span>
            </div>
          );
        }
        
        return (
          <div className="flex items-center justify-center h-full">
            <span className={`${dynastyTheme.classes.text.primary} text-sm font-bold uppercase tracking-wide`}>
              {row.slotPosition || '?'}
            </span>
          </div>
        );
      }
    },
    
    // Player Name
    {
      key: 'player_name',
      title: 'Player',
      width: 60,
      sortable: false,
      allowOverflow: true,
      render: (_, row) => {
        if (row.isTotalsRow) {
          return (
            <span className={`${dynastyTheme.classes.text.white} text-sm font-bold`}>
              Team Totals
            </span>
          );
        }
        
        if (!row.player) {
          return (
            <span className={`${dynastyTheme.classes.text.neutralDark} text-sm italic`}>
              Empty
            </span>
          );
        }
        
        const player = row.player;
        return (
          <button
            onClick={() => onPlayerClick(player)}
            className={`text-left ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transitionFast} flex items-center w-full group`}
          >
            <div className="flex-1 min-w-0">
              <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate flex items-center gap-2`}>
                {player.info?.first_name} {player.info?.last_name}
                {player.trend === 'hot' && <Zap className="w-3 h-3 text-red-400" />}
                {player.trend === 'cold' && <Activity className="w-3 h-3 text-blue-400" />}
                {showHistoricalBadge && player.is_historical && (
                  <span className="px-2 py-0.5 rounded text-xs bg-neutral-700 text-neutral-300">
                    Alumni
                  </span>
                )}
              </div>
            </div>
            <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        );
      }
    },
    
    // Team
    {
      key: 'team',
      title: 'Team',
      width: 40,
      cellPadding: 'py-1 px-1',
      sortable: false,
      render: (_, row) => {
        if (row.isTotalsRow) return null;
        
        if (row.player) {
          return (
            <div className="flex items-center justify-center h-full">
              <span className={`${dynastyTheme.classes.text.white} text-sm`}>
                {row.player.mlb_team || '-'}
              </span>
            </div>
          );
        }
        return null;
      }
    }
  ];

  // Add static stat columns
  if (isPitcher) {
    columns.push({
      key: 'games_played',
      title: 'G',
      width: 35,
      cellPadding: 'py-1 px-1',
      sortable: false,
      isStatColumn: true,
      render: (_, row) => {
        if (row.isTotalsRow) {
          const value = row.totals?.games_played || 0;
          return <span className={`${dynastyTheme.classes.text.white} font-bold text-sm font-mono`}>{renderDefault(value)}</span>;
        }
        
        if (!row.player) return null;
        const statsData = row.player.accrued_stats;
        if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        
        const value = statsData.active_games_played || statsData.games_played;
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        return <span className={`text-cyan-500/60 font-mono text-sm`}>{renderDefault(value)}</span>;
      }
    });
    
    columns.push({
      key: 'games_started',
      title: 'GS',
      width: 35,
      cellPadding: 'py-1 px-1',
      sortable: false,
      isStatColumn: true,
      render: (_, row) => {
        if (row.isTotalsRow) {
          const value = row.totals?.games_started || 0;
          return <span className={`${dynastyTheme.classes.text.white} font-bold text-sm font-mono`}>{renderDefault(value)}</span>;
        }
        
        if (!row.player) return null;
        const statsData = row.player.accrued_stats;
        if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        
        const value = statsData.active_games_started || statsData.games_started;
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        return <span className={`text-cyan-500/60 font-mono text-sm`}>{renderDefault(value)}</span>;
      }
    });
  } else {
    // Batters: G, AB, H
    const staticBatterStats = [
      { field: 'games_played', label: 'G', width: 35 },
      { field: 'at_bats', label: 'AB', width: 35 },
      { field: 'hits', label: 'H', width: 35 }
    ];
    
    staticBatterStats.forEach(stat => {
      columns.push({
        key: stat.field,
        title: stat.label,
        width: stat.width,
        cellPadding: 'py-1 px-1',
        sortable: false,
        isStatColumn: true,
        render: (_, row) => {
          if (row.isTotalsRow) {
            const value = row.totals?.[stat.field] || 0;
            return <span className={`${dynastyTheme.classes.text.white} font-bold text-sm font-mono`}>{renderDefault(value)}</span>;
          }
          
          if (!row.player) return null;
          const statsData = row.player.accrued_stats;
          if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          
          const value = statsData[`active_${stat.field}`] || statsData[stat.field];
          if (value === undefined || value === null) {
            return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          }
          
          return <span className={`text-cyan-500/60 font-mono text-sm`}>{renderDefault(value)}</span>;
        }
      });
    });
  }

  // Add dynamic stat columns
  statConfigs.forEach((config) => {
    columns.push({
      key: `stats.${config.field}`,
      title: config.label,
      width: 35,
      cellPadding: 'py-1 px-1',
      sortable: false,
      isStatColumn: true,
      render: (_, row) => {
        if (row.isTotalsRow) {
          const value = row.totals?.[config.field];
          if (value === undefined || value === null) {
            return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          }
          
          let formattedValue;
          if (config.decimals === 3 && config.prefix === '.') {
            formattedValue = renderAvg(value);
          } else if (config.decimals === 3) {
            formattedValue = renderFloat3(value);
          } else if (config.decimals === 2) {
            formattedValue = renderFloat2(value);
          } else if (config.decimals === 1) {
            formattedValue = renderFloat1(value);
          } else {
            formattedValue = renderDefault(value);
          }
          
          return <span className={`${dynastyTheme.classes.text.white} font-bold text-sm font-mono`}>{formattedValue}</span>;
        }
        
        if (!row.player) return null;
        const statsData = row.player.accrued_stats;
        if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        
        const value = statsData[`active_${config.field}`] || statsData[config.field];
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        let formattedValue;
        if (config.decimals === 3 && config.prefix === '.') {
          formattedValue = renderAvg(value);
        } else if (config.decimals === 3) {
          formattedValue = renderFloat3(value);
        } else if (config.decimals === 2) {
          formattedValue = renderFloat2(value);
        } else if (config.decimals === 1) {
          formattedValue = renderFloat1(value);
        } else {
          formattedValue = renderDefault(value);
        }
        
        return <span className={`text-cyan-500/60 font-mono text-sm`}>{formattedValue}</span>;
      }
    });
  });

  // PRICE, SALARY, CONTRACT, ACTIONS - all show on this row
  columns.push({
    key: 'price',
    title: 'Price',
    width: 35,
    cellPadding: 'py-1 px-1',
    sortable: false,
    render: (_, row) => {
      if (row.isTotalsRow) return null;
      if (!row.player) return null;
      
      const price = row.player.financial?.market_price || 0;
      return (
        <span className={`${dynastyTheme.classes.text.warning} font-semibold text-sm`}>
          ${price}
        </span>
      );
    }
  });

  columns.push({
    key: 'salary',
    title: 'Salary',
    width: 40,
    cellPadding: 'py-1 px-1',
    sortable: false,
    render: (_, row) => {
      if (row.isTotalsRow) return null;
      if (!row.player) return null;
      
      const salary = row.player.salary || 0;
      return (
        <span className={`${dynastyTheme.classes.text.success} font-semibold text-sm`}>
          ${salary}
        </span>
      );
    }
  });

  columns.push({
    key: 'contract',
    title: 'Contract',
    width: 50,
    cellPadding: 'py-1 px-1',
    sortable: false,
    render: (_, row) => {
      if (row.isTotalsRow) return null;
      if (!row.player) return null;
      
      const years = row.player.contract_years || 0;
      if (!years) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
      
      return (
        <span className={`${dynastyTheme.classes.text.white} font-semibold text-sm`}>
          {years}yr
        </span>
      );
    }
  });

  columns.push({
    key: 'actions',
    title: 'Actions',
    width: 70,
    cellPadding: 'py-1 px-1',
    sortable: false,
    render: (_, row) => {
      if (row.isTotalsRow) return null;
      if (!row.player) return null;
      
      const player = row.player;
      const canMove = hasBenchSlots || 
                     (leagueSettings.enableMinors && player.minors_eligible) || 
                     (leagueSettings.enableDL && player.dl_eligible);
      
      return (
        <div className="flex items-center justify-center h-full gap-1">
          <button
            onClick={() => onMovePlayer && onMovePlayer(player)}
            disabled={!canMove}
            className={`p-1 text-xs rounded transition-all ${
              canMove 
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 cursor-pointer'
                : 'bg-gray-700/20 text-gray-600 cursor-not-allowed opacity-50'
            }`}
            title={!canMove ? 'No bench slots or special positions available' : 'Move player'}
          >
            <Move className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDropPlayer && onDropPlayer(player)}
            className="p-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
            title="Drop player"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => onTradePlayer && onTradePlayer(player)}
            className="p-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
            title="Trade player"
          >
            <ArrowLeftRight className="w-3 h-3" />
          </button>
        </div>
      );
    }
  });

  return columns;
};

/**
 * Create columns for ACCRUED ONLY mode - reserve/historical players
 * Single row per player with ONLY accrued stats
 */
export const createTeamStatsReserveColumnsAccruedOnly = ({
  statConfigs = [],
  onPlayerClick,
  showHistoricalBadge = false,
  isPitcher = false
}) => {
  const columns = [
    // POS column
    {
      key: 'position',
      title: 'POS',
      width: 30,
      cellPadding: 'py-1 px-1',
      sortable: false,
      render: (_, row) => {
        if (row.isTotalsRow) {
          return (
            <span className={`${dynastyTheme.classes.text.primary} text-sm font-bold uppercase`}>
              TOTAL
            </span>
          );
        }
        
        return (
          <span className={`${dynastyTheme.classes.text.primary} text-sm font-bold uppercase tracking-wide`}>
            {row.playerData.position || '?'}
          </span>
        );
      }
    },
    
    // Player Name
    {
      key: 'player_name',
      title: 'Player',
      width: 48,
      sortable: false,
      allowOverflow: true,
      render: (_, row) => {
        if (row.isTotalsRow) {
          return (
            <span className={`${dynastyTheme.classes.text.white} text-sm font-bold text-right`}>
              Team Totals
            </span>
          );
        }
        
        return (
          <button
            onClick={() => onPlayerClick(row.playerData)}
            className={`text-right ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transitionFast} flex items-center w-full group justify-end`}
          >
            <ExternalLink className="w-3 h-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate text-right`}>
                {row.playerData.info?.first_name} {row.playerData.info?.last_name}
                {showHistoricalBadge && row.playerData.is_historical && (
                  <span className="ml-2 px-2 py-0.5 rounded text-xs bg-neutral-700 text-neutral-300">
                    Alumni
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      }
    },
    
    // Team column
    {
      key: 'team',
      title: 'Team',
      width: 50,
      cellPadding: 'py-1 px-1',
      sortable: false,
      render: (_, row) => {
        if (row.isTotalsRow) return null;
        
        return (
          <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
            {row.playerData.mlb_team || '-'}
          </span>
        );
      }
    }
  ];

  // Add static stat columns
  if (isPitcher) {
    const staticPitcherStats = [
      { field: 'games_played', label: 'G', width: 45 },
      { field: 'games_started', label: 'GS', width: 45 }
    ];
    
    staticPitcherStats.forEach(stat => {
      columns.push({
        key: stat.field,
        title: stat.label,
        width: stat.width,
        cellPadding: 'py-1 px-1',
        sortable: false,
        isStatColumn: true,
        render: (_, row) => {
          if (row.isTotalsRow) {
            const value = row.totals?.[stat.field] || 0;
            return <span className={`${dynastyTheme.classes.text.white} font-bold text-sm font-mono`}>{renderDefault(value)}</span>;
          }
          
          const statsData = row.playerData.accrued_stats;
          if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          
          const value = statsData[`active_${stat.field}`] || statsData[stat.field];
          if (value === undefined || value === null) {
            return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          }
          
          return <span className={`text-cyan-400 font-mono text-sm`}>{renderDefault(value)}</span>;
        }
      });
    });
  } else {
    const staticBatterStats = [
      { field: 'games_played', label: 'G', width: 45 },
      { field: 'at_bats', label: 'AB', width: 45 },
      { field: 'hits', label: 'H', width: 45 }
    ];
    
    staticBatterStats.forEach(stat => {
      columns.push({
        key: stat.field,
        title: stat.label,
        width: stat.width,
        cellPadding: 'py-1 px-1',
        sortable: false,
        isStatColumn: true,
        render: (_, row) => {
          if (row.isTotalsRow) {
            const value = row.totals?.[stat.field] || 0;
            return <span className={`${dynastyTheme.classes.text.white} font-bold text-sm font-mono`}>{renderDefault(value)}</span>;
          }
          
          const statsData = row.playerData.accrued_stats;
          if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          
          const value = statsData[`active_${stat.field}`] || statsData[stat.field];
          if (value === undefined || value === null) {
            return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          }
          
          return <span className={`text-cyan-400 font-mono text-sm`}>{renderDefault(value)}</span>;
        }
      });
    });
  }

  // Add dynamic stat columns
  statConfigs.forEach((config) => {
    columns.push({
      key: `stats.${config.field}`,
      title: config.label,
      width: 50,
      cellPadding: 'py-1 px-1',
      sortable: false,
      isStatColumn: true,
      render: (_, row) => {
        if (row.isTotalsRow) {
          const value = row.totals?.[config.field];
          if (value === undefined || value === null) {
            return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          }
          
          let formattedValue;
          if (config.decimals === 3 && config.prefix === '.') {
            formattedValue = renderAvg(value);
          } else if (config.decimals === 3) {
            formattedValue = renderFloat3(value);
          } else if (config.decimals === 2) {
            formattedValue = renderFloat2(value);
          } else if (config.decimals === 1) {
            formattedValue = renderFloat1(value);
          } else {
            formattedValue = renderDefault(value);
          }
          
          return <span className={`${dynastyTheme.classes.text.white} font-bold text-sm font-mono`}>{formattedValue}</span>;
        }
        
        const statsData = row.playerData.accrued_stats;
        if (!statsData) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        
        const value = statsData[`active_${config.field}`] || statsData[config.field];
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        let formattedValue;
        if (config.decimals === 3 && config.prefix === '.') {
          formattedValue = renderAvg(value);
        } else if (config.decimals === 3) {
          formattedValue = renderFloat3(value);
        } else if (config.decimals === 2) {
          formattedValue = renderFloat2(value);
        } else if (config.decimals === 1) {
          formattedValue = renderFloat1(value);
        } else {
          formattedValue = renderDefault(value);
        }
        
        return <span className={`text-cyan-400 font-mono text-sm`}>{formattedValue}</span>;
      }
    });
  });

  // PRICE, SALARY, CONTRACT columns
  columns.push({
    key: 'price',
    title: 'Price',
    width: 55,
    cellPadding: 'py-1 px-1',
    sortable: false,
    render: (_, row) => {
      if (row.isTotalsRow) return null;
      
      const price = row.playerData.financial?.market_price || 0;
      return (
        <span className={`${dynastyTheme.classes.text.warning} font-medium text-sm`}>
          ${price}
        </span>
      );
    }
  });

  columns.push({
    key: 'salary',
    title: 'Salary',
    width: 55,
    cellPadding: 'py-1 px-1',
    sortable: false,
    render: (_, row) => {
      if (row.isTotalsRow) return null;
      
      const salary = row.playerData.salary || 0;
      return (
        <span className={`${dynastyTheme.classes.text.success} font-medium text-sm`}>
          ${salary}
        </span>
      );
    }
  });

  columns.push({
    key: 'contract',
    title: 'Contract',
    width: 60,
    cellPadding: 'py-1 px-1',
    sortable: false,
    render: (_, row) => {
      if (row.isTotalsRow) return null;
      
      const years = row.playerData.contract_years || 0;
      if (!years) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
      
      return (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
          {years}yr
        </span>
      );
    }
  });

  return columns;
};

/**
 * Transform position slots to ACCRUED ONLY single-row format
 */
export const transformPositionSlotsToAccruedOnlyFormat = (positionSlots) => {
  return positionSlots.map(slot => ({
    id: `${slot.slotId}-accrued-only`,
    slotPosition: slot.slotPosition,
    slotId: slot.slotId,
    player: slot.player
  }));
};

/**
 * Transform players to ACCRUED ONLY single-row format
 */
export const transformPlayersToAccruedOnlyFormat = (players) => {
  return players.map(player => ({
    id: `${player.mlb_player_id}-accrued-only`,
    playerData: player
  }));
};

/**
 * Calculate totals for accrued stats
 * Handles both counting stats (sum) and rate stats (weighted average)
 */
export const calculateAccruedTotals = (rows, statConfigs, isPitcher) => {
  const totals = {};
  
  // Filter out empty slots
  const playersWithData = rows.filter(row => {
    if (row.player) return row.player.accrued_stats;
    if (row.playerData) return row.playerData.accrued_stats;
    return false;
  });
  
  if (playersWithData.length === 0) return totals;
  
  // Helper to get stats from row
  const getStats = (row) => {
    if (row.player) return row.player.accrued_stats;
    if (row.playerData) return row.playerData.accrued_stats;
    return null;
  };
  
  // Count static stats first
  if (isPitcher) {
    totals.games_played = playersWithData.reduce((sum, row) => {
      const stats = getStats(row);
      return sum + (stats?.active_games_played || stats?.games_played || 0);
    }, 0);
    
    totals.games_started = playersWithData.reduce((sum, row) => {
      const stats = getStats(row);
      return sum + (stats?.active_games_started || stats?.games_started || 0);
    }, 0);
  } else {
    totals.games_played = playersWithData.reduce((sum, row) => {
      const stats = getStats(row);
      return sum + (stats?.active_games_played || stats?.games_played || 0);
    }, 0);
    
    totals.at_bats = playersWithData.reduce((sum, row) => {
      const stats = getStats(row);
      return sum + (stats?.active_at_bats || stats?.at_bats || 0);
    }, 0);
    
    totals.hits = playersWithData.reduce((sum, row) => {
      const stats = getStats(row);
      return sum + (stats?.active_hits || stats?.hits || 0);
    }, 0);
  }
  
  // Process each stat config
  statConfigs.forEach(config => {
    const field = config.field;
    
    // Determine if this is a rate stat that needs weighted average
    const isRateStat = config.decimals === 3 || 
                       ['avg', 'obp', 'slg', 'ops', 'era', 'whip', 'k9', 'bb9'].some(s => field.includes(s));
    
    if (isRateStat) {
      // Calculate weighted average based on stat type
      if (field.includes('avg') || field === 'batting_average') {
        // AVG = H / AB
        const totalHits = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_hits || stats?.hits || 0);
        }, 0);
        const totalAB = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_at_bats || stats?.at_bats || 0);
        }, 0);
        totals[field] = totalAB > 0 ? totalHits / totalAB : 0;
        
      } else if (field.includes('obp') || field === 'on_base_pct') {
        // OBP = (H + BB + HBP) / (AB + BB + HBP + SF)
        const totalH = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_hits || stats?.hits || 0);
        }, 0);
        const totalBB = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_walks || stats?.walks || 0);
        }, 0);
        const totalHBP = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_hit_by_pitch || stats?.hit_by_pitch || 0);
        }, 0);
        const totalAB = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_at_bats || stats?.at_bats || 0);
        }, 0);
        const totalSF = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_sac_flies || stats?.sac_flies || 0);
        }, 0);
        const denominator = totalAB + totalBB + totalHBP + totalSF;
        totals[field] = denominator > 0 ? (totalH + totalBB + totalHBP) / denominator : 0;
        
      } else if (field.includes('slg') || field === 'slugging_pct') {
        // SLG = Total Bases / AB
        const totalBases = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          const singles = (stats?.active_hits || stats?.hits || 0) - 
                         (stats?.active_doubles || stats?.doubles || 0) -
                         (stats?.active_triples || stats?.triples || 0) -
                         (stats?.active_home_runs || stats?.home_runs || 0);
          const doubles = (stats?.active_doubles || stats?.doubles || 0) * 2;
          const triples = (stats?.active_triples || stats?.triples || 0) * 3;
          const hrs = (stats?.active_home_runs || stats?.home_runs || 0) * 4;
          return sum + singles + doubles + triples + hrs;
        }, 0);
        const totalAB = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_at_bats || stats?.at_bats || 0);
        }, 0);
        totals[field] = totalAB > 0 ? totalBases / totalAB : 0;
        
      } else if (field.includes('era')) {
        // ERA = (ER * 9) / IP
        const totalER = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_earned_runs || stats?.earned_runs || 0);
        }, 0);
        const totalIP = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_innings_pitched || stats?.innings_pitched || 0);
        }, 0);
        totals[field] = totalIP > 0 ? (totalER * 9) / totalIP : 0;
        
      } else if (field.includes('whip')) {
        // WHIP = (H + BB) / IP
        const totalH = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_hits_allowed || stats?.hits_allowed || 0);
        }, 0);
        const totalBB = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_walks_allowed || stats?.walks_allowed || 0);
        }, 0);
        const totalIP = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_innings_pitched || stats?.innings_pitched || 0);
        }, 0);
        totals[field] = totalIP > 0 ? (totalH + totalBB) / totalIP : 0;
        
      } else if (field.includes('k9') || field.includes('k_9')) {
        // K/9 = (K * 9) / IP
        const totalK = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_strikeouts || stats?.strikeouts || 0);
        }, 0);
        const totalIP = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_innings_pitched || stats?.innings_pitched || 0);
        }, 0);
        totals[field] = totalIP > 0 ? (totalK * 9) / totalIP : 0;
        
      } else if (field.includes('bb9') || field.includes('bb_9')) {
        // BB/9 = (BB * 9) / IP
        const totalBB = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_walks_allowed || stats?.walks_allowed || 0);
        }, 0);
        const totalIP = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.active_innings_pitched || stats?.innings_pitched || 0);
        }, 0);
        totals[field] = totalIP > 0 ? (totalBB * 9) / totalIP : 0;
        
      } else {
        // Unknown rate stat - just sum it
        totals[field] = playersWithData.reduce((sum, row) => {
          const stats = getStats(row);
          return sum + (stats?.[`active_${field}`] || stats?.[field] || 0);
        }, 0);
      }
    } else {
      // Counting stat - simple sum
      totals[field] = playersWithData.reduce((sum, row) => {
        const stats = getStats(row);
        return sum + (stats?.[`active_${field}`] || stats?.[field] || 0);
      }, 0);
    }
  });
  
  return totals;
};
