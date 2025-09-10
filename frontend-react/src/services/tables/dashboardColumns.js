// src/services/tables/dashboardColumns.js - DASHBOARD TABLE COLUMNS WITH PITCHER SUPPORT
import React from 'react';  // CRITICAL - MUST IMPORT REACT FOR JSX

// Import theme from parent directory colorService
import { dynastyTheme } from '../colorService';

// =============================================================================
// HITTER COLUMNS
// =============================================================================
export const createHotHittersColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => React.createElement('span', {
      className: `${dynastyTheme.classes.text.primary} font-bold`
    }, i + 1)
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 150, 
    render: (_, p) => React.createElement('div', { className: 'text-left' },
      React.createElement('div', {
        className: `font-semibold ${dynastyTheme.classes.text.white} ${dynastyTheme.classes.text.primaryHover} transition-colors`
      }, p?.name || 'Unknown'),
      React.createElement('div', {
        className: `text-xs ${dynastyTheme.classes.text.neutralLight}`
      }, `${p?.position || 'POS'} • ${p?.team || 'TM'}`)
    )
  },
  { key: 'avg', title: 'AVG', width: 60, render: (_, p) => (p?.last_7?.avg?.toFixed(3) || '.000') },
  { key: 'hr', title: 'HR', width: 45, render: (_, p) => (p?.last_7?.hr || 0) },
  { key: 'rbi', title: 'RBI', width: 45, render: (_, p) => (p?.last_7?.rbi || 0) },
  { key: 'ops', title: 'OPS', width: 65, render: (_, p) => (p?.last_7?.ops?.toFixed(3) || '.000') },
  { 
    key: 'change', 
    title: 'Trend (OPS)', 
    width: 70, 
    render: (_, p) => React.createElement('div', { className: 'flex items-center justify-center gap-1' },
      React.createElement('span', { className: dynastyTheme.classes.text.success }, '↑'),
      React.createElement('span', { 
        className: `${dynastyTheme.classes.text.success} font-bold` 
      }, p?.change?.ops || '+.000')
    )
  }
];

export const createColdHittersColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => React.createElement('span', {
      className: `${dynastyTheme.classes.text.neutralLight} font-bold`
    }, i + 1)
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 150, 
    render: (_, p) => React.createElement('div', { className: 'text-left' },
      React.createElement('div', {
        className: `font-semibold ${dynastyTheme.classes.text.white} ${dynastyTheme.classes.text.primaryHover} transition-colors`
      }, p?.name || 'Unknown'),
      React.createElement('div', {
        className: `text-xs ${dynastyTheme.classes.text.neutralLight}`
      }, `${p?.position || 'POS'} • ${p?.team || 'TM'}`)
    )
  },
  { key: 'avg', title: 'AVG', width: 60, render: (_, p) => (p?.last_7?.avg?.toFixed(3) || '.000') },
  { key: 'hr', title: 'HR', width: 45, render: (_, p) => (p?.last_7?.hr || 0) },
  { key: 'rbi', title: 'RBI', width: 45, render: (_, p) => (p?.last_7?.rbi || 0) },
  { key: 'ops', title: 'OPS', width: 65, render: (_, p) => (p?.last_7?.ops?.toFixed(3) || '.000') },
  { 
    key: 'change', 
    title: 'Trend (OPS)', 
    width: 70, 
    render: (_, p) => React.createElement('div', { className: 'flex items-center justify-center gap-1' },
      React.createElement('span', { className: dynastyTheme.classes.text.error }, '↓'),
      React.createElement('span', { 
        className: `${dynastyTheme.classes.text.error} font-bold` 
      }, p?.change?.ops || '-.000')
    )
  }
];

// =============================================================================
// PITCHER COLUMNS
// =============================================================================
export const createHotPitchersColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => React.createElement('span', {
      className: `${dynastyTheme.classes.text.primary} font-bold`
    }, i + 1)
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 150, 
    render: (_, p) => React.createElement('div', { className: 'text-left' },
      React.createElement('div', {
        className: `font-semibold ${dynastyTheme.classes.text.white} ${dynastyTheme.classes.text.primaryHover} transition-colors`
      }, p?.name || 'Unknown'),
      React.createElement('div', {
        className: `text-xs ${dynastyTheme.classes.text.neutralLight}`
      }, `${p?.position || 'POS'} • ${p?.team || 'TM'}`)
    )
  },
  { key: 'wins', title: 'W', width: 35, render: (_, p) => (p?.last_7?.wins || 0) },
  { key: 'saves', title: 'SV', width: 35, render: (_, p) => (p?.last_7?.saves || 0) },
  { key: 'strikeouts', title: 'K', width: 35, render: (_, p) => (p?.last_7?.strikeouts || 0) },
  { key: 'era', title: 'ERA', width: 55, render: (_, p) => (p?.last_7?.era?.toFixed(2) || '0.00') },
  { key: 'whip', title: 'WHIP', width: 55, render: (_, p) => (p?.last_7?.whip?.toFixed(2) || '0.00') },
  { 
    key: 'change', 
    title: 'ERA Δ', 
    width: 60, 
    render: (_, p) => React.createElement('div', { className: 'flex items-center justify-center gap-1' },
      React.createElement('span', { className: dynastyTheme.classes.text.success }, '↓'),
      React.createElement('span', { 
        className: `${dynastyTheme.classes.text.success} font-bold` 
      }, p?.change?.era || '-0.00')
    )
  }
];

export const createColdPitchersColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => React.createElement('span', {
      className: `${dynastyTheme.classes.text.neutralLight} font-bold`
    }, i + 1)
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 150, 
    render: (_, p) => React.createElement('div', { className: 'text-left' },
      React.createElement('div', {
        className: `font-semibold ${dynastyTheme.classes.text.white} ${dynastyTheme.classes.text.primaryHover} transition-colors`
      }, p?.name || 'Unknown'),
      React.createElement('div', {
        className: `text-xs ${dynastyTheme.classes.text.neutralLight}`
      }, `${p?.position || 'POS'} • ${p?.team || 'TM'}`)
    )
  },
  { key: 'wins', title: 'W', width: 35, render: (_, p) => (p?.last_7?.wins || 0) },
  { key: 'saves', title: 'SV', width: 35, render: (_, p) => (p?.last_7?.saves || 0) },
  { key: 'strikeouts', title: 'K', width: 35, render: (_, p) => (p?.last_7?.strikeouts || 0) },
  { key: 'era', title: 'ERA', width: 55, render: (_, p) => (p?.last_7?.era?.toFixed(2) || '0.00') },
  { key: 'whip', title: 'WHIP', width: 55, render: (_, p) => (p?.last_7?.whip?.toFixed(2) || '0.00') },
  { 
    key: 'change', 
    title: 'ERA Δ', 
    width: 60, 
    render: (_, p) => React.createElement('div', { className: 'flex items-center justify-center gap-1' },
      React.createElement('span', { className: dynastyTheme.classes.text.error }, '↑'),
      React.createElement('span', { 
        className: `${dynastyTheme.classes.text.error} font-bold` 
      }, p?.change?.era || '+0.00')
    )
  }
];

// Keep old names for backwards compatibility
export const createHotPlayersColumns = createHotHittersColumns;
export const createColdPlayersColumns = createColdHittersColumns;

// =============================================================================
// WAIVER WIRE COLUMNS
// =============================================================================
export const createWaiverAddsColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => React.createElement('span', {
      className: `${dynastyTheme.classes.text.success} font-bold`
    }, i + 1)
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 140, 
    render: (_, p) => React.createElement('div', { className: 'text-left' },
      React.createElement('div', {
        className: `font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`
      }, p?.name || 'Unknown'),
      React.createElement('div', {
        className: `text-xs ${dynastyTheme.classes.text.neutralLight}`
      }, `${p?.position || 'POS'} • ${p?.team || 'TM'}`)
    )
  },
  { 
    key: 'adds_today', 
    title: 'Adds', 
    width: 60, 
    render: (_, p) => React.createElement('span', {
      className: `${dynastyTheme.classes.text.success} font-bold`
    }, `+${p?.adds_today || 0}`)
  },
  { key: 'ownership', title: 'Own%', width: 60, render: (_, p) => (p?.ownership || '0%') },
  { 
    key: 'trend', 
    title: 'Δ', 
    width: 55, 
    render: (_, p) => React.createElement('span', {
      className: p?.trend?.startsWith('+') ? dynastyTheme.classes.text.success : dynastyTheme.classes.text.error
    }, p?.trend || '+0')
  }
];

export const createWaiverDropsColumns = () => [
  { 
    key: 'rank', 
    title: '#', 
    width: 35, 
    render: (_, p, i) => React.createElement('span', {
      className: `${dynastyTheme.classes.text.error} font-bold`
    }, i + 1)
  },
  { 
    key: 'name', 
    title: 'Player', 
    width: 140, 
    render: (_, p) => React.createElement('div', { className: 'text-left' },
      React.createElement('div', {
        className: `font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`
      }, p?.name || 'Unknown'),
      React.createElement('div', {
        className: `text-xs ${dynastyTheme.classes.text.neutralLight}`
      }, `${p?.position || 'POS'} • ${p?.team || 'TM'}`)
    )
  },
  { 
    key: 'drops_today', 
    title: 'Drops', 
    width: 60, 
    render: (_, p) => React.createElement('span', {
      className: `${dynastyTheme.classes.text.error} font-bold`
    }, `-${p?.drops_today || 0}`)
  },
  { key: 'ownership', title: 'Own%', width: 60, render: (_, p) => (p?.ownership || '0%') },
  { 
    key: 'trend', 
    title: 'Δ', 
    width: 55, 
    render: (_, p) => React.createElement('span', {
      className: dynastyTheme.classes.text.error
    }, p?.trend || '-0')
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
    render: (_, p) => React.createElement('div', { className: 'text-left' },
      React.createElement('div', {
        className: `font-semibold ${dynastyTheme.classes.text.white} text-sm ${dynastyTheme.classes.text.primaryHover} transition-colors`
      }, p?.name || 'Unknown'),
      React.createElement('div', {
        className: `text-xs ${dynastyTheme.classes.text.neutralLight}`
      }, `${p?.position || 'POS'} • ${p?.team || 'TM'}`)
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
      return React.createElement('span', {
        className: colors[p?.status] || dynastyTheme.components.badge.neutral
      }, p?.status || 'Unknown');
    }
  },
  { 
    key: 'injury', 
    title: 'Injury', 
    width: 150, 
    render: (_, p) => React.createElement('span', {
      className: `text-xs ${dynastyTheme.classes.text.neutralLighter}`
    }, p?.injury || 'Unknown')
  },
  { 
    key: 'return_date', 
    title: 'Return', 
    width: 80, 
    render: (_, p) => React.createElement('span', {
      className: p?.return_date === '2026' ? dynastyTheme.classes.text.error : dynastyTheme.classes.text.neutralLight
    }, p?.return_date || 'TBD')
  }
];