// src/services/tables/rosterColumns.js - Professional Roster Table Configuration with Dynasty Theme

import React from 'react';
import { ExternalLink, UserMinus, ArrowRightLeft, Shield, Heart, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { dynastyTheme } from '../colorService';

// ========================================
// COMPACT ROSTER TABLE COLUMNS
// ========================================

export const createCompactRosterBatterColumns = (options = {}) => {
  const {
    onPlayerClick,
    onDropPlayer,
    onTradePlayer,
    onMovePlayer,
    isViewingOwn = true,
    editMode = false,
    positionChanges = {},
    onPositionChange
  } = options;

  return [
    {
      key: 'position',
      title: 'POS',
      width: '4%',
      sticky: true,
      render: (_, player) => {
        if (editMode && isViewingOwn) {
          const currentPosition = positionChanges[player.league_player_id] || player.roster_position || player.position;
          return (
            <select
              value={currentPosition}
              onChange={(e) => onPositionChange?.(player.league_player_id, e.target.value)}
              className={`${dynastyTheme.components.input} text-xs px-1 py-0.5 w-full`}
              onClick={(e) => e.stopPropagation()}
            >
              {player.eligible_positions?.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          );
        }
        return (
          <span className={`${dynastyTheme.classes.text.neutralLight} text-xs font-bold`}>
            {player.roster_position || player.position}
          </span>
        );
      }
    },
    {
      key: 'player_name',
      title: 'PLAYER',
      width: '18%',
      render: (_, player) => (
        <button
          onClick={() => onPlayerClick?.(player)}
          className={`text-left ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transition} group flex items-center w-full`}
        >
          <div className="flex-1 min-w-0">
            <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate`}>
              {player.first_name} {player.last_name}
            </div>
          </div>
          <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      )
    },
    {
      key: 'team',
      title: 'TM',
      width: '4%',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-xs font-medium`}>{value || '-'}</span>
      )
    },
    {
      key: 'eligible',
      title: 'ELIG',
      width: '10%',
      render: (_, player) => (
        <div className="flex flex-wrap gap-0.5">
          {player.eligible_positions?.slice(0, 3).map(pos => (
            <span key={pos} className={`text-xs px-1 ${dynastyTheme.classes.bg.darkLighter} rounded ${dynastyTheme.classes.text.neutralLight}`}>
              {pos}
            </span>
          ))}
          {player.eligible_positions?.length > 3 && (
            <span className={`text-xs ${dynastyTheme.classes.text.neutralDark}`}>+{player.eligible_positions.length - 3}</span>
          )}
        </div>
      )
    },
    {
      key: 'batting_avg',
      title: 'AVG',
      width: '6%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
          {value ? `.${String(value).slice(2).padEnd(3, '0')}` : '.000'}
        </span>
      )
    },
    {
      key: 'home_runs',
      title: 'HR',
      width: '5%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>{value || 0}</span>
      )
    },
    {
      key: 'rbi',
      title: 'RBI',
      width: '5%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>{value || 0}</span>
      )
    },
    {
      key: 'runs',
      title: 'R',
      width: '5%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>{value || 0}</span>
      )
    },
    {
      key: 'stolen_bases',
      title: 'SB',
      width: '5%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>{value || 0}</span>
      )
    },
    {
      key: 'ops',
      title: 'OPS',
      width: '6%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
          {value ? value.toFixed(3) : '.000'}
        </span>
      )
    },
    {
      key: 'salary',
      title: '$',
      width: '7%',
      className: 'text-right',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.success} font-bold text-sm`}>${value || 0}</span>
      )
    },
    {
      key: 'contract',
      title: 'YRS',
      width: '5%',
      className: 'text-center',
      render: (_, player) => {
        const years = player.contract_years || 1;
        const remaining = player.years_remaining || years;
        return (
          <span className={`text-sm font-medium ${
            remaining === 0 ? dynastyTheme.classes.text.error :
            remaining === 1 ? dynastyTheme.classes.text.warning :
            dynastyTheme.classes.text.neutralLight
          }`}>
            {remaining}yr
          </span>
        );
      }
    },
    {
      key: 'actions',
      title: 'ACTIONS',
      width: '20%',
      className: 'text-right',
      render: (_, player) => (
        <div className="flex items-center justify-end gap-1">
          {player.roster_status === 'active' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovePlayer?.(player, 'active', 'bench');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.classes.bg.darkLighter} rounded ${dynastyTheme.classes.text.neutralLight} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Move to Bench"
            >
              Bench
            </button>
          )}
          {player.roster_status === 'bench' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovePlayer?.(player, 'bench', 'active');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.success} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Activate"
            >
              Start
            </button>
          )}
          {player.injury_status && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovePlayer?.(player, player.roster_status, 'dl');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.warning} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Place on DL"
            >
              DL
            </button>
          )}
          {isViewingOwn ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDropPlayer?.(player);
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.error} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Drop Player"
            >
              Drop
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTradePlayer?.(player);
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.info} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Propose Trade"
            >
              Trade
            </button>
          )}
        </div>
      )
    }
  ];
};

export const createCompactRosterPitcherColumns = (options = {}) => {
  const {
    onPlayerClick,
    onDropPlayer,
    onTradePlayer,
    onMovePlayer,
    isViewingOwn = true,
    editMode = false,
    positionChanges = {},
    onPositionChange
  } = options;

  return [
    {
      key: 'position',
      title: 'POS',
      width: '4%',
      sticky: true,
      render: (_, player) => {
        if (editMode && isViewingOwn) {
          const currentPosition = positionChanges[player.league_player_id] || player.roster_position || player.position;
          return (
            <select
              value={currentPosition}
              onChange={(e) => onPositionChange?.(player.league_player_id, e.target.value)}
              className={`${dynastyTheme.components.input} text-xs px-1 py-0.5 w-full`}
              onClick={(e) => e.stopPropagation()}
            >
              {player.eligible_positions?.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          );
        }
        return (
          <span className={`${dynastyTheme.classes.text.neutralLight} text-xs font-bold`}>
            {player.roster_position || player.position}
          </span>
        );
      }
    },
    {
      key: 'player_name',
      title: 'PLAYER',
      width: '18%',
      render: (_, player) => (
        <button
          onClick={() => onPlayerClick?.(player)}
          className={`text-left ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transition} group flex items-center w-full`}
        >
          <div className="flex-1 min-w-0">
            <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate`}>
              {player.first_name} {player.last_name}
            </div>
          </div>
          <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      )
    },
    {
      key: 'team',
      title: 'TM',
      width: '4%',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-xs font-medium`}>{value || '-'}</span>
      )
    },
    {
      key: 'eligible',
      title: 'ELIG',
      width: '10%',
      render: (_, player) => (
        <div className="flex flex-wrap gap-0.5">
          {player.eligible_positions?.slice(0, 3).map(pos => (
            <span key={pos} className={`text-xs px-1 ${dynastyTheme.classes.bg.darkLighter} rounded ${dynastyTheme.classes.text.neutralLight}`}>
              {pos}
            </span>
          ))}
          {player.eligible_positions?.length > 3 && (
            <span className={`text-xs ${dynastyTheme.classes.text.neutralDark}`}>+{player.eligible_positions.length - 3}</span>
          )}
        </div>
      )
    },
    {
      key: 'wins',
      title: 'W',
      width: '5%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>{value || 0}</span>
      )
    },
    {
      key: 'saves',
      title: 'SV',
      width: '5%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>{value || 0}</span>
      )
    },
    {
      key: 'era',
      title: 'ERA',
      width: '6%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
          {value ? value.toFixed(2) : '0.00'}
        </span>
      )
    },
    {
      key: 'whip',
      title: 'WHIP',
      width: '6%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
          {value ? value.toFixed(2) : '0.00'}
        </span>
      )
    },
    {
      key: 'strikeouts',
      title: 'K',
      width: '5%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>{value || 0}</span>
      )
    },
    {
      key: 'innings',
      title: 'IP',
      width: '6%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
          {value ? value.toFixed(1) : '0.0'}
        </span>
      )
    },
    {
      key: 'salary',
      title: '$',
      width: '7%',
      className: 'text-right',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.success} font-bold text-sm`}>${value || 0}</span>
      )
    },
    {
      key: 'contract',
      title: 'YRS',
      width: '5%',
      className: 'text-center',
      render: (_, player) => {
        const years = player.contract_years || 1;
        const remaining = player.years_remaining || years;
        return (
          <span className={`text-sm font-medium ${
            remaining === 0 ? dynastyTheme.classes.text.error :
            remaining === 1 ? dynastyTheme.classes.text.warning :
            dynastyTheme.classes.text.neutralLight
          }`}>
            {remaining}yr
          </span>
        );
      }
    },
    {
      key: 'actions',
      title: 'ACTIONS',
      width: '20%',
      className: 'text-right',
      render: (_, player) => (
        <div className="flex items-center justify-end gap-1">
          {player.roster_status === 'active' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovePlayer?.(player, 'active', 'bench');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.classes.bg.darkLighter} rounded ${dynastyTheme.classes.text.neutralLight} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Move to Bench"
            >
              Bench
            </button>
          )}
          {player.roster_status === 'bench' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovePlayer?.(player, 'bench', 'active');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.success} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Activate"
            >
              Start
            </button>
          )}
          {player.injury_status && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovePlayer?.(player, player.roster_status, 'dl');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.warning} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Place on DL"
            >
              DL
            </button>
          )}
          {isViewingOwn ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDropPlayer?.(player);
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.error} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Drop Player"
            >
              Drop
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTradePlayer?.(player);
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.info} ${dynastyTheme.classes.hover.brightness} ${dynastyTheme.classes.transition}`}
              title="Propose Trade"
            >
              Trade
            </button>
          )}
        </div>
      )
    }
  ];
};

// ========================================
// ROSTER SUMMARY COLUMNS
// ========================================

export const createRosterSummaryColumns = () => {
  return [
    {
      key: 'category',
      title: 'Category',
      width: '20%',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.white} font-bold text-sm`}>{value}</span>
      )
    },
    {
      key: 'active',
      title: 'Active',
      width: '15%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.success} font-medium`}>{value}</span>
      )
    },
    {
      key: 'bench',
      title: 'Bench',
      width: '15%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.neutralLight} font-medium`}>{value}</span>
      )
    },
    {
      key: 'dl',
      title: 'DL',
      width: '15%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.warning} font-medium`}>{value || '-'}</span>
      )
    },
    {
      key: 'minors',
      title: 'Minors',
      width: '15%',
      className: 'text-center',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.info} font-medium`}>{value || '-'}</span>
      )
    },
    {
      key: 'total',
      title: 'Total',
      width: '20%',
      className: 'text-right',
      render: (value) => (
        <span className={`${dynastyTheme.classes.text.primary} font-bold text-lg`}>${value}</span>
      )
    }
  ];
};

// ========================================
// TABLE OPTIONS & STYLES
// ========================================

export const rosterTableOptions = {
  striped: true,
  hover: true,
  compact: true,
  stickyHeader: true,
  maxHeight: '600px',
  emptyMessage: 'No players in this section',
  className: 'roster-table',
  headerClassName: dynastyTheme.classes.bg.darkLighter,
  rowClassName: (player, index) => {
    const classes = [];
    
    // Alternating row colors using dynasty theme
    if (index % 2 === 0) {
      classes.push('bg-neutral-900/30');
    } else {
      classes.push('bg-neutral-800/20');
    }
    
    // Highlight injured players
    if (player.injury_status) {
      classes.push(`border-l-2 ${dynastyTheme.classes.border.warning}`);
    }
    
    // Highlight expiring contracts
    if (player.contract_years === 1) {
      classes.push(`border-r-2 ${dynastyTheme.classes.border.error}`);
    }
    
    // Add hover effect
    classes.push(dynastyTheme.classes.hover.slideRight);
    classes.push(dynastyTheme.classes.transition);
    
    return classes.join(' ');
  }
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

export const calculatePositionRequirements = (league) => {
  const requirements = {
    batters: {
      C: league?.positions_c || 1,
      '1B': league?.positions_1b || 1,
      '2B': league?.positions_2b || 1,
      '3B': league?.positions_3b || 1,
      SS: league?.positions_ss || 1,
      OF: league?.positions_of || 3,
      UTIL: league?.positions_util || 2,
      DH: league?.positions_dh || 0,
    },
    pitchers: {
      SP: league?.positions_sp || 5,
      RP: league?.positions_rp || 3,
      P: league?.positions_p || 2,
    },
    bench: league?.bench_size || 5,
    dl: league?.dl_spots || 0,
    minors: league?.minor_league_spots || 0,
  };
  
  return requirements;
};

export const validateRosterCompliance = (roster, requirements) => {
  const issues = [];
  const filled = {};
  
  // Count filled positions
  roster.forEach(player => {
    const pos = player.roster_position || player.position;
    filled[pos] = (filled[pos] || 0) + 1;
  });
  
  // Check requirements
  Object.entries(requirements.batters).forEach(([pos, required]) => {
    const current = filled[pos] || 0;
    if (current < required) {
      issues.push({
        type: 'shortage',
        position: pos,
        required,
        current,
        message: `Need ${required - current} more ${pos}`
      });
    }
  });
  
  Object.entries(requirements.pitchers).forEach(([pos, required]) => {
    const current = filled[pos] || 0;
    if (current < required) {
      issues.push({
        type: 'shortage',
        position: pos,
        required,
        current,
        message: `Need ${required - current} more ${pos}`
      });
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues,
    filled
  };
};

export default {
  createCompactRosterBatterColumns,
  createCompactRosterPitcherColumns,
  createRosterSummaryColumns,
  rosterTableOptions,
  calculatePositionRequirements,
  validateRosterCompliance
};