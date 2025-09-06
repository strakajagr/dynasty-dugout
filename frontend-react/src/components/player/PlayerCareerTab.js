// src/components/player/PlayerCareerTab.js - FIXED WITH COLOR SERVICE
import React from 'react';
import { Award } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable, createCareerStatsColumns } from '../../services/tableService';

const PlayerCareerTab = ({ historicalStats, careerTotals, isPitcher }) => {
  if (!historicalStats || historicalStats.length === 0) {
    return (
      <div className={dynastyTheme.components.section}>
        <h3 className={`${dynastyTheme.components.heading.h3} flex items-center gap-2`}>
          <Award className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
          Career Statistics (Historical)
        </h3>
        <p className={dynastyTheme.classes.text.neutralLight}>
          No historical career statistics available
        </p>
      </div>
    );
  }

  // Combine historical stats with career totals
  const tableData = careerTotals 
    ? [...historicalStats, { ...careerTotals, season_year: 'TOTAL', team_abbreviation: 'Career' }]
    : historicalStats;

  return (
    <div className={dynastyTheme.components.section}>
      <h3 className={`${dynastyTheme.components.heading.h3} flex items-center gap-2`}>
        <Award className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
        Career Statistics (Main Database)
      </h3>
      <div className={dynastyTheme.components.card.base}>
        <DynastyTable
          title={`Career Stats (${historicalStats.length} seasons)`}
          data={tableData}
          columns={createCareerStatsColumns(isPitcher)}
          initialSort={{ key: 'season_year', direction: 'desc' }}
          maxHeight="500px"
          showTotals={false} // We're adding totals manually
          stickyHeader={true}
        />
      </div>
    </div>
  );
};

export default PlayerCareerTab;