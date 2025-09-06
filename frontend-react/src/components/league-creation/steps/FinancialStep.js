// src/components/league-creation/steps/FinancialStep.js
import React from 'react';
import { DollarSign, Info } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';

const FinancialStep = ({ 
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
          <DollarSign className={dynastyTheme.classes.text.white} style={{ width: '2rem', height: '2rem' }} />
        </div>
        <h2 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white}`} 
            style={{ fontSize: dynastyTheme.tokens.fontSize['2xl'], marginTop: dynastyTheme.tokens.spacing.md }}>
          Financial Settings
        </h2>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Configure salary caps and contract rules
        </p>
      </div>

      <div>
        {/* Enable Salaries */}
        <div className="flex items-center" 
             style={{ gap: dynastyTheme.tokens.spacing.sm, marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <input
            type="checkbox"
            id="use_salaries"
            checked={formData.use_salaries}
            onChange={(e) => onInputChange('use_salaries', e.target.checked)}
            className={dynastyTheme.classes.border.neutral}
            style={{ 
              accentColor: dynastyTheme.tokens.colors.primary,
              borderRadius: dynastyTheme.tokens.radius.sm
            }}
          />
          <label htmlFor="use_salaries" className={`${dynastyTheme.classes.text.white} font-medium`}>
            Enable player salaries?
          </label>
        </div>

        {formData.use_salaries && (
          <>
            {/* Dual Cap System Toggle */}
            <div className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg mb-6`}>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.use_dual_cap}
                  onChange={(e) => onInputChange('use_dual_cap', e.target.checked)}
                  className="w-5 h-5"
                  style={{ 
                    accentColor: dynastyTheme.tokens.colors.primary
                  }}
                />
                <span className={dynastyTheme.classes.text.white}>
                  Use Dual Cap System (Draft Cap + Season Cap)
                </span>
              </label>
              <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-2 ml-8`}>
                When enabled, teams have separate budgets for draft and in-season acquisitions
              </p>
            </div>

            {/* Cap Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2" 
                 style={{ gap: dynastyTheme.tokens.spacing.lg, marginBottom: dynastyTheme.tokens.spacing.lg }}>
              {formData.use_dual_cap ? (
                <>
                  <div>
                    <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                      Draft Cap ($)
                    </label>
                    <input
                      type="number"
                      value={formData.draft_cap}
                      onChange={(e) => onInputChange('draft_cap', parseInt(e.target.value) || 0)}
                      className={`${dynastyTheme.components.input} w-full`}
                      min="100"
                      max="2000"
                    />
                    <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
                      Maximum spend on draft day
                    </p>
                    {error && error.includes('Draft cap') && (
                      <p className={`${dynastyTheme.classes.text.error} text-sm mt-1`}>{error}</p>
                    )}
                  </div>

                  <div>
                    <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                      Season Cap ($)
                    </label>
                    <input
                      type="number"
                      value={formData.season_cap}
                      onChange={(e) => onInputChange('season_cap', parseInt(e.target.value) || 0)}
                      className={`${dynastyTheme.components.input} w-full`}
                      min="0"
                      max="500"
                    />
                    <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
                      Additional budget for in-season moves (FAAB)
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Total Salary Cap ($)
                  </label>
                  <input
                    type="number"
                    value={formData.salary_cap}
                    onChange={(e) => onInputChange('salary_cap', parseInt(e.target.value) || 0)}
                    className={`${dynastyTheme.components.input} w-full`}
                    min="100"
                    max="2000"
                  />
                  <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
                    Total cap for entire season
                  </p>
                </div>
              )}
            </div>

            {/* Salary Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2" 
                 style={{ gap: dynastyTheme.tokens.spacing.lg, marginBottom: dynastyTheme.tokens.spacing.lg }}>
              <div>
                <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                  Minimum Salary ($)
                </label>
                <input
                  type="number"
                  value={formData.min_salary}
                  onChange={(e) => onInputChange('min_salary', parseInt(e.target.value) || 1)}
                  className={`${dynastyTheme.components.input} w-full`}
                  min="1"
                  max="50"
                />
                <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
                  Lowest possible player salary
                </p>
              </div>

              <div>
                <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                  Salary Increment ($)
                </label>
                <input
                  type="number"
                  value={formData.salary_increment}
                  onChange={(e) => onInputChange('salary_increment', parseInt(e.target.value) || 1)}
                  className={`${dynastyTheme.components.input} w-full`}
                  min="1"
                  max="10"
                />
                <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
                  Prices rounded to this increment
                </p>
              </div>

              <div>
                <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                  Rookie Price ($)
                </label>
                <input
                  type="number"
                  value={formData.rookie_price}
                  onChange={(e) => onInputChange('rookie_price', parseInt(e.target.value) || 10)}
                  className={`${dynastyTheme.components.input} w-full`}
                  min="1"
                  max="100"
                />
                <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
                  Default salary for rookie/minor league players
                </p>
              </div>

              <div>
                <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                  Draft Cap Usage Target (%)
                </label>
                <input
                  type="number"
                  value={Math.round(formData.draft_cap_usage * 100)}
                  onChange={(e) => onInputChange('draft_cap_usage', parseInt(e.target.value) / 100 || 0.75)}
                  className={`${dynastyTheme.components.input} w-full`}
                  min="50"
                  max="95"
                />
                <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
                  Teams typically spend this % at draft (for pricing algorithm)
                </p>
              </div>
            </div>

            {/* Salary Cap Explanation */}
            {formData.use_dual_cap && (
              <div 
                className={`${dynastyTheme.classes.bg.primary}/10 border ${dynastyTheme.classes.border.primary}/30 mb-6`}
                style={{ 
                  borderRadius: dynastyTheme.tokens.radius.md,
                  padding: dynastyTheme.tokens.spacing.md
                }}
              >
                <div className="flex items-start gap-2">
                  <Info className={`${dynastyTheme.classes.text.primary} mt-0.5`} style={{ width: '1rem', height: '1rem' }} />
                  <div>
                    <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-2`}>
                      Dual Cap System Explained
                    </h4>
                    <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1`}>
                      <p>• <strong>Draft Cap:</strong> Maximum spend during auction draft (e.g., $600)</p>
                      <p>• <strong>Season Cap:</strong> Additional budget for in-season free agent pickups (e.g., $200)</p>
                      <p>• <strong>Total FAAB:</strong> Unspent draft money + season cap available for waivers</p>
                      <p>• <strong>Example:</strong> Spend $550 in draft → $50 + $200 = $250 FAAB remaining</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Contracts Section */}
        <div className="flex items-center" 
             style={{ gap: dynastyTheme.tokens.spacing.sm, marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <input
            type="checkbox"
            id="use_contracts"
            checked={formData.use_contracts}
            onChange={(e) => onInputChange('use_contracts', e.target.checked)}
            className={dynastyTheme.classes.border.neutral}
            style={{ 
              accentColor: dynastyTheme.tokens.colors.primary,
              borderRadius: dynastyTheme.tokens.radius.sm
            }}
          />
          <label htmlFor="use_contracts" className={`${dynastyTheme.classes.text.white} font-medium`}>
            Enable player contracts?
          </label>
        </div>

        {formData.use_contracts && (
          <div>
            <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
              Standard Contract Length (Years)
            </label>
            <select
              value={formData.standard_contract_length}
              onChange={(e) => onInputChange('standard_contract_length', parseInt(e.target.value))}
              className={`${dynastyTheme.components.input} w-full`}
            >
              {[1, 2, 3, 4, 5].map(years => (
                <option key={years} value={years}>{years} year{years > 1 ? 's' : ''}</option>
              ))}
            </select>
            <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
              Default contract length for new signings
            </p>
          </div>
        )}

        {/* Financial System Summary */}
        <div 
          className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg`}
          style={{ marginTop: dynastyTheme.tokens.spacing.xl }}
        >
          <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-3`}>
            Your Financial System
          </h4>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-2`}>
            <div className="flex justify-between">
              <span>Salaries Enabled:</span>
              <span className={formData.use_salaries ? dynastyTheme.classes.text.success : dynastyTheme.classes.text.error}>
                {formData.use_salaries ? 'Yes' : 'No'}
              </span>
            </div>
            
            {formData.use_salaries && (
              <>
                <div className="flex justify-between">
                  <span>Cap System:</span>
                  <span className={dynastyTheme.classes.text.primary}>
                    {formData.use_dual_cap ? 'Dual Cap' : 'Single Cap'}
                  </span>
                </div>
                
                {formData.use_dual_cap ? (
                  <>
                    <div className="flex justify-between">
                      <span>Draft Budget:</span>
                      <span>${formData.draft_cap}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Season Budget:</span>
                      <span>${formData.season_cap}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>Total Cap:</span>
                    <span>${formData.salary_cap}</span>
                  </div>
                )}
              </>
            )}
            
            <div className="flex justify-between">
              <span>Contracts Enabled:</span>
              <span className={formData.use_contracts ? dynastyTheme.classes.text.success : dynastyTheme.classes.text.error}>
                {formData.use_contracts ? `Yes (${formData.standard_contract_length} years)` : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialStep;