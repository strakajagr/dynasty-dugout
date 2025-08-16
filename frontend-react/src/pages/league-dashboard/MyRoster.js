import React, { useState, useEffect } from 'react';
import { Users, UserMinus, RefreshCw, DollarSign, Calendar, Trophy } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable } from '../../services/tableService';
import { leaguesAPI } from '../../services/apiService';

const MyRoster = ({ leagueId, onPlayerDropped }) => {
  // State management
  const [rosterData, setRosterData] = useState({
    team_id: null,
    team_name: 'My Team',
    players: [],
    total_salary: 0.0,
    roster_spots: { active: 0, bench: 0, injured: 0, total: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [droppingPlayer, setDroppingPlayer] = useState(null);
  const [showConfirmDrop, setShowConfirmDrop] = useState(null);

  // Load roster data
  const loadRoster = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await leaguesAPI.getMyRoster(leagueId);

      if (response.success) {
        setRosterData(response);
      } else {
        setError(response.message || 'Failed to load roster');
        setRosterData({
          team_id: null,
          team_name: 'No Team',
          players: [],
          total_salary: 0.0,
          roster_spots: { active: 0, bench: 0, injured: 0, total: 0 }
        });
      }
    } catch (err) {
      console.error('Error loading roster:', err);
      setError('Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount and when league changes
  useEffect(() => {
    if (leagueId) {
      loadRoster();
    }
  }, [leagueId]);

  // Handle drop player
  const handleDropPlayer = async (player) => {
    setDroppingPlayer(player.league_player_id);
    setError('');
    setShowConfirmDrop(null);

    try {
      const response = await leaguesAPI.dropPlayerFromTeam(leagueId, player.league_player_id);

      if (response.success) {
        // Remove player from roster
        setRosterData(prev => ({
          ...prev,
          players: prev.players.filter(p => p.league_player_id !== player.league_player_id),
          total_salary: prev.total_salary - player.salary,
          roster_spots: {
            ...prev.roster_spots,
            [player.roster_status]: prev.roster_spots[player.roster_status] - 1,
            total: prev.roster_spots.total - 1
          }
        }));

        // Notify parent component
        if (onPlayerDropped) {
          onPlayerDropped(player);
        }
      } else {
        setError(response.message || 'Failed to drop player');
      }
    } catch (err) {
      console.error('Error dropping player:', err);
      setError('Failed to drop player');
    } finally {
      setDroppingPlayer(null);
    }
  };

  // Get status badge for roster status
  const getRosterStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className={dynastyTheme.components.badge.success}>Active</span>;
      case 'bench':
        return <span className={dynastyTheme.components.badge.warning}>Bench</span>;
      case 'injured':
        return <span className={dynastyTheme.components.badge.error}>IL</span>;
      default:
        return <span className={dynastyTheme.components.badge.info}>{status}</span>;
    }
  };

  // Define table columns
  const columns = [
    {
      key: 'player_name',
      title: 'Player',
      width: 200,
      render: (_, player) => (
        <div className="text-left">
          <div className={`font-semibold ${dynastyTheme.classes.text.white}`}>
            {player.first_name} {player.last_name}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
            {player.mlb_team} • #{player.jersey_number || '--'}
          </div>
        </div>
      )
    },
    {
      key: 'position',
      title: 'Pos',
      width: 60,
      render: (value) => (
        <span className={`${dynastyTheme.components.badge.info} text-xs`}>
          {value}
        </span>
      )
    },
    {
      key: 'roster_status',
      title: 'Status',
      width: 80,
      render: (value) => getRosterStatusBadge(value)
    },
    {
      key: 'hitting_stats',
      title: '2025 Hitting',
      width: 150,
      render: (_, player) => {
        if (['SP', 'RP', 'P'].includes(player.position)) {
          return <span className={dynastyTheme.classes.text.neutralLight}>N/A</span>;
        }
        return (
          <div className={`text-xs ${dynastyTheme.classes.text.white}`}>
            <div>.{(player.batting_avg || 0).toFixed(3).slice(1)} • {player.home_runs || 0} HR</div>
            <div className={dynastyTheme.classes.text.neutralLight}>{player.rbis || 0} RBI</div>
          </div>
        );
      }
    },
    {
      key: 'pitching_stats',
      title: '2025 Pitching',
      width: 150,
      render: (_, player) => {
        if (!['SP', 'RP', 'P'].includes(player.position)) {
          return <span className={dynastyTheme.classes.text.neutralLight}>N/A</span>;
        }
        return (
          <div className={`text-xs ${dynastyTheme.classes.text.white}`}>
            <div>{(player.era || 0).toFixed(2)} ERA • {player.wins || 0}W</div>
            <div className={dynastyTheme.classes.text.neutralLight}>
              {player.saves || 0} SV • {(player.innings_pitched || 0).toFixed(1)} IP
            </div>
          </div>
        );
      }
    },
    {
      key: 'contract',
      title: 'Contract',
      width: 120,
      render: (_, player) => (
        <div className={`text-xs ${dynastyTheme.classes.text.white}`}>
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {(player.salary || 1.0).toFixed(1)}M
          </div>
          <div className={`${dynastyTheme.classes.text.neutralLight} flex items-center gap-1`}>
            <Calendar className="w-3 h-3" />
            {player.contract_years || 1} year{(player.contract_years || 1) !== 1 ? 's' : ''}
          </div>
        </div>
      )
    },
    {
      key: 'acquired',
      title: 'Acquired',
      width: 120,
      render: (_, player) => {
        const acquisitionDate = player.acquisition_date ? new Date(player.acquisition_date) : null;
        return (
          <div className={`text-xs ${dynastyTheme.classes.text.white}`}>
            <div className="capitalize">
              {player.acquisition_method || 'Unknown'}
            </div>
            {acquisitionDate && (
              <div className={dynastyTheme.classes.text.neutralLight}>
                {acquisitionDate.toLocaleDateString()}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      title: 'Action',
      width: 100,
      sortable: false,
      render: (_, player) => (
        <div className="flex flex-col gap-1">
          {showConfirmDrop === player.league_player_id ? (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleDropPlayer(player)}
                disabled={droppingPlayer === player.league_player_id}
                className={`${dynastyTheme.utils.getComponent('button', 'error', 'xs')} text-xs`}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirmDrop(null)}
                className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'xs')} text-xs`}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmDrop(player.league_player_id)}
              disabled={droppingPlayer === player.league_player_id || loading}
              className={`${dynastyTheme.utils.getComponent('button', 'ghost', 'xs')} flex items-center gap-1 text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {droppingPlayer === player.league_player_id ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <UserMinus className="w-3 h-3" />
              )}
              Drop
            </button>
          )}
        </div>
      )
    }
  ];

  // Group players by position for better organization
  const groupedPlayers = rosterData.players.reduce((groups, player) => {
    const category = ['SP', 'RP', 'P'].includes(player.position) ? 'Pitchers' : 'Hitters';
    if (!groups[category]) groups[category] = [];
    groups[category].push(player);
    return groups;
  }, {});

  return (
    <div className={dynastyTheme.components.section}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
          <h2 className={dynastyTheme.components.heading.h2}>
            {rosterData.team_name}
          </h2>
        </div>
        <button
          onClick={loadRoster}
          disabled={loading}
          className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} flex items-center gap-2 disabled:opacity-50`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Team Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Players */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Users className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
              <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.white}`}>
                Total Players
              </h3>
            </div>
            <p className={`text-2xl font-bold ${dynastyTheme.classes.text.primary} mt-2`}>
              {rosterData.roster_spots.total}
            </p>
            <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
              {rosterData.roster_spots.active} Active • {rosterData.roster_spots.bench} Bench • {rosterData.roster_spots.injured} IL
            </div>
          </div>
        </div>

        {/* Total Salary */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
              <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.white}`}>
                Total Salary
              </h3>
            </div>
            <p className={`text-2xl font-bold ${dynastyTheme.classes.text.primary} mt-2`}>
              ${rosterData.total_salary.toFixed(1)}M
            </p>
            <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
              Average: ${rosterData.roster_spots.total > 0 ? (rosterData.total_salary / rosterData.roster_spots.total).toFixed(1) : '0.0'}M
            </div>
          </div>
        </div>

        {/* Hitters */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
              <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.white}`}>
                Hitters
              </h3>
            </div>
            <p className={`text-2xl font-bold ${dynastyTheme.classes.text.primary} mt-2`}>
              {groupedPlayers.Hitters?.length || 0}
            </p>
            <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
              Position players
            </div>
          </div>
        </div>

        {/* Pitchers */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
              <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.white}`}>
                Pitchers
              </h3>
            </div>
            <p className={`text-2xl font-bold ${dynastyTheme.classes.text.primary} mt-2`}>
              {groupedPlayers.Pitchers?.length || 0}
            </p>
            <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
              SP and RP
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className={`${dynastyTheme.components.card.base} border-red-500 p-4 mb-4`}>
          <p className={dynastyTheme.classes.text.error}>
            {error}
          </p>
        </div>
      )}

      {/* No Team Message */}
      {!rosterData.team_id && !loading && (
        <div className={`${dynastyTheme.components.card.base} p-8 text-center`}>
          <Users className={`w-12 h-12 ${dynastyTheme.classes.text.neutralLight} mx-auto mb-4`} />
          <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-2`}>
            No Team Found
          </h3>
          <p className={dynastyTheme.classes.text.neutralLight}>
            You don't appear to have a team in this league yet.
          </p>
        </div>
      )}

      {/* Roster Table */}
      {rosterData.team_id && rosterData.players.length > 0 && (
        <>
          <div className="mb-4">
            <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-2`}>
              Full Roster ({rosterData.players.length} players)
            </h3>
          </div>

          <DynastyTable
            data={rosterData.players}
            columns={columns}
            initialSort={{ key: 'position', direction: 'asc' }}
            maxHeight="600px"
            className="mb-4"
          />
        </>
      )}

      {/* Empty Roster Message */}
      {rosterData.team_id && rosterData.players.length === 0 && !loading && (
        <div className={`${dynastyTheme.components.card.base} p-8 text-center`}>
          <Users className={`w-12 h-12 ${dynastyTheme.classes.text.neutralLight} mx-auto mb-4`} />
          <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-2`}>
            Empty Roster
          </h3>
          <p className={dynastyTheme.classes.text.neutralLight}>
            Your team doesn't have any players yet. Visit the Free Agent Market to add players!
          </p>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-3">
            <RefreshCw className={`w-6 h-6 animate-spin ${dynastyTheme.classes.text.primary}`} />
            <span className={dynastyTheme.classes.text.white}>
              Loading roster...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyRoster;