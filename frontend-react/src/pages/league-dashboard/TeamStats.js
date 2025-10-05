// src/pages/league-dashboard/TeamStats.js
// Team Statistics Display with DynastyTable 3-Line Format

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Activity, Calendar, AlertCircle, RefreshCw,
  Trophy, Clock, DollarSign, Users, Filter, ExternalLink
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';
import { useCommissioner } from '../../contexts/CommissionerContext';
import { usePlayerModal } from '../../contexts/PlayerModalContext';
import CommissionerModeBar from '../../components/commissioner/CommissionerModeBar';
import { 
  DynastyTable
} from '../../services/tableService';
import {
  createTeamStatsActiveLineupColumns,
  createTeamStatsReserveColumns,
  transformPositionSlotsToThreeLineFormat,
  transformPlayersToThreeLineFormat,
  separateCurrentAndHistorical,
  createTeamStatsActiveLineupColumnsAccruedOnly,
  createTeamStatsReserveColumnsAccruedOnly,
  transformPositionSlotsToAccruedOnlyFormat,
  transformPlayersToAccruedOnlyFormat,
  calculateAccruedTotals
} from '../../services/tables/teamStatsColumns';
import { 
  getStatConfigs, 
  DEFAULT_BATTING_STATS,
  DEFAULT_PITCHING_STATS 
} from '../../utils/statMapping';

