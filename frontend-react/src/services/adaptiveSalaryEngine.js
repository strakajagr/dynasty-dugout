// src/services/adaptiveSalaryEngine.js
// Adaptive pricing engine for fantasy baseball - DYNAMIC YEARS VERSION

export class AdaptiveSalaryEngine {
  constructor(leagueSettings) {
    this.CURRENT_YEAR = new Date().getFullYear(); // DYNAMIC current year
    
    // League structure
    this.numTeams = leagueSettings.num_teams || 12;
    this.rosterSize = leagueSettings.roster_size || 25;
    
    // Maximum players to price (avoid pricing 1000+ irrelevant players)
    this.maxPlayersToPrice = this.numTeams * this.rosterSize * 1.5; // 450 for 12-team league
    
    // Salary settings
    if (leagueSettings.use_dual_cap) {
      this.draftCap = leagueSettings.draft_cap || 260;
      this.seasonCap = leagueSettings.season_cap || 100;
      this.totalCap = this.draftCap + this.seasonCap;
    } else {
      this.totalCap = leagueSettings.salary_cap || 260;
      this.draftCap = this.totalCap;
      this.seasonCap = 0;
    }
    
    // Price constraints
    this.minSalary = leagueSettings.min_salary || 1;
    this.salaryIncrement = leagueSettings.salary_increment || 1;
    this.rookiePrice = leagueSettings.rookie_price || 20;
    
    // Scoring categories
    this.hittingCategories = leagueSettings.hitting_categories || ['R', 'RBI', 'HR', 'SB', 'AVG', 'OPS'];
    this.pitchingCategories = leagueSettings.pitching_categories || ['W', 'QS', 'K', 'S', 'ERA', 'WHIP'];
    
    // Strategic parameters - ADJUSTED
    this.draftCapUsageTarget = leagueSettings.draft_cap_usage || 0.75;
    this.maxPlayerPercentOfCap = 0.15;
    this.minValuePlayersPercent = 0.10; // Reduced from 0.30
    
    // Position requirements
    this.positionRequirements = leagueSettings.position_requirements || {
      'C': 2, '1B': 1, '2B': 1, '3B': 1, 'SS': 1, 'OF': 5,
      'SP': 5, 'RP': 3
    };
    
    // AUGUST THRESHOLDS (roughly 130 games of 162)
    this.minimumABs = 300;
    this.minimumGamesStarted = 12;
    this.minimumStrikeouts = 70;
    this.minimumRelief = 25;
  }

  generatePrices(playerPool) {
    console.log(`=== Adaptive Pricing Engine Started ===`);
    console.log(`Total players in pool: ${playerPool.length}`);
    
    // NEW: Filter to only fantasy-relevant players FIRST
    const relevantPlayers = this.filterToRelevantPlayers(playerPool);
    console.log(`Fantasy-relevant players: ${relevantPlayers.length}`);
    
    // Process only relevant players
    const processedPlayers = relevantPlayers.map(player => this.processPlayer(player));
    
    // Separate by type
    const { hitters, pitchers } = this.separatePlayerTypes(processedPlayers);
    
    // Calculate Z-scores for players with stats
    const hitterZScores = this.calculateZScores(hitters, this.hittingCategories, 'hitter');
    const pitcherZScores = this.calculateZScores(pitchers, this.pitchingCategories, 'pitcher');
    
    // Calculate replacement levels
    const replacementLevels = this.calculateReplacementLevels(hitterZScores, pitcherZScores);
    
    // Calculate value above replacement
    const valuedPlayers = this.calculateValueAboveReplacement(
      [...hitterZScores, ...pitcherZScores], 
      replacementLevels
    );
    
    // Apply position scarcity
    const adjustedPlayers = this.applyPositionScarcity(valuedPlayers);
    
    // Convert to dollars with better distribution
    const pricedPlayers = this.convertToDollars(adjustedPlayers);
    
    // Ensure draft viability
    const finalPricedPlayers = this.ensureDraftViability(pricedPlayers);
    
    // Add a small number of top rookies
    const rookiePlayers = this.getTopRookies(playerPool, relevantPlayers, 50);
    
    // Combine all players
    const allPricedPlayers = [...finalPricedPlayers, ...rookiePlayers];
    
    // Generate summary
    const summary = this.generateSummary(allPricedPlayers);
    
    return {
      prices: allPricedPlayers,
      summary: summary,
      success: true
    };
  }

  // NEW METHOD: Filter to only fantasy-relevant players
  filterToRelevantPlayers(playerPool) {
    const scoredPlayers = playerPool.map(player => {
      let relevanceScore = 0;
      
      const statsCurrent = player.stats_current || {};
      const statsPrior = player.stats_prior || {};
      
      const isPitcher = this.isPitcherPosition(player.position);
      
      if (isPitcher) {
        // Current year stats (weighted heavily)
        const gsCurrent = statsCurrent.games_started || statsCurrent.gs || 0;
        const ipCurrent = statsCurrent.innings_pitched || statsCurrent.ip || 0;
        const wCurrent = statsCurrent.wins || statsCurrent.w || 0;
        const svCurrent = statsCurrent.saves || statsCurrent.s || statsCurrent.sv || 0;
        const kCurrent = statsCurrent.strikeouts_pitched || statsCurrent.pitcher_strikeouts || 0;
        
        relevanceScore += gsCurrent * 10;
        relevanceScore += ipCurrent * 1;
        relevanceScore += wCurrent * 15;
        relevanceScore += svCurrent * 20;
        relevanceScore += kCurrent * 0.5;
        
        // Prior year fallback
        if (relevanceScore < 50) {
          const gsPrior = statsPrior.games_started || statsPrior.gs || 0;
          const wPrior = statsPrior.wins || statsPrior.w || 0;
          relevanceScore += gsPrior * 5 + wPrior * 7;
        }
      } else {
        // Current year stats
        const abCurrent = statsCurrent.at_bats || statsCurrent.ab || 0;
        const hrCurrent = statsCurrent.home_runs || statsCurrent.hr || 0;
        const rbiCurrent = statsCurrent.rbi || 0;
        
        relevanceScore += abCurrent * 1;
        relevanceScore += hrCurrent * 20;
        relevanceScore += rbiCurrent * 2;
        
        // Prior year fallback
        if (relevanceScore < 100) {
          const abPrior = statsPrior.at_bats || statsPrior.ab || 0;
          const hrPrior = statsPrior.home_runs || statsPrior.hr || 0;
          relevanceScore += abPrior * 0.5 + hrPrior * 10;
        }
      }
      
      return { ...player, relevanceScore };
    });
    
    // Sort and take top N
    scoredPlayers.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const playersWithRelevance = scoredPlayers.filter(p => p.relevanceScore > 0);
    return playersWithRelevance.slice(0, this.maxPlayersToPrice);
  }

  // NEW METHOD: Get top rookies
  getTopRookies(allPlayers, pricedPlayers, count) {
    const pricedIds = new Set(pricedPlayers.map(p => p.player_id || p.mlb_player_id));
    
    const unpricedPlayers = allPlayers.filter(p => {
      const id = p.player_id || p.mlb_player_id;
      return !pricedIds.has(id);
    });
    
    const rookies = unpricedPlayers.filter(p => {
      const hasPrior = p.stats_prior && Object.keys(p.stats_prior).some(key => p.stats_prior[key] > 0);
      return !hasPrior;
    });
    
    return rookies.slice(0, count).map(player => ({
      player_id: player.player_id || player.mlb_player_id,
      player_name: player.player_name,
      position: player.position,
      team: player.team || player.mlb_team,
      salary: this.rookiePrice,
      tier: 'rookie',
      impact_score: '0.00',
      is_rookie: true,
      normalization_method: 'rookie',
      at_bats: 0,
      runs: 0,
      rbi: 0,
      home_runs: 0,
      stolen_bases: 0,
      batting_avg: 0,
      ops: 0,
      innings_pitched: 0,
      games_started: 0,
      wins: 0,
      saves: 0,
      quality_starts: 0,
      strikeouts_pitched: 0,
      era: 0,
      whip: 0
    }));
  }

  processPlayer(player) {
    const isOhtani = player.player_name && 
                     (player.player_name.toLowerCase().includes('ohtani') || 
                      player.player_id === 660271);
    
    const isPitcher = !isOhtani && this.isPitcherPosition(player.position);
    
    const statsCurrent = this.cleanStats(player.stats_current || {}, isPitcher, isOhtani);
    const statsPrior = this.cleanStats(player.stats_prior || {}, isPitcher, isOhtani);
    const statsTwoYearsAgo = this.cleanStats(player.stats_two_years_ago || {}, isPitcher, isOhtani);
    
    let normalizedStats = {};
    let normalizationMethod = 'current_year';

    if (isPitcher) {
      const currentGS = statsCurrent.games_started || statsCurrent.gs || 0;
      const currentK = statsCurrent.strikeouts_pitched || 0;
      const currentG = statsCurrent.games_played || 0;
      
      const isStarter = currentGS >= 5 || (currentGS / Math.max(currentG, 1)) > 0.5;
      
      if (isStarter) {
        if (currentGS >= this.minimumGamesStarted) {
          normalizedStats = { ...statsCurrent };
          normalizationMethod = 'current_year';
        } else if (currentGS > 0) {
          const priorGS = statsPrior.games_started || statsPrior.gs || 0;
          if (priorGS > 10) {
            const weight = currentGS / this.minimumGamesStarted;
            normalizedStats = this.blendStats(statsCurrent, statsPrior, weight, true);
            normalizationMethod = 'blended';
          } else {
            normalizedStats = { ...statsCurrent };
            normalizationMethod = 'partial_current';
          }
        } else {
          if (this.hasRelevantStats(statsPrior, true)) {
            normalizedStats = this.discountPriorYear(statsPrior, 0.85);
            normalizationMethod = 'prior_year';
          } else if (this.hasRelevantStats(statsTwoYearsAgo, true)) {
            normalizedStats = this.discountPriorYear(statsTwoYearsAgo, 0.70);
            normalizationMethod = 'two_years_ago';
          }
        }
      } else {
        if (currentG >= this.minimumRelief) {
          normalizedStats = { ...statsCurrent };
          normalizationMethod = 'current_year';
        } else if (currentG > 0) {
          normalizedStats = { ...statsCurrent };
          normalizationMethod = 'partial_current';
        } else {
          if (this.hasRelevantStats(statsPrior, true)) {
            normalizedStats = this.discountPriorYear(statsPrior, 0.85);
            normalizationMethod = 'prior_year';
          }
        }
      }
    } else {
      const currentAB = statsCurrent.at_bats || statsCurrent.ab || 0;
      
      if (currentAB >= this.minimumABs) {
        normalizedStats = { ...statsCurrent };
        normalizationMethod = 'current_year';
      } else if (currentAB > 0) {
        const priorAB = statsPrior.at_bats || statsPrior.ab || 0;
        
        if (priorAB > 100) {
          const weight = currentAB / this.minimumABs;
          normalizedStats = this.blendStats(statsCurrent, statsPrior, weight, false);
          normalizationMethod = 'blended';
        } else {
          normalizedStats = { ...statsCurrent };
          normalizationMethod = 'partial_current';
        }
      } else {
        if (this.hasRelevantStats(statsPrior, false)) {
          normalizedStats = this.discountPriorYear(statsPrior, 0.85);
          normalizationMethod = 'prior_year';
        } else if (this.hasRelevantStats(statsTwoYearsAgo, false)) {
          normalizedStats = this.discountPriorYear(statsTwoYearsAgo, 0.70);
          normalizationMethod = 'two_years_ago';
        }
      }
    }
    
    if (isOhtani) {
      const ohtaniHitting = this.processOhtaniHitting(statsCurrent, statsPrior, statsTwoYearsAgo);
      const ohtaniPitching = this.processOhtaniPitching(statsCurrent, statsPrior, statsTwoYearsAgo);
      normalizedStats = { ...ohtaniHitting, ...ohtaniPitching };
      normalizationMethod = 'ohtani_special';
    }

    return {
      ...player,
      isRookie: false,
      isPitcher,
      isOhtani,
      normalizedStats,
      normalizationMethod,
      stats_current: statsCurrent,
      stats_prior: statsPrior,
      stats_two_years_ago: statsTwoYearsAgo
    };
  }

  cleanStats(stats, isPitcher, isOhtani) {
    if (isOhtani) return stats;
    
    const cleaned = {};
    
    if (isPitcher) {
      // FIXED: Include all strikeout field variations
      const pitchingKeys = ['games_played', 'games_started', 'gs', 'wins', 'w', 'losses', 'l',
                            'saves', 's', 'sv', 'blown_saves', 'bs', 'holds',
                            'quality_starts', 'qs', 
                            'strikeouts_pitched', 'pitcher_strikeouts', 'strikeouts', 'k',
                            'earned_runs', 'hits_allowed', 'walks_allowed', 
                            'era', 'whip', 'innings_pitched', 'ip'];
      
      pitchingKeys.forEach(key => {
        if (stats[key] !== undefined && stats[key] !== null) {
          cleaned[key] = stats[key];
        }
      });
      
      // Normalize strikeouts to single field
      cleaned.strikeouts_pitched = cleaned.strikeouts_pitched || 
                                   cleaned.pitcher_strikeouts || 
                                   cleaned.strikeouts || 
                                   cleaned.k || 0;
    } else {
      const hittingKeys = ['games_played', 'at_bats', 'ab', 'runs', 'r', 'hits', 'h',
                          'doubles', 'triples', 'home_runs', 'hr', 'rbi',
                          'walks', 'bb', 'strikeouts', 'so', 'stolen_bases', 'sb',
                          'batting_avg', 'avg', 'obp', 'slg', 'ops'];
      
      hittingKeys.forEach(key => {
        if (stats[key] !== undefined && stats[key] !== null) {
          cleaned[key] = stats[key];
        }
      });
    }
    
    return cleaned;
  }

