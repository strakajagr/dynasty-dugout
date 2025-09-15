// src/utils/seasonUtils.js - Frontend season utilities to match backend
export const getCurrentSeason = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = January)
  
  // Baseball season logic:
  // - Season runs March (month 2) through October (month 9)
  // - November-February: prepare for next season
  // This should match core/season_utils.py logic
  
  if (month >= 2 && month <= 9) {
    // March through October - current year's season
    return year;
  } else if (month >= 10) {
    // November-December - next year's season prep
    return year + 1;
  } else {
    // January-February - current year's season prep
    return year;
  }
};

export const getSeasonDateRange = (season) => {
  return {
    start: new Date(season, 2, 1), // March 1st
    end: new Date(season, 9, 31)   // October 31st
  };
};

export const isCurrentSeason = (season) => {
  return season === getCurrentSeason();
};

export const formatSeason = (season) => {
  return `${season} Season`;
};