const TeamStats = ({ leagueId, league, user, initialViewTeamId, initialViewTeamName }) => {
  const navigate = useNavigate();
  const { openPlayerModal } = usePlayerModal();
  const { 
    isCommissionerMode, 
    activeTeamName, 
    activeTeamId,
    isCommissioner 
  } = useCommissioner();

  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('batters');
  const [teamTotals, setTeamTotals] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [accruedOnlyMode, setAccruedOnlyMode] = useState(true);
  
  // Team selection state
  const [allTeams, setAllTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [userTeamId, setUserTeamId] = useState(null);
  const [actualTeamData, setActualTeamData] = useState(null);

  // ========================================
  // DYNAMIC LEAGUE POSITIONS
  // ========================================
  const getLeaguePositions = () => {
    const positions = {
      batters: [],
      pitchers: []
    };

    if (league?.position_requirements && typeof league.position_requirements === 'object') {
      const posReqs = league.position_requirements;
      
      Object.entries(posReqs).forEach(([positionKey, config]) => {
        const slots = config?.slots || 0;
        
        if (positionKey === 'P' && slots > 0) {
          positions.pitchers.push(...Array(slots).fill('P'));
        } else if (slots > 0) {
          positions.batters.push(...Array(slots).fill(positionKey));
        }
      });
    } else {
      // Fallback defaults
      positions.batters = ['C', 'C', '1B', '2B', 'SS', '3B', 'MI', 'CI', 'OF', 'OF', 'OF', 'OF'];
      positions.pitchers = Array(10).fill('P');
    }
    
    return positions;
  };

  const positions = getLeaguePositions();

  // ========================================
  // DYNAMIC STAT CATEGORIES FROM LEAGUE
  // ========================================
  const statCategories = useMemo(() => {
    if (league?.scoring_categories) {
      return {
        batting: league.scoring_categories.hitters || league.scoring_categories.hitting || league.scoring_categories.batting || DEFAULT_BATTING_STATS,
        pitching: league.scoring_categories.pitching || league.scoring_categories.pitchers || DEFAULT_PITCHING_STATS
      };
    }
    
    return {
      batting: DEFAULT_BATTING_STATS,
      pitching: DEFAULT_PITCHING_STATS
    };
  }, [league]);

  // Get stat configs for current tab
  const currentStatConfigs = useMemo(() => {
    const statLabels = activeTab === 'batters' ? statCategories.batting : statCategories.pitching;
    const isPitcher = activeTab === 'pitchers';
    return getStatConfigs(statLabels, isPitcher);
  }, [activeTab, statCategories]);

  // ========================================
  // DATA LOADING
  // ========================================
  const loadAllTeams = async () => {
    try {
      const response = await leaguesAPI.getLeagueTeams(leagueId);
      
      if (response.success && response.teams) {
        const teamList = response.teams.map(team => ({
          team_id: team.team_id,
          team_name: team.team_name || 'Unnamed Team',
          manager_name: team.manager_name || 'Unknown Manager',
          is_user_team: team.is_user_team || false
        }));
        
        setAllTeams(teamList);
        
        const userTeam = teamList.find(t => t.is_user_team);
        if (userTeam) {
          setUserTeamId(userTeam.team_id);
          if (!selectedTeamId && !isCommissionerMode) {
            setSelectedTeamId(userTeam.team_id);
          }
        }
      }
    } catch (err) {
      console.error('Error loading teams:', err);
    }
  };

  const loadTeamStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      let teamId;
      
      // Determine which team to load
      if (isCommissionerMode && activeTeamId) {
        teamId = activeTeamId;
      } else if (selectedTeamId) {
        teamId = selectedTeamId;
      } else if (userTeamId) {
        teamId = userTeamId;
      }
      
      // USE CANONICAL ENDPOINTS LIKE MYROSTER
      if (!teamId || teamId === userTeamId) {
        // Use canonical API for own roster
        response = await leaguesAPI.getMyRosterCanonical(leagueId);
      } else {
        // Use canonical API for viewing other teams
        response = await leaguesAPI.getTeamRosterCanonical(leagueId, teamId);
      }
      
      if (response && response.success) {
        // Canonical response format: { success, team_id, team_name, players: [...] }
        console.log('Loaded canonical roster data:', response.players?.length, 'players');
        setStats(response.players || []);
        setTeamTotals(null);  // TODO: Calculate totals from canonical data
        setRecentTransactions([]);  // TODO: Get transactions separately
        
        if (response.team_name) {
          setActualTeamData({
            team_name: response.team_name,
            team_id: response.team_id
          });
        }
      } else {
        setError(response?.message || 'Failed to load team statistics');
      }
    } catch (err) {
      console.error('Error loading team stats:', err);
      setError('Failed to load team statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // FILTER AND ORGANIZE DATA
  // ========================================
  const { currentRoster, historicalPlayers } = useMemo(() => {
    const { current, historical } = separateCurrentAndHistorical(stats);
    return { currentRoster: current, historicalPlayers: historical };
  }, [stats]);

  // ========================================
  // PARSE CANONICAL STRUCTURE FROM BACKEND
  // ========================================
  const parseCanonicalPlayer = (canonicalPlayer) => {
    // Transform canonical structure - PRESERVE NESTED OBJECTS for column renderers
    return {
      // IDs - flat for compatibility
      mlb_player_id: canonicalPlayer.ids?.mlb,
      league_player_id: canonicalPlayer.ids?.league_player,
      
      // Info - KEEP NESTED for column renderers + add flat properties
      info: canonicalPlayer.info || {},  // ✅ PRESERVE NESTED
      player_name: canonicalPlayer.info?.full_name,
      position: canonicalPlayer.info?.position,
      mlb_team: canonicalPlayer.info?.mlb_team,
      
      // Stats - KEEP NESTED for column renderers
      stats: {
        season: canonicalPlayer.stats?.season || {},
        rolling_14_day: canonicalPlayer.stats?.rolling_14_day || {},
        team_attribution: canonicalPlayer.stats?.team_attribution || {}
      },
      season_stats: canonicalPlayer.stats?.season || {},
      rolling_14_day: canonicalPlayer.stats?.rolling_14_day || {},
      accrued_stats: canonicalPlayer.stats?.team_attribution || {},
      
      // Roster info (from API's roster key, not league_context)
      roster_status: canonicalPlayer.roster?.status || canonicalPlayer.league_context?.roster_status || 'active',
      assigned_position: canonicalPlayer.roster?.position || canonicalPlayer.league_context?.assigned_position,
      roster_position: canonicalPlayer.roster?.position || canonicalPlayer.league_context?.roster_position,
      acquisition_date: canonicalPlayer.roster?.acquisition_date || canonicalPlayer.league_context?.acquisition_date,
      
      // Financial info - KEEP NESTED for column renderers + add flat properties
      financial: canonicalPlayer.financial || {},  // ✅ PRESERVE NESTED
      salary: canonicalPlayer.financial?.contract_salary || canonicalPlayer.league_context?.salary,
      contract_years: canonicalPlayer.financial?.contract_years || canonicalPlayer.league_context?.contract_years,
      price: canonicalPlayer.financial?.market_price || 0,
      
      // Other
      acquisition_method: canonicalPlayer.league_context?.acquisition_method
    };
  };

  // ========================================
  // ORGANIZE ROSTER DATA INTO POSITION SLOTS
  // ========================================
  const organizeRosterForTable = useMemo(() => {
    const organized = {
      batters: { active: [], nonActive: [] },
      pitchers: { active: [], nonActive: [] }
    };

    // Create position slot rows for active lineup
    const batterPositionCounts = {};
    positions.batters.forEach((pos) => {
      const count = batterPositionCounts[pos] || 0;
      const slotId = `${pos}_${count}`;
      organized.batters.active.push({
        slotPosition: pos,
        slotId: slotId,
        player: null
      });
      batterPositionCounts[pos] = count + 1;
    });

    const pitcherPositionCounts = {};
    positions.pitchers.forEach((pos) => {
      const count = pitcherPositionCounts[pos] || 0;
      const slotId = `${pos}_${count}`;
      organized.pitchers.active.push({
        slotPosition: pos,
        slotId: slotId,
        player: null
      });
      pitcherPositionCounts[pos] = count + 1;
    });

    // Parse canonical players and assign to slots
    currentRoster.forEach(canonicalPlayer => {
      const player = parseCanonicalPlayer(canonicalPlayer);
      const position = player.position;
      const isBatter = !['SP', 'RP', 'P'].includes(position);
      const category = isBatter ? 'batters' : 'pitchers';
      
      const status = player.roster_status;
      const assignedPosition = player.assigned_position || player.roster_position;
      
      // ALWAYS assign to active lineup - ignore status
      if (assignedPosition) {
        const slot = organized[category].active.find(s => s.slotId === assignedPosition);
        if (slot) {
          slot.player = player;
        } else {
          // If slot not found, add to first empty slot
          const emptySlot = organized[category].active.find(s => !s.player);
          if (emptySlot) {
            emptySlot.player = player;
          } else {
            organized[category].nonActive.push(player);
          }
        }
      } else {
        // No assigned position - try to put in first empty slot
        const emptySlot = organized[category].active.find(s => !s.player);
        if (emptySlot) {
          emptySlot.player = player;
        } else {
          organized[category].nonActive.push(player);
        }
      }
    });

    return organized;
  }, [currentRoster, positions]);

  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  const getCurrentTeamName = () => {
    if (isCommissionerMode && activeTeamId) {
      const commTeam = allTeams.find(t => t.team_id === activeTeamId);
      if (commTeam && commTeam.team_name && commTeam.team_name !== 'Commissioner Team') {
        return commTeam.team_name;
      }
    }
    
    if (actualTeamData && actualTeamData.team_name && 
        actualTeamData.team_name !== 'Commissioner Team' &&
        actualTeamData.team_name !== 'My Team') {
      return actualTeamData.team_name;
    }
    
    if (initialViewTeamName && 
        initialViewTeamName !== 'Commissioner Team' &&
        initialViewTeamName !== 'My Team') {
      return initialViewTeamName;
    }
    
    const selectedTeam = allTeams.find(t => t.team_id === selectedTeamId);
    if (selectedTeam && selectedTeam.team_name && selectedTeam.team_name !== 'Commissioner Team') {
      return selectedTeam.team_name;
    }
    
    const userTeam = allTeams.find(t => t.is_user_team);
    if (userTeam && userTeam.team_name && userTeam.team_name !== 'Commissioner Team') {
      return userTeam.team_name;
    }
    
    if (allTeams.length > 0) {
      const anyTeam = allTeams.find(t => t.team_name && t.team_name !== 'Commissioner Team');
      if (anyTeam) {
        return anyTeam.team_name;
      }
    }
    
    return 'Team';
  };

  const handleTeamChange = (e) => {
    const newTeamId = e.target.value;
    setSelectedTeamId(newTeamId);
  };

  const handlePlayerClick = (player) => {
    const playerId = player.mlb_player_id;
    openPlayerModal(playerId, player);
  };

  const handleMovePlayer = (player) => {
    console.log('Move player:', player.player_name);
    // TODO: Implement move functionality
  };

  const handleDropPlayer = (player) => {
    console.log('Drop player:', player.player_name);
    // TODO: Implement drop functionality
  };

  const handleTradePlayer = (player) => {
    console.log('Trade player:', player.player_name);
    // TODO: Implement trade functionality
  };

  // Check if league has bench slots
  const hasBenchSlots = league?.position_requirements?.BN?.slots > 0 || false;
  
  const leagueSettings = {
    enableMinors: league?.position_requirements?.MIN?.slots > 0 || false,
    enableDL: league?.position_requirements?.DL?.slots > 0 || false
  };

  // Transform active lineup to 3-line format OR accrued-only format
  const activeLineupRows = useMemo(() => {
    const category = activeTab === 'batters' ? 'batters' : 'pitchers';
    if (accruedOnlyMode) {
      return transformPositionSlotsToAccruedOnlyFormat(organizeRosterForTable[category].active);
    }
    return transformPositionSlotsToThreeLineFormat(organizeRosterForTable[category].active);
  }, [organizeRosterForTable, activeTab, accruedOnlyMode]);

  // Transform non-active players to 3-line format OR accrued-only format
  const nonActiveRows = useMemo(() => {
    const category = activeTab === 'batters' ? 'batters' : 'pitchers';
    if (accruedOnlyMode) {
      return transformPlayersToAccruedOnlyFormat(organizeRosterForTable[category].nonActive);
    }
    return transformPlayersToThreeLineFormat(organizeRosterForTable[category].nonActive);
  }, [organizeRosterForTable, activeTab, accruedOnlyMode]);
  
  const historicalRows = useMemo(() => {
    const filtered = historicalPlayers.filter(p => {
      // Parse canonical structure first, then filter
      const parsed = parseCanonicalPlayer(p);
      const isBatter = !['SP', 'RP', 'P'].includes(parsed.position);
      if (activeTab === 'batters') return isBatter;
      if (activeTab === 'pitchers') return !isBatter;
      return false;
    }).map(p => parseCanonicalPlayer(p)); // Parse after filtering
    
    if (accruedOnlyMode) {
      return transformPlayersToAccruedOnlyFormat(filtered);
    }
    return transformPlayersToThreeLineFormat(filtered);
  }, [historicalPlayers, activeTab, accruedOnlyMode]);

  // Calculate totals and add totals row when in accrued-only mode
  const activeLineupRowsWithTotals = useMemo(() => {
    if (!accruedOnlyMode || activeLineupRows.length === 0) return activeLineupRows;
    
    const totals = calculateAccruedTotals(
      activeLineupRows,
      currentStatConfigs,
      activeTab === 'pitchers'
    );
    
    return [
      ...activeLineupRows,
      {
        id: 'totals-active-lineup',
        isTotalsRow: true,
        totals: totals
      }
    ];
  }, [activeLineupRows, accruedOnlyMode, currentStatConfigs, activeTab]);

  const nonActiveRowsWithTotals = useMemo(() => {
    if (!accruedOnlyMode || nonActiveRows.length === 0) return nonActiveRows;
    
    const totals = calculateAccruedTotals(
      nonActiveRows,
      currentStatConfigs,
      activeTab === 'pitchers'
    );
    
    return [
      ...nonActiveRows,
      {
        id: 'totals-non-active',
        isTotalsRow: true,
        totals: totals
      }
    ];
  }, [nonActiveRows, accruedOnlyMode, currentStatConfigs, activeTab]);

  const historicalRowsWithTotals = useMemo(() => {
    if (!accruedOnlyMode || historicalRows.length === 0) return historicalRows;
    
    const totals = calculateAccruedTotals(
      historicalRows,
      currentStatConfigs,
      activeTab === 'pitchers'
    );
    
    return [
      ...historicalRows,
      {
        id: 'totals-historical',
        isTotalsRow: true,
        totals: totals
      }
    ];
  }, [historicalRows, accruedOnlyMode, currentStatConfigs, activeTab]);

  // Create columns (conditional based on accrued-only mode)
  const activeLineupColumns = useMemo(() => {
    if (accruedOnlyMode) {
      return createTeamStatsActiveLineupColumnsAccruedOnly({
        statConfigs: currentStatConfigs,
        onPlayerClick: handlePlayerClick,
        showHistoricalBadge: false,
        isPitcher: activeTab === 'pitchers',
        onMovePlayer: handleMovePlayer,
        onDropPlayer: handleDropPlayer,
        onTradePlayer: handleTradePlayer,
        hasBenchSlots: hasBenchSlots,
        leagueSettings: leagueSettings
      });
    }
    return createTeamStatsActiveLineupColumns({
      statConfigs: currentStatConfigs,
      onPlayerClick: handlePlayerClick,
      showHistoricalBadge: false,
      isPitcher: activeTab === 'pitchers',
      onMovePlayer: handleMovePlayer,
      onDropPlayer: handleDropPlayer,
      onTradePlayer: handleTradePlayer,
      hasBenchSlots: hasBenchSlots,
      leagueSettings: leagueSettings
    });
  }, [currentStatConfigs, activeTab, hasBenchSlots, leagueSettings, accruedOnlyMode]);

  const nonActiveColumns = useMemo(() => {
    if (accruedOnlyMode) {
      return createTeamStatsReserveColumnsAccruedOnly({
        statConfigs: currentStatConfigs,
        onPlayerClick: handlePlayerClick,
        showHistoricalBadge: false,
        isPitcher: activeTab === 'pitchers'
      });
    }
    return createTeamStatsReserveColumns({
      statConfigs: currentStatConfigs,
      onPlayerClick: handlePlayerClick,
      showHistoricalBadge: false,
      isPitcher: activeTab === 'pitchers'
    });
  }, [currentStatConfigs, activeTab, accruedOnlyMode]);

  const historicalColumns = useMemo(() => {
    if (accruedOnlyMode) {
      return createTeamStatsReserveColumnsAccruedOnly({
        statConfigs: currentStatConfigs,
        onPlayerClick: handlePlayerClick,
        showHistoricalBadge: true,
        isPitcher: activeTab === 'pitchers'
      });
    }
    return createTeamStatsReserveColumns({
      statConfigs: currentStatConfigs,
      onPlayerClick: handlePlayerClick,
      showHistoricalBadge: true,
      isPitcher: activeTab === 'pitchers'
    });
  }, [currentStatConfigs, activeTab, accruedOnlyMode]);

  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    if (leagueId) loadAllTeams();
  }, [leagueId]);
  
  useEffect(() => {
    if (initialViewTeamId && !selectedTeamId) {
      setSelectedTeamId(initialViewTeamId);
    }
  }, [initialViewTeamId, selectedTeamId]);

  useEffect(() => {
    if (leagueId && (selectedTeamId || userTeamId || (isCommissionerMode && activeTeamId))) {
      loadTeamStats();
    }
  }, [leagueId, selectedTeamId, userTeamId, isCommissionerMode, activeTeamId]);

  // ========================================
  // MAIN RENDER
  // ========================================
  if (loading) {
    return (
      <div className={`${dynastyTheme.components.card.base} p-12 text-center`}>
        <RefreshCw className={`w-8 h-8 animate-spin ${dynastyTheme.classes.text.primary} mx-auto mb-4`} />
        <p className={dynastyTheme.classes.text.white}>Loading team statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${dynastyTheme.components.card.base} p-12 text-center`}>
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <p className="text-red-400 mb-4">{error}</p>
        <button 
          onClick={loadTeamStats}
          className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Commissioner Mode Bar */}
      <CommissionerModeBar 
        league={league}
        onTeamSwitch={() => loadTeamStats()}
      />

      {/* HEADER */}
      <div className={`${dynastyTheme.components.card.highlighted} relative overflow-hidden min-h-[160px]`}>
        <div className="relative py-6 px-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <Trophy className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
                <h1 className={`text-4xl font-bold ${dynastyTheme.classes.text.white}`}>
                  {getCurrentTeamName()} Statistics
                </h1>
              </div>
              
              {/* Team Selection Dropdown */}
              {!isCommissionerMode && allTeams.length > 0 && (
                <div className="flex items-center gap-3 mt-3">
                  <label className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
                    View Team:
                  </label>
                  <select
                    value={selectedTeamId || userTeamId || ''}
                    onChange={handleTeamChange}
                    className={`${dynastyTheme.components.input} px-4 py-2 min-w-[200px]`}
                  >
                    {allTeams.map(team => (
                      <option key={team.team_id} value={team.team_id}>
                        {team.team_name} {team.is_user_team ? '(Your Team)' : `(${team.manager_name})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <p className={`${dynastyTheme.classes.text.neutralLight} text-base mt-2`}>
                3-line format showing Season, 14-Day, and Accrued stats
              </p>
            </div>
            
            {/* Right side */}
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center space-x-2">
                <span className={`${dynastyTheme.components.badge.success} backdrop-blur-md bg-neutral-900/60`}>
                  ACTIVE
                </span>
                {isCommissioner && (
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black} shadow-xl`}>
                    COMMISSIONER
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAccruedOnlyMode(!accruedOnlyMode)}
                  className={`px-4 py-2 rounded text-sm font-semibold transition-all ${
                    accruedOnlyMode
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700'
                  }`}
                  title="Toggle accrued stats only view with totals"
                >
                  <Activity className="w-4 h-4 inline mr-2" />
                  {accruedOnlyMode ? 'All Stats' : 'Accrued Only'}
                </button>
                <button
                  onClick={loadTeamStats}
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

      {/* Team Totals */}
      {teamTotals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={dynastyTheme.components.statCard.container}>
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight} mb-2 flex items-center gap-2`}>
              <Calendar className="w-4 h-4" />
              Season Totals
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={dynastyTheme.classes.text.neutralDark}>HR/RBI/R:</span>
                <span className={dynastyTheme.classes.text.white}>
                  {teamTotals.season?.home_runs || 0}/{teamTotals.season?.rbi || 0}/{teamTotals.season?.runs || 0}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className={dynastyTheme.classes.text.neutralDark}>W/SV:</span>
                <span className={dynastyTheme.classes.text.white}>
                  {teamTotals.season?.wins || 0}/{teamTotals.season?.saves || 0}
                </span>
              </div>
            </div>
          </div>

          <div className={dynastyTheme.components.statCard.container}>
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight} mb-2 flex items-center gap-2`}>
              <Activity className="w-4 h-4" />
              Accrued Totals
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={dynastyTheme.classes.text.neutralDark}>HR/RBI/R:</span>
                <span className={dynastyTheme.classes.text.white}>
                  {teamTotals.accrued?.home_runs || 0}/{teamTotals.accrued?.rbi || 0}/{teamTotals.accrued?.runs || 0}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className={dynastyTheme.classes.text.neutralDark}>W/SV:</span>
                <span className={dynastyTheme.classes.text.white}>
                  {teamTotals.accrued?.wins || 0}/{teamTotals.accrued?.saves || 0}
                </span>
              </div>
            </div>
          </div>

          <div className={dynastyTheme.components.statCard.container}>
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight} mb-2 flex items-center gap-2`}>
              <TrendingUp className="w-4 h-4" />
              14-Day Performance
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={dynastyTheme.classes.text.neutralDark}>HR/RBI/R:</span>
                <span className={dynastyTheme.classes.text.white}>
                  {teamTotals.rolling_14d?.home_runs || 0}/{teamTotals.rolling_14d?.rbi || 0}/{teamTotals.rolling_14d?.runs || 0}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className={dynastyTheme.classes.text.neutralDark}>Team AVG:</span>
                <span className={dynastyTheme.classes.text.white}>
                  .{String(teamTotals.rolling_14d?.batting_avg || 0).slice(2).padEnd(3, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
          Batters ({positions.batters.length} slots)
        </button>
        <button
          onClick={() => setActiveTab('pitchers')}
          className={`px-6 py-3 font-medium ${dynastyTheme.classes.transition} ${
            activeTab === 'pitchers'
              ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primaryBright}`
              : `${dynastyTheme.classes.text.neutralLight} hover:text-white`
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Pitchers ({positions.pitchers.length} slots)
        </button>
      </div>

      {/* ACTIVE LINEUP TABLE */}
      <div>
        <h2 className={`${dynastyTheme.components.heading.h2} mb-4 flex items-center gap-2`}>
          <Users className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
          Active Lineup
        </h2>
        
        {activeLineupRowsWithTotals.length > 0 ? (
          <DynastyTable
            data={activeLineupRowsWithTotals}
            columns={activeLineupColumns}
            stickyHeader={true}
            enableHorizontalScroll={true}
            enableVerticalScroll={false}
            maxHeight="none"
            minWidth="800px"
          />
        ) : (
          <div className={`${dynastyTheme.components.card.base} p-12 text-center`}>
            <Users className={`w-12 h-12 mx-auto mb-4 ${dynastyTheme.classes.text.neutralDark}`} />
            <p className={dynastyTheme.classes.text.neutralLight}>
              No active lineup configured
            </p>
          </div>
        )}
      </div>

      {/* NON-ACTIVE PLAYERS TABLE (bench, DL, minors, etc) */}
      {nonActiveRowsWithTotals.length > 0 && (
        <div>
          <h2 className={`${dynastyTheme.components.heading.h2} mb-4 flex items-center gap-2`}>
            <Clock className={`w-6 h-6 ${dynastyTheme.classes.text.warning}`} />
            Other Players with Accrued Stats ({organizeRosterForTable[activeTab === 'batters' ? 'batters' : 'pitchers'].nonActive.length})
          </h2>
          <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mb-4`}>
            Players not in active lineup (bench, DL, minors) who have accrued stats
          </p>
          
          <DynastyTable
            data={nonActiveRowsWithTotals}
            columns={nonActiveColumns}
            stickyHeader={true}
            enableHorizontalScroll={true}
            enableVerticalScroll={false}
            maxHeight="none"
            minWidth="700px"
          />
        </div>
      )}

      {/* HISTORICAL PLAYERS TABLE */}
      {historicalRows.length > 0 && (
        <div>
          <h2 className={`${dynastyTheme.components.heading.h2} mb-4 flex items-center gap-2`}>
            <Clock className={`w-6 h-6 ${dynastyTheme.classes.text.warning}`} />
            Historical Stats - Alumni ({Math.floor(historicalRows.length / 3)} players)
          </h2>
          <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mb-4`}>
            Players who previously accrued stats while on this roster but are no longer on the team
          </p>
          
          <DynastyTable
            data={historicalRows}
            columns={historicalColumns}
            stickyHeader={true}
            enableHorizontalScroll={true}
            enableVerticalScroll={false}
            maxHeight="none"
            minWidth="700px"
          />
        </div>
      )}

      {/* Recent Transactions */}
      {recentTransactions && recentTransactions.length > 0 && (
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6">
            <h2 className={`${dynastyTheme.components.heading.h2} mb-4`}>
              <Clock className={`w-5 h-5 inline mr-2 ${dynastyTheme.classes.text.primary}`} />
              Recent Transactions
            </h2>
            <div className="space-y-2">
              {recentTransactions.map((transaction, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between py-2 px-3 rounded ${dynastyTheme.classes.bg.darkLighter}`}
                >
                  <div className={dynastyTheme.classes.text.white}>
                    {transaction.type === 'add' && '➕'}
                    {transaction.type === 'drop' && '➖'}
                    {transaction.type === 'trade' && '🔄'}
                    <span className="ml-2">{transaction.player}</span>
                    {transaction.details && (
                      <span className={`ml-2 ${dynastyTheme.classes.text.neutralLight} text-sm`}>
                        - {transaction.details}
                      </span>
                    )}
                  </div>
                  <div className={dynastyTheme.classes.text.neutralLight}>
                    {new Date(transaction.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamStats;