  hasRelevantStats(stats, isPitcher) {
    if (!stats) return false;
    
    if (isPitcher) {
      return (stats.games_started || stats.gs || 0) > 0 ||
             (stats.games_played || 0) > 0 ||
             (stats.wins || stats.w || 0) > 0 ||
             (stats.saves || stats.s || stats.sv || 0) > 0 ||
             (stats.strikeouts_pitched || stats.pitcher_strikeouts || 0) > 0;
    } else {
      return (stats.at_bats || stats.ab || 0) > 0;
    }
  }

  processOhtaniHitting(statsCurrent, statsPrior, statsTwoYearsAgo) {
    const currentAB = statsCurrent.at_bats || statsCurrent.ab || 0;
    
    if (currentAB >= this.minimumABs) {
      return this.extractHittingStats(statsCurrent);
    } else if (currentAB > 0 && (statsPrior.at_bats || statsPrior.ab || 0) > 100) {
      const weight = currentAB / this.minimumABs;
      return this.blendStats(
        this.extractHittingStats(statsCurrent),
        this.extractHittingStats(statsPrior),
        weight,
        false
      );
    } else {
      return this.extractHittingStats(statsCurrent);
    }
  }

  processOhtaniPitching(statsCurrent, statsPrior, statsTwoYearsAgo) {
    const currentGS = statsCurrent.games_started || statsCurrent.gs || 0;
    
    if (currentGS >= this.minimumGamesStarted) {
      return this.extractPitchingStats(statsCurrent);
    } else if (currentGS > 0 && (statsPrior.games_started || statsPrior.gs || 0) > 10) {
      const weight = currentGS / this.minimumGamesStarted;
      return this.blendStats(
        this.extractPitchingStats(statsCurrent),
        this.extractPitchingStats(statsPrior),
        weight,
        true
      );
    } else {
      return this.extractPitchingStats(statsCurrent);
    }
  }

  extractHittingStats(stats) {
    return {
      at_bats: stats.at_bats || stats.ab || 0,
      runs: stats.runs || stats.r || 0,
      hits: stats.hits || stats.h || 0,
      home_runs: stats.home_runs || stats.hr || 0,
      rbi: stats.rbi || 0,
      stolen_bases: stats.stolen_bases || stats.sb || 0,
      batting_avg: stats.batting_avg || stats.avg || 0,
      ops: stats.ops || 0,
      obp: stats.obp || 0,
      slg: stats.slg || 0
    };
  }

  extractPitchingStats(stats) {
    return {
      games_started: stats.games_started || stats.gs || 0,
      wins: stats.wins || stats.w || 0,
      saves: stats.saves || stats.s || stats.sv || 0,
      quality_starts: stats.quality_starts || stats.qs || 0,
      strikeouts_pitched: stats.strikeouts_pitched || stats.pitcher_strikeouts || stats.strikeouts || 0,
      era: stats.era || 0,
      whip: stats.whip || 0,
      innings_pitched: stats.innings_pitched || stats.ip || 0
    };
  }

  blendStats(currentStats, priorStats, currentWeight, isPitcher) {
    const blended = {};
    const priorWeight = 1 - currentWeight;
    
    if (isPitcher) {
      const countingStats = ['wins', 'w', 'saves', 's', 'sv', 'quality_starts', 'qs',
                            'strikeouts_pitched', 'games_started', 'gs', 'games_played'];
      
      countingStats.forEach(stat => {
        const current = currentStats[stat] || 0;
        const prior = priorStats[stat] || 0;
        if (current > 0 || prior > 0) {
          blended[stat] = Math.round(current + (prior * priorWeight));
        }
      });
      
      ['era', 'whip'].forEach(stat => {
        const current = currentStats[stat] || 0;
        const prior = priorStats[stat] || 0;
        if (current > 0 || prior > 0) {
          blended[stat] = (current * currentWeight) + (prior * priorWeight);
        }
      });
      
      blended.innings_pitched = currentStats.innings_pitched || currentStats.ip || 0;
    } else {
      const countingStats = ['runs', 'r', 'rbi', 'home_runs', 'hr', 'stolen_bases', 'sb',
                            'hits', 'h', 'doubles', 'triples', 'walks', 'bb'];
      
      countingStats.forEach(stat => {
        const current = currentStats[stat] || 0;
        const prior = priorStats[stat] || 0;
        if (current > 0 || prior > 0) {
          blended[stat] = Math.round(current + (prior * priorWeight));
        }
      });
      
      ['batting_avg', 'avg', 'obp', 'slg', 'ops'].forEach(stat => {
        const current = currentStats[stat] || 0;
        const prior = priorStats[stat] || 0;
        if (current > 0 || prior > 0) {
          blended[stat] = (current * currentWeight) + (prior * priorWeight);
        }
      });
      
      blended.at_bats = currentStats.at_bats || currentStats.ab || 0;
      blended.ab = blended.at_bats;
    }
    
    return blended;
  }

  discountPriorYear(stats, factor) {
    const discounted = {};
    
    Object.keys(stats).forEach(key => {
      const value = stats[key];
      if (typeof value === 'number') {
        if (['batting_avg', 'avg', 'obp', 'slg', 'ops'].includes(key)) {
          discounted[key] = value * 0.95;
        } else if (['era', 'whip'].includes(key)) {
          discounted[key] = value * 1.05;
        } else {
          discounted[key] = Math.round(value * factor);
        }
      }
    });
    
    return discounted;
  }

  separatePlayerTypes(players) {
    const hitters = [];
    const pitchers = [];
    
    players.forEach(player => {
      if (player.isOhtani) {
        hitters.push({ ...player, evaluateAs: 'hitter' });
        pitchers.push({ ...player, evaluateAs: 'pitcher' });
      } else if (player.isPitcher) {
        pitchers.push(player);
      } else {
        hitters.push(player);
      }
    });
    
    console.log(`Separated: ${hitters.length} hitters, ${pitchers.length} pitchers`);
    
    return { hitters, pitchers };
  }

  calculateZScores(players, categories, playerType) {
    if (players.length === 0) return [];
    
    const categoryStats = {};
    
    categories.forEach(cat => {
      const values = [];
      
      players.forEach(player => {
        if (player.isOhtani && player.evaluateAs !== playerType) {
          return;
        }
        
        const value = this.getStatValue(player.normalizedStats, cat, playerType === 'pitcher');
        if (value !== null && !isNaN(value) && value !== 0) {
          values.push(value);
        }
      });
      
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        categoryStats[cat] = { 
          mean, 
          stdDev: stdDev || 1,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
        
        console.log(`${playerType} - ${cat}: mean=${mean.toFixed(2)}, stdDev=${stdDev.toFixed(2)}, n=${values.length}`);
      } else {
        categoryStats[cat] = { mean: 0, stdDev: 1, min: 0, max: 0, count: 0 };
      }
    });
    
    return players.map(player => {
      const zScores = {};
      let totalZScore = 0;
      let validCategories = 0;
      
      categories.forEach(cat => {
        const value = this.getStatValue(player.normalizedStats, cat, playerType === 'pitcher');
        if (value !== null && !isNaN(value)) {
          const { mean, stdDev } = categoryStats[cat];
          
          let zScore = stdDev > 0 ? (value - mean) / stdDev : 0;
          
          if (this.isNegativeCategory(cat)) {
            zScore = -zScore;
          }
          
          zScore = Math.max(-3, Math.min(3, zScore));
          
          zScores[cat] = zScore;
          totalZScore += zScore;
          validCategories++;
        }
      });
      
      return {
        ...player,
        zScores,
        totalZScore,
        avgZScore: validCategories > 0 ? totalZScore / validCategories : 0,
        validCategories
      };
    });
  }

  getStatValue(stats, category, isPitcher) {
    if (!stats) return null;
    
    const catLower = category.toLowerCase();
    
    if (isPitcher) {
      // FIXED: Include all strikeout variations
      const pitchingMap = {
        'w': ['wins', 'w'],
        'wins': ['wins', 'w'],
        'qs': ['quality_starts', 'qs'],
        'quality_starts': ['quality_starts', 'qs'],
        's': ['saves', 's', 'sv'],
        'saves': ['saves', 's', 'sv'],
        'sv': ['saves', 's', 'sv'],
        'k': ['strikeouts_pitched', 'pitcher_strikeouts', 'strikeouts', 'k'],
        'strikeouts': ['strikeouts_pitched', 'pitcher_strikeouts', 'strikeouts', 'k'],
        'strikeouts_pitched': ['strikeouts_pitched', 'pitcher_strikeouts', 'strikeouts'],
        'era': ['era'],
        'whip': ['whip']
      };
      
      const possibleKeys = pitchingMap[catLower] || [catLower];
      
      for (const key of possibleKeys) {
        if (stats[key] !== undefined && stats[key] !== null) {
          return parseFloat(stats[key]);
        }
      }
    } else {
      const hittingMap = {
        'r': ['runs', 'r'],
        'runs': ['runs', 'r'],
        'rbi': ['rbi'],
        'hr': ['home_runs', 'hr'],
        'home_runs': ['home_runs', 'hr'],
        'sb': ['stolen_bases', 'sb'],
        'stolen_bases': ['stolen_bases', 'sb'],
        'avg': ['batting_avg', 'avg'],
        'batting_avg': ['batting_avg', 'avg'],
        'ops': ['ops'],
        'obp': ['obp'],
        'slg': ['slg']
      };
      
      const possibleKeys = hittingMap[catLower] || [catLower];
      
      for (const key of possibleKeys) {
        if (stats[key] !== undefined && stats[key] !== null) {
          return parseFloat(stats[key]);
        }
      }
    }
    
    return null;
  }

  isNegativeCategory(category) {
    const negatives = ['era', 'whip'];
    return negatives.includes(category.toLowerCase());
  }

  calculateReplacementLevels(hitters, pitchers) {
    const replacementLevels = {};
    
    const positionGroups = {};
    
    [...hitters, ...pitchers].forEach(player => {
      if (player.isOhtani && player.evaluateAs) {
        if ((player.evaluateAs === 'hitter' && this.isPitcherPosition(player.position)) ||
            (player.evaluateAs === 'pitcher' && !this.isPitcherPosition(player.position))) {
          return;
        }
      }
      
      const pos = this.normalizePosition(player.position);
      if (!positionGroups[pos]) {
        positionGroups[pos] = [];
      }
      positionGroups[pos].push(player);
    });
    
    Object.keys(positionGroups).forEach(pos => {
      const players = positionGroups[pos];
      players.sort((a, b) => b.totalZScore - a.totalZScore);
      
      const requiredAtPosition = (this.positionRequirements[pos] || 1) * this.numTeams;
      const replacementIndex = Math.min(requiredAtPosition, players.length - 1);
      
      if (replacementIndex >= 0 && players[replacementIndex]) {
        replacementLevels[pos] = players[replacementIndex].totalZScore;
      } else {
        replacementLevels[pos] = 0;
      }
    });
    
    return replacementLevels;
  }

  calculateValueAboveReplacement(players, replacementLevels) {
    return players.map(player => {
      const position = this.normalizePosition(player.position);
      
      const replacementLevel = replacementLevels[position] || 0;
      const valueAboveReplacement = Math.max(0, player.totalZScore - replacementLevel);
      
      const adjustedVAR = valueAboveReplacement > 2 
        ? valueAboveReplacement * 1.1 
        : valueAboveReplacement;
      
      return {
        ...player,
        position,
        replacementLevel,
        valueAboveReplacement,
        adjustedVAR
      };
    });
  }

  applyPositionScarcity(players) {
    const uniquePlayers = players.filter(p => !p.evaluateAs || p.evaluateAs === 'hitter');
    
    const positionCounts = {};
    uniquePlayers.forEach(player => {
      const pos = player.position;
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
    
    const scarcityFactors = {};
    Object.keys(this.positionRequirements).forEach(pos => {
      const required = this.positionRequirements[pos] * this.numTeams;
      const available = positionCounts[pos] || 0;
      
      if (available > 0) {
        const ratio = required / available;
        scarcityFactors[pos] = Math.max(0.9, Math.min(1.3, ratio * 1.05));
      } else {
        scarcityFactors[pos] = 1.0;
      }
    });
    
    scarcityFactors['C'] = Math.max(scarcityFactors['C'] || 1.0, 1.15);
    scarcityFactors['CP'] = Math.max(scarcityFactors['CP'] || 1.0, 1.2);
    
    return players.map(player => ({
      ...player,
      scarcityFactor: scarcityFactors[player.position] || 1.0,
      finalVAR: player.adjustedVAR * (scarcityFactors[player.position] || 1.0)
    }));
  }

  // FIXED: Better dollar distribution
  convertToDollars(players) {
    const consolidatedPlayers = this.consolidateOhtani(players);
    
    const totalDraftMoney = this.draftCap * this.numTeams;
    const targetSpend = totalDraftMoney * this.draftCapUsageTarget;
    
    // Reserve less for minimum salaries
    const playersAtMin = Math.floor(consolidatedPlayers.length * this.minValuePlayersPercent);
    const minimumSalaryPool = playersAtMin * this.minSalary;
    const availableForDistribution = Math.max(0, targetSpend - minimumSalaryPool);
    
    console.log(`Money pool: $${targetSpend} target, $${availableForDistribution} to distribute`);
    
    // Sort by VAR
    const sortedByValue = [...consolidatedPlayers].sort((a, b) => b.finalVAR - a.finalVAR);
    
    // Use tiered distribution
    const pricedPlayers = sortedByValue.map((player, index) => {
      let dollarValue;
      
      if (index < 10) {
        // Top 10 players get 25% of pool
        const topShare = 0.25;
        const topMoney = availableForDistribution * topShare;
        const topVAR = sortedByValue.slice(0, 10).reduce((sum, p) => sum + p.finalVAR, 0);
        dollarValue = this.minSalary + (topMoney * (player.finalVAR / Math.max(topVAR, 1)));
      } else if (index < 50) {
        // Next 40 players get 35% of pool
        const midShare = 0.35;
        const midMoney = availableForDistribution * midShare;
        const midVAR = sortedByValue.slice(10, 50).reduce((sum, p) => sum + p.finalVAR, 0);
        dollarValue = this.minSalary + (midMoney * (player.finalVAR / Math.max(midVAR, 1)));
      } else if (index < 150) {
        // Next 100 players get 30% of pool
        const lowerShare = 0.30;
        const lowerMoney = availableForDistribution * lowerShare;
        const lowerVAR = sortedByValue.slice(50, 150).reduce((sum, p) => sum + p.finalVAR, 0);
        dollarValue = this.minSalary + (lowerMoney * (player.finalVAR / Math.max(lowerVAR, 1)));
      } else {
        // Everyone else gets 10% of pool
        const remainingShare = 0.10;
        const remainingMoney = availableForDistribution * remainingShare;
        const remainingPlayers = sortedByValue.length - 150;
        dollarValue = this.minSalary + (remainingMoney / Math.max(remainingPlayers, 1));
      }
      
      const maxAllowed = this.draftCap * this.maxPlayerPercentOfCap;
      dollarValue = Math.min(dollarValue, maxAllowed);
      dollarValue = this.roundToIncrement(dollarValue);
      
      return {
        ...player,
        salary: dollarValue
      };
    });
    
    return pricedPlayers;
  }

  consolidateOhtani(players) {
    const ohtaniHitter = players.find(p => p.isOhtani && p.evaluateAs === 'hitter');
    const ohtaniPitcher = players.find(p => p.isOhtani && p.evaluateAs === 'pitcher');
    
    if (ohtaniHitter && ohtaniPitcher) {
      const combinedVAR = ohtaniHitter.finalVAR + ohtaniPitcher.finalVAR;
      const combinedPlayer = {
        ...ohtaniHitter,
        finalVAR: combinedVAR,
        totalZScore: ohtaniHitter.totalZScore + ohtaniPitcher.totalZScore,
        dualPlayer: true
      };
      
      return [
        ...players.filter(p => !p.isOhtani || !p.evaluateAs),
        combinedPlayer
      ];
    }
    
    return players.filter(p => !p.evaluateAs || p.evaluateAs === 'hitter');
  }

  ensureDraftViability(players) {
    const totalCost = players.reduce((sum, p) => sum + p.salary, 0);
    const avgTeamCost = totalCost / this.numTeams;
    
    let adjustedPlayers = [...players];
    
    if (avgTeamCost > this.draftCap * 0.85) {
      const scaleFactor = (this.draftCap * this.draftCapUsageTarget) / avgTeamCost;
      
      adjustedPlayers = adjustedPlayers.map(player => {
        const scaledPrice = this.roundToIncrement(
          Math.max(this.minSalary, player.salary * scaleFactor)
        );
        
        return {
          ...player,
          salary: scaledPrice
        };
      });
    }
    
    this.ensureValuePlayers(adjustedPlayers);
    
    return adjustedPlayers.map(p => {
      const currentStats = p.stats_current || {};
      const isPitcher = p.isPitcher;
      
      return {
        player_id: p.player_id || p.mlb_player_id,
        player_name: p.player_name,
        position: p.position,
        team: p.team || p.mlb_team,
        salary: p.salary,
        tier: this.assignTier(p.salary),
        impact_score: (p.totalZScore || 0).toFixed(2),
        is_rookie: false,
        normalization_method: p.normalizationMethod,
        // FIXED: Include all stat variations for display
        at_bats: !isPitcher ? (currentStats.at_bats || currentStats.ab || 0) : 0,
        runs: !isPitcher ? (currentStats.runs || currentStats.r || 0) : 0,
        rbi: !isPitcher ? (currentStats.rbi || 0) : 0,
        home_runs: !isPitcher ? (currentStats.home_runs || currentStats.hr || 0) : 0,
        stolen_bases: !isPitcher ? (currentStats.stolen_bases || currentStats.sb || 0) : 0,
        batting_avg: !isPitcher ? (currentStats.batting_avg || currentStats.avg || 0) : 0,
        ops: !isPitcher ? (currentStats.ops || 0) : 0,
        innings_pitched: isPitcher ? (currentStats.innings_pitched || currentStats.ip || 0) : 0,
        games_started: isPitcher ? (currentStats.games_started || currentStats.gs || 0) : 0,
        wins: isPitcher ? (currentStats.wins || currentStats.w || 0) : 0,
        saves: isPitcher ? (currentStats.saves || currentStats.s || currentStats.sv || 0) : 0,
        quality_starts: isPitcher ? (currentStats.quality_starts || currentStats.qs || 0) : 0,
        strikeouts_pitched: isPitcher ? (currentStats.strikeouts_pitched || currentStats.pitcher_strikeouts || currentStats.strikeouts || currentStats.k || 0) : 0,
        era: isPitcher ? (currentStats.era || 0) : 0,
        whip: isPitcher ? (currentStats.whip || 0) : 0
      };
    });
  }

  ensureValuePlayers(players) {
    const atMinimum = players.filter(p => p.salary <= this.minSalary + this.salaryIncrement).length;
    const targetMinimum = Math.floor(players.length * this.minValuePlayersPercent);
    
    if (atMinimum < targetMinimum) {
      const candidates = players
        .filter(p => p.salary > this.minSalary + this.salaryIncrement)
        .sort((a, b) => a.finalVAR - b.finalVAR)
        .slice(0, targetMinimum - atMinimum);
      
      candidates.forEach(player => {
        player.salary = this.minSalary;
      });
    }
  }

  roundToIncrement(price) {
    return Math.max(
      this.minSalary,
      Math.round(price / this.salaryIncrement) * this.salaryIncrement
    );
  }

  assignTier(salary) {
    const percentOfCap = salary / this.draftCap;
    
    if (percentOfCap >= 0.10) return 'elite';
    if (percentOfCap >= 0.06) return 'star';
    if (percentOfCap >= 0.035) return 'solid';
    if (percentOfCap >= 0.02) return 'regular';
    if (salary === this.rookiePrice) return 'rookie';
    return 'replacement';
  }

  generateSummary(prices) {
    const sorted = [...prices].sort((a, b) => b.salary - a.salary);
    const totalCost = prices.reduce((sum, p) => sum + p.salary, 0);
    
    return {
      totalPlayers: prices.length,
      totalMoney: totalCost,
      avgSalary: (totalCost / prices.length).toFixed(2),
      avgTeamSpend: (totalCost / this.numTeams).toFixed(2),
      capUsagePercent: ((totalCost / this.numTeams) / this.draftCap * 100).toFixed(1),
      maxSalary: sorted[0]?.salary || 0,
      distribution: {
        over50: prices.filter(p => p.salary >= 50).length,
        over30: prices.filter(p => p.salary >= 30).length,
        over20: prices.filter(p => p.salary >= 20).length,
        under5: prices.filter(p => p.salary < 5).length,
        atMinimum: prices.filter(p => p.salary === this.minSalary).length
      }
    };
  }

  normalizePosition(position) {
    if (!position) return 'UTIL';
    const pos = position.toUpperCase();
    
    if (pos === 'SP' || pos === 'P') return 'SP';
    if (pos === 'RP' || pos === 'MR') return 'RP';
    if (pos === 'CP' || pos === 'CL' || pos === 'CLOSER') return 'CP';
    
    if (pos.includes('C') && !pos.includes('P')) return 'C';
    if (pos.includes('1B')) return '1B';
    if (pos.includes('2B')) return '2B';
    if (pos.includes('3B')) return '3B';
    if (pos.includes('SS')) return 'SS';
    if (pos.includes('OF') || pos === 'LF' || pos === 'CF' || pos === 'RF') return 'OF';
    if (pos === 'DH') return 'DH';
    
    return 'UTIL';
  }

  isPitcherPosition(position) {
    if (!position) return false;
    const pos = position.toUpperCase();
    const pitcherPositions = ['SP', 'RP', 'CP', 'CL', 'CLOSER', 'P', 'MR'];
    return pitcherPositions.includes(pos);
  }
}

export default AdaptiveSalaryEngine;