// src/pages/league-dashboard/salary-contract/tabs/ExtensionsTab.js
import React from 'react';
import { TrendingUp, Plus, X } from 'lucide-react';
import { dynastyTheme } from '../../../../services/colorService';

const ExtensionsTab = ({ settings, setSettings, defaultSettings }) => {
  
  // ALWAYS ensure we have a valid array to work with
  const defaultExtensionRules = [
    { years: 1, cost_increase: 0, description: 'Same price, returns to draft pool' },
    { years: 2, cost_increase: 10, description: '+$10 to current salary' },
    { years: 3, cost_increase: 20, description: '+$20 to current salary' },
    { years: 4, cost_increase: 30, description: '+$30 to current salary' },
    { years: 5, cost_increase: 40, description: '+$40 to current salary' }
  ];
  
  // Multiple fallback levels to ensure we ALWAYS have an array
  let extensionRules = defaultExtensionRules; // Start with hardcoded default
  
  if (settings?.extension_rules && Array.isArray(settings.extension_rules) && settings.extension_rules.length > 0) {
    extensionRules = settings.extension_rules;
  } else if (defaultSettings?.extension_rules && Array.isArray(defaultSettings.extension_rules) && defaultSettings.extension_rules.length > 0) {
    extensionRules = defaultSettings.extension_rules;
  }
  
  console.log('ExtensionsTab - using extension rules:', extensionRules);
  
  const handleExtensionRuleChange = (index, field, value) => {
    const updatedRules = [...extensionRules];
    updatedRules[index][field] = field === 'years' || field === 'cost_increase' 
      ? parseInt(value) || 0 
      : value;
    setSettings({ ...settings, extension_rules: updatedRules });
  };

  const addExtensionRule = () => {
    const lastRule = extensionRules[extensionRules.length - 1];
    const newRule = {
      years: lastRule.years + 1,
      cost_increase: lastRule.cost_increase + 10,
      description: `+$${lastRule.cost_increase + 10} to current salary`
    };
    setSettings({
      ...settings,
      extension_rules: [...extensionRules, newRule]
    });
  };

  const removeExtensionRule = (index) => {
    if (extensionRules.length > 1) {
      const updatedRules = extensionRules.filter((_, i) => i !== index);
      setSettings({ ...settings, extension_rules: updatedRules });
    }
  };

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className={dynastyTheme.components.heading.h2}>
            <TrendingUp className="inline w-6 h-6 mr-2" />
            Contract Extension Rules
          </h2>
          <button
            onClick={addExtensionRule}
            className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Rule
          </button>
        </div>

        <div className="space-y-4">
          {extensionRules.map((rule, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border ${dynastyTheme.classes.border.neutral} ${dynastyTheme.classes.bg.darkLighter}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`${dynastyTheme.classes.text.primary} font-semibold`}>
                  Extension Option {index + 1}
                </h3>
                {extensionRules.length > 1 && (
                  <button
                    onClick={() => removeExtensionRule(index)}
                    className={`${dynastyTheme.classes.text.error} hover:text-red-400`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Years</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={rule.years || 1}
                    onChange={(e) => handleExtensionRuleChange(index, 'years', e.target.value)}
                    className={`${dynastyTheme.components.input} mt-1`}
                  />
                </div>
                <div>
                  <label className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Cost Increase ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={rule.cost_increase || 0}
                    onChange={(e) => handleExtensionRuleChange(index, 'cost_increase', e.target.value)}
                    className={`${dynastyTheme.components.input} mt-1`}
                  />
                </div>
                <div>
                  <label className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Description</label>
                  <input
                    type="text"
                    value={rule.description || ''}
                    onChange={(e) => handleExtensionRuleChange(index, 'description', e.target.value)}
                    className={`${dynastyTheme.components.input} mt-1`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExtensionsTab;