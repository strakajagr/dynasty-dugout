// src/hooks/usePlayerData.js - WITH DEBUG LOGGING
import { useState, useEffect } from 'react';
import api from '../services/apiService';

export const usePlayerData = (playerId, leagueId) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Use BACKEND field names directly
  const [player, setPlayer] = useState(null);
  const [season_stats, setSeasonStats] = useState(null);
  const [rolling_14_day, setRolling14Day] = useState(null);
  const [career_stats, setCareerStats] = useState([]);
  const [career_totals, setCareerTotals] = useState(null);
  const [game_logs, setGameLogs] = useState([]);
  const [contract_info, setContractInfo] = useState(null);
  const [teamAttributionData, setTeamAttributionData] = useState(null);
  const [analytics, setAnalytics] = useState({
    hotColdAnalysis: null,
    performanceTrends: null,
    splits: null,
    advanced: null
  });

  useEffect(() => {
    if (!playerId) return;

    const loadPlayerData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Loading complete player data for player ${playerId}${leagueId ? ` in league ${leagueId}` : ''}`);
        
        // Single comprehensive API call
        const response = await api.get(
          `/api/players/${playerId}/complete${leagueId ? `?league_id=${leagueId}` : ''}`
        );
        
        console.log('Full API Response:', response);
        
        // Handle case where response might be wrapped or unwrapped
        const data = response.data || response;
        
        // DEBUG LOGGING FOR GAME_LOGS
        console.log('=== usePlayerData Debug ===');
        console.log('All fields from API:', Object.keys(data));
        console.log('API Response game_logs:', data.game_logs);
        console.log('game_logs count:', data.game_logs?.length || 0);
        console.log('First game log:', data.game_logs?.[0]);
        console.log('season_stats:', data.season_stats);
        console.log('rolling_14_day:', data.rolling_14_day);
        
        if (!data.player_id && !data.first_name) {
          throw new Error('Invalid response structure - missing player data');
        }

        // STANDARDIZED FIELD NAMES ONLY - matching database exactly
        setPlayer({
          player_id: data.player_id,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          position: data.position || '',
          mlb_team: data.mlb_team || '',
          jersey_number: data.jersey_number || 0,
          height_inches: data.height_inches || null,
          weight_pounds: data.weight_pounds || null,
          birthdate: data.birthdate || null,
          age: data.age || null,
          is_active: data.is_active ?? true
        });

        // Backend returns "season_stats" - use it directly
        const seasonStats = data.season_stats || null;
        
        // CRITICAL: For pitchers, create nested structure if needed
        if (seasonStats && data.position === 'P') {
          // If pitcher stats aren't already nested, nest them
          if (!seasonStats.pitching && seasonStats.era !== undefined) {
            seasonStats.pitching = {
              innings_pitched: seasonStats.innings_pitched,
              wins: seasonStats.wins,
              losses: seasonStats.losses,
              saves: seasonStats.saves,
              era: seasonStats.era,
              whip: seasonStats.whip,
              strikeouts_pitched: seasonStats.strikeouts_pitched,
              quality_starts: seasonStats.quality_starts,
              blown_saves: seasonStats.blown_saves,
              holds: seasonStats.holds,
              games_started: seasonStats.games_started,
              complete_games: seasonStats.complete_games,
              shutouts: seasonStats.shutouts,
              walks_allowed: seasonStats.walks_allowed,
              hits_allowed: seasonStats.hits_allowed,
              earned_runs: seasonStats.earned_runs,
              home_runs_allowed: seasonStats.home_runs_allowed,
              games_played: seasonStats.games_played || seasonStats.games
            };
          }
        }
        
        setSeasonStats(seasonStats);
        
        // Backend returns "rolling_14_day" - use it directly
        const rollingData = data.rolling_14_day || null;
        
        // For pitchers, nest rolling stats too if needed
        if (rollingData && data.position === 'P') {
          if (!rollingData.pitching && rollingData.era !== undefined) {
            rollingData.pitching = {
              innings_pitched: rollingData.innings_pitched,
              wins: rollingData.wins,
              losses: rollingData.losses,
              saves: rollingData.saves,
              era: rollingData.era,
              whip: rollingData.whip,
              strikeouts_pitched: rollingData.strikeouts_pitched,
              quality_starts: rollingData.quality_starts,
              blown_saves: rollingData.blown_saves,
              holds: rollingData.holds,
              earned_runs: rollingData.earned_runs,
              hits_allowed: rollingData.hits_allowed,
              walks_allowed: rollingData.walks_allowed,
              games: rollingData.games || rollingData.games_played
            };
          }
        }
        
        setRolling14Day(rollingData);
        
        // Career stats and totals - backend returns "career_stats"
        setCareerStats(Array.isArray(data.career_stats) ? data.career_stats : []);
        setCareerTotals(data.career_totals || null);
        
        // Game logs - backend returns "game_logs"
        const gameLogs = data.game_logs || [];
        console.log('Setting game_logs state to:', gameLogs);
        setGameLogs(Array.isArray(gameLogs) ? gameLogs : []);
        
        // Contract info (only in league context)
        setContractInfo(data.contract_info || null);
        
        // Analytics - COMPREHENSIVE MAPPING
        const analyticsData = data.analytics || {};
        console.log('Analytics from API:', analyticsData);
        
        setAnalytics({
          hotColdAnalysis: analyticsData.hot_cold || analyticsData.hotColdAnalysis || null,
          performanceTrends: analyticsData.performance_trends || analyticsData.performance_metrics || null,
          leagueComparisons: analyticsData.league_comparisons || null,
          positionRankings: analyticsData.position_rankings || null,
          yearOverYear: analyticsData.year_over_year || null,
          monthlyTrends: analyticsData.monthly_splits || analyticsData.monthly_trends || [],
          zScores: analyticsData.z_scores || {},
          splits: analyticsData.splits || null,
          advanced: analyticsData.advanced || null,
          consistency: analyticsData.consistency || null,
          streaks: analyticsData.streaks || null,
          hot_cold: analyticsData.hot_cold || null,
          position_rank: analyticsData.position_rankings?.[0]?.rank || null,
          position_total: 150,
          league_rank: analyticsData.league_comparisons?.percentile_rank || null,
          overall_rank: null,
          value_rating: analyticsData.performance_metrics?.consistency_score || null,
          trend: analyticsData.hot_cold?.status || null,
          trade_value: null,
          value: {
            price: data.contract_info?.salary || 0,
            market: 0
          }
        });
        
        console.log('=== Final State Debug ===');
        console.log('Successfully loaded comprehensive player data:', {
          player: `${data.first_name} ${data.last_name}`,
          season_stats: seasonStats,
          rolling_14_day: rollingData,
          career_stats_count: data.career_stats?.length || 0,
          game_logs_count: gameLogs.length,
          has_contract: !!data.contract_info,
          has_analytics: !!data.analytics,
          analytics_keys: Object.keys(data.analytics || {})
        });
        
      } catch (err) {
        console.error('Error loading player data:', err);
        setError(err.message || 'Failed to load player data');
        
        // Try fallback to basic player info if comprehensive fails
        try {
          console.log('Attempting fallback to basic player info...');
          const basicResponse = await api.get(`/api/players/${playerId}`);
          
          if (basicResponse) {
            const basicData = basicResponse.data || basicResponse;
            
            // STANDARDIZED FIELD NAMES ONLY
            setPlayer({
              player_id: basicData.player?.player_id || basicData.player_id,
              first_name: basicData.player?.first_name || basicData.first_name || '',
              last_name: basicData.player?.last_name || basicData.last_name || '',
              position: basicData.player?.position || basicData.position || '',
              mlb_team: basicData.player?.mlb_team || basicData.mlb_team || '',
              jersey_number: basicData.player?.jersey_number || basicData.jersey_number || 0,
              height_inches: basicData.player?.height_inches || basicData.height_inches || null,
              weight_pounds: basicData.player?.weight_pounds || basicData.weight_pounds || null,
              birthdate: basicData.player?.birthdate || basicData.birthdate || null,
              age: basicData.player?.age || basicData.age || null,
              is_active: basicData.player?.is_active ?? basicData.is_active ?? true
            });
            
            console.log('Loaded basic player info as fallback');
          }
        } catch (fallbackErr) {
          console.error('Fallback also failed:', fallbackErr);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPlayerData();
  }, [playerId, leagueId]);

  // DEBUG: Log state on every render
  console.log('=== usePlayerData State ===', {
    game_logs_count: game_logs?.length || 0,
    season_stats: !!season_stats,
    rolling_14_day: !!rolling_14_day
  });

  return {
    // State - using BACKEND field names
    loading,
    error,
    player,
    season_stats,      // Backend name
    rolling_14_day,    // Backend name
    career_stats,      // Backend name
    career_totals,     // Backend name
    game_logs,         // Backend name
    contract_info,     // Backend name
    teamAttributionData,
    analytics,         // Backend name
    
    // Helper functions
    isPitcher: () => {
      const position = player?.position?.toUpperCase();
      return ['P', 'SP', 'RP', 'CP', 'CL'].includes(position);
    },
    
    hasContract: () => !!contract_info,
    hasAnalytics: () => !!(analytics?.hotColdAnalysis || analytics?.performanceTrends || analytics?.positionRankings)
  };
};