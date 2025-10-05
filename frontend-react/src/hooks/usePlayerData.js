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
        
        // DEBUG LOGGING
        console.log('=== usePlayerData Debug ===');
        console.log('All fields from API:', Object.keys(data));
        console.log('Has player object:', !!data.player);
        
        // CANONICAL STRUCTURE: API returns data.player with nested structure
        const playerData = data.player;
        if (!playerData) {
          throw new Error('Invalid response structure - missing player data');
        }
        
        console.log('Player info:', playerData.info);
        console.log('Player stats:', playerData.stats);

        // CANONICAL STRUCTURE: player.info.* for biographical data
        setPlayer({
          player_id: playerData.ids?.mlb,
          first_name: playerData.info?.first_name || '',
          last_name: playerData.info?.last_name || '',
          position: playerData.info?.position || '',
          mlb_team: playerData.info?.mlb_team || '',
          jersey_number: playerData.info?.jersey_number || 0,
          height_inches: playerData.info?.height_inches || null,
          weight_pounds: playerData.info?.weight_pounds || null,
          birthdate: playerData.info?.birthdate || null,
          age: playerData.info?.age || null,
          is_active: playerData.info?.active ?? true
        });

        // CANONICAL STRUCTURE: player.stats.season
        const seasonStats = playerData.stats?.season || null;
        
        // CRITICAL: For pitchers, create nested structure if needed
        if (seasonStats && playerData.info?.position === 'P') {
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
        
        // CANONICAL STRUCTURE: player.stats.rolling_14_day
        const rollingData = playerData.stats?.rolling_14_day || null;
        
        // For pitchers, nest rolling stats too if needed
        if (rollingData && playerData.info?.position === 'P') {
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
        
        // CANONICAL STRUCTURE: Check if game_logs is in playerData.stats first
        const gameLogsFromComplete = playerData.stats?.game_logs || playerData.game_logs || data.game_logs;
        
        if (gameLogsFromComplete && Array.isArray(gameLogsFromComplete)) {
          console.log(`✅ Found ${gameLogsFromComplete.length} game logs in /complete endpoint`);
          setGameLogs(gameLogsFromComplete);
        } else {
          // Fallback: Try separate game logs endpoint (may fail if backend endpoint broken)
          try {
            console.log('⚠️ Game logs not in /complete, fetching separately from /game-logs endpoint...');
            const gameLogsResponse = await api.get(`/api/players/${playerId}/game-logs`);
            const gameLogsData = gameLogsResponse.data || gameLogsResponse;
            
            if (gameLogsData && Array.isArray(gameLogsData.game_logs)) {
              console.log(`✅ Loaded ${gameLogsData.game_logs.length} game logs from separate endpoint`);
              setGameLogs(gameLogsData.game_logs);
            } else if (Array.isArray(gameLogsData)) {
              console.log(`✅ Loaded ${gameLogsData.length} game logs from separate endpoint`);
              setGameLogs(gameLogsData);
            } else {
              console.log('❌ No game logs found in separate endpoint response');
              setGameLogs([]);
            }
          } catch (gameLogsErr) {
            console.error('❌ Error fetching game logs from separate endpoint:', gameLogsErr);
            console.log('Setting empty game logs array');
            setGameLogs([]);
          }
        }
        
        // Career stats - check if in /complete endpoint first
        const careerStatsFromComplete = playerData.stats?.career_stats || playerData.career_stats || data.career_stats;
        const careerTotalsFromComplete = playerData.stats?.career_totals || playerData.career_totals || data.career_totals;
        
        if (careerStatsFromComplete && Array.isArray(careerStatsFromComplete)) {
          console.log(`✅ Found ${careerStatsFromComplete.length} career stat seasons in /complete endpoint`);
          setCareerStats(careerStatsFromComplete);
        } else {
          console.log('⚠️ Career stats not in /complete endpoint');
          setCareerStats([]);
        }
        
        if (careerTotalsFromComplete) {
          console.log('✅ Found career totals in /complete endpoint');
          setCareerTotals(careerTotalsFromComplete);
        } else {
          console.log('⚠️ Career totals not in /complete endpoint');
          setCareerTotals(null);
        }
        
        // Contract info (only in league context) - check if in /complete endpoint
        const contractInfoFromComplete = data.contract_info || playerData.contract_info;
        if (contractInfoFromComplete) {
          console.log('✅ Found contract info in /complete endpoint');
          setContractInfo(contractInfoFromComplete);
        } else {
          console.log('⚠️ No contract info in /complete endpoint (expected if not in league context)');
          setContractInfo(null);
        }
        
        // Analytics - check if in /complete endpoint
        const analyticsFromComplete = data.analytics || playerData.analytics || {};
        console.log('==============================================');
        console.log('🔍 ANALYTICS FROM BACKEND API:');
        console.log('==============================================');
        console.log('Full analytics object:', JSON.stringify(analyticsFromComplete, null, 2));
        console.log('Has hot_cold?', !!analyticsFromComplete.hot_cold);
        console.log('Has position_rankings?', !!analyticsFromComplete.position_rankings);
        console.log('Has year_over_year?', !!analyticsFromComplete.year_over_year);
        console.log('Has monthly_splits?', !!analyticsFromComplete.monthly_splits);
        console.log('Has z_scores?', !!analyticsFromComplete.z_scores);
        console.log('Has performance_trends?', !!analyticsFromComplete.performance_trends);
        console.log('Has consistency?', !!analyticsFromComplete.consistency);
        console.log('Has streaks?', !!analyticsFromComplete.streaks);
        console.log('==============================================');
        
        // FIXED: Use snake_case field names to match backend and component expectations
        setAnalytics({
          // Backend snake_case field names (canonical pattern)
          hot_cold: analyticsFromComplete.hot_cold || null,
          performance_trends: analyticsFromComplete.performance_trends || analyticsFromComplete.performance_metrics || null,
          league_comparisons: analyticsFromComplete.league_comparisons || null,
          position_rankings: analyticsFromComplete.position_rankings || null,
          year_over_year: analyticsFromComplete.year_over_year || null,
          monthly_splits: analyticsFromComplete.monthly_splits || analyticsFromComplete.monthly_trends || [],
          z_scores: analyticsFromComplete.z_scores || {},
          splits: analyticsFromComplete.splits || null,
          advanced: analyticsFromComplete.advanced || null,
          consistency: analyticsFromComplete.consistency || null,
          streaks: analyticsFromComplete.streaks || null,
          
          // Helper fields for quick access
          season_stats: seasonStats,  // Reference for components
          
          // Computed/helper fields
          position_rank: analyticsFromComplete.position_rankings?.[0]?.rank || null,
          position_total: 150,
          league_rank: analyticsFromComplete.league_comparisons?.percentile_rank || null,
          overall_rank: null,
          value_rating: analyticsFromComplete.performance_metrics?.consistency_score || null,
          trend: analyticsFromComplete.hot_cold?.status || null,
          trade_value: null,
          
          // League averages for comparisons
          league_averages: analyticsFromComplete.league_averages || null,
          
          // Value object (for pricing)
          value: {
            price: data.contract_info?.salary || 0,
            market: 0
          }
        });
        
        console.log('=== Final State Debug ===');
        console.log('Successfully loaded player data:', {
          player: `${playerData.info?.first_name} ${playerData.info?.last_name}`,
          season_stats: !!seasonStats,
          rolling_14_day: !!rollingData,
          has_position: !!playerData.info?.position,
          has_bio_data: !!(playerData.info?.height_inches || playerData.info?.weight_pounds)
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
    hasAnalytics: () => !!(analytics?.hot_cold || analytics?.performance_trends || analytics?.position_rankings)
  };
};