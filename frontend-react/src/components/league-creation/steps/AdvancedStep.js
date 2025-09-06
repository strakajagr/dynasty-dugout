// src/components/league-creation/steps/AdvancedStep.js
import React from 'react';
import { Settings, Calendar } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';

const AdvancedStep = ({ 
  formData, 
  onInputChange, 
  error 
}) => {
  const transactionDeadlines = [
    { value: 'none', label: 'No deadline', description: 'Trades and pickups allowed anytime' },
    { value: 'monday', label: 'Monday', description: 'Must complete by Monday each week' },
    { value: 'tuesday', label: 'Tuesday', description: 'Must complete by Tuesday each week' },
    { value: 'wednesday', label: 'Wednesday', description: 'Must complete by Wednesday each week' },
    { value: 'thursday', label: 'Thursday', description: 'Must complete by Thursday each week' },
    { value: 'friday', label: 'Friday', description: 'Must complete by Friday each week' },
    { value: 'saturday', label: 'Saturday', description: 'Must complete by Saturday each week' },
    { value: 'sunday', label: 'Sunday', description: 'Must complete by Sunday each week' }
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
          <Settings className={dynastyTheme.classes.text.white} style={{ width: '2rem', height: '2rem' }} />
        </div>
        <h2 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white}`} 
            style={{ fontSize: dynastyTheme.tokens.fontSize['2xl'], marginTop: dynastyTheme.tokens.spacing.md }}>
          Advanced Settings
        </h2>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Fine-tune your league's operation and schedule
        </p>
      </div>

      <div>
        {/* Transaction Deadline */}
        <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
            Transaction Deadline
          </label>
          <select
            value={formData.transaction_deadline}
            onChange={(e) => onInputChange('transaction_deadline', e.target.value)}
            className={`${dynastyTheme.components.input} w-full`}
          >
            {transactionDeadlines.map(deadline => (
              <option key={deadline.value} value={deadline.value}>
                {deadline.label}
              </option>
            ))}
          </select>
          <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-1`}>
            {transactionDeadlines.find(d => d.value === formData.transaction_deadline)?.description}
          </p>
        </div>

        {/* Waivers Toggle */}
        <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <div className="flex items-center" style={{ gap: dynastyTheme.tokens.spacing.sm }}>
            <input
              type="checkbox"
              id="use_waivers"
              checked={formData.use_waivers}
              onChange={(e) => onInputChange('use_waivers', e.target.checked)}
              className={dynastyTheme.classes.border.neutral}
              style={{ 
                accentColor: dynastyTheme.tokens.colors.primary,
                borderRadius: dynastyTheme.tokens.radius.sm
              }}
            />
            <label htmlFor="use_waivers" className={`${dynastyTheme.classes.text.white} font-medium`}>
              Use waiver system for player acquisitions?
            </label>
          </div>
          <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-2 ml-6`}>
            When disabled, all free agents are immediately available for pickup
          </p>
          
          {formData.use_waivers && (
            <div 
              className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg mt-3`}
            >
              <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-2`}>
                Waiver System Details
              </h4>
              <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1`}>
                <p>• Claims processed daily at specified time</p>
                <p>• Waiver priority based on reverse standings</p>
                <p>• Successful claims move team to back of waiver order</p>
                <p>• FAAB (Free Agent Acquisition Budget) if salaries enabled</p>
              </div>
            </div>
          )}
        </div>

        {/* Season Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: dynastyTheme.tokens.spacing.lg, marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <div>
            <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
              <Calendar className="inline w-4 h-4 mr-2" />
              Season Start Date
            </label>
            <input
              type="date"
              value={formData.season_start_date}
              onChange={(e) => onInputChange('season_start_date', e.target.value)}
              className={`${dynastyTheme.components.input} w-full`}
            />
            <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-1`}>
              When stats start counting toward league standings
            </p>
          </div>

          <div>
            <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
              <Calendar className="inline w-4 h-4 mr-2" />
              Season End Date
            </label>
            <input
              type="date"
              value={formData.season_end_date}
              onChange={(e) => onInputChange('season_end_date', e.target.value)}
              className={`${dynastyTheme.components.input} w-full`}
            />
            <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-1`}>
              When final standings are calculated
            </p>
            {error && error.includes('Season end') && (
              <p className={`${dynastyTheme.classes.text.error} text-sm mt-1`}>{error}</p>
            )}
          </div>
        </div>

        {/* League Configuration Summary */}
        <div 
          className={`${dynastyTheme.classes.bg.darkLighter} p-6 rounded-lg`}
          style={{ marginTop: dynastyTheme.tokens.spacing.xl }}
        >
          <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-4`}>
            Final League Configuration
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className={`${dynastyTheme.classes.text.primary} font-medium mb-2`}>Basic Setup</h5>
              <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1`}>
                <p>• <strong>Name:</strong> {formData.league_name || 'Not set'}</p>
                <p>• <strong>Teams:</strong> {formData.max_teams}</p>
                <p>• <strong>Scoring:</strong> Rotisserie</p>
                <p>• <strong>Categories:</strong> {formData.scoring_categories.hitters.length} hitting, {formData.scoring_categories.pitchers.length} pitching</p>
              </div>
            </div>
            
            <div>
              <h5 className={`${dynastyTheme.classes.text.primary} font-medium mb-2`}>Financial</h5>
              <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1`}>
                <p>• <strong>Salaries:</strong> {formData.use_salaries ? 'Enabled' : 'Disabled'}</p>
                {formData.use_salaries && (
                  <>
                    <p>• <strong>System:</strong> {formData.use_dual_cap ? 'Dual Cap' : 'Single Cap'}</p>
                    {formData.use_dual_cap ? (
                      <p>• <strong>Caps:</strong> ${formData.draft_cap} draft + ${formData.season_cap} season</p>
                    ) : (
                      <p>• <strong>Cap:</strong> ${formData.salary_cap}</p>
                    )}
                  </>
                )}
                <p>• <strong>Contracts:</strong> {formData.use_contracts ? `${formData.standard_contract_length} year default` : 'Disabled'}</p>
              </div>
            </div>
            
            <div>
              <h5 className={`${dynastyTheme.classes.text.primary} font-medium mb-2`}>Roster Structure</h5>
              <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1`}>
                <p>• <strong>Active:</strong> {Object.values(formData.position_requirements).reduce((sum, pos) => sum + pos.slots, 0)} slots</p>
                <p>• <strong>Bench:</strong> {formData.bench_slots}</p>
                {formData.dl_slots > 0 && <p>• <strong>DL:</strong> {formData.dl_slots}</p>}
                {formData.minor_league_slots > 0 && <p>• <strong>Minors:</strong> {formData.minor_league_slots}</p>}
                <p>• <strong>Total:</strong> {Object.values(formData.position_requirements).reduce((sum, pos) => sum + pos.slots, 0) + formData.bench_slots + formData.dl_slots + formData.minor_league_slots} players per team</p>
              </div>
            </div>
            
            <div>
              <h5 className={`${dynastyTheme.classes.text.primary} font-medium mb-2`}>Operations</h5>
              <div className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1`}>
                <p>• <strong>Waivers:</strong> {formData.use_waivers ? 'Enabled' : 'Free agent pool only'}</p>
                <p>• <strong>Deadline:</strong> {transactionDeadlines.find(d => d.value === formData.transaction_deadline)?.label}</p>
                <p>• <strong>Season:</strong> {formData.season_start_date} to {formData.season_end_date}</p>
              </div>
            </div>
          </div>
          
          <div 
            className={`${dynastyTheme.classes.bg.primary}/10 border ${dynastyTheme.classes.border.primary}/30 p-3 rounded-lg mt-4`}
          >
            <p className={`${dynastyTheme.classes.text.primary} text-sm font-medium text-center`}>
              🎯 Ready to create your Dynasty league! This will take 1-2 minutes to process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedStep;