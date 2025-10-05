// src/services/tables/myRosterColumns.js - CANONICAL ROSTER COLUMNS FOR MY ROSTER PAGE
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { dynastyTheme } from '../colorService';
import { renderDefault, renderFloat1, renderFloat2, renderFloat3, renderAvg } from './DynastyTable';

/**
 * Create columns for ACTIVE LINEUP section
 * Shows position slots with either a player or empty slot
 * CANONICAL: player.ids.mlb, player.info.*, player.stats.season.*, player.financial.*
 */
export const createActiveLineupColumns = ({
  statConfigs = [],
  onPlayerClick,
  onBenchPlayer,
  isViewingOwnTeam = true
}) => {
  const columns = [
    // Position Label
    {
      key: 'slotPosition',
      title: 'POS',
      width: 60,
      sortable: false,
      render: (_, row) => (
        <span className={`${dynastyTheme.classes.text.primary} text-xs font-bold uppercase tracking-wide`}>
          {row.slotPosition || '?'}
        </span>
      )
    },
    
    // Player Name (or Empty Slot)
    {
      key: 'player',
      title: 'Player',
      width: 200,
      sortable: false,
      allowOverflow: true,
      render: (_, row) => {
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
              <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate`}>
                {player.info?.first_name} {player.info?.last_name}
              </div>
              <div className={`${dynastyTheme.classes.text.neutralLight} text-xs truncate`}>
                {player.info?.mlb_team}
              </div>
            </div>
            <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        );
      }
    }
  ];

  // Add dynamic stat columns based on league settings
  statConfigs.forEach((config) => {
    columns.push({
      key: `stats.season.${config.field}`,
      title: config.label,
      width: 70,
      sortable: false,
      render: (_, row) => {
        if (!row.player) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        
        const value = row.player.stats?.season?.[config.field];
        
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        // Format based on config type
        if (config.format === 'avg') {
          return <span className={`${dynastyTheme.classes.text.neutralLight} font-mono text-sm`}>{renderAvg(value)}</span>;
        } else if (config.format === 'float2') {
          return <span className={`${dynastyTheme.classes.text.neutralLight} font-mono text-sm`}>{renderFloat2(value)}</span>;
        } else if (config.format === 'float3') {
          return <span className={`${dynastyTheme.classes.text.neutralLight} font-mono text-sm`}>{renderFloat3(value)}</span>;
        } else {
          return <span className={`${dynastyTheme.classes.text.neutralLight} font-mono text-sm`}>{renderDefault(value)}</span>;
        }
      }
    });
  });

  // Salary column
  columns.push({
    key: 'salary',
    title: 'Salary',
    width: 80,
    sortable: false,
    render: (_, row) => {
      if (!row.player) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
      
      const salary = row.player.financial?.contract_salary || row.player.league_context?.financial?.contract_salary || 0;
      
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
    width: 80,
    sortable: false,
    render: (_, row) => {
      if (!row.player) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
      
      const years = row.player.financial?.contract_years || row.player.league_context?.financial?.contract_years || 0;
      
      if (!years) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
      
      return (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
          {years}yr
        </span>
      );
    }
  });

  // Actions column (only if viewing own team)
  if (isViewingOwnTeam && onBenchPlayer) {
    columns.push({
      key: 'actions',
      title: 'Actions',
      width: 100,
      sortable: false,
      render: (_, row) => {
        if (!row.player) return null;
        
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBenchPlayer(row.player);
            }}
            className={`text-xs px-2 py-1 ${dynastyTheme.classes.bg.darkLighter} rounded text-neutral-300 hover:bg-yellow-400/20 ${dynastyTheme.classes.transitionFast}`}
          >
            Bench
          </button>
        );
      }
    });
  }

  return columns;
};

/**
 * Create columns for BENCH/DL/MINORS sections
 * Shows list of players with stats and actions
 * CANONICAL: player.ids.mlb, player.info.*, player.stats.season.*, player.financial.*
 */
export const createReservePlayersColumns = ({
  statConfigs = [],
  onPlayerClick,
  onActivatePlayer,
  onDropPlayer,
  onMovePlayer,
  isViewingOwnTeam = true,
  sectionType = 'bench' // 'bench', 'dl', 'minors'
}) => {
  const columns = [
    // Player Name
    {
      key: 'player_name',
      title: 'Player',
      width: 200,
      sortable: true,
      allowOverflow: true,
      render: (_, player) => (
        <button
          onClick={() => onPlayerClick(player)}
          className={`text-left ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transitionFast} flex items-center w-full group`}
        >
          <div className="flex-1 min-w-0">
            <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate`}>
              {player.info?.first_name} {player.info?.last_name}
            </div>
            <div className={`${dynastyTheme.classes.text.neutralLight} text-xs truncate`}>
              {player.info?.position} - {player.info?.mlb_team}
            </div>
          </div>
          <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      ),
      sortValue: (player) => `${player.info?.last_name || ''} ${player.info?.first_name || ''}`.trim()
    }
  ];

  // Add dynamic stat columns based on league settings
  statConfigs.forEach((config) => {
    columns.push({
      key: `stats.season.${config.field}`,
      title: config.label,
      width: 70,
      sortable: true,
      render: (_, player) => {
        const value = player.stats?.season?.[config.field];
        
        if (value === undefined || value === null) {
          return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
        }
        
        // Format based on config type
        if (config.format === 'avg') {
          return <span className={`${dynastyTheme.classes.text.neutralLight} font-mono text-sm`}>{renderAvg(value)}</span>;
        } else if (config.format === 'float2') {
          return <span className={`${dynastyTheme.classes.text.neutralLight} font-mono text-sm`}>{renderFloat2(value)}</span>;
        } else if (config.format === 'float3') {
          return <span className={`${dynastyTheme.classes.text.neutralLight} font-mono text-sm`}>{renderFloat3(value)}</span>;
        } else {
          return <span className={`${dynastyTheme.classes.text.neutralLight} font-mono text-sm`}>{renderDefault(value)}</span>;
        }
      },
      sortValue: (player) => player.stats?.season?.[config.field] || 0
    });
  });

  // Salary column
  columns.push({
    key: 'salary',
    title: 'Salary',
    width: 80,
    sortable: true,
    render: (_, player) => {
      if (sectionType === 'minors') {
        return <span className={`${dynastyTheme.classes.text.neutralDark} text-xs italic`}>-</span>;
      }
      
      const salary = player.financial?.contract_salary || player.league_context?.financial?.contract_salary || 0;
      
      return (
        <span className={`${dynastyTheme.classes.text.success} font-medium text-sm`}>
          ${salary}
        </span>
      );
    },
    sortValue: (player) => player.financial?.contract_salary || player.league_context?.financial?.contract_salary || 0
  });

  // Contract column
  columns.push({
    key: 'contract',
    title: 'Contract',
    width: 80,
    sortable: true,
    render: (_, player) => {
      if (sectionType === 'minors') {
        return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
      }
      
      const years = player.financial?.contract_years || player.league_context?.financial?.contract_years || 0;
      
      if (!years) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
      
      return (
        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
          {years}yr
        </span>
      );
    },
    sortValue: (player) => player.financial?.contract_years || player.league_context?.financial?.contract_years || 0
  });

  // Actions column (only if viewing own team)
  if (isViewingOwnTeam) {
    columns.push({
      key: 'actions',
      title: 'Actions',
      width: 150,
      sortable: false,
      render: (_, player) => (
        <div className="flex gap-1 justify-end">
          {sectionType === 'bench' && onActivatePlayer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onActivatePlayer(player);
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.success}`}
            >
              Start
            </button>
          )}
          {sectionType === 'dl' && onMovePlayer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovePlayer(player, 'dl', 'bench');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.info}`}
            >
              Activate
            </button>
          )}
          {sectionType === 'minors' && onMovePlayer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovePlayer(player, 'minors', 'bench');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.info}`}
              title="Call Up and Start Contract"
            >
              Call Up
            </button>
          )}
          {onDropPlayer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDropPlayer(player);
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.error}`}
            >
              Drop
            </button>
          )}
        </div>
      )
    });
  }

  return columns;
};

/**
 * Helper to get stat value from canonical player structure
 */
export const getStatValue = (player, config) => {
  return player?.stats?.season?.[config.field];
};

/**
 * Helper to format stat value based on config
 */
export const formatStatValue = (value, config) => {
  if (value === undefined || value === null) return '-';
  
  if (config.format === 'avg') {
    return renderAvg(value);
  } else if (config.format === 'float1') {
    return renderFloat1(value);
  } else if (config.format === 'float2') {
    return renderFloat2(value);
  } else if (config.format === 'float3') {
    return renderFloat3(value);
  } else {
    return renderDefault(value);
  }
};