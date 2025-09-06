// src/services/tables/tableHelpers.js - SHARED TABLE HELPER FUNCTIONS

// =============================================================================
// HELPER CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate quality starts from pitcher game logs
 * A quality start is defined as 6+ innings pitched with 3 or fewer earned runs
 */
export const calculateQualityStarts = (gameLogData) => {
  if (!gameLogData || !Array.isArray(gameLogData)) return 0;
  
  return gameLogData.filter(game => {
    const innings = parseFloat(game.innings_pitched) || 0;
    const earnedRuns = parseInt(game.earned_runs) || 0;
    return innings >= 6.0 && earnedRuns <= 3;
  }).length;
};

/**
 * Calculate quality start rate as a percentage
 */
export const calculateQualityStartRate = (qualityStarts, gamesStarted) => {
  if (!gamesStarted || gamesStarted === 0) return 0;
  return (qualityStarts / gamesStarted).toFixed(3);
};

/**
 * Calculate career totals from season data
 * Handles both pitchers and hitters with appropriate stat calculations
 */
export const calculateCareerTotals = (careerData, isPitcher = false, gameLogData = null) => {
  if (!careerData.length) return null;

  if (isPitcher) {
    const totals = careerData.reduce((acc, season) => ({
      season_year: 'TOTAL',
      team_abbreviation: '',
      games_played: (acc.games_played || 0) + (parseInt(season.games_played) || 0),
      games_started: (acc.games_started || 0) + (parseInt(season.games_started) || 0),
      innings_pitched: (acc.innings_pitched || 0) + (parseFloat(season.innings_pitched) || 0),
      wins: (acc.wins || 0) + (parseInt(season.wins) || 0),
      losses: (acc.losses || 0) + (parseInt(season.losses) || 0),
      saves: (acc.saves || 0) + (parseInt(season.saves) || 0),
      strikeouts_pitched: (acc.strikeouts_pitched || 0) + (parseInt(season.strikeouts_pitched) || 0),
      earned_runs: (acc.earned_runs || 0) + (parseFloat(season.earned_runs) || 0),
      hits_allowed: (acc.hits_allowed || 0) + (parseInt(season.hits_allowed) || 0),
      walks_allowed: (acc.walks_allowed || 0) + (parseInt(season.walks_allowed) || 0),
      quality_starts: (acc.quality_starts || 0) + (parseInt(season.quality_starts) || 0)
    }), {});

    // Calculate derived stats
    totals.era = totals.innings_pitched > 0 ? 
      ((totals.earned_runs * 9) / totals.innings_pitched).toFixed(2) : '0.00';
    totals.whip = totals.innings_pitched > 0 ? 
      ((totals.hits_allowed + totals.walks_allowed) / totals.innings_pitched).toFixed(3) : '0.000';
    
    // Use game log data for quality starts if available
    if (gameLogData) {
      totals.quality_starts = calculateQualityStarts(gameLogData);
      totals.quality_start_rate = calculateQualityStartRate(totals.quality_starts, totals.games_started);
    }
    
    return totals;
  }

  // Hitter totals
  const totals = careerData.reduce((acc, season) => ({
    season_year: 'TOTAL',
    team_abbreviation: '',
    games_played: (acc.games_played || 0) + (parseInt(season.games_played) || 0),
    at_bats: (acc.at_bats || 0) + (parseInt(season.at_bats) || 0),
    runs: (acc.runs || 0) + (parseInt(season.runs) || 0),
    hits: (acc.hits || 0) + (parseInt(season.hits) || 0),
    doubles: (acc.doubles || 0) + (parseInt(season.doubles) || 0),
    triples: (acc.triples || 0) + (parseInt(season.triples) || 0),
    home_runs: (acc.home_runs || 0) + (parseInt(season.home_runs) || 0),
    rbi: (acc.rbi || 0) + (parseInt(season.rbi) || 0),
    stolen_bases: (acc.stolen_bases || 0) + (parseInt(season.stolen_bases) || 0),
    walks: (acc.walks || 0) + (parseInt(season.walks) || 0),
    strikeouts: (acc.strikeouts || 0) + (parseInt(season.strikeouts) || 0)
  }), {});

  // Calculate derived hitting stats
  totals.avg = totals.at_bats > 0 ? (totals.hits / totals.at_bats).toFixed(3) : '.000';
  totals.obp = (totals.at_bats + totals.walks) > 0 ? 
    ((totals.hits + totals.walks) / (totals.at_bats + totals.walks)).toFixed(3) : '.000';
  
  const totalBases = totals.hits + totals.doubles + (totals.triples * 2) + (totals.home_runs * 3);
  totals.slg = totals.at_bats > 0 ? (totalBases / totals.at_bats).toFixed(3) : '.000';
  totals.ops = (parseFloat(totals.obp) + parseFloat(totals.slg)).toFixed(3);
  
  return totals;
};

/**
 * Utility functions for stat formatting and validation
 */
export const statUtils = {
  /**
   * Safely parse a stat value, returning 0 for invalid values
   */
  parseStatSafe: (value, type = 'int') => {
    if (value == null || value === '') return 0;
    
    if (type === 'float') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    const parsed = parseInt(value);
    return isNaN(parsed) ? 0 : parsed;
  },

  /**
   * Format batting average with proper .000 format
   */
  formatAvg: (value) => {
    const val = parseFloat(value) || 0;
    if (val === 0) return '.000';
    if (val >= 1) return val.toFixed(3);
    return `.${Math.round(val * 1000).toString().padStart(3, '0')}`;
  },

  /**
   * Format ERA with 2 decimal places
   */
  formatERA: (value) => {
    return (parseFloat(value) || 0).toFixed(2);
  },

  /**
   * Format WHIP with 3 decimal places
   */
  formatWHIP: (value) => {
    return (parseFloat(value) || 0).toFixed(3);
  },

  /**
   * Calculate K/9 ratio for pitchers
   */
  calculateK9: (strikeouts, inningsPitched) => {
    const k = parseInt(strikeouts) || 0;
    const ip = parseFloat(inningsPitched) || 0;
    return ip > 0 ? ((k * 9) / ip).toFixed(1) : '0.0';
  },

  /**
   * Calculate BB/9 ratio for pitchers
   */
  calculateBB9: (walks, inningsPitched) => {
    const bb = parseInt(walks) || 0;
    const ip = parseFloat(inningsPitched) || 0;
    return ip > 0 ? ((bb * 9) / ip).toFixed(1) : '0.0';
  },

  /**
   * Calculate OPS from OBP and SLG
   */
  calculateOPS: (onBasePercentage, sluggingPercentage) => {
    const obp = parseFloat(onBasePercentage) || 0;
    const slg = parseFloat(sluggingPercentage) || 0;
    return (obp + slg).toFixed(3);
  },

  /**
   * Determine if a pitcher performance is a quality start
   */
  isQualityStart: (inningsPitched, earnedRuns) => {
    const ip = parseFloat(inningsPitched) || 0;
    const er = parseInt(earnedRuns) || 0;
    return ip >= 6.0 && er <= 3;
  }
};

/**
 * Table sorting utilities
 */
export const sortUtils = {
  /**
   * Smart sort that handles numbers, strings, and special cases
   */
  smartSort: (a, b, key, direction = 'asc') => {
    let aValue = a[key];
    let bValue = b[key];

    // Handle special player name sorting
    if (key === 'player_name') {
      aValue = `${a.last_name || ''} ${a.first_name || ''}`.trim() || a.name || a.player_name;
      bValue = `${b.last_name || ''} ${b.first_name || ''}`.trim() || b.name || b.player_name;
    }

    // Handle null/undefined values
    if (aValue === bValue) return 0;
    if (aValue == null) return direction === 'asc' ? 1 : -1;
    if (bValue == null) return direction === 'asc' ? -1 : 1;

    // Handle numeric values
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Try to parse as numbers
    const aNum = parseFloat(aValue);
    const bNum = parseFloat(bValue);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return direction === 'asc' ? aNum - bNum : bNum - aNum;
    }

    // String comparison
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    const result = aStr.localeCompare(bStr);
    return direction === 'asc' ? result : -result;
  },

  /**
   * Get the next sort direction for a column
   */
  getNextSortDirection: (currentConfig, columnKey) => {
    if (currentConfig?.key === columnKey) {
      if (currentConfig.direction === 'asc') {
        return { key: columnKey, direction: 'desc' };
      } else if (currentConfig.direction === 'desc') {
        return null; // Clear sort
      }
    }
    return { key: columnKey, direction: 'asc' };
  }
};

/**
 * Column width utilities
 */
export const columnUtils = {
  /**
   * Get default column widths based on column types
   */
  getDefaultWidth: (key, title) => {
    // Stat columns
    if (['G', 'AB', 'R', 'H', 'HR', 'RBI', 'SB', 'BB', 'K', 'W', 'L', 'SV'].includes(title)) {
      return 45;
    }
    
    // Percentage/ratio columns
    if (['AVG', 'OBP', 'SLG', 'OPS', 'ERA', 'WHIP'].includes(title)) {
      return 60;
    }
    
    // Name columns
    if (key.includes('name') || key.includes('player')) {
      return 160;
    }
    
    // Team/position columns
    if (['Team', 'Pos', 'Status'].includes(title)) {
      return 60;
    }
    
    // Action columns
    if (key.includes('action') || key.includes('button')) {
      return 100;
    }
    
    // Default
    return 80;
  },

  /**
   * Constrain column width to reasonable bounds
   */
  constrainWidth: (width, min = 50, max = 300) => {
    return Math.max(min, Math.min(max, width));
  }
};

/**
 * Data filtering utilities for tables
 */
export const filterUtils = {
  /**
   * Filter players by position
   */
  filterByPosition: (players, positions) => {
    if (!positions || positions.length === 0) return players;
    return players.filter(player => 
      positions.some(pos => 
        player.position?.includes(pos) || player.primary_position === pos
      )
    );
  },

  /**
   * Filter players by team
   */
  filterByTeam: (players, teams) => {
    if (!teams || teams.length === 0) return players;
    return players.filter(player => 
      teams.includes(player.team) || teams.includes(player.mlb_team)
    );
  },

  /**
   * Filter players by minimum stat thresholds
   */
  filterByStatThreshold: (players, statKey, minValue) => {
    if (!minValue || minValue <= 0) return players;
    return players.filter(player => {
      const statValue = parseFloat(player[statKey]) || 0;
      return statValue >= minValue;
    });
  },

  /**
   * Search players by name
   */
  searchByName: (players, searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') return players;
    
    const term = searchTerm.toLowerCase().trim();
    return players.filter(player => {
      const fullName = `${player.first_name || ''} ${player.last_name || ''}`.toLowerCase();
      const playerName = (player.player_name || '').toLowerCase();
      const name = (player.name || '').toLowerCase();
      
      return fullName.includes(term) || 
             playerName.includes(term) || 
             name.includes(term);
    });
  }
};

/**
 * Header tooltip mappings for table columns
 */
export const headerTooltips = {
  // Hitter stats
  'G': 'Games Played',
  'AB': 'At Bats',
  'R': 'Runs Scored',
  'H': 'Hits',
  '2B': 'Doubles',
  '3B': 'Triples',
  'HR': 'Home Runs',
  'HR/AB': 'Home Run per At Bat Ratio',
  'RBI': 'Runs Batted In',
  'SB': 'Stolen Bases',
  'CS': 'Caught Stealing',
  'BB': 'Walks (Base on Balls)',
  'SO': 'Strikeouts',
  'AVG': 'Batting Average',
  'OBP': 'On-Base Percentage',
  'SLG': 'Slugging Percentage',
  'OPS': 'On-Base Plus Slugging',
  
  // Pitcher stats
  'GS': 'Games Started',
  'W': 'Wins',
  'L': 'Losses',
  'SV': 'Saves',
  'BS': 'Blown Saves',
  'HLD': 'Holds',
  'QS': 'Quality Starts',
  'IP': 'Innings Pitched',
  'ER': 'Earned Runs',
  'ERA': 'Earned Run Average',
  'WHIP': 'Walks + Hits per Inning Pitched',
  'K/9': 'Strikeouts per 9 Innings',
  'BB/9': 'Walks per 9 Innings',
  
  // General columns
  'Name': 'Player Name',
  'Team': 'MLB Team',
  'Pos': 'Position',
  'MLB Team': 'Major League Baseball Team',
  'Fantasy Team': 'Fantasy Team Owner',
  'Contract': 'Contract Length in Years',
  'Salary': 'Current Salary Amount',
  'Price': 'Free Agent Acquisition Price',
  'Action': 'Available Actions'
};