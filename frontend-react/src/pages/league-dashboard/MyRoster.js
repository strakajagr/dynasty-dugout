// src/pages/league-dashboard/MyRoster.js - REFACTORED TO USE DYNASTYTABLE WITH CANONICAL STRUCTURE

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DynastyTable } from '../../services/tableService';
import { useNavigate } from 'react-router-dom';
import { 
  Users, DollarSign, Calendar, Trophy, TrendingUp, 
  AlertCircle, Clock, RefreshCw, UserMinus, ChevronDown,
  ExternalLink, ArrowRightLeft, Eye, Shield, Heart,
  Activity, ChevronUp, Check,
  Zap, UserPlus, ArrowUpDown, Layers, ChevronRight, Move, Trash2
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';
import { useCommissioner } from '../../contexts/CommissionerContext';
import { usePlayerModal } from '../../contexts/PlayerModalContext';
import CommissionerToggle from '../../components/commissioner/CommissionerToggle';
import CommissionerModeBar from '../../components/commissioner/CommissionerModeBar';
import { 
  getStatConfigs, 
  formatStatValue, 
  getStatValue,
  DEFAULT_BATTING_STATS,
  DEFAULT_PITCHING_STATS 
} from '../../utils/statMapping';
import {
  createTeamStatsActiveLineupColumns,
  createTeamStatsReserveColumns,
  transformPositionSlotsToThreeLineFormat,
  transformPlayersToThreeLineFormat
} from '../../services/tables/teamStatsColumns';

const MyRoster = ({ leagueId, league, user, onPlayerDropped, initialViewTeamId, initialViewTeamName }) => {
  const navigate = useNavigate();
  const { openPlayerModal } = usePlayerModal();
  const { 
    isCommissionerMode, 
    activeTeamName, 
    activeTeamId,
    getTargetTeamId,
    isCommissioner 
  } = useCommissioner();
  
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [rosterData, setRosterData] = useState({
    team_id: null,
    team_name: 'My Team',
    players: [],
    total_salary: 0.0,
    roster_spots: { active: 0, bench: 0, injured: 0, minors: 0, total: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('batters');
  const [expandedSection, setExpandedSection] = useState('active');
  
  // Team browsing state
  const [allTeams, setAllTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [userTeamId, setUserTeamId] = useState(null);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // ========================================
  // DYNAMIC LEAGUE POSITIONS
  // ========================================
  const getLeaguePositions = () => {
    const positions = {
      batters: [],
      pitchers: [],
      bench: 5,
      dl: 0,
      minors: 0
    };

    if (typeof league?.bench_slots === 'number') {
      positions.bench = league.bench_slots;
    }
    if (typeof league?.dl_slots === 'number') {
      positions.dl = league.dl_slots;  
    }
    if (typeof league?.minor_league_slots === 'number') {
      positions.minors = league.minor_league_slots;
    }

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
    // Use league's configured scoring categories
    if (league?.scoring_categories) {
      return {
        batting: league.scoring_categories.hitting || league.scoring_categories.batting || DEFAULT_BATTING_STATS,
        pitching: league.scoring_categories.pitching || league.scoring_categories.pitchers || DEFAULT_PITCHING_STATS
      };
    }
    
    // Fallback to defaults
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
  // HELPER FUNCTIONS
  // ========================================
  const isViewingOwnTeam = () => {
    if (isCommissionerMode) return true;
    return selectedTeamId === userTeamId || selectedTeamId === null;
  };

  const getCurrentTeamName = () => {
    // In commissioner mode, try to get the actual team being viewed first
    if (isCommissionerMode && activeTeamId) {
      const commTeam = allTeams.find(t => t.team_id === activeTeamId);
      if (commTeam && commTeam.team_name && 
          commTeam.team_name !== 'Commissioner Team') {
        return commTeam.team_name;
      }
    }
    
    // Check for actual team data in rosterData
    if (rosterData.team_name && 
        rosterData.team_name !== 'My Team' && 
        rosterData.team_name !== 'Commissioner Team' &&
        rosterData.team_name !== 'Loading...') {
      return rosterData.team_name;
    }
    
    // If navigated from TeamLinkDropdown, use the provided team name
    if (initialViewTeamName && 
        initialViewTeamName !== 'Commissioner Team' &&
        initialViewTeamName !== 'My Team') {
      return initialViewTeamName;
    }
    
    // Check if we have a selected team from the dropdown
    const selectedTeam = allTeams.find(t => t.team_id === selectedTeamId);
    if (selectedTeam && selectedTeam.team_name && 
        selectedTeam.team_name !== 'Commissioner Team') {
      return selectedTeam.team_name;
    }
    
    // Use user's own team name as fallback
    const userTeam = allTeams.find(t => t.is_user_team);
    if (userTeam && userTeam.team_name && 
        userTeam.team_name !== 'Commissioner Team') {
      return userTeam.team_name;
    }
    
    // Last resort - if we have any team name that's not Commissioner Team
    if (allTeams.length > 0) {
      const anyTeam = allTeams.find(t => t.team_name && t.team_name !== 'Commissioner Team');
      if (anyTeam) {
        return anyTeam.team_name;
      }
    }
    
    // Final fallback
    return 'Team';
  };

  const handleTeamChange = (e) => {
    const newTeamId = e.target.value;
    setSelectedTeamId(newTeamId);
    loadRoster(newTeamId);
  };

  // ========================================
  // ORGANIZE ROSTER DATA FOR DYNASTYTABLE
  // ========================================
  const organizeRosterForTable = useMemo(() => {
    const organized = {
      batters: {
        active: [],    // Array of { slotPosition, slotId, player }
        bench: [],     // Array of PARSED players
        dl: [],        // Array of PARSED players
        minors: []     // Array of PARSED players
      },
      pitchers: {
        active: [],    // Array of { slotPosition, slotId, player }
        bench: [],     // Array of PARSED players
        dl: [],        // Array of PARSED players
        minors: []     // Array of PARSED players
      }
    };

    // Create position slot rows for active lineup
    const batterPositionCounts = {};
    positions.batters.forEach((pos) => {
      const count = batterPositionCounts[pos] || 0;
      const slotId = `${pos}_${count}`;
      organized.batters.active.push({
        slotPosition: pos,
        slotId: slotId,
        player: null  // Will be PARSED player
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
        player: null  // Will be PARSED player
      });
      pitcherPositionCounts[pos] = count + 1;
    });

    // Assign players to their slots - PARSE CANONICAL PLAYERS
    rosterData.players.forEach(canonicalPlayer => {
      const position = canonicalPlayer.info?.position;
      const isBatter = !['SP', 'RP', 'P'].includes(position);
      const category = isBatter ? 'batters' : 'pitchers';
      
      const status = canonicalPlayer.roster?.status || canonicalPlayer.league_context?.roster?.status || 'bench';
      const assignedPosition = canonicalPlayer.roster?.position || canonicalPlayer.league_context?.roster?.position;
      
      // Parse to flat structure
      const parsedPlayer = parseCanonicalPlayer(canonicalPlayer);
      
      if (status === 'active' && assignedPosition) {
        // Find the slot and assign the PARSED player
        const slot = organized[category].active.find(s => s.slotId === assignedPosition);
        if (slot) {
          slot.player = parsedPlayer;
        } else {
          // If slot not found, add to bench
          organized[category].bench.push(parsedPlayer);
        }
      } else if (status === 'bench') {
        organized[category].bench.push(parsedPlayer);
      } else if (status === 'dl') {
        organized[category].dl.push(parsedPlayer);
      } else if (status === 'minors') {
        organized[category].minors.push(parsedPlayer);
      }
    });

    return organized;
  }, [rosterData.players, positions]);

  // Calculate salary subtotals
  const salarySubtotals = useMemo(() => {
    const totals = {
      batters: { active: 0, bench: 0, dl: 0, minors: 0, total: 0 },
      pitchers: { active: 0, bench: 0, dl: 0, minors: 0, total: 0 },
      overall: 0
    };

    rosterData.players.forEach(player => {
      const position = player.info?.position;
      const isBatter = !['SP', 'RP', 'P'].includes(position);
      const category = isBatter ? 'batters' : 'pitchers';
      const status = player.roster?.status || player.league_context?.roster?.status || 'bench';
      
      const salary = status === 'minors' ? 0 : (player.financial?.contract_salary || player.league_context?.financial?.contract_salary || 0);
      
      if (['active', 'bench', 'dl', 'minors'].includes(status)) {
        totals[category][status] += salary;
        totals[category].total += salary;
        totals.overall += salary;
      }
    });

    return totals;
  }, [rosterData.players]);

  // Calculate cap info
  const calculateCapInfo = () => {
    const useDualCap = league?.use_dual_cap ?? true;
    const draftCap = league?.draft_cap || 600;
    const seasonCap = league?.season_cap || 200;
    const totalCap = league?.salary_cap || 800;
    
    const currentSpend = salarySubtotals.overall;
    
    if (useDualCap) {
      const unspentDraft = Math.max(0, draftCap - currentSpend);
      const faab = unspentDraft + seasonCap;
      
      return {
        draftCap,
        seasonCap,
        currentSpend,
        unspentDraft,
        faab,
        isDualCap: true
      };
    } else {
      const remaining = totalCap - currentSpend;
      
      return {
        totalCap,
        currentSpend,
        remaining,
        isDualCap: false
      };
    }
  };

  const capInfo = calculateCapInfo();

  // ========================================
  // DATA LOADING
  // ========================================
  const loadAllTeams = async () => {
    try {
      setTeamsLoading(true);
      const response = await leaguesAPI.getLeagueTeams(leagueId);
      
      if (response.success && response.teams) {
        const teamList = response.teams.map(team => ({
          team_id: team.team_id,
          team_name: team.team_name || 'Unnamed Team',
          manager_name: team.manager_name || 'Unknown Manager',
          total_players: team.total_players || 0,
          salary_used: team.salary_used || 0,
          is_user_team: team.is_user_team || false,
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
    } finally {
      setTeamsLoading(false);
    }
  };

  const loadRoster = async (teamId = null) => {
    setLoading(true);
    setError('');

    try {
      let response;
      
      if (isCommissionerMode) {
        const commissionerTeamId = activeTeamId;
        if (!commissionerTeamId) {
          setLoading(false);
          return;
        }
        
        // Use canonical API for own roster in commissioner mode
        response = await leaguesAPI.getMyRosterCanonical(leagueId);
      } else {
        const targetTeamId = teamId || selectedTeamId;
        if (targetTeamId && targetTeamId !== userTeamId) {
          // Use canonical API for viewing other teams
          response = await leaguesAPI.getTeamRosterCanonical(leagueId, targetTeamId);
        } else {
          // Use canonical API for own roster
          response = await leaguesAPI.getMyRosterCanonical(leagueId);
        }
      }

      if (response && response.success) {
        console.log('Loaded canonical roster data:', response.players?.length, 'players');
        setRosterData(response);
      } else {
        setError(response?.message || 'Failed to load roster');
      }
    } catch (err) {
      console.error('Error loading roster:', err);
      setError('Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // ACTION HANDLERS
  // ========================================
  const handleMovePlayer = async (player, fromStatus, toStatus, targetSlot = null) => {
    if (!isViewingOwnTeam()) {
      setError('You can only manage your own team');
      return;
    }

    try {
      const playerId = player.ids?.league_player || player.league_player_id;
      const playerName = `${player.info?.first_name} ${player.info?.last_name}`;
      
      const moveData = {
        player_id: playerId,
        from_status: fromStatus,
        to_status: toStatus,
        target_slot: targetSlot,
        start_contract: fromStatus === 'minors' && toStatus !== 'minors'
      };
      
      console.log('Moving player:', moveData);
      setSuccessMessage(`${playerName} moved to ${toStatus}${moveData.start_contract ? ' (contract started)' : ''}`);
      loadRoster();
    } catch (err) {
      setError('Failed to move player');
    }
  };

  const handleBenchPlayer = async (player) => {
    await handleMovePlayer(player, 'active', 'bench');
  };

  const handleActivatePlayer = async (player) => {
    // TODO: Show position selector modal
    console.log('Activate player - need to show position selector');
  };

  const handleDropPlayer = async (player) => {
    if (!isViewingOwnTeam()) {
      setError('You can only drop players from your own team');
      return;
    }

    const playerName = `${player.info?.first_name} ${player.info?.last_name}`;
    const playerId = player.ids?.league_player || player.league_player_id;
    const status = player.roster?.status || player.league_context?.roster?.status;
    const salary = player.financial?.contract_salary || player.league_context?.financial?.contract_salary || 0;

    const contractInfo = status === 'minors' 
      ? '' 
      : ` This will free up $${salary} in cap space.`;
    
    const confirmMessage = `Drop ${playerName}?${contractInfo}`;
    
    if (window.confirm(confirmMessage)) {
      try {
        const dropOptions = {};
        if (isCommissionerMode) {
          dropOptions.commissioner_action = true;
          dropOptions.target_team_id = getTargetTeamId(null);
        }

        const response = await leaguesAPI.dropPlayerFromTeam(leagueId, playerId, dropOptions);

        if (response.success) {
          setSuccessMessage(`${playerName} dropped!`);
          loadRoster();
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError(response.message || 'Failed to drop player');
        }
      } catch (err) {
        console.error('Error dropping player:', err);
        setError('Failed to drop player');
      }
    }
  };

  const handlePlayerClick = (player) => {
    const playerId = player.ids?.mlb;
    openPlayerModal(playerId, player);
  };

  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    if (leagueId) loadAllTeams();
  }, [leagueId]);
  
  // Handle initial team selection from navigation
  useEffect(() => {
    if (initialViewTeamId && !selectedTeamId) {
      setSelectedTeamId(initialViewTeamId);
    }
  }, [initialViewTeamId, selectedTeamId]);

  useEffect(() => {
    if (isCommissionerMode && activeTeamId) {
      loadRoster();
    } else if (!isCommissionerMode && (selectedTeamId || userTeamId)) {
      loadRoster(selectedTeamId || userTeamId);
    }
  }, [selectedTeamId, isCommissionerMode, activeTeamId, userTeamId]);

  // Listen for roster updates from modal actions
  useEffect(() => {
    const handleRosterUpdate = () => {
      loadRoster();
    };

    window.addEventListener('roster-updated', handleRosterUpdate);
    return () => window.removeEventListener('roster-updated', handleRosterUpdate);
  }, []);

  // ========================================
  // RENDER ROSTER SECTION WITH 3-LINE FORMAT (TeamStats style)
  // ========================================
  const renderRosterSection = (title, sectionType, icon) => {
    const Icon = icon;
    const isExpanded = expandedSection === sectionType;
    
    const category = activeTab === 'batters' ? 'batters' : 'pitchers';
    let rawSectionData = [];
    let transformedData = [];  // Will hold 3-line format rows
    let sectionSalary = 0;
    let maxSlots = 0;
    
    // Check if league has bench/DL/minors
    const hasBenchSlots = positions.bench > 0;
    const leagueSettings = {
      enableMinors: positions.minors > 0,
      enableDL: positions.dl > 0
    };
    
    if (sectionType === 'active') {
      rawSectionData = organizeRosterForTable[category].active;
      maxSlots = rawSectionData.length;
      sectionSalary = salarySubtotals[activeTab].active;
      
      // Transform to 3-line format for active lineup
      transformedData = transformPositionSlotsToThreeLineFormat(rawSectionData);
    } else {
      rawSectionData = organizeRosterForTable[category][sectionType];
      sectionSalary = salarySubtotals[activeTab][sectionType];
      
      if (sectionType === 'bench') maxSlots = positions.bench;
      else if (sectionType === 'dl') maxSlots = positions.dl;
      else if (sectionType === 'minors') maxSlots = positions.minors;
      
      // Always show bench, conditionally show DL/Minors if slots > 0
      if (sectionType !== 'bench' && maxSlots === 0) return null;
      
      // Transform to 3-line format for reserve players
      transformedData = transformPlayersToThreeLineFormat(rawSectionData);
    }
    
    // Create columns based on section type using TeamStats columns
    let columns;
    if (sectionType === 'active') {
      columns = createTeamStatsActiveLineupColumns({
        statConfigs: currentStatConfigs,
        onPlayerClick: (player) => {
          const playerId = player.mlb_player_id;
          openPlayerModal(playerId, player);
        },
        showHistoricalBadge: false,
        isPitcher: activeTab === 'pitchers',
        onMovePlayer: (player) => handleMovePlayer(player, 'active', 'bench'),
        onDropPlayer: handleDropPlayer,
        onTradePlayer: (player) => console.log('Trade player:', player.player_name),
        hasBenchSlots: hasBenchSlots,
        leagueSettings: leagueSettings
      });
    } else {
      columns = createTeamStatsReserveColumns({
        statConfigs: currentStatConfigs,
        onPlayerClick: (player) => {
          const playerId = player.mlb_player_id;
          openPlayerModal(playerId, player);
        },
        showHistoricalBadge: false,
        isPitcher: activeTab === 'pitchers'
      });
    }
    
    return (
      <div className="mb-6" key={sectionType}>
        <button
          onClick={() => setExpandedSection(isExpanded ? null : sectionType)}
          className={`w-full flex items-center justify-between p-4 ${dynastyTheme.components.card.interactive}`}
        >
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
            <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>{title}</h3>
            <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              ({sectionType === 'active' ? rawSectionData.length : `${rawSectionData.length}/${maxSlots}`} slots)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`${dynastyTheme.classes.text.success} font-medium`}>
              ${sectionSalary}
            </span>
            {isExpanded ? 
              <ChevronUp className={`w-5 h-5 ${dynastyTheme.classes.text.neutralLight}`} /> : 
              <ChevronDown className={`w-5 h-5 ${dynastyTheme.classes.text.neutralLight}`} />
            }
          </div>
        </button>

        {isExpanded && (
          <div className="mt-2">
            {transformedData.length > 0 ? (
              <DynastyTable
                data={transformedData}
                columns={columns}
                stickyHeader={true}
                enableHorizontalScroll={true}
                enableVerticalScroll={false}
                maxHeight="none"
                minWidth="800px"
              />
            ) : (
              <div className={`${dynastyTheme.components.card.base} py-8 text-center ${dynastyTheme.classes.text.neutralDark}`}>
                No {activeTab} in {title.toLowerCase()} (0/{maxSlots} slots used)
              </div>
            )}
            
            {sectionType !== 'active' && maxSlots > 0 && rawSectionData.length < maxSlots && (
              <div className={`${dynastyTheme.components.card.base} py-4 text-center ${dynastyTheme.classes.text.neutralDark} ${dynastyTheme.classes.border.neutral} border-t`}>
                {maxSlots - rawSectionData.length} empty {title.toLowerCase()} slots available
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ========================================
  // MAIN RENDER
  // ========================================
  return (
    <div className="space-y-6">
      {/* Commissioner Mode Bar */}
      <CommissionerModeBar 
        league={league}
        onTeamSwitch={() => loadRoster()}
      />

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

      {/* HEADER WITH BANNER STYLE MATCHING LEAGUE HOME */}
      <div className={`${dynastyTheme.components.card.highlighted} relative overflow-hidden min-h-[160px]`}>
        {/* Content with proper padding to match LeagueHome */}
        <div className="relative py-6 px-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <Users className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
                <h1 className={`text-4xl font-bold ${dynastyTheme.classes.text.white}`}>
                  {getCurrentTeamName()} Roster
                </h1>
              </div>
              
              {/* Team Selection Dropdown - Clean like TeamStats */}
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
                {positions.batters.length} batters • {positions.pitchers.length} pitchers • {positions.bench} bench
                {positions.dl > 0 && ` • ${positions.dl} DL`}
                {positions.minors > 0 && ` • ${positions.minors} minors`}
              </p>
            </div>
            
            {/* Right side - Status badges and action buttons */}
            <div className="flex flex-col items-end gap-3">
              {/* Status Badges Row */}
              <div className="flex items-center space-x-2">
                <span className={`${dynastyTheme.components.badge.success} backdrop-blur-md bg-neutral-900/60`}>
                  ACTIVE
                </span>
                {/* Commissioner Badge */}
                {isCommissioner && (
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black} shadow-xl`}>
                    COMMISSIONER
                  </span>
                )}
              </div>
              
              {/* Action Buttons Row */}
              <div className="flex items-center gap-3">
                {/* Refresh Button */}
                <button
                  onClick={() => loadRoster()}
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

      {/* Salary Cap Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={dynastyTheme.components.statCard.container}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Total Payroll</h3>
          </div>
          <p className={dynastyTheme.components.statCard.value}>${capInfo.currentSpend}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className={dynastyTheme.classes.text.neutralDark}>Batters:</span>
              <span className={dynastyTheme.classes.text.success}>${salarySubtotals.batters.total}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={dynastyTheme.classes.text.neutralDark}>Pitchers:</span>
              <span className={dynastyTheme.classes.text.success}>${salarySubtotals.pitchers.total}</span>
            </div>
          </div>
        </div>

        <div className={dynastyTheme.components.statCard.container}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={`w-5 h-5 ${dynastyTheme.classes.text.success}`} />
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>
              {capInfo.isDualCap ? 'FAAB Available' : 'Cap Space'}
            </h3>
          </div>
          <p className={dynastyTheme.components.statCard.value}>
            ${capInfo.isDualCap ? capInfo.faab : capInfo.remaining}
          </p>
          {capInfo.isDualCap && (
            <p className={dynastyTheme.components.statCard.label}>
              ${capInfo.unspentDraft} draft + ${capInfo.seasonCap} season
            </p>
          )}
        </div>

        <div className={dynastyTheme.components.statCard.container}>
          <div className="flex items-center gap-2 mb-2">
            <Layers className={`w-5 h-5 ${dynastyTheme.classes.text.info}`} />
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Roster Config</h3>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className={dynastyTheme.classes.text.neutralDark}>Active:</span>
              <span className={dynastyTheme.classes.text.white}>{positions.batters.length + positions.pitchers.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={dynastyTheme.classes.text.neutralDark}>Bench:</span>
              <span className={dynastyTheme.classes.text.white}>{positions.bench}</span>
            </div>
            {positions.dl > 0 && (
              <div className="flex justify-between text-xs">
                <span className={dynastyTheme.classes.text.neutralDark}>DL:</span>
                <span className={dynastyTheme.classes.text.white}>{positions.dl}</span>
              </div>
            )}
            {positions.minors > 0 && (
              <div className="flex justify-between text-xs">
                <span className={dynastyTheme.classes.text.neutralDark}>Minors:</span>
                <span className={dynastyTheme.classes.text.white}>{positions.minors}</span>
              </div>
            )}
          </div>
        </div>

        <div className={dynastyTheme.components.statCard.container}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className={`w-5 h-5 ${dynastyTheme.classes.text.warning}`} />
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Contracts</h3>
          </div>
          <p className={dynastyTheme.components.statCard.value}>
            {rosterData.players.filter(p => {
              const years = p.financial?.contract_years || p.league_context?.financial?.contract_years || 0;
              const status = p.roster?.status || p.league_context?.roster?.status;
              return years === 1 && status !== 'minors';
            }).length}
          </p>
          <p className={dynastyTheme.components.statCard.label}>expiring this year</p>
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
          <Zap className="w-4 h-4 inline mr-2" />
          Pitchers ({positions.pitchers.length} slots)
        </button>
      </div>

      {/* Main Roster Content */}
      <div className="space-y-4">
        {loading ? (
          <div className={`flex items-center justify-center py-12 ${dynastyTheme.components.card.base}`}>
            <RefreshCw className={`w-6 h-6 animate-spin ${dynastyTheme.classes.text.primary} mr-2`} />
            <span className={dynastyTheme.classes.text.white}>Loading roster...</span>
          </div>
        ) : (
          <>
            {renderRosterSection('Active Lineup', 'active', Activity)}
            {renderRosterSection('Bench', 'bench', Users)}
            {positions.dl > 0 && renderRosterSection('Disabled List', 'dl', Heart)}
            {positions.minors > 0 && renderRosterSection('Minor Leagues', 'minors', Shield)}
          </>
        )}
      </div>

      {/* Empty State */}
      {!loading && rosterData.players.length === 0 && (
        <div className={`${dynastyTheme.components.card.base} p-12 text-center`}>
          <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${dynastyTheme.classes.text.neutralDark}`} />
          <p className={dynastyTheme.classes.text.neutralLight}>
            No players on roster. Visit Free Agents to add players.
          </p>
        </div>
      )}
    </div>
  );
};

export default MyRoster;
