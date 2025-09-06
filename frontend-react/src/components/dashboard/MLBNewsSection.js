// src/components/dashboard/MLBNewsSection.js
import React, { useState, useEffect } from 'react';
import { Newspaper, Activity } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable } from '../../services/tableService';

const MLBNewsSection = () => {
  const [mlbHeadlines, setMlbHeadlines] = useState([]);
  const [todaysGames, setTodaysGames] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    loadMLBNews();
  }, []);

  const loadMLBNews = async () => {
    try {
      setLoadingNews(true);
      
      // Format data for table display
      setMlbHeadlines([
        { 
          id: 1,
          headline: "Ohtani makes history with 50-50 season", 
          date: '8/31/2025',
          source: 'ESPN',
          link: "https://espn.com"
        },
        { 
          id: 2,
          headline: "Yankees clinch AL East title", 
          date: '8/31/2025',
          source: 'MLB.com',
          link: "https://mlb.com"
        },
        { 
          id: 3,
          headline: "Rookie sensation called up by Dodgers", 
          date: '8/31/2025',
          source: 'Athletic',
          link: "https://theathletic.com"
        },
        { 
          id: 4,
          headline: "Trade deadline rumors heating up", 
          date: '8/31/2025',
          source: 'ESPN',
          link: "https://espn.com"
        },
        { 
          id: 5,
          headline: "Injury update: Star pitcher to IL", 
          date: '8/31/2025',
          source: 'MLB.com',
          link: "https://mlb.com"
        }
      ]);
      
      // Format games for table display
      setTodaysGames([
        { 
          id: 1,
          away_team: 'NYY',
          away_score: 5,
          home_team: 'BOS',
          home_score: 3,
          status: 'Final',
          time: ''
        },
        { 
          id: 2,
          away_team: 'LAD',
          away_score: 7,
          home_team: 'SF',
          home_score: 4,
          status: 'In Progress',
          time: '7:10 PM ET'
        },
        { 
          id: 3,
          away_team: 'HOU',
          away_score: null,
          home_team: 'SEA',
          home_score: null,
          status: 'Scheduled',
          time: '9:40 PM ET'
        }
      ]);
      
    } catch (error) {
      console.error('Error loading MLB news:', error);
    } finally {
      setLoadingNews(false);
    }
  };

  if (loadingNews) {
    return (
      <div className="space-y-6">
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center space-x-3">
              <div 
                className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${dynastyTheme.classes.border.primaryBright}`}
              />
              <span className={dynastyTheme.classes.text.white}>Loading MLB news...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* MLB Headlines Table */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-3">
          <Newspaper className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>MLB Headlines</h3>
        </div>
        <DynastyTable
          data={mlbHeadlines}
          columns={[
            { 
              key: 'headline', 
              title: 'Headline', 
              width: 250,
              render: (v, row) => (
                <a 
                  href={row.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-yellow-400 text-sm block"
                >
                  {v}
                </a>
              )
            },
            { 
              key: 'date', 
              title: 'Date', 
              width: 80,
              render: (v) => <span className="text-gray-400 text-xs">{v}</span>
            }
          ]}
          maxHeight="250px"
          enableHorizontalScroll={false}
          enableVerticalScroll={true}
          stickyHeader={false}
        />
      </div>

      {/* Today's Games Table */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-3">
          <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Today's Games</h3>
        </div>
        <DynastyTable
          data={todaysGames}
          columns={[
            {
              key: 'matchup',
              title: 'Matchup',
              width: 120,
              render: (_, row) => (
                <div className="text-sm">
                  <div className="text-white">{row.away_team} {row.away_score !== null ? row.away_score : ''}</div>
                  <div className="text-white">{row.home_team} {row.home_score !== null ? row.home_score : ''}</div>
                </div>
              )
            },
            {
              key: 'status',
              title: 'Status',
              width: 100,
              render: (v, row) => {
                const isComplete = v === 'Final';
                const isInProgress = v === 'In Progress';
                return (
                  <span className={`text-xs ${
                    isComplete ? 'text-gray-400' : 
                    isInProgress ? 'text-green-400' : 
                    'text-yellow-400'
                  }`}>
                    {v || row.time}
                  </span>
                );
              }
            }
          ]}
          maxHeight="200px"
          enableHorizontalScroll={false}
          enableVerticalScroll={true}
          stickyHeader={false}
        />
      </div>
    </div>
  );
};

export default MLBNewsSection;