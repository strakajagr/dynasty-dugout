// src/components/dashboard/LeagueDiscoveryHub.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Trophy, Crown, Globe } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';

const LeagueDiscoveryHub = () => {
  const navigate = useNavigate();
  const [publicLeagues, setPublicLeagues] = useState([]);

  useEffect(() => {
    loadPublicLeagues();
  }, []);

  const loadPublicLeagues = async () => {
    try {
      const response = await leaguesAPI.getPublicLeagues();
      if (response.success && response.leagues) {
        setPublicLeagues(response.leagues.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading public leagues:', error);
      setPublicLeagues([
        { league_id: 'demo1', league_name: 'Beginner Dynasty League', current_teams: 8, max_teams: 12, scoring_system: 'rotisserie_ytd' },
        { league_id: 'demo2', league_name: 'Expert Keeper League', current_teams: 10, max_teams: 12, scoring_system: 'h2h_category_wins' }
      ]);
    }
  };

  const getScoringSystemLabel = (system) => {
    const systemLabels = {
      'rotisserie_ytd': 'Rotisserie (YTD)',
      'rotisserie_weekly_accumulate': 'Rotisserie (Weekly)',
      'total_points': 'Points-Based',
      'h2h_category_wins': 'Head-to-Head Categories',
      'h2h_one_win_loss': 'Head-to-Head',
    };
    return systemLabels[system] || system.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={`${dynastyTheme.components.card.base} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`${dynastyTheme.components.heading.h3}`}>
          League Discovery Hub
        </h3>
        <button
          onClick={() => navigate('/create-league')}
          className={`${dynastyTheme.utils.getComponent('button', 'primary', 'sm')} flex items-center space-x-2`}
        >
          <Plus className="w-4 h-4" />
          <span>Create League</span>
        </button>
      </div>

      {/* Difficulty Levels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          className={`${dynastyTheme.components.card.interactive} p-4 text-center group`}
          onClick={() => navigate('/join-league?difficulty=beginner')}
        >
          <div className={`w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center`}>
            <Users className={`w-6 h-6 ${dynastyTheme.classes.text.white}`} />
          </div>
          <h4 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Beginner</h4>
          <p className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>New to fantasy</p>
        </button>

        <button
          className={`${dynastyTheme.components.card.interactive} p-4 text-center group`}
          onClick={() => navigate('/join-league?difficulty=intermediate')}
        >
          <div className={`w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center`}>
            <Trophy className={`w-6 h-6 ${dynastyTheme.classes.text.white}`} />
          </div>
          <h4 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Intermediate</h4>
          <p className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>Some experience</p>
        </button>

        <button
          className={`${dynastyTheme.components.card.interactive} p-4 text-center group`}
          onClick={() => navigate('/join-league?difficulty=expert')}
        >
          <div className={`w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center`}>
            <Crown className={`w-6 h-6 ${dynastyTheme.classes.text.white}`} />
          </div>
          <h4 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Expert</h4>
          <p className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>Seasoned player</p>
        </button>
      </div>

      {/* Public Leagues */}
      <div>
        <h4 className={`text-sm font-semibold ${dynastyTheme.classes.text.primary} mb-3`}>
          Open Public Leagues
        </h4>
        <div className="space-y-2">
          {publicLeagues.length > 0 ? (
            publicLeagues.map((league) => (
              <div
                key={league.league_id}
                className={`${dynastyTheme.components.card.interactive} p-3 flex items-center justify-between group cursor-pointer`}
                onClick={() => navigate(`/leagues/${league.league_id}/join`)}
              >
                <div className="flex items-center space-x-3">
                  <Globe className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
                  <div>
                    <h5 className={`font-semibold ${dynastyTheme.classes.text.white} group-hover:text-yellow-400 ${dynastyTheme.classes.transition}`}>
                      {league.league_name}
                    </h5>
                    <p className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                      {league.current_teams || 0}/{league.max_teams || 12} teams • {getScoringSystemLabel(league.scoring_system)}
                    </p>
                  </div>
                </div>
                <button 
                  className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'xs')}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/leagues/${league.league_id}/join`);
                  }}
                >
                  Join
                </button>
              </div>
            ))
          ) : (
            <div className={`text-center py-4 ${dynastyTheme.classes.text.neutralLight}`}>
              No public leagues available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeagueDiscoveryHub;