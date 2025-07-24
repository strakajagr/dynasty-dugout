// src/pages/CreateLeague.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, ChevronLeft, ChevronRight, Check, Settings, 
  Users, Trophy, Target, Calendar, DollarSign, Database,
  CheckCircle, Clock, Loader, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';

// Enhanced Loading Dialog Component with Real-Time Status Updates
const DatabaseCreationDialog = ({ isVisible, statusData, onClose }) => {
  const [timeElapsed, setTimeElapsed] = useState(0);

  const stages = [
    { id: 'initialization', title: 'Preparing league creation...', description: 'Setting up infrastructure', duration: 10 },
    { id: 'database_creation', title: 'Creating league database...', description: 'Setting up your dedicated database', duration: 20 },
    { id: 'schema_configuration', title: 'Configuring database schema...', description: 'Creating tables and relationships', duration: 15 },
    { id: 'player_loading', title: 'Loading MLB player pool...', description: 'Adding 5,000+ active players', duration: 60 },
    { id: 'finalization', title: 'Finalizing league setup...', description: 'Completing configuration', duration: 15 }
  ];

  useEffect(() => {
    if (!isVisible) {
      setTimeElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible]);

  // Calculate current stage based on backend status
  const getCurrentStageIndex = () => {
    if (!statusData || !statusData.stage) return 0;
    return stages.findIndex(stage => stage.id === statusData.stage) || 0;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  const currentStageIndex = getCurrentStageIndex();
  const progress = statusData?.progress || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" style={{ padding: dynastyTheme.tokens.spacing.md }}>
      <div className={`${dynastyTheme.components.card.base} border ${dynastyTheme.classes.border.primary} max-w-md w-full`} 
           style={{ 
             borderRadius: dynastyTheme.tokens.radius.lg,
             padding: dynastyTheme.tokens.spacing['2xl']
           }}>
        {/* Header */}
        <div className="text-center" style={{ marginBottom: dynastyTheme.tokens.spacing['2xl'] }}>
          <div 
            className={`flex items-center justify-center mx-auto ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.shadow.primary}`}
            style={{ 
              width: '4rem', 
              height: '4rem',
              borderRadius: dynastyTheme.tokens.radius.lg,
              marginBottom: dynastyTheme.tokens.spacing.md 
            }}
          >
            {statusData?.status === 'failed' ? (
              <AlertCircle className={`${dynastyTheme.classes.text.error} animate-pulse`} style={{ width: '2rem', height: '2rem' }} />
            ) : (
              <Database className={`${dynastyTheme.classes.text.black} animate-pulse`} style={{ width: '2rem', height: '2rem' }} />
            )}
          </div>
          <h2 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white}`} 
              style={{ fontSize: dynastyTheme.tokens.fontSize['2xl'], marginBottom: dynastyTheme.tokens.spacing.sm }}>
            {statusData?.status === 'failed' ? 'Creation Failed' : 'Creating Your League'}
          </h2>
          <p className={`${dynastyTheme.classes.text.neutralLight}`} 
             style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
            {statusData?.status === 'failed' 
              ? 'Something went wrong during creation' 
              : 'Please be patient, this process takes 1-2 minutes'
            }
          </p>
          <div className={`${dynastyTheme.classes.text.primary} font-mono`} 
               style={{ fontSize: dynastyTheme.tokens.fontSize.lg, marginTop: dynastyTheme.tokens.spacing.sm }}>
            {formatTime(statusData?.elapsed_seconds || timeElapsed)}
          </div>
        </div>

        {/* Error Display */}
        {statusData?.status === 'failed' && (
          <div className={`${dynastyTheme.classes.bg.error}/20 border ${dynastyTheme.classes.border.error}`}
               style={{ 
                 borderRadius: dynastyTheme.tokens.radius.md,
                 padding: dynastyTheme.tokens.spacing.md,
                 marginBottom: dynastyTheme.tokens.spacing.lg
               }}>
            <p className={`${dynastyTheme.classes.text.error}`} style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
              {statusData.message || statusData.error || 'An unknown error occurred'}
            </p>
            <button
              onClick={onClose}
              className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
              style={{ marginTop: dynastyTheme.tokens.spacing.sm }}
            >
              Close
            </button>
          </div>
        )}

        {/* Progress Stages */}
        {statusData?.status !== 'failed' && (
          <>
            <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
              {stages.map((stage, index) => {
                const isCompleted = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const isPending = index > currentStageIndex;

                return (
                  <div key={stage.id} className="flex items-start" 
                       style={{ marginBottom: dynastyTheme.tokens.spacing.md }}>
                    <div className={`flex-shrink-0 flex items-center justify-center border-2 ${dynastyTheme.classes.transition} ${
                      isCompleted 
                        ? `${dynastyTheme.classes.bg.success} ${dynastyTheme.classes.border.success}` 
                        : isCurrent 
                        ? `${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.border.primary}` 
                        : `${dynastyTheme.classes.bg.neutral} ${dynastyTheme.classes.border.neutral}`
                    }`}
                    style={{ 
                      width: '1.5rem', 
                      height: '1.5rem',
                      borderRadius: dynastyTheme.tokens.radius.full,
                      marginRight: dynastyTheme.tokens.spacing.sm
                    }}>
                      {isCompleted ? (
                        <CheckCircle className={dynastyTheme.classes.text.white} style={{ width: '1rem', height: '1rem' }} />
                      ) : isCurrent ? (
                        <Loader className={`${dynastyTheme.classes.text.black} animate-spin`} style={{ width: '1rem', height: '1rem' }} />
                      ) : (
                        <Clock className={dynastyTheme.classes.text.neutralLight} style={{ width: '1rem', height: '1rem' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${
                        isCompleted || isCurrent ? dynastyTheme.classes.text.white : dynastyTheme.classes.text.neutralLight
                      }`} style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
                        {stage.title}
                      </p>
                      <p className={dynastyTheme.classes.text.neutralLight} 
                         style={{ fontSize: dynastyTheme.tokens.fontSize.xs, marginTop: '0.25rem' }}>
                        {stage.description}
                      </p>
                      {isCurrent && (
                        <div className={`${dynastyTheme.classes.bg.neutral} overflow-hidden`}
                             style={{ 
                               width: '100%', 
                               height: '0.25rem',
                               borderRadius: dynastyTheme.tokens.radius.full,
                               marginTop: dynastyTheme.tokens.spacing.sm
                             }}>
                          <div 
                            className={`h-full ${dynastyTheme.classes.bg.primary} transition-all duration-1000 ease-out`}
                            style={{ width: `${Math.min(100, progress)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status Message from Backend */}
            {statusData?.message && (
              <div className={`${dynastyTheme.classes.bg.primary}/10 border ${dynastyTheme.classes.border.primary}/30`}
                   style={{ 
                     borderRadius: dynastyTheme.tokens.radius.md,
                     padding: dynastyTheme.tokens.spacing.sm,
                     marginBottom: dynastyTheme.tokens.spacing.md
                   }}>
                <p className={`${dynastyTheme.classes.text.primary} font-medium`} 
                   style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
                  {statusData.message}
                </p>
                {statusData.players_added && (
                  <p className={dynastyTheme.classes.text.neutralLight} 
                     style={{ fontSize: dynastyTheme.tokens.fontSize.xs, marginTop: '0.25rem' }}>
                    {statusData.players_added} players added to league
                  </p>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className={`${dynastyTheme.classes.bg.primary}/10 border ${dynastyTheme.classes.border.primary}/30`}
                 style={{ 
                   borderRadius: dynastyTheme.tokens.radius.md,
                   padding: dynastyTheme.tokens.spacing.md
                 }}>
              <div className={`${dynastyTheme.classes.text.neutralLight} leading-relaxed`} 
                   style={{ fontSize: dynastyTheme.tokens.fontSize.xs }}>
                <p style={{ marginBottom: dynastyTheme.tokens.spacing.sm }}>
                  <strong className={dynastyTheme.classes.text.white}>What's happening:</strong> We're creating a dedicated PostgreSQL database just for your league with 5,000+ MLB players.
                </p>
                <p>
                  <strong className={dynastyTheme.classes.text.white}>Why it takes time:</strong> Each league gets its own isolated database to ensure maximum performance and data integrity.
                </p>
              </div>
            </div>

            {/* Warning - don't close */}
            <div className="text-center" style={{ marginTop: dynastyTheme.tokens.spacing.lg }}>
              <p className={dynastyTheme.classes.text.neutralLight} style={{ fontSize: dynastyTheme.tokens.fontSize.xs }}>
                ⚠️ Please don't close this window or navigate away
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const CreateLeague = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [creationStatus, setCreationStatus] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  
  const [formData, setFormData] = useState({
    // Basic Info
    league_name: '',
    max_teams: 12,
    player_pool: 'american_national', // AL + NL only (default for now)
    include_minor_leagues: false, // Minor leagues toggle
    
    // Scoring - For rotisserie, no weights needed
    scoring_system: 'rotisserie_ytd',
    scoring_categories: {
      hitters: ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'], // Simple arrays for rotisserie
      pitchers: ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
    },
    
    // Rosters
    max_players_total: 23,
    min_hitters: 13,
    max_pitchers: 10,
    min_pitchers: 10,
    position_requirements: {
      'C': { slots: 2 },
      '1B': { slots: 1 },
      '2B': { slots: 1 },
      '3B': { slots: 1 },
      'SS': { slots: 1 },
      'OF': { slots: 4 },
      'MI': { slots: 1 }, // Middle Infield (2B or SS)
      'CI': { slots: 1 }, // Corner Infield (1B or 3B)
      'UTIL': { slots: 1 },
      'P': { slots: 10 }
    },
    
    // Financial
    use_salaries: true,
    salary_cap: 200.0,
    salary_floor: 0.0,
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

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(''); // Clear errors when user makes changes
  };

  const handleCategoryChange = (type, categories) => {
    // For rotisserie - simple arrays, no weights
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

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.league_name || formData.league_name.length < 3) {
          setError('League name must be at least 3 characters long');
          return false;
        }
        break;
      case 2:
        if (formData.scoring_categories.hitters.length === 0) {
          setError('Please select at least one hitting category');
          return false;
        }
        if (formData.scoring_categories.pitchers.length === 0) {
          setError('Please select at least one pitching category');
          return false;
        }
        if (formData.scoring_system !== 'rotisserie_ytd') {
          setError('Only Rotisserie scoring is currently supported');
          return false;
        }
        break;
      case 3:
        if (formData.max_players_total < 15 || formData.max_players_total > 40) {
          setError('Total players must be between 15 and 40');
          return false;
        }
        if (formData.min_hitters + formData.min_pitchers > formData.max_players_total) {
          setError('Minimum hitters + minimum pitchers cannot exceed total roster size');
          return false;
        }
        break;
      case 4:
        if (formData.use_salaries && formData.salary_cap <= formData.salary_floor) {
          setError('Salary cap must be greater than salary floor');
          return false;
        }
        break;
      case 5:
        if (formData.season_start_date && formData.season_end_date) {
          const startDate = new Date(formData.season_start_date);
          const endDate = new Date(formData.season_end_date);
          if (startDate >= endDate) {
            setError('Season end date must be after start date');
            return false;
          }
        }
        break;
    }
    setError('');
    return true;
  };

  const nextStep = () => {
    if (validateCurrentStep() && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(''); // Clear errors when going back
    }
  };

  // Status polling function
  const pollLeagueStatus = async (leagueId) => {
    try {
      const statusResponse = await leaguesAPI.checkLeagueCreationStatus(leagueId);
      
      if (statusResponse.success) {
        setCreationStatus(statusResponse);
        
        // Check if completed
        if (statusResponse.status === 'completed') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          
          // Small delay to show completion, then redirect
          setTimeout(() => {
            setIsCreating(false);
            navigate(`/leagues/${leagueId}/welcome`);
          }, 2000);
          
        } else if (statusResponse.status === 'failed') {
          // Creation failed
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          
          setError(statusResponse.message || statusResponse.error || 'League creation failed');
          setIsCreating(false);
        }
      }
    } catch (error) {
      console.error('Status polling error:', error);
      // Don't stop polling for network errors, just log them
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    setIsCreating(true);
    setError('');
    setCreationStatus({ status: 'initializing', progress: 5, message: 'Starting league creation...' });
    
    try {
      console.log('Creating league with data:', formData);
      
      // Start async league creation
      const response = await leaguesAPI.createLeague(formData);
      
      if (response.success && response.league_id) {
        console.log('League creation started:', response);
        
        // Start polling for status updates every 3 seconds
        const interval = setInterval(() => {
          pollLeagueStatus(response.league_id);
        }, 3000);
        
        setPollingInterval(interval);
        
        // Initial status poll
        pollLeagueStatus(response.league_id);
        
      } else {
        throw new Error(response.message || 'Failed to start league creation');
      }
    } catch (error) {
      console.error('League creation error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create league';
      setError(errorMessage);
      setIsCreating(false);
      setCreationStatus(null);
    }
  };

  const getCurrentCategories = (type) => {
    return formData.scoring_categories[type];
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div style={{ marginBottom: dynastyTheme.tokens.spacing['2xl'] }}>
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
              <p className={dynastyTheme.classes.text.neutralLight}>Let's start with the fundamentals of your league</p>
            </div>

            <div>
              <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
                <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                  League Name *
                </label>
                <input
                  type="text"
                  value={formData.league_name}
                  onChange={(e) => handleInputChange('league_name', e.target.value)}
                  className={`${dynastyTheme.components.input} w-full`}
                  placeholder="Enter your league name"
                  required
                />
              </div>

              <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
                <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                  Maximum Teams
                </label>
                <select
                  value={formData.max_teams}
                  onChange={(e) => handleInputChange('max_teams', parseInt(e.target.value))}
                  className={`${dynastyTheme.components.input} w-full`}
                >
                  {[8, 10, 12, 14, 16, 18, 20].map(num => (
                    <option key={num} value={num}>{num} teams</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
                <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                  Player Pool
                </label>
                <select
                  value={formData.player_pool}
                  onChange={(e) => handleInputChange('player_pool', e.target.value)}
                  className={`${dynastyTheme.components.input} w-full`}
                >
                  <option value="american_national">American & National Leagues</option>
                  <option value="all_mlb" disabled className={dynastyTheme.classes.text.neutralLight}>All MLB Players (Coming Soon)</option>
                  <option value="al_only" disabled className={dynastyTheme.classes.text.neutralLight}>American League Only (Coming Soon)</option>
                  <option value="nl_only" disabled className={dynastyTheme.classes.text.neutralLight}>National League Only (Coming Soon)</option>
                </select>
                <p className={dynastyTheme.classes.text.neutralLight} 
                   style={{ fontSize: dynastyTheme.tokens.fontSize.sm, marginTop: dynastyTheme.tokens.spacing.sm }}>
                  Choose which players will be available in your league
                </p>
              </div>

              <div className="flex items-center" style={{ gap: dynastyTheme.tokens.spacing.sm }}>
                <input
                  type="checkbox"
                  id="include_minor_leagues"
                  checked={formData.include_minor_leagues}
                  onChange={(e) => handleInputChange('include_minor_leagues', e.target.checked)}
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
            </div>
          </div>
        );

      case 2:
        return (
          <div style={{ marginBottom: dynastyTheme.tokens.spacing['2xl'] }}>
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
              <p className={dynastyTheme.classes.text.neutralLight}>Configure how teams compete and win</p>
            </div>

            <div>
              <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
                <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                  Scoring Type
                </label>
                <select
                  value={formData.scoring_system}
                  onChange={(e) => handleInputChange('scoring_system', e.target.value)}
                  className={`${dynastyTheme.components.input} w-full`}
                >
                  <option value="rotisserie_ytd">Rotisserie (Year-to-Date)</option>
                  <option value="points_h2h" disabled className={dynastyTheme.classes.text.neutralLight}>Head-to-Head Points (Coming Soon)</option>
                  <option value="categories_h2h" disabled className={dynastyTheme.classes.text.neutralLight}>Head-to-Head Categories (Coming Soon)</option>
                  <option value="total_points" disabled className={dynastyTheme.classes.text.neutralLight}>Total Points (Coming Soon)</option>
                </select>
                <p className={dynastyTheme.classes.text.neutralLight} 
                   style={{ fontSize: dynastyTheme.tokens.fontSize.sm, marginTop: dynastyTheme.tokens.spacing.sm }}>
                  Only Rotisserie is available for now. Other scoring systems coming soon!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: dynastyTheme.tokens.spacing.lg }}>
                <div>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Hitting Categories
                  </label>
                  <div style={{ gap: dynastyTheme.tokens.spacing.sm }}>
                    {['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'H', '2B', '3B', 'BB'].map(cat => (
                      <label key={cat} className="flex items-center" 
                             style={{ gap: dynastyTheme.tokens.spacing.sm, marginBottom: dynastyTheme.tokens.spacing.sm }}>
                        <input
                          type="checkbox"
                          checked={getCurrentCategories('hitters').includes(cat)}
                          onChange={(e) => {
                            const current = getCurrentCategories('hitters');
                            if (e.target.checked) {
                              handleCategoryChange('hitters', [...current, cat]);
                            } else {
                              handleCategoryChange('hitters', current.filter(c => c !== cat));
                            }
                          }}
                          className={dynastyTheme.classes.border.neutral}
                          style={{ 
                            accentColor: dynastyTheme.tokens.colors.primary,
                            borderRadius: dynastyTheme.tokens.radius.sm
                          }}
                        />
                        <span className={dynastyTheme.classes.text.white}>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Pitching Categories
                  </label>
                  <div style={{ gap: dynastyTheme.tokens.spacing.sm }}>
                    {['W', 'SV', 'SO', 'ERA', 'WHIP', 'QS', 'L', 'HD', 'IP', 'K/9'].map(cat => (
                      <label key={cat} className="flex items-center" 
                             style={{ gap: dynastyTheme.tokens.spacing.sm, marginBottom: dynastyTheme.tokens.spacing.sm }}>
                        <input
                          type="checkbox"
                          checked={getCurrentCategories('pitchers').includes(cat)}
                          onChange={(e) => {
                            const current = getCurrentCategories('pitchers');
                            if (e.target.checked) {
                              handleCategoryChange('pitchers', [...current, cat]);
                            } else {
                              handleCategoryChange('pitchers', current.filter(c => c !== cat));
                            }
                          }}
                          className={dynastyTheme.classes.border.neutral}
                          style={{ 
                            accentColor: dynastyTheme.tokens.colors.primary,
                            borderRadius: dynastyTheme.tokens.radius.sm
                          }}
                        />
                        <span className={dynastyTheme.classes.text.white}>{cat}</span>
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
          <div style={{ marginBottom: dynastyTheme.tokens.spacing['2xl'] }}>
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
              <p className={dynastyTheme.classes.text.neutralLight}>Define team structure and lineup requirements</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: dynastyTheme.tokens.spacing['2xl'] }}>
              <div>
                <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`} 
                    style={{ 
                      fontSize: dynastyTheme.tokens.fontSize.lg, 
                      marginBottom: dynastyTheme.tokens.spacing.md 
                    }}>
                  Roster Limits
                </h3>
                
                <div style={{ marginBottom: dynastyTheme.tokens.spacing.md }}>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Total Players
                  </label>
                  <input
                    type="number"
                    value={formData.max_players_total}
                    onChange={(e) => handleInputChange('max_players_total', parseInt(e.target.value))}
                    className={dynastyTheme.components.input}
                    min="15"
                    max="40"
                  />
                </div>

                <div style={{ marginBottom: dynastyTheme.tokens.spacing.md }}>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Minimum Hitters
                  </label>
                  <input
                    type="number"
                    value={formData.min_hitters}
                    onChange={(e) => handleInputChange('min_hitters', parseInt(e.target.value))}
                    className={dynastyTheme.components.input}
                    min="8"
                    max="25"
                  />
                </div>

                <div style={{ marginBottom: dynastyTheme.tokens.spacing.md }}>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Maximum Pitchers
                  </label>
                  <input
                    type="number"
                    value={formData.max_pitchers}
                    onChange={(e) => handleInputChange('max_pitchers', parseInt(e.target.value))}
                    className={dynastyTheme.components.input}
                    min="5"
                    max="15"
                  />
                </div>

                <div>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Minimum Pitchers
                  </label>
                  <input
                    type="number"
                    value={formData.min_pitchers}
                    onChange={(e) => handleInputChange('min_pitchers', parseInt(e.target.value))}
                    className={dynastyTheme.components.input}
                    min="5"
                    max="15"
                  />
                </div>
              </div>

              <div>
                <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`} 
                    style={{ 
                      fontSize: dynastyTheme.tokens.fontSize.lg, 
                      marginBottom: dynastyTheme.tokens.spacing.md 
                    }}>
                  Position Slots
                </h3>
                <p className={dynastyTheme.classes.text.neutralLight} 
                   style={{ 
                     fontSize: dynastyTheme.tokens.fontSize.sm, 
                     marginBottom: dynastyTheme.tokens.spacing.md 
                   }}>
                  These are available roster slots. Teams can have fewer players if desired.
                </p>
                
                {Object.entries(formData.position_requirements).map(([position, reqs]) => (
                  <div key={position} className="flex items-center" 
                       style={{ gap: dynastyTheme.tokens.spacing.md, marginBottom: dynastyTheme.tokens.spacing.sm }}>
                    <div className="text-center" style={{ width: '3rem' }}>
                      <span className={`font-medium ${dynastyTheme.classes.text.white}`} 
                            style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
                        {position}
                      </span>
                    </div>
                    <div className="flex-1">
                      <label className={`block ${dynastyTheme.classes.text.neutralLight}`} 
                             style={{ fontSize: dynastyTheme.tokens.fontSize.xs, marginBottom: '0.25rem' }}>
                        {position === 'MI' ? 'Middle Infield (2B/SS)' : 
                         position === 'CI' ? 'Corner Infield (1B/3B)' :
                         position === 'UTIL' ? 'Utility (Any Position)' :
                         position === 'P' ? 'Pitchers' : 'Slots'}
                      </label>
                      <input
                        type="number"
                        value={reqs.slots}
                        onChange={(e) => handlePositionChange(position, 'slots', e.target.value)}
                        className={dynastyTheme.components.input}
                        style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}
                        min="0"
                        max="15"
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
          <div style={{ marginBottom: dynastyTheme.tokens.spacing['2xl'] }}>
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
              <p className={dynastyTheme.classes.text.neutralLight}>Configure salary caps and contract rules</p>
            </div>

            <div>
              <div className="flex items-center" 
                   style={{ gap: dynastyTheme.tokens.spacing.sm, marginBottom: dynastyTheme.tokens.spacing.lg }}>
                <input
                  type="checkbox"
                  id="use_salaries"
                  checked={formData.use_salaries}
                  onChange={(e) => handleInputChange('use_salaries', e.target.checked)}
                  className={dynastyTheme.classes.border.neutral}
                  style={{ 
                    accentColor: dynastyTheme.tokens.colors.primary,
                    borderRadius: dynastyTheme.tokens.radius.sm
                  }}
                />
                <label htmlFor="use_salaries" className={`${dynastyTheme.classes.text.white} font-medium`}>
                  Do you keep track of player salaries?
                </label>
              </div>

              {formData.use_salaries && (
                <div className="grid grid-cols-1 md:grid-cols-2" 
                     style={{ gap: dynastyTheme.tokens.spacing.lg, marginBottom: dynastyTheme.tokens.spacing.lg }}>
                  <div>
                    <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                      Salary Cap ($)
                    </label>
                    <input
                      type="number"
                      value={formData.salary_cap}
                      onChange={(e) => handleInputChange('salary_cap', parseFloat(e.target.value))}
                      className={dynastyTheme.components.input}
                      min="100"
                      max="1000"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                      Salary Floor ($)
                    </label>
                    <input
                      type="number"
                      value={formData.salary_floor}
                      onChange={(e) => handleInputChange('salary_floor', parseFloat(e.target.value))}
                      className={dynastyTheme.components.input}
                      min="0"
                      max="500"
                      step="0.1"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center" 
                   style={{ gap: dynastyTheme.tokens.spacing.sm, marginBottom: dynastyTheme.tokens.spacing.lg }}>
                <input
                  type="checkbox"
                  id="use_contracts"
                  checked={formData.use_contracts}
                  onChange={(e) => handleInputChange('use_contracts', e.target.checked)}
                  className={dynastyTheme.classes.border.neutral}
                  style={{ 
                    accentColor: dynastyTheme.tokens.colors.primary,
                    borderRadius: dynastyTheme.tokens.radius.sm
                  }}
                />
                <label htmlFor="use_contracts" className={`${dynastyTheme.classes.text.white} font-medium`}>
                  Do you keep track of player contract years?
                </label>
              </div>

              {formData.use_contracts && (
                <div>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Maximum Contract Years
                  </label>
                  <select
                    value={formData.max_contract_years}
                    onChange={(e) => handleInputChange('max_contract_years', parseInt(e.target.value))}
                    className={dynastyTheme.components.input}
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
          <div style={{ marginBottom: dynastyTheme.tokens.spacing['2xl'] }}>
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
              <p className={dynastyTheme.classes.text.neutralLight}>Fine-tune your league's operation</p>
            </div>

            <div>
              <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
                <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                  Transaction Deadline
                </label>
                <select
                  value={formData.transaction_deadline}
                  onChange={(e) => handleInputChange('transaction_deadline', e.target.value)}
                  className={dynastyTheme.components.input}
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

              <div className="flex items-center" 
                   style={{ gap: dynastyTheme.tokens.spacing.sm, marginBottom: dynastyTheme.tokens.spacing.lg }}>
                <input
                  type="checkbox"
                  id="use_waivers"
                  checked={formData.use_waivers}
                  onChange={(e) => handleInputChange('use_waivers', e.target.checked)}
                  className={dynastyTheme.classes.border.neutral}
                  style={{ 
                    accentColor: dynastyTheme.tokens.colors.primary,
                    borderRadius: dynastyTheme.tokens.radius.sm
                  }}
                />
                <label htmlFor="use_waivers" className={`${dynastyTheme.classes.text.white} font-medium`}>
                  Do you use waivers? (Otherwise free agent pool only)
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: dynastyTheme.tokens.spacing.lg }}>
                <div>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Season Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.season_start_date}
                    onChange={(e) => handleInputChange('season_start_date', e.target.value)}
                    className={dynastyTheme.components.input}
                  />
                </div>

                <div>
                  <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white}`}>
                    Season End Date
                  </label>
                  <input
                    type="date"
                    value={formData.season_end_date}
                    onChange={(e) => handleInputChange('season_end_date', e.target.value)}
                    className={dynastyTheme.components.input}
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
    <div className={dynastyTheme.components.page}>
      {/* Enhanced Database Creation Dialog with Real Status */}
      <DatabaseCreationDialog 
        isVisible={isCreating} 
        statusData={creationStatus}
        onClose={() => {
          setIsCreating(false);
          setCreationStatus(null);
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        }} 
      />

      {/* Header */}
      <div className={`border-b ${dynastyTheme.components.card.base} ${dynastyTheme.classes.border.light}`}>
        <div className="max-w-4xl mx-auto" style={{ padding: `${dynastyTheme.tokens.spacing.md} ${dynastyTheme.tokens.spacing.lg}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: dynastyTheme.tokens.spacing.md }}>
              <button
                onClick={() => navigate('/dashboard')}
                className={`flex items-center ${dynastyTheme.classes.transition} ${dynastyTheme.classes.text.neutralLight} hover:text-white`}
                style={{ gap: dynastyTheme.tokens.spacing.sm }}
              >
                <ChevronLeft style={{ width: '1.25rem', height: '1.25rem' }} />
                <span>Back to Dashboard</span>
              </button>
              <div className={dynastyTheme.classes.bg.neutral} style={{ width: '1px', height: '1.5rem' }}></div>
              <h1 className={`font-bold ${dynastyTheme.classes.text.white} flex items-center`} 
                  style={{ fontSize: dynastyTheme.tokens.fontSize.xl, gap: dynastyTheme.tokens.spacing.sm }}>
                <Crown className={dynastyTheme.classes.text.primary} style={{ width: '1.5rem', height: '1.5rem' }} />
                <span>Create New League</span>
              </h1>
            </div>
            <div className={dynastyTheme.classes.text.neutralLight} style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
              Step {currentStep} of 5
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto" 
           style={{ padding: `${dynastyTheme.tokens.spacing['2xl']} ${dynastyTheme.tokens.spacing.lg}` }}>
        <div className="flex items-center justify-between" style={{ marginBottom: dynastyTheme.tokens.spacing['2xl'] }}>
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex flex-col items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}>
                <div 
                  className={`flex items-center justify-center border-2 font-semibold ${dynastyTheme.classes.transition} ${
                    step.id === currentStep 
                      ? `${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.border.primary} ${dynastyTheme.classes.text.black}`
                      : step.id < currentStep 
                      ? `${dynastyTheme.classes.bg.success} ${dynastyTheme.classes.border.success} ${dynastyTheme.classes.text.white}`
                      : `${dynastyTheme.classes.bg.neutral} ${dynastyTheme.classes.border.neutral} ${dynastyTheme.classes.text.neutralLight}`
                  }`}
                  style={{ 
                    width: '2.5rem', 
                    height: '2.5rem',
                    borderRadius: dynastyTheme.tokens.radius.full,
                    fontSize: dynastyTheme.tokens.fontSize.sm
                  }}
                >
                  {step.id < currentStep ? (
                    <Check style={{ width: '1.25rem', height: '1.25rem' }} />
                  ) : (
                    <step.icon style={{ width: '1.25rem', height: '1.25rem' }} />
                  )}
                </div>
                <div className="text-center" style={{ marginTop: dynastyTheme.tokens.spacing.sm }}>
                  <div 
                    className={`font-medium ${
                      step.id <= currentStep ? dynastyTheme.classes.text.white : dynastyTheme.classes.text.neutralLight
                    }`}
                    style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}
                  >
                    {step.title}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={`flex-1 ${
                    step.id < currentStep ? dynastyTheme.classes.bg.success : dynastyTheme.classes.bg.neutral
                  }`}
                  style={{ 
                    height: '1px', 
                    marginLeft: dynastyTheme.tokens.spacing.md,
                    marginRight: dynastyTheme.tokens.spacing.md
                  }}
                ></div>
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div 
            className={`${dynastyTheme.classes.bg.error}/20 border ${dynastyTheme.classes.border.error}`}
            style={{ 
              borderRadius: dynastyTheme.tokens.radius.md,
              padding: dynastyTheme.tokens.spacing.md,
              marginBottom: dynastyTheme.tokens.spacing.lg
            }}
          >
            <p className={dynastyTheme.classes.text.error} style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
              {error}
            </p>
          </div>
        )}

        {/* Step Content */}
        <div 
          className={`${dynastyTheme.components.card.base} border ${dynastyTheme.classes.border.neutral}`}
          style={{ 
            borderRadius: dynastyTheme.tokens.radius.lg,
            padding: dynastyTheme.tokens.spacing['2xl']
          }}
        >
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between" style={{ marginTop: dynastyTheme.tokens.spacing['2xl'] }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`${
              currentStep === 1 
                ? `${dynastyTheme.utils.getComponent('button', 'ghost', 'md')} opacity-50 cursor-not-allowed`
                : dynastyTheme.utils.getComponent('button', 'secondary', 'md')
            } flex items-center`}
            style={{ gap: dynastyTheme.tokens.spacing.sm }}
          >
            <ChevronLeft style={{ width: '1rem', height: '1rem' }} />
            <span>Previous</span>
          </button>

          {currentStep === 5 ? (
            <button
              onClick={handleSubmit}
              disabled={isCreating || !formData.league_name}
              className={`${
                isCreating || !formData.league_name 
                  ? `${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} opacity-50 cursor-not-allowed`
                  : dynastyTheme.utils.getComponent('button', 'primary', 'lg')
              } flex items-center`}
              style={{ gap: dynastyTheme.tokens.spacing.sm }}
            >
              {isCreating ? (
                <>
                  <Database className="animate-pulse" style={{ width: '1rem', height: '1rem' }} />
                  <span>Creating Database...</span>
                </>
              ) : (
                <>
                  <Crown style={{ width: '1rem', height: '1rem' }} />
                  <span>Create League</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={nextStep}
              className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} flex items-center`}
              style={{ gap: dynastyTheme.tokens.spacing.sm }}
            >
              <span>Next</span>
              <ChevronRight style={{ width: '1rem', height: '1rem' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateLeague;