// src/pages/LeagueDashboard.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Crown, Users, Trophy, BarChart3, Calendar, MessageSquare,
  Settings, FileText, Search, Filter, Plus, ChevronRight,
  Star, DollarSign, Clock, Target, TrendingUp, Activity,
  Home, UserPlus, Mail, Bell, LogOut, Menu, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesAPI } from '../services/apiService';
import { dynastyColors, dynastyUtils } from '../services/colorService';

const LeagueDashboard = () => {
  const { leagueId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [league, setLeague] = useState(null);
  const [activeSection, setActiveSection] = useState('league-home');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Mock data - will be replaced with real API calls
  const [standings, setStandings] = useState([
    { team: "Pastrami", manager: "strakajagr", points: 105.5, rank: 1 },
    { team: "South of the Border", manager: "manager2", points: 86.0, rank: 2 },
    { team: "Deadwood", manager: "manager3", points: 81.0, rank: 3 },
    { team: "Vlad Dicks are HUGE", manager: "manager4", points: 78.0, rank: 4 },
    { team: "10¢ Grifter", manager: "manager5", points: 60.5, rank: 5 }
  ]);

  const [recentTransactions, setRecentTransactions] = useState([
    { date: "07.23", action: "Kaysen Irvin, Was (Mike Soroka)", type: "Trade" },
    { date: "07.23", action: "Fairchild, Atl: Traded to TB for cash", type: "Trade" },
    { date: "07.22", action: "Dylan Cease: Sent on a rehab assignment", type: "Transaction" }
  ]);

  const [todaysGames, setTodaysGames] = useState([
    { away: "Was", home: "ChC", time: "at" },
    { away: "SD", home: "Mia", time: "at" },
    { away: "SF", home: "Atl", time: "at" },
    { away: "Det", home: "Pit", time: "at" },
    { away: "LAA", home: "NYM", time: "at" }
  ]);

  // Navigation structure matching OnRoto
  const navigationSections = [
    {
      title: 'LEAGUE HOME',
      items: [
        { id: 'league-home', label: 'League Home', icon: Home },
        { id: 'standings', label: 'League Standings', icon: Trophy },
        { id: 'team-stats', label: 'Team Stats', icon: BarChart3 },
        { id: 'last-night', label: "Last Night's Boxes", icon: Calendar },
        { id: 'live-scoring', label: 'Live Scoring', icon: TrendingUp },
        { id: 'old-live-scoring', label: 'Old Live Scoring', icon: Clock }
      ]
    },
    {
      title: 'MY TEAM',
      items: [
        { id: 'team-home', label: 'Team Home', icon: Users },
        { id: 'team-rosters', label: 'Team Rosters', icon: Users },
        { id: 'available-players', label: 'Available Players', icon: Star },
        { id: 'mlb-player-data', label: 'MLB Player Data', icon: BarChart3 },
        { id: 'transaction-logs', label: 'Transaction Logs', icon: FileText },
        { id: 'print-reports', label: 'Print Reports', icon: FileText },
        { id: 'past-years', label: "Past Years' Results", icon: Calendar }
      ]
    },
    {
      title: 'TRANSACTIONS',
      items: [
        { id: 'make-transactions', label: 'Make Transactions', icon: Plus },
        { id: 'probable-pitchers', label: 'Probable Pitchers', icon: Target },
        { id: 'player-matchups', label: 'Player Matchups', icon: Users },
        { id: 'player-notes', label: 'Player Notes', icon: FileText },
        { id: 'watch-list', label: 'Watch List', icon: Star }
      ]
    },
    {
      title: 'COMMUNICATION',
      items: [
        { id: 'messages', label: 'Messages/Email/Polls/Chat', icon: MessageSquare },
        { id: 'toy-box', label: 'Toy Box', icon: Target }
      ]
    },
    {
      title: 'LEAGUE ADMIN',
      items: [
        { id: 'team-setup', label: 'Team Set-up Options', icon: Settings },
        { id: 'transactions-admin', label: 'Transactions', icon: FileText },
        { id: 'messages-admin', label: 'Messages/Email/Polls/Chat', icon: MessageSquare },
        { id: 'set-up', label: 'Set Up', icon: Settings }
      ]
    }
  ];

  useEffect(() => {
    loadLeague();
  }, [leagueId]);

  const loadLeague = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const mockLeague = {
        league_id: leagueId,
        league_name: "Harry Caray Memorial League (HCML)",
        status: "active",
        role: "commissioner",
        scoring_system: "rotisserie_ytd",
        current_week: "Week 17",
        season: "2025"
      };
      setLeague(mockLeague);
    } catch (error) {
      console.error('Error loading league:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const renderLeagueHome = () => (
    <div className="space-y-6">
      {/* League Header */}
      <div 
        className="dynasty-card p-6"
        style={{ background: dynastyUtils.getGradient('card') }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">{league?.league_name}</h1>
            <p className="dynasty-text-secondary">
              {league?.current_week} • {league?.season} Season • {league?.scoring_system?.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span 
              className="px-3 py-1 rounded text-sm font-semibold"
              style={{ backgroundColor: dynastyColors.success, color: dynastyColors.white }}
            >
              ACTIVE
            </span>
            {league?.role === 'commissioner' && (
              <span 
                className="px-3 py-1 rounded text-sm font-semibold"
                style={{ backgroundColor: dynastyColors.gold, color: dynastyColors.black }}
              >
                COMMISSIONER
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Standings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overall Standings */}
          <div 
            className="dynasty-card"
            style={{ background: dynastyUtils.getGradient('card') }}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: dynastyColors.gray }}>
              <h3 className="text-lg font-bold text-white">Overall Standings as of 07/22/25</h3>
              <button 
                onClick={() => setActiveSection('standings')}
                className="dynasty-button-secondary text-sm"
              >
                View Full Standings
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: dynastyColors.gray }}>
                    <th className="p-3 text-white font-semibold">Team</th>
                    <th className="p-3 text-white font-semibold">Pts</th>
                    <th className="p-3 text-white font-semibold">Team</th>
                    <th className="p-3 text-white font-semibold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.slice(0, 5).map((team, index) => (
                    <tr key={index} className="border-b hover:bg-black/20" style={{ borderColor: dynastyColors.gray }}>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">{index + 1}.</span>
                          <span className="text-white">{team.team}</span>
                        </div>
                      </td>
                      <td className="p-3 text-white">{team.points}</td>
                      <td className="p-3">
                        {standings[index + 5] && (
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-medium">{index + 6}.</span>
                            <span className="text-white">{standings[index + 5]?.team}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-white">
                        {standings[index + 5]?.points || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Current Trading Block */}
          <div 
            className="dynasty-card"
            style={{ background: dynastyUtils.getGradient('card') }}
          >
            <div className="p-4 border-b" style={{ borderColor: dynastyColors.gray }}>
              <h3 className="text-lg font-bold text-white">Current Trading Block</h3>
            </div>
            <div className="p-4">
              <div className="text-center py-8 dynasty-text-secondary">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No players currently on the trading block</p>
                <button className="dynasty-button-secondary mt-3 text-sm">
                  Add Players to Trading Block
                </button>
              </div>
            </div>
          </div>

          {/* Last Night's Box */}
          <div 
            className="dynasty-card"
            style={{ background: dynastyUtils.getGradient('card') }}
          >
            <div className="p-4 border-b" style={{ borderColor: dynastyColors.gray }}>
              <h3 className="text-lg font-bold text-white">Last Night's Box</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-white font-semibold mb-2">Active Hitters</h4>
                  <div className="space-y-1 text-sm">
                    <div className="dynasty-text-secondary">T.Soderstrom Oak 1B</div>
                    <div className="dynasty-text-secondary">J.Caballero TB 2B</div>
                    <div className="dynasty-text-secondary">O.Cruz Pit SS</div>
                  </div>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Active Pitchers</h4>
                  <div className="space-y-1 text-sm">
                    <div className="dynasty-text-secondary">G.Williams Cle</div>
                    <div className="dynasty-text-secondary">A.Nola Phi</div>
                    <div className="dynasty-text-secondary">R.Suarez SD</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Secondary Info */}
        <div className="space-y-6">
          {/* Recent MLB Transactions */}
          <div 
            className="dynasty-card"
            style={{ background: dynastyUtils.getGradient('card') }}
          >
            <div className="p-4 border-b" style={{ borderColor: dynastyColors.gray }}>
              <h3 className="text-lg font-bold text-white">Recent MLB Transactions</h3>
            </div>
            <div className="p-4 space-y-3">
              {recentTransactions.map((transaction, index) => (
                <div key={index} className="text-sm">
                  <div className="flex items-start space-x-2">
                    <span 
                      className="px-2 py-1 rounded text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: dynastyColors.info, color: dynastyColors.white }}
                    >
                      {transaction.date}
                    </span>
                    <span className="dynasty-text-secondary text-xs leading-relaxed">
                      {transaction.action}
                    </span>
                  </div>
                </div>
              ))}
              <button className="dynasty-button-secondary w-full text-sm mt-3">
                View All Transactions
              </button>
            </div>
          </div>

          {/* Today's MLB Scheduled Starters */}
          <div 
            className="dynasty-card"
            style={{ background: dynastyUtils.getGradient('card') }}
          >
            <div className="p-4 border-b" style={{ borderColor: dynastyColors.gray }}>
              <h3 className="text-lg font-bold text-white">07.23 MLB Scheduled Starters</h3>
            </div>
            <div className="p-4 space-y-2">
              {todaysGames.map((game, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="dynasty-text-secondary">
                    {game.away} {game.time} {game.home}
                  </span>
                  <span className="text-white">
                    Cin (Nick Lodolo)
                  </span>
                </div>
              ))}
              <button className="dynasty-button-secondary w-full text-sm mt-3">
                View All Games
              </button>
            </div>
          </div>

          {/* Private Messages */}
          <div 
            className="dynasty-card"
            style={{ background: dynastyUtils.getGradient('card') }}
          >
            <div className="p-4 border-b" style={{ borderColor: dynastyColors.gray }}>
              <h3 className="text-lg font-bold text-white">Private Messages</h3>
            </div>
            <div className="p-4 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: dynastyColors.lightGray }} />
              <p className="dynasty-text-secondary text-sm mb-3">
                You have 0 total messages and 0 unread messages
              </p>
              <button className="dynasty-button-secondary text-sm">
                Click here to view and send private messages
              </button>
            </div>
          </div>

          {/* Commissioner Messages */}
          <div 
            className="dynasty-card"
            style={{ background: dynastyUtils.getGradient('card') }}
          >
            <div className="p-4 border-b" style={{ borderColor: dynastyColors.gray }}>
              <h3 className="text-lg font-bold text-white">Commissioner Messages</h3>
            </div>
            <div className="p-4 text-center">
              <Crown className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: dynastyColors.gold }} />
              <p className="dynasty-text-secondary text-sm mb-3">
                There are 0 total messages and 0 unread messages
              </p>
              <button className="dynasty-button-secondary text-sm">
                Click here to view and send commissioner messages
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStandings = () => (
    <div 
      className="dynasty-card"
      style={{ background: dynastyUtils.getGradient('card') }}
    >
      <div className="p-6 border-b" style={{ borderColor: dynastyColors.gray }}>
        <h2 className="text-2xl font-bold text-white">League Standings</h2>
        <p className="dynasty-text-secondary">Current season standings and statistics</p>
      </div>
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: dynastyColors.gray }}>
                <th className="text-left p-3 text-white font-semibold">Rank</th>
                <th className="text-left p-3 text-white font-semibold">Team</th>
                <th className="text-left p-3 text-white font-semibold">Manager</th>
                <th className="text-left p-3 text-white font-semibold">Points</th>
                <th className="text-left p-3 text-white font-semibold">Games Back</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => (
                <tr key={index} className="border-b hover:bg-black/20" style={{ borderColor: dynastyColors.gray }}>
                  <td className="p-3 text-white font-semibold">{team.rank}</td>
                  <td className="p-3 text-white">{team.team}</td>
                  <td className="p-3 dynasty-text-secondary">{team.manager}</td>
                  <td className="p-3 text-white">{team.points}</td>
                  <td className="p-3 dynasty-text-secondary">
                    {index === 0 ? '-' : (standings[0].points - team.points).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderComingSoon = (title) => (
    <div 
      className="dynasty-card p-8 text-center"
      style={{ background: dynastyUtils.getGradient('card') }}
    >
      <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
      <div className="py-12 dynasty-text-secondary">
        <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: dynastyColors.lightGray }} />
        <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
        <p>This feature is under development and will be available soon.</p>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'league-home':
        return renderLeagueHome();
      case 'standings':
        return renderStandings();
      case 'team-stats':
        return renderComingSoon('Team Statistics');
      case 'last-night':
        return renderComingSoon("Last Night's Boxes");
      case 'live-scoring':
        return renderComingSoon('Live Scoring');
      case 'team-home':
        return renderComingSoon('Team Home');
      case 'team-rosters':
        return renderComingSoon('Team Rosters');
      case 'available-players':
        return renderComingSoon('Available Players');
      case 'mlb-player-data':
        return renderComingSoon('MLB Player Data');
      case 'make-transactions':
        return renderComingSoon('Make Transactions');
      case 'messages':
        return renderComingSoon('Messages');
      case 'team-setup':
        return renderComingSoon('Team Setup Options');
      default:
        return renderComingSoon('Feature');
    }
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
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-white hover:text-dynasty-gold"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-3 dynasty-text-secondary hover:text-white transition-colors"
            >
              <Crown className="w-8 h-8" style={{ color: dynastyColors.gold }} />
              <div className="text-left">
                <div className="text-xl font-bold text-white">Dynasty Dugout</div>
                <div className="text-sm">Return to Dashboard</div>
              </div>
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="dynasty-text-secondary hidden md:block">
              Welcome, {user?.given_name || user?.firstName}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 dynasty-text-secondary hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside 
          className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static w-80 min-h-screen border-r transition-transform duration-300 ease-in-out z-40`}
          style={{ 
            background: dynastyUtils.getGradient('card'),
            borderColor: dynastyColors.gold + '20'
          }}
        >
          <div className="p-4 h-full overflow-y-auto">
            {/* League Info */}
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: dynastyColors.darkLighter }}>
              <h3 className="text-lg font-bold text-white mb-2">{league?.league_name}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="dynasty-text-secondary">Status:</span>
                  <span style={{ color: dynastyColors.success }}>Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="dynasty-text-secondary">Role:</span>
                  <span style={{ color: dynastyColors.gold }}>Commissioner</span>
                </div>
                <div className="flex justify-between">
                  <span className="dynasty-text-secondary">Week:</span>
                  <span className="text-white">Week 17</span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-6">
                <h4 
                  className="text-xs font-semibold uppercase tracking-wider mb-3 px-2"
                  style={{ color: dynastyColors.gold }}
                >
                  {section.title}
                </h4>
                <nav className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveSection(item.id);
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'text-black font-semibold'
                            : 'text-white hover:text-white hover:bg-black/20'
                        }`}
                        style={{
                          backgroundColor: isActive ? dynastyColors.gold : 'transparent'
                        }}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {isActive && <ChevronRight className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default LeagueDashboard;