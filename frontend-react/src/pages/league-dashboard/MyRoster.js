// src/pages/league-dashboard/MyRoster.js - Fixed Header and Button Issues

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, DollarSign, Calendar, Trophy, TrendingUp, 
  AlertCircle, Clock, RefreshCw, UserMinus, ChevronDown,
  ExternalLink, ArrowRightLeft, Eye, Shield, Heart,
  Activity, ChevronUp, Edit2, Save, X, Check,
  Zap, UserPlus, ArrowUpDown, Layers, ChevronRight
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';
import { useCommissioner } from '../../contexts/CommissionerContext';
import CommissionerToggle from '../../components/commissioner/CommissionerToggle';
import CommissionerModeBar from '../../components/commissioner/CommissionerModeBar';

const MyRoster = ({ leagueId, league, user, onPlayerDropped, initialViewTeamId, initialViewTeamName }) => {
  const navigate = useNavigate();
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
  const [editingPositions, setEditingPositions] = useState(false);
  const [positionChanges, setPositionChanges] = useState({});
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

  const canFillPosition = (player, position) => {
    const eligiblePositions = player.eligible_positions || [player.position];
    
    if (eligiblePositions.includes(position)) return true;
    
    if (position === 'MI' && (eligiblePositions.includes('2B') || eligiblePositions.includes('SS'))) return true;
    if (position === 'CI' && (eligiblePositions.includes('1B') || eligiblePositions.includes('3B'))) return true;
    if (position === 'UTIL' && !['SP', 'RP', 'P'].some(p => eligiblePositions.includes(p))) return true;
    if (position === 'P' && ['SP', 'RP'].some(p => eligiblePositions.includes(p))) return true;
    if (position === 'OF' && ['LF', 'CF', 'RF', 'OF'].some(p => eligiblePositions.includes(p))) return true;
    
    return false;
  };

// Organize roster by actual lineup positions
const organizeRosterByPosition = useMemo(() => {
  const organized = {
    batters: {
      active: {},
      bench: [],
      dl: [],
      minors: []
    },
    pitchers: {
      active: {},
      bench: [],
      dl: [],
      minors: []
    }
  };

  // Create position slots with position-specific counters
  const batterPositionCounts = {};
  positions.batters.forEach((pos) => {
    const count = batterPositionCounts[pos] || 0;
    organized.batters.active[`${pos}_${count}`] = null;
    batterPositionCounts[pos] = count + 1;
  });

  const pitcherPositionCounts = {};
  positions.pitchers.forEach((pos) => {
    const count = pitcherPositionCounts[pos] || 0;
    organized.pitchers.active[`${pos}_${count}`] = null;
    pitcherPositionCounts[pos] = count + 1;
  });

  // Right after the positionCounts logic in organizeRosterByPosition
  console.log('Created batter slots:', Object.keys(organized.batters.active));
  console.log('Created pitcher slots:', Object.keys(organized.pitchers.active));

  // Assign players to their positions
  console.log('About to assign players:', rosterData.players);

  rosterData.players.forEach(player => {
    const isBatter = !['SP', 'RP', 'P'].includes(player.position);
    const category = isBatter ? 'batters' : 'pitchers';
    
    const status = player.roster_status || 'bench';
    const assignedPosition = player.roster_position;
    
    console.log(`Player ${player.last_name}: status=${status}, position=${assignedPosition}, category=${category}`);
    console.log(`  Has position ${assignedPosition}?`, organized[category].active.hasOwnProperty(assignedPosition));
    
    if (status === 'active' && assignedPosition && organized[category].active.hasOwnProperty(assignedPosition)) {
      console.log(`  ✓ Assigning ${player.last_name} to ${assignedPosition}`);
      organized[category].active[assignedPosition] = player;
    } else if (status === 'bench') {
      organized[category].bench.push(player);
    } else if (status === 'dl') {
      organized[category].dl.push(player);
    } else if (status === 'minors') {
      organized[category].minors.push(player);
    } else {
      console.log(`  ✗ Not assigned - failed conditions`);
    }
  });

  console.log('Final organized.batters.active:', organized.batters.active);

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
      const isBatter = !['SP', 'RP', 'P'].includes(player.position);
      const category = isBatter ? 'batters' : 'pitchers';
      const status = player.roster_status || 'bench';
      
      const salary = status === 'minors' ? 0 : (player.salary || 0);
      
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
        
        response = await leaguesAPI.getMyRoster(leagueId, { 
          commissioner_action: true,
          target_team_id: commissionerTeamId 
        });
      } else {
        const targetTeamId = teamId || selectedTeamId;
        if (targetTeamId && targetTeamId !== userTeamId) {
          response = await leaguesAPI.getTeamRoster(leagueId, targetTeamId);
        } else {
          response = await leaguesAPI.getMyRoster(leagueId);
        }
      }

      if (response && response.success) {
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
  const handlePositionChange = (playerId, slotId) => {
    setPositionChanges(prev => ({
      ...prev,
      [playerId]: slotId
    }));
  };

  const savePositionChanges = async () => {
    try {
      console.log('Saving position changes:', positionChanges);
      setSuccessMessage('Position changes saved successfully!');
      setEditingPositions(false);
      setPositionChanges({});
      loadRoster();
    } catch (err) {
      setError('Failed to save position changes');
    }
  };

  const handleMovePlayer = async (player, fromStatus, toStatus, targetSlot = null) => {
    if (!isViewingOwnTeam()) {
      setError('You can only manage your own team');
      return;
    }

    try {
      const moveData = {
        player_id: player.league_player_id,
        from_status: fromStatus,
        to_status: toStatus,
        target_slot: targetSlot,
        start_contract: fromStatus === 'minors' && toStatus !== 'minors'
      };
      
      console.log('Moving player:', moveData);
      setSuccessMessage(`${player.first_name} ${player.last_name} moved to ${toStatus}${moveData.start_contract ? ' (contract started)' : ''}`);
      loadRoster();
    } catch (err) {
      setError('Failed to move player');
    }
  };

  const handleDropPlayer = async (player) => {
    if (!isViewingOwnTeam()) {
      setError('You can only drop players from your own team');
      return;
    }

    const contractInfo = player.roster_status === 'minors' 
      ? '' 
      : ` This will free up $${player.salary} in cap space.`;
    
    const confirmMessage = `Drop ${player.first_name} ${player.last_name}?${contractInfo}`;
    
    if (window.confirm(confirmMessage)) {
      try {
        const dropOptions = {};
        if (isCommissionerMode) {
          dropOptions.commissioner_action = true;
          dropOptions.target_team_id = getTargetTeamId(null);
        }

        const response = await leaguesAPI.dropPlayerFromTeam(leagueId, player.league_player_id, dropOptions);

        if (response.success) {
          setSuccessMessage(`${player.first_name} ${player.last_name} dropped!`);
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
    const playerId = player.mlb_player_id || player.player_id;
    navigate(`/player/${playerId}?leagueId=${leagueId}`);
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

  // ========================================
  // RENDER LINEUP SLOT
  // ========================================
  const renderLineupSlot = (position, slotId, player, category) => {
    const canEdit = isViewingOwnTeam() && editingPositions;
    const isEmpty = !player;
    
    return (
      <div 
        key={slotId}
        className={`
          flex items-center justify-between py-2 px-3
          ${dynastyTheme.classes.border.neutral}
          ${isEmpty 
            ? dynastyTheme.classes.bg.darkLighter
            : dynastyTheme.classes.bg.neutral
          }
          ${dynastyTheme.components.listItem.hoverable}
        `}
      >
        {/* Position Label */}
        <div className="w-12 text-center flex-shrink-0">
          <span className={`${dynastyTheme.classes.text.primary} text-xs font-bold uppercase tracking-wide`}>
            {position}
          </span>
        </div>

        {/* Player Info or Empty Slot */}
        {isEmpty ? (
          <div className="flex-1 px-4 min-w-0">
            <span className={`${dynastyTheme.classes.text.neutralDark} text-sm italic`}>
              Empty - {canEdit ? 'Drag player here' : 'No player assigned'}
            </span>
          </div>
        ) : (
          <>
            {/* Player Name */}
            <div className="w-48 px-4 min-w-0">
              <button
                onClick={() => handlePlayerClick(player)}
                className={`text-left ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transitionFast} flex items-center w-full group`}
              >
                <div className="flex-1 min-w-0">
                  <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate`}>
                    {player.first_name} {player.last_name}
                  </div>
                  <div className={`${dynastyTheme.classes.text.neutralLight} text-xs truncate`}>
                    {player.mlb_team}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            </div>

            {/* Stats */}
            <div className="flex gap-6 px-4 flex-shrink-0">
              {category === 'batters' ? (
                <>
                  <div className="w-12 text-center">
                    <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase tracking-wide`}>AVG</div>
                    <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                      {player.batting_avg ? `.${String(player.batting_avg).slice(2)}` : '.000'}
                    </div>
                  </div>
                  <div className="w-8 text-center">
                    <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase tracking-wide`}>HR</div>
                    <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                      {player.home_runs || 0}
                    </div>
                  </div>
                  <div className="w-10 text-center">
                    <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase tracking-wide`}>RBI</div>
                    <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                      {player.rbi || 0}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 text-center">
                    <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase tracking-wide`}>W</div>
                    <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                      {player.wins || 0}
                    </div>
                  </div>
                  <div className="w-12 text-center">
                    <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase tracking-wide`}>ERA</div>
                    <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                      {player.era ? player.era.toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div className="w-8 text-center">
                    <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase tracking-wide`}>K</div>
                    <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                      {player.strikeouts || 0}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Salary */}
            <div className="w-16 text-right px-4 flex-shrink-0">
              {player.roster_status === 'minors' ? (
                <span className={`${dynastyTheme.classes.text.neutralDark} text-xs italic`}>
                  No Contract
                </span>
              ) : (
                <span className={`${dynastyTheme.classes.text.success} font-medium text-sm`}>
                  ${player.salary || 0}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="w-20 px-2 flex-shrink-0">
              {player.roster_status === 'active' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMovePlayer(player, 'active', 'bench');
                  }}
                  className={`text-xs px-2 py-1 ${dynastyTheme.classes.bg.darkLighter} rounded text-neutral-300 hover:bg-yellow-400/20 ${dynastyTheme.classes.transitionFast} w-full`}
                >
                  Bench
                </button>
              ) : player.roster_status === 'minors' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMovePlayer(player, 'minors', 'bench');
                  }}
                  className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.info} w-full`}
                >
                  Call Up
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Activate player - show position selector');
                  }}
                  className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.success} w-full`}
                >
                  Start
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // ========================================
  // RENDER BENCH/DL/MINORS PLAYER
  // ========================================
  const renderReservePlayer = (player, status, index) => {
    const isEven = index % 2 === 0;
    
    return (
      <div 
        key={player.league_player_id}
        className={`
          ${isEven ? dynastyTheme.classes.bg.darkLighter : dynastyTheme.classes.bg.neutral}
          ${dynastyTheme.components.listItem.hoverable}
          flex items-center justify-between py-2 px-3
        `}
      >
        {/* Player Name */}
        <div className="w-48 px-4 min-w-0">
          <button
            onClick={() => handlePlayerClick(player)}
            className={`text-left ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transitionFast} flex items-center w-full group`}
          >
            <div className="flex-1 min-w-0">
              <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate`}>
                {player.first_name} {player.last_name}
              </div>
              <div className={`${dynastyTheme.classes.text.neutralLight} text-xs truncate`}>
                {player.position} - {player.mlb_team}
              </div>
            </div>
            <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-6 px-4 flex-shrink-0">
          {!['SP', 'RP', 'P'].includes(player.position) ? (
            <>
              <div className="w-12 text-center">
                <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase`}>AVG</div>
                <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                  {player.batting_avg ? `.${String(player.batting_avg).slice(2)}` : '.000'}
                </div>
              </div>
              <div className="w-8 text-center">
                <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase`}>HR</div>
                <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                  {player.home_runs || 0}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 text-center">
                <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase`}>W</div>
                <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                  {player.wins || 0}
                </div>
              </div>
              <div className="w-12 text-center">
                <div className={`${dynastyTheme.classes.text.neutralDark} text-2xs uppercase`}>ERA</div>
                <div className={`${dynastyTheme.classes.text.neutralLight} text-sm font-mono`}>
                  {player.era ? player.era.toFixed(2) : '0.00'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Salary */}
        <div className="w-16 text-right px-4 flex-shrink-0">
          {status === 'minors' ? (
            <span className={`${dynastyTheme.classes.text.neutralDark} text-xs italic`}>
              No Contract
            </span>
          ) : (
            <span className={`${dynastyTheme.classes.text.success} font-medium text-sm`}>
              ${player.salary || 0}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="w-24 px-2 flex gap-1 justify-end flex-shrink-0">
          {status === 'bench' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('Activate player to position...');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.success}`}
            >
              Start
            </button>
          )}
          {status === 'dl' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMovePlayer(player, 'dl', 'bench');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.info}`}
            >
              Activate
            </button>
          )}
          {status === 'minors' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMovePlayer(player, 'minors', 'bench');
              }}
              className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.info}`}
              title="Call Up and Start Contract"
            >
              Call Up
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDropPlayer(player);
            }}
            className={`text-xs px-2 py-1 ${dynastyTheme.components.badge.error}`}
          >
            Drop
          </button>
        </div>
      </div>
    );
  };

  // ========================================
  // RENDER ROSTER SECTION
  // ========================================
  const renderRosterSection = (title, sectionType, icon) => {
    const Icon = icon;
    const isExpanded = expandedSection === sectionType;
    
    let sectionData = [];
    let sectionSalary = 0;
    let maxSlots = 0;
    
    if (sectionType === 'active') {
      const category = activeTab === 'batters' ? 'batters' : 'pitchers';
      const activeSlots = organizeRosterByPosition[category].active;
      const positionList = activeTab === 'batters' ? positions.batters : positions.pitchers;
      maxSlots = positionList.length;
      
      return (
        <div className="mb-6">
          <button
            onClick={() => setExpandedSection(isExpanded ? null : sectionType)}
            className={`w-full flex items-center justify-between p-4 ${dynastyTheme.components.card.interactive}`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>{title}</h3>
              <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                ({positionList.length} slots)
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className={`${dynastyTheme.classes.text.success} font-medium`}>
                ${salarySubtotals[activeTab].active}
              </span>
              {isExpanded ? 
                <ChevronUp className={`w-5 h-5 ${dynastyTheme.classes.text.neutralLight}`} /> : 
                <ChevronDown className={`w-5 h-5 ${dynastyTheme.classes.text.neutralLight}`} />
              }
            </div>
          </button>

          {isExpanded && (
            <div className={`mt-2 ${dynastyTheme.components.card.base} overflow-hidden`}>
              {Object.entries(activeSlots).map(([slotId, player]) => {
                const position = slotId.split('_')[0];  // Extract position from slotId
                return renderLineupSlot(position, slotId, player, activeTab);
              })}
            </div>
          )}
        </div>
      );
    } else {
      const category = activeTab === 'batters' ? 'batters' : 'pitchers';
      sectionData = organizeRosterByPosition[category][sectionType] || [];
      sectionSalary = salarySubtotals[activeTab][sectionType];
      
      if (sectionType === 'bench') maxSlots = positions.bench;
      else if (sectionType === 'dl') maxSlots = positions.dl;
      else if (sectionType === 'minors') maxSlots = positions.minors;
      
      // Always show bench, conditionally show DL/Minors if slots > 0
      if (sectionType !== 'bench' && maxSlots === 0) return null;
      
      return (
        <div className="mb-6">
          <button
            onClick={() => setExpandedSection(isExpanded ? null : sectionType)}
            className={`w-full flex items-center justify-between p-4 ${dynastyTheme.components.card.interactive}`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>{title}</h3>
              <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                ({sectionData.length}/{maxSlots})
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
            <div className={`mt-2 ${dynastyTheme.components.card.base} overflow-hidden`}>
              {sectionData.length > 0 ? (
                sectionData.map((player, index) => renderReservePlayer(player, sectionType, index))
              ) : (
                <div className={`py-8 text-center ${dynastyTheme.classes.text.neutralDark}`}>
                  No {activeTab} in {title.toLowerCase()} (0/{maxSlots} slots used)
                </div>
              )}
              
              {maxSlots > 0 && sectionData.length < maxSlots && (
                <div className={`py-4 text-center ${dynastyTheme.classes.text.neutralDark} ${dynastyTheme.classes.border.neutral} border-t`}>
                  {maxSlots - sectionData.length} empty {title.toLowerCase()} slots available
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
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
                {/* Edit Positions Button */}
                {isViewingOwnTeam() && (
                  <button
                    onClick={() => {
                      if (editingPositions) {
                        savePositionChanges();
                      } else {
                        setEditingPositions(true);
                      }
                    }}
                    className={editingPositions 
                      ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                      : dynastyTheme.utils.getComponent('button', 'secondary', 'sm')
                    }
                  >
                    {editingPositions ? (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit Lineup
                      </>
                    )}
                  </button>
                )}
                
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
            {rosterData.players.filter(p => p.contract_years === 1 && p.roster_status !== 'minors').length}
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