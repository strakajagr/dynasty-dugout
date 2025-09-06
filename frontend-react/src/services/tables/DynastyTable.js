// src/services/tables/DynastyTable.js - CORE TABLE COMPONENT WITH HEADER TOOLTIPS AND CUSTOM SORT

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Info } from 'lucide-react';
import { dynastyTheme } from '../colorService';
import { headerTooltips } from './tableHelpers';

// =============================================================================
// BASIC RENDER HELPERS
// =============================================================================
export const renderDefault = (v) => v || 0;
export const renderFloat1 = (v) => (parseFloat(v) || 0).toFixed(1);
export const renderFloat2 = (v) => (parseFloat(v) || 0).toFixed(2);
export const renderFloat3 = (v) => (parseFloat(v) || 0).toFixed(3);
export const renderAvg = (v) => {
  const val = parseFloat(v) || 0;
  if (val === 0) return '.000';
  if (val >= 1) return val.toFixed(3);
  return `.${Math.round(val * 1000).toString().padStart(3, '0')}`;
};

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================
const HeaderTooltip = ({ title, children, columnKey }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);

  const handleMouseEnter = (e) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Show tooltip after 300ms delay
    timeoutRef.current = setTimeout(() => {
      const rect = e.currentTarget.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // Calculate position to keep tooltip on screen
      let x = rect.left + rect.width / 2;
      
      // Adjust if tooltip would go off right edge
      if (x + 200 > viewportWidth) {
        x = viewportWidth - 210;
      }
      // Adjust if tooltip would go off left edge
      if (x - 100 < 10) {
        x = 110;
      }
      
      setTooltipPosition({
        x: x,
        y: rect.bottom + 5
      });
      setShowTooltip(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Get tooltip text from mapping or use full title
  const tooltip = headerTooltips[title] || 
                  headerTooltips[columnKey] || 
                  (title.length > 5 ? title : null);
  
  // Don't show tooltip if there's no expansion needed
  const shouldShowTooltip = tooltip && tooltip !== title;

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={shouldShowTooltip ? handleMouseEnter : undefined}
        onMouseLeave={shouldShowTooltip ? handleMouseLeave : undefined}
        className="inline-flex items-center gap-1"
      >
        {children}
        {shouldShowTooltip && (
          <Info className="w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity" />
        )}
      </div>
      
      {showTooltip && shouldShowTooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] pointer-events-none animate-fadeIn"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateX(-50%)',
            maxWidth: '400px'
          }}
        >
          <div className={`
            px-3 py-2 rounded-md shadow-2xl
            ${dynastyTheme.classes.bg.darkFlat}
            ${dynastyTheme.classes.border.primary}
            border backdrop-blur-md bg-opacity-95
          `}>
            <div className={`text-xs ${dynastyTheme.classes.text.white} font-medium`}>
              {tooltip}
            </div>
            {title !== columnKey && (
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
                Column: {columnKey}
              </div>
            )}
          </div>
          {/* Arrow pointer */}
          <div 
            className={`absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 
              ${dynastyTheme.classes.bg.darkFlat} ${dynastyTheme.classes.border.primary}
              border-l border-t rotate-45`}
          />
        </div>
      )}
    </>
  );
};

// =============================================================================
// MAIN TABLE COMPONENT - DYNASTY THEME INTEGRATED
// =============================================================================
export const DynastyTable = ({ 
  data = [], 
  columns = [], 
  initialSort = null,
  className = '',
  maxHeight = '600px',
  minWidth = '1400px',
  stickyHeader = true,
  title = '',
  showTotals = false,
  totalsRow = null,
  enableHorizontalScroll = true,
  enableVerticalScroll = true,
  twoRowMode = false
}) => {
  const [sortConfig, setSortConfig] = useState(initialSort);
  const [columnWidths, setColumnWidths] = useState({});
  const [isResizing, setIsResizing] = useState(false);
  const tableRef = useRef(null);

  // Column widths management
  const memoizedColumnWidths = useMemo(() => {
    const widths = {};
    columns.forEach(col => {
      widths[col.key] = columnWidths[col.key] || col.width || 50;
    });
    return widths;
  }, [columns, columnWidths]);

  // Initialize column widths with original values
  useEffect(() => {
    const defaultWidths = {};
    columns.forEach(col => {
      defaultWidths[col.key] = col.width || 50;
    });
    setColumnWidths(defaultWidths);
  }, [columns]);

  // Improved sorting with custom sortValue support
  const sortedData = useMemo(() => {
    if (!sortConfig || !data.length) return data;

    // Find the column configuration for custom sort values
    const column = columns.find(col => col.key === sortConfig.key);

    return [...data].sort((a, b) => {
      let aValue, bValue;
      
      // Check if column has custom sortValue function
      if (column?.sortValue) {
        aValue = column.sortValue(a);
        bValue = column.sortValue(b);
      } else if (sortConfig.key === 'player_name') {
        aValue = `${a.last_name || ''} ${a.first_name || ''}`.trim() || a.name || a.player_name;
        bValue = `${b.last_name || ''} ${b.first_name || ''}`.trim() || b.name || b.player_name;
      } else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }

      // Early returns for performance
      if (aValue === bValue) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      const result = aStr.localeCompare(bStr);
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [data, sortConfig, columns]);

  // Memoized callbacks
  const handleSort = useCallback((columnKey) => {
    setSortConfig(prevConfig => {
      if (prevConfig?.key === columnKey) {
        if (prevConfig.direction === 'asc') {
          return { key: columnKey, direction: 'desc' };
        } else if (prevConfig.direction === 'desc') {
          return null;
        }
      }
      return { key: columnKey, direction: 'asc' };
    });
  }, []);

  const getSortIcon = useCallback((columnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return (
        <ChevronsUpDown 
          className={`w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity ${dynastyTheme.classes.text.neutralLight}`} 
        />
      );
    }
    
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className={`w-3 h-3 ${dynastyTheme.classes.text.primary}`} />
    ) : (
      <ChevronDown className={`w-3 h-3 ${dynastyTheme.classes.text.primary}`} />
    );
  }, [sortConfig]);

  const handleMouseDown = useCallback((e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = memoizedColumnWidths[columnKey];

    const handleMouseMove = (e) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(25, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [memoizedColumnWidths]);

  // Memoized styles
  const overflowClass = useMemo(() => {
    const base = enableHorizontalScroll && enableVerticalScroll ? 'overflow-auto' :
                 enableHorizontalScroll ? 'overflow-x-auto overflow-y-hidden' :
                 enableVerticalScroll ? 'overflow-y-auto overflow-x-hidden' :
                 'overflow-hidden';
    return `${base} scrollbar-thin scrollbar-thumb-yellow-400 scrollbar-track-gray-800`;
  }, [enableHorizontalScroll, enableVerticalScroll]);

  const tableStyles = useMemo(() => ({
    minWidth: enableHorizontalScroll ? minWidth : 'auto'
  }), [enableHorizontalScroll, minWidth]);

  const containerStyles = useMemo(() => ({
    maxHeight
  }), [maxHeight]);

  return (
    <div className={`dynasty-table-wrapper ${className} relative`}>
      {/* Animation for tooltip fade-in */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-5px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .dynasty-main-row {
          background: rgb(38, 38, 38) !important;
          transform: translateZ(0);
          will-change: transform;
          contain: layout style paint;
        }
        
        .dynasty-l14-row {
          background: rgb(23, 23, 23) !important;
          transform: translateZ(0);
          will-change: transform;
          contain: layout style paint;
        }
        
        .dynasty-main-row:hover {
          background: rgb(64, 64, 64) !important;
        }
        
        .dynasty-l14-row:hover {
          background: rgb(45, 45, 45) !important;
        }
      `}</style>

      {title && (
        <div className={`${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.border.neutral} backdrop-blur-sm text-center py-3 px-4 mb-2 rounded-t-md border`}>
          <h3 className={`font-bold text-sm ${dynastyTheme.classes.text.primary}`}>
            {title}
          </h3>
        </div>
      )}
      
      <div 
        className={`relative ${dynastyTheme.classes.border.neutral} rounded-md ${overflowClass} 
          shadow-lg ${dynastyTheme.classes.bg.darkFlat} border`}
        style={containerStyles}
      >
        <div style={tableStyles}>
          <table ref={tableRef} className="w-full table-fixed text-xs" style={tableStyles}>
            <thead className={`${stickyHeader ? 'sticky top-0' : ''} z-20`}>
              <tr className={dynastyTheme.classes.bg.darkFlat}>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`relative text-center py-3 px-1 font-bold text-xs 
                      ${dynastyTheme.classes.border.neutral} border-r cursor-pointer select-none group
                      transition-colors ${dynastyTheme.classes.bg.darkLighter}
                      ${sortConfig?.key === column.key ? 'bg-yellow-400/10' : 'hover:bg-gray-600'}`}
                    style={{ width: memoizedColumnWidths[column.key] }}
                    onClick={() => column.sortable !== false && handleSort(column.key)}
                  >
                    <div className="flex items-center justify-center relative">
                      <HeaderTooltip title={column.title} columnKey={column.key}>
                        <span className={`truncate transition-colors
                          ${sortConfig?.key === column.key ? dynastyTheme.classes.text.primaryBright : `${dynastyTheme.classes.text.primary} group-hover:text-yellow-300`}`}>
                          {column.title}
                        </span>
                      </HeaderTooltip>
                      {column.sortable !== false && getSortIcon(column.key)}
                    </div>
                    
                    {/* Resize handle */}
                    <div
                      className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize 
                        hover:bg-yellow-400/50 transition-colors z-30`}
                      onMouseDown={(e) => handleMouseDown(e, column.key)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ 
                        background: isResizing ? '#D4AF37' : 'transparent'
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sortedData.map((row, index) => (
                <React.Fragment key={row.league_player_id || row.player_id || row.id || index}>
                  {/* Main player row */}
                  <tr className="dynasty-main-row">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`py-1 px-1 text-center text-xs border-r border-neutral-700
                          text-gray-300 ${column.className || ''}`}
                        style={{ width: memoizedColumnWidths[column.key] }}
                      >
                        <div className={column.allowOverflow ? '' : 'truncate'}>
                          {column.render ? column.render(row[column.key], row, index) : (row[column.key] ?? '-')}
                        </div>
                      </td>
                    ))}
                  </tr>
                  
                  {/* Last 14 days row */}
                  {twoRowMode && row.last_14_days && (
                    <tr className="dynasty-l14-row">
                      {columns.map((column) => (
                        <td
                          key={`l14-${column.key}`}
                          className="py-0.5 px-1 text-center text-xs border-r border-neutral-700 text-gray-400 italic"
                          style={{ width: memoizedColumnWidths[column.key] }}
                        >
                          {column.key === 'player_name' ? (
                            <div className="text-left text-xs italic opacity-75">
                              <span className={dynastyTheme.classes.text.primary}>↳</span> Last 14 days
                            </div>
                          ) : column.renderL14 ? (
                            column.renderL14(row.last_14_days[column.key], row.last_14_days)
                          ) : column.isStatColumn ? (
                            row.last_14_days[column.key] ?? '-'
                          ) : (
                            ''
                          )}
                        </td>
                      ))}
                    </tr>
                  )}
                </React.Fragment>
              ))}
              
              {showTotals && totalsRow && (
                <tr className={`font-bold border-t-2 ${dynastyTheme.classes.border.primaryBright} 
                  bg-yellow-400/10 backdrop-blur-sm sticky bottom-0`}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`py-1 px-1 text-center text-xs border-r border-yellow-400
                        ${dynastyTheme.classes.text.primary}`}
                      style={{ width: memoizedColumnWidths[column.key] }}
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
        </div>

        {sortedData.length === 0 && (
          <div className={`text-center py-12 ${dynastyTheme.classes.bg.darkFlat}`}>
            <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>No data available</p>
            <p className={`text-xs mt-2 ${dynastyTheme.classes.text.neutral}`}>Check back later for updates</p>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className={`mt-2 text-xs ${dynastyTheme.classes.text.neutralLight} flex items-center gap-3 px-1`}>
        {enableHorizontalScroll && (
          <span className="flex items-center gap-1">
            <span className={`${dynastyTheme.classes.text.primary} opacity-60`}>→</span> Scroll for more stats
          </span>
        )}
        {enableVerticalScroll && data.length > 10 && (
          <span className="flex items-center gap-1">
            <span className={`${dynastyTheme.classes.text.primary} opacity-60`}>↓</span> {data.length} rows
          </span>
        )}
        {sortConfig && (
          <span className={`flex items-center gap-1 ${dynastyTheme.classes.text.primary} opacity-50`}>
            <span>|</span> Sorted: {columns.find(c => c.key === sortConfig.key)?.title} 
            <span className={dynastyTheme.classes.text.primary}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Info className="w-3 h-3" />
          <span>Hover on headers for full descriptions</span>
        </span>
      </div>
    </div>
  );
};