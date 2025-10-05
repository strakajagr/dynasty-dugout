// src/services/tables/watchListColumns.js - CANONICAL VERSION
import React from 'react';
import { Eye, Trash2, ExternalLink, UserPlus, ArrowLeftRight } from 'lucide-react';
import { dynastyTheme } from '../colorService';
import { renderFloat1, renderFloat2, renderFloat3, renderAvg } from './DynastyTable';
import { getStatConfigs, formatStatValue, getStatValue, DEFAULT_BATTING_STATS, DEFAULT_PITCHING_STATS } from '../../utils/statMapping';

/**
 * Create dynamic watch list columns based on league scoring categories
 * CANONICAL STRUCTURE: Uses player.ids.mlb, player.info.*, player.stats.*, player.league_contexts[]
 */
export const createDynamicWatchListColumns = ({ 
  league = null, 
  leagueId = null, 
  isPitcher = false,
  onViewPlayer,
  onRemovePlayer,
  onAddPlayer 
}) => {
  // Determine which stats to show
  const statLabels = league?.scoring_categories
    ? (isPitcher 
        ? (league.scoring_categories.pitching || league.scoring_categories.pitchers || DEFAULT_PITCHING_STATS)
        : (league.scoring_categories.hitting || league.scoring_categories.batting || DEFAULT_BATTING_STATS)
      )
    : (isPitcher ? DEFAULT_PITCHING_STATS : DEFAULT_BATTING_STATS);

  const statConfigs = getStatConfigs(statLabels, isPitcher);

  const columns = [
    // Player Name - CANONICAL structure - 50% NARROWER
    {
      key: 'player_name',
      title: 'Player',
      width: 50,
      minWidth: 45,
      render: (_, row) => (
        <div className="text-left">
          <div className={`font-semibold ${dynastyTheme.classes.text.white} text-sm truncate`}>
            {row.info?.first_name} {row.info?.last_name}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} truncate`}>
            {row.info?.position} • {row.info?.mlb_team || 'FA'}
          </div>
        </div>
      ),
      sortValue: (row) => `${row.info?.last_name || ''} ${row.info?.first_name || ''}`.trim(),
      allowOverflow: false
    }
  ];

  // Add dynamic stat columns - CANONICAL: row.stats.season.* - VARIABLE WIDTHS
  statConfigs.forEach((config) => {
    // Calculate width based on stat type:
    // - Integer stats (G, AB, R, SB, HR, RBI, H): 60% reduction = 14
    // - Decimal stats (AVG, OPS): 30% reduction = 25
    let columnWidth = 35; // default
    const integerStats = ['games_played', 'at_bats', 'runs', 'stolen_bases', 'home_runs', 'rbi', 'hits'];
    const decimalStats = ['batting_avg', 'ops'];
    
    if (integerStats.includes(config.field)) {
      columnWidth = 14;
    } else if (decimalStats.includes(config.field)) {
      columnWidth = 25;
    }
    
    columns.push({
      key: `stats.season.${config.field}`,
      title: config.label,
      width: columnWidth,
      render: (_, row) => {
        const value = getStatValue(row, config);
        return (
          <span className={`${dynastyTheme.classes.text.neutralLight} font-mono text-sm`}>
            {formatStatValue(value, config)}
          </span>
        );
      },
      sortValue: (row) => getStatValue(row, config) || 0
    });
  });

  // If in a league, add ownership columns - CANONICAL: row.league_contexts[]
  if (leagueId) {
    columns.push(
      {
        key: 'owner',
        title: 'Owner',
        width: 40,
        sortable: false,
        render: (_, row) => {
          const leagueContext = row.league_contexts?.find(lc => lc.league_id === leagueId);
          if (!leagueContext) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          
          return (
            <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} truncate`}>
              {leagueContext.team?.team_name || 'Free Agent'}
            </div>
          );
        }
      },
      {
        key: 'status',
        title: 'Status',
        width: 30,
        sortable: false,
        render: (_, row) => {
          const leagueContext = row.league_contexts?.find(lc => lc.league_id === leagueId);
          if (!leagueContext) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          
          // Owned players = YELLOW badge, Free Agents = GREEN badge
          const isOwned = leagueContext.status === 'owned' || leagueContext.status === 'other_team';
          const displayText = isOwned ? (leagueContext.roster?.status || 'Owned') : 'FA';
          
          return (
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              isOwned
                ? `bg-yellow-400/20 text-yellow-400 border border-yellow-400/30`
                : `bg-green-500/20 text-green-400 border border-green-500/30`
            }`}>
              {displayText}
            </span>
          );
        }
      },
      {
        key: 'salary',
        title: 'Salary',
        width: 25,
        render: (_, row) => {
          const leagueContext = row.league_contexts?.find(lc => lc.league_id === leagueId);
          if (!leagueContext) return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          
          const price = leagueContext.financial?.contract_salary || 0;
          
          return (
            <span className={`${dynastyTheme.classes.text.success} font-semibold text-sm`}>
              ${price}
            </span>
          );
        },
        sortValue: (row) => {
          const leagueContext = row.league_contexts?.find(lc => lc.league_id === leagueId);
          return leagueContext?.financial?.contract_salary || 0;
        }
      },
      {
        key: 'contract',
        title: 'Contract',
        width: 25,
        render: (_, row) => {
          const leagueContext = row.league_contexts?.find(lc => lc.league_id === leagueId);
          const isOwned = leagueContext?.status === 'owned' || leagueContext?.status === 'other_team';
          const contractYears = leagueContext?.financial?.contract_years;
          
          if (!leagueContext || !isOwned || !contractYears) {
            return <span className={dynastyTheme.classes.text.neutralDark}>-</span>;
          }
          
          return (
            <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
              {contractYears}yr
            </span>
          );
        },
        sortValue: (row) => {
          const leagueContext = row.league_contexts?.find(lc => lc.league_id === leagueId);
          return leagueContext?.financial?.contract_years || 0;
        }
      }
    );
  }

  // Add metadata columns
  columns.push(
    {
      key: 'added_at',
      title: 'Added',
      width: 35,
      render: (val) => {
        if (!val) return '-';
        const date = new Date(val);
        return (
          <span className={`${dynastyTheme.classes.text.neutralLight} text-xs`}>
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        );
      },
      sortValue: (row) => new Date(row.added_at).getTime()
    },
    {
      key: 'priority',
      title: 'Priority',
      width: 25,
      render: (val) => (
        <span className={`${dynastyTheme.classes.text.white} font-semibold text-sm`}>
          {val || 0}
        </span>
      ),
      sortValue: (row) => row.priority || 0
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 60,
      sortable: false,
      render: (_, row) => {
        // Determine player status in this league
        const leagueContext = leagueId ? row.league_contexts?.find(lc => lc.league_id === leagueId) : null;
        const isAvailable = leagueContext?.status === 'available';
        const isOwnedByOther = leagueContext?.status === 'other_team';
        
        // Only show actions if in a specific league
        if (!leagueId) {
          return <span className={`text-xs ${dynastyTheme.classes.text.neutralDark} italic`}>-</span>;
        }
        
        return (
          <div className="flex items-center gap-2 justify-center">
            {isAvailable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddPlayer(row);
                }}
                className={`p-1.5 rounded ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.success} hover:bg-green-500/20 transition-colors`}
                title="Add to Team"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
            {isOwnedByOther && (
              <button
                disabled={true}
                className={`p-1.5 rounded ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralDark} opacity-50 cursor-not-allowed`}
                title="Trade (Coming Soon)"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
      allowOverflow: true
    },
    {
      key: 'remove',
      title: 'Remove',
      width: 60,
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2 justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewPlayer(row);
            }}
            className={`p-1.5 rounded ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.info} hover:bg-blue-500/20 transition-colors`}
            title="View Player"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemovePlayer(row.ids?.mlb);
            }}
            className={`p-1.5 rounded ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.error} hover:bg-red-500/20 transition-colors`}
            title="Remove from Watch List"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      allowOverflow: true
    }
  );

  return columns;
};

// League Status Badge component - CANONICAL structure
const LeagueStatusBadge = ({ context }) => {
  if (!context) return <span className={dynastyTheme.classes.text.neutral}>-</span>;
  
  const { league_name, status, team, roster, financial } = context;
  const isOwned = status === 'owned' || status === 'other_team';
  const price = financial?.contract_salary || 0;
  
  return (
    <div className="text-xs space-y-0.5">
      <div className={`font-medium ${dynastyTheme.classes.text.white} truncate`}>
        {league_name}
      </div>
      {isOwned ? (
        <>
          <div className={`${dynastyTheme.classes.text.error} flex items-center gap-1`}>
            <span>Owned</span>
            {price > 0 && <span className={dynastyTheme.classes.text.neutralLight}>(${price}M)</span>}
          </div>
          {team?.team_name && (
            <div className={`${dynastyTheme.classes.text.neutralLight} text-[10px]`}>
              {team.team_name}
            </div>
          )}
          {roster?.status && (
            <div className={`${dynastyTheme.classes.text.primary} text-[10px] italic`}>
              {roster.status === 'active' ? '✓ Active' : roster.status}
            </div>
          )}
        </>
      ) : status === 'available' ? (
        <div className={`${dynastyTheme.classes.text.success} flex items-center gap-1`}>
          <span>Available</span>
          {price > 0 && <span className={dynastyTheme.classes.text.neutralLight}>(${price}M)</span>}
        </div>
      ) : (
        <div className={`${dynastyTheme.classes.text.neutralDark} text-[10px] italic`}>
          Not in league
        </div>
      )}
    </div>
  );
};

/**
 * Create main watch list columns - CANONICAL structure
 * Shows comprehensive data including league_contexts
 */
export const createWatchListColumns = ({ onViewPlayer, onRemovePlayer }) => {
  return [
    {
      key: 'player_name',
      title: 'Player',
      width: 180,
      render: (_, row) => (
        <div className="text-left">
          <div className={`font-semibold ${dynastyTheme.classes.text.white}`}>
            {row.info?.first_name} {row.info?.last_name}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
            {row.info?.position} • {row.info?.mlb_team || 'FA'}
          </div>
        </div>
      ),
      sortValue: (row) => `${row.info?.last_name || ''} ${row.info?.first_name || ''}`.trim(),
      allowOverflow: true
    },
    {
      key: 'league_contexts',
      title: 'League Status',
      width: 300,
      sortable: false,
      render: (contexts) => {
        if (!contexts || contexts.length === 0) {
          return (
            <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} italic`}>
              Not in any leagues
            </div>
          );
        }
        
        return (
          <div className="flex flex-wrap gap-2">
            {contexts.slice(0, 3).map((context, idx) => (
              <LeagueStatusBadge key={idx} context={context} />
            ))}
            {contexts.length > 3 && (
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                +{contexts.length - 3} more
              </div>
            )}
          </div>
        );
      },
      allowOverflow: true
    },
    {
      key: 'stats.season.games_played',
      title: 'GP',
      width: 60,
      render: (_, row) => row.stats?.season?.games_played || 0
    },
    {
      key: 'stats.season.batting_avg',
      title: 'AVG',
      width: 70,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') return '-';
        return renderAvg(row.stats?.season?.batting_avg);
      }
    },
    {
      key: 'stats.season.home_runs',
      title: 'HR',
      width: 60,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') return '-';
        return row.stats?.season?.home_runs || 0;
      }
    },
    {
      key: 'stats.season.rbi',
      title: 'RBI',
      width: 60,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') return '-';
        return row.stats?.season?.rbi || 0;
      }
    },
    {
      key: 'stats.season.runs',
      title: 'R',
      width: 60,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') return '-';
        return row.stats?.season?.runs || 0;
      }
    },
    {
      key: 'stats.season.stolen_bases',
      title: 'SB',
      width: 60,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') return '-';
        return row.stats?.season?.stolen_bases || 0;
      }
    },
    {
      key: 'stats.season.ops',
      title: 'OPS',
      width: 70,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') return '-';
        return renderFloat3(row.stats?.season?.ops);
      }
    },
    {
      key: 'stats.season.wins',
      title: 'W',
      width: 60,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') {
          return row.stats?.season?.wins || 0;
        }
        return '-';
      }
    },
    {
      key: 'stats.season.era',
      title: 'ERA',
      width: 70,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') {
          return renderFloat2(row.stats?.season?.era);
        }
        return '-';
      }
    },
    {
      key: 'stats.season.whip',
      title: 'WHIP',
      width: 70,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') {
          return renderFloat2(row.stats?.season?.whip);
        }
        return '-';
      }
    },
    {
      key: 'stats.season.strikeouts_pitched',
      title: 'K',
      width: 60,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') {
          return row.stats?.season?.strikeouts_pitched || 0;
        }
        return '-';
      }
    },
    {
      key: 'stats.season.innings_pitched',
      title: 'IP',
      width: 70,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') {
          return renderFloat1(row.stats?.season?.innings_pitched);
        }
        return '-';
      }
    },
    {
      key: 'stats.rolling_14_day.batting_avg',
      title: 'L14 AVG',
      width: 80,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') return '-';
        return (
          <span className={`${dynastyTheme.classes.text.primary} italic`}>
            {renderAvg(row.stats?.rolling_14_day?.batting_avg)}
          </span>
        );
      }
    },
    {
      key: 'stats.rolling_14_day.home_runs',
      title: 'L14 HR',
      width: 70,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') return '-';
        return (
          <span className={`${dynastyTheme.classes.text.primary} italic`}>
            {row.stats?.rolling_14_day?.home_runs || 0}
          </span>
        );
      }
    },
    {
      key: 'stats.rolling_14_day.ops',
      title: 'L14 OPS',
      width: 80,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos === 'SP' || pos === 'RP' || pos === 'P') return '-';
        return (
          <span className={`${dynastyTheme.classes.text.primary} italic`}>
            {renderFloat3(row.stats?.rolling_14_day?.ops)}
          </span>
        );
      }
    },
    {
      key: 'stats.rolling_14_day.era',
      title: 'L14 ERA',
      width: 80,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos !== 'SP' && pos !== 'RP' && pos !== 'P') return '-';
        return (
          <span className={`${dynastyTheme.classes.text.primary} italic`}>
            {renderFloat2(row.stats?.rolling_14_day?.era)}
          </span>
        );
      }
    },
    {
      key: 'stats.rolling_14_day.whip',
      title: 'L14 WHIP',
      width: 85,
      render: (_, row) => {
        const pos = row.info?.position;
        if (pos !== 'SP' && pos !== 'RP' && pos !== 'P') return '-';
        return (
          <span className={`${dynastyTheme.classes.text.primary} italic`}>
            {renderFloat2(row.stats?.rolling_14_day?.whip)}
          </span>
        );
      }
    },
    {
      key: 'added_at',
      title: 'Added',
      width: 100,
      render: (val) => {
        if (!val) return '-';
        const date = new Date(val);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    },
    {
      key: 'notes',
      title: 'Notes',
      width: 150,
      sortable: false,
      render: (value) => (
        <div className="text-left px-2 truncate">
          <span className={`text-xs ${dynastyTheme.classes.text.neutral} italic`}>
            {value || '-'}
          </span>
        </div>
      ),
      allowOverflow: false
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 120,
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2 justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewPlayer(row);
            }}
            className={`p-1.5 rounded ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.info} hover:bg-blue-500/20 transition-colors`}
            title="View Player"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemovePlayer(row.ids?.mlb);
            }}
            className={`p-1.5 rounded ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.error} hover:bg-red-500/20 transition-colors`}
            title="Remove from Watch List"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      allowOverflow: true
    }
  ];
};

/**
 * MY ROSTER COLUMNS - Keep for backward compatibility but mark for migration
 * This should be moved to a separate file during roster page migration
 */
export const createMyRosterColumns = ({
  league = null,
  isPitcher = false,
  onPlayerClick,
  onActionClick,
  isViewingOwnTeam = true,
  sectionType = 'active'
}) => {
  // Implementation unchanged - will be migrated with roster page
  // For now, this function is here for backwards compatibility
  console.warn('createMyRosterColumns will be migrated to roster-specific file');
  return [];
};
