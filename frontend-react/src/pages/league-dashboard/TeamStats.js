// src/pages/league-dashboard/TeamStats.js
// Team Statistics Display with toggleable 1-line/3-line view - FIXED VERSION

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Activity, Calendar, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink, Trophy, Clock,
  Zap, DollarSign, Users, Filter, Eye, EyeOff, Layers
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { teamStatsAPI, leaguesAPI } from '../../services/apiService';
import { useCommissioner } from '../../contexts/CommissionerContext';
import CommissionerModeBar from '../../components/commissioner/CommissionerModeBar';

const TeamStats = ({ leagueId, league, user, initialViewTeamId, initialViewTeamName }) => {
  const navigate = useNavigate();
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
  const [activeView, setActiveView] = useState('season'); // season, accrued, rolling
  const [expandedView, setExpandedView] = useState(false); // false = 1-line, true = 3-line
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());
  const [filterPosition, setFilterPosition] = useState('all');
  const [teamTotals, setTeamTotals] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  
  // Team selection state
  const [allTeams, setAllTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [userTeamId, setUserTeamId] = useState(null);
  const [actualTeamData, setActualTeamData] = useState(null);

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
      
      if (!teamId) {
        // Try to get user's own team stats
        response = await teamStatsAPI.getMyTeamStats(leagueId);
      } else {
        // Get specific team's dashboard
        response = await teamStatsAPI.getTeamStatsDashboard(leagueId, teamId);
      }
      
      if (response) {
        // Handle different response structures
        if (Array.isArray(response)) {
          // Direct array of stats
          setStats(response);
          setTeamTotals(null);
          setRecentTransactions([]);
        } else if (response.success || response.team_stats) {
          // Dashboard response - capture the actual team data
          setStats(response.team_stats || []);
          setTeamTotals(response.team_totals || null);
          setRecentTransactions(response.recent_transactions || []);
          
          // If we have team info in the response, use it
          if (response.team_name) {
            setActualTeamData({
              team_name: response.team_name,
              team_id: response.team_id
            });
          }
        } else {
          setError('Failed to load team statistics');
        }
      }
    } catch (err) {
      console.error('Error loading team stats:', err);
      setError('Failed to load team statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  const getCurrentTeamName = () => {
    // In commissioner mode, try to get the actual team being viewed first
    if (isCommissionerMode && activeTeamId) {
      const commTeam = allTeams.find(t => t.team_id === activeTeamId);
      if (commTeam && commTeam.team_name && 
          commTeam.team_name !== 'Commissioner Team') {
        return commTeam.team_name;
      }
    }
    
    // Check if we have actual team data from API response
    if (actualTeamData && actualTeamData.team_name && 
        actualTeamData.team_name !== 'Commissioner Team' &&
        actualTeamData.team_name !== 'My Team') {
      return actualTeamData.team_name;
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
  };

  const togglePlayerExpanded = (playerId) => {
    const newExpanded = new Set(expandedPlayers);
    if (newExpanded.has(playerId)) {
      newExpanded.delete(playerId);
    } else {
      newExpanded.add(playerId);
    }
    setExpandedPlayers(newExpanded);
  };

  const handlePlayerClick = (player) => {
    navigate(`/player/${player.mlb_player_id}?leagueId=${leagueId}`);
  };

  const getFilteredStats = () => {
    if (filterPosition === 'all') return stats;
    if (filterPosition === 'batters') {
      return stats.filter(p => !['SP', 'RP', 'P'].includes(p.position));
    }
    if (filterPosition === 'pitchers') {
      return stats.filter(p => ['SP', 'RP', 'P'].includes(p.position));
    }
    return stats.filter(p => p.position === filterPosition);
  };

  // ========================================
  // RENDER STAT LINE
  // ========================================
  const renderStatLine = (player, statType) => {
    const statsData = statType === 'season' ? player.season_stats :
                     statType === 'accrued' ? player.accrued_stats :
                     player.rolling_14_day;

    if (!statsData) return <div className={dynastyTheme.classes.text.neutralDark}>No data</div>;

    const isBatter = !['SP', 'RP', 'P'].includes(player.position);

    if (isBatter) {
      return (
        <div className="grid grid-cols-6 gap-4 text-sm">
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>AVG</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {statsData.batting_avg || statsData.active_batting_avg 
                ? `.${String(statsData.batting_avg || statsData.active_batting_avg || 0).slice(2).padEnd(3, '0')}` 
                : '.000'}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>HR</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {statsData.home_runs || statsData.active_home_runs || 0}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>RBI</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {statsData.rbi || statsData.active_rbi || 0}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>R</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {statsData.runs || statsData.active_runs || 0}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>SB</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {statsData.stolen_bases || statsData.active_stolen_bases || 0}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>OPS</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {(statsData.ops || statsData.active_ops || 0).toFixed(3)}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="grid grid-cols-6 gap-4 text-sm">
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>W-L</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {statsData.wins || statsData.active_wins || 0}-{statsData.losses || statsData.active_losses || 0}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>ERA</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {(statsData.era || statsData.active_era || 0).toFixed(2)}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>WHIP</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {(statsData.whip || statsData.active_whip || 0).toFixed(3)}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>K</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {statsData.strikeouts_pitched || statsData.active_strikeouts || 0}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>SV</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {statsData.saves || statsData.active_saves || 0}
            </div>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralDark}>IP</span>
            <div className={`${dynastyTheme.classes.text.white} font-mono`}>
              {(statsData.innings_pitched || statsData.active_innings_pitched || 0).toFixed(1)}
            </div>
          </div>
        </div>
      );
    }
  };

  // ========================================
  // RENDER PLAYER CARD
  // ========================================
  const renderPlayerCard = (player) => {
    const isExpanded = expandedPlayers.has(player.mlb_player_id);
    const trend = player.rolling_14_day?.trend;
    
    return (
      <div 
        key={player.mlb_player_id}
        className={`${dynastyTheme.components.card.interactive} mb-3`}
      >
        {/* Player Header */}
        <div 
          className="p-4 cursor-pointer"
          onClick={() => togglePlayerExpanded(player.mlb_player_id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`${dynastyTheme.classes.text.white} font-semibold`}>
                    {player.player_name}
                  </h3>
                  {trend === 'hot' && <Zap className="w-4 h-4 text-red-400" />}
                  {trend === 'cold' && <Activity className="w-4 h-4 text-blue-400" />}
                </div>
                <div className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
                  {player.position} - {player.mlb_team}
                  {player.roster_status && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      player.roster_status === 'active' 
                        ? 'bg-green-500/20 text-green-400'
                        : player.roster_status === 'bench'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : player.roster_status === 'injured' || player.roster_status === 'dl'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {player.roster_status}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className={`${dynastyTheme.classes.text.success} font-medium`}>
                  ${player.salary || 0}
                </div>
                <div className={`${dynastyTheme.classes.text.neutralDark} text-xs`}>
                  {player.contract_years || 0} years
                </div>
              </div>
              {isExpanded ? 
                <ChevronUp className={`w-5 h-5 ${dynastyTheme.classes.text.neutralLight}`} /> : 
                <ChevronDown className={`w-5 h-5 ${dynastyTheme.classes.text.neutralLight}`} />
              }
            </div>
          </div>

          {/* Stats Display - Based on expandedView toggle */}
          <div className="mt-4">
            {expandedView ? (
              // 3-LINE VIEW: Show all three stat lines
              <div className="space-y-3">
                <div>
                  <h4 className={`${dynastyTheme.classes.text.neutralLight} text-xs uppercase mb-1`}>
                    Season Stats
                  </h4>
                  {renderStatLine(player, 'season')}
                </div>
                <div>
                  <h4 className={`${dynastyTheme.classes.text.primary} text-xs uppercase mb-1`}>
                    Accrued While Active
                  </h4>
                  {player.accrued_stats ? (
                    renderStatLine(player, 'accrued')
                  ) : (
                    <div className={dynastyTheme.classes.text.neutralDark}>Never been in active lineup</div>
                  )}
                </div>
                <div>
                  <h4 className={`${dynastyTheme.classes.text.warning} text-xs uppercase mb-1`}>
                    Last 14 Days
                  </h4>
                  {renderStatLine(player, 'rolling')}
                </div>
              </div>
            ) : (
              // 1-LINE VIEW: Show only selected stat line
              <div>
                <h4 className={`${
                  activeView === 'season' ? dynastyTheme.classes.text.neutralLight :
                  activeView === 'accrued' ? dynastyTheme.classes.text.primary :
                  dynastyTheme.classes.text.warning
                } text-xs uppercase mb-1`}>
                  {activeView === 'season' ? 'Season Stats' : 
                   activeView === 'accrued' ? 'Accrued While Active' : 
                   'Last 14 Days'}
                </h4>
                {activeView === 'accrued' && !player.accrued_stats ? (
                  <div className={dynastyTheme.classes.text.neutralDark}>Never been in active lineup</div>
                ) : (
                  renderStatLine(player, activeView)
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expanded Details - Additional Info */}
        {isExpanded && (
          <div className={`border-t ${dynastyTheme.classes.border.neutral} p-4 space-y-4`}>
            {/* Acquisition Info */}
            {player.acquisition_date && (
              <div className={`${dynastyTheme.classes.text.neutralDark} text-xs`}>
                Acquired: {new Date(player.acquisition_date).toLocaleDateString()} via {player.acquisition_method || 'Unknown'}
              </div>
            )}

            {/* Accrued Stats Time Period */}
            {player.accrued_stats && player.accrued_stats.first_active_date && (
              <div className={`${dynastyTheme.classes.text.neutralDark} text-xs`}>
                Active Period: {player.accrued_stats.first_active_date} - {player.accrued_stats.last_active_date || 'Present'}
                ({player.accrued_stats.total_active_days || 0} days)
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayerClick(player);
                }}
                className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Profile
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    if (leagueId) {
      loadAllTeams();
    }
  }, [leagueId]);
  
  // Handle initial team selection from navigation
  useEffect(() => {
    if (initialViewTeamId && !selectedTeamId) {
      setSelectedTeamId(initialViewTeamId);
    }
  }, [initialViewTeamId]);

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

  const filteredStats = getFilteredStats();

  return (
    <div className="space-y-6">
      {/* Commissioner Mode Bar */}
      <CommissionerModeBar 
        league={league}
        onTeamSwitch={() => loadTeamStats()}
      />

      {/* HEADER WITH BANNER STYLE MATCHING LEAGUE HOME */}
      <div className={`${dynastyTheme.components.card.highlighted} relative overflow-hidden min-h-[160px]`}>
        {/* Content with proper padding to match LeagueHome */}
        <div className="relative py-6 px-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <Trophy className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
                <h1 className={`text-4xl font-bold ${dynastyTheme.classes.text.white}`}>
                  {getCurrentTeamName()} {getCurrentTeamName().toLowerCase().includes('team') ? 'Statistics' : 'Team Statistics'}
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
                {expandedView 
                  ? 'Showing all three stat lines: Season, Accrued while active, Last 14 days'
                  : 'Compact view - Toggle between stat types or expand to see all'}
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
              
              {/* Refresh Button */}
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

      {/* Team Totals */}
      {teamTotals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={dynastyTheme.components.statCard.container}>
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight} mb-2`}>
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
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight} mb-2`}>
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
            <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight} mb-2`}>
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

      {/* Controls */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <div className="flex items-center justify-between">
            {/* View Toggle */}
            <div className="flex gap-2">
              {/* Expanded View Toggle */}
              <button
                onClick={() => setExpandedView(!expandedView)}
                className={expandedView 
                  ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                  : dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
              >
                {expandedView ? (
                  <>
                    <Layers className="w-4 h-4 mr-2" />
                    3-Line View
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    1-Line View
                  </>
                )}
              </button>

              {/* Stat Type Selector - Only show in compact view */}
              {!expandedView && (
                <>
                  <button
                    onClick={() => setActiveView('season')}
                    className={activeView === 'season' 
                      ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                      : dynastyTheme.utils.getComponent('button', 'ghost', 'sm')}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Season
                  </button>
                  <button
                    onClick={() => setActiveView('accrued')}
                    className={activeView === 'accrued' 
                      ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                      : dynastyTheme.utils.getComponent('button', 'ghost', 'sm')}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Accrued
                  </button>
                  <button
                    onClick={() => setActiveView('rolling')}
                    className={activeView === 'rolling' 
                      ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                      : dynastyTheme.utils.getComponent('button', 'ghost', 'sm')}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    14-Day
                  </button>
                </>
              )}
            </div>

            {/* Position Filter */}
            <div className="flex items-center gap-2">
              <Filter className={`w-4 h-4 ${dynastyTheme.classes.text.neutralLight}`} />
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className={`${dynastyTheme.components.input} px-3 py-1`}
              >
                <option value="all">All Positions</option>
                <option value="batters">All Batters</option>
                <option value="pitchers">All Pitchers</option>
                <option value="C">Catchers</option>
                <option value="1B">First Base</option>
                <option value="2B">Second Base</option>
                <option value="3B">Third Base</option>
                <option value="SS">Shortstop</option>
                <option value="OF">Outfield</option>
                <option value="DH">DH</option>
                <option value="SP">Starting Pitchers</option>
                <option value="RP">Relief Pitchers</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Player Cards */}
      <div>
        {filteredStats.length > 0 ? (
          filteredStats.map(player => renderPlayerCard(player))
        ) : (
          <div className={`${dynastyTheme.components.card.base} p-12 text-center`}>
            <Users className={`w-12 h-12 mx-auto mb-4 ${dynastyTheme.classes.text.neutralDark}`} />
            <p className={dynastyTheme.classes.text.neutralLight}>
              No players found for the selected filter
            </p>
          </div>
        )}
      </div>

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