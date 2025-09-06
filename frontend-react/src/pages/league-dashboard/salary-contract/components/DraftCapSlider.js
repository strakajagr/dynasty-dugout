// src/pages/league-dashboard/salary-contract/components/DraftCapSlider.js
import React from 'react';
import { Sliders } from 'lucide-react';
import { dynastyTheme } from '../../../../services/colorService';

const DraftCapSlider = ({ settings, setSettings }) => {
  return (
    <div className={dynastyTheme.components.card.highlighted}>
      <div className="p-6">
        <h3 className={`${dynastyTheme.components.heading.h3} mb-4`}>
          <Sliders className="inline w-5 h-5 mr-2" />
          Draft Cap Distribution
        </h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className={dynastyTheme.classes.text.white}>
                Target Draft Spending
              </label>
              <span className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
                {Math.round(settings.draft_cap_usage * 100)}%
              </span>
            </div>
            
            <div className="relative w-full h-3 rounded-lg overflow-hidden" style={{ backgroundColor: dynastyTheme.tokens.colors.neutral[700] }}>
              <div 
                className="absolute h-full rounded-lg transition-all duration-200"
                style={{
                  width: `${((settings.draft_cap_usage * 100 - 50) / 45) * 100}%`,
                  backgroundColor: dynastyTheme.tokens.colors.primary
                }}
              />
              
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={Math.round(settings.draft_cap_usage * 100)}
                onChange={(e) => setSettings({
                  ...settings,
                  draft_cap_usage: parseInt(e.target.value) / 100
                })}
                className="absolute w-full h-full opacity-0 cursor-pointer"
                style={{ 
                  zIndex: 10,
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none'
                }}
              />
              
              <div 
                className="absolute rounded-full border-2 shadow-lg transition-all duration-200 pointer-events-none"
                style={{
                  backgroundColor: dynastyTheme.tokens.colors.primary,
                  borderColor: dynastyTheme.tokens.colors.neutral[900],
                  width: '20px',
                  height: '20px',
                  left: `calc(${((settings.draft_cap_usage * 100 - 50) / 45) * 100}% - 10px)`,
                  top: '-4px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                }}
              />
            </div>
            
            <div className="flex justify-between text-xs mt-2">
              <span className={dynastyTheme.classes.text.neutralLight}>50% (Conservative)</span>
              <span className={dynastyTheme.classes.text.neutralLight}>75% (Balanced)</span>
              <span className={dynastyTheme.classes.text.neutralLight}>95% (Aggressive)</span>
            </div>
          </div>
          
          <div className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
            <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              With a ${settings.draft_cap} draft cap and {Math.round(settings.draft_cap_usage * 100)}% target spending:
            </p>
            <ul className={`text-sm ${dynastyTheme.classes.text.white} mt-2`}>
              <li>• Teams will spend ~${Math.round(settings.draft_cap * settings.draft_cap_usage)} on average</li>
              <li>• Leaving ~${Math.round(settings.draft_cap * (1 - settings.draft_cap_usage))} for in-season moves</li>
              <li>• Total FAAB: ${Math.round(settings.draft_cap * (1 - settings.draft_cap_usage)) + settings.season_cap}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftCapSlider;