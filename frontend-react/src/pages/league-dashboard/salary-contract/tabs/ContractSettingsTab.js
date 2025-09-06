// src/pages/league-dashboard/salary-contract/tabs/ContractSettingsTab.js
import React from 'react';
import { Settings } from 'lucide-react';
import { dynastyTheme } from '../../../../services/colorService';

const ContractSettingsTab = ({ settings, setSettings, leagueStatus, defaultSettings }) => {
  
  // Provide fallbacks for all settings to prevent undefined values
  const safeSettings = {
    use_dual_cap: settings.use_dual_cap ?? defaultSettings?.use_dual_cap ?? true,
    draft_cap: settings.draft_cap ?? defaultSettings?.draft_cap ?? 600,
    season_cap: settings.season_cap ?? defaultSettings?.season_cap ?? 200,
    salary_cap: settings.salary_cap ?? defaultSettings?.salary_cap ?? 800,
    standard_contract_length: settings.standard_contract_length ?? defaultSettings?.standard_contract_length ?? 2,
    min_salary: settings.min_salary ?? defaultSettings?.min_salary ?? 2,
    salary_increment: settings.salary_increment ?? defaultSettings?.salary_increment ?? 2,
    rookie_price: settings.rookie_price ?? defaultSettings?.rookie_price ?? 20
  };

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className="p-6 space-y-6">
        <h2 className={dynastyTheme.components.heading.h2}>
          <Settings className="inline w-6 h-6 mr-2" />
          Contract & Cap Settings
        </h2>

        <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={safeSettings.use_dual_cap}
              onChange={(e) => setSettings({ ...settings, use_dual_cap: e.target.checked })}
              className="w-5 h-5"
              disabled={leagueStatus === 'active'}
            />
            <span className={dynastyTheme.classes.text.white}>
              Use Dual Cap System (Draft Cap + Season Cap)
            </span>
          </label>
          <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-2 ml-8`}>
            When enabled, unspent draft budget carries over as FAAB
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {safeSettings.use_dual_cap ? (
            <>
              <div>
                <label className={dynastyTheme.components.label}>Draft Cap ($)</label>
                <input
                  type="number"
                  value={safeSettings.draft_cap}
                  onChange={(e) => setSettings({
                    ...settings,
                    draft_cap: parseInt(e.target.value) || 0
                  })}
                  className={dynastyTheme.components.input}
                  disabled={leagueStatus === 'active'}
                />
              </div>
              <div>
                <label className={dynastyTheme.components.label}>Season Cap ($)</label>
                <input
                  type="number"
                  value={safeSettings.season_cap}
                  onChange={(e) => setSettings({
                    ...settings,
                    season_cap: parseInt(e.target.value) || 0
                  })}
                  className={dynastyTheme.components.input}
                  disabled={leagueStatus === 'active'}
                />
              </div>
            </>
          ) : (
            <div>
              <label className={dynastyTheme.components.label}>Total Salary Cap ($)</label>
              <input
                type="number"
                value={safeSettings.salary_cap}
                onChange={(e) => setSettings({
                  ...settings,
                  salary_cap: parseInt(e.target.value) || 0
                })}
                className={dynastyTheme.components.input}
                disabled={leagueStatus === 'active'}
              />
            </div>
          )}

          <div>
            <label className={dynastyTheme.components.label}>Standard Contract Length</label>
            <input
              type="number"
              min="1"
              max="5"
              value={safeSettings.standard_contract_length}
              onChange={(e) => setSettings({
                ...settings,
                standard_contract_length: parseInt(e.target.value) || 1
              })}
              className={dynastyTheme.components.input}
            />
          </div>

          <div>
            <label className={dynastyTheme.components.label}>Minimum Salary ($)</label>
            <input
              type="number"
              min="1"
              value={safeSettings.min_salary}
              onChange={(e) => setSettings({
                ...settings,
                min_salary: parseInt(e.target.value) || 1
              })}
              className={dynastyTheme.components.input}
            />
          </div>

          <div>
            <label className={dynastyTheme.components.label}>Salary Increment ($)</label>
            <input
              type="number"
              min="1"
              value={safeSettings.salary_increment}
              onChange={(e) => setSettings({
                ...settings,
                salary_increment: parseInt(e.target.value) || 1
              })}
              className={dynastyTheme.components.input}
            />
          </div>

          <div>
            <label className={dynastyTheme.components.label}>Rookie Price ($)</label>
            <input
              type="number"
              value={safeSettings.rookie_price}
              onChange={(e) => setSettings({
                ...settings,
                rookie_price: parseInt(e.target.value) || 1
              })}
              className={dynastyTheme.components.input}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractSettingsTab;