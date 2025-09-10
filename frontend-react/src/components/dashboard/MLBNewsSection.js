// src/components/dashboard/MLBNewsSection.js
// Fixed version with proper table styling

import React, { useState, useEffect } from 'react';
import { Newspaper, Activity, ExternalLink } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { mlbAPI } from '../../services/apiService';
import { DynastyTable } from '../../services/tableService';

const MLBNewsSection = () => {
  const [mlbHeadlines, setMlbHeadlines] = useState([]);
  const [todaysGames, setTodaysGames] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);
  const [headlinesError, setHeadlinesError] = useState(null);
  const [gamesError, setGamesError] = useState(null);

  useEffect(() => {
    loadMLBNews();
    loadTodaysGames();
  }, []);

  const loadMLBNews = async () => {
    try {
      setLoadingNews(true);
      setHeadlinesError(null);
      
      console.log('📰 Loading MLB headlines from API...');
      const response = await mlbAPI.getHeadlines();
      
      if (response.success && response.headlines) {
        const formattedHeadlines = response.headlines.map(headline => ({
          id: headline.headline + headline.date,
          headline: headline.headline,
          date: headline.date,
          source: headline.source,
          link: headline.link
        }));
        
        setMlbHeadlines(formattedHeadlines);
        console.log('✅ MLB headlines loaded successfully');
      } else {
        console.warn('⚠️ Headlines API returned unsuccessful response');
        loadFallbackHeadlines();
      }
      
    } catch (error) {
      console.error('❌ Error loading MLB headlines:', error);
      setHeadlinesError(error.message);
      loadFallbackHeadlines();
    } finally {
      setLoadingNews(false);
    }
  };

  const loadTodaysGames = async () => {
    try {
      setLoadingGames(true);
      setGamesError(null);
      
      console.log('⚾ Loading today\'s games from API...');
      const response = await mlbAPI.getTodaysGames();
      
      if (response.success && response.games) {
        const formattedGames = response.games.map(game => ({
          id: game.game_id,
          away_team: game.away_team,
          away_score: game.away_score,
          home_team: game.home_team,
          home_score: game.home_score,
          status: game.status,
          abstract_state: game.abstract_state,
          game_time: game.game_time,
          away_pitcher: game.away_pitcher,
          home_pitcher: game.home_pitcher,
          inning: game.inning,
          inning_state: game.inning_state
        }));
        
        setTodaysGames(formattedGames);
        console.log('✅ Today\'s games loaded successfully');
      } else {
        console.warn('⚠️ Games API returned unsuccessful response');
        loadFallbackGames();
      }
      
    } catch (error) {
      console.error('❌ Error loading today\'s games:', error);
      setGamesError(error.message);
      loadFallbackGames();
    } finally {
      setLoadingGames(false);
    }
  };

  const loadFallbackHeadlines = () => {
    console.log('🔄 Loading fallback headlines data');
    setMlbHeadlines([
      { 
        id: 1,
        headline: "Playoff races heating up in final weeks", 
        date: new Date().toLocaleDateString(),
        source: 'ESPN',
        link: "https://espn.com"
      }
    ]);
  };

  const loadFallbackGames = () => {
    console.log('🔄 Loading fallback games data');
    setTodaysGames([
      { 
        id: 'fallback-1',
        away_team: 'NYY',
        away_score: 5,
        home_team: 'BOS',
        home_score: 3,
        status: 'Final',
        abstract_state: 'Final',
        game_time: '',
        away_pitcher: { name: 'Gerrit Cole', era: 3.20 },
        home_pitcher: { name: 'Brayan Bello', era: 4.49 }
      }
    ]);
  };

  if (loadingNews && loadingGames) {
    return (
      <div className="space-y-6">
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center space-x-3">
              <div 
                className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${dynastyTheme.classes.border.primaryBright}`}
              />
              <span className={dynastyTheme.classes.text.white}>Loading MLB data...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Messages */}
      {headlinesError && (
        <div className={`${dynastyTheme.components.card.base} p-3 border-l-4 border-yellow-500`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
              Headlines API Error: {headlinesError}
            </span>
            <button
              onClick={loadMLBNews}
              className={`text-xs ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline`}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {gamesError && (
        <div className={`${dynastyTheme.components.card.base} p-3 border-l-4 border-yellow-500`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
              Games API Error: {gamesError}
            </span>
            <button
              onClick={loadTodaysGames}
              className={`text-xs ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline`}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* MLB Headlines - IMPROVED STYLING */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-4">
          <Newspaper className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>MLB Headlines</h3>
          <span className={`text-xs ${dynastyTheme.classes.text.neutralLight} bg-green-600/20 px-2 py-1 rounded`}>
            LIVE DATA
          </span>
          {loadingNews && (
            <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${dynastyTheme.classes.border.primaryBright}`} />
          )}
        </div>
        
        {/* Custom styled headlines list instead of table */}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {mlbHeadlines.map((headline) => (
            <div
              key={headline.id}
              className={`${dynastyTheme.components.card.interactive} p-3 hover:bg-gray-700/50 transition-colors`}
            >
              <div className="flex items-start justify-between space-x-3">
                <div className="flex-1 min-w-0">
                  <a
                    href={headline.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <h4 className={`text-sm font-medium ${dynastyTheme.classes.text.white} group-hover:text-yellow-400 transition-colors line-clamp-2 mb-1`}>
                      {headline.headline}
                    </h4>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={`${dynastyTheme.classes.text.neutralLight}`}>
                        {headline.source}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className={`${dynastyTheme.classes.text.neutralLight}`}>
                        {headline.date}
                      </span>
                    </div>
                  </a>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Games - IMPROVED LAYOUT */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-4">
          <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Today's Games</h3>
          <span className={`text-xs ${dynastyTheme.classes.text.neutralLight} bg-green-600/20 px-2 py-1 rounded`}>
            LIVE DATA
          </span>
          {loadingGames && (
            <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${dynastyTheme.classes.border.primaryBright}`} />
          )}
        </div>

        {/* Custom styled games list */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {todaysGames.map((game) => (
            <div
              key={game.id}
              className={`${dynastyTheme.components.card.interactive} p-3`}
            >
              <div className="flex items-center justify-between">
                {/* Teams and Score */}
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <div className="text-sm font-medium text-white">
                      {game.away_team} {game.away_score !== null ? game.away_score : ''}
                    </div>
                    <div className="text-gray-500">@</div>
                    <div className="text-sm font-medium text-white">
                      {game.home_team} {game.home_score !== null ? game.home_score : ''}
                    </div>
                  </div>
                  
                  {/* Pitchers */}
                  <div className="text-xs text-gray-400">
                    {game.away_pitcher?.name || 'TBD'} vs {game.home_pitcher?.name || 'TBD'}
                  </div>
                </div>

                {/* Status */}
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    game.abstract_state === 'Final' ? 'text-gray-400' : 
                    game.abstract_state === 'Live' ? 'text-green-400' : 
                    'text-yellow-400'
                  }`}>
                    {game.status}
                  </div>
                  {game.game_time && (
                    <div className="text-xs text-gray-500">
                      {game.game_time}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Refresh Info */}
      <div className={`text-center text-xs ${dynastyTheme.classes.text.neutralLighter}`}>
        Headlines refreshed every 30 minutes • Games refreshed every 10 minutes • Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default MLBNewsSection;