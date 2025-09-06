// src/components/player/PlayerInfoCard.js - ENHANCED WITH FULL ORIGINAL FUNCTIONALITY
import React, { useState } from 'react';
import { 
  User, TrendingUp, Award, Calendar, DollarSign, Users, Activity, 
  Target, ChevronRight, BarChart3, TrendingDown, Zap, Shield, 
  Timer, Percent, Brain, History, ChartBar 
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

// StatTile Component from original
const StatTile = ({ value, label, icon: Icon, trend, size = 'md', highlight = false }) => {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };
  
  return (
    <div className={`${dynastyTheme.components.card.interactive} ${sizeClasses[size]} ${highlight ? 'border-yellow-400/50' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className={`${size === 'lg' ? 'text-3xl' : 'text-2xl'} font-bold text-white`}>
            {value !== null && value !== undefined ? value : '-'}
          </div>
          <div className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">
            {label}
          </div>
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg bg-yellow-400/10 ${highlight ? 'text-yellow-400' : 'text-neutral-400'}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs mt-2 ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-neutral-400'}`}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
          <span>{trend > 0 ? '+' : ''}{trend}%</span>
        </div>
      )}
    </div>
  );
};

const PlayerInfoCard = ({ player, contractInfo, league2025Stats, rollingStats, analytics, isPitcher }) => {
  const [imageError, setImageError] = useState(false);

  // Calculate age from birthdate
  const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // MLB Stats API headshot URL
  const mlbImageUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${player.mlb_player_id || player.player_id}/headshot/67/current`;

  // Performance grade calculation
  const getPerformanceGrade = (ops) => {
    if (!ops && !isPitcher) return { grade: 'N/A', color: 'from-gray-400 to-gray-500' };
    if (isPitcher) {
      const era = league2025Stats?.era || 5.00;
      if (era <= 2.50) return { grade: 'A+', color: 'from-yellow-400 to-yellow-300' };
      if (era <= 3.00) return { grade: 'A', color: 'from-yellow-400 to-yellow-500' };
      if (era <= 3.50) return { grade: 'B+', color: 'from-blue-400 to-blue-500' };
      if (era <= 4.00) return { grade: 'B', color: 'from-green-400 to-green-500' };
      if (era <= 4.50) return { grade: 'C+', color: 'from-orange-400 to-orange-500' };
      if (era <= 5.00) return { grade: 'C', color: 'from-purple-400 to-purple-500' };
      return { grade: 'D', color: 'from-red-400 to-red-500' };
    }
    if (ops >= 1.000) return { grade: 'A+', color: 'from-yellow-400 to-yellow-300' };
    if (ops >= 0.900) return { grade: 'A', color: 'from-yellow-400 to-yellow-500' };
    if (ops >= 0.800) return { grade: 'B+', color: 'from-blue-400 to-blue-500' };
    if (ops >= 0.700) return { grade: 'B', color: 'from-green-400 to-green-500' };
    if (ops >= 0.600) return { grade: 'C+', color: 'from-orange-400 to-orange-500' };
    if (ops >= 0.500) return { grade: 'C', color: 'from-purple-400 to-purple-500' };
    return { grade: 'D', color: 'from-red-400 to-red-500' };
  };

  const performanceGrade = getPerformanceGrade(league2025Stats?.ops);
  const playerAge = calculateAge(player.birthdate);
  const heightInches = player.height_inches;
  const heightFeet = heightInches ? Math.floor(heightInches / 12) : null;
  const heightRemainder = heightInches ? heightInches % 12 : null;
  const heightFormatted = heightInches ? `${heightFeet}'${heightRemainder}"` : '-';
  const weightFormatted = player.weight_pounds ? `${player.weight_pounds} lbs` : '-';

  return (
    <>
      {/* ELABORATE HEADER SECTION - 12 COLUMN GRID LAYOUT */}
      <div className={`${dynastyTheme.components.card.base} overflow-hidden mb-6`}>
        <div className="bg-gradient-to-r from-yellow-400/10 via-transparent to-yellow-400/5 p-6">
          <div className="grid grid-cols-12 gap-6">
            
            {/* Player Image & Basic Info - 3 cols */}
            <div className="col-span-3">
              <div className={dynastyTheme.components.card.glass}>
                <div className="p-4">
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900 mb-4">
                    {!imageError ? (
                      <img 
                        src={mlbImageUrl}
                        alt={`${player.first_name} ${player.last_name}`}
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-24 h-24 text-neutral-600" />
                      </div>
                    )}
                    {player.jersey_number && (
                      <div className="absolute bottom-2 right-2 bg-yellow-400 text-black text-xl font-bold rounded-lg px-3 py-1">
                        #{player.jersey_number}
                      </div>
                    )}
                  </div>
                  
                  {/* Bio Stats */}
                  <div className="space-y-3">
                    <div className={`${dynastyTheme.components.card.flat} p-3 flex justify-between items-center`}>
                      <span className="text-neutral-400 text-sm">Position</span>
                      <span className="text-yellow-400 font-bold">{player.position || '-'}</span>
                    </div>
                    <div className={`${dynastyTheme.components.card.flat} p-3 flex justify-between items-center`}>
                      <span className="text-neutral-400 text-sm">Team</span>
                      <span className="text-white font-semibold">{player.mlb_team || '-'}</span>
                    </div>
                    <div className={`${dynastyTheme.components.card.flat} p-3 flex justify-between items-center`}>
                      <span className="text-neutral-400 text-sm">Height</span>
                      <span className="text-white">{heightFormatted}</span>
                    </div>
                    <div className={`${dynastyTheme.components.card.flat} p-3 flex justify-between items-center`}>
                      <span className="text-neutral-400 text-sm">Weight</span>
                      <span className="text-white">{weightFormatted}</span>
                    </div>
                    <div className={`${dynastyTheme.components.card.flat} p-3 flex justify-between items-center`}>
                      <span className="text-neutral-400 text-sm">Age</span>
                      <span className="text-white">{playerAge || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Name, Team Info & Key Stats - 6 cols */}
            <div className="col-span-6">
              <div className="mb-4">
                <h1 className="text-5xl font-bold text-white mb-2">
                  {player.first_name} <span className="text-yellow-400">{player.last_name}</span>
                </h1>
                <div className="flex items-center gap-4 mb-6">
                  <span className={dynastyTheme.components.badge.warning}>
                    {contractInfo?.team_name || 'Free Agent'}
                  </span>
                  <span className={dynastyTheme.components.badge.info}>
                    Owner: {contractInfo?.owner_name || 'Available'}
                  </span>
                  <span className={dynastyTheme.components.badge.success}>
                    ${contractInfo?.salary || '1.0'}M / {contractInfo?.contract_years || 1}yr
                  </span>
                  {/* HOT/COLD STATUS */}
                  {analytics?.hot_cold && (
                    <span className={`px-3 py-1 rounded-full ${
                      analytics.hot_cold.status === 'hot' ? 'bg-red-500/20 text-red-400' :
                      analytics.hot_cold.status === 'cold' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {analytics.hot_cold.status === 'hot' ? '🔥 Hot' :
                       analytics.hot_cold.status === 'cold' ? '❄️ Cold' :
                       '➡️ Steady'}
                    </span>
                  )}
                </div>
              </div>

              {/* Key Season Stats Grid with StatTile */}
              <div className="grid grid-cols-4 gap-3">
                {isPitcher ? (
                  <>
                    <StatTile value={league2025Stats?.wins || 0} label="Wins" icon={Award} highlight />
                    <StatTile value={league2025Stats?.losses || 0} label="Losses" icon={TrendingDown} />
                    <StatTile value={league2025Stats?.era?.toFixed(2) || '-'} label="ERA" icon={Target} highlight />
                    <StatTile value={league2025Stats?.whip?.toFixed(3) || '-'} label="WHIP" icon={Shield} />
                    <StatTile value={league2025Stats?.saves || 0} label="Saves" icon={Zap} />
                    <StatTile value={league2025Stats?.strikeouts_pitched || 0} label="K" icon={Activity} />
                    <StatTile value={league2025Stats?.innings_pitched?.toFixed(1) || '-'} label="IP" icon={Timer} />
                    <StatTile value={league2025Stats?.quality_starts || 0} label="QS" icon={Award} />
                  </>
                ) : (
                  <>
                    <StatTile value={league2025Stats?.batting_avg?.toFixed(3) || '.000'} label="AVG" icon={Target} highlight />
                    <StatTile value={league2025Stats?.home_runs || 0} label="HR" icon={Zap} highlight />
                    <StatTile value={league2025Stats?.rbi || 0} label="RBI" icon={Users} />
                    <StatTile value={league2025Stats?.runs || 0} label="Runs" icon={TrendingUp} />
                    <StatTile value={league2025Stats?.stolen_bases || 0} label="SB" icon={Activity} />
                    <StatTile value={league2025Stats?.obp?.toFixed(3) || '.000'} label="OBP" icon={Percent} />
                    <StatTile value={league2025Stats?.slg?.toFixed(3) || '.000'} label="SLG" icon={BarChart3} />
                    <StatTile value={league2025Stats?.ops?.toFixed(3) || '.000'} label="OPS" icon={Shield} highlight />
                  </>
                )}
              </div>
            </div>

            {/* Performance Grade & Trending - 3 cols */}
            <div className="col-span-3">
              <div className={`${dynastyTheme.components.card.highlighted} h-full`}>
                <div className="p-6 text-center">
                  <div className="text-sm text-neutral-400 uppercase tracking-wider mb-2">
                    Performance Grade
                  </div>
                  <div className={`text-7xl font-bold bg-gradient-to-r ${performanceGrade.color} bg-clip-text text-transparent mb-4`}>
                    {performanceGrade.grade}
                  </div>
                  <div className="text-sm text-neutral-400 mb-6">2025 Season</div>
                  
                  {/* Quick Trending Stats */}
                  <div className={`${dynastyTheme.components.card.flat} p-4 text-left`}>
                    <div className="text-xs text-neutral-400 uppercase tracking-wider mb-3">
                      Last 14 Days
                    </div>
                    <div className="space-y-2">
                      {isPitcher ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-neutral-400">ERA</span>
                            <span className={`text-sm font-semibold ${
                              (rollingStats?.era || 0) < (league2025Stats?.era || 0) ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {rollingStats?.era?.toFixed(2) || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-neutral-400">WHIP</span>
                            <span className="text-sm font-semibold text-white">
                              {rollingStats?.whip?.toFixed(3) || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-neutral-400">K/9</span>
                            <span className="text-sm font-semibold text-white">
                              {rollingStats?.innings_pitched ? 
                                ((rollingStats.strikeouts_pitched || 0) / rollingStats.innings_pitched * 9).toFixed(1) : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-neutral-400">W-L</span>
                            <span className="text-sm font-semibold text-white">
                              {rollingStats?.wins || 0}-{rollingStats?.losses || 0}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-neutral-400">AVG</span>
                            <span className={`text-sm font-semibold ${
                              (rollingStats?.batting_avg || 0) > (league2025Stats?.batting_avg || 0) ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {rollingStats?.batting_avg?.toFixed(3) || '.000'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-neutral-400">HR</span>
                            <span className="text-sm font-semibold text-white">{rollingStats?.home_runs || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-neutral-400">RBI</span>
                            <span className="text-sm font-semibold text-white">{rollingStats?.rbi || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-neutral-400">OPS</span>
                            <span className={`text-sm font-semibold ${
                              (rollingStats?.ops || 0) > (league2025Stats?.ops || 0) ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {rollingStats?.ops?.toFixed(3) || '.000'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {/* Full Season Stats */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-yellow-400" />
              2025 Season
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {isPitcher ? (
                <>
                  <StatTile value={league2025Stats?.games_played || 0} label="Games" size="sm" />
                  <StatTile value={league2025Stats?.games_started || 0} label="GS" size="sm" />
                  <StatTile value={league2025Stats?.complete_games || 0} label="CG" size="sm" />
                  <StatTile value={league2025Stats?.shutouts || 0} label="SHO" size="sm" />
                </>
              ) : (
                <>
                  <StatTile value={league2025Stats?.games_played || 0} label="Games" size="sm" />
                  <StatTile value={league2025Stats?.at_bats || 0} label="AB" size="sm" />
                  <StatTile value={league2025Stats?.hits || 0} label="Hits" size="sm" />
                  <StatTile value={league2025Stats?.doubles || 0} label="2B" size="sm" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Ranking & Percentiles */}
        <div className={dynastyTheme.components.card.highlighted}>
          <div className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Games Played</span>
                  <span className="text-sm font-bold text-white">
                    {league2025Stats?.games_played || 0}
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Status</span>
                  <span className={dynastyTheme.components.badge.success}>
                    {player.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              {analytics?.hot_cold && (
                <div className={dynastyTheme.components.listItem.base}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-300">Form</span>
                    <span className={`text-sm font-bold ${
                      analytics.hot_cold.status === 'hot' ? 'text-red-400' :
                      analytics.hot_cold.status === 'cold' ? 'text-blue-400' :
                      'text-yellow-400'
                    }`}>
                      {analytics.hot_cold.status?.toUpperCase() || 'STEADY'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Position Rankings */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">Rankings</h3>
            <div className="space-y-4">
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Position Rank</span>
                  <span className="text-sm font-bold text-yellow-400">
                    #{analytics?.position_rankings?.findIndex(p => p.player_id === parseInt(player.mlb_player_id || player.player_id)) + 1 || '-'}
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">League Rank</span>
                  <span className="text-sm font-bold text-green-400">
                    {analytics?.league_comparisons?.percentile_rank ? 
                      `Top ${100 - analytics.league_comparisons.percentile_rank}%` : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contract Summary */}
        <div className={dynastyTheme.components.card.highlighted}>
          <div className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">Contract</h3>
            <div className="space-y-4">
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Salary</span>
                  <span className="text-sm font-bold text-green-400">
                    ${contractInfo?.salary || 1.0}M
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Years</span>
                  <span className="text-sm font-bold text-white">
                    {contractInfo?.contract_years || 1}
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Total</span>
                  <span className="text-sm font-bold text-yellow-400">
                    ${((contractInfo?.salary || 1) * (contractInfo?.contract_years || 1)).toFixed(1)}M
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PlayerInfoCard;