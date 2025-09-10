// src/components/dashboard/PreviewComponents.js
import React from 'react';
import { 
  Crown, Trophy, Users, BarChart3, Clock, ArrowUp, ArrowDown, 
  TrendingUp, TrendingDown, Activity, AlertCircle, Calendar,
  ChevronRight, Plus, Globe, UserPlus, Flame, Snowflake, Sparkles,
  Newspaper
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { 
  mockLeagues, mockTrendingPlayers, mockMLBNews, 
  mockInjuryReports, mockTickerUpdates, mockPublicLeagues 
} from '../../data/mockData';

// Mock table component that looks like DynastyTable but triggers auth
const PreviewTable = ({ data, onAuthNeeded, children }) => {
  return (
    <div className="overflow-hidden">
      <div className="max-h-64 overflow-y-auto">
        <button 
          onClick={onAuthNeeded}
          className="w-full text-left hover:bg-neutral-800/50 transition-colors"
        >
          {children}
        </button>
      </div>
    </div>
  );
};

// Preview Welcome Banner - shows demo user
export const PreviewWelcomeBanner = ({ onAuthNeeded }) => {
  const currentDate = new Date();
  const weekNumber = Math.ceil((currentDate - new Date(currentDate.getFullYear(), 0, 1)) / 604800000);
  
  return (
    <div className={`${dynastyTheme.components.card.base} p-6 relative overflow-hidden`}>
      <div className="absolute top-0 right-0 px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-bl-lg">
        PREVIEW MODE
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white} mb-2`}>
            Welcome back, Demo User!
          </h1>
          <p className={`${dynastyTheme.classes.text.neutralLight} text-lg`}>
            Week {weekNumber} • 2025 Season • Your dynasty awaits. Manage your leagues and build your empire.
          </p>
        </div>
        <div className={`px-4 py-2 ${dynastyTheme.classes.bg.primary} text-black font-bold rounded-lg`}>
          TUE, MAR 9
        </div>
      </div>
    </div>
  );
};

// Preview Ticker Bar - shows mock updates
export const PreviewTickerBar = ({ onAuthNeeded }) => {
  return (
    <div className={`${dynastyTheme.classes.bg.primaryDark} text-black py-2 relative overflow-hidden`}>
      <div className="flex items-center space-x-2 px-4">
        <Activity className="w-4 h-4" />
        <span className="font-bold text-sm">LIVE</span>
        <div className="flex-1 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap text-sm font-medium">
            {mockTickerUpdates.join(' • ')}
          </div>
        </div>
      </div>
    </div>
  );
};

// Preview My Leagues Section - shows mock leagues
export const PreviewMyLeaguesSection = ({ onAuthNeeded }) => {
  return (
    <div className={dynastyTheme.components.card.base}>
      <div className="flex items-center justify-between p-6 border-b border-neutral-700">
        <div className="flex items-center space-x-3">
          <Crown className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
          <h2 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white}`}>
            My Leagues
          </h2>
          <div className="px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">
            DEMO
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`${dynastyTheme.classes.text.neutralLight}`}>
            {mockLeagues.length} leagues
          </span>
          <button
            onClick={onAuthNeeded}
            className={dynastyTheme.utils.getComponent('button', 'primary', 'sm')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create League
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid gap-4">
          {mockLeagues.map((league) => (
            <button
              key={league.league_id}
              onClick={onAuthNeeded}
              className={`${dynastyTheme.components.card.interactive} p-4 text-left group relative`}
            >
              <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded">
                DEMO
              </div>
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h3 className={`font-bold ${dynastyTheme.classes.text.white} group-hover:text-yellow-400 transition-colors`}>
                    {league.league_name}
                  </h3>
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      league.status === 'ACTIVE' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {league.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT PENDING'}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      league.role === 'COMMISSIONER'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {league.role}
                    </span>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 ${dynastyTheme.classes.text.neutralLight} group-hover:text-yellow-400 transition-colors`} />
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Trophy className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                  <span className={dynastyTheme.classes.text.neutralLight}>
                    {league.league_format}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                  <span className={dynastyTheme.classes.text.neutralLight}>
                    {league.current_teams}/{league.max_teams} teams
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <BarChart3 className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                  <span className={dynastyTheme.classes.text.neutralLight}>
                    ${league.salary_cap} cap
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                  <span className={dynastyTheme.classes.text.neutralLight}>
                    {new Date(league.created_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Preview League Discovery Hub - matching the real structure exactly
export const PreviewLeagueDiscoveryHub = ({ onAuthNeeded }) => {
  return (
    <div className={`${dynastyTheme.components.card.base} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`${dynastyTheme.components.heading.h3}`}>
          League Discovery Hub
        </h3>
        <div className="px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">
          DEMO
        </div>
        <button
          onClick={onAuthNeeded}
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
          onClick={onAuthNeeded}
        >
          <div className={`w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center`}>
            <Users className={`w-6 h-6 ${dynastyTheme.classes.text.white}`} />
          </div>
          <h4 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Beginner</h4>
          <p className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>New to fantasy</p>
        </button>

        <button
          className={`${dynastyTheme.components.card.interactive} p-4 text-center group`}
          onClick={onAuthNeeded}
        >
          <div className={`w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center`}>
            <Trophy className={`w-6 h-6 ${dynastyTheme.classes.text.white}`} />
          </div>
          <h4 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Intermediate</h4>
          <p className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>Some experience</p>
        </button>

        <button
          className={`${dynastyTheme.components.card.interactive} p-4 text-center group`}
          onClick={onAuthNeeded}
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
          {mockPublicLeagues.map((league) => (
            <div
              key={league.league_id}
              className={`${dynastyTheme.components.card.interactive} p-3 flex items-center justify-between group cursor-pointer`}
              onClick={onAuthNeeded}
            >
              <div className="flex items-center space-x-3">
                <Globe className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
                <div>
                  <h5 className={`font-semibold ${dynastyTheme.classes.text.white} group-hover:text-yellow-400 ${dynastyTheme.classes.transition}`}>
                    {league.league_name}
                  </h5>
                  <p className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                    {league.teams} • {league.format}
                  </p>
                </div>
              </div>
              <button 
                className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'xs')}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAuthNeeded();
                }}
              >
                Join
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Preview Trending Players Section - matching the real structure exactly
export const PreviewTrendingPlayersSection = ({ onAuthNeeded }) => {
  const hotPlayers = [
    { name: 'Ronald Acuña Jr.', position: 'OF', team: 'ATL', last_7: { avg: .385, hr: 4, rbi: 12, ops: 1.250 }, change: { avg: '+.085' }},
    { name: 'Mookie Betts', position: '2B', team: 'LAD', last_7: { avg: .367, hr: 3, rbi: 9, ops: 1.180 }, change: { avg: '+.067' }},
    { name: 'Juan Soto', position: 'OF', team: 'SD', last_7: { avg: .412, hr: 2, rbi: 8, ops: 1.320 }, change: { avg: '+.112' }}
  ];

  const coldPlayers = [
    { name: 'Mike Trout', position: 'OF', team: 'LAA', last_7: { avg: .125, hr: 0, rbi: 1, ops: .450 }, change: { avg: '-.175' }},
    { name: 'Jose Altuve', position: '2B', team: 'HOU', last_7: { avg: .182, hr: 0, rbi: 2, ops: .520 }, change: { avg: '-.118' }}
  ];

  const waiverAdds = [
    { name: 'Elly De La Cruz', position: 'SS', team: 'CIN', adds_today: 342, ownership: '45%', trend: '+12%' },
    { name: 'Grayson Rodriguez', position: 'SP', team: 'BAL', adds_today: 298, ownership: '38%', trend: '+8%' }
  ];

  const waiverDrops = [
    { name: 'Byron Buxton', position: 'OF', team: 'MIN', drops_today: 189, ownership: '68%', trend: '-5%' },
    { name: 'Jesse Winker', position: 'OF', team: 'MIL', drops_today: 156, ownership: '22%', trend: '-8%' }
  ];

  return (
    <div className="space-y-6">
      <div className="absolute top-4 right-4 px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">
        DEMO
      </div>

      {/* Hot Players Table */}
      <div className={`${dynastyTheme.components.card.base} p-4 relative`}>
        <div className="flex items-center space-x-2 mb-3">
          <Flame className={`w-5 h-5 text-orange-500`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Hot Players (Last 7 Days)</h3>
        </div>
        <PreviewTable data={hotPlayers} onAuthNeeded={onAuthNeeded}>
          <div className="space-y-2">
            {hotPlayers.map((player, i) => (
              <div key={i} className="flex items-center justify-between p-2 text-sm">
                <div className="flex items-center space-x-3">
                  <span className="text-orange-500 font-bold">#{i+1}</span>
                  <div>
                    <div className={`font-semibold ${dynastyTheme.classes.text.white}`}>{player.name}</div>
                    <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>{player.position} • {player.team}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  <span>AVG: {player.last_7.avg}</span>
                  <span>HR: {player.last_7.hr}</span>
                  <span>RBI: {player.last_7.rbi}</span>
                  <span>OPS: {player.last_7.ops}</span>
                  <span className="text-green-400">{player.change.avg}</span>
                </div>
              </div>
            ))}
          </div>
        </PreviewTable>
      </div>

      {/* Cold Players Table */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-3">
          <Snowflake className={`w-5 h-5 text-blue-400`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Cold Players</h3>
        </div>
        <PreviewTable data={coldPlayers} onAuthNeeded={onAuthNeeded}>
          <div className="space-y-2">
            {coldPlayers.map((player, i) => (
              <div key={i} className="flex items-center justify-between p-2 text-sm">
                <div className="flex items-center space-x-3">
                  <span className="text-blue-400 font-bold">#{i+1}</span>
                  <div>
                    <div className={`font-semibold ${dynastyTheme.classes.text.white}`}>{player.name}</div>
                    <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>{player.position} • {player.team}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  <span>AVG: {player.last_7.avg}</span>
                  <span>HR: {player.last_7.hr}</span>
                  <span>RBI: {player.last_7.rbi}</span>
                  <span>OPS: {player.last_7.ops}</span>
                  <span className="text-red-400">{player.change.avg}</span>
                </div>
              </div>
            ))}
          </div>
        </PreviewTable>
      </div>

      {/* Waiver Wire Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className="flex items-center space-x-2 mb-3">
            <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Most Added Today</h3>
          </div>
          <PreviewTable data={waiverAdds} onAuthNeeded={onAuthNeeded}>
            <div className="space-y-2">
              {waiverAdds.map((player, i) => (
                <div key={i} className="flex items-center justify-between p-2 text-sm">
                  <div>
                    <div className={`font-semibold ${dynastyTheme.classes.text.white}`}>{player.name}</div>
                    <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>{player.position} • {player.team}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-green-400">+{player.adds_today}</div>
                    <div className={dynastyTheme.classes.text.neutralLight}>{player.ownership}</div>
                  </div>
                </div>
              ))}
            </div>
          </PreviewTable>
        </div>

        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className="flex items-center space-x-2 mb-3">
            <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Most Dropped Today</h3>
          </div>
          <PreviewTable data={waiverDrops} onAuthNeeded={onAuthNeeded}>
            <div className="space-y-2">
              {waiverDrops.map((player, i) => (
                <div key={i} className="flex items-center justify-between p-2 text-sm">
                  <div>
                    <div className={`font-semibold ${dynastyTheme.classes.text.white}`}>{player.name}</div>
                    <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>{player.position} • {player.team}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-red-400">-{player.drops_today}</div>
                    <div className={dynastyTheme.classes.text.neutralLight}>{player.ownership}</div>
                  </div>
                </div>
              ))}
            </div>
          </PreviewTable>
        </div>
      </div>
    </div>
  );
};

// Preview MLB News Section - matching the real structure exactly
export const PreviewMLBNewsSection = ({ onAuthNeeded }) => {
  const mlbHeadlines = [
    { headline: "Ohtani makes history with 50-50 season", date: '8/31/2025' },
    { headline: "Yankees clinch AL East title", date: '8/31/2025' },
    { headline: "Rookie sensation called up by Dodgers", date: '8/31/2025' },
    { headline: "Trade deadline rumors heating up", date: '8/31/2025' },
    { headline: "Injury update: Star pitcher to IL", date: '8/31/2025' }
  ];

  const todaysGames = [
    { away_team: 'NYY', away_score: 5, home_team: 'BOS', home_score: 3, status: 'Final' },
    { away_team: 'LAD', away_score: 7, home_team: 'SF', home_score: 4, status: 'In Progress' },
    { away_team: 'HOU', away_score: null, home_team: 'SEA', home_score: null, status: 'Scheduled' }
  ];

  return (
    <div className="space-y-6">
      {/* MLB Headlines Table */}
      <div className={`${dynastyTheme.components.card.base} p-4 relative`}>
        <div className="absolute top-4 right-4 px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">
          DEMO
        </div>
        <div className="flex items-center space-x-2 mb-3">
          <Newspaper className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>MLB Headlines</h3>
        </div>
        <PreviewTable data={mlbHeadlines} onAuthNeeded={onAuthNeeded}>
          <div className="space-y-3">
            {mlbHeadlines.map((headline, i) => (
              <div key={i} className="flex items-center justify-between p-2 border-b border-neutral-700 last:border-b-0">
                <div className={`text-sm ${dynastyTheme.classes.text.white} hover:text-yellow-400 transition-colors`}>
                  {headline.headline}
                </div>
                <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                  {headline.date}
                </div>
              </div>
            ))}
          </div>
        </PreviewTable>
      </div>

      {/* Today's Games Table */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-3">
          <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Today's Games</h3>
        </div>
        <PreviewTable data={todaysGames} onAuthNeeded={onAuthNeeded}>
          <div className="space-y-2">
            {todaysGames.map((game, i) => (
              <div key={i} className="flex items-center justify-between p-2 text-sm">
                <div>
                  <div className={dynastyTheme.classes.text.white}>
                    {game.away_team} {game.away_score !== null ? game.away_score : ''}
                  </div>
                  <div className={dynastyTheme.classes.text.white}>
                    {game.home_team} {game.home_score !== null ? game.home_score : ''}
                  </div>
                </div>
                <div className={`text-xs ${
                  game.status === 'Final' ? 'text-gray-400' : 
                  game.status === 'In Progress' ? 'text-green-400' : 
                  'text-yellow-400'
                }`}>
                  {game.status}
                </div>
              </div>
            ))}
          </div>
        </PreviewTable>
      </div>
    </div>
  );
};

// Preview Injury Report Section - matching the real structure exactly
export const PreviewInjuryReportSection = ({ onAuthNeeded }) => {
  const injuryReport = [
    { name: 'Gerrit Cole', position: 'SP', team: 'NYY', status: 'IL-15', injury: 'Elbow inflammation', return_date: 'Sep 5' },
    { name: 'Jazz Chisholm', position: '2B', team: 'MIA', status: 'DTD', injury: 'Hamstring tightness', return_date: 'Day-to-day' },
    { name: 'Carlos Correa', position: 'SS', team: 'MIN', status: 'IL-10', injury: 'Back spasms', return_date: 'Sep 2' },
    { name: 'Shane Bieber', position: 'SP', team: 'CLE', status: 'IL-60', injury: 'Tommy John surgery', return_date: '2026' }
  ];

  return (
    <div className={`${dynastyTheme.components.card.base} p-4 relative`}>
      <div className="absolute top-4 right-4 px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">
        DEMO
      </div>
      <div className="flex items-center space-x-2 mb-3">
        <AlertCircle className={`w-5 h-5 text-red-500`} />
        <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Injury Report</h3>
      </div>
      <PreviewTable data={injuryReport} onAuthNeeded={onAuthNeeded}>
        <div className="space-y-3">
          {injuryReport.map((player, i) => (
            <div key={i} className="flex items-center justify-between p-2 border-b border-neutral-700 last:border-b-0">
              <div>
                <div className="flex items-center space-x-2">
                  <div className={`font-semibold ${dynastyTheme.classes.text.white}`}>{player.name}</div>
                  <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>{player.position} • {player.team}</div>
                </div>
                <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>{player.injury}</div>
                <div className="flex items-center space-x-2 text-xs mt-1">
                  <span className={`px-2 py-1 rounded ${
                    player.status === 'DTD' ? 'bg-green-500/20 text-green-400' :
                    player.status.includes('IL-10') ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {player.status}
                  </span>
                  <span className={dynastyTheme.classes.text.neutralLighter}>Return: {player.return_date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PreviewTable>
    </div>
  );
};