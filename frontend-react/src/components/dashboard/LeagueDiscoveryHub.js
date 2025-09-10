// src/components/dashboard/LeagueDiscoveryHub.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Trophy, Crown, Globe, Lock, Search } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';

const LeagueDiscoveryHub = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('public');
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [privateCode, setPrivateCode] = useState('');
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [error, setError] = useState(null);
  const [joinError, setJoinError] = useState(null);

  useEffect(() => {
    if (activeTab === 'public') {
      loadPublicLeagues();
    }
  }, [activeTab]);

  const loadPublicLeagues = async () => {
    try {
      setLoadingLeagues(true);
      setError(null);
      
      console.log('🌐 Loading public leagues from API...');
      const response = await leaguesAPI.getPublicLeagues();
      
      if (response.success && response.leagues) {
        setPublicLeagues(response.leagues);
        console.log('✅ Public leagues loaded successfully:', response.leagues.length, 'leagues');
      } else {
        console.warn('⚠️ Public leagues API returned unsuccessful response');
        setPublicLeagues([]);
      }
    } catch (error) {
      console.error('❌ Error loading public leagues:', error);
      setError(error.message);
      setPublicLeagues([]);
    } finally {
      setLoadingLeagues(false);
    }
  };

  const handleJoinPrivateLeague = async () => {
    if (!privateCode.trim()) {
      setJoinError('Please enter a league code');
      return;
    }

    try {
      setJoinError(null);
      // Call API to join private league with code
      const response = await leaguesAPI.joinPrivateLeague(privateCode);
      
      if (response.success) {
        navigate(`/leagues/${response.league_id}`);
      } else {
        setJoinError(response.message || 'Invalid league code');
      }
    } catch (error) {
      setJoinError('Error joining private league. Please check the code and try again.');
    }
  };

  const getScoringSystemLabel = (system) => {
    const systemLabels = {
      'rotisserie_ytd': 'Roto (YTD)',
      'rotisserie_weekly_accumulate': 'Roto (Weekly)',
      'total_points': 'Points',
      'h2h_category_wins': 'H2H Categories',
      'h2h_one_win_loss': 'H2H Points',
    };
    return systemLabels[system] || system.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleJoinLeague = (leagueId) => {
    navigate(`/leagues/${leagueId}/join`);
  };

  return (
    <div className={`${dynastyTheme.components.card.base} p-6`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <h3 className={`${dynastyTheme.components.heading.h3}`}>
            League Discovery
          </h3>
        </div>
        <button
          onClick={() => navigate('/create-league')}
          className={`${dynastyTheme.utils.getComponent('button', 'primary', 'sm')} flex items-center space-x-2`}
        >
          <Plus className="w-4 h-4" />
          <span>Create League</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('public')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
            activeTab === 'public'
              ? `${dynastyTheme.classes.bg.primaryDark} ${dynastyTheme.classes.text.white}`
              : `${dynastyTheme.classes.text.neutralLight} hover:${dynastyTheme.classes.text.white}`
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Public Leagues</span>
        </button>
        <button
          onClick={() => setActiveTab('private')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
            activeTab === 'private'
              ? `${dynastyTheme.classes.bg.primaryDark} ${dynastyTheme.classes.text.white}`
              : `${dynastyTheme.classes.text.neutralLight} hover:${dynastyTheme.classes.text.white}`
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Private Code</span>
        </button>
      </div>

      {/* Error Messages */}
      {error && (
        <div className={`mb-4 p-3 border-l-4 border-yellow-500 ${dynastyTheme.classes.bg.darkLighter}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
              Unable to load leagues: {error}
            </span>
            <button
              onClick={loadPublicLeagues}
              className={`text-xs ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline`}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Public Leagues Tab */}
      {activeTab === 'public' && (
        <div>
          {/* Public Leagues List Header */}
          <div className="flex items-center justify-between mb-4">
            <h4 className={`text-sm font-semibold ${dynastyTheme.classes.text.primary}`}>
              All Public Leagues
            </h4>
            {loadingLeagues && (
              <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${dynastyTheme.classes.border.primaryBright}`} />
            )}
          </div>

          {/* Public Leagues List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {publicLeagues.length > 0 ? (
              publicLeagues.map((league) => (
                <div
                  key={league.league_id}
                  className={`${dynastyTheme.components.card.interactive} p-4 flex items-center justify-between group cursor-pointer`}
                  onClick={() => handleJoinLeague(league.league_id)}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dynastyTheme.classes.bg.primaryDark}`}>
                      <Trophy className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
                    </div>
                    <div className="flex-1">
                      <h5 className={`font-semibold text-sm ${dynastyTheme.classes.text.white} group-hover:text-yellow-400 ${dynastyTheme.classes.transition}`}>
                        {league.league_name}
                      </h5>
                      <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center space-x-1">
                            <Users className="w-3 h-3" />
                            <span>{league.current_teams || 0}/{league.max_teams || 12} teams</span>
                          </span>
                          <span>•</span>
                          <span>{getScoringSystemLabel(league.scoring_system || 'rotisserie_ytd')}</span>
                          {league.salary_cap && (
                            <>
                              <span>•</span>
                              <span className="flex items-center space-x-1">
                                <span>${league.salary_cap} cap</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {league.commissioner_name && (
                        <div className={`text-xs ${dynastyTheme.classes.text.neutralLighter} mt-1`}>
                          Commissioner: {league.commissioner_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <button 
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} ml-4`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoinLeague(league.league_id);
                    }}
                  >
                    Join League
                  </button>
                </div>
              ))
            ) : loadingLeagues ? (
              <div className={`text-center py-12 ${dynastyTheme.classes.text.neutralLight}`}>
                <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3 ${dynastyTheme.classes.border.primaryBright}`} />
                Loading public leagues...
              </div>
            ) : (
              <div className={`text-center py-12 ${dynastyTheme.classes.text.neutralLight}`}>
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-semibold mb-1">No public leagues available</p>
                <p className="text-xs">Be the first to create one!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Private League Tab */}
      {activeTab === 'private' && (
        <div className="space-y-4">
          <div className="text-center py-6">
            <Lock className={`w-12 h-12 mx-auto mb-4 ${dynastyTheme.classes.text.primary}`} />
            <h4 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-2`}>
              Join Private League
            </h4>
            <p className={`text-sm ${dynastyTheme.classes.text.neutralLight} mb-6`}>
              Enter the league code provided by your commissioner
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>
                League Code
              </label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={privateCode}
                  onChange={(e) => setPrivateCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-8 character code"
                  className={`flex-1 px-4 py-2 ${dynastyTheme.classes.bg.darkLighter} border ${dynastyTheme.classes.border.dark} rounded-lg ${dynastyTheme.classes.text.white} placeholder-gray-500 focus:border-yellow-500 focus:outline-none`}
                  maxLength={8}
                />
                <button
                  onClick={handleJoinPrivateLeague}
                  disabled={!privateCode.trim()}
                  className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Search className="w-4 h-4" />
                  <span>Join</span>
                </button>
              </div>
            </div>

            {joinError && (
              <div className={`p-3 border-l-4 border-red-500 ${dynastyTheme.classes.bg.darkLighter}`}>
                <span className={`text-sm text-red-400`}>
                  {joinError}
                </span>
              </div>
            )}

            <div className={`p-4 ${dynastyTheme.classes.bg.darkLighter} rounded-lg border-l-4 border-blue-500`}>
              <h5 className={`font-semibold ${dynastyTheme.classes.text.white} mb-2`}>
                How to find your league code:
              </h5>
              <ul className={`text-sm ${dynastyTheme.classes.text.neutralLight} space-y-1`}>
                <li>• Ask your league commissioner for the code</li>
                <li>• Check your league invitation email</li>
                <li>• Look for it in league communications</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Info */}
      <div className={`mt-4 text-center text-xs ${dynastyTheme.classes.text.neutralLighter}`}>
        {activeTab === 'public' ? 
          `Public leagues refreshed every 15 minutes • Last updated: ${new Date().toLocaleTimeString()}` :
          'Private leagues require invitation codes from commissioners'
        }
      </div>
    </div>
  );
};

export default LeagueDiscoveryHub;