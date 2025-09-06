// src/components/league-creation/steps/RosterStep.js
import React from 'react';
import { Users, Info } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';

const RosterStep = ({ 
  formData, 
  onInputChange, 
  onPositionChange, 
  error 
}) => {
  const positionInfo = {
    'C': { label: 'Catcher', description: 'Primary catcher position' },
    '1B': { label: '1st Base', description: 'First baseman' },
    '2B': { label: '2nd Base', description: 'Second baseman' },
    '3B': { label: '3rd Base', description: 'Third baseman' },
    'SS': { label: 'Shortstop', description: 'Shortstop position' },
    'OF': { label: 'Outfield', description: 'Any outfield position (LF, CF, RF)' },
    'MI': { label: 'Middle Infield', description: '2B or SS eligible' },
    'CI': { label: 'Corner Infield', description: '1B or 3B eligible' },
    'UTIL': { label: 'Utility', description: 'Any non-pitcher position' },
    'P': { label: 'Pitcher', description: 'Any pitcher (SP, RP)' }
  };

  // Calculate totals for validation
  const calculateActiveSlots = () => {
    return Object.values(formData.position_requirements).reduce((total, pos) => total + pos.slots, 0);
  };

  const activeSlots = calculateActiveSlots();
  const benchSlots = formData.bench_slots || 5;
  const dlSlots = formData.dl_slots || 0;
  const minorSlots = formData.minor_league_slots || 0;
  const totalSlots = activeSlots + benchSlots + dlSlots + minorSlots;

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
          <Users className={dynastyTheme.classes.text.white} style={{ width: '2rem', height: '2rem' }} />
        </div>
        <h2 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white}`} 
            style={{ fontSize: dynastyTheme.tokens.fontSize['2xl'], marginTop: dynastyTheme.tokens.spacing.md }}>
          Roster Configuration
        </h2>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Define team structure and lineup requirements - CRITICAL: This data powers MyRoster screen
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: dynastyTheme.tokens.spacing['2xl'] }}>
        {/* Left Column: Roster Limits */}
        <div>
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white} mb-4`} 
              style={{ fontSize: dynastyTheme.tokens.fontSize.lg }}>
            Roster Limits
          </h3>
          
          <div style={{ marginBottom: dynastyTheme.tokens.spacing.md }}>
            <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
              Total Players per Team
            </label>
            <input
              type="number"
              value={formData.max_players_total}
              onChange={(e) => onInputChange('max_players_total', parseInt(e.target.value))}
              className={`${dynastyTheme.components.input} w-full`}
              min="15"
              max="40"
            />
            {error && error.includes('Total players') && (
              <p className={`${dynastyTheme.classes.text.error} text-sm mt-1`}>{error}</p>
            )}
          </div>

          {/* Bench Slots - CRITICAL FOR MYROSTER */}
          <div style={{ marginBottom: dynastyTheme.tokens.spacing.md }}>
            <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
              Bench Slots
            </label>
            <input
              type="number"
              value={formData.bench_slots}
              onChange={(e) => onInputChange('bench_slots', parseInt(e.target.value))}
              className={`${dynastyTheme.components.input} w-full`}
              min="0"
              max="10"
            />
            <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-1`}>
              Players not in active lineup
            </p>
          </div>

          {/* DL Slots */}
          <div style={{ marginBottom: dynastyTheme.tokens.spacing.md }}>
            <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
              Disabled List Slots
            </label>
            <input
              type="number"
              value={formData.dl_slots}
              onChange={(e) => onInputChange('dl_slots', parseInt(e.target.value))}
              className={`${dynastyTheme.components.input} w-full`}
              min="0"
              max="5"
            />
            <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-1`}>
              For injured players (no salary impact)
            </p>
          </div>

          {/* Minor League Slots */}
          <div style={{ marginBottom: dynastyTheme.tokens.spacing.md }}>
            <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
              Minor League Slots
            </label>
            <input
              type="number"
              value={formData.minor_league_slots}
              onChange={(e) => onInputChange('minor_league_slots', parseInt(e.target.value))}
              className={`${dynastyTheme.components.input} w-full`}
              min="0"
              max="15"
            />
            <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-1`}>
              Prospects with no salary (dynasty leagues only)
            </p>
          </div>

          {/* Roster Summary */}
          <div 
            className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg`}
            style={{ marginTop: dynastyTheme.tokens.spacing.lg }}
          >
            <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-2`}>
              Roster Summary
            </h4>
            <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1`}>
              <div className="flex justify-between">
                <span>Active Lineup:</span>
                <span className={dynastyTheme.classes.text.primary}>{activeSlots}</span>
              </div>
              <div className="flex justify-between">
                <span>Bench:</span>
                <span>{benchSlots}</span>
              </div>
              {dlSlots > 0 && (
                <div className="flex justify-between">
                  <span>DL:</span>
                  <span>{dlSlots}</span>
                </div>
              )}
              {minorSlots > 0 && (
                <div className="flex justify-between">
                  <span>Minors:</span>
                  <span>{minorSlots}</span>
                </div>
              )}
              <div className={`flex justify-between pt-2 border-t ${dynastyTheme.classes.border.neutral}`}>
                <span className="font-semibold">Total:</span>
                <span className={`font-bold ${dynastyTheme.classes.text.primary}`}>{totalSlots}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Lineup Positions - CRITICAL FOR MYROSTER */}
        <div>
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white} mb-4`} 
              style={{ fontSize: dynastyTheme.tokens.fontSize.lg }}>
            Active Lineup Positions
          </h3>
          <div 
            className={`${dynastyTheme.classes.bg.primary}/10 border ${dynastyTheme.classes.border.primary}/30 p-3 rounded-lg mb-4`}
          >
            <div className="flex items-start gap-2">
              <Info className={`${dynastyTheme.classes.text.primary} mt-0.5`} style={{ width: '1rem', height: '1rem' }} />
              <p className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
                These positions will be dynamically generated on the MyRoster screen. 
                Each slot requires a player to fill that specific position.
              </p>
            </div>
          </div>
          
          {Object.entries(formData.position_requirements).map(([position, reqs]) => (
            <div key={position} className="flex items-center mb-3" style={{ gap: dynastyTheme.tokens.spacing.md }}>
              <div className="text-center" style={{ width: '4rem' }}>
                <span className={`font-bold ${dynastyTheme.classes.text.primary}`} 
                      style={{ fontSize: dynastyTheme.tokens.fontSize.lg }}>
                  {position}
                </span>
              </div>
              <div className="flex-1">
                <label className={`block ${dynastyTheme.classes.text.neutralLight}`} 
                       style={{ fontSize: dynastyTheme.tokens.fontSize.xs, marginBottom: '0.25rem' }}>
                  {positionInfo[position]?.label} - {positionInfo[position]?.description}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={reqs.slots}
                    onChange={(e) => onPositionChange(position, 'slots', e.target.value)}
                    className={`${dynastyTheme.components.input} w-20`}
                    style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}
                    min="0"
                    max="15"
                  />
                  <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
                    slot{reqs.slots !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Position Requirements Help */}
          <div 
            className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg`}
            style={{ marginTop: dynastyTheme.tokens.spacing.lg }}
          >
            <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-2`}>
              Position Eligibility Rules
            </h4>
            <div className={`${dynastyTheme.classes.text.neutralLight} text-xs space-y-1`}>
              <p>• <strong>MI:</strong> Player must be eligible at 2B or SS</p>
              <p>• <strong>CI:</strong> Player must be eligible at 1B or 3B</p>
              <p>• <strong>UTIL:</strong> Any non-pitcher position</p>
              <p>• <strong>OF:</strong> LF, CF, RF, or general OF eligible</p>
              <p>• <strong>P:</strong> Any pitcher (SP, RP, or general P)</p>
              <p className="pt-2 text-yellow-400">
                ⚠️ These settings control the MyRoster screen layout!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RosterStep;