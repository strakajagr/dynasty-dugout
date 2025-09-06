// src/pages/league-dashboard/salary-contract/components/BulkPriceAdjustmentModal.js
import React from 'react';
import { dynastyTheme } from '../../../../services/colorService';
import { AdaptiveSalaryEngine } from '../../../../services/adaptiveSalaryEngine';

const BulkPriceAdjustmentModal = ({
  selectedPlayers,
  generatedPrices,
  setGeneratedPrices,
  settings,
  setSelectedPlayers,
  setBulkEditMode,
  setPriceAdjustmentModal
}) => {

  const handleBulkPriceAdjustment = (adjustmentType, adjustmentValue) => {
    if (selectedPlayers.size === 0) {
      alert('No players selected');
      return;
    }
    
    const prices = [...(generatedPrices?.prices || [])];
    const updatedPrices = prices.map(player => {
      if (selectedPlayers.has(player.player_id)) {
        let newSalary = player.salary;
        
        if (adjustmentType === 'percentage') {
          newSalary = player.salary * (1 + adjustmentValue / 100);
        } else if (adjustmentType === 'fixed') {
          newSalary = player.salary + adjustmentValue;
        } else if (adjustmentType === 'set') {
          newSalary = adjustmentValue;
        }
        
        newSalary = Math.round(newSalary / settings.salary_increment) * settings.salary_increment;
        newSalary = Math.max(settings.min_salary, newSalary);
        
        return {
          ...player,
          salary: newSalary,
          manual_price: newSalary,
          original_salary: player.original_salary || player.salary
        };
      }
      return player;
    });
    
    setGeneratedPrices({
      ...generatedPrices,
      prices: updatedPrices
    });
    
    setSelectedPlayers(new Set());
    setBulkEditMode(false);
    setPriceAdjustmentModal(false);
    
    const engine = new AdaptiveSalaryEngine(settings);
    const newSummary = engine.generateSummary(updatedPrices);
    setGeneratedPrices(prev => ({
      ...prev,
      summary: newSummary
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className={`${dynastyTheme.components.card.base} p-6 max-w-md w-full`}>
        <h3 className={dynastyTheme.components.heading.h3}>
          Bulk Price Adjustment
        </h3>
        <p className={`${dynastyTheme.classes.text.neutralLight} mb-4`}>
          Adjusting {selectedPlayers.size} selected players
        </p>
        
        <div className="space-y-4">
          <div>
            <label className={dynastyTheme.components.label}>Adjustment Type</label>
            <select 
              id="adjustmentType"
              className={dynastyTheme.components.input}
            >
              <option value="percentage">Percentage Change</option>
              <option value="fixed">Fixed Amount</option>
              <option value="set">Set to Value</option>
            </select>
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>Value</label>
            <input
              type="number"
              id="adjustmentValue"
              className={dynastyTheme.components.input}
              placeholder="Enter value"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                const type = document.getElementById('adjustmentType').value;
                const value = parseFloat(document.getElementById('adjustmentValue').value);
                if (!isNaN(value)) {
                  handleBulkPriceAdjustment(type, value);
                }
              }}
              className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
            >
              Apply
            </button>
            <button
              onClick={() => setPriceAdjustmentModal(false)}
              className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkPriceAdjustmentModal;