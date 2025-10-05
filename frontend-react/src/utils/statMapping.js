// src/utils/statMapping.js - Map league scoring categories to player stat fields

/**
 * Maps scoring category labels (from league settings) to actual player stat field names
 */
export const STAT_FIELD_MAP = {
  // Batting stats
  'G': { field: 'games_played', label: 'G', decimals: 0 },
  'AB': { field: 'at_bats', label: 'AB', decimals: 0 },
  'R': { field: 'runs', label: 'R', decimals: 0 },
  'H': { field: 'hits', label: 'H', decimals: 0 },
  'HR': { field: 'home_runs', label: 'HR', decimals: 0 },
  'RBI': { field: 'rbi', label: 'RBI', decimals: 0 },
  'SB': { field: 'stolen_bases', label: 'SB', decimals: 0 },
  'AVG': { field: 'batting_avg', label: 'AVG', decimals: 3, prefix: '.' },
  'OPS': { field: 'ops', label: 'OPS', decimals: 3, prefix: '.' },
  'OBP': { field: 'obp', label: 'OBP', decimals: 3, prefix: '.' },
  'SLG': { field: 'slg', label: 'SLG', decimals: 3, prefix: '.' },
  '2B': { field: 'doubles', label: '2B', decimals: 0 },
  '3B': { field: 'triples', label: '3B', decimals: 0 },
  'BB': { field: 'walks', label: 'BB', decimals: 0 },
  'K': { field: 'strikeouts', label: 'K', decimals: 0 },
  'CS': { field: 'caught_stealing', label: 'CS', decimals: 0 },
  
  // Pitching stats
  'W': { field: 'wins', label: 'W', decimals: 0 },
  'SV': { field: 'saves', label: 'SV', decimals: 0 },
  'ERA': { field: 'era', label: 'ERA', decimals: 2 },
  'WHIP': { field: 'whip', label: 'WHIP', decimals: 2 },
  'SO': { field: 'strikeouts_pitched', label: 'K', decimals: 0 },
  'QS': { field: 'quality_starts', label: 'QS', decimals: 0 },
  'GS': { field: 'games_started', label: 'GS', decimals: 0 },
  'IP': { field: 'innings_pitched', label: 'IP', decimals: 1 },
  'L': { field: 'losses', label: 'L', decimals: 0 },
  'HLD': { field: 'holds', label: 'HLD', decimals: 0 },
  'BS': { field: 'blown_saves', label: 'BS', decimals: 0 }
};

/**
 * Default stats to show when no league context (global watch list)
 */
export const DEFAULT_BATTING_STATS = ['G', 'AB', 'H', 'R', 'SB', 'HR', 'RBI', 'AVG', 'OPS'];
export const DEFAULT_PITCHING_STATS = ['GS', 'G', 'W', 'SO', 'SV', 'ERA', 'WHIP', 'QS'];

/**
 * BB for pitchers maps to walks_allowed, not walks
 */
const PITCHING_OVERRIDES = {
  'BB': { field: 'walks_allowed', label: 'BB', decimals: 0 }
};

/**
 * Get the stat configurations for a given set of stat labels
 * @param {Array<string>} statLabels - Array of stat labels from league settings
 * @param {boolean} isPitcher - Whether these are pitching stats
 * @returns {Array<Object>} Array of stat config objects
 */
export const getStatConfigs = (statLabels, isPitcher = false) => {
  if (!statLabels || !Array.isArray(statLabels)) return [];
  
  return statLabels
    .map(label => {
      // Use pitching override if applicable
      if (isPitcher && PITCHING_OVERRIDES[label]) {
        return PITCHING_OVERRIDES[label];
      }
      return STAT_FIELD_MAP[label];
    })
    .filter(config => config !== undefined);
};

/**
 * Format a stat value for display
 * @param {number|null} value - The stat value
 * @param {Object} config - The stat configuration
 * @returns {string} Formatted stat value
 */
export const formatStatValue = (value, config) => {
  if (value == null || typeof value !== 'number') {
    // Return default based on decimals
    if (config.decimals === 0) return '0';
    if (config.decimals === 3) return config.prefix ? '.000' : '0.000';
    if (config.decimals === 1) return '0.0';
    return '0.00';
  }
  
  // Format with appropriate decimals
  if (config.decimals === 3 && config.prefix) {
    // Batting average style: .249 instead of 0.249
    return `.${String(value.toFixed(3)).slice(2)}`;
  }
  
  return value.toFixed(config.decimals);
};

/**
 * Get stat value from player object
 * SUPPORTS BOTH CANONICAL AND LEGACY STRUCTURES
 * @param {Object} player - Player object with stats
 * @param {Object} config - Stat configuration
 * @returns {number|null} The stat value
 */
export const getStatValue = (player, configOrAbbrev) => {
  // Handle both config object and string abbreviation
  const config = typeof configOrAbbrev === 'string' 
    ? STAT_FIELD_MAP[configOrAbbrev] 
    : configOrAbbrev;
  
  if (!config) return null;
  
  // Try CANONICAL structure first: player.stats.season.[field]
  if (player?.stats?.season?.[config.field] !== undefined) {
    return player.stats.season[config.field];
  }
  
  // Fall back to legacy structure: player.season_stats.[field]
  return player?.season_stats?.[config.field] ?? null;
};

/**
 * Get the display label for a stat abbreviation
 * @param {string} statAbbrev - Stat abbreviation (e.g., 'R', 'HR', 'ERA')
 * @returns {string} The display label
 */
export const getStatLabel = (statAbbrev) => {
  const config = STAT_FIELD_MAP[statAbbrev];
  return config?.label || statAbbrev;
};
