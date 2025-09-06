// src/components/player/PlayerPerformanceAnalytics.js
import React, { useState } from 'react';
import { 
  Flame, Snowflake, Activity, LineChart, Calculator, 
  TrendingUp, TrendingDown, Target, Zap, ThermometerSun,
  Trophy, Users, Clock, Percent, Hash
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable } from '../../services/tableService';

const PlayerPerformanceAnalytics = ({ analytics, playerName, isPitcher = false }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('last_30');

  // Temperature emoji mapping
  const getTemperatureDisplay = () => {
    if (!analytics?.hot_cold?.temperature) return { emoji: '➖', text: 'NEUTRAL', color: dynastyTheme.classes.text.neutralLight };
    
    const temp = analytics.hot_cold.temperature;
    if (temp.includes('🔥')) return { emoji: '🔥', text: 'HOT', color: dynastyTheme.classes.text.error };
    if (temp.includes('🌡️')) return { emoji: '🌡️', text: 'WARM', color: 'text-orange-400' };
    if (temp.includes('🧊')) return { emoji: '🧊', text: 'COLD', color: 'text-blue-400' };
    if (temp.includes('❄️')) return { emoji: '❄️', text: 'COOL', color: 'text-cyan-400' };
    return { emoji: '➖', text: 'NEUTRAL', color: dynastyTheme.classes.text.neutralLight };
  };

  const tempDisplay = getTemperatureDisplay();

  // Z-Score styling with percentile
  const getZScoreStyle = (zScore) => {
    const percentile = Math.round((1 - Math.exp(-Math.abs(zScore) / 2)) * 100);
    
    if (zScore >= 2) return { 
      color: dynastyTheme.classes.text.success, 
      bg: 'bg-emerald-500/20',
      label: 'Elite',
      icon: '🏆',
      percentile: percentile
    };
    if (zScore >= 1) return { 
      color: 'text-emerald-300', 
      bg: 'bg-emerald-400/15',
      label: 'Above Avg',
      icon: '📈',
      percentile: percentile
    };
    if (zScore >= 0) return { 
      color: dynastyTheme.classes.text.primary, 
      bg: 'bg-yellow-400/15',
      label: 'Average',
      icon: '➖',
      percentile: 50 + percentile/2
    };
    if (zScore >= -1) return { 
      color: dynastyTheme.classes.text.warning, 
      bg: 'bg-amber-500/15',
      label: 'Below Avg',
      icon: '📉',
      percentile: 50 - percentile/2
    };
    return { 
      color: dynastyTheme.classes.text.error, 
      bg: 'bg-red-500/20',
      label: 'Poor',
      icon: '⚠️',
      percentile: 100 - percentile
    };
  };

  // Format stat names
  const formatStatName = (stat) => {
    const statMap = {
      'batting_avg': 'Batting Average',
      'on_base_pct': 'On-Base %',
      'obp': 'On-Base %',
      'slugging_pct': 'Slugging %',
      'slg': 'Slugging %',
      'ops': 'OPS',
      'home_runs': 'Home Runs',
      'rbi': 'RBI',
      'stolen_bases': 'Stolen Bases',
      'runs': 'Runs',
      'walks': 'Walks',
      'strikeouts': 'Strikeouts',
      'era': 'ERA',
      'whip': 'WHIP',
      'strikeouts_per_9': 'K/9',
      'walks_per_9': 'BB/9',
      'quality_starts': 'Quality Starts',
      'hits': 'Hits',
      'at_bats': 'At Bats',
      'games': 'Games'
    };
    return statMap[stat] || stat.replace(/_/g, ' ').toUpperCase();
  };

  // Create position rankings columns
  const createPositionRankingsColumns = () => [
    { 
      key: 'rank', 
      title: '#', 
      width: 40,
      render: (v) => (
        <span className={`font-bold ${v === 1 ? dynastyTheme.classes.text.primary : dynastyTheme.classes.text.white}`}>
          {v}
        </span>
      )
    },
    { 
      key: 'name', 
      title: 'Player', 
      width: 150,
      render: (v, player) => (
        <div className={`text-left ${player.player_id === analytics?.player_id ? dynastyTheme.classes.text.primary : dynastyTheme.classes.text.white}`}>
          {player.rank === 1 && '👑 '}{v}
        </div>
      )
    },
    { key: 'batting_avg', title: 'AVG', width: 60, render: (v) => v?.toFixed(3) || '.000' },
    { key: 'ops', title: 'OPS', width: 70, render: (v) => v?.toFixed(3) || '.000' },
    { key: 'home_runs', title: 'HR', width: 50 },
    { key: 'rbi', title: 'RBI', width: 50 }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Temperature Status */}
      <div className={`${dynastyTheme.components.card.highlighted} p-6 rounded-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white} mb-2`}>
              Current Performance Analytics
            </h3>
            <p className={dynastyTheme.classes.text.neutralLight}>
              Real-time performance tracking and league comparisons
            </p>
          </div>
          
          {/* Temperature Badge with HR Rate */}
          <div className={`${dynastyTheme.components.card.glass} p-4 rounded-lg text-center min-w-[180px]`}>
            <div className="text-4xl mb-2">{tempDisplay.emoji}</div>
            <div className={`text-xl font-bold ${tempDisplay.color}`}>
              {tempDisplay.text}
            </div>
            {analytics?.hot_cold && (
              <>
                <div className={`text-sm mt-1 ${dynastyTheme.classes.text.neutralLight}`}>
                  AVG {analytics.hot_cold.avg_diff > 0 ? '+' : ''}{analytics.hot_cold.avg_diff?.toFixed(3) || '0.000'}
                </div>
                {analytics.hot_cold.hr_rate_diff !== undefined && (
                  <div className={`text-xs mt-1 ${analytics.hot_cold.hr_rate_diff > 0 ? dynastyTheme.classes.text.success : dynastyTheme.classes.text.error}`}>
                    HR/G {analytics.hot_cold.hr_rate_diff > 0 ? '+' : ''}{analytics.hot_cold.hr_rate_diff.toFixed(2)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {['last_7', 'last_14', 'last_30', 'season'].map(period => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              selectedPeriod === period
                ? `${dynastyTheme.classes.bg.primary} text-black`
                : `${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralLight} hover:text-white`
            }`}
          >
            {period.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Z-Score Analysis with League Averages */}
        <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
          <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
            <Calculator className="w-5 h-5 mr-2" />
            Statistical Z-Scores vs League Average
          </h4>
          
          {analytics?.z_scores && Object.keys(analytics.z_scores).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(analytics.z_scores)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8)
                .map(([stat, zScore]) => {
                  const style = getZScoreStyle(zScore);
                  const leagueAvg = analytics.league_averages?.[`${stat}_avg`];
                  const playerVal = analytics.hot_cold?.recent_stats?.[stat] || 
                                   analytics.season_stats?.[stat];
                  
                  return (
                    <div key={stat} className={`p-3 ${dynastyTheme.classes.bg.darkLighter} rounded-md hover:bg-gray-700/50 transition-colors`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{style.icon}</span>
                          <span className={`text-sm ${dynastyTheme.classes.text.neutralLighter}`}>
                            {formatStatName(stat)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`text-lg font-bold ${style.color}`}>
                            {zScore > 0 ? '+' : ''}{zScore.toFixed(2)}σ
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${style.bg} ${style.color}`}>
                            {style.percentile}th %ile
                          </span>
                        </div>
                      </div>
                      {leagueAvg !== undefined && (
                        <div className="flex justify-between text-xs">
                          <span className={dynastyTheme.classes.text.neutral}>
                            League: {typeof leagueAvg === 'number' ? 
                              (leagueAvg < 1 ? leagueAvg.toFixed(3) : leagueAvg.toFixed(1)) : '-'}
                          </span>
                          <span className={dynastyTheme.classes.text.primary}>
                            You: {playerVal !== undefined ? 
                              (typeof playerVal === 'number' ? 
                                (playerVal < 1 ? playerVal.toFixed(3) : playerVal.toFixed(1)) : playerVal) : '-'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
              <Calculator className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No z-score data available
            </div>
          )}
        </div>

        {/* Recent Performance Stats */}
        <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
          <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
            <Zap className="w-5 h-5 mr-2" />
            Recent Performance ({selectedPeriod.replace('_', ' ')})
          </h4>
          
          {analytics?.hot_cold?.recent_stats ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(analytics.hot_cold.recent_stats).slice(0, 9).map(([key, value]) => {
                  return (
                    <div key={key} className={`${dynastyTheme.components.statCard.container} p-3 rounded-md`}>
                      <div className={dynastyTheme.components.statCard.value}>
                        {typeof value === 'number' && value < 1 && value > 0 
                          ? value.toFixed(3) 
                          : value || 0}
                      </div>
                      <div className={dynastyTheme.components.statCard.label}>
                        {formatStatName(key)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              Loading recent stats...
            </div>
          )}
        </div>

        {/* Performance Trends */}
        <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
          <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
            <LineChart className="w-5 h-5 mr-2" />
            Performance Trajectory
          </h4>
          
          <div className="space-y-4">
            {['avg', 'ops', 'home_runs', 'rbi'].map(stat => {
              const current = analytics?.hot_cold?.recent_stats?.[stat] || 
                            analytics?.season_stats?.[stat];
              const league = analytics?.league_averages?.[`${stat}_avg`];
              const diff = current && league ? ((current - league) / league * 100) : 0;
              const isPositive = diff > 0;
              
              return (
                <div key={stat} className={`p-3 ${dynastyTheme.classes.bg.darkLighter} rounded-md`}>
                  <div className="flex items-center justify-between">
                    <span className={dynastyTheme.classes.text.neutralLighter}>
                      {formatStatName(stat)}
                    </span>
                    <div className="flex items-center gap-2">
                      {isPositive ? (
                        <TrendingUp className={`w-4 h-4 ${dynastyTheme.classes.text.success}`} />
                      ) : (
                        <TrendingDown className={`w-4 h-4 ${dynastyTheme.classes.text.error}`} />
                      )}
                      <span className={`font-bold ${isPositive ? dynastyTheme.classes.text.success : dynastyTheme.classes.text.error}`}>
                        {isPositive ? '+' : ''}{diff.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Consistency Score */}
        <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
          <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
            <Target className="w-5 h-5 mr-2" />
            Consistency Rating
          </h4>
          
          <div className="space-y-4">
            <div className="relative h-32">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${dynastyTheme.classes.text.primary}`}>
                    {analytics?.consistency?.score || '75'}%
                  </div>
                  <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                    {analytics?.consistency?.grade || 'B+'} Grade
                  </div>
                </div>
              </div>
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-700"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(analytics?.consistency?.score || 75) * 3.52} 352`}
                  className={dynastyTheme.classes.text.primary}
                />
              </svg>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`p-2 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                <div className={dynastyTheme.classes.text.neutralLight}>Std Dev</div>
                <div className={`font-bold ${dynastyTheme.classes.text.white}`}>
                  {analytics?.consistency?.std_dev?.toFixed(3) || '0.042'}
                </div>
              </div>
              <div className={`p-2 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                <div className={dynastyTheme.classes.text.neutralLight}>Variance</div>
                <div className={`font-bold ${dynastyTheme.classes.text.white}`}>
                  {analytics?.consistency?.variance?.toFixed(3) || '0.018'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Position Rankings */}
      {analytics?.position_rankings && analytics.position_rankings.length > 0 && (
        <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
          <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
            <Trophy className="w-5 h-5 mr-2" />
            Position Rankings - Top 20 {analytics.position || 'Players'}
          </h4>
          
          <DynastyTable
            data={analytics.position_rankings}
            columns={createPositionRankingsColumns()}
            maxHeight="400px"
            enableHorizontalScroll={false}
            className="mt-4"
          />
        </div>
      )}

      {/* Rolling Averages Visualization */}
      <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
        <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
          <Clock className="w-5 h-5 mr-2" />
          Rolling Averages (7/14/30 Day Windows)
        </h4>
        
        <div className="grid grid-cols-3 gap-4">
          {['7-day', '14-day', '30-day'].map(window => {
            const windowData = window === '14-day' ? analytics?.hot_cold?.recent_stats : null;
            return (
              <div key={window} className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg`}>
                <div className={`text-sm ${dynastyTheme.classes.text.primary} mb-2`}>{window}</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={dynastyTheme.classes.text.neutralLight}>AVG</span>
                    <span className={dynastyTheme.classes.text.white}>
                      {windowData?.batting_avg?.toFixed(3) || '.285'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={dynastyTheme.classes.text.neutralLight}>OPS</span>
                    <span className={dynastyTheme.classes.text.white}>
                      {((windowData?.obp || 0) + (windowData?.slg || 0)).toFixed(3) || '.845'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={dynastyTheme.classes.text.neutralLight}>HR/G</span>
                    <span className={dynastyTheme.classes.text.white}>
                      {windowData ? (windowData.home_runs / Math.max(windowData.games, 1)).toFixed(2) : '0.23'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Streak Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
          <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
            <Flame className="w-5 h-5 mr-2" />
            Current Streaks
          </h4>
          
          <div className="space-y-3">
            <div className={`p-3 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
              <div className="flex justify-between items-center">
                <span className={dynastyTheme.classes.text.neutralLight}>Hit Streak</span>
                <span className={`text-2xl font-bold ${dynastyTheme.classes.text.success}`}>
                  {analytics?.streaks?.hit_streak || 7}
                </span>
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-1`}>
                Career High: {analytics?.streaks?.career_high_hit || 15} games
              </div>
            </div>
            <div className={`p-3 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
              <div className="flex justify-between items-center">
                <span className={dynastyTheme.classes.text.neutralLight}>On-Base Streak</span>
                <span className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
                  {analytics?.streaks?.on_base_streak || 12}
                </span>
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-1`}>
                Season High: {analytics?.streaks?.season_high_on_base || 23} games
              </div>
            </div>
            <div className={`p-3 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
              <div className="flex justify-between items-center">
                <span className={dynastyTheme.classes.text.neutralLight}>Multi-Hit Games</span>
                <span className={`text-2xl font-bold ${dynastyTheme.classes.text.warning}`}>
                  {analytics?.streaks?.multi_hit || 3}
                </span>
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-1`}>
                Last 10 games: {analytics?.streaks?.multi_hit_last_10 || 4} multi-hit
              </div>
            </div>
          </div>
        </div>

        {/* Performance vs League */}
        <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
          <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
            <Percent className="w-5 h-5 mr-2" />
            League Percentiles
          </h4>
          
          <div className="space-y-3">
            {[
              { stat: 'Power', percentile: 85, label: 'HR + SLG' },
              { stat: 'Contact', percentile: 72, label: 'AVG + K%' },
              { stat: 'Speed', percentile: 45, label: 'SB + CS' },
              { stat: 'Discipline', percentile: 68, label: 'BB% + O-Swing' },
              { stat: 'Overall', percentile: 78, label: 'Combined' }
            ].map(item => (
              <div key={item.stat} className={`p-3 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className={dynastyTheme.classes.text.white}>{item.stat}</div>
                    <div className={`text-xs ${dynastyTheme.classes.text.neutral}`}>{item.label}</div>
                  </div>
                  <span className={`text-lg font-bold ${
                    item.percentile >= 80 ? dynastyTheme.classes.text.success :
                    item.percentile >= 60 ? dynastyTheme.classes.text.primary :
                    dynastyTheme.classes.text.warning
                  }`}>
                    {item.percentile}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${dynastyTheme.classes.bg.primary}`}
                    style={{ width: `${item.percentile}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPerformanceAnalytics;