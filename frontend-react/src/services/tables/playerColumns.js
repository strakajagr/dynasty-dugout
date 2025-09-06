// src/services/tables/playerColumns.js - PLAYER DATA TABLE COLUMNS WITH NARROW WIDTHS

import { dynastyTheme } from '../colorService';
import { renderDefault, renderFloat1, renderFloat2, renderFloat3, renderAvg } from './DynastyTable';

// =============================================================================
// FREE AGENT HITTER COLUMNS
// =============================================================================
export const createFreeAgentHitterColumns = (leagueSettings = {}, onPlayerAdd) => {
  return [
    {
      key: 'player_name',
      title: 'Name',
      width: 180,
      sortable: true,
      allowOverflow: true,
      render: (_, player) => (
        <div className="text-left group">
          <div className={`font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`}>
            {player.first_name} {player.last_name}
          </div>
        </div>
      )
    },
    {
      key: 'mlb_team',
      title: 'Team',
      width: 60,
      render: (v) => (
        <span className={dynastyTheme.components.badge.info}>
          {v || 'FA'}
        </span>
      )
    },
    {
      key: 'position',
      title: 'Pos',
      width: 80,
      render: (v) => (
        <span className={dynastyTheme.components.badge.warning}>
          {v || '--'}
        </span>
      )
    },
    { key: 'games_played', title: 'G', width: 50, render: renderDefault, isStatColumn: true },
    { key: 'at_bats', title: 'AB', width: 50, render: renderDefault, isStatColumn: true },
    { key: 'runs', title: 'R', width: 50, render: renderDefault, isStatColumn: true },
    { key: 'hits', title: 'H', width: 50, render: renderDefault, isStatColumn: true },
    { 
      key: 'home_runs', 
      title: 'HR', 
      width: 50, 
      render: (v) => (
        <span className={parseInt(v) >= 30 ? `${dynastyTheme.classes.text.primary} font-bold` : ''}>
          {renderDefault(v)}
        </span>
      ), 
      isStatColumn: true 
    },
    { 
      key: 'rbi', 
      title: 'RBI', 
      width: 60, 
      render: (v) => (
        <span className={parseInt(v) >= 100 ? `${dynastyTheme.classes.text.primary} font-bold` : ''}>
          {renderDefault(v)}
        </span>
      ), 
      isStatColumn: true 
    },
    { 
      key: 'stolen_bases', 
      title: 'SB', 
      width: 50, 
      render: (v) => (
        <span className={parseInt(v) >= 30 ? `${dynastyTheme.classes.text.success} font-bold` : ''}>
          {renderDefault(v)}
        </span>
      ), 
      isStatColumn: true 
    },
    { key: 'caught_stealing', title: 'CS', width: 50, render: renderDefault, isStatColumn: true },
    { key: 'walks', title: 'BB', width: 50, render: renderDefault, isStatColumn: true },
    { key: 'strikeouts', title: 'SO', width: 50, render: renderDefault, isStatColumn: true },
    { 
      key: 'batting_avg', 
      title: 'AVG', 
      width: 60, 
      render: (v) => {
        const avgNum = parseFloat(v ?? 0);
        return (
          <span className={avgNum >= 0.300 ? `${dynastyTheme.classes.text.primary} font-bold` : ''}>
            {renderAvg(v ?? 0)}
          </span>
        );
      }, 
      isStatColumn: true,
      renderL14: (v) => renderAvg(v ?? 0)
    },
    { 
      key: 'obp', 
      title: 'OBP', 
      width: 60, 
      render: (v) => {
        const obp = parseFloat(v ?? 0);
        return (
          <span className={obp >= 0.400 ? `${dynastyTheme.classes.text.primary} font-bold` : ''}>
            {renderAvg(v ?? 0)}
          </span>
        );
      }, 
      isStatColumn: true,
      renderL14: (v) => renderAvg(v ?? 0)
    },
    { key: 'slg', title: 'SLG', width: 60, render: (v) => renderAvg(v ?? 0), isStatColumn: true, renderL14: (v) => renderAvg(v ?? 0) },
    { 
      key: 'ops', 
      title: 'OPS', 
      width: 70, 
      render: (v) => {
        const ops = parseFloat(v ?? 0);
        return (
          <span className={ops >= 0.900 ? `${dynastyTheme.classes.text.primary} font-bold` : ''}>
            {renderFloat3(v ?? 0)}
          </span>
        );
      }, 
      isStatColumn: true,
      renderL14: (v) => renderFloat3(v ?? 0)
    },
    {
      key: 'contract',
      title: 'Price',
      width: 80,
      render: (_, player) => {
        const price = player.price || player.salary || 1.0;
        return (
          <span className={`font-mono ${dynastyTheme.classes.text.success}`}>
            ${price.toFixed(0)}
          </span>
        );
      }
    },
    {
      key: 'add_action',
      title: 'Action',
      width: 100,
      sortable: false,
      render: (_, player) => (
        <button 
          onClick={() => onPlayerAdd && onPlayerAdd(player)}
          className={`px-3 py-1 ${dynastyTheme.classes.bg.primary} text-black rounded hover:bg-yellow-300 text-xs`}
        >
          <span className="flex items-center gap-1">
            <span>➕</span>
            <span>Add</span>
          </span>
        </button>
      )
    }
  ];
};

// =============================================================================
// FREE AGENT PITCHER COLUMNS
// =============================================================================
export const createFreeAgentPitcherColumns = (leagueSettings = {}, onPlayerAdd) => {
  return [
    {
      key: 'player_name',
      title: 'Name',
      width: 180,
      sortable: true,
      allowOverflow: true,
      render: (_, player) => (
        <div className="text-left group">
          <div className={`font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`}>
            {player.first_name} {player.last_name}
          </div>
        </div>
      )
    },
    {
      key: 'mlb_team',
      title: 'Team',
      width: 60,
      render: (v) => (
        <span className={dynastyTheme.components.badge.info}>
          {v || 'FA'}
        </span>
      )
    },
    { key: 'games_played', title: 'G', width: 50, render: renderDefault, isStatColumn: true },
    { key: 'games_started', title: 'GS', width: 60, render: renderDefault, isStatColumn: true },
    { 
      key: 'wins', 
      title: 'W', 
      width: 50, 
      render: (v) => (
        <span className={parseInt(v) >= 15 ? `${dynastyTheme.classes.text.primary} font-bold` : ''}>
          {renderDefault(v)}
        </span>
      ), 
      isStatColumn: true 
    },
    { key: 'losses', title: 'L', width: 50, render: renderDefault, isStatColumn: true },
    { 
      key: 'saves', 
      title: 'SV', 
      width: 50, 
      render: (v) => (
        <span className={parseInt(v) >= 30 ? `${dynastyTheme.classes.text.success} font-bold` : ''}>
          {renderDefault(v)}
        </span>
      ), 
      isStatColumn: true 
    },
    { key: 'blown_saves', title: 'BS', width: 50, render: renderDefault, isStatColumn: true },
    { key: 'quality_starts', title: 'QS', width: 50, render: renderDefault, isStatColumn: true },
    { 
      key: 'innings_pitched', 
      title: 'IP', 
      width: 60, 
      render: (v) => {
        const ip = parseFloat(v ?? 0);
        return (
          <span className={ip >= 180 ? `${dynastyTheme.classes.text.primary} font-bold` : ''}>
            {renderFloat1(v ?? 0)}
          </span>
        );
      }, 
      isStatColumn: true,
      renderL14: (v) => renderFloat1(v ?? 0)
    },
    { 
      key: 'strikeouts_pitched', 
      title: 'SO', 
      width: 50, 
      render: (v) => (
        <span className={parseInt(v) >= 200 ? `${dynastyTheme.classes.text.primary} font-bold` : ''}>
          {renderDefault(v)}
        </span>
      ), 
      isStatColumn: true 
    },
    { key: 'walks_allowed', title: 'BB', width: 50, render: renderDefault, isStatColumn: true },
    { key: 'hits_allowed', title: 'H', width: 50, render: renderDefault, isStatColumn: true },
    { key: 'earned_runs', title: 'ER', width: 50, render: renderDefault, isStatColumn: true },
    { 
      key: 'era', 
      title: 'ERA', 
      width: 60, 
      render: (v) => {
        const era = parseFloat(v ?? 0);
        return (
          <span className={era <= 3.00 ? `${dynastyTheme.classes.text.success} font-bold` : era >= 5.00 ? dynastyTheme.classes.text.error : ''}>
            {renderFloat2(v ?? 0)}
          </span>
        );
      }, 
      isStatColumn: true,
      renderL14: (v) => renderFloat2(v ?? 0)
    },
    { 
      key: 'whip', 
      title: 'WHIP', 
      width: 70, 
      render: (v) => {
        const whip = parseFloat(v ?? 0);
        return (
          <span className={whip <= 1.10 ? `${dynastyTheme.classes.text.success} font-bold` : whip >= 1.50 ? dynastyTheme.classes.text.error : ''}>
            {renderFloat3(v ?? 0)}
          </span>
        );
      }, 
      isStatColumn: true,
      renderL14: (v) => renderFloat3(v ?? 0)
    },
    {
      key: 'k_per_9',
      title: 'K/9',
      width: 60,
      isStatColumn: true,
      render: (_, player) => {
        const ip = parseFloat(player.innings_pitched) || 0;
        const k = player.strikeouts_pitched || 0;
        const k9 = ip > 0 ? ((k * 9) / ip) : 0;
        return (
          <span className={k9 >= 10.0 ? `${dynastyTheme.classes.text.primary} font-bold` : ''}>
            {k9.toFixed(1)}
          </span>
        );
      },
      renderL14: (_, data) => {
        const ip = parseFloat(data?.innings_pitched) || 0;
        const k = data?.strikeouts_pitched || 0;
        return ip > 0 ? ((k * 9) / ip).toFixed(1) : '0.0';
      }
    },
    {
      key: 'contract',
      title: 'Price',
      width: 80,
      render: (_, player) => {
        const price = player.price || player.salary || 1.0;
        return (
          <span className={`font-mono ${dynastyTheme.classes.text.success}`}>
            ${price.toFixed(0)}
          </span>
        );
      }
    },
    {
      key: 'action',
      title: 'Action',
      width: 100,
      sortable: false,
      render: (_, player) => (
        <button 
          onClick={() => onPlayerAdd && onPlayerAdd(player)}
          className={`px-3 py-1 ${dynastyTheme.classes.bg.primary} text-black rounded hover:bg-yellow-300 text-xs`}
        >
          <span className="flex items-center gap-1">
            <span>➕</span>
            <span>Add</span>
          </span>
        </button>
      )
    }
  ];
};

// =============================================================================
// ROSTER COLUMNS
// =============================================================================
export const createRosterHitterColumns = (onPlayerDrop, onPlayerMove) => {
  return [
    {
      key: 'player_name',
      title: 'Name',
      width: 180,
      sortable: true,
      allowOverflow: true,
      render: (_, player) => (
        <div className="text-left group">
          <div className={`font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`}>
            {player.first_name} {player.last_name}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} group-hover:text-gray-300 transition-colors`}>
            {player.mlb_team || 'FA'} • #{player.jersey_number || '--'}
          </div>
        </div>
      )
    },
    {
      key: 'position',
      title: 'Pos',
      width: 60,
      render: (v) => (
        <span className={dynastyTheme.components.badge.warning}>
          {v || '--'}
        </span>
      )
    },
    {
      key: 'roster_status',
      title: 'Status',
      width: 80,
      render: (v) => {
        const badges = {
          'active': dynastyTheme.components.badge.success,
          'bench': dynastyTheme.components.badge.warning,
          'injured': dynastyTheme.components.badge.error,
          'minors': dynastyTheme.components.badge.info
        };
        return (
          <span className={badges[v] || dynastyTheme.components.badge.info}>
            {v || 'Active'}
          </span>
        );
      }
    },
    { key: 'games_played', title: 'G', width: 50, render: renderDefault },
    { key: 'at_bats', title: 'AB', width: 50, render: renderDefault },
    { key: 'runs', title: 'R', width: 50, render: renderDefault },
    { key: 'hits', title: 'H', width: 50, render: renderDefault },
    { key: 'home_runs', title: 'HR', width: 50, render: renderDefault },
    { key: 'rbi', title: 'RBI', width: 60, render: renderDefault },
    { key: 'stolen_bases', title: 'SB', width: 50, render: renderDefault },
    { key: 'batting_avg', title: 'AVG', width: 60, render: (v) => renderAvg(v ?? 0) },
    { key: 'obp', title: 'OBP', width: 60, render: (v) => renderAvg(v ?? 0) },
    { key: 'slg', title: 'SLG', width: 60, render: (v) => renderAvg(v ?? 0) },
    { key: 'ops', title: 'OPS', width: 70, render: (v) => renderFloat3(v ?? 0) },
    {
      key: 'contract',
      title: 'Contract',
      width: 100,
      render: (_, player) => (
        <div className="text-xs">
          <div className={`font-mono ${dynastyTheme.classes.text.success}`}>${(player.salary || 1.0).toFixed(1)}M</div>
          <div className={dynastyTheme.classes.text.neutralLight}>
            {player.contract_years || 1} yr{(player.contract_years || 1) !== 1 ? 's' : ''}
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 120,
      sortable: false,
      render: (_, player) => (
        <div className="flex gap-1">
          {onPlayerMove && (
            <select
              value={player.roster_status || 'active'}
              onChange={(e) => onPlayerMove(player, e.target.value)}
              className={`${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.border.neutral} ${dynastyTheme.classes.text.white} text-xs py-1 px-2 rounded border`}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="active">Active</option>
              <option value="bench">Bench</option>
              <option value="injured">IL</option>
              <option value="minors">Minors</option>
            </select>
          )}
          {onPlayerDrop && (
            <button
              onClick={() => onPlayerDrop(player)}
              className={`px-2 py-1 bg-transparent ${dynastyTheme.classes.text.error} hover:bg-red-400/10 rounded text-xs`}
            >
              Drop
            </button>
          )}
        </div>
      )
    }
  ];
};

export const createRosterPitcherColumns = (onPlayerDrop, onPlayerMove) => {
  return [
    {
      key: 'player_name',
      title: 'Name',
      width: 180,
      sortable: true,
      allowOverflow: true,
      render: (_, player) => (
        <div className="text-left group">
          <div className={`font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`}>
            {player.first_name} {player.last_name}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} group-hover:text-gray-300 transition-colors`}>
            {player.mlb_team || 'FA'} • #{player.jersey_number || '--'}
          </div>
        </div>
      )
    },
    {
      key: 'roster_status',
      title: 'Status',
      width: 80,
      render: (v) => {
        const badges = {
          'active': dynastyTheme.components.badge.success,
          'bench': dynastyTheme.components.badge.warning,
          'injured': dynastyTheme.components.badge.error,
          'minors': dynastyTheme.components.badge.info
        };
        return (
          <span className={badges[v] || dynastyTheme.components.badge.info}>
            {v || 'Active'}
          </span>
        );
      }
    },
    { key: 'games_played', title: 'G', width: 50, render: renderDefault },
    { key: 'games_started', title: 'GS', width: 60, render: renderDefault },
    { key: 'wins', title: 'W', width: 50, render: renderDefault },
    { key: 'losses', title: 'L', width: 50, render: renderDefault },
    { key: 'saves', title: 'SV', width: 50, render: renderDefault },
    { key: 'innings_pitched', title: 'IP', width: 60, render: renderFloat1 },
    { key: 'strikeouts_pitched', title: 'SO', width: 50, render: renderDefault },
    { key: 'era', title: 'ERA', width: 60, render: renderFloat2 },
    { key: 'whip', title: 'WHIP', width: 70, render: renderFloat3 },
    {
      key: 'contract',
      title: 'Contract',
      width: 100,
      render: (_, player) => (
        <div className="text-xs">
          <div className={`font-mono ${dynastyTheme.classes.text.success}`}>${(player.salary || 1.0).toFixed(1)}M</div>
          <div className={dynastyTheme.classes.text.neutralLight}>
            {player.contract_years || 1} yr{(player.contract_years || 1) !== 1 ? 's' : ''}
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 120,
      sortable: false,
      render: (_, player) => (
        <div className="flex gap-1">
          {onPlayerMove && (
            <select
              value={player.roster_status || 'active'}
              onChange={(e) => onPlayerMove(player, e.target.value)}
              className={`${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.border.neutral} ${dynastyTheme.classes.text.white} text-xs py-1 px-2 rounded border`}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="active">Active</option>
              <option value="bench">Bench</option>
              <option value="injured">IL</option>
              <option value="minors">Minors</option>
            </select>
          )}
          {onPlayerDrop && (
            <button
              onClick={() => onPlayerDrop(player)}
              className={`px-2 py-1 bg-transparent ${dynastyTheme.classes.text.error} hover:bg-red-400/10 rounded text-xs`}
            >
              Drop
            </button>
          )}
        </div>
      )
    }
  ];
};

// =============================================================================
// CAREER STATS COLUMNS - NARROW LIKE FREE AGENTS
// =============================================================================
export const createCareerStatsColumns = (isPitcher = false) => {
  if (isPitcher) {
    return [
      { key: 'season_year', title: 'Year', width: 35, render: (v) => v || '-' },
      { key: 'team_abbreviation', title: 'Tm', width: 30, render: (v) => v || '-' },
      { key: 'games_played', title: 'G', width: 25, render: renderDefault },
      { key: 'games_started', title: 'GS', width: 30, render: renderDefault },
      { key: 'innings_pitched', title: 'IP', width: 35, render: (v) => v ? parseFloat(v).toFixed(1) : '0.0' },
      { key: 'era', title: 'ERA', width: 35, render: (v) => v ? parseFloat(v).toFixed(2) : '0.00' },
      { key: 'whip', title: 'WHIP', width: 40, render: (v) => v ? parseFloat(v).toFixed(3) : '0.000' },
      { key: 'wins', title: 'W', width: 25, render: renderDefault },
      { key: 'losses', title: 'L', width: 25, render: renderDefault },
      { key: 'saves', title: 'SV', width: 25, render: renderDefault },
      { key: 'quality_starts', title: 'QS', width: 25, render: renderDefault },
      { key: 'strikeouts_pitched', title: 'SO', width: 25, render: renderDefault }
    ];
  }

  return [
    { key: 'season_year', title: 'Year', width: 35, render: (v) => v || '-' },
    { key: 'team_abbreviation', title: 'Tm', width: 30, render: (v) => v || '-' },
    { key: 'games_played', title: 'G', width: 25, render: renderDefault },
    { key: 'at_bats', title: 'AB', width: 30, render: renderDefault },
    { key: 'runs', title: 'R', width: 25, render: renderDefault },
    { key: 'hits', title: 'H', width: 25, render: renderDefault },
    { key: 'doubles', title: '2B', width: 25, render: renderDefault },
    { key: 'triples', title: '3B', width: 25, render: renderDefault },
    { key: 'home_runs', title: 'HR', width: 25, render: renderDefault },
    { key: 'rbi', title: 'RBI', width: 30, render: renderDefault },
    { key: 'stolen_bases', title: 'SB', width: 25, render: renderDefault },
    { key: 'walks', title: 'BB', width: 25, render: renderDefault },
    { key: 'strikeouts', title: 'K', width: 25, render: renderDefault },
    { key: 'avg', title: 'AVG', width: 35, render: (v) => v ? parseFloat(v).toFixed(3) : '.000' },
    { key: 'obp', title: 'OBP', width: 35, render: (v) => v ? parseFloat(v).toFixed(3) : '.000' },
    { key: 'slg', title: 'SLG', width: 35, render: (v) => v ? parseFloat(v).toFixed(3) : '.000' },
    { key: 'ops', title: 'OPS', width: 35, render: (v) => v ? parseFloat(v).toFixed(3) : '.000' }
  ];
};

// =============================================================================
// GAME LOGS COLUMNS - NARROW LIKE FREE AGENTS
// =============================================================================
export const createGameLogsColumns = (isPitcher = false) => {
  const dateRender = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  };

  const oppRender = (value, row) => {
    const homeAway = row.home_away === 'HOME' ? 'vs' : '@';
    return value ? `${homeAway} ${value}` : '-';
  };

  if (isPitcher) {
    return [
      { key: 'game_date', title: 'Date', width: 40, render: dateRender },
      { key: 'opponent_abbreviation', title: 'Opp', width: 45, render: oppRender },
      { key: 'team_abbreviation', title: 'Tm', width: 30, render: (v) => v || '-' },
      { key: 'innings_pitched', title: 'IP', width: 30, render: (v) => v ? parseFloat(v).toFixed(1) : '0.0' },
      { key: 'hits_allowed', title: 'H', width: 25, render: renderDefault },
      { key: 'earned_runs', title: 'ER', width: 25, render: renderDefault },
      { key: 'walks_allowed', title: 'BB', width: 25, render: renderDefault },
      { key: 'strikeouts_pitched', title: 'SO', width: 25, render: renderDefault },
      {
        key: 'quality_start',
        title: 'QS',
        width: 25,
        render: (_, row) => {
          const innings = parseFloat(row.innings_pitched) || 0;
          const earnedRuns = parseInt(row.earned_runs) || 0;
          const isQS = innings >= 6.0 && earnedRuns <= 3;
          return (
            <span className={isQS ? `${dynastyTheme.classes.text.success} font-bold` : ''}>
              {isQS ? '1' : '0'}
            </span>
          );
        }
      },
      { key: 'pitch_count', title: 'PC', width: 30, render: (v) => v || '-' },
      { key: 'game_score', title: 'GS', width: 25, render: (v) => v || '-' }
    ];
  }

  return [
    { key: 'game_date', title: 'Date', width: 40, render: dateRender },
    { key: 'opponent_abbreviation', title: 'Opp', width: 45, render: oppRender },
    { key: 'team_abbreviation', title: 'Tm', width: 30, render: (v) => v || '-' },
    { key: 'position_played', title: 'Pos', width: 30, render: (v) => v || '-' }, // For position eligibility
    { key: 'at_bats', title: 'AB', width: 25, render: renderDefault },
    { key: 'runs', title: 'R', width: 25, render: renderDefault },
    { key: 'hits', title: 'H', width: 25, render: renderDefault },
    { key: 'doubles', title: '2B', width: 25, render: renderDefault },
    { key: 'triples', title: '3B', width: 25, render: renderDefault },
    { key: 'home_runs', title: 'HR', width: 25, render: renderDefault },
    { key: 'rbi', title: 'RBI', width: 25, render: renderDefault },
    { key: 'stolen_bases', title: 'SB', width: 25, render: renderDefault },
    { key: 'caught_stealing', title: 'CS', width: 25, render: renderDefault },
    { key: 'walks', title: 'BB', width: 25, render: renderDefault },
    { key: 'strikeouts', title: 'K', width: 25, render: renderDefault }
  ];
};