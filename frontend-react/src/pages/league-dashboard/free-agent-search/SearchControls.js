// src/pages/league-dashboard/free-agent-search/SearchControls.js - COMPLETE WITH ADVANCED FILTERS

import React, { useState } from 'react';
import { 
  Search, Users, Eye, Zap, ChevronDown, UserPlus, AlertTriangle, 
  Shield, CheckSquare, Square, Filter, Calendar, TrendingUp,
  X, ChevronUp
} from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';
import { useBatchSelection } from './BatchSelectionProvider';
import { canAddPlayers } from '../../../utils/RosterCapacityUtils';

const SearchControls = ({ state, leagueId, isCommissionerMode, activeTeamName }) => {
  const { 
    selectionStats, 
    getSelectedPlayerObjects, 
    clearAllSelections, 
    bulkMode, 
    toggleBulkMode 
  } = useBatchSelection();
  
  const {
    // Filters & Search
    searchTerm,
    setSearchTerm,
    activeTab,
    setActiveTab,
    positionFilter,
    setPositionFilter,
    viewMode,
    setViewMode,
    showAll,
    setShowAll,
    totalCount,
    
    // Functions
    loadPlayers,
    handleBatchAddPlayers,
    
    // State
    players,
    loading,
    rosterCapacityAnalysis,
    transactionsEnabled,
    
    // Error handling
    setError
  } = state;

  // ========================================
  // ADVANCED FILTERS STATE
  // ========================================
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    // Hitter filters
    minAB: '',
    maxAB: '',
    minHR: '',
    maxHR: '',
    minG: '',
    maxG: '',
    minPrice: '',
    maxPrice: '',
    hitterQualified: false,
    
    // Pitcher filters
    minK: '',
    maxK: '',
    minGS: '',
    maxGS: '',
    minIP: '',
    maxIP: '',
    pitcherQualified: false,
    
    // Date filters
    dateRange: 'season', // 'season', 'last7', 'last14', 'last30', 'custom'
    customStartDate: '',
    customEndDate: '',
    
    // MLB Qualification thresholds
    qualifiedPA: 502, // 3.1 PA per 162 games
    qualifiedIP: 162  // 1 IP per 162 games
  });

  // Position options
  const hitterPositions = [
    { value: 'all', label: 'All Positions' },
    { value: 'C', label: 'Catcher (C)' },
    { value: '1B', label: 'First Base (1B)' },
    { value: '2B', label: 'Second Base (2B)' },
    { value: '3B', label: 'Third Base (3B)' },
    { value: 'SS', label: 'Shortstop (SS)' },
    { value: 'MI', label: 'Middle Infield (2B/SS)' },
    { value: 'CI', label: 'Corner Infield (1B/3B)' },
    { value: 'OF', label: 'Outfield (OF)' },
    { value: 'DH', label: 'Designated Hitter (DH)' },
    { value: 'UT', label: 'Utility' }
  ];

  const pitcherPositions = [
    { value: 'all', label: 'All Pitchers' },
    { value: 'SP', label: 'Starting Pitcher (SP)' },
    { value: 'RP', label: 'Relief Pitcher (RP)' },
    { value: 'CL', label: 'Closer (CL)' }
  ];

  // ========================================
  // FILTER APPLICATION
  // ========================================
  const applyAdvancedFilters = () => {
    // Build filter object for API
    const filters = {
      ...advancedFilters,
      activeTab
    };
    
    // Apply filters and reload
    loadPlayers(searchTerm, activeTab, positionFilter, showAll, 0, false, filters);
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      minAB: '',
      maxAB: '',
      minHR: '',
      maxHR: '',
      minG: '',
      maxG: '',
      minPrice: '',
      maxPrice: '',
      hitterQualified: false,
      minK: '',
      maxK: '',
      minGS: '',
      maxGS: '',
      minIP: '',
      maxIP: '',
      pitcherQualified: false,
      dateRange: 'season',
      customStartDate: '',
      customEndDate: '',
      qualifiedPA: 502,
      qualifiedIP: 162
    });
  };

  // ========================================
  // ROSTER CAPACITY VALIDATION
  // ========================================
  const validateBatchAddition = () => {
    if (!rosterCapacityAnalysis) {
      return {
        canAdd: false,
        message: 'Checking roster capacity...',
        type: 'loading'
      };
    }

    if (selectionStats.count === 0) {
      return {
        canAdd: false,
        message: 'No players selected',
        type: 'info'
      };
    }

    const capacityCheck = canAddPlayers(selectionStats.count, rosterCapacityAnalysis);
    
    if (!capacityCheck.canAdd) {
      return {
        canAdd: false,
        message: `Cannot add ${selectionStats.count} players: ${capacityCheck.message}`,
        type: 'error'
      };
    }

    return {
      canAdd: true,
      message: `Ready to assign positions for ${selectionStats.count} player${selectionStats.count !== 1 ? 's' : ''}`,
      type: 'success'
    };
  };

  // ========================================
  // EVENT HANDLERS
  // ========================================
  const handleViewModeChange = (newMode) => {
    setViewMode(newMode);
    const newShowAll = newMode === 'all_players';
    setShowAll(newShowAll);
    setSearchTerm('');
    setPositionFilter('all');
    clearAllSelections();
    clearAdvancedFilters();
    
    loadPlayers('', activeTab, 'all', newShowAll, 0, false);
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchTerm('');
    setPositionFilter('all');
    clearAllSelections();
    clearAdvancedFilters();
    
    loadPlayers('', newTab, 'all', showAll, 0, false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    clearAllSelections();
    applyAdvancedFilters();
  };

  const handleIntelligentBatchAdd = () => {
    const validation = validateBatchAddition();
    
    if (!validation.canAdd) {
      setError(validation.message);
      setTimeout(() => setError(''), 5000);
      return;
    }

    const selectedPlayerObjects = getSelectedPlayerObjects(players);
    handleBatchAddPlayers(selectedPlayerObjects);
  };

  const renderCapacityIndicator = () => {
    if (!rosterCapacityAnalysis) return null;

    const { availableSlots, totalSlots, usedSlots } = rosterCapacityAnalysis;
    const percentFull = (usedSlots / totalSlots) * 100;

    return (
      <div className={`flex items-center gap-2 text-xs ${dynastyTheme.classes.text.neutralLight}`}>
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          <span>Roster:</span>
        </div>
        <div className={`px-2 py-1 rounded ${
          percentFull < 70 ? 'bg-green-500/20 text-green-400' :
          percentFull < 90 ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {usedSlots}/{totalSlots}
        </div>
        {availableSlots > 0 && (
          <span className="text-green-400">({availableSlots} available)</span>
        )}
        {availableSlots === 0 && (
          <span className="text-red-400">(FULL)</span>
        )}
      </div>
    );
  };

  // ========================================
  // MAIN RENDER
  // ========================================
  return (
    <>
      {/* BATCH ADD BANNER - Only show when bulk mode is enabled AND selections exist */}
      {bulkMode && selectionStats.hasSelections && (
        <div className={`${dynastyTheme.components.card.base} p-4 mb-4 border-l-4 ${
          rosterCapacityAnalysis?.availableSlots >= selectionStats.count
            ? 'border-yellow-400'
            : 'border-red-400 bg-red-500/10'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserPlus className={`w-5 h-5 ${
                rosterCapacityAnalysis?.availableSlots >= selectionStats.count
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`} />
              <div>
                <div className={dynastyTheme.classes.text.white}>
                  {selectionStats.count} player{selectionStats.count !== 1 ? 's' : ''} selected
                </div>
                {isCommissionerMode && (
                  <div className="text-xs text-yellow-400">
                    Will be added to {activeTeamName}
                  </div>
                )}
              </div>
              
              {rosterCapacityAnalysis && (
                <div className="flex items-center gap-2">
                  {rosterCapacityAnalysis.availableSlots < selectionStats.count ? (
                    <div className="flex items-center gap-1 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs">
                        Only {rosterCapacityAnalysis.availableSlots} slots available
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-green-400">
                      <Shield className="w-4 h-4" />
                      <span className="text-xs">
                        {rosterCapacityAnalysis.availableSlots} slots available
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={clearAllSelections}
                className={dynastyTheme.utils.getComponent('button', 'ghost', 'sm')}
              >
                Clear All
              </button>
              <button
                onClick={handleIntelligentBatchAdd}
                disabled={loading || !rosterCapacityAnalysis}
                className={`${
                  rosterCapacityAnalysis?.availableSlots >= selectionStats.count
                    ? dynastyTheme.utils.getComponent('button', 'primary', 'md')
                    : 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors'
                } disabled:opacity-50 flex items-center gap-2`}
              >
                <UserPlus className="w-4 h-4" />
                {rosterCapacityAnalysis?.availableSlots >= selectionStats.count
                  ? `Assign Positions`
                  : `Try Add Anyway`
                } ({selectionStats.count})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER ROW - View Mode and Bulk Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        {/* View Mode Toggle */}
        <div className="flex space-x-1">
          <button
            onClick={() => handleViewModeChange('free_agents')}
            className={`flex items-center gap-2 ${dynastyTheme.utils.getComponent('button', viewMode === 'free_agents' ? 'primary' : 'secondary', 'md')} ${dynastyTheme.classes.transition}`}
          >
            <Eye className="w-4 h-4" />
            Free Agents Only
            {viewMode === 'free_agents' && totalCount > 0 && (
              <span className={dynastyTheme.components.badge.success}>
                {totalCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleViewModeChange('all_players')}
            className={`flex items-center gap-2 ${dynastyTheme.utils.getComponent('button', viewMode === 'all_players' ? 'primary' : 'secondary', 'md')} ${dynastyTheme.classes.transition}`}
          >
            <Users className="w-4 h-4" />
            All Players
            {viewMode === 'all_players' && totalCount > 0 && (
              <span className={dynastyTheme.components.badge.info}>
                {totalCount}
              </span>
            )}
          </button>
        </div>

        {/* Bulk Mode Toggle & Advanced Filters */}
        <div className="flex items-center gap-2">
          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-2 ${dynastyTheme.utils.getComponent('button', showAdvancedFilters ? 'primary' : 'secondary', 'md')} ${dynastyTheme.classes.transition}`}
          >
            <Filter className="w-4 h-4" />
            Advanced Filters
            {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Bulk Mode Toggle */}
          {transactionsEnabled && (
            <button
              onClick={toggleBulkMode}
              className={`flex items-center gap-2 ${dynastyTheme.utils.getComponent('button', bulkMode ? 'primary' : 'secondary', 'md')} ${dynastyTheme.classes.transition}`}
              title={bulkMode ? 'Exit bulk selection mode' : 'Enable bulk selection mode'}
            >
              {bulkMode ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Bulk Add {bulkMode ? 'ON' : 'OFF'}
              {bulkMode && selectionStats.hasSelections && (
                <span className={dynastyTheme.components.badge.warning}>
                  {selectionStats.count}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => handleTabChange('hitters')}
          className={`flex items-center gap-2 ${dynastyTheme.utils.getComponent('button', activeTab === 'hitters' ? 'primary' : 'secondary', 'md')} ${dynastyTheme.classes.transition}`}
        >
          <Users className="w-4 h-4" />
          Hitters
        </button>
        <button
          onClick={() => handleTabChange('pitchers')}
          className={`flex items-center gap-2 ${dynastyTheme.utils.getComponent('button', activeTab === 'pitchers' ? 'primary' : 'secondary', 'md')} ${dynastyTheme.classes.transition}`}
        >
          <Zap className="w-4 h-4" />
          Pitchers
        </button>
      </div>

      {/* ADVANCED FILTERS PANEL */}
      {showAdvancedFilters && (
        <div className={`${dynastyTheme.components.card.base} p-4 mb-6`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range Filter */}
            <div className="md:col-span-4">
              <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-2`}>
                <Calendar className="w-3 h-3 inline mr-1" />
                Date Range
              </label>
              <div className="flex gap-2">
                {['season', 'last7', 'last14', 'last30', 'custom'].map(range => (
                  <button
                    key={range}
                    onClick={() => setAdvancedFilters(prev => ({ ...prev, dateRange: range }))}
                    className={`px-3 py-1 text-xs rounded ${
                      advancedFilters.dateRange === range 
                        ? 'bg-yellow-400 text-black' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } transition-colors`}
                  >
                    {range === 'season' ? 'Full Season' :
                     range === 'last7' ? 'Last 7 Days' :
                     range === 'last14' ? 'Last 14 Days' :
                     range === 'last30' ? 'Last 30 Days' :
                     'Custom'}
                  </button>
                ))}
              </div>
              {advancedFilters.dateRange === 'custom' && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="date"
                    value={advancedFilters.customStartDate}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, customStartDate: e.target.value }))}
                    className={`${dynastyTheme.components.input} text-xs`}
                  />
                  <span className={dynastyTheme.classes.text.neutralLight}>to</span>
                  <input
                    type="date"
                    value={advancedFilters.customEndDate}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, customEndDate: e.target.value }))}
                    className={`${dynastyTheme.components.input} text-xs`}
                  />
                </div>
              )}
            </div>

            {/* Hitter Filters */}
            {activeTab === 'hitters' && (
              <>
                <div>
                  <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>At Bats (AB)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={advancedFilters.minAB}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, minAB: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={advancedFilters.maxAB}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, maxAB: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>Home Runs (HR)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={advancedFilters.minHR}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, minHR: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={advancedFilters.maxHR}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, maxHR: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>Games (G)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={advancedFilters.minG}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, minG: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={advancedFilters.maxG}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, maxG: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>MLB Qualified</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={advancedFilters.hitterQualified}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, hitterQualified: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-600"
                    />
                    <span className="text-xs text-gray-400">≥{advancedFilters.qualifiedPA} PA</span>
                    <input
                      type="number"
                      value={advancedFilters.qualifiedPA}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, qualifiedPA: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-16 ml-1`}
                      title="Set custom PA threshold"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Pitcher Filters */}
            {activeTab === 'pitchers' && (
              <>
                <div>
                  <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>Strikeouts (K)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={advancedFilters.minK}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, minK: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={advancedFilters.maxK}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, maxK: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>Games Started (GS)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={advancedFilters.minGS}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, minGS: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={advancedFilters.maxGS}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, maxGS: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>Innings Pitched (IP)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={advancedFilters.minIP}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, minIP: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={advancedFilters.maxIP}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, maxIP: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-20`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>MLB Qualified</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={advancedFilters.pitcherQualified}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, pitcherQualified: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-600"
                    />
                    <span className="text-xs text-gray-400">≥{advancedFilters.qualifiedIP} IP</span>
                    <input
                      type="number"
                      value={advancedFilters.qualifiedIP}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, qualifiedIP: e.target.value }))}
                      className={`${dynastyTheme.components.input} text-xs w-16 ml-1`}
                      title="Set custom IP threshold"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Price Filter (both tabs) */}
            <div>
              <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>Price ($)</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={advancedFilters.minPrice}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                  className={`${dynastyTheme.components.input} text-xs w-20`}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={advancedFilters.maxPrice}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                  className={`${dynastyTheme.components.input} text-xs w-20`}
                />
              </div>
            </div>
          </div>

          {/* Apply/Clear Buttons */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                clearAdvancedFilters();
                loadPlayers(searchTerm, activeTab, positionFilter, showAll, 0, false);
              }}
              className={dynastyTheme.utils.getComponent('button', 'ghost', 'sm')}
            >
              <X className="w-3 h-3 mr-1" />
              Clear Filters
            </button>
            <button
              onClick={applyAdvancedFilters}
              className={`${dynastyTheme.utils.getComponent('button', 'primary', 'sm')} flex items-center gap-1`}
            >
              <TrendingUp className="w-3 h-3" />
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${dynastyTheme.classes.text.neutralLight}`} />
            <input
              type="text"
              placeholder={`Search ${activeTab} by name...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${dynastyTheme.components.input} pl-10 w-full`}
            />
          </div>
        </form>
        
        {/* Position Filter Dropdown */}
        <div className="relative">
          <select
            value={positionFilter}
            onChange={(e) => {
              setPositionFilter(e.target.value);
              clearAllSelections();
            }}
            className={`${dynastyTheme.components.input} pr-10 min-w-[200px] appearance-none cursor-pointer`}
          >
            {(activeTab === 'hitters' ? hitterPositions : pitcherPositions).map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${dynastyTheme.classes.text.neutralLight} pointer-events-none`} />
        </div>

        <button
          onClick={handleSearchSubmit}
          disabled={loading}
          className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} disabled:opacity-50`}
        >
          Search
        </button>
        
        {(searchTerm || positionFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setPositionFilter('all');
              clearAllSelections();
              clearAdvancedFilters();
              loadPlayers('', activeTab, 'all', showAll, 0, false);
            }}
            className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Results Info with Roster Capacity */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <p className={dynastyTheme.classes.text.neutralLight}>
            {loading ? (
              'Loading players...'
            ) : totalCount > 0 ? (
              <>
                Showing {players.length} {activeTab} {showAll ? '(all players)' : '(free agents only)'}
                {positionFilter !== 'all' && (
                  <span> at {positionFilter === 'MI' ? 'Middle Infield' : positionFilter === 'CI' ? 'Corner Infield' : positionFilter}</span>
                )}
                {searchTerm && (
                  <span className="ml-2">
                    matching "<span className={dynastyTheme.classes.text.primary}>{searchTerm}</span>"
                  </span>
                )}
                {bulkMode && selectionStats.hasSelections && (
                  <span className="ml-2 text-yellow-400">
                    ({selectionStats.count} selected)
                  </span>
                )}
              </>
            ) : (
              <>
                No {activeTab} found {showAll ? '(all players)' : '(free agents only)'}
                {positionFilter !== 'all' && (
                  <span> at {positionFilter === 'MI' ? 'Middle Infield' : positionFilter === 'CI' ? 'Corner Infield' : positionFilter}</span>
                )}
                {searchTerm && (
                  <span className="ml-2">
                    matching "<span className={dynastyTheme.classes.text.primary}>{searchTerm}</span>"
                  </span>
                )}
              </>
            )}
          </p>
          
          {/* Roster Capacity Indicator */}
          {renderCapacityIndicator()}
        </div>
      </div>
    </>
  );
};

export default SearchControls;