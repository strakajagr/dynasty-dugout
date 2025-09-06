// src/components/league-creation/steps/ScoringStep.js
import React from 'react';
import { Trophy } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';

const ScoringStep = ({ 
  formData, 
  onInputChange, 
  onCategoryChange, 
  error 
}) => {
  const getCurrentCategories = (type) => {
    return formData.scoring_categories[type];
  };

  const hittingCategories = [
    { id: 'R', name: 'Runs', description: 'Total runs scored' },
    { id: 'HR', name: 'Home Runs', description: 'Total home runs hit' },
    { id: 'RBI', name: 'RBI', description: 'Runs batted in' },
    { id: 'SB', name: 'Stolen Bases', description: 'Successful stolen bases' },
    { id: 'AVG', name: 'Batting Average', description: 'Hits divided by at-bats' },
    { id: 'OPS', name: 'OPS', description: 'On-base plus slugging percentage' },
    { id: 'H', name: 'Hits', description: 'Total hits' },
    { id: '2B', name: 'Doubles', description: 'Two-base hits' },
    { id: '3B', name: 'Triples', description: 'Three-base hits' },
    { id: 'BB', name: 'Walks', description: 'Base on balls' }
  ];

  const pitchingCategories = [
    { id: 'W', name: 'Wins', description: 'Pitching wins' },
    { id: 'SV', name: 'Saves', description: 'Save opportunities converted' },
    { id: 'SO', name: 'Strikeouts', description: 'Batters struck out' },
    { id: 'ERA', name: 'ERA', description: 'Earned run average' },
    { id: 'WHIP', name: 'WHIP', description: 'Walks + hits per inning pitched' },
    { id: 'QS', name: 'Quality Starts', description: '6+ innings, 3 or fewer runs' },
    { id: 'L', name: 'Losses', description: 'Pitching losses' },
    { id: 'HD', name: 'Holds', description: 'Relief holds' },
    { id: 'IP', name: 'Innings Pitched', description: 'Total innings pitched' },
    { id: 'K/9', name: 'K/9', description: 'Strikeouts per 9 innings' }
  ];

  return (
    <div style={{ marginBottom: dynastyTheme.tokens.spacing['2xl'] }}>
      {/* Step Header */}
      <div className="text-center" style={{ marginBottom: dynastyTheme.tokens.spacing.xl }}>
        <div 
          className={`flex items-center justify-center mx-auto ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.shadow.primary}`}
          style={{ 
            width: '4rem', 
            height: '4rem',
            borderRadius: dynastyTheme.tokens.radius.lg
          }}
        >
          <Trophy className={dynastyTheme.classes.text.white} style={{ width: '2rem', height: '2rem' }} />
        </div>
        <h2 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white}`} 
            style={{ fontSize: dynastyTheme.tokens.fontSize['2xl'], marginTop: dynastyTheme.tokens.spacing.md }}>
          Scoring System
        </h2>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Configure how teams compete and win
        </p>
      </div>

      <div>
        {/* Scoring Type */}
        <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
            Scoring Type
          </label>
          <select
            value={formData.scoring_system}
            onChange={(e) => onInputChange('scoring_system', e.target.value)}
            className={`${dynastyTheme.components.input} w-full`}
          >
            <option value="rotisserie_ytd">Rotisserie (Year-to-Date)</option>
            <option value="points_h2h" disabled className={dynastyTheme.classes.text.neutralLight}>
              Head-to-Head Points (Coming Soon)
            </option>
            <option value="categories_h2h" disabled className={dynastyTheme.classes.text.neutralLight}>
              Head-to-Head Categories (Coming Soon)
            </option>
            <option value="total_points" disabled className={dynastyTheme.classes.text.neutralLight}>
              Total Points (Coming Soon)
            </option>
          </select>
          <p className={dynastyTheme.classes.text.neutralLight} 
             style={{ fontSize: dynastyTheme.tokens.fontSize.sm, marginTop: dynastyTheme.tokens.spacing.sm }}>
            Only Rotisserie is available for now. Other scoring systems coming soon!
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: dynastyTheme.tokens.spacing.lg }}>
          {/* Hitting Categories */}
          <div>
            <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
              Hitting Categories
            </label>
            {error && error.includes('hitting category') && (
              <p className={`${dynastyTheme.classes.text.error} text-sm mb-2`}>
                {error}
              </p>
            )}
            <div className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg max-h-64 overflow-y-auto`}>
              {hittingCategories.map(cat => (
                <label key={cat.id} className="flex items-start space-y-1 mb-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={getCurrentCategories('hitters').includes(cat.id)}
                    onChange={(e) => {
                      const current = getCurrentCategories('hitters');
                      if (e.target.checked) {
                        onCategoryChange('hitters', [...current, cat.id]);
                      } else {
                        onCategoryChange('hitters', current.filter(c => c !== cat.id));
                      }
                    }}
                    className="mt-1 mr-3"
                    style={{ 
                      accentColor: dynastyTheme.tokens.colors.primary,
                      borderRadius: dynastyTheme.tokens.radius.sm
                    }}
                  />
                  <div className="flex-1">
                    <div className={`${dynastyTheme.classes.text.white} font-medium text-sm`}>
                      {cat.name}
                    </div>
                    <div className={`${dynastyTheme.classes.text.neutralLight} text-xs`}>
                      {cat.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <p className={`${dynastyTheme.classes.text.neutralLight} text-xs mt-2`}>
              Selected: {getCurrentCategories('hitters').length} categories
            </p>
          </div>

          {/* Pitching Categories */}
          <div>
            <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
              Pitching Categories
            </label>
            {error && error.includes('pitching category') && (
              <p className={`${dynastyTheme.classes.text.error} text-sm mb-2`}>
                {error}
              </p>
            )}
            <div className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg max-h-64 overflow-y-auto`}>
              {pitchingCategories.map(cat => (
                <label key={cat.id} className="flex items-start space-y-1 mb-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={getCurrentCategories('pitchers').includes(cat.id)}
                    onChange={(e) => {
                      const current = getCurrentCategories('pitchers');
                      if (e.target.checked) {
                        onCategoryChange('pitchers', [...current, cat.id]);
                      } else {
                        onCategoryChange('pitchers', current.filter(c => c !== cat.id));
                      }
                    }}
                    className="mt-1 mr-3"
                    style={{ 
                      accentColor: dynastyTheme.tokens.colors.primary,
                      borderRadius: dynastyTheme.tokens.radius.sm
                    }}
                  />
                  <div className="flex-1">
                    <div className={`${dynastyTheme.classes.text.white} font-medium text-sm`}>
                      {cat.name}
                    </div>
                    <div className={`${dynastyTheme.classes.text.neutralLight} text-xs`}>
                      {cat.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <p className={`${dynastyTheme.classes.text.neutralLight} text-xs mt-2`}>
              Selected: {getCurrentCategories('pitchers').length} categories
            </p>
          </div>
        </div>

        {/* Rotisserie Explanation */}
        <div 
          className={`${dynastyTheme.classes.bg.primary}/10 border ${dynastyTheme.classes.border.primary}/30 mt-6`}
          style={{ 
            borderRadius: dynastyTheme.tokens.radius.md,
            padding: dynastyTheme.tokens.spacing.md
          }}
        >
          <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-2`}>
            How Rotisserie Scoring Works
          </h4>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1`}>
            <p>• Teams are ranked 1st to last in each statistical category</p>
            <p>• Points awarded based on ranking (12 teams = 12 pts for 1st, 1 pt for last)</p>
            <p>• Total points across all categories determines league standings</p>
            <p>• Rewards balanced team building across multiple stat categories</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoringStep;