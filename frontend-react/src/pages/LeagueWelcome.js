// src/pages/LeagueWelcome.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Crown, Users, Upload, Camera, Check, ChevronLeft, 
  Star, Trophy, Target, ArrowRight 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesAPI } from '../services/apiService';
import { dynastyColors, dynastyUtils } from '../services/colorService';

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
      primary: dynastyColors.gold,
      secondary: dynastyColors.dark
    },
    team_motto: ''
  });

  useEffect(() => {
    loadLeague();
  }, [leagueId]);

  const loadLeague = async () => {
    try {
      setLoading(true);
      // We'll need to add this API call to get single league details
      // For now, using mock data based on league creation
      const mockLeague = {
        league_id: leagueId,
        league_name: "New League", // Will be replaced with actual data
        status: "setup",
        role: "commissioner"
      };
      setLeague(mockLeague);
    } catch (error) {
      console.error('Error loading league:', error);
      setError('Failed to load league details');
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

      // TODO: API call to create team
      const teamSetupData = {
        league_id: leagueId,
        team_name: teamData.team_name.trim(),
        manager_name: teamData.manager_name.trim(),
        team_logo_url: teamData.team_logo_url,
        team_colors: teamData.team_colors,
        team_motto: teamData.team_motto.trim()
      };

      console.log('Setting up team:', teamSetupData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStep(3); // Success step
      
    } catch (error) {
      console.error('Team setup error:', error);
      setError('Failed to setup team. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const proceedToLeague = () => {
    navigate(`/leagues/${leagueId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: dynastyUtils.getGradient('page') }}>
        <div className="flex justify-center items-center min-h-screen">
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 border-2 border-t-transparent animate-spin rounded-full"
              style={{ borderColor: dynastyColors.gold, borderTopColor: 'transparent' }}
            />
            <span className="text-white text-lg">Loading league...</span>
          </div>
        </div>
      </div>
    );
  }

  const renderWelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="space-y-4">
        <div 
          className="w-24 h-24 rounded-full mx-auto flex items-center justify-center"
          style={{ backgroundColor: dynastyColors.success }}
        >
          <Check className="w-12 h-12 text-white" />
        </div>
        
        <h1 className="text-4xl font-bold text-white">
          League Created Successfully!
        </h1>
        
        <p className="text-xl dynasty-text-secondary max-w-2xl mx-auto">
          Your dynasty league <span style={{ color: dynastyColors.gold }} className="font-semibold">
            "{league?.league_name}"
          </span> is ready. Now let's setup your team to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
        <div 
          className="dynasty-card p-6 text-center"
          style={{ background: dynastyUtils.getGradient('card') }}
        >
          <Users className="w-8 h-8 mx-auto mb-3" style={{ color: dynastyColors.gold }} />
          <h3 className="font-semibold text-white mb-2">Setup Your Team</h3>
          <p className="text-sm dynasty-text-secondary">
            Choose your team name, colors, and manager details
          </p>
        </div>
        
        <div 
          className="dynasty-card p-6 text-center"
          style={{ background: dynastyUtils.getGradient('card') }}
        >
          <Crown className="w-8 h-8 mx-auto mb-3" style={{ color: dynastyColors.gold }} />
          <h3 className="font-semibold text-white mb-2">Invite Managers</h3>
          <p className="text-sm dynasty-text-secondary">
            Send invitations to other managers to join your league
          </p>
        </div>
        
        <div 
          className="dynasty-card p-6 text-center"
          style={{ background: dynastyUtils.getGradient('card') }}
        >
          <Trophy className="w-8 h-8 mx-auto mb-3" style={{ color: dynastyColors.gold }} />
          <h3 className="font-semibold text-white mb-2">Start Playing</h3>
          <p className="text-sm dynasty-text-secondary">
            Draft players and begin your dynasty baseball journey
          </p>
        </div>
      </div>

      <button
        onClick={() => setStep(2)}
        className="dynasty-button text-lg px-8 py-4 flex items-center space-x-3 mx-auto"
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
        <Crown className="w-16 h-16 mx-auto" style={{ color: dynastyColors.gold }} />
        <h1 className="text-3xl font-bold text-white">Setup Your Team</h1>
        <p className="dynasty-text-secondary">
          Customize your team identity in <span style={{ color: dynastyColors.gold }}>
            {league?.league_name}
          </span>
        </p>
      </div>

      <div 
        className="dynasty-card p-8 space-y-6"
        style={{ background: dynastyUtils.getGradient('card') }}
      >
        {/* Team Name */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Team Name *
          </label>
          <input
            type="text"
            value={teamData.team_name}
            onChange={(e) => handleInputChange('team_name', e.target.value)}
            placeholder="e.g., Dynasty Dragons, Baseball Legends, Championship Chasers"
            className="dynasty-input w-full text-lg"
            maxLength={50}
          />
          <p className="text-xs dynasty-text-secondary mt-1">
            Choose a memorable name that represents your team
          </p>
        </div>

        {/* Manager Name */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Manager Name
          </label>
          <input
            type="text"
            value={teamData.manager_name}
            onChange={(e) => handleInputChange('manager_name', e.target.value)}
            placeholder="Your name as team manager"
            className="dynasty-input w-full"
            maxLength={50}
          />
        </div>

        {/* Team Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Team Logo (Optional)
          </label>
          <div 
            className="border-2 border-dashed rounded-lg p-8 text-center transition-colors hover:border-dynasty-gold/50"
            style={{ borderColor: dynastyColors.gray }}
          >
            {teamData.team_logo_url ? (
              <div className="space-y-3">
                <img 
                  src={teamData.team_logo_url} 
                  alt="Team logo" 
                  className="w-16 h-16 mx-auto rounded-lg object-cover"
                />
                <p className="text-sm text-white">Logo uploaded</p>
                <button 
                  onClick={() => handleInputChange('team_logo_url', '')}
                  className="dynasty-button-secondary text-sm"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Camera className="w-12 h-12 mx-auto dynasty-text-secondary" />
                <div>
                  <p className="text-white font-medium">Upload team logo</p>
                  <p className="text-xs dynasty-text-secondary">PNG, JPG up to 2MB</p>
                </div>
                <button 
                  className="dynasty-button-secondary flex items-center space-x-2 mx-auto"
                  onClick={() => {
                    // TODO: Implement file upload
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
          <label className="block text-sm font-medium text-white mb-3">
            Team Colors
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs dynasty-text-secondary mb-2">Primary Color</label>
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
                  className="dynasty-input flex-1 font-mono text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs dynasty-text-secondary mb-2">Secondary Color</label>
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
                  className="dynasty-input flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Team Motto */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Team Motto (Optional)
          </label>
          <input
            type="text"
            value={teamData.team_motto}
            onChange={(e) => handleInputChange('team_motto', e.target.value)}
            placeholder="e.g., Champions are made here, Dynasty starts now"
            className="dynasty-input w-full"
            maxLength={100}
          />
          <p className="text-xs dynasty-text-secondary mt-1">
            A motivational phrase or slogan for your team
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="p-4 rounded-lg"
            style={dynastyUtils.getMessageStyles('error')}
          >
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6">
          <button
            onClick={() => setStep(1)}
            className="dynasty-button-secondary flex items-center space-x-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            onClick={handleTeamSetup}
            disabled={submitting || !teamData.team_name.trim()}
            className="dynasty-button flex items-center space-x-2 disabled:opacity-50"
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
          className="w-24 h-24 rounded-full mx-auto flex items-center justify-center"
          style={{ backgroundColor: dynastyColors.success }}
        >
          <Star className="w-12 h-12 text-white" />
        </div>
        
        <h1 className="text-4xl font-bold text-white">
          Team Setup Complete!
        </h1>
        
        <p className="text-xl dynasty-text-secondary max-w-2xl mx-auto">
          <span style={{ color: dynastyColors.gold }} className="font-semibold">
            {teamData.team_name}
          </span> is ready to dominate in {league?.league_name}
        </p>
      </div>

      {/* Team Summary Card */}
      <div 
        className="dynasty-card p-8 max-w-md mx-auto"
        style={{ background: dynastyUtils.getGradient('card') }}
      >
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
            <h3 className="text-xl font-bold text-white">{teamData.team_name}</h3>
            <p className="dynasty-text-secondary">Manager: {teamData.manager_name}</p>
            {teamData.team_motto && (
              <p className="text-sm italic mt-2" style={{ color: dynastyColors.gold }}>
                "{teamData.team_motto}"
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={proceedToLeague}
          className="dynasty-button text-lg px-8 py-4 flex items-center space-x-3 mx-auto"
        >
          <Crown className="w-5 h-5" />
          <span>Enter League Dashboard</span>
          <ArrowRight className="w-5 h-5" />
        </button>
        
        <p className="text-sm dynasty-text-secondary">
          You can customize your team details anytime from the league settings
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: dynastyUtils.getGradient('page') }}>
      {/* Header */}
      <header 
        className="px-6 py-4 border-b"
        style={{ 
          background: dynastyUtils.getGradient('card'),
          borderColor: dynastyColors.gold + '20'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Crown className="w-8 h-8" style={{ color: dynastyColors.gold }} />
            <div>
              <h1 className="text-xl font-bold text-white">Dynasty Dugout</h1>
              <p className="text-sm dynasty-text-secondary">League Setup</p>
            </div>
          </div>
          
          {/* Progress Indicator */}
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((stepNum) => (
              <div
                key={stepNum}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step === stepNum 
                    ? 'text-black' 
                    : step > stepNum 
                    ? 'text-white' 
                    : 'text-gray-400'
                }`}
                style={{
                  backgroundColor: step === stepNum 
                    ? dynastyColors.gold 
                    : step > stepNum 
                    ? dynastyColors.success 
                    : dynastyColors.gray
                }}
              >
                {step > stepNum ? <Check className="w-4 h-4" /> : stepNum}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {step === 1 && renderWelcomeStep()}
        {step === 2 && renderTeamSetupStep()}
        {step === 3 && renderSuccessStep()}
      </main>
    </div>
  );
};

export default LeagueWelcome;