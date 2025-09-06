// src/pages/league-dashboard/salary-contract/tabs/PreviewTab.js
import React, { useState } from 'react';
import { BarChart3, Edit, Users, Search, AlertCircle } from 'lucide-react';
import { dynastyTheme } from '../../../../services/colorService';
import { DynastyTable } from '../../../../services/tableService';
import PriceDistributionSummary from '../components/PriceDistributionSummary';
import PriceEditor from '../components/PriceEditor';
import { AdaptiveSalaryEngine } from '../../../../services/adaptiveSalaryEngine';

const PreviewTab = ({
  generatedPrices,
  setGeneratedPrices,
  customPrices,
  settings,
  league,
  leagueId,
  bulkEditMode,
  setBulkEditMode,
  selectedPlayers,
  setSelectedPlayers,
  setPriceAdjustmentModal
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [viewMode, setViewMode] = useState('hitters');

  const positions = {
    hitters: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'UTIL'],
    pitchers: ['SP', 'RP', 'CP', 'P']
  };

  const handleManualPriceChange = (playerId, newPrice) => {
    const prices = [...(generatedPrices?.prices || [])];
    const playerIndex = prices.findIndex(p => 
      p.player_id === playerId || p.mlb_player_id === playerId
    );
    
    if (playerIndex >= 0) {
      const price = parseFloat(newPrice);
      const rounded = Math.round(price / settings.salary_increment) * settings.salary_increment;
      const finalPrice = Math.max(settings.min_salary, rounded);
      
      if (!prices[playerIndex].original_salary) {
        prices[playerIndex].original_salary = prices[playerIndex].salary;
      }
      
      prices[playerIndex] = {
        ...prices[playerIndex],
        manual_price: finalPrice,
        salary: finalPrice
      };
      
      setGeneratedPrices({
        ...generatedPrices,
        prices: prices
      });
      
      const engine = new AdaptiveSalaryEngine(settings);
      const newSummary = engine.generateSummary(prices);
      setGeneratedPrices(prev => ({
        ...prev,
        summary: newSummary
      }));
    }
  };

  const getFilteredPrices = () => {
    if (!generatedPrices?.prices) return [];
    
    let filtered = generatedPrices.prices;
    
    const isPitcherPosition = (pos) => ['SP', 'RP', 'CP', 'P'].includes(pos);
    if (viewMode === 'hitters') {
      filtered = filtered.filter(p => !isPitcherPosition(p.position));
    } else {
      filtered = filtered.filter(p => isPitcherPosition(p.position));
    }
    
    if (positionFilter !== 'all') {
      filtered = filtered.filter(p => p.position === positionFilter);
    }
    
    if (searchFilter) {
      filtered = filtered.filter(p => 
        p.player_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.team?.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }
    
    return filtered;
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats with Charts */}
      {generatedPrices?.summary && (
        <PriceDistributionSummary 
          generatedPrices={generatedPrices}
          league={league}
          leagueId={leagueId}
        />
      )}

      {/* Player Price Table */}
      {generatedPrices?.prices && generatedPrices.prices.length > 0 ? (
        <PriceEditor
          generatedPrices={generatedPrices}
          customPrices={customPrices}
          settings={settings}
          viewMode={viewMode}
          setViewMode={setViewMode}
          positionFilter={positionFilter}
          setPositionFilter={setPositionFilter}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          bulkEditMode={bulkEditMode}
          setBulkEditMode={setBulkEditMode}
          selectedPlayers={selectedPlayers}
          setSelectedPlayers={setSelectedPlayers}
          setPriceAdjustmentModal={setPriceAdjustmentModal}
          handleManualPriceChange={handleManualPriceChange}
          getFilteredPrices={getFilteredPrices}
          positions={positions}
          leagueId={leagueId}
        />
      ) : (
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6 text-center py-12">
            <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLight}`} />
            <p className={dynastyTheme.classes.text.neutralLight}>
              No prices generated yet. Go to the Pricing tab to generate or upload prices.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewTab;