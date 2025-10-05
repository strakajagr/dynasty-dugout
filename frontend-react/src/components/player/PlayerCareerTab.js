// src/components/player/PlayerCareerTab.js - FIXED TO USE BACKEND FIELD NAMES AND CALCULATE WIDTH
import React from 'react';
import { Award } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable } from '../../services/tableService';
import { createCareerStatsColumns } from '../../services/tables/playerColumns';

const PlayerCareerTab = ({ career_stats, career_totals, isPitcher }) => {
  if (!career_stats || career_stats.length === 0) {
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

  // Combine historical stats with career totals - USING BACKEND FIELD NAMES
  const tableData = career_totals 
    ? [...career_stats, { ...career_totals, season: 'TOTAL', mlb_team: 'Career' }]
    : career_stats;

  // Get columns and calculate actual width needed
  const columns = createCareerStatsColumns(isPitcher);
  const totalTableWidth = columns.reduce((sum, col) => sum + (col.width || 50), 0) + 50; // Add buffer

  return (
    <div className={dynastyTheme.components.section}>
      <h3 className={`${dynastyTheme.components.heading.h3} flex items-center gap-2`}>
        <Award className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
        Career Statistics (Main Database)
      </h3>
      <div className={dynastyTheme.components.card.base}>
        <DynastyTable
          title={`Career Stats (${career_stats.length} seasons)`}
          data={tableData}
          columns={columns}
          initialSort={{ key: 'season', direction: 'desc' }}
          maxHeight="500px"
          minWidth={`${totalTableWidth}px`} // Use calculated width from column definitions
          showTotals={false} // We're adding totals manually
          stickyHeader={true}
        />
      </div>
    </div>
  );
};

export default PlayerCareerTab;