// src/components/player/PlayerGameLogsTab.js - ENHANCED DEBUGGING VERSION
import React, { useState, useEffect } from 'react';
import { playersAPI } from '../../services/apiService';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable, TilePerformanceGrid } from '../../services/tableService';
import { createGameLogsColumns } from '../../services/tables/playerColumns';
import { Calendar, TrendingUp, Target, Activity, Zap, Award } from 'lucide-react';

const PlayerGameLogsTab = ({ game_logs, isPitcher, playerId, leagueId }) => {
  const [loading, setLoading] = useState(true);
  const [tileAnalytics, setTileAnalytics] = useState(null);
  const [error, setError] = useState(null);

  // Fetch tile analytics using apiService
  useEffect(() => {
    const fetchTileAnalytics = async () => {
      if (!playerId) {
        console.error('❌ No player ID provided');
        setError('No player ID provided');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        console.log(`🔍 Fetching ${isPitcher ? 'pitcher' : 'hitter'} analytics for player ${playerId}${leagueId ? ` in league ${leagueId}` : ''}`);
        
        // Pass leagueId to API if available
        const data = isPitcher 
          ? await playersAPI.getPitcherTileAnalytics(playerId, leagueId)
          : await playersAPI.getHitterTileAnalytics(playerId, leagueId);
        
        console.log('📊 Full Analytics Response:', data);
        console.log('📊 Response type:', typeof data);
        console.log('📊 Response keys:', Object.keys(data));
        
        // ENHANCED DEBUG: Check all possible data structures
        console.log('🔍 Checking all possible analytics structures:');
        console.log('  - data.performance_30d:', data.performance_30d);
        console.log('  - data.batting_trend:', data.batting_trend);
        console.log('  - data.power_metrics:', data.power_metrics);
        console.log('  - data.clutch_performance:', data.clutch_performance);
        console.log('  - data.streak_indicator:', data.streak_indicator);
        console.log('  - data.trend_vs_starters:', data.trend_vs_starters);
        console.log('  - data.quality_start_rate:', data.quality_start_rate);
        console.log('  - data.command_metrics:', data.command_metrics);
        
        // Debug each tile's data structure
        if (data.performance_30d) {
          console.log('📊 Tile 1 - performance_30d:', data.performance_30d);
          console.log('  - Has player?', !!data.performance_30d.player);
          console.log('  - Has MLB benchmark?', !!data.performance_30d.mlb_benchmark);
          console.log('  - Has league benchmark?', !!data.performance_30d.league_benchmark);
          if (data.performance_30d.player) {
            console.log('  - Player keys:', Object.keys(data.performance_30d.player));
            console.log('  - Player data:', JSON.stringify(data.performance_30d.player, null, 2));
          }
        } else {
          console.log('⚠️ No performance_30d in response');
        }
        
        if (data.batting_trend) {
          console.log('📊 Hitter Tile 1 - batting_trend:', data.batting_trend);
          console.log('  - Has last_10_days?', !!data.batting_trend.last_10_days);
        }
        
        if (data.trend_vs_starters) {
          console.log('📊 Tile 2 - trend_vs_starters:', data.trend_vs_starters);
        }
        
        if (data.power_metrics) {
          console.log('📊 Hitter Tile 2 - power_metrics:', data.power_metrics);
        }
        
        if (data.quality_start_rate) {
          console.log('📊 Tile 3 - quality_start_rate:', data.quality_start_rate);
        }
        
        if (data.clutch_performance) {
          console.log('📊 Hitter Tile 3 - clutch_performance:', data.clutch_performance);
        }
        
        if (data.command_metrics) {
          console.log('📊 Tile 4 - command_metrics:', data.command_metrics);
        }
        
        if (data.streak_indicator) {
          console.log('📊 Hitter Tile 4 - streak_indicator:', data.streak_indicator);
        }
        
        // Set whatever data we get
        setTileAnalytics(data);
        
        // If we got an error in the response, surface it
        if (data?.error) {
          setError(data.error);
        }
        
      } catch (error) {
        console.error('❌ Failed to fetch tile analytics:', error);
        setError(`Failed to load analytics: ${error.message || 'Unknown error'}`);
        setTileAnalytics(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTileAnalytics();
  }, [playerId, isPitcher, leagueId]);

  // Get columns and calculate actual width needed
  const columns = createGameLogsColumns(isPitcher);
  const totalTableWidth = columns.reduce((sum, col) => sum + (col.width || 50), 0) + 20;

  // Tile component using Dynasty theme
  const Tile = ({ children }) => (
    <div className={`${dynastyTheme.components.card.interactive} h-full`}>
      {children}
    </div>
  );

  // TILE 1: 30-Day Performance Benchmarking (for pitchers)
  const PerformanceBenchmarkTile = () => {
    // Check multiple possible data structures
    const hasPlayerData = tileAnalytics?.performance_30d?.player;
    const hasPlayerStats = tileAnalytics?.performance_30d?.player?.stats;
    const hasLeagueBenchmark = tileAnalytics?.performance_30d?.league_benchmark;
    
    // Debug what we're checking
    console.log('🔍 PerformanceBenchmarkTile checks:', {
      hasPlayerData,
      hasPlayerStats,
      hasLeagueBenchmark,
      fullData: tileAnalytics?.performance_30d
    });
    
    return (
      <Tile>
        <div className="p-4 flex flex-col" style={{ minHeight: '260px' }}>
          <h4 className={`text-sm font-bold ${dynastyTheme.classes.text.primary} mb-3 flex items-center`}>
            <TrendingUp className="w-4 h-4 mr-2" />
            30-Day Performance
          </h4>
          
          {loading ? (
            <div className={`flex-1 flex items-center justify-center`}>
              <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                Loading analytics...
              </div>
            </div>
          ) : error ? (
            <div className={`flex-1 flex flex-col justify-center`}>
              <div className={`text-xs ${dynastyTheme.classes.text.error} mb-2`}>
                {error}
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                Check console for details
              </div>
            </div>
          ) : hasPlayerData ? (
            <div className="flex-1 flex flex-col">
              {/* If we have the right structure for TilePerformanceGrid */}
              {hasPlayerStats ? (
                <div className="flex-1">
                  <TilePerformanceGrid 
                    data={tileAnalytics.performance_30d}
                    showLeague={hasLeagueBenchmark}
                  />
                </div>
              ) : (
                // Fallback display if structure is different
                <div className="flex-1 space-y-2">
                  {Object.entries(tileAnalytics.performance_30d.player || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>{key}</span>
                      <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
                        {typeof value === 'number' ? value.toFixed(2) : value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Footer with sample size and period info */}
              {tileAnalytics.performance_30d.player && (
                <div className={`text-xs ${dynastyTheme.classes.text.neutral} pt-2 mt-2 border-t border-gray-700`}>
                  <div className="flex justify-between">
                    <span>
                      {tileAnalytics.performance_30d.player.period_label || 
                       (tileAnalytics.performance_30d.player.period_days 
                         ? `Last ${tileAnalytics.performance_30d.player.period_days} days` 
                         : 'Recent performance')}
                    </span>
                    <span>{tileAnalytics.performance_30d.player.games} games</span>
                  </div>
                  {tileAnalytics.performance_30d.mlb_benchmark?.sample_size > 0 && (
                    <div className="text-xs opacity-60 mt-1">
                      MLB: {tileAnalytics.performance_30d.mlb_benchmark.sample_size} pitchers
                    </div>
                  )}
                  {hasLeagueBenchmark && tileAnalytics.performance_30d.league_benchmark?.sample_size > 0 && (
                    <div className="text-xs opacity-60">
                      League: {tileAnalytics.performance_30d.league_benchmark.sample_size} pitchers
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // No valid data structure
            <div className={`flex-1 flex flex-col justify-center`}>
              <div className={`text-sm ${dynastyTheme.classes.text.neutralLight} text-center`}>
                No performance data available
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-2 text-center`}>
                Raw data: {(JSON.stringify(tileAnalytics?.performance_30d) || 'null').substring(0, 100)}...
              </div>
            </div>
          )}
        </div>
      </Tile>
    );
  };

  // Hitter Tile 1: Last 10 Games Performance
  const Last10GamesTile = () => {
    // For hitters, we look for different data structure
    const hasValidData = tileAnalytics?.batting_trend || tileAnalytics?.last_10_days;
    
    return (
      <Tile>
        <div className="p-4 h-full flex flex-col">
          <h4 className={`text-sm font-bold ${dynastyTheme.classes.text.primary} mb-3 flex items-center`}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Last 10 Games
          </h4>
          
          {loading ? (
            <div className={`flex-1 flex items-center justify-center`}>
              <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                Loading analytics...
              </div>
            </div>
          ) : error ? (
            <div className={`flex-1 flex flex-col justify-center`}>
              <div className={`text-xs ${dynastyTheme.classes.text.error} mb-2`}>
                {error}
              </div>
            </div>
          ) : hasValidData ? (
            <div className="space-y-3 flex-1">
              {tileAnalytics.batting_trend?.last_10_days && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>AVG</div>
                      <div className={`text-2xl font-bold ${
                        tileAnalytics.batting_trend.last_10_days.avg > .300 ? dynastyTheme.classes.text.success :
                        tileAnalytics.batting_trend.last_10_days.avg < .220 ? dynastyTheme.classes.text.error :
                        dynastyTheme.classes.text.white
                      }`}>
                        {tileAnalytics.batting_trend.last_10_days.avg.toFixed(3)}
                      </div>
                    </div>
                    <div>
                      <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>OPS</div>
                      <div className={`text-2xl font-bold ${
                        tileAnalytics.batting_trend.last_10_days.ops > .900 ? dynastyTheme.classes.text.success :
                        tileAnalytics.batting_trend.last_10_days.ops < .650 ? dynastyTheme.classes.text.error :
                        dynastyTheme.classes.text.white
                      }`}>
                        {tileAnalytics.batting_trend.last_10_days.ops.toFixed(3)}
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-gray-700">
                    <div className="flex justify-between mb-2">
                      <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>Home Runs</span>
                      <span className={`text-sm font-bold ${dynastyTheme.classes.text.primary}`}>
                        {tileAnalytics.batting_trend.last_10_days.home_runs || 0}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>RBI</span>
                      <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
                        {tileAnalytics.batting_trend.last_10_days.rbi || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>Games</span>
                      <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
                        {tileAnalytics.batting_trend.last_10_days.games || 0}
                      </span>
                    </div>
                  </div>
                </>
              )}
              
              {tileAnalytics.power_metrics?.last_7_days && (
                <div className={`text-xs ${dynastyTheme.classes.text.neutral} pt-2 border-t border-gray-700`}>
                  <div className="flex justify-between">
                    <span>7-Day Power</span>
                    <span className={dynastyTheme.classes.text.primary}>
                      {tileAnalytics.power_metrics.last_7_days.surge}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`flex-1 flex flex-col justify-center`}>
              <div className={`text-sm ${dynastyTheme.classes.text.neutralLight} text-center`}>
                No batting data available
              </div>
            </div>
          )}
        </div>
      </Tile>
    );
  };

  // Tile 2: Trend Analysis
  const TrendAnalysisTile = () => (
    <Tile>
      <div className="p-4 flex flex-col" style={{ minHeight: '260px' }}>
        <h4 className={`text-sm font-bold ${dynastyTheme.classes.text.primary} mb-3 flex items-center`}>
          <Target className="w-4 h-4 mr-2" />
          {isPitcher ? 'Trend vs Starters' : 'Power Surge'}
        </h4>
        <div className={`flex-1 flex items-center justify-center`}>
          {loading ? (
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              Loading...
            </div>
          ) : tileAnalytics?.trend_vs_starters ? (
            <div className="w-full">
              <pre className={`text-xs ${dynastyTheme.classes.text.neutral} overflow-auto`}>
                {JSON.stringify(tileAnalytics.trend_vs_starters, null, 2)}
              </pre>
            </div>
          ) : tileAnalytics?.power_metrics ? (
            <div className="w-full space-y-2">
              <div className="flex justify-between">
                <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>30-Day HR</span>
                <span className={`text-lg font-bold ${dynastyTheme.classes.text.primary}`}>
                  {tileAnalytics.power_metrics.last_30_days?.home_runs || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>HR Rate</span>
                <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
                  {tileAnalytics.power_metrics.last_30_days?.hr_rate || 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>162 Pace</span>
                <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
                  {tileAnalytics.power_metrics.season?.pace_162 || 0}
                </span>
              </div>
            </div>
          ) : (
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              No data
            </div>
          )}
        </div>
      </div>
    </Tile>
  );

  // Tile 3: Quality/Clutch Metrics
  const QualityMetricsTile = () => (
    <Tile>
      <div className="p-4 flex flex-col" style={{ minHeight: '260px' }}>
        <h4 className={`text-sm font-bold ${dynastyTheme.classes.text.primary} mb-3 flex items-center`}>
          <Activity className="w-4 h-4 mr-2" />
          {isPitcher ? 'Quality Start Rate' : 'Clutch Performance'}
        </h4>
        <div className={`flex-1 flex items-center justify-center`}>
          {loading ? (
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              Loading...
            </div>
          ) : tileAnalytics?.quality_start_rate ? (
            <div className="w-full">
              <pre className={`text-xs ${dynastyTheme.classes.text.neutral} overflow-auto`}>
                {JSON.stringify(tileAnalytics.quality_start_rate, null, 2)}
              </pre>
            </div>
          ) : tileAnalytics?.clutch_performance ? (
            <div className="w-full space-y-3">
              <div className="text-center">
                <div className={`text-3xl font-bold ${dynastyTheme.classes.text.primary}`}>
                  {tileAnalytics.clutch_performance.clutch_grade}
                </div>
                <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-1`}>
                  Clutch Rating
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-gray-700">
                <div className="flex justify-between">
                  <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>RBI/Game</span>
                  <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
                    {tileAnalytics.clutch_performance.last_30_days?.rbi_per_game || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>Big RBI Games</span>
                  <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
                    {tileAnalytics.clutch_performance.last_30_days?.big_rbi_games || 0}
                  </span>
                </div>
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} text-center mt-2`}>
                {tileAnalytics.clutch_performance.description}
              </div>
            </div>
          ) : (
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              No data
            </div>
          )}
        </div>
      </div>
    </Tile>
  );

  // Tile 4: Streak/Command Info
  const StreakInfoTile = () => (
    <Tile>
      <div className="p-4 flex flex-col" style={{ minHeight: '260px' }}>
        <h4 className={`text-sm font-bold ${dynastyTheme.classes.text.primary} mb-3 flex items-center`}>
          <Zap className="w-4 h-4 mr-2" />
          {isPitcher ? 'Command Metrics' : 'Streak Indicator'}
        </h4>
        <div className={`flex-1 flex items-center justify-center`}>
          {loading ? (
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              Loading...
            </div>
          ) : tileAnalytics?.command_metrics ? (
            <div className="w-full">
              <pre className={`text-xs ${dynastyTheme.classes.text.neutral} overflow-auto`}>
                {JSON.stringify(tileAnalytics.command_metrics, null, 2)}
              </pre>
            </div>
          ) : tileAnalytics?.streak_indicator ? (
            <div className="w-full space-y-3">
              <div className="text-center">
                <div className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
                  {tileAnalytics.streak_indicator.status}
                </div>
                <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-1`}>
                  Current Status
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-gray-700">
                <div className="flex justify-between">
                  <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>Hit Streak</span>
                  <span className={`text-lg font-bold ${
                    tileAnalytics.streak_indicator.hit_streak >= 5 
                      ? dynastyTheme.classes.text.success 
                      : dynastyTheme.classes.text.white
                  }`}>
                    {tileAnalytics.streak_indicator.hit_streak || 0} games
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>On Base</span>
                  <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
                    {tileAnalytics.streak_indicator.on_base_streak || 0} games
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-xs ${dynastyTheme.classes.text.neutral}`}>Multi-Hit (30d)</span>
                  <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
                    {tileAnalytics.streak_indicator.multi_hit_30_days || 0} games
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              No data
            </div>
          )}
        </div>
      </div>
    </Tile>
  );

  return (
    <div className={dynastyTheme.components.section}>
      {/* Main container - responsive with no title */}
      <div className="flex gap-4">
        {/* Left Tiles - responsive width */}
        <div className="flex-shrink-0 flex flex-col gap-4" style={{ minWidth: '240px', maxWidth: '320px', flex: '0 0 auto' }}>
          {/* Top Left Tile 1 - 30-Day Performance for pitchers, Last 10 for hitters */}
          {isPitcher ? <PerformanceBenchmarkTile /> : <Last10GamesTile />}

          {/* Bottom Left Tile 2 - Trend Analysis */}
          <TrendAnalysisTile />
        </div>

        {/* Center - Dynasty Table (responsive) - SCROLLING FIX */}
        <div className="flex-1 min-w-0" style={{ height: '560px', display: 'flex', flexDirection: 'column' }}>
          <div className={`${dynastyTheme.components.card.base} flex-1 overflow-hidden`} style={{ height: '100%' }}>
            <DynastyTable
              title={`2025 Season (${game_logs?.length || 0} games)`}
              data={game_logs || []}
              columns={columns}
              maxHeight="480px"
              minWidth="500px"
              enableHorizontalScroll={true}
              enableVerticalScroll={true}
              stickyHeader={true}
              initialSort={{ key: 'game_date', direction: 'desc' }}
            />
          </div>
        </div>

        {/* Right Tiles - responsive width */}
        <div className="flex-shrink-0 flex flex-col gap-4" style={{ minWidth: '240px', maxWidth: '320px', flex: '0 0 auto' }}>
          {/* Top Right Tile 3 - Quality/Clutch Metrics */}
          <QualityMetricsTile />

          {/* Bottom Right Tile 4 - Streak/Command Info */}
          <StreakInfoTile />
        </div>
      </div>
    </div>
  );
};

export default PlayerGameLogsTab;