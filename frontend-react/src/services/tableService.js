// src/services/tableService.js - Reusable Sortable & Resizable Table Component

import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { dynastyTheme } from './colorService';

/**
 * Reusable Sortable & Resizable Table Component
 * Features:
 * - Sortable columns (click header to sort)
 * - Resizable columns (drag column borders)
 * - Professional styling matching your screenshot
 * - Sticky headers
 */
export const DynastyTable = ({ 
  data = [], 
  columns = [], 
  initialSort = null,
  className = '',
  maxHeight = '400px',
  stickyHeader = true,
  title = '',
  showTotals = false,
  totalsRow = null
}) => {
  const [sortConfig, setSortConfig] = useState(initialSort);
  const [columnWidths, setColumnWidths] = useState({});
  const [isResizing, setIsResizing] = useState(false);
  const tableRef = useRef(null);

  // Initialize column widths
  useEffect(() => {
    const defaultWidths = {};
    columns.forEach(col => {
      defaultWidths[col.key] = col.width || 80;
    });
    setColumnWidths(defaultWidths);
  }, [columns]);

  // Sort data based on current sort configuration
  const sortedData = React.useMemo(() => {
    if (!sortConfig || !data.length) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Handle different data types
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Convert to numbers if they look like numbers
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  // Handle column sorting
  const handleSort = (columnKey) => {
    setSortConfig(prevConfig => {
      if (prevConfig?.key === columnKey) {
        // Toggle direction or clear sort
        if (prevConfig.direction === 'asc') {
          return { key: columnKey, direction: 'desc' };
        } else if (prevConfig.direction === 'desc') {
          return null; // Clear sort
        }
      }
      return { key: columnKey, direction: 'asc' };
    });
  };

  // Get sort icon for column
  const getSortIcon = (columnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ChevronsUpDown className={`w-3 h-3 ${dynastyTheme.classes.text.neutralLighter} opacity-0 group-hover:opacity-100 ${dynastyTheme.classes.transition}`} />;
    }
    
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className={`w-3 h-3 ${dynastyTheme.classes.text.primary}`} />
    ) : (
      <ChevronDown className={`w-3 h-3 ${dynastyTheme.classes.text.primary}`} />
    );
  };

  // Handle column resizing
  const handleMouseDown = (e, columnKey) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey] || 80;

    const handleMouseMove = (e) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff); // Minimum width of 50px
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className={`dynasty-table-wrapper ${className}`}>
      {/* Table Title */}
      {title && (
        <div className={`${dynastyTheme.components.card.base} ${dynastyTheme.classes.text.primary} text-center py-2 px-4 font-bold text-sm`}>
          {title}
        </div>
      )}
      
      <div 
        className={`overflow-auto border ${dynastyTheme.classes.border.neutral}`}
        style={{ maxHeight }}
      >
        <table ref={tableRef} className="w-full table-fixed text-xs">
          {/* Header */}
          <thead className={`${stickyHeader ? 'sticky top-0' : ''} ${dynastyTheme.components.card.base} z-10`}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`relative text-center py-2 px-1 ${dynastyTheme.classes.text.primary} font-bold text-xs border-r ${dynastyTheme.classes.border.primary} cursor-pointer hover:bg-black/30 ${dynastyTheme.classes.transition} select-none group`}
                  style={{ width: columnWidths[column.key] || column.width || 80 }}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                >
                  <div className="flex items-center justify-center">
                    <span className="truncate mr-1">{column.title}</span>
                    {column.sortable !== false && getSortIcon(column.key)}
                  </div>
                  
                  {/* Resize handle */}
                  <div
                    className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-yellow-400 ${dynastyTheme.classes.transition} z-20`}
                    onMouseDown={(e) => handleMouseDown(e, column.key)}
                    style={{ 
                      background: isResizing ? dynastyTheme.tokens.colors.primary : 'transparent'
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className={dynastyTheme.components.card.base}>
            {sortedData.map((row, index) => (
              <tr 
                key={row.id || row.season_year || index}
                className={`${index % 2 === 0 ? dynastyTheme.components.card.base : 'bg-neutral-800/50'} hover:bg-neutral-700 ${dynastyTheme.classes.transition} border-b ${dynastyTheme.classes.border.neutral}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`py-1 px-2 text-center ${dynastyTheme.classes.text.white} text-xs border-r ${dynastyTheme.classes.border.neutral} ${column.className || ''}`}
                    style={{ width: columnWidths[column.key] || column.width || 80 }}
                  >
                    <div className="truncate">
                      {column.render ? column.render(row[column.key], row) : (row[column.key] ?? '-')}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            
            {/* Totals Row */}
            {showTotals && totalsRow && (
              <tr className={`${dynastyTheme.components.card.base} ${dynastyTheme.classes.text.primary} font-bold border-t-2 ${dynastyTheme.classes.border.primary}`}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`py-1 px-2 text-center text-xs border-r ${dynastyTheme.classes.border.primary}`}
                    style={{ width: columnWidths[column.key] || column.width || 80 }}
                  >
                    <div className="truncate">
                      {column.render ? column.render(totalsRow[column.key], totalsRow) : (totalsRow[column.key] ?? '-')}
                    </div>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>

        {/* Empty state */}
        {sortedData.length === 0 && (
          <div className={`text-center py-8 ${dynastyTheme.components.card.base}`}>
            <p className={dynastyTheme.classes.text.neutralLight}>No data available</p>
          </div>
        )}
      </div>

      {/* Sort indicator */}
      {sortConfig && (
        <div className={`mt-1 text-xs ${dynastyTheme.classes.text.neutralLight}`}>
          Sorted by {columns.find(c => c.key === sortConfig.key)?.title} ({sortConfig.direction === 'asc' ? '↑' : '↓'})
        </div>
      )}
    </div>
  );
};

/**
 * Calculate Quality Starts (QS) from game log data
 * A Quality Start is when a pitcher throws at least 6 innings and gives up 3 or fewer earned runs
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
 * Calculate Quality Start Rate (QSR) 
 * QSR = Quality Starts / Games Started
 */
export const calculateQualityStartRate = (qualityStarts, gamesStarted) => {
  if (!gamesStarted || gamesStarted === 0) return 0;
  return (qualityStarts / gamesStarted).toFixed(3);
};

/**
 * Helper function to create career stats columns configuration matching your screenshot
 */
export const createCareerStatsColumns = (isPitcher = false) => {
  if (isPitcher) {
    return [
      {
        key: 'season_year',
        title: 'Year',
        width: 60,
        render: (value) => value || '-'
      },
      {
        key: 'team_abbreviation', 
        title: 'Tm',
        width: 50,
        render: (value) => value || '-'
      },
      {
        key: 'games_played',
        title: 'G',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'games_started',
        title: 'GS',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'innings_pitched',
        title: 'IP',
        width: 60,
        render: (value) => value ? parseFloat(value).toFixed(1) : '0.0'
      },
      {
        key: 'era',
        title: 'ERA',
        width: 60,
        render: (value) => value ? parseFloat(value).toFixed(2) : '0.00'
      },
      {
        key: 'whip',
        title: 'WHIP',
        width: 60,
        render: (value) => value ? parseFloat(value).toFixed(2) : '0.00'
      },
      {
        key: 'wins',
        title: 'W',
        width: 40,
        render: (value) => value || 0
      },
      {
        key: 'losses',
        title: 'L',
        width: 40,
        render: (value) => value || 0
      },
      {
        key: 'saves',
        title: 'SV',
        width: 40,
        render: (value) => value || 0
      },
      {
        key: 'quality_starts',
        title: 'QS',
        width: 40,
        render: (value) => value || 0
      },
      {
        key: 'quality_start_rate',
        title: 'QSR',
        width: 60,
        render: (value) => value ? parseFloat(value).toFixed(3) : '.000'
      },
      {
        key: 'strikeouts_pitched',
        title: 'SO',
        width: 50,
        render: (value) => value || 0
      }
    ];
  }

  // Hitting stats matching your screenshot exactly + OPS
  return [
    {
      key: 'season_year',
      title: 'Year',
      width: 60,
      render: (value) => value || '-'
    },
    {
      key: 'team_abbreviation',
      title: 'Tm',
      width: 50,
      render: (value) => value || '-'
    },
    {
      key: 'games_played',
      title: 'G',
      width: 50,
      render: (value) => value || 0
    },
    {
      key: 'at_bats',
      title: 'AB',
      width: 50,
      render: (value) => value || 0
    },
    {
      key: 'runs',
      title: 'R',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'hits',
      title: 'H',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'doubles',
      title: '2B',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'triples',
      title: '3B',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'home_runs',
      title: 'HR',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'rbis',
      title: 'RBI',
      width: 50,
      render: (value) => value || 0
    },
    {
      key: 'stolen_bases',
      title: 'SB',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'walks',
      title: 'BB',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'strikeouts',
      title: 'K',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'avg',
      title: 'AVG',
      width: 60,
      render: (value) => value ? parseFloat(value).toFixed(3) : '.000'
    },
    {
      key: 'obp',
      title: 'OBP',
      width: 60,
      render: (value) => value ? parseFloat(value).toFixed(3) : '.000'
    },
    {
      key: 'slg',
      title: 'SLG',
      width: 60,
      render: (value) => value ? parseFloat(value).toFixed(3) : '.000'
    },
    {
      key: 'ops',
      title: 'OPS',
      width: 60,
      render: (value) => value ? parseFloat(value).toFixed(3) : '.000'
    }
  ];
};

/**
 * Helper function to calculate totals row for career stats
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
      walks_allowed: (acc.walks_allowed || 0) + (parseInt(season.walks_allowed) || 0)
    }), {});

    // Calculate ERA and WHIP
    totals.era = totals.innings_pitched > 0 ? ((totals.earned_runs * 9) / totals.innings_pitched).toFixed(2) : '0.00';
    totals.whip = totals.innings_pitched > 0 ? ((totals.hits_allowed + totals.walks_allowed) / totals.innings_pitched).toFixed(2) : '0.00';
    
    // Calculate Quality Starts from game log data if available
    if (gameLogData) {
      totals.quality_starts = calculateQualityStarts(gameLogData);
      totals.quality_start_rate = calculateQualityStartRate(totals.quality_starts, totals.games_started);
    } else {
      // Sum up QS from season data if available
      totals.quality_starts = careerData.reduce((acc, season) => acc + (parseInt(season.quality_starts) || 0), 0);
      totals.quality_start_rate = calculateQualityStartRate(totals.quality_starts, totals.games_started);
    }
    
    return totals;
  }

  // Hitting totals
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
    rbis: (acc.rbis || 0) + (parseInt(season.rbis) || 0),
    stolen_bases: (acc.stolen_bases || 0) + (parseInt(season.stolen_bases) || 0),
    walks: (acc.walks || 0) + (parseInt(season.walks) || 0),
    strikeouts: (acc.strikeouts || 0) + (parseInt(season.strikeouts) || 0)
  }), {});

  // Calculate averages
  totals.avg = totals.at_bats > 0 ? (totals.hits / totals.at_bats).toFixed(3) : '.000';
  totals.obp = (totals.at_bats + totals.walks) > 0 ? ((totals.hits + totals.walks) / (totals.at_bats + totals.walks)).toFixed(3) : '.000';
  
  const totalBases = totals.hits + totals.doubles + (totals.triples * 2) + (totals.home_runs * 3);
  totals.slg = totals.at_bats > 0 ? (totalBases / totals.at_bats).toFixed(3) : '.000';
  totals.ops = (parseFloat(totals.obp) + parseFloat(totals.slg)).toFixed(3);
  
  return totals;
};

/**
 * Helper function to create recent performance/game logs columns matching your screenshot
 */
export const createGameLogsColumns = (isPitcher = false) => {
  if (isPitcher) {
    return [
      {
        key: 'game_date',
        title: 'Date',
        width: 80,
        render: (value) => {
          if (!value) return '-';
          const date = new Date(value);
          return `${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
        }
      },
      {
        key: 'opponent_abbreviation',
        title: 'Opp',
        width: 80,
        render: (value, row) => {
          const homeAway = row.home_away === 'HOME' ? 'vs' : 'at';
          return value ? `${homeAway} ${value}` : '-';
        }
      },
      {
        key: 'innings_pitched',
        title: 'IP',
        width: 50,
        render: (value) => value ? parseFloat(value).toFixed(1) : '0.0'
      },
      {
        key: 'hits_allowed',
        title: 'H',
        width: 40,
        render: (value) => value || 0
      },
      {
        key: 'earned_runs',
        title: 'ER',
        width: 40,
        render: (value) => value || 0
      },
      {
        key: 'walks_allowed',
        title: 'BB',
        width: 40,
        render: (value) => value || 0
      },
      {
        key: 'strikeouts_pitched',
        title: 'SO',
        width: 40,
        render: (value) => value || 0
      },
      {
        key: 'quality_start',
        title: 'QS',
        width: 40,
        render: (value, row) => {
          // Calculate QS for this game
          const innings = parseFloat(row.innings_pitched) || 0;
          const earnedRuns = parseInt(row.earned_runs) || 0;
          return (innings >= 6.0 && earnedRuns <= 3) ? '1' : '0';
        }
      },
      {
        key: 'pitch_count',
        title: 'PC',
        width: 50,
        render: (value) => value || '-'
      }
    ];
  }

  // Hitting game logs
  return [
    {
      key: 'game_date',
      title: 'Date',
      width: 80,
      render: (value) => {
        if (!value) return '-';
        const date = new Date(value);
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
      }
    },
    {
      key: 'opponent_abbreviation',
      title: 'Opp',
      width: 80,
      render: (value, row) => {
        const homeAway = row.home_away === 'HOME' ? 'vs' : 'at';
        return value ? `${homeAway} ${value}` : '-';
      }
    },
    {
      key: 'at_bats',
      title: 'AB',
      width: 50,
      render: (value) => value || 0
    },
    {
      key: 'runs',
      title: 'R',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'hits',
      title: 'H',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'doubles',
      title: '2B',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'triples',
      title: '3B',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'home_runs',
      title: 'HR',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'rbis',
      title: 'BI',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'stolen_bases',
      title: 'SB',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'caught_stealing',
      title: 'CS',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'walks',
      title: 'BB',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'hit_by_pitch',
      title: 'HP',
      width: 40,
      render: (value) => value || 0
    },
    {
      key: 'strikeouts',
      title: 'K',
      width: 40,
      render: (value) => value || 0
    }
  ];
};