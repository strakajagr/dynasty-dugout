// src/components/PlayerProfileModal.js - CANONICAL STRUCTURE COMPATIBLE
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, ExternalLink, DollarSign, User, ChartBar, 
  TrendingUp, TrendingDown, Activity, Award,
  Calendar, Clock, Shield, AlertCircle, Zap, Target, Flame
} from 'lucide-react';
import { dynastyTheme } from '../services/colorService';
import { leaguesAPI, teamStatsAPI } from '../services/apiService';
import apiService from '../services/apiService';
import { WatchListStar } from './WatchList';

const PlayerProfileModal = ({ 
  playerId, 
  leagueId, 
  isOpen, 
  onClose, 
  userTeamId, 
  onPlayerAction,
  isCommissionerMode = false,
  league = null,
  initialPlayer = null
}) => {
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState(null);
  const [rosterStatus, setRosterStatus] = useState('checking');
  const [actionLoading, setActionLoading] = useState(false);
  const [scoringCategories, setScoringCategories] = useState(null);
  const [teamStats, setTeamStats] = useState(null);

  useEffect(() => {
    if (isOpen && playerId) {
      loadPlayerData();
      loadScoringCategories();
    }
  }, [isOpen, playerId, leagueId]);

  const loadScoringCategories = async () => {
    const defaultCats = {
      hitting: ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
      pitching: ['W', 'SV', 'ERA', 'WHIP', 'K', 'QS']
    };
    setScoringCategories(defaultCats);

    if (leagueId) {
      if (league?.scoring_categories) {
        const cats = typeof league.scoring_categories === 'string' 
          ? JSON.parse(league.scoring_categories)
          : league.scoring_categories;
        
        const normalizedCats = {
          hitting: cats.hitting || cats.hitters || defaultCats.hitting,
          pitching: cats.pitching || cats.pitchers || defaultCats.pitching
        };
        
        setScoringCategories(normalizedCats);
        return;
      }
      
      try {
        const response = await leaguesAPI.getLeagueSettings(leagueId);
        
        if (response.success && response.settings?.scoring_categories) {
          const cats = typeof response.settings.scoring_categories === 'string' 
            ? JSON.parse(response.settings.scoring_categories)
            : response.settings.scoring_categories;
          
          const normalizedCats = {
            hitting: cats.hitting || cats.hitters || defaultCats.hitting,
            pitching: cats.pitching || cats.pitchers || defaultCats.pitching
          };
          
          setScoringCategories(normalizedCats);
        }
      } catch (err) {
        console.error('Error loading scoring categories:', err);
      }
    }
  };

  const loadPlayerData = async () => {
    setLoading(true);
    
    try {
      // Get complete player data from MLB database
      const response = await apiService.get(`/api/players/${playerId}/complete`);
      const data = response.data || response;
      
      console.log('Raw API response:', data);
      
      if (data && data.player) {
        console.log('Loaded canonical player data:', data.player);
        
        // TRANSFORM CANONICAL STRUCTURE TO FLAT STRUCTURE FOR MODAL
        const playerData = data.player;
        const flatPlayer = {
          // IDs
          player_id: playerData.ids?.mlb || playerId,
          mlb_player_id: playerData.ids?.mlb || playerId,
          
          // Info fields - from player.info.*
          first_name: playerData.info?.first_name || '',
          last_name: playerData.info?.last_name || '',
          position: playerData.info?.position || '',
          mlb_team: playerData.info?.mlb_team || '',
          jersey_number: playerData.info?.jersey_number || 0,
          height_inches: playerData.info?.height_inches || null,
          weight_pounds: playerData.info?.weight_pounds || null,
          birthdate: playerData.info?.birthdate || null,
          age: playerData.info?.age || null,
          is_active: playerData.info?.active ?? true,
          
          // Stats - from player.stats.*
          season_stats: playerData.stats?.season || null,
          rolling_14_day: playerData.stats?.rolling_14_day || null,
          last_14_days: playerData.stats?.rolling_14_day || null // Alias
        };
        
        console.log('Transformed to flat structure:', flatPlayer);
        
        // Set player with transformed data
        setPlayer(flatPlayer);
        
        // If in a league context, determine roster status
        if (leagueId) {
          try {
            // FIRST check if player is a free agent
            console.log('Checking free agents for player:', playerId);
            const faResponse = await leaguesAPI.getFreeAgentsEnhanced(leagueId, { 
              limit: 500,
              show_all: true
            });
            
            if (faResponse.success && faResponse.players) {
              const faPlayer = faResponse.players.find(p => 
                String(p.mlb_player_id) === String(playerId) || 
                String(p.player_id) === String(playerId)
              );
              
              if (faPlayer) {
                console.log('✅ Player is a FREE AGENT:', faPlayer);
                setRosterStatus('available');
                
                // Merge league pricing but keep MLB stats
                setPlayer(prev => ({
                  ...prev,
                  salary: faPlayer.salary || faPlayer.price || 1,
                  contract_years: faPlayer.contract_years || 1,
                  league_player_id: faPlayer.league_player_id
                }));
                return; // Exit early - player is available
              }
            }
            
            // If not a free agent, check user's roster
            console.log('Checking user roster for player:', playerId);
            const rosterResponse = await leaguesAPI.getMyRosterEnhanced(leagueId);
            
            if (rosterResponse.success && rosterResponse.players) {
              const rosterPlayer = rosterResponse.players.find(p => 
                String(p.mlb_player_id) === String(playerId) || 
                String(p.player_id) === String(playerId)
              );
              
              if (rosterPlayer) {
                console.log('✅ Player is on USER ROSTER:', rosterPlayer);
                setRosterStatus('owned');
                
                // Merge roster data but keep MLB stats
                setPlayer(prev => ({
                  ...prev,
                  salary: rosterPlayer.salary || rosterPlayer.price || 1,
                  contract_years: rosterPlayer.contract_years || 1,
                  league_player_id: rosterPlayer.league_player_id,
                  accrued_stats: rosterPlayer.accrued_stats
                }));
                return; // Exit early - player is owned by user
              }
            }
            
            // If not free agent or on user's team, must be on another team
            console.log('✅ Player is on ANOTHER TEAM');
            setRosterStatus('other_team');
            
          } catch (err) {
            console.error('Error checking roster status:', err);
            setRosterStatus('view_only');
          }
        } else {
          // Not in a league context
          console.log('No league context - view only mode');
          setRosterStatus('view_only');
        }
      }
    } catch (err) {
      console.error('Error fetching complete player data:', err);
      
      // Fallback to initial player if provided
      if (initialPlayer) {
        console.log('Using initial player data as fallback');
        setPlayer(initialPlayer);
        
        // If we have initial player and we're in a league, check if it's available
        if (leagueId && initialPlayer.availability_status === 'available') {
          setRosterStatus('available');
        } else if (leagueId) {
          setRosterStatus('other_team');
        } else {
          setRosterStatus('view_only');
        }
      }
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
    if (avg < 1) {
      return avg.toFixed(3);
    }
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

  const getPerformanceStatus = () => {
    if (!player) return { status: 'neutral', text: 'No recent data' };
    
    const rolling = player.rolling_14_day || player.last_14_days;
    if (!rolling) return { status: 'neutral', text: 'No recent data' };
    
    if (isPitcher()) {
      const era = rolling.era || 0;
      if (era < 2.50) return { status: 'hot', text: '🔥 Hot Streak' };
      if (era > 5.00) return { status: 'cold', text: '❄️ Cold Streak' };
    } else {
      let opsValue = rolling.ops;
      if (!opsValue && rolling.batting_avg !== undefined) {
        const avg = rolling.batting_avg || rolling.avg || 0;
        const avgValue = avg < 1 ? avg : avg / 1000;
        if (avgValue > 0.300) return { status: 'hot', text: '🔥 Hot Streak' };
        if (avgValue < 0.200) return { status: 'cold', text: '❄️ Cold Streak' };
      } else if (opsValue) {
        if (opsValue > 0.850) return { status: 'hot', text: '🔥 Hot Streak' };
        if (opsValue < 0.650) return { status: 'cold', text: '❄️ Cold Streak' };
      }
    }
    
    return { status: 'neutral', text: '➖ Steady' };
  };

  const performance = getPerformanceStatus();

  const getActionButton = () => {
    console.log('🎯 Getting action button for status:', rosterStatus, 'Loading:', loading);
    
    if (loading || rosterStatus === 'checking' || !player) {
      return null;
    }
    
    if (rosterStatus === 'view_only') {
      return null;
    }
    
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
    } else if (rosterStatus === 'other_team') {
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
    
    return null;
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

  const renderStatsRow = (label, statsData, categories) => {
    const isP = isPitcher();
    const cats = isP ? categories?.pitching : categories?.hitting;
    
    if (!cats || !Array.isArray(cats) || !statsData) return null;

    const isAccrued = label === 'Accrued';

    return (
      <tr className={label === 'Accrued' ? 'bg-yellow-400/5' : ''}>
        <td className={`py-2 px-3 text-sm font-medium ${dynastyTheme.classes.text.neutralLight} text-left`}>
          {label}
        </td>
        {cats.map(cat => {
          let value = 0;
          
          const catLower = cat.toLowerCase();
          
          // Map category to the correct field in statsData
          if (catLower === 'avg') {
            const fieldName = isAccrued ? 'active_batting_avg' : 'batting_avg';
            value = formatAvg(statsData[fieldName] || 0);
          } else if (catLower === 'era') {
            if (statsData.pitching) {
              value = formatEra(statsData.pitching.era || 0);
            } else {
              const fieldName = isAccrued ? 'active_era' : 'era';
              value = formatEra(statsData[fieldName] || 0);
            }
          } else if (catLower === 'whip') {
            if (statsData.pitching) {
              value = formatWhip(statsData.pitching.whip || 0);
            } else {
              const fieldName = isAccrued ? 'active_whip' : 'whip';
              value = formatWhip(statsData[fieldName] || 0);
            }
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
            if (statsData.pitching) {
              value = statsData.pitching.wins || 0;
            } else {
              const fieldName = isAccrued ? 'active_wins' : 'wins';
              value = statsData[fieldName] || 0;
            }
          } else if (catLower === 'sv' || catLower === 'saves') {
            if (statsData.pitching) {
              value = statsData.pitching.saves || 0;
            } else {
              const fieldName = isAccrued ? 'active_saves' : 'saves';
              value = statsData[fieldName] || 0;
            }
          } else if (catLower === 'so' || catLower === 'k') {
            if (statsData.pitching) {
              value = statsData.pitching.strikeouts_pitched || 0;
            } else {
              const fieldName = isAccrued ? 'active_strikeouts_pitched' : 'strikeouts_pitched';
              value = statsData[fieldName] || statsData.strikeouts || 0;
            }
          } else if (catLower === 'qs') {
            if (statsData.pitching) {
              value = statsData.pitching.quality_starts || 0;
            } else {
              const fieldName = isAccrued ? 'active_quality_starts' : 'quality_starts';
              value = statsData[fieldName] || 0;
            }
          }
          
          return (
            <td key={cat} className={`py-2 px-3 text-sm text-center ${
              label === 'Accrued' ? 'text-yellow-400 font-semibold' : dynastyTheme.classes.text.white
            }`}>
              {value}
            </td>
          );
        })}
      </tr>
    );
  };

  const InfoTab = () => (
    <div className="space-y-4">
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Height:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-2`}>
              {formatHeight(player?.height_inches)}
            </span>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Weight:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-2`}>
              {player?.weight_pounds || 'N/A'} lbs
            </span>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Jersey:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-2`}>
              #{player?.jersey_number || 'N/A'}
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
                  player.rolling_14_day.ops ? 
                    `${player.rolling_14_day.ops.toFixed(3)} OPS` :
                    `${formatAvg(player.rolling_14_day.batting_avg)} AVG`
                ) : 'No data'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Season Analytics Section */}
      {player?.season_stats && (
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <h4 className={`${dynastyTheme.classes.text.primary} font-semibold mb-3 flex items-center`}>
            <Zap className="w-4 h-4 mr-2" />
            Key Performance Metrics
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {!isPitcher() ? (
              <>
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-yellow-400" />
                  <div>
                    <span className={dynastyTheme.classes.text.neutralLight}>Power:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-2 font-semibold`}>
                      {player.season_stats.home_runs || 0} HR, {player.season_stats.slg?.toFixed(3) || '.000'} SLG
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <div>
                    <span className={dynastyTheme.classes.text.neutralLight}>Contact:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-2 font-semibold`}>
                      {player.season_stats.strikeouts && player.season_stats.at_bats
                        ? `${(100 - (player.season_stats.strikeouts / player.season_stats.at_bats * 100)).toFixed(0)}% Contact`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <div>
                    <span className={dynastyTheme.classes.text.neutralLight}>Run Production:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-2 font-semibold`}>
                      {(player.season_stats.runs || 0) + (player.season_stats.rbi || 0)} R+RBI
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <div>
                    <span className={dynastyTheme.classes.text.neutralLight}>Discipline:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-2 font-semibold`}>
                      {player.season_stats.walks && player.season_stats.strikeouts 
                        ? `${(player.season_stats.walks / player.season_stats.strikeouts).toFixed(2)} BB/K`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <div>
                    <span className={dynastyTheme.classes.text.neutralLight}>Dominance:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-2 font-semibold`}>
                      {(() => {
                        const ip = player.season_stats.pitching?.innings_pitched || player.season_stats.innings_pitched;
                        const k = player.season_stats.pitching?.strikeouts_pitched || player.season_stats.strikeouts_pitched;
                        return ip && k ? `${((k * 9) / ip).toFixed(1)} K/9` : 'N/A';
                      })()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <div>
                    <span className={dynastyTheme.classes.text.neutralLight}>Command:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-2 font-semibold`}>
                      {(() => {
                        const ip = player.season_stats.pitching?.innings_pitched || player.season_stats.innings_pitched;
                        const bb = player.season_stats.walks_allowed || 0;
                        return ip && bb >= 0 ? `${((bb * 9) / ip).toFixed(1)} BB/9` : 'N/A';
                      })()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-yellow-400" />
                  <div>
                    <span className={dynastyTheme.classes.text.neutralLight}>Efficiency:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-2 font-semibold`}>
                      {(() => {
                        const ip = player.season_stats.pitching?.innings_pitched || player.season_stats.innings_pitched;
                        const starts = player.season_stats.games_played || 0;
                        return ip && starts ? `${(ip / starts).toFixed(1)} IP/Start` : 'N/A';
                      })()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <div>
                    <span className={dynastyTheme.classes.text.neutralLight}>Win Rate:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-2 font-semibold`}>
                      {(() => {
                        const wins = player.season_stats.pitching?.wins || player.season_stats.wins || 0;
                        const losses = player.season_stats.pitching?.losses || player.season_stats.losses || 0;
                        const total = wins + losses;
                        return total > 0 ? `${((wins / total) * 100).toFixed(0)}%` : '0%';
                      })()}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
          </div>
        </div>
      )}
    </div>
  );

  const StatsTab = () => (
    <div className="space-y-4">
      {player && scoringCategories && (
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <h4 className={`${dynastyTheme.classes.text.primary} font-semibold mb-3 flex items-center`}>
            <ChartBar className="w-4 h-4 mr-2" />
            Performance Statistics
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-700">
                  <th className={`py-2 px-3 text-left text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                    Period
                  </th>
                  {(isPitcher() ? 
                    (scoringCategories.pitching || []) : 
                    (scoringCategories.hitting || [])
                  ).map(cat => (
                    <th key={cat} className={`py-2 px-3 text-center text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                      {cat}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {player.season_stats && renderStatsRow('Season', player.season_stats, scoringCategories)}
                {(player.rolling_14_day || player.last_14_days) && 
                  renderStatsRow('L14', player.rolling_14_day || player.last_14_days, scoringCategories)}
                {rosterStatus === 'owned' && player.accrued_stats && 
                  renderStatsRow('Accrued', player.accrued_stats, scoringCategories)}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 pt-4 border-t border-neutral-700">
            <div className={`grid ${rosterStatus === 'owned' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-xs`}>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-neutral-600 rounded mr-2"></div>
                <span className={dynastyTheme.classes.text.neutralLight}>Season: Full 2025 stats</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-neutral-600 rounded mr-2"></div>
                <span className={dynastyTheme.classes.text.neutralLight}>L14: Last 14 days</span>
              </div>
              {rosterStatus === 'owned' && (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-400/20 rounded mr-2"></div>
                  <span className={dynastyTheme.classes.text.neutralLight}>Accrued: While on roster</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!player && (
        <div className={`${dynastyTheme.components.card.base} p-8 text-center`}>
          <p className={dynastyTheme.classes.text.neutralLight}>Loading player statistics...</p>
        </div>
      )}
    </div>
  );

  // Modal rendering with portal
  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex: 999999 }}>
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className={`
          relative w-full max-w-2xl ${dynastyTheme.components.card.base} 
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
              <p className={dynastyTheme.classes.text.neutralLight}>Loading complete player data...</p>
            </div>
          )}

          {!loading && player && (
            <>
              {/* Player Header */}
              <div className="p-4 text-center border-b border-neutral-700">
                {(player.mlb_player_id || player.player_id) && (
                  <div className="mb-3">
                    <img 
                      src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_96,h_96,c_fill,g_face,q_auto:best/v1/people/${player.mlb_player_id || player.player_id}/headshot/67/current`}
                      alt={`${player.first_name} ${player.last_name}`}
                      className="w-24 h-24 rounded-full mx-auto border-2 border-yellow-400 bg-neutral-800 object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${player.first_name}+${player.last_name}&background=facc15&color=000&size=96`;
                      }}
                    />
                  </div>
                )}
                
                <h3 className={`text-2xl font-bold ${dynastyTheme.classes.text.white} mb-1 flex items-center justify-center gap-2`}>
                  {player.first_name} {player.last_name}
                  <WatchListStar 
                    playerId={player.mlb_player_id || player.player_id} 
                    size={20}
                  />
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
                  Info & Analytics
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

              {/* Action Button and Profile Link */}
              <div className="p-4 border-t border-neutral-700">
                {/* Show action button only if in league context */}
                {leagueId && getActionButton()}
                
                {/* ALWAYS show profile link */}
                <div className="text-center pt-3">
                  <button
                    onClick={() => {
                      const mlbId = player.mlb_player_id || player.player_id || playerId;
                      const url = leagueId 
                        ? `/player/${mlbId}?leagueId=${leagueId}`
                        : `/player/${mlbId}`;
                      window.open(url, '_blank');
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
                Unable to load player data. Please try again.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level
  return isOpen ? ReactDOM.createPortal(modalContent, document.body) : null;
};

export default PlayerProfileModal;
