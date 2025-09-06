// src/components/league-creation/steps/BasicInfoStep.js
import React from 'react';
import { Crown } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';

const BasicInfoStep = ({ 
  formData, 
  onInputChange, 
  error 
}) => {
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
          <Crown className={dynastyTheme.classes.text.white} style={{ width: '2rem', height: '2rem' }} />
        </div>
        <h2 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white}`} 
            style={{ fontSize: dynastyTheme.tokens.fontSize['2xl'], marginTop: dynastyTheme.tokens.spacing.md }}>
          Basic Information
        </h2>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Let's start with the fundamentals of your league
        </p>
      </div>

      {/* Form Fields */}
      <div>
        {/* League Name */}
        <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
            League Name *
          </label>
          <input
            type="text"
            value={formData.league_name}
            onChange={(e) => onInputChange('league_name', e.target.value)}
            className={`${dynastyTheme.components.input} w-full`}
            placeholder="Enter your league name"
            required
          />
          {error && error.includes('League name') && (
            <p className={`${dynastyTheme.classes.text.error} text-sm mt-1`}>
              {error}
            </p>
          )}
        </div>

        {/* Maximum Teams */}
        <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
            Maximum Teams
          </label>
          <select
            value={formData.max_teams}
            onChange={(e) => onInputChange('max_teams', parseInt(e.target.value))}
            className={`${dynastyTheme.components.input} w-full`}
          >
            {[8, 10, 12, 14, 16, 18, 20].map(num => (
              <option key={num} value={num}>{num} teams</option>
            ))}
          </select>
          <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-1`}>
            Choose how many teams can join your league
          </p>
        </div>

        {/* Player Pool */}
        <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
            Player Pool
          </label>
          <select
            value={formData.player_pool}
            onChange={(e) => onInputChange('player_pool', e.target.value)}
            className={`${dynastyTheme.components.input} w-full`}
          >
            <option value="american_national">American & National Leagues</option>
            <option value="all_mlb" disabled className={dynastyTheme.classes.text.neutralLight}>
              All MLB Players (Coming Soon)
            </option>
            <option value="al_only" disabled className={dynastyTheme.classes.text.neutralLight}>
              American League Only (Coming Soon)
            </option>
            <option value="nl_only" disabled className={dynastyTheme.classes.text.neutralLight}>
              National League Only (Coming Soon)
            </option>
          </select>
          <p className={dynastyTheme.classes.text.neutralLight} 
             style={{ fontSize: dynastyTheme.tokens.fontSize.sm, marginTop: dynastyTheme.tokens.spacing.sm }}>
            Choose which players will be available in your league
          </p>
        </div>

        {/* Minor Leagues Toggle */}
        <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <div className="flex items-center" style={{ gap: dynastyTheme.tokens.spacing.sm }}>
            <input
              type="checkbox"
              id="include_minor_leagues"
              checked={formData.include_minor_leagues}
              onChange={(e) => onInputChange('include_minor_leagues', e.target.checked)}
              className={`${dynastyTheme.classes.border.neutral}`}
              style={{ 
                accentColor: dynastyTheme.tokens.colors.primary,
                borderRadius: dynastyTheme.tokens.radius.sm
              }}
            />
            <label htmlFor="include_minor_leagues" className={`${dynastyTheme.classes.text.white} font-medium`}>
              Include Minor Leagues?
            </label>
            <span className={dynastyTheme.classes.text.neutralLight} style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
              (Manual entry via draft)
            </span>
          </div>
          <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-2 ml-6`}>
            Enable this to allow manual entry of minor league players during the draft
          </p>
        </div>

        {/* League Type Info */}
        <div 
          className={`${dynastyTheme.classes.bg.primary}/10 border ${dynastyTheme.classes.border.primary}/30`}
          style={{ 
            borderRadius: dynastyTheme.tokens.radius.md,
            padding: dynastyTheme.tokens.spacing.md
          }}
        >
          <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-2`}>
            League Type: Dynasty
          </h4>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1`}>
            <p>• Multi-year player contracts with salary retention</p>
            <p>• Keeper league format with contract extensions</p>
            <p>• Long-term team building strategy required</p>
            <p>• Full season commitment with real MLB roster changes</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasicInfoStep;