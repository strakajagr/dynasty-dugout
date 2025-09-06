// src/pages/league-dashboard/salary-contract/components/PriceEditor.js
import React from 'react';
import { Edit, Users, Search } from 'lucide-react';
import { dynastyTheme } from '../../../../services/colorService';
import { DynastyTable } from '../../../../services/tableService';
import { createPricePreviewColumns } from '../../../../services/tableService';

const PriceEditor = ({
  generatedPrices,
  customPrices,
  settings,
  viewMode,
  setViewMode,
  positionFilter,
  setPositionFilter,
  searchFilter,
  setSearchFilter,
  bulkEditMode,
  setBulkEditMode,
  selectedPlayers,
  setSelectedPlayers,
  setPriceAdjustmentModal,
  handleManualPriceChange,
  getFilteredPrices,
  positions,
  leagueId
}) => {

  const columns = createPricePreviewColumns({
    bulkEditMode,
    selectedPlayers,
    setSelectedPlayers,
    handleManualPriceChange,
    settings,
    viewMode,
    leagueId,
    getFilteredPrices
  });

  // Handle case where no prices exist yet
  if (!generatedPrices?.prices) {
    return null;
  }

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${dynastyTheme.components.heading.h3}`}>
            <Edit className="inline w-5 h-5 mr-2" />
            Player Price Editor
          </h3>
          
          {/* Bulk Edit Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setBulkEditMode(!bulkEditMode)}
              className={bulkEditMode 
                ? dynastyTheme.utils.getComponent('button', 'warning', 'sm')
                : dynastyTheme.utils.getComponent('button', 'secondary', 'sm')
              }
            >
              <Users className="w-4 h-4 mr-2" />
              {bulkEditMode ? 'Cancel Bulk Edit' : 'Bulk Edit'}
            </button>
            
            {bulkEditMode && selectedPlayers.size > 0 && (
              <button
                onClick={() => setPriceAdjustmentModal(true)}
                className={dynastyTheme.utils.getComponent('button', 'primary', 'sm')}
              >
                <Edit className="w-4 h-4 mr-2" />
                Adjust {selectedPlayers.size} Players
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex gap-4 mb-4">
          <div className="flex border rounded-lg">
            <button
              onClick={() => {
                setViewMode('hitters');
                setPositionFilter('all');
              }}
              className={`px-4 py-2 ${
                viewMode === 'hitters'
                  ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                  : dynastyTheme.utils.getComponent('button', 'ghost', 'sm')
              }`}
            >
              Hitters
            </button>
            <button
              onClick={() => {
                setViewMode('pitchers');
                setPositionFilter('all');
              }}
              className={`px-4 py-2 ${
                viewMode === 'pitchers'
                  ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                  : dynastyTheme.utils.getComponent('button', 'ghost', 'sm')
              }`}
            >
              Pitchers
            </button>
          </div>

          <div className="relative">
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className={`${dynastyTheme.components.input} pr-8`}
            >
              <option value="all">All Positions</option>
              {positions[viewMode].map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search players..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className={`${dynastyTheme.components.input} w-full pl-8`}
            />
            <Search className="w-4 h-4 absolute left-2 top-3 text-gray-400" />
          </div>
        </div>

        <div className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter} mb-4`}>
          <span className={dynastyTheme.classes.text.neutralLight}>
            Showing {getFilteredPrices().length} of {generatedPrices?.prices?.length || 0} players
          </span>
        </div>

        <DynastyTable
          data={getFilteredPrices()}
          columns={columns}
          maxHeight="500px"
          initialSort={{ key: 'salary', direction: 'desc' }}
        />
      </div>
    </div>
  );
};

export default PriceEditor;