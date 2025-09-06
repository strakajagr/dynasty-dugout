// src/components/player/PlayerProfileHeader.js
import React from 'react';
import { ArrowLeft, User, Flame, Snowflake, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dynastyTheme } from '../../services/colorService';

const PlayerProfileHeader = ({ player, hotColdAnalysis }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getHotColdIcon = () => {
    if (!hotColdAnalysis) return <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.neutral}`} />;
    
    switch (hotColdAnalysis.status) {
      case 'hot':
        return <Flame className="w-5 h-5 text-red-500" />;
      case 'cold':
        return <Snowflake className="w-5 h-5 text-blue-400" />;
      default:
        return <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.neutral}`} />;
    }
  };

  const getHotColdColor = () => {
    if (!hotColdAnalysis) return dynastyTheme.classes.text.neutral;
    
    switch (hotColdAnalysis.status) {
      case 'hot':
        return 'text-red-500';
      case 'cold':
        return 'text-blue-400';
      default:
        return dynastyTheme.classes.text.neutral;
    }
  };

  return (
    <header className={`${dynastyTheme.components.card.base} border-b ${dynastyTheme.classes.border.light}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button 
              onClick={() => navigate(-1)}
              className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} flex items-center`}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
            <div className="flex items-center ml-4">
              <User className={`w-8 h-8 mr-3 ${dynastyTheme.classes.text.primary}`} />
              <div>
                <div className="flex items-center">
                  <h1 className={`text-2xl font-bold ${dynastyTheme.classes.text.white} mr-3`}>
                    {player.first_name || player.player_name || 'Unknown'} {player.last_name || ''}
                  </h1>
                  {hotColdAnalysis && (
                    <div className={`flex items-center px-3 py-1 rounded-full ${dynastyTheme.components.card.base} ${getHotColdColor()}`}>
                      {getHotColdIcon()}
                      <span className="ml-1 text-sm font-medium capitalize">
                        {hotColdAnalysis.status}
                      </span>
                    </div>
                  )}
                </div>
                <p className={dynastyTheme.classes.text.neutralLight}>
                  {player.position} • {player.mlb_team || 'Free Agent'}
                </p>
              </div>
            </div>
          </div>
          {user && (
            <div className="flex items-center space-x-4">
              <span className={dynastyTheme.classes.text.primary}>Welcome, {user.given_name}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default PlayerProfileHeader;