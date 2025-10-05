// src/pages/league-dashboard/free-agent-search/TableColumns.js
import React from 'react';
import { ExternalLink, UserCheck, RefreshCw, Lock, UserPlus } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';
import { useBatchSelection } from './BatchSelectionProvider';

// Render helper functions
export const renderHelpers = {
  renderDefault: (v) => v ?? 0,
  renderFloat1: (v) => (parseFloat(v) || 0).toFixed(1),
  renderFloat2: (v) => (parseFloat(v) || 0).toFixed(2),
  renderFloat3: (v) => (parseFloat(v) || 0).toFixed(3),
  renderPercent: (v) => `${(parseFloat(v) || 0).toFixed(1)}%`,
  renderAvg: (v) => {
    const val = parseFloat(v) || 0;
    if (val === 0) return '.000';
    if (val >= 1) return val.toFixed(3);
    return `.${Math.round(val * 1000).toString().padStart(3, '0')}`;
  }
};

// Checkbox Column Component
const CheckboxColumn = ({ player, disabled = false }) => {
  const { isPlayerSelected, togglePlayerSelection } = useBatchSelection();
  
  const leaguePlayerId = player.ids?.league_player || player.league_player_id;
  const isSelected = isPlayerSelected(player);
  const isDisabled = disabled || !leaguePlayerId || !!player.league_context?.team?.team_name;
  
  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => !isDisabled && togglePlayerSelection(player)}
        disabled={isDisabled}
        className={`w-4 h-4 rounded border-2 ${
          isDisabled
            ? 'border-gray-600 bg-gray-700 cursor-not-allowed opacity-50'
            : isSelected
            ? 'border-yellow-400 bg-yellow-400 text-black'
            : 'border-gray-400 bg-transparent hover:border-yellow-400'
        } focus:ring-2 focus:ring-yellow-400/50 transition-colors`}
      />
    </div>
  );
};

// Action Button Component
const ActionButton = ({ player, handleAddPlayer, transactionsEnabled, addingPlayer, loading, isCommissionerMode, activeTeamName, leagueStatus }) => {
  const teamName = player.league_context?.team?.team_name;
  
  if (teamName) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <UserCheck className="w-3 h-3 text-green-400" />
        <span className={dynastyTheme.classes.text.success}>Owned</span>
      </div>
    );
  }
  
  const buttonText = isCommissionerMode ? `Add to ${activeTeamName}` : 'Add';
  const leaguePlayerId = player.ids?.league_player || player.league_player_id;
  
  // Check if we're in a draft mode where transactions should be allowed
  const isDraftMode = leagueStatus === 'drafting' || leagueStatus === 'draft_ready' || leagueStatus === 'offline_draft';
  
  // Determine if the Add button should be enabled
  const canAddPlayer = isCommissionerMode || transactionsEnabled || isDraftMode;
  
  // Store player data in data attributes for event delegation
  const playerData = JSON.stringify({
    player,
    leaguePlayerId,
    canAddPlayer,
    loading
  });
  
  return (
    <div className="flex justify-center items-center h-full">
      <button
        type="button"
        data-action="add-player"
        data-player={playerData}
        data-player-id={leaguePlayerId}
        disabled={!canAddPlayer || addingPlayer === leaguePlayerId || loading || !leaguePlayerId}
        className={`add-player-btn ${
          canAddPlayer 
            ? dynastyTheme.utils.getComponent('button', 'primary', 'xs')
            : `${dynastyTheme.utils.getComponent('button', 'secondary', 'xs')} opacity-50 cursor-not-allowed`
        } flex items-center gap-1`}
        title={
          !canAddPlayer 
            ? 'Transactions locked - prices must be set first' 
            : !leaguePlayerId 
            ? 'Player not available' 
            : isCommissionerMode
            ? `Add to ${activeTeamName}`
            : 'Add to your team'
        }
      >
        {addingPlayer === leaguePlayerId ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : !canAddPlayer ? (
          <Lock className="w-3 h-3" />
        ) : (
          <UserPlus className="w-3 h-3" />
        )}
        {canAddPlayer ? buttonText : 'Locked'}
      </button>
    </div>
  );
};

