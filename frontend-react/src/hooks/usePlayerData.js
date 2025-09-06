// src/hooks/usePlayerData.js - FIXED ERROR HANDLING
import { useState, useEffect } from 'react';
import api from '../services/apiService';

export const usePlayerData = (playerId, leagueId) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // All data from single comprehensive response
  const [player, setPlayer] = useState(null);
  const [historicalStats, setHistoricalStats] = useState([]);
  const [careerTotals, setCareerTotals] = useState(null);
  const [mainDBGameLogs, setMainDBGameLogs] = useState([]);
  const [league2025Stats, setLeague2025Stats] = useState(null);
  const [rollingStats, setRollingStats] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
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

        console.log('API Response:', response);
        console.log('Career stats received:', response.career_stats?.length || 0, response.career_stats);

        // FIXED: Better response validation
        if (!response || (response.success === false)) {
          throw new Error(response?.message || 'API returned unsuccessful response');
        }

        // FIXED: Handle case where response might be wrapped or unwrapped
        const data = response.data || response;
        
        if (!data.player_id && !data.first_name) {
          throw new Error('Invalid response structure - missing player data');
        }

        // Set basic player info - handle both response formats
        setPlayer({
          player_id: data.player_id || playerId,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          position: data.position || '',
          mlb_team: data.mlb_team || '',
          jersey_number: data.jersey_number || '',
          height_inches: data.height_inches || null,
          weight_pounds: data.weight_pounds || null,
          birthdate: data.birthdate || null,
          is_active: data.is_active ?? true
        });

        // FIXED: Safe data extraction with null checks
        setLeague2025Stats(data.season_2025_stats || null);
        setRollingStats(data.rolling_14_day_stats || null);
        setHistoricalStats(Array.isArray(data.career_stats) ? data.career_stats : []);
        setCareerTotals(data.career_totals || null);
        setMainDBGameLogs(Array.isArray(data.game_logs_2025) ? data.game_logs_2025 : []);
        setContractInfo(data.contract_info || null);
        
        // FIXED: Safe analytics extraction
        const analyticsData = data.analytics || {};
        setAnalytics({
          hotColdAnalysis: analyticsData.hot_cold || null,
          performanceTrends: analyticsData.performance_metrics || null,
          leagueComparisons: analyticsData.league_comparisons || null,
          positionRankings: analyticsData.position_rankings || null,
          yearOverYear: analyticsData.year_over_year || null,
          monthlyTrends: Array.isArray(analyticsData.monthly_trends) ? analyticsData.monthly_trends : [],
          zScores: analyticsData.z_scores || {}
        });
        
        console.log('Successfully loaded comprehensive player data:', {
          player: (data.first_name || '') + ' ' + (data.last_name || ''),
          season_stats: !!data.season_2025_stats,
          rolling_stats: !!data.rolling_14_day_stats,
          career_seasons: Array.isArray(data.career_stats) ? data.career_stats.length : 0,
          game_logs: Array.isArray(data.game_logs_2025) ? data.game_logs_2025.length : 0,
          has_contract: !!data.contract_info,
          analytics_loaded: !!analyticsData.hot_cold
        });

      } catch (err) {
        console.error('Error loading player data:', err);
        console.error('Full error details:', err);
        setError(err.message || 'Failed to load player data');
        
        // Try fallback to basic player info if comprehensive fails
        try {
          console.log('Attempting fallback to basic player info...');
          const basicResponse = await api.get(`/api/players/${playerId}/basic`);
          console.log('Basic response:', basicResponse);
          
          if (basicResponse && (basicResponse.player || basicResponse.first_name)) {
            const basicData = basicResponse.player || basicResponse;
            setPlayer({
              player_id: basicData.player_id || playerId,
              first_name: basicData.first_name || '',
              last_name: basicData.last_name || '',
              position: basicData.position || '',
              mlb_team: basicData.mlb_team || '',
              jersey_number: basicData.jersey_number || '',
              height_inches: basicData.height_inches || null,
              weight_pounds: basicData.weight_pounds || null,
              birthdate: basicData.birthdate || null,
              is_active: basicData.is_active ?? true
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

  return {
    // State
    loading,
    error,
    
    // Basic player data
    player,
    
    // Main DB data (comprehensive)
    historicalStats,
    careerTotals,
    mainDBGameLogs,
    league2025Stats,
    rollingStats,
    
    // League DB data (when available)
    contractInfo,
    teamAttributionData,
    
    // Analytics (calculated)
    analytics,
    
    // Helper functions
    isPitcher: () => {
      const position = player?.position?.toUpperCase();
      return ['P', 'SP', 'RP', 'CP', 'CL'].includes(position);
    },
    
    hasContract: () => !!contractInfo,
    hasAnalytics: () => !!analytics?.hotColdAnalysis
  };
};