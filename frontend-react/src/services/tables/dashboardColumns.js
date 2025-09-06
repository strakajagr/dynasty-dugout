// src/services/dashboardColumns.js - DASHBOARD TABLE COLUMNS

import { dynastyTheme } from '../colorService';

// =============================================================================
// DASHBOARD TABLE COLUMNS - HOT/COLD PLAYERS
// =============================================================================
export const createHotPlayersColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => <span className={`${dynastyTheme.classes.text.primary} font-bold`}>{i + 1}</span> 
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 150, 
    render: (_, p) => (
      <div className="text-left">
        <div className={`font-semibold ${dynastyTheme.classes.text.white} ${dynastyTheme.classes.text.primaryHover} transition-colors`}>
          {p.name}
        </div>
        <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
          {p.position} • {p.team}
        </div>
      </div>
    )
  },
  { key: 'avg', title: 'AVG', width: 60, render: (_, p) => p.last_7?.avg?.toFixed(3) || '.000' },
  { key: 'hr', title: 'HR', width: 45, render: (_, p) => p.last_7?.hr || 0 },
  { key: 'rbi', title: 'RBI', width: 45, render: (_, p) => p.last_7?.rbi || 0 },
  { key: 'ops', title: 'OPS', width: 65, render: (_, p) => p.last_7?.ops?.toFixed(3) || '.000' },
  { 
    key: 'change', 
    title: 'Trend', 
    width: 70, 
    render: (_, p) => (
      <div className="flex items-center justify-center gap-1">
        <span className={dynastyTheme.classes.text.success}>↑</span>
        <span className={`${dynastyTheme.classes.text.success} font-bold`}>{p.change?.avg || '+.000'}</span>
      </div>
    )
  }
];

export const createColdPlayersColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => <span className={`${dynastyTheme.classes.text.neutralLight} font-bold`}>{i + 1}</span> 
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 150, 
    render: (_, p) => (
      <div className="text-left">
        <div className={`font-semibold ${dynastyTheme.classes.text.white} ${dynastyTheme.classes.text.primaryHover} transition-colors`}>
          {p.name}
        </div>
        <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
          {p.position} • {p.team}
        </div>
      </div>
    )
  },
  { key: 'avg', title: 'AVG', width: 60, render: (_, p) => p.last_7?.avg?.toFixed(3) || '.000' },
  { key: 'hr', title: 'HR', width: 45, render: (_, p) => p.last_7?.hr || 0 },
  { key: 'rbi', title: 'RBI', width: 45, render: (_, p) => p.last_7?.rbi || 0 },
  { key: 'ops', title: 'OPS', width: 65, render: (_, p) => p.last_7?.ops?.toFixed(3) || '.000' },
  { 
    key: 'change', 
    title: 'Trend', 
    width: 70, 
    render: (_, p) => (
      <div className="flex items-center justify-center gap-1">
        <span className={dynastyTheme.classes.text.error}>↓</span>
        <span className={`${dynastyTheme.classes.text.error} font-bold`}>{p.change?.avg || '-.000'}</span>
      </div>
    )
  }
];

// =============================================================================
// WAIVER WIRE COLUMNS
// =============================================================================
export const createWaiverAddsColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => <span className={`${dynastyTheme.classes.text.success} font-bold`}>{i + 1}</span> 
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 140, 
    render: (_, p) => (
      <div className="text-left">
        <div className={`font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`}>
          {p.name}
        </div>
        <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
          {p.position} • {p.team}
        </div>
      </div>
    )
  },
  { 
    key: 'adds_today', 
    title: 'Adds', 
    width: 60, 
    render: (_, p) => <span className={`${dynastyTheme.classes.text.success} font-bold`}>+{p.adds_today}</span> 
  },
  { key: 'ownership', title: 'Own%', width: 60, render: (_, p) => p.ownership },
  { 
    key: 'trend', 
    title: 'Δ', 
    width: 55, 
    render: (_, p) => (
      <span className={p.trend?.startsWith('+') ? dynastyTheme.classes.text.success : dynastyTheme.classes.text.error}>
        {p.trend}
      </span>
    ) 
  }
];

export const createWaiverDropsColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => <span className={`${dynastyTheme.classes.text.error} font-bold`}>{i + 1}</span> 
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 140, 
    render: (_, p) => (
      <div className="text-left">
        <div className={`font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`}>
          {p.name}
        </div>
        <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
          {p.position} • {p.team}
        </div>
      </div>
    )
  },
  { 
    key: 'drops_today', 
    title: 'Drops', 
    width: 60, 
    render: (_, p) => <span className={`${dynastyTheme.classes.text.error} font-bold`}>-{p.drops_today}</span> 
  },
  { key: 'ownership', title: 'Own%', width: 60, render: (_, p) => p.ownership },
  { 
    key: 'trend', 
    title: 'Δ', 
    width: 55, 
    render: (_, p) => <span className={dynastyTheme.classes.text.error}>{p.trend}</span> 
  }
];

// =============================================================================
// INJURY REPORT COLUMNS
// =============================================================================
export const createInjuryReportColumns = () => [
  { 
    key: 'name', 
    title: 'Player', 
    width: 140, 
    render: (_, p) => (
      <div className="text-left">
        <div className={`font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`}>
          {p.name}
        </div>
        <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
          {p.position} • {p.team}
        </div>
      </div>
    )
  },
  { 
    key: 'status', 
    title: 'Status', 
    width: 60, 
    render: (_, p) => {
      const colors = {
        'IL-60': dynastyTheme.components.badge.error,
        'IL-15': dynastyTheme.components.badge.warning,
        'IL-10': dynastyTheme.components.badge.warning,
        'DTD': dynastyTheme.components.badge.info
      };
      return (
        <span className={colors[p.status] || dynastyTheme.components.badge.neutral}>
          {p.status}
        </span>
      );
    }
  },
  { 
    key: 'injury', 
    title: 'Injury', 
    width: 150, 
    render: (_, p) => <span className={`text-xs ${dynastyTheme.classes.text.neutralLighter}`}>{p.injury}</span> 
  },
  { 
    key: 'return_date', 
    title: 'Return', 
    width: 80, 
    render: (_, p) => (
      <span className={p.return_date === '2026' ? dynastyTheme.classes.text.error : dynastyTheme.classes.text.neutralLight}>
        {p.return_date}
      </span>
    ) 
  }
];