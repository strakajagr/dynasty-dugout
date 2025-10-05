// src/components/WatchList/WatchList.js - CANONICAL VERSION
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Star, RefreshCw, AlertCircle, Activity, Zap, Users
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import apiService from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import PlayerProfileModal from '../PlayerProfileModal';
import BulkPositionAssignmentModal from '../league-dashboard/BulkPositionAssignmentModal';
import { analyzeRosterCapacity } from '../../utils/RosterCapacityUtils';
import { DynastyTable } from '../../services/tables/DynastyTable';
import { createDynamicWatchListColumns } from '../../services/tables/watchListColumns';

export const WatchList = ({ leagueId = null, league = null, userTeam = null }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [watchListData, setWatchListData] = useState({
    players: [],
    count: 0,
    current_season: 2025
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('batters');
  
  // Player modal state
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  
  // Bulk assignment modal state
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [playersToAdd, setPlayersToAdd] = useState([]);
  const [currentRoster, setCurrentRoster] = useState([]);
  const [capacityAnalysis, setCapacityAnalysis] = useState(null);

  // ========================================
  // DATA LOADING
  // ========================================
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    loadWatchList();
  }, [isAuthenticated, navigate]);

  const loadWatchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get('/api/watchlist');
      console.log('📋 Watch List API Response (CANONICAL):', response.data);
      
      if (response.data?.success) {
        setWatchListData({
          players: response.data.players || [],
          count: response.data.count || 0,
          current_season: response.data.current_season || 2025
        });
      }
    } catch (err) {
      console.error('Error loading watch list:', err);
      setError('Failed to load watch list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // ORGANIZE PLAYERS BY TYPE (CANONICAL)
  // ========================================
  const organizedPlayers = useMemo(() => {
    const organized = {
      batters: [],
      pitchers: []
    };

    watchListData.players.forEach(player => {
      // CANONICAL: player.info.position
      const isPitcher = ['SP', 'RP', 'P'].includes(player.info?.position);
      if (isPitcher) {
        organized.pitchers.push(player);
      } else {
        organized.batters.push(player);
      }
    });

    // Sort by priority (desc) then added_at (desc)
    organized.batters.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.added_at) - new Date(a.added_at);
    });
    organized.pitchers.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.added_at) - new Date(a.added_at);
    });

    return organized;
  }, [watchListData.players]);

  // ========================================
  // SUMMARY STATS (CANONICAL)
  // ========================================
  const summaryStats = useMemo(() => {
    const stats = {
      total: watchListData.count,
      batters: organizedPlayers.batters.length,
      pitchers: organizedPlayers.pitchers.length,
      available: 0,
      owned: 0
    };

    // CANONICAL: player.league_contexts[] instead of player.league_statuses[]
    watchListData.players.forEach(player => {
      if (player.league_contexts && player.league_contexts.length > 0) {
        const hasOwned = player.league_contexts.some(lc => 
          lc.status === 'owned' || lc.status === 'other_team'
        );
        const hasAvailable = player.league_contexts.some(lc => 
          lc.status === 'available'
        );
        
        if (hasOwned) stats.owned++;
        if (hasAvailable) stats.available++;
      }
    });

    return stats;
  }, [watchListData.players, organizedPlayers]);

  // ========================================
  // ACTION HANDLERS (CANONICAL)
  // ========================================
  const handleViewPlayer = (player) => {
    setSelectedPlayer(player);
    setShowPlayerModal(true);
  };

  const handleRemovePlayer = async (playerId) => {
    // CANONICAL: Find player using ids.mlb
    const player = watchListData.players.find(p => p.ids?.mlb === playerId);
    if (!player) return;
    
    // CANONICAL: player.info.first_name, player.info.last_name
    const playerName = `${player.info?.first_name} ${player.info?.last_name}`;
    
    if (!window.confirm(`Remove ${playerName} from your watch list?`)) {
      return;
    }

    try {
      await apiService.delete(`/api/watchlist/remove/${playerId}`);
      setSuccessMessage(`${playerName} removed from watch list`);
      setTimeout(() => setSuccessMessage(''), 3000);
      loadWatchList();
    } catch (err) {
      console.error('Error removing player:', err);
      setError('Failed to remove player from watch list');
    }
  };

  const handleAddPlayer = async (player) => {
    if (!leagueId || !league) {
      setError('Can only add players from within a league view');
      return;
    }

    setLoading(true);
    try {
      // Load current roster
      const rosterResponse = await apiService.get(`/api/leagues/${leagueId}/my-roster`);
      const roster = rosterResponse.data?.roster || [];
      setCurrentRoster(roster);

      // Analyze capacity
      const analysis = analyzeRosterCapacity(roster, league);
      setCapacityAnalysis(analysis);

      // Convert player to expected format for modal
      const playerForModal = {
        league_player_id: player.ids?.mlb,
        mlb_player_id: player.ids?.mlb,
        first_name: player.info?.first_name,
        last_name: player.info?.last_name,
        position: player.info?.position,
        mlb_team: player.info?.mlb_team,
        eligible_positions: [player.info?.position],
        display_price: player.league_contexts?.find(lc => lc.league_id === leagueId)?.financial?.contract_salary || 1.0
      };

      setPlayersToAdd([playerForModal]);
      setShowBulkAssignModal(true);
    } catch (err) {
      console.error('Error preparing to add player:', err);
      setError('Failed to load roster data');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssignComplete = async (assignmentData) => {
    try {
      // Call the league API to add these players
      await apiService.post(`/api/leagues/${leagueId}/players/bulk-add`, {
        players: assignmentData
      });

      setSuccessMessage(`Successfully added ${assignmentData.length} player(s) to your team!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowBulkAssignModal(false);
      setPlayersToAdd([]);
      
      // Reload watch list to update statuses
      loadWatchList();
    } catch (err) {
      console.error('Error adding players:', err);
      throw err;
    }
  };

  // ========================================
  // DYNAMIC COLUMNS GENERATION
  // ========================================
  const batterColumns = useMemo(() => {
    return createDynamicWatchListColumns({
      league,
      leagueId,
      isPitcher: false,
      onViewPlayer: handleViewPlayer,
      onRemovePlayer: handleRemovePlayer,
      onAddPlayer: handleAddPlayer
    });
  }, [league, leagueId]);

  const pitcherColumns = useMemo(() => {
    return createDynamicWatchListColumns({
      league,
      leagueId,
      isPitcher: true,
      onViewPlayer: handleViewPlayer,
      onRemovePlayer: handleRemovePlayer,
      onAddPlayer: handleAddPlayer
    });
  }, [league, leagueId]);

  // ========================================
  // MAIN RENDER
  // ========================================
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className={`${dynastyTheme.components.badge.success} p-4 rounded-lg border-2`}>
          <p className={dynastyTheme.classes.text.success}>✅ {successMessage}</p>
        </div>
      )}
      {error && (
        <div className={`${dynastyTheme.components.badge.error} p-4 rounded-lg border-2`}>
          <p className={dynastyTheme.classes.text.error}>❌ {error}</p>
        </div>
      )}

      {/* HEADER WITH BANNER STYLE */}
      <div className={`${dynastyTheme.components.card.highlighted} relative overflow-hidden min-h-[160px]`}>
        <div className="relative py-6 px-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <Star className={`w-8 h-8 ${dynastyTheme.classes.text.primary} fill-current`} />
                <h1 className={`text-4xl font-bold ${dynastyTheme.classes.text.white}`}>
                  {leagueId ? `${league?.league_name} Watch List` : 'My Watch List'}
                </h1>
              </div>
              
              <p className={`${dynastyTheme.classes.text.neutralLight} text-base mt-2`}>
                {leagueId 
                  ? `Track players in ${league?.league_name} • ${summaryStats.total} total players`
                  : `Track players across all your leagues • ${summaryStats.total} total players`
                }
              </p>
            </div>
            
            {/* Right side - Action buttons */}
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => loadWatchList()}
                  disabled={loading}
                  className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={dynastyTheme.components.statCard.container}>
          <div className="flex items-center gap-2 mb-2">
            <Users className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Total Players</h3>
          </div>
          <p className={dynastyTheme.components.statCard.value}>{summaryStats.total}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className={dynastyTheme.classes.text.neutralDark}>Batters:</span>
              <span className={dynastyTheme.classes.text.white}>{summaryStats.batters}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={dynastyTheme.classes.text.neutralDark}>Pitchers:</span>
              <span className={dynastyTheme.classes.text.white}>{summaryStats.pitchers}</span>
            </div>
          </div>
        </div>

        <div className={dynastyTheme.components.statCard.container}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.success}`} />
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>
              {leagueId ? 'Available Here' : 'Available'}
            </h3>
          </div>
          <p className={dynastyTheme.components.statCard.value}>{summaryStats.available}</p>
          <p className={dynastyTheme.components.statCard.label}>
            {leagueId ? 'free agents in this league' : 'free agents in leagues'}
          </p>
        </div>

        <div className={dynastyTheme.components.statCard.container}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className={`w-5 h-5 ${dynastyTheme.classes.text.error}`} />
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Owned</h3>
          </div>
          <p className={dynastyTheme.components.statCard.value}>{summaryStats.owned}</p>
          <p className={dynastyTheme.components.statCard.label}>rostered in leagues</p>
        </div>

        <div className={dynastyTheme.components.statCard.container}>
          <div className="flex items-center gap-2 mb-2">
            <Star className={`w-5 h-5 ${dynastyTheme.classes.text.warning}`} />
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Season</h3>
          </div>
          <p className={dynastyTheme.components.statCard.value}>{watchListData.current_season}</p>
          <p className={dynastyTheme.components.statCard.label}>current season</p>
        </div>
      </div>

      {/* Position Tabs */}
      <div className={`flex gap-2 border-b ${dynastyTheme.classes.border.neutral}`}>
        <button
          onClick={() => setActiveTab('batters')}
          className={`px-6 py-3 font-medium ${dynastyTheme.classes.transition} ${
            activeTab === 'batters'
              ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primaryBright}`
              : `${dynastyTheme.classes.text.neutralLight} hover:text-white`
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Batters ({organizedPlayers.batters.length})
        </button>
        <button
          onClick={() => setActiveTab('pitchers')}
          className={`px-6 py-3 font-medium ${dynastyTheme.classes.transition} ${
            activeTab === 'pitchers'
              ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primaryBright}`
              : `${dynastyTheme.classes.text.neutralLight} hover:text-white`
          }`}
        >
          <Zap className="w-4 h-4 inline mr-2" />
          Pitchers ({organizedPlayers.pitchers.length})
        </button>
      </div>

      {/* Main Content - DynastyTable */}
      <div className="space-y-4">
        {loading ? (
          <div className={`flex items-center justify-center py-12 ${dynastyTheme.components.card.base}`}>
            <RefreshCw className={`w-6 h-6 animate-spin ${dynastyTheme.classes.text.primary} mr-2`} />
            <span className={dynastyTheme.classes.text.white}>Loading watch list...</span>
          </div>
        ) : (
          <>
            {activeTab === 'batters' && organizedPlayers.batters.length > 0 && (
              <DynastyTable
                data={organizedPlayers.batters}
                columns={batterColumns}
                initialSort={{ key: 'priority', direction: 'desc' }}
                maxHeight="800px"
                stickyHeader={true}
                enableHorizontalScroll={true}
                enableVerticalScroll={true}
              />
            )}
            {activeTab === 'pitchers' && organizedPlayers.pitchers.length > 0 && (
              <DynastyTable
                data={organizedPlayers.pitchers}
                columns={pitcherColumns}
                initialSort={{ key: 'priority', direction: 'desc' }}
                maxHeight="800px"
                stickyHeader={true}
                enableHorizontalScroll={true}
                enableVerticalScroll={true}
              />
            )}
            {/* Empty state for current tab */}
            {((activeTab === 'batters' && organizedPlayers.batters.length === 0) ||
              (activeTab === 'pitchers' && organizedPlayers.pitchers.length === 0)) && (
              <div className={`${dynastyTheme.components.card.base} py-12 text-center`}>
                <Star className={`w-12 h-12 mx-auto mb-3 ${dynastyTheme.classes.text.neutralLight} opacity-30`} />
                <p className={dynastyTheme.classes.text.neutralLight}>No {activeTab} on your watch list</p>
                <p className={`text-xs mt-2 ${dynastyTheme.classes.text.neutralDark}`}>Click the star icon on players to add them</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Empty State */}
      {!loading && watchListData.players.length === 0 && (
        <div className={`${dynastyTheme.components.card.base} p-12 text-center`}>
          <Star className={`w-16 h-16 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLight} opacity-30`} />
          <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white} mb-2`}>
            Your watch list is empty
          </h3>
          <p className={`${dynastyTheme.classes.text.neutralLight} mb-4`}>
            Click the star icon on any player to add them to your watch list
          </p>
          <button
            onClick={() => navigate(leagueId ? `/league/${leagueId}` : '/dashboard')}
            className={dynastyTheme.components.button.primary}
          >
            {leagueId ? 'Back to League' : 'Go to Dashboard'}
          </button>
        </div>
      )}

      {/* Info Footer */}
      {!loading && watchListData.players.length > 0 && (
        <div className={`mt-4 p-4 ${dynastyTheme.components.card.base} ${dynastyTheme.classes.text.neutralLight} text-sm`}>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">
                {leagueId ? 'League Stats:' : 'Global Stats (CANONICAL):'}
              </p>
              <ul className="space-y-1 list-disc list-inside ml-2">
                {leagueId ? (
                  <>
                    <li>Stats shown are based on your league's scoring categories</li>
                    <li><span className="text-green-400">Green status</span> = Free agent in this league</li>
                    <li><span className="text-yellow-400">Yellow status</span> = Owned in this league</li>
                  </>
                ) : (
                  <>
                    <li>Using CANONICAL player structure (player.ids.mlb, player.info.*, player.stats.*)</li>
                    <li>Multi-league status shows player availability across ALL your leagues</li>
                    <li><span className={dynastyTheme.classes.text.success}>Badge</span> = League abbreviation (hover for details)</li>
                    <li>View from within a league to see league-specific pricing and ownership</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Player Profile Modal - CANONICAL: use ids.mlb */}
      {showPlayerModal && selectedPlayer && (
        <PlayerProfileModal
          playerId={selectedPlayer.ids?.mlb}
          leagueId={leagueId}
          isOpen={showPlayerModal}
          onClose={() => {
            setShowPlayerModal(false);
            setSelectedPlayer(null);
          }}
          initialPlayer={selectedPlayer}
        />
      )}

      {/* Bulk Position Assignment Modal */}
      {showBulkAssignModal && leagueId && (
        <BulkPositionAssignmentModal
          selectedPlayers={playersToAdd}
          league={league}
          capacityAnalysis={capacityAnalysis}
          currentRoster={currentRoster}
          onAssignAll={handleBulkAssignComplete}
          onCancel={() => {
            setShowBulkAssignModal(false);
            setPlayersToAdd([]);
          }}
          isVisible={showBulkAssignModal}
        />
      )}
    </div>
  );
};
