// src/services/pricingDataService.js
// Handles all data preparation for the pricing engine
// Used in offseason to price players for NEXT season

import { leaguesAPI } from './apiService';

class PricingDataService {
  constructor() {
    this.cachedData = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  async getPricingData(leagueId, forceRefresh = false) {
    // Check cache
    if (!forceRefresh && this.cachedData && this.cacheTimestamp) {
      const cacheAge = Date.now() - this.cacheTimestamp;
      if (cacheAge < this.CACHE_DURATION) {
        console.log('Using cached pricing data');
        return this.cachedData;
      }
    }

    try {
      console.log('Fetching fresh pricing data from main database...');
      
      const response = await leaguesAPI.getPricingData(leagueId);
      
      if (!response.success || !response.players) {
        throw new Error('Failed to fetch pricing data');
      }

      // Process and prepare the data
      const processedPlayers = this.processPlayerData(response.players);
      
      // Cache the result
      this.cachedData = {
        players: processedPlayers,
        scoring_categories: response.scoring_categories || {},
        years: response.years || [],
        timestamp: new Date().toISOString()
      };
      this.cacheTimestamp = Date.now();
      
      return this.cachedData;
      
    } catch (error) {
      console.error('Error fetching pricing data:', error);
      throw error;
    }
  }

  processPlayerData(players) {
    return players.map(player => {
      // Ensure consistent player identification
      const processedPlayer = {
        ...player,
        player_id: player.player_id || player.mlb_player_id,
        mlb_player_id: player.mlb_player_id || player.player_id,
        player_name: this.getPlayerName(player),
        position: this.normalizePosition(player.position),
        team: player.mlb_team || player.team || 'FA'
      };

      // Ensure year-based stats exist with DYNAMIC keys
      if (!processedPlayer.stats_current) processedPlayer.stats_current = {};
      if (!processedPlayer.stats_prior) processedPlayer.stats_prior = {};
      if (!processedPlayer.stats_two_years_ago) processedPlayer.stats_two_years_ago = {};

      // Add flattened current year stats for table display
      this.addDisplayStats(processedPlayer);

      // Determine if rookie (NO stats in any year)
      processedPlayer.hasAnyStats = this.hasAnyCareerStats(processedPlayer);
      
      // Add metadata
      processedPlayer.dataQuality = this.assessDataQuality(processedPlayer);

      return processedPlayer;
    });
  }

  getPlayerName(player) {
    if (player.player_name) return player.player_name;
    if (player.name) return player.name;
    
    const firstName = player.first_name || '';
    const lastName = player.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown Player';
  }

  normalizePosition(position) {
    if (!position) return 'UTIL';
    const pos = position.toUpperCase().trim();
    
    // Handle common variations
    const positionMap = {
      'CLOSER': 'CP',
      'CL': 'CP',
      'MR': 'RP',
      'P': 'SP', // Generic P becomes SP
      'OUTFIELD': 'OF',
      'DES': 'DH',
      'DESIGNATED HITTER': 'DH'
    };
    
    return positionMap[pos] || pos;
  }

  hasAnyCareerStats(player) {
    const statsCurrent = player.stats_current || {};
    const statsPrior = player.stats_prior || {};
    const statsTwoYearsAgo = player.stats_two_years_ago || {};
    
    // Check hitting stats
    const hasHittingCurrent = (statsCurrent.at_bats || statsCurrent.ab || 0) > 0;
    const hasHittingPrior = (statsPrior.at_bats || statsPrior.ab || 0) > 0;
    const hasHittingTwoYearsAgo = (statsTwoYearsAgo.at_bats || statsTwoYearsAgo.ab || 0) > 0;
    
    // Check pitching stats
    const hasPitchingCurrent = (statsCurrent.innings_pitched || statsCurrent.ip || 0) > 0;
    const hasPitchingPrior = (statsPrior.innings_pitched || statsPrior.ip || 0) > 0;
    const hasPitchingTwoYearsAgo = (statsTwoYearsAgo.innings_pitched || statsTwoYearsAgo.ip || 0) > 0;
    
    return hasHittingCurrent || hasHittingPrior || hasHittingTwoYearsAgo || 
           hasPitchingCurrent || hasPitchingPrior || hasPitchingTwoYearsAgo;
  }

  addDisplayStats(player) {
    const currentStats = player.stats_current || {};
    
    // Hitting stats for table display
    player.at_bats = this.getStatValue(currentStats, 'at_bats', 'ab');
    player.ab = player.at_bats;
    player.runs = this.getStatValue(currentStats, 'runs', 'r');
    player.r = player.runs;
    player.rbi = currentStats.rbi || 0;
    player.home_runs = this.getStatValue(currentStats, 'home_runs', 'hr');
    player.hr = player.home_runs;
    player.stolen_bases = this.getStatValue(currentStats, 'stolen_bases', 'sb');
    player.sb = player.stolen_bases;
    player.hits = this.getStatValue(currentStats, 'hits', 'h');
    player.doubles = currentStats.doubles || 0;
    player.triples = currentStats.triples || 0;
    player.walks = this.getStatValue(currentStats, 'walks', 'bb');
    player.strikeouts = this.getStatValue(currentStats, 'strikeouts', 'so', 'k');
    
    // Rate stats
    player.batting_avg = this.getStatValue(currentStats, 'batting_avg', 'avg');
    player.avg = player.batting_avg;
    player.obp = this.getStatValue(currentStats, 'obp', 'on_base_percentage');
    player.slg = this.getStatValue(currentStats, 'slg', 'slugging_percentage');
    player.ops = currentStats.ops || 0;
    
    // Pitching stats for table display
    player.innings_pitched = this.getStatValue(currentStats, 'innings_pitched', 'ip');
    player.ip = player.innings_pitched;
    player.games = this.getStatValue(currentStats, 'games', 'g');
    player.games_started = this.getStatValue(currentStats, 'games_started', 'gs');
    player.gs = player.games_started;
    player.wins = this.getStatValue(currentStats, 'wins', 'w');
    player.w = player.wins;
    player.losses = this.getStatValue(currentStats, 'losses', 'l');
    player.saves = this.getStatValue(currentStats, 'saves', 's', 'sv');
    player.s = player.saves;
    player.sv = player.saves;
    player.blown_saves = this.getStatValue(currentStats, 'blown_saves', 'bs');
    player.holds = currentStats.holds || 0;
    player.quality_starts = this.getStatValue(currentStats, 'quality_starts', 'qs');
    player.qs = player.quality_starts;
    player.earned_runs = currentStats.earned_runs || 0;
    player.hits_allowed = currentStats.hits_allowed || 0;
    player.walks_allowed = currentStats.walks_allowed || 0;
    player.strikeouts_pitched = this.getStatValue(currentStats, 'strikeouts_pitched', 'strikeouts', 'k');
    player.k = player.strikeouts_pitched;
    player.era = currentStats.era || 0;
    player.whip = currentStats.whip || 0;
  }

  getStatValue(stats, ...possibleKeys) {
    for (const key of possibleKeys) {
      if (stats[key] !== undefined && stats[key] !== null) {
        return stats[key];
      }
    }
    return 0;
  }

  assessDataQuality(player) {
    const quality = {
      hasCurrentYear: false,
      hasPriorYear: false,
      hasTwoYearsAgo: false,
      currentYearSampleSize: 'none',
      reliability: 'low'
    };
    
    const statsCurrent = player.stats_current || {};
    const statsPrior = player.stats_prior || {};
    const statsTwoYearsAgo = player.stats_two_years_ago || {};
    
    // Check current year
    const currentAB = statsCurrent.at_bats || statsCurrent.ab || 0;
    const currentIP = statsCurrent.innings_pitched || statsCurrent.ip || 0;
    
    if (currentAB > 0 || currentIP > 0) {
      quality.hasCurrentYear = true;
      
      if (currentAB >= 350 || currentIP >= 120) {
        quality.currentYearSampleSize = 'full';
        quality.reliability = 'high';
      } else if (currentAB >= 100 || currentIP >= 50) {
        quality.currentYearSampleSize = 'partial';
        quality.reliability = 'medium';
      } else {
        quality.currentYearSampleSize = 'minimal';
        quality.reliability = 'low';
      }
    }
    
    // Check prior years
    const priorAB = statsPrior.at_bats || statsPrior.ab || 0;
    const priorIP = statsPrior.innings_pitched || statsPrior.ip || 0;
    if (priorAB > 0 || priorIP > 0) {
      quality.hasPriorYear = true;
      if (!quality.hasCurrentYear && (priorAB >= 450 || priorIP >= 150)) {
        quality.reliability = 'medium';
      }
    }
    
    const twoYearAB = statsTwoYearsAgo.at_bats || statsTwoYearsAgo.ab || 0;
    const twoYearIP = statsTwoYearsAgo.innings_pitched || statsTwoYearsAgo.ip || 0;
    if (twoYearAB > 0 || twoYearIP > 0) {
      quality.hasTwoYearsAgo = true;
    }
    
    return quality;
  }

  /**
   * Get league averages for normalization purposes
   */
  calculateLeagueAverages(players, categories) {
    const averages = {};
    
    categories.forEach(cat => {
      const values = [];
      
      players.forEach(player => {
        if (!player.hasAnyStats) return; // Skip true rookies
        
        const stats = player.stats_current || {};
        let value = null;
        
        // Get the stat value based on category
        const catLower = cat.toLowerCase();
        if (catLower === 'r' || catLower === 'runs') {
          value = stats.runs || stats.r;
        } else if (catLower === 'rbi') {
          value = stats.rbi;
        } else if (catLower === 'hr' || catLower === 'home_runs') {
          value = stats.home_runs || stats.hr;
        } else if (catLower === 'sb' || catLower === 'stolen_bases') {
          value = stats.stolen_bases || stats.sb;
        } else if (catLower === 'avg' || catLower === 'batting_avg') {
          value = stats.batting_avg || stats.avg;
        } else if (catLower === 'ops') {
          value = stats.ops;
        } else if (catLower === 'w' || catLower === 'wins') {
          value = stats.wins || stats.w;
        } else if (catLower === 'qs' || catLower === 'quality_starts') {
          value = stats.quality_starts || stats.qs;
        } else if (catLower === 's' || catLower === 'saves' || catLower === 'sv') {
          value = stats.saves || stats.s || stats.sv;
        } else if (catLower === 'k' || catLower === 'strikeouts') {
          value = stats.strikeouts_pitched || stats.strikeouts || stats.k;
        } else if (catLower === 'era') {
          value = stats.era;
        } else if (catLower === 'whip') {
          value = stats.whip;
        }
        
        if (value !== null && value !== undefined && value > 0) {
          values.push(value);
        }
      });
      
      if (values.length > 0) {
        averages[cat] = {
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      } else {
        averages[cat] = { mean: 0, min: 0, max: 0, count: 0 };
      }
    });
    
    return averages;
  }

  clearCache() {
    this.cachedData = null;
    this.cacheTimestamp = null;
  }
}

export default new PricingDataService();