// Main function to create dynamic columns
export const createDynamicColumns = ({ 
  showAll, 
  activeTab, 
  handlePlayerClick, 
  handleAddPlayer, 
  transactionsEnabled, 
  addingPlayer, 
  loading, 
  isCommissionerMode, 
  activeTeamName,
  bulkMode = false,
  savedPrices = {},
  leagueStatus = ''
}) => {
  const columns = [];
  const { renderDefault, renderFloat1, renderFloat2, renderFloat3, renderAvg, renderPercent } = renderHelpers;
  
  // Checkbox column for selection - ONLY SHOW WHEN BULK MODE IS ENABLED
  if (bulkMode) {
    columns.push({
      key: 'select',
      title: (
        <div className="flex justify-center">
          <input
            type="checkbox"
            disabled={true}
            className="w-4 h-4 rounded border-2 border-gray-600 bg-gray-700 opacity-50"
          />
        </div>
      ),
      width: 25,
      sortable: false,
      render: (_, player) => (
        <CheckboxColumn player={player} disabled={loading} />
      )
    });
  }
  
  // Player name column - CANONICAL: info.first_name, info.last_name
  columns.push({
    key: 'info.first_name',
    title: 'Name',
    width: showAll ? 80 : 88,
    sortable: true,
    allowOverflow: true,
    render: (_, player) => (
      <div className="text-left py-1">
        <button
          onClick={() => handlePlayerClick(player)}
          className={`font-semibold ${dynastyTheme.classes.text.white} hover:${dynastyTheme.classes.text.primary} ${dynastyTheme.classes.transition} flex items-center group text-left`}
        >
          {player.info?.first_name} {player.info?.last_name}
          <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    )
  });

  // Team column - CANONICAL: info.mlb_team
  columns.push({
    key: 'info.mlb_team',
    title: 'MLB Team',
    width: 40,
    render: (v) => <span className={dynastyTheme.components.badge.info}>{v || 'FA'}</span>
  });

  // Fantasy Team column (only in All Players mode) - CANONICAL: league_context.team.team_name
  if (showAll) {
    columns.push({
      key: 'league_context.team.team_name',
      title: 'Fantasy Team',
      width: 70,
      sortable: true,
      render: (v, player) => {
        const teamName = player.league_context?.team?.team_name;
        if (teamName) {
          return (
            <span className={dynastyTheme.components.badge.success}>
              {teamName}
            </span>
          );
        }
        return (
          <span className={dynastyTheme.components.badge.neutral}>
            Free Agent
          </span>
        );
      }
    });
  }

  // Position column - CANONICAL: info.position
  columns.push({
    key: 'info.position',
    title: 'Pos',
    width: 40,
    render: (v) => <span className={dynastyTheme.components.badge.warning}>{v || '--'}</span>
  });

  // Games played - CANONICAL: stats.season.games_played
  columns.push({ 
    key: 'stats.season.games_played', 
    title: 'G', 
    width: 25,
    sortable: true,
    render: renderDefault, 
    isStatColumn: true,
    renderL14: renderDefault
  });

  if (activeTab === 'hitters') {
    // Hitter stats - ALL CANONICAL: stats.season.*
    columns.push({ 
      key: 'stats.season.at_bats', 
      title: 'AB', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.runs', 
      title: 'R', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.hits', 
      title: 'H', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.doubles', 
      title: '2B', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.triples', 
      title: '3B', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.home_runs', 
      title: 'HR', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    
    // HR/AB metric - CANONICAL: stats.season.at_bats, stats.season.home_runs
    columns.push({
      key: 'hr_per_ab',
      title: 'HR/AB',
      width: 35,
      sortable: true,
      sortValue: (player) => {
        const ab = player.stats?.season?.at_bats || 0;
        const hr = player.stats?.season?.home_runs || 0;
        return ab > 0 ? (hr / ab) : 0;
      },
      render: (_, player) => {
        const ab = player.stats?.season?.at_bats || 0;
        const hr = player.stats?.season?.home_runs || 0;
        return ab > 0 ? renderPercent((hr / ab) * 100) : '0.0%';
      },
      isStatColumn: true,
      renderL14: (_, data) => {
        const ab = data?.at_bats || 0;
        const hr = data?.home_runs || 0;
        return ab > 0 ? renderPercent((hr / ab) * 100) : '0.0%';
      }
    });
    
    columns.push({ 
      key: 'stats.season.rbi', 
      title: 'RBI', 
      width: 30, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.stolen_bases', 
      title: 'SB', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.caught_stealing', 
      title: 'CS', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.walks', 
      title: 'BB', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.strikeouts', 
      title: 'SO', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    
    // Rate stats - CANONICAL: stats.season.*
    columns.push({ 
      key: 'stats.season.batting_avg', 
      title: 'AVG', 
      width: 30,
      sortable: true,
      render: (v, player) => renderAvg(player.stats?.season?.batting_avg ?? player.stats?.season?.avg ?? 0),
      isStatColumn: true,
      renderL14: (v) => renderAvg(v ?? 0)
    });
    columns.push({ 
      key: 'stats.season.obp', 
      title: 'OBP', 
      width: 30, 
      sortable: true,
      render: renderAvg, 
      isStatColumn: true, 
      renderL14: renderAvg 
    });
    columns.push({ 
      key: 'stats.season.slg', 
      title: 'SLG', 
      width: 30, 
      sortable: true,
      render: renderAvg, 
      isStatColumn: true, 
      renderL14: renderAvg 
    });
    columns.push({ 
      key: 'stats.season.ops', 
      title: 'OPS', 
      width: 35, 
      sortable: true,
      render: renderFloat3, 
      isStatColumn: true, 
      renderL14: renderFloat3 
    });
    
  } else {
    // Pitcher stats - ALL CANONICAL: stats.season.*
    columns.push({ 
      key: 'stats.season.games_started', 
      title: 'GS', 
      width: 30, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.wins', 
      title: 'W', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.losses', 
      title: 'L', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.saves', 
      title: 'SV', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.blown_saves', 
      title: 'BS', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.holds', 
      title: 'HLD', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.quality_starts', 
      title: 'QS', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.innings_pitched', 
      title: 'IP', 
      width: 30, 
      sortable: true,
      render: renderFloat1, 
      isStatColumn: true, 
      renderL14: renderFloat1 
    });
    columns.push({ 
      key: 'stats.season.hits_allowed', 
      title: 'H', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.runs_allowed', 
      title: 'R', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.earned_runs', 
      title: 'ER', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.home_runs_allowed', 
      title: 'HR', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.walks_allowed', 
      title: 'BB', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    columns.push({ 
      key: 'stats.season.strikeouts_pitched', 
      title: 'SO', 
      width: 25, 
      sortable: true,
      render: renderDefault, 
      isStatColumn: true, 
      renderL14: renderDefault 
    });
    
    // Rate stats - CANONICAL: stats.season.*
    columns.push({ 
      key: 'stats.season.era', 
      title: 'ERA', 
      width: 30, 
      sortable: true,
      render: renderFloat2, 
      isStatColumn: true, 
      renderL14: renderFloat2 
    });
    columns.push({ 
      key: 'stats.season.whip', 
      title: 'WHIP', 
      width: 35, 
      sortable: true,
      render: renderFloat3, 
      isStatColumn: true, 
      renderL14: renderFloat3 
    });
    columns.push({
      key: 'k_per_9',
      title: 'K/9',
      width: 30,
      sortable: true,
      isStatColumn: true,
      sortValue: (player) => {
        const ip = parseFloat(player.stats?.season?.innings_pitched) || 0;
        const k = player.stats?.season?.strikeouts_pitched || 0;
        return ip > 0 ? (k * 9 / ip) : 0;
      },
      render: (_, player) => {
        const ip = parseFloat(player.stats?.season?.innings_pitched) || 0;
        const k = player.stats?.season?.strikeouts_pitched || 0;
        return ip > 0 ? ((k * 9) / ip).toFixed(1) : '0.0';
      },
      renderL14: (_, data) => {
        const ip = parseFloat(data?.innings_pitched) || 0;
        const k = data?.strikeouts_pitched || 0;
        return ip > 0 ? ((k * 9) / ip).toFixed(1) : '0.0';
      }
    });
    columns.push({
      key: 'bb_per_9',
      title: 'BB/9',
      width: 30,
      sortable: true,
      isStatColumn: true,
      sortValue: (player) => {
        const ip = parseFloat(player.stats?.season?.innings_pitched) || 0;
        const bb = player.stats?.season?.walks_allowed || 0;
        return ip > 0 ? (bb * 9 / ip) : 0;
      },
      render: (_, player) => {
        const ip = parseFloat(player.stats?.season?.innings_pitched) || 0;
        const bb = player.stats?.season?.walks_allowed || 0;
        return ip > 0 ? ((bb * 9) / ip).toFixed(1) : '0.0';
      },
      renderL14: (_, data) => {
        const ip = parseFloat(data?.innings_pitched) || 0;
        const bb = data?.walks_allowed || 0;
        return ip > 0 ? ((bb * 9) / ip).toFixed(1) : '0.0';
      }
    });
  }

  // Contract Length column (only in All Players mode) - CANONICAL: league_context.contract.years
  if (showAll) {
    columns.push({
      key: 'league_context.contract.years',
      title: 'Contract',
      width: 40,
      sortable: true,
      render: (v, player) => {
        const teamName = player.league_context?.team?.team_name;
        if (teamName) {
          const years = v || player.contract_years || 1;
          return (
            <span className={dynastyTheme.classes.text.neutralLight}>
              {years} yr{years !== 1 ? 's' : ''}
            </span>
          );
        }
        return <span className={dynastyTheme.classes.text.neutral}>-</span>;
      }
    });
  }

  // Salary column - CANONICAL: financial.market_price, financial.contract_salary
  columns.push({
    key: showAll ? 'salary_display' : 'price',
    title: showAll ? 'Salary' : 'Price', 
    width: 16,
    sortable: true,
    render: (_, player) => {
      let amount = 0;
      let isOwned = false;
      
      const teamName = player.league_context?.team?.team_name;
      
      if (showAll && teamName) {
        // Owned player - show actual salary
        amount = player.display_salary || player.financial?.contract_salary || 1.0;
        isOwned = true;
      } else {
        // Free agent - show price from pricing engine
        const playerId = player.ids?.mlb || player.player_id;
        amount = savedPrices[playerId] || player.display_price || player.financial?.market_price || 1.0;
      }
      
      return (
        <span className={`text-xs ${
          amount === 0 
            ? dynastyTheme.classes.text.neutral 
            : isOwned
            ? dynastyTheme.classes.text.warning
            : amount > 1 
            ? dynastyTheme.classes.text.success 
            : dynastyTheme.classes.text.neutralLight
        }`}>
          ${Math.round(amount)}
        </span>
      );
    }
  });

  // Action column
  columns.push({
    key: 'action',
    title: 'Action',
    width: 50,
    sortable: false,
    render: (_, player) => (
      <ActionButton
        player={player}
        handleAddPlayer={handleAddPlayer}
        transactionsEnabled={transactionsEnabled}
        addingPlayer={addingPlayer}
        loading={loading}
        isCommissionerMode={isCommissionerMode}
        activeTeamName={activeTeamName}
        leagueStatus={leagueStatus}
      />
    )
  });

  return columns;
};
