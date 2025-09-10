// src/services/tableService.js - BARREL EXPORT ROUTER
// Re-exports all table functionality from modular files

// Core table component and basic renders
export { 
  DynastyTable, 
  renderDefault, 
  renderFloat1, 
  renderFloat2, 
  renderFloat3, 
  renderAvg 
} from './tables/DynastyTable';

// Dashboard table columns - INCLUDING NEW PITCHER COLUMNS
export { 
  createHotPlayersColumns, 
  createColdPlayersColumns,
  createHotHittersColumns,     // NEW - explicit hitter columns
  createColdHittersColumns,    // NEW - explicit hitter columns
  createHotPitchersColumns,    // NEW - pitcher columns
  createColdPitchersColumns,   // NEW - pitcher columns
  createWaiverAddsColumns, 
  createWaiverDropsColumns, 
  createInjuryReportColumns 
} from './tables/dashboardColumns';

// Player data table columns
export { 
  createFreeAgentHitterColumns, 
  createFreeAgentPitcherColumns, 
  createRosterHitterColumns, 
  createRosterPitcherColumns, 
  createCareerStatsColumns, 
  createGameLogsColumns 
} from './tables/playerColumns';

// Pricing table columns
export { 
  createPricePreviewColumns 
} from './tables/pricingColumns';

// Roster management columns
export {
  createCompactRosterBatterColumns,
  createCompactRosterPitcherColumns,
  createRosterSummaryColumns,
  rosterTableOptions,
  calculatePositionRequirements,
  validateRosterCompliance
} from './tables/rosterColumns';

// Shared utilities and helpers
export { 
  calculateCareerTotals, 
  calculateQualityStarts, 
  calculateQualityStartRate, 
  statUtils, 
  sortUtils, 
  columnUtils, 
  filterUtils 
} from './tables/tableHelpers';