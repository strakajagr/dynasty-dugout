// src/components/dashboard/MyLeaguesSection.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, ChevronRight, Trophy, Users, DollarSign, 
  Calendar, Settings, Star, Plus, Globe
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

const MyLeaguesSection = ({ leagues, leaguesLoading }) => {
  const navigate = useNavigate();

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

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const renderMyLeaguesCards = () => {
    if (leaguesLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="flex items-center space-x-3">
            <div 
              className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${dynastyTheme.classes.border.primaryBright}`}
            />
            <span className={dynastyTheme.classes.text.white}>Loading your leagues...</span>
          </div>
        </div>
      );
    }

    if (leagues.length === 0) {
      return (
        <div className={`${dynastyTheme.components.card.base} text-center py-12`}>
          <Crown className={`w-16 h-16 mx-auto mb-4 opacity-50 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`${dynastyTheme.components.heading.h3} mb-2`}>No Leagues Yet</h3>
          <p className={`${dynastyTheme.classes.text.neutralLight} mb-6`}>
            Create your first fantasy baseball league to get started with Dynasty Dugout
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/create-league')}
              className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} flex items-center space-x-2`}
            >
              <Plus className="w-4 h-4" />
              <span>Create League</span>
            </button>
            <button
              onClick={() => navigate('/browse-leagues')}
              className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex items-center space-x-2`}
            >
              <Globe className="w-4 h-4" />
              <span>Browse Public Leagues</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {leagues.map((league) => (
          <div
            key={league.league_id}
            className={`${dynastyTheme.components.card.interactive} group cursor-pointer`}
            onClick={() => navigate(`/leagues/${league.league_id}`)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white} group-hover:text-yellow-400 ${dynastyTheme.classes.transition}`}>
                  {league.league_name}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`${dynastyTheme.components.badge.success}`}>
                    {(league.status || 'setup').toUpperCase()}
                  </span>
                  <span className={`${dynastyTheme.components.badge.warning}`}>
                    {league.role?.toUpperCase() || 'MEMBER'}
                  </span>
                </div>
              </div>
              <ChevronRight 
                className={`w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 ${dynastyTheme.classes.transition} ${dynastyTheme.classes.text.primary}`}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Trophy className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  {getScoringSystemLabel(league.scoring_system)}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <Users className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  {league.max_teams || 12} teams max
                </span>
              </div>

              {league.salary_cap && (
                <div className="flex items-center space-x-2">
                  <DollarSign className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                  <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                    ${league.salary_cap} salary cap
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Calendar className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  Created {formatDate(league.created_at)}
                </span>
              </div>
            </div>

            <div className={`flex items-center justify-between mt-4 pt-4 border-t ${dynastyTheme.classes.border.neutral}`}>
              <div className="flex items-center space-x-1">
                <Settings className={`w-4 h-4 ${dynastyTheme.classes.text.neutralLighter}`} />
                <span className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                  {league.player_pool?.replace(/_/g, ' ') || 'All MLB'}
                </span>
              </div>
              
              {league.role === 'commissioner' && (
                <Star className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} title="Commissioner" />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
          <div>
            <h3 className={`${dynastyTheme.components.heading.h2}`}>My Leagues</h3>
            <p className={dynastyTheme.classes.text.neutralLight}>
              {leagues.length === 0 ? 'No leagues yet' : `${leagues.length} league${leagues.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => navigate('/create-league')}
          className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} flex items-center space-x-2`}
        >
          <Plus className="w-4 h-4" />
          <span>Create League</span>
        </button>
      </div>

      {renderMyLeaguesCards()}
    </div>
  );
};

export default MyLeaguesSection;