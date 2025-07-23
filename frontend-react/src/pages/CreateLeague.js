// src/pages/CreateLeague.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, ChevronLeft, ChevronRight, Check, Settings, 
  Users, Trophy, Target, Calendar, DollarSign
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesAPI } from '../services/apiService';
import { dynastyColors, dynastyUtils } from '../services/colorService';

const CreateLeague = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    // Basic Info
    league_name: '',
    max_teams: 12,
    player_pool: 'all_mlb',
    
    // Scoring
    scoring_system: 'rotisserie_ytd',
    scoring_categories: {
      hitters: ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
      pitchers: ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
    },
    
    // Rosters
    max_players_total: 23,
    min_hitters: 13,
    max_pitchers: 10,
    min_pitchers: 10,
    position_requirements: {
      'C': { min: 1 },
      '1B': { min: 1 },
      '2B': { min: 1 },
      '3B': { min: 1 },
      'SS': { min: 1 },
      'OF': { min: 3 },
      'UTIL': { min: 1 }
    },
    
    // Financial
    use_salaries: true,
    salary_cap: 200,
    salary_floor: 0,
    use_contracts: true,
    max_contract_years: 5,
    
    // Advanced
    transaction_deadline: 'monday',
    use_waivers: false,
    season_start_date: '2025-03-28',
    season_end_date: '2025-09-28'
  });

  const steps = [
    { id: 1, title: 'Basic Info', icon: Crown, description: 'League name and basic settings' },
    { id: 2, title: 'Scoring', icon: Trophy, description: 'How teams earn points' },
    { id: 3, title: 'Rosters', icon: Users, description: 'Team structure and lineup rules' },
    { id: 4, title: 'Financial', icon: DollarSign, description: 'Salary caps and contracts' },
    { id: 5, title: 'Advanced', icon: Settings, description: 'Transaction rules and schedule' }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryChange = (type, categories) => {
    setFormData(prev => ({
      ...prev,
      scoring_categories: {
        ...prev.scoring_categories,
        [type]: categories
      }
    }));
  };

  const handlePositionChange = (position, field, value) => {
    setFormData(prev => ({
      ...prev,
      position_requirements: {
        ...prev.position_requirements,
        [position]: {
          ...prev.position_requirements[position],
          [field]: parseInt(value) || 0
        }
      }
    }));
  };

  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsCreating(true);
    
    try {
      console.log('Creating league with data:', formData);
      
      const response = await leaguesAPI.createLeague(formData);
      
      if (response.success) {
        console.log('League created successfully:', response);
        // Redirect to league welcome page
        navigate(`/leagues/${response.league_id}/welcome`);
      } else {
        throw new Error(response.message || 'Failed to create league');
      }
    } catch (error) {
      console.error('League creation error:', error);
      alert(`Failed to create league: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Basic Information</h2>
              <p className="text-gray-300">Let's start with the fundamentals of your league</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  League Name *
                </label>
                <input
                  type="text"
                  value={formData.league_name}
                  onChange={(e) => handleInputChange('league_name', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Enter your league name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maximum Teams
                </label>
                <select
                  value={formData.max_teams}
                  onChange={(e) => handleInputChange('max_teams', parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  {[8, 10, 12, 14, 16, 18, 20].map(num => (
                    <option key={num} value={num}>{num} teams</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Player Pool
                </label>
                <select
                  value={formData.player_pool}
                  onChange={(e) => handleInputChange('player_pool', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  <option value="all_mlb">All MLB Players</option>
                  <option value="american_national">AL & NL Only</option>
                  <option value="al_only">American League Only</option>
                  <option value="nl_only">National League Only</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Scoring System</h2>
              <p className="text-gray-300">Configure how teams compete and win</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Scoring Type
                </label>
                <select
                  value={formData.scoring_system}
                  onChange={(e) => handleInputChange('scoring_system', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  <option value="rotisserie_ytd">Rotisserie (Year-to-Date)</option>
                  <option value="points_h2h">Head-to-Head Points</option>
                  <option value="categories_h2h">Head-to-Head Categories</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Hitting Categories
                  </label>
                  <div className="space-y-2">
                    {['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'H', '2B', '3B', 'BB'].map(cat => (
                      <label key={cat} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={formData.scoring_categories.hitters.includes(cat)}
                          onChange={(e) => {
                            const current = formData.scoring_categories.hitters;
                            if (e.target.checked) {
                              handleCategoryChange('hitters', [...current, cat]);
                            } else {
                              handleCategoryChange('hitters', current.filter(c => c !== cat));
                            }
                          }}
                          className="rounded border-gray-700 text-yellow-500 focus:ring-yellow-500"
                        />
                        <span className="text-white">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Pitching Categories
                  </label>
                  <div className="space-y-2">
                    {['W', 'SV', 'SO', 'ERA', 'WHIP', 'QS', 'L', 'HD', 'IP', 'K/9'].map(cat => (
                      <label key={cat} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={formData.scoring_categories.pitchers.includes(cat)}
                          onChange={(e) => {
                            const current = formData.scoring_categories.pitchers;
                            if (e.target.checked) {
                              handleCategoryChange('pitchers', [...current, cat]);
                            } else {
                              handleCategoryChange('pitchers', current.filter(c => c !== cat));
                            }
                          }}
                          className="rounded border-gray-700 text-yellow-500 focus:ring-yellow-500"
                        />
                        <span className="text-white">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Roster Configuration</h2>
              <p className="text-gray-300">Define team structure and lineup requirements</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Roster Limits</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Total Players
                  </label>
                  <input
                    type="number"
                    value={formData.max_players_total}
                    onChange={(e) => handleInputChange('max_players_total', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="15"
                    max="40"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Minimum Hitters
                  </label>
                  <input
                    type="number"
                    value={formData.min_hitters}
                    onChange={(e) => handleInputChange('min_hitters', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="8"
                    max="25"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Pitchers
                  </label>
                  <input
                    type="number"
                    value={formData.max_pitchers}
                    onChange={(e) => handleInputChange('max_pitchers', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="5"
                    max="15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Minimum Pitchers
                  </label>
                  <input
                    type="number"
                    value={formData.min_pitchers}
                    onChange={(e) => handleInputChange('min_pitchers', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="5"
                    max="15"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Position Requirements</h3>
                
                {Object.entries(formData.position_requirements).map(([position, reqs]) => (
                  <div key={position} className="flex items-center space-x-4">
                    <div className="w-12 text-center">
                      <span className="text-sm font-medium text-gray-300">{position}</span>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">Minimum</label>
                      <input
                        type="number"
                        value={reqs.min}
                        onChange={(e) => handlePositionChange(position, 'min', e.target.value)}
                        className="w-full px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        min="0"
                        max="5"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Financial Settings</h2>
              <p className="text-gray-300">Configure salary caps and contract rules</p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="use_salaries"
                  checked={formData.use_salaries}
                  onChange={(e) => handleInputChange('use_salaries', e.target.checked)}
                  className="rounded border-gray-700 text-yellow-500 focus:ring-yellow-500"
                />
                <label htmlFor="use_salaries" className="text-white font-medium">
                  Do you keep track of player salaries?
                </label>
              </div>

              {formData.use_salaries && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Salary Cap ($)
                    </label>
                    <input
                      type="number"
                      value={formData.salary_cap}
                      onChange={(e) => handleInputChange('salary_cap', parseFloat(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      min="100"
                      max="1000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Salary Floor ($)
                    </label>
                    <input
                      type="number"
                      value={formData.salary_floor}
                      onChange={(e) => handleInputChange('salary_floor', parseFloat(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      min="0"
                      max="500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="use_contracts"
                  checked={formData.use_contracts}
                  onChange={(e) => handleInputChange('use_contracts', e.target.checked)}
                  className="rounded border-gray-700 text-yellow-500 focus:ring-yellow-500"
                />
                <label htmlFor="use_contracts" className="text-white font-medium">
                  Do you keep track of player contract years?
                </label>
              </div>

              {formData.use_contracts && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Contract Years
                  </label>
                  <select
                    value={formData.max_contract_years}
                    onChange={(e) => handleInputChange('max_contract_years', parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(years => (
                      <option key={years} value={years}>{years} year{years > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Advanced Settings</h2>
              <p className="text-gray-300">Fine-tune your league's operation</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Transaction Deadline
                </label>
                <select
                  value={formData.transaction_deadline}
                  onChange={(e) => handleInputChange('transaction_deadline', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="none">No deadline</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="use_waivers"
                  checked={formData.use_waivers}
                  onChange={(e) => handleInputChange('use_waivers', e.target.checked)}
                  className="rounded border-gray-700 text-yellow-500 focus:ring-yellow-500"
                />
                <label htmlFor="use_waivers" className="text-white font-medium">
                  Do you use waivers? (Otherwise free agent pool only)
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Season Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.season_start_date}
                    onChange={(e) => handleInputChange('season_start_date', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Season End Date
                  </label>
                  <input
                    type="date"
                    value={formData.season_end_date}
                    onChange={(e) => handleInputChange('season_end_date', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </button>
              <div className="w-px h-6 bg-gray-600"></div>
              <h1 className="text-xl font-bold text-white flex items-center space-x-2">
                <Crown className="w-6 h-6 text-yellow-400" />
                <span>Create New League</span>
              </h1>
            </div>
            <div className="text-sm text-gray-400">
              Step {currentStep} of 5
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-12">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex flex-col items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  step.id === currentStep 
                    ? 'bg-yellow-500 border-yellow-500 text-white' 
                    : step.id < currentStep 
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-400'
                }`}>
                  {step.id < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className={`text-sm font-medium ${
                    step.id <= currentStep ? 'text-white' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${
                  step.id < currentStep ? 'bg-green-500' : 'bg-gray-600'
                }`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
              currentStep === 1
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {currentStep === 5 ? (
            <button
              onClick={handleSubmit}
              disabled={isCreating || !formData.league_name}
              className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-medium transition-all ${
                isCreating || !formData.league_name
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:from-yellow-600 hover:to-yellow-700'
              }`}
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating League...</span>
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  <span>Create League</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg font-medium hover:from-yellow-600 hover:to-yellow-700 transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateLeague;