// src/pages/LeagueWelcome.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Crown, Users, Upload, Camera, Check, ChevronLeft, 
  Star, Trophy, Target, ArrowRight 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';

const LeagueWelcome = () => {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Welcome, 2: Team Setup, 3: Success
  
  // Team setup form data
  const [teamData, setTeamData] = useState({
    team_name: '',
    manager_name: user?.given_name || user?.firstName || '',
    team_logo_url: '',
    team_colors: {
      primary: dynastyTheme.tokens.colors.primary,
      secondary: dynastyTheme.tokens.colors.neutral[900]
    },
    team_motto: ''
  });

  useEffect(() => {
    loadLeague();
  }, [leagueId]);

  const loadLeague = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await leaguesAPI.getLeagueDetails(leagueId);
      
      if (response.success) {
        setLeague(response.league);
      } else {
        throw new Error(response.message || 'Failed to load league');
      }
    } catch (error) {
      console.error('Error loading league:', error);
      setError('Failed to load league details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setTeamData(prev => ({ ...prev, [field]: value }));
  };

  const handleTeamSetup = async () => {
    try {
      setSubmitting(true);
      setError('');

      if (!teamData.team_name.trim()) {
        setError('Team name is required');
        return;
      }

      const teamSetupData = {
        team_name: teamData.team_name.trim(),
        manager_name: teamData.manager_name.trim(),
        team_logo_url: teamData.team_logo_url,
        team_colors: teamData.team_colors,
        team_motto: teamData.team_motto.trim()
      };

      console.log('Setting up team:', teamSetupData);
      
      const response = await leaguesAPI.setupTeam(leagueId, teamSetupData);
      
      if (response.success) {
        setStep(3);
      } else {
        throw new Error(response.message || 'Failed to setup team');
      }
      
    } catch (error) {
      console.error('Team setup error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to setup team. Please try again.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const proceedToLeague = () => {
    navigate(`/leagues/${leagueId}`);
  };

  if (loading) {
    return (
      <div className={dynastyTheme.components.page}>
        <div className="flex justify-center items-center min-h-screen">
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 border-2 border-t-transparent animate-spin rounded-full"
              style={{ 
                borderColor: dynastyTheme.tokens.colors.primary, 
                borderTopColor: 'transparent' 
              }}
            />
            <span className={`${dynastyTheme.classes.text.white} text-lg`}>Loading league...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !league) {
    return (
      <div className={dynastyTheme.components.page}>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center space-y-4">
            <div 
              className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${dynastyTheme.classes.bg.error}`}
            >
              <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.white}`} />
            </div>
            <h2 className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>Unable to Load League</h2>
            <p className={`${dynastyTheme.classes.text.white} max-w-md`}>{error}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderWelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="space-y-4">
        <div 
          className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center ${dynastyTheme.classes.bg.success}`}
        >
          <Check className={`w-12 h-12 ${dynastyTheme.classes.text.white}`} />
        </div>
        
        <h1 className={dynastyTheme.components.heading.h1}>
          League Created Successfully!
        </h1>
        
        <p className={`text-xl ${dynastyTheme.classes.text.neutralLight} max-w-2xl mx-auto`}>
          Your dynasty league <span className={`${dynastyTheme.classes.text.primary} font-semibold`}>
            "{league?.league_name}"
          </span> is ready. Now let's setup your team to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
        <div className={`${dynastyTheme.components.card.base} p-6 text-center`}>
          <Users className={`w-8 h-8 mx-auto mb-3 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white} mb-2`}>Setup Your Team</h3>
          <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
            Choose your team name, colors, and manager details
          </p>
        </div>
        
        <div className={`${dynastyTheme.components.card.base} p-6 text-center`}>
          <Crown className={`w-8 h-8 mx-auto mb-3 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white} mb-2`}>Invite Managers</h3>
          <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
            Send invitations to other managers to join your league
          </p>
        </div>
        
        <div className={`${dynastyTheme.components.card.base} p-6 text-center`}>
          <Trophy className={`w-8 h-8 mx-auto mb-3 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white} mb-2`}>Start Playing</h3>
          <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
            Draft players and begin your dynasty baseball journey
          </p>
        </div>
      </div>

      <button
        onClick={() => setStep(2)}
        className={`${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} flex items-center space-x-3 mx-auto`}
      >
        <Users className="w-5 h-5" />
        <span>Setup Your Team</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );

  const renderTeamSetupStep = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <Crown className={`w-16 h-16 mx-auto ${dynastyTheme.classes.text.primary}`} />
        <h1 className={dynastyTheme.components.heading.h1}>Setup Your Team</h1>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Customize your team identity in <span className={dynastyTheme.classes.text.primary}>
            {league?.league_name}
          </span>
        </p>
      </div>

      <div className={`${dynastyTheme.components.card.base} p-8 space-y-6`}>
        {/* Team Name */}
        <div>
          <label className={dynastyTheme.components.label}>
            Team Name *
          </label>
          <input
            type="text"
            value={teamData.team_name}
            onChange={(e) => handleInputChange('team_name', e.target.value)}
            placeholder="e.g., Dynasty Dragons, Baseball Legends, Championship Chasers"
            className={`${dynastyTheme.components.input} w-full text-lg`}
            maxLength={50}
          />
          <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
            Choose a memorable name that represents your team
          </p>
        </div>

        {/* Manager Name */}
        <div>
          <label className={dynastyTheme.components.label}>
            Manager Name
          </label>
          <input
            type="text"
            value={teamData.manager_name}
            onChange={(e) => handleInputChange('manager_name', e.target.value)}
            placeholder="Your name as team manager"
            className={`${dynastyTheme.components.input} w-full`}
            maxLength={50}
          />
        </div>

        {/* Team Logo Upload */}
        <div>
          <label className={dynastyTheme.components.label}>
            Team Logo (Optional)
          </label>
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center ${dynastyTheme.classes.transition} hover:border-yellow-400/50`}
            style={{ borderColor: dynastyTheme.tokens.colors.neutral[600] }}
          >
            {teamData.team_logo_url ? (
              <div className="space-y-3">
                <img 
                  src={teamData.team_logo_url} 
                  alt="Team logo" 
                  className="w-16 h-16 mx-auto rounded-lg object-cover"
                />
                <p className={`text-sm ${dynastyTheme.classes.text.white}`}>Logo uploaded</p>
                <button 
                  onClick={() => handleInputChange('team_logo_url', '')}
                  className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Camera className={`w-12 h-12 mx-auto ${dynastyTheme.classes.text.neutralLight}`} />
                <div>
                  <p className={`${dynastyTheme.classes.text.white} font-medium`}>Upload team logo</p>
                  <p className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>PNG, JPG up to 2MB</p>
                </div>
                <button 
                  className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} flex items-center space-x-2 mx-auto`}
                  onClick={() => {
                    console.log('File upload would go here');
                  }}
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose File</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Team Colors */}
        <div>
          <label className={dynastyTheme.components.label}>
            Team Colors
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-2`}>Primary Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={teamData.team_colors.primary}
                  onChange={(e) => handleInputChange('team_colors', {
                    ...teamData.team_colors,
                    primary: e.target.value
                  })}
                  className="w-12 h-10 rounded border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={teamData.team_colors.primary}
                  onChange={(e) => handleInputChange('team_colors', {
                    ...teamData.team_colors,
                    primary: e.target.value
                  })}
                  className={`${dynastyTheme.components.input} flex-1 font-mono text-sm`}
                />
              </div>
            </div>
            <div>
              <label className={`block text-xs ${dynastyTheme.classes.text.neutralLight} mb-2`}>Secondary Color</label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={teamData.team_colors.secondary}
                  onChange={(e) => handleInputChange('team_colors', {
                    ...teamData.team_colors,
                    secondary: e.target.value
                  })}
                  className="w-12 h-10 rounded border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={teamData.team_colors.secondary}
                  onChange={(e) => handleInputChange('team_colors', {
                    ...teamData.team_colors,
                    secondary: e.target.value
                  })}
                  className={`${dynastyTheme.components.input} flex-1 font-mono text-sm`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Team Motto */}
        <div>
          <label className={dynastyTheme.components.label}>
            Team Motto (Optional)
          </label>
          <input
            type="text"
            value={teamData.team_motto}
            onChange={(e) => handleInputChange('team_motto', e.target.value)}
            placeholder="e.g., Champions are made here, Dynasty starts now"
            className={`${dynastyTheme.components.input} w-full`}
            maxLength={100}
          />
          <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
            A motivational phrase or slogan for your team
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`${dynastyTheme.components.badge.error} p-4 rounded-lg mb-4`}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6">
          <button
            onClick={() => setStep(1)}
            className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex items-center space-x-2`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            onClick={handleTeamSetup}
            disabled={submitting || !teamData.team_name.trim()}
            className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} flex items-center space-x-2 disabled:opacity-50`}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                <span>Setting up team...</span>
              </>
            ) : (
              <>
                <Target className="w-4 h-4" />
                <span>Create Team</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-8">
      <div className="space-y-4">
        <div 
          className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center ${dynastyTheme.classes.bg.success}`}
        >
          <Star className={`w-12 h-12 ${dynastyTheme.classes.text.white}`} />
        </div>
        
        <h1 className={dynastyTheme.components.heading.h1}>
          Team Setup Complete!
        </h1>
        
        <p className={`text-xl ${dynastyTheme.classes.text.neutralLight} max-w-2xl mx-auto`}>
          <span className={`${dynastyTheme.classes.text.primary} font-semibold`}>
            {teamData.team_name}
          </span> is ready to dominate in {league?.league_name}
        </p>
      </div>

      {/* Team Summary Card */}
      <div className={`${dynastyTheme.components.card.highlighted} p-8 max-w-md mx-auto`}>
        <div className="text-center space-y-4">
          <div 
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl font-bold"
            style={{ 
              backgroundColor: teamData.team_colors.primary,
              color: teamData.team_colors.secondary 
            }}
          >
            {teamData.team_name.charAt(0).toUpperCase()}
          </div>
          
          <div>
            <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>{teamData.team_name}</h3>
            <p className={dynastyTheme.classes.text.neutralLight}>Manager: {teamData.manager_name}</p>
            {teamData.team_motto && (
              <p className={`text-sm italic mt-2 ${dynastyTheme.classes.text.primary}`}>
                "{teamData.team_motto}"
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={proceedToLeague}
          className={`${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} flex items-center space-x-3 mx-auto`}
        >
          <Crown className="w-5 h-5" />
          <span>Enter League Dashboard</span>
          <ArrowRight className="w-5 h-5" />
        </button>
        
        <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
          You can customize your team details anytime from the league settings
        </p>
      </div>
    </div>
  );

  return (
    <div className={dynastyTheme.components.page}>
      {/* Header */}
      <header 
        className={`px-6 py-4 border-b ${dynastyTheme.classes.border.light}`}
        style={{ background: dynastyTheme.utils.gradient('dark') }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
            <div>
              <h1 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Dynasty Dugout</h1>
              <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>League Setup</p>
            </div>
          </div>
          
          {/* Progress Indicator */}
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((stepNum) => (
              <div
                key={stepNum}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: step === stepNum 
                    ? dynastyTheme.tokens.colors.primary 
                    : step > stepNum 
                    ? dynastyTheme.tokens.colors.success 
                    : dynastyTheme.tokens.colors.neutral[600],
                  color: step === stepNum 
                    ? dynastyTheme.tokens.colors.neutral[900]
                    : dynastyTheme.tokens.colors.neutral[50]
                }}
              >
                {step > stepNum ? <Check className="w-4 h-4" /> : stepNum}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={dynastyTheme.components.container}>
        {step === 1 && renderWelcomeStep()}
        {step === 2 && renderTeamSetupStep()}
        {step === 3 && renderSuccessStep()}
      </main>
    </div>
  );
};

export default LeagueWelcome;