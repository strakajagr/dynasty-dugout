// src/components/PlayerProfileModal.js - FIXED TABBED VERSION
import React, { useState, useEffect } from 'react';
import { 
  X, ExternalLink, DollarSign, User, ChartBar, 
  TrendingUp, TrendingDown, Activity, Award,
  Calendar, Clock, Shield, AlertCircle
} from 'lucide-react';
import { dynastyTheme } from '../services/colorService';
import { leaguesAPI, teamStatsAPI } from '../services/apiService';

const PlayerProfileModal = ({ 
  playerId, 
  leagueId, 
  isOpen, 
  onClose, 
  userTeamId, 
  onPlayerAction,
  isCommissionerMode = false,
  league = null,
  initialPlayer = null // Pass player data from roster
}) => {
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState(initialPlayer);
  const [rosterStatus, setRosterStatus] = useState('checking');
  const [actionLoading, setActionLoading] = useState(false);
  const [scoringCategories, setScoringCategories] = useState(null);
  const [teamStats, setTeamStats] = useState(null);

  useEffect(() => {
    if (isOpen && playerId && leagueId) {
      loadPlayerData();
      loadScoringCategories();
    }
  }, [isOpen, playerId, leagueId]);

  const loadScoringCategories = async () => {
    // If league object passed in, use it
    if (league?.scoring_categories) {
      const cats = typeof league.scoring_categories === 'string' 
        ? JSON.parse(league.scoring_categories)
        : league.scoring_categories;
      
      const normalizedCats = {
        hitting: cats.hitting || cats.hitters || ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
        pitching: cats.pitching || cats.pitchers || ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
      };
      
      setScoringCategories(normalizedCats);
      return;
    }
    
    // Otherwise fetch league settings
    try {
      const response = await leaguesAPI.getLeagueSettings(leagueId);
      
      if (response.success && response.settings?.scoring_categories) {
        const cats = typeof response.settings.scoring_categories === 'string' 
          ? JSON.parse(response.settings.scoring_categories)
          : response.settings.scoring_categories;
        
        const normalizedCats = {
          hitting: cats.hitting || cats.hitters || ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
          pitching: cats.pitching || cats.pitchers || ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
        };
        
        setScoringCategories(normalizedCats);
      } else {
        // Use defaults
        setScoringCategories({
          hitting: ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
          pitching: ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
        });
      }
    } catch (err) {
      console.error('Error loading scoring categories:', err);
      setScoringCategories({
        hitting: ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
        pitching: ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
      });
    }
  };

  const loadPlayerData = async () => {
    setLoading(true);
    
    try {
      // First check if we have initial player data
      if (initialPlayer) {
        setPlayer(initialPlayer);
        
        // Determine roster status
        if (initialPlayer.team_id === userTeamId || initialPlayer.roster_status) {
          setRosterStatus('owned');
          
          // Try to load enhanced stats for owned players
          if (initialPlayer.team_id) {
            try {
              const statsResponse = await teamStatsAPI.getTeamStatsDashboard(
                leagueId, 
                initialPlayer.team_id
              );
              
              if (statsResponse && statsResponse.team_stats) {
                const playerStats = statsResponse.team_stats.find(p => 
                  String(p.mlb_player_id) === String(playerId) ||
                  String(p.league_player_id) === String(initialPlayer.league_player_id)
                );
                
                if (playerStats) {
                  setPlayer(prevPlayer => ({
                    ...prevPlayer,
                    season_stats: playerStats.season_stats,
                    rolling_14_day: playerStats.rolling_14_day || playerStats.rolling_stats,
                    accrued_stats: playerStats.accrued_stats
                  }));
                  setTeamStats(playerStats);
                }
              }
            } catch (err) {
              console.error('Error loading team stats:', err);
            }
          }
        } else {
          setRosterStatus('available');
        }
        
        setLoading(false);
        return;
      }

      // If no initial player, fetch from API
      const [rosterResponse, faResponse] = await Promise.all([
        leaguesAPI.getMyRosterEnhanced(leagueId),
        leaguesAPI.getFreeAgentsEnhanced(leagueId, { limit: 200 })
      ]);

      let foundPlayer = null;
      let status = 'other_team';

      // Check roster
      if (rosterResponse.success && rosterResponse.players) {
        const rosterPlayer = rosterResponse.players.find(p => 
          String(p.mlb_player_id) === String(playerId) || 
          String(p.player_id) === String(playerId)
        );
        
        if (rosterPlayer) {
          foundPlayer = rosterPlayer;
          status = 'owned';
        }
      }

      // Check free agents
      if (!foundPlayer && faResponse.success && faResponse.players) {
        const faPlayer = faResponse.players.find(p => 
          String(p.mlb_player_id) === String(playerId) || 
          String(p.player_id) === String(playerId)
        );
        
        if (faPlayer) {
          foundPlayer = faPlayer;
          status = 'available';
        }
      }

      if (foundPlayer) {
        setPlayer(foundPlayer);
      }
      
      setRosterStatus(status);

    } catch (err) {
      console.error('Error loading player data:', err);
      setRosterStatus('other_team');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const calculateAge = (birthdate) => {
    if (!birthdate) return 'N/A';
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatHeight = (heightInches) => {
    if (!heightInches) return 'N/A';
    const feet = Math.floor(heightInches / 12);
    const inches = heightInches % 12;
    return `${feet}'${inches}"`;
  };

  const isPitcher = () => {
    return player && ['SP', 'RP', 'P'].includes(player.position);
  };

  const formatAvg = (avg) => {
    if (!avg || avg === 0) return '.000';
    // Handle if avg is already in decimal form (0.XXX)
    if (avg < 1) {
      return avg.toFixed(3);
    }
    // Handle if avg is in integer form (XXX)
    return `.${String(avg).padStart(3, '0')}`;
  };

  const formatEra = (era) => {
    if (!era || era === 0) return '0.00';
    return parseFloat(era).toFixed(2);
  };

  const formatWhip = (whip) => {
    if (!whip || whip === 0) return '0.00';
    return parseFloat(whip).toFixed(2);
  };

  // Calculate performance status (hot/cold)
  const getPerformanceStatus = () => {
    if (!player) return { status: 'neutral', text: 'No recent data' };
    
    // Check rolling stats for recent performance
    const rolling = player.rolling_14_day || player.last_14_days;
    if (!rolling) return { status: 'neutral', text: 'No recent data' };
    
    if (isPitcher()) {
      const era = rolling.era || 0;
      if (era < 2.50) return { status: 'hot', text: '🔥 Hot Streak' };
      if (era > 5.00) return { status: 'cold', text: '❄️ Cold Streak' };
    } else {
      const avg = rolling.batting_avg || rolling.avg || 0;
      const avgValue = avg < 1 ? avg : avg / 1000;
      if (avgValue > 0.300) return { status: 'hot', text: '🔥 Hot Streak' };
      if (avgValue < 0.200) return { status: 'cold', text: '❄️ Cold Streak' };
    }
    
    return { status: 'neutral', text: '➖ Steady' };
  };

  const performance = getPerformanceStatus();

  const getActionButton = () => {
    if (loading || rosterStatus === 'checking' || !player) return null;
    
    const price = player.salary || player.price || 1.0;
    
    if (rosterStatus === 'available') {
      return (
        <button
          onClick={() => handlePlayerAction('add', player)}
          disabled={actionLoading}
          className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} w-full`}
        >
          Add Player - ${price}M
        </button>
      );
    } else if (rosterStatus === 'owned') {
      return (
        <button
          onClick={() => handlePlayerAction('drop', player)}
          disabled={actionLoading}
          className={`${dynastyTheme.utils.getComponent('button', 'danger', 'md')} w-full`}
        >
          Drop Player
        </button>
      );
    } else {
      return (
        <button
          onClick={() => handlePlayerAction('trade', player)}
          disabled={actionLoading}
          className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} w-full`}
        >
          Propose Trade
        </button>
      );
    }
  };

  const handlePlayerAction = async (action, playerData) => {
    setActionLoading(true);
    try {
      if (onPlayerAction) {
        await onPlayerAction(action, playerData);
      }
      window.dispatchEvent(new Event('roster-updated'));
      onClose();
    } catch (err) {
      console.error(`Error ${action} player:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  // Render stats table row with proper field mapping
  const renderStatsRow = (label, statsData, categories) => {
    const isP = isPitcher();
    const cats = isP ? categories?.pitching : categories?.hitting;
    
    if (!cats || !Array.isArray(cats) || !statsData) return null;

    // For accrued stats, use active_ prefix
    const isAccrued = label === 'Accrued';

    return (
      <tr className={label === 'Accrued' ? 'bg-yellow-400/5' : ''}>
        <td className={`py-1 px-2 text-xs ${dynastyTheme.classes.text.neutralLight} text-left`}>
          {label}
        </td>
        {cats.map(cat => {
          let value = 0;
          
          // Map category to field name
          const catLower = cat.toLowerCase();
          
          if (catLower === 'avg') {
            const fieldName = isAccrued ? 'active_batting_avg' : 'batting_avg';
            value = formatAvg(statsData[fieldName] || 0);
          } else if (catLower === 'era') {
            const fieldName = isAccrued ? 'active_era' : 'era';
            value = formatEra(statsData[fieldName] || 0);
          } else if (catLower === 'whip') {
            const fieldName = isAccrued ? 'active_whip' : 'whip';
            value = formatWhip(statsData[fieldName] || 0);
          } else if (catLower === 'ops') {
            const fieldName = isAccrued ? 'active_ops' : 'ops';
            value = (statsData[fieldName] || 0).toFixed(3);
          } else if (catLower === 'r') {
            const fieldName = isAccrued ? 'active_runs' : 'runs';
            value = statsData[fieldName] || 0;
          } else if (catLower === 'hr') {
            const fieldName = isAccrued ? 'active_home_runs' : 'home_runs';
            value = statsData[fieldName] || 0;
          } else if (catLower === 'rbi') {
            const fieldName = isAccrued ? 'active_rbi' : 'rbi';
            value = statsData[fieldName] || 0;
          } else if (catLower === 'sb') {
            const fieldName = isAccrued ? 'active_stolen_bases' : 'stolen_bases';
            value = statsData[fieldName] || 0;
          } else if (catLower === 'w') {
            const fieldName = isAccrued ? 'active_wins' : 'wins';
            value = statsData[fieldName] || 0;
          } else if (catLower === 'sv') {
            const fieldName = isAccrued ? 'active_saves' : 'saves';
            value = statsData[fieldName] || 0;
          } else if (catLower === 'so' || catLower === 'k') {
            const fieldName = isAccrued ? 'active_strikeouts_pitched' : 'strikeouts_pitched';
            value = statsData[fieldName] || statsData.strikeouts || 0;
          } else if (catLower === 'qs') {
            const fieldName = isAccrued ? 'active_quality_starts' : 'quality_starts';
            value = statsData[fieldName] || 0;
          }
          
          return (
            <td key={cat} className={`py-1 px-2 text-xs text-center ${
              label === 'Accrued' ? dynastyTheme.classes.text.primary : dynastyTheme.classes.text.white
            }`}>
              {value}
            </td>
          );
        })}
      </tr>
    );
  };

  // Tab content components
  const InfoTab = () => (
    <div className="space-y-4">
      {/* Player Details Grid */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Height:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-2`}>
              {formatHeight(player?.height || player?.height_inches)}
            </span>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Weight:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-2`}>
              {player?.weight || player?.weight_pounds || 'N/A'} lbs
            </span>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Jersey:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-2`}>
              #{player?.uniform_number || player?.jersey_number || player?.number || 'N/A'}
            </span>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Birthdate:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-2`}>
              {player?.birthdate ? new Date(player.birthdate).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Performance Status */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <h4 className={`${dynastyTheme.classes.text.primary} font-semibold mb-3 flex items-center`}>
          <Activity className="w-4 h-4 mr-2" />
          Performance Status
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Current Form:</span>
            <span className={`ml-2 font-medium ${
              performance.status === 'hot' ? dynastyTheme.classes.text.success :
              performance.status === 'cold' ? dynastyTheme.classes.text.error :
              dynastyTheme.classes.text.white
            }`}>
              {performance.text}
            </span>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Last 14 Days:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-2`}>
              {player?.rolling_14_day ? 
                (isPitcher() ? 
                  `${formatEra(player.rolling_14_day.era)} ERA` : 
                  `${formatAvg(player.rolling_14_day.batting_avg)} AVG`
                ) : 'No data'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Contract Info */}
      {(player?.salary || player?.price) && (
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <h4 className={`${dynastyTheme.classes.text.primary} font-semibold mb-3 flex items-center`}>
            <DollarSign className="w-4 h-4 mr-2" />
            Contract Details
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className={dynastyTheme.classes.text.neutralLight}>Salary:</span>
              <span className={`${dynastyTheme.classes.text.success} ml-2 font-semibold`}>
                ${player.salary || player.price || 1}M
              </span>
            </div>
            <div>
              <span className={dynastyTheme.classes.text.neutralLight}>Contract Years:</span>
              <span className={`${dynastyTheme.classes.text.white} ml-2`}>
                {player.contract_years || 1}
              </span>
            </div>
            <div>
              <span className={dynastyTheme.classes.text.neutralLight}>Status:</span>
              <span className={`${dynastyTheme.classes.text.white} ml-2`}>
                {player.roster_status === 'minors' ? 'Minor League' : 
                 player.roster_status === 'dl' ? 'Disabled List' :
                 player.roster_status === 'bench' ? 'Bench' : 'Active'}
              </span>
            </div>
            <div>
              <span className={dynastyTheme.classes.text.neutralLight}>Expires:</span>
              <span className={`${dynastyTheme.classes.text.white} ml-2`}>
                {new Date().getFullYear() + (player.contract_years || 1) - 1}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Awards/Achievements placeholder */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <h4 className={`${dynastyTheme.classes.text.primary} font-semibold mb-3 flex items-center`}>
          <Award className="w-4 h-4 mr-2" />
          Season Highlights
        </h4>
        <div className="space-y-2 text-sm">
          {player?.home_runs > 20 && (
            <div className={`flex items-center ${dynastyTheme.classes.text.success}`}>
              <Shield className="w-4 h-4 mr-2" />
              20+ Home Runs
            </div>
          )}
          {player?.batting_avg > 0.300 && !isPitcher() && (
            <div className={`flex items-center ${dynastyTheme.classes.text.success}`}>
              <TrendingUp className="w-4 h-4 mr-2" />
              .300+ Average
            </div>
          )}
          {player?.era < 3.00 && isPitcher() && (
            <div className={`flex items-center ${dynastyTheme.classes.text.success}`}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Sub-3.00 ERA
            </div>
          )}
          {!player?.home_runs && !player?.batting_avg && !player?.era && (
            <span className={dynastyTheme.classes.text.neutralDark}>
              Season in progress
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const StatsTab = () => (
    <div className="space-y-4">
      {/* Stats Table */}
      {scoringCategories && (
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <h4 className={`${dynastyTheme.classes.text.primary} font-semibold mb-3 flex items-center`}>
            <ChartBar className="w-4 h-4 mr-2" />
            Performance Statistics
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-700">
                  <th className={`py-1 px-2 text-left ${dynastyTheme.classes.text.neutralLight}`}>
                    Period
                  </th>
                  {(isPitcher() ? 
                    (scoringCategories.pitching || []) : 
                    (scoringCategories.hitting || [])
                  ).map(cat => (
                    <th key={cat} className={`py-1 px-2 text-center ${dynastyTheme.classes.text.neutralLight}`}>
                      {cat}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Season Stats */}
                {renderStatsRow('Season', player?.season_stats || player, scoringCategories)}
                
                {/* Rolling 14-day stats */}
                {(player?.rolling_14_day || player?.last_14_days) && 
                  renderStatsRow('L14', player.rolling_14_day || player.last_14_days, scoringCategories)}
                
                {/* Accrued stats - only for owned players */}
                {rosterStatus === 'owned' && player?.accrued_stats && 
                  renderStatsRow('Accrued', player.accrued_stats, scoringCategories)}
              </tbody>
            </table>
          </div>
          
          {/* Stats Legend */}
          <div className="mt-4 pt-4 border-t border-neutral-700">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-neutral-600 rounded mr-2"></div>
                <span className={dynastyTheme.classes.text.neutralLight}>Season: Full 2025 stats</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-neutral-600 rounded mr-2"></div>
                <span className={dynastyTheme.classes.text.neutralLight}>L14: Last 14 days</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-400/20 rounded mr-2"></div>
                <span className={dynastyTheme.classes.text.neutralLight}>Accrued: While on roster</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Additional Stats Info */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <h4 className={`${dynastyTheme.classes.text.primary} font-semibold mb-3`}>
          Statistical Notes
        </h4>
        <ul className="space-y-2 text-sm">
          <li className={dynastyTheme.classes.text.neutralLight}>
            • Rolling stats update daily at 2 AM ET
          </li>
          <li className={dynastyTheme.classes.text.neutralLight}>
            • Accrued stats only count while player is on active roster
          </li>
          <li className={dynastyTheme.classes.text.neutralLight}>
            • Minor league stats do not count toward team totals
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className={`
        relative w-full max-w-2xl mx-4 ${dynastyTheme.components.card.base} 
        shadow-2xl border border-neutral-600 max-h-[90vh] overflow-y-auto
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <div className="flex items-center gap-3">
            <User className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
            <h2 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
              Player Profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${dynastyTheme.classes.text.neutralLight} hover:${dynastyTheme.classes.text.white} hover:${dynastyTheme.classes.bg.neutral} transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="p-8 text-center">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${dynastyTheme.classes.border.primary} mx-auto mb-4`}></div>
            <p className={dynastyTheme.classes.text.neutralLight}>Loading...</p>
          </div>
        )}

        {!loading && player && (
          <>
            {/* Player Header */}
            <div className="p-4 text-center border-b border-neutral-700">
              {player.mlb_player_id && (
                <div className="mb-3">
                  <img 
                    src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_96,h_96,c_fill,g_face,q_auto:best/v1/people/${player.mlb_player_id}/headshot/67/current`}
                    alt={`${player.first_name} ${player.last_name}`}
                    className="w-24 h-24 rounded-full mx-auto border-2 border-yellow-400 bg-neutral-800 object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${player.first_name}+${player.last_name}&background=facc15&color=000&size=96`;
                    }}
                  />
                </div>
              )}
              
              <h3 className={`text-2xl font-bold ${dynastyTheme.classes.text.white} mb-1`}>
                {player.first_name} {player.last_name}
              </h3>
              
              <div className="flex items-center justify-center gap-4 text-sm">
                <span className={`${dynastyTheme.classes.text.primary} font-medium`}>
                  {player.position}
                </span>
                <span className={dynastyTheme.classes.text.neutralLight}>
                  {player.mlb_team || 'Free Agent'}
                </span>
                <span className={dynastyTheme.classes.text.neutralLight}>
                  Age {calculateAge(player.birthdate)}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-700">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'info'
                    ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primary}`
                    : `${dynastyTheme.classes.text.neutralLight} hover:${dynastyTheme.classes.text.white}`
                }`}
              >
                Info
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'stats'
                    ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primary}`
                    : `${dynastyTheme.classes.text.neutralLight} hover:${dynastyTheme.classes.text.white}`
                }`}
              >
                Stats
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {activeTab === 'info' ? <InfoTab /> : <StatsTab />}
            </div>

            {/* Action Button */}
            <div className="p-4 border-t border-neutral-700">
              {getActionButton()}
              
              {/* View Full Profile Link */}
              <div className="text-center pt-3">
                <button
                  onClick={() => {
                    const mlbId = player.mlb_player_id || player.player_id || playerId;
                    window.open(`/player/${mlbId}?leagueId=${leagueId}`, '_blank');
                  }}
                  className={`${dynastyTheme.classes.text.neutralLight} hover:${dynastyTheme.classes.text.primary} text-sm ${dynastyTheme.classes.transitionFast} flex items-center justify-center gap-1 mx-auto`}
                >
                  View Full Profile
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </>
        )}

        {!loading && !player && (
          <div className="p-8 text-center">
            <p className={dynastyTheme.classes.text.error}>Player not found</p>
            <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-2`}>
              This player may be on another team or not available in your league.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerProfileModal;