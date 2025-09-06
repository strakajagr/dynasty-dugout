// src/components/player/PlayerGameLogsTab.js - FIXED WITH COLOR SERVICE
import React from 'react';
import { Calendar } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable, createGameLogsColumns } from '../../services/tableService';

const PlayerGameLogsTab = ({ gameLogs, isPitcher }) => {
  if (!gameLogs || gameLogs.length === 0) {
    return (
      <div className={dynastyTheme.components.section}>
        <h3 className={`${dynastyTheme.components.heading.h3} flex items-center gap-2`}>
          <Calendar className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
          2025 Game Logs
        </h3>
        <p className={dynastyTheme.classes.text.neutralLight}>
          No 2025 game logs available
        </p>
      </div>
    );
  }

  return (
    <div className={dynastyTheme.components.section}>
      <h3 className={`${dynastyTheme.components.heading.h3} flex items-center gap-2`}>
        <Calendar className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
        2025 Game Logs (Main Database)
      </h3>
      <div className={dynastyTheme.components.card.base}>
        <DynastyTable
          title={`2025 Season (${gameLogs.length} games)`}
          data={gameLogs}
          columns={createGameLogsColumns(isPitcher)}
          initialSort={{ key: 'game_date', direction: 'desc' }}
          maxHeight="500px"
          stickyHeader={true}
        />
      </div>
    </div>
  );
};

export default PlayerGameLogsTab;