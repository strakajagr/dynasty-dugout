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
import { dynastyTheme } from '../services/colorService';
import LeagueSettings from '../components/LeagueSettings';

const LeagueDashboard = () => {
  const { leagueId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [standings, setStandings] = useState([]);
  const [activeSection, setActiveSection] = useState('league-home');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    loadLeagueData();
  }, [leagueId]);

  const loadLeagueData = async () => {
    try {
      setLoading(true);
      
      // Load league details
      const leagueResponse = await leaguesAPI.getLeagueDetails(leagueId);
      if (leagueResponse.success) {
        setLeague(leagueResponse.league);
      }

      // Load league standings (which includes team info)
      try {
        const standingsResponse = await leaguesAPI.getLeagueStandings(leagueId);
        if (standingsResponse.success) {
          setStandings(standingsResponse.standings || []);
          setTeams(standingsResponse.teams || []);
        }
      } catch (standingsError) {
        console.log('Standings not available yet - this is normal for new leagues');
        setStandings([]);
        setTeams([]);
      }

    } catch (error) {
      console.error('Error loading league data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleLeagueDeleted = (leagueName) => {
    navigate('/dashboard', { 
      state: { 
        message: `League "${leagueName}" has been permanently deleted.`,
        type: 'success'
      }
    });
  };

  const generateEmptyTeamSlots = () => {
    if (!league) return [];
    
    const maxTeams = league.max_teams || 12;
    const currentTeams = teams.length;
    const emptySlots = [];
    
    for (let i = currentTeams; i < maxTeams; i++) {
      emptySlots.push({
        slot: i + 1,
        team_name: "Awaiting New Owner",
        manager_name: null,
        points: null,
        isEmpty: true
      });
    }
    
    return emptySlots;
  };

  const getAllTeamSlots = () => {
    const filledTeams = teams.map((team, index) => ({
      ...team,
      slot: index + 1,
      isEmpty: false
    }));
    
    const emptySlots = generateEmptyTeamSlots();
    
    return [...filledTeams, ...emptySlots];
  };

  const renderLeagueHome = () => {
    const allTeamSlots = getAllTeamSlots();
    const halfPoint = Math.ceil(allTeamSlots.length / 2);
    const leftColumn = allTeamSlots.slice(0, halfPoint);
    const rightColumn = allTeamSlots.slice(halfPoint);

    return (
      <div className="space-y-6">
        {/* League Header */}
        <div className={`${dynastyTheme.components.card.base} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className={`text-3xl font-bold ${dynastyTheme.classes.text.white}`}>
                {league?.league_name || 'Loading...'}
              </h1>
              <p className={dynastyTheme.classes.text.neutralLight}>
                {league?.current_week} • {league?.season} Season • {league?.scoring_system?.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span 
                className={`px-3 py-1 rounded text-sm font-semibold ${dynastyTheme.classes.bg.success} ${dynastyTheme.classes.text.white}`}
              >
                {league?.status?.toUpperCase() || 'LOADING'}
              </span>
              {league?.role === 'commissioner' && (
                <span 
                  className={`px-3 py-1 rounded text-sm font-semibold ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black}`}
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
            <div className={dynastyTheme.components.card.base}>
              <div className={`flex items-center justify-between p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
                  Current League Status - {teams.length}/{league?.max_teams || 12} Teams
                </h3>
                <button 
                  onClick={() => setActiveSection('standings')}
                  className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}`}
                >
                  View Full Standings
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`text-left border-b ${dynastyTheme.classes.border.neutral}`}>
                      <th className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Team</th>
                      <th className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Pts</th>
                      <th className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Team</th>
                      <th className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leftColumn.map((team, index) => {
                      const rightTeam = rightColumn[index];
                      return (
                        <tr key={index} className={`border-b hover:bg-black/20 ${dynastyTheme.classes.transition} ${dynastyTheme.classes.border.neutral}`}>
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              <span className={`${dynastyTheme.classes.text.white} font-medium`}>{team.slot}.</span>
                              <span className={team.isEmpty ? "text-neutral-400 italic" : dynastyTheme.classes.text.white}>
                                {team.team_name}
                              </span>
                              {team.manager_name && (
                                <span className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                                  ({team.manager_name})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`p-3 ${dynastyTheme.classes.text.white}`}>
                            {team.points !== null ? team.points : '-'}
                          </td>
                          <td className="p-3">
                            {rightTeam && (
                              <div className="flex items-center space-x-2">
                                <span className={`${dynastyTheme.classes.text.white} font-medium`}>{rightTeam.slot}.</span>
                                <span className={rightTeam.isEmpty ? "text-neutral-400 italic" : dynastyTheme.classes.text.white}>
                                  {rightTeam.team_name}
                                </span>
                                {rightTeam.manager_name && (
                                  <span className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                                    ({rightTeam.manager_name})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className={`p-3 ${dynastyTheme.classes.text.white}`}>
                            {rightTeam && rightTeam.points !== null ? rightTeam.points : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {teams.length === 0 && (
                <div className="p-6 text-center">
                  <Users className={`w-12 h-12 mx-auto mb-3 opacity-50 ${dynastyTheme.classes.text.neutralLight}`} />
                  <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-2`}>League Setup in Progress</h4>
                  <p className={`text-sm mb-4 ${dynastyTheme.classes.text.neutralLight}`}>
                    This league can support up to {league?.max_teams || 12} teams. 
                    Once owners join, standings will appear here.
                  </p>
                  {league?.role === 'commissioner' && (
                    <button className={`${dynastyTheme.utils.getComponent('button', 'primary', 'sm')}`}>
                      Invite Team Owners
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Current Trading Block */}
            <div className={dynastyTheme.components.card.base}>
              <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Current Trading Block</h3>
              </div>
              <div className="p-4">
                <div className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No players currently on the trading block</p>
                  <button className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} mt-3`}>
                    Add Players to Trading Block
                  </button>
                </div>
              </div>
            </div>

            {/* Last Night's Box */}
            <div className={dynastyTheme.components.card.base}>
              <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Last Night's Box</h3>
              </div>
              <div className="p-4">
                <div className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No game data available yet</p>
                  <p className="text-xs mt-2">Game boxes will appear here once the season starts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Secondary Info */}
          <div className="space-y-6">
            {/* League Information */}
            <div className={dynastyTheme.components.card.base}>
              <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>League Information</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className={dynastyTheme.classes.text.neutralLight}>Scoring:</span>
                  <span className={dynastyTheme.classes.text.white}>{league?.scoring_system?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={dynastyTheme.classes.text.neutralLight}>Player Pool:</span>
                  <span className={dynastyTheme.classes.text.white}>{league?.player_pool?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={dynastyTheme.classes.text.neutralLight}>Max Teams:</span>
                  <span className={dynastyTheme.classes.text.white}>{league?.max_teams}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={dynastyTheme.classes.text.neutralLight}>Salary Cap:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    {league?.use_salaries ? `$${league?.salary_cap}` : 'None'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={dynastyTheme.classes.text.neutralLight}>Created:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    {league?.created_at ? new Date(league.created_at).toLocaleDateString() : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent MLB Transactions */}
            <div className={dynastyTheme.components.card.base}>
              <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Recent MLB Transactions</h3>
              </div>
              <div className="p-4 text-center">
                <MessageSquare className={`w-12 h-12 mx-auto mb-3 opacity-50 ${dynastyTheme.classes.text.neutralLight}`} />
                <p className={`text-sm mb-3 ${dynastyTheme.classes.text.neutralLight}`}>
                  MLB transaction feed coming soon
                </p>
              </div>
            </div>

            {/* Private Messages */}
            <div className={dynastyTheme.components.card.base}>
              <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Private Messages</h3>
              </div>
              <div className="p-4 text-center">
                <MessageSquare className={`w-12 h-12 mx-auto mb-3 opacity-50 ${dynastyTheme.classes.text.neutralLight}`} />
                <p className={`text-sm mb-3 ${dynastyTheme.classes.text.neutralLight}`}>
                  You have 0 total messages and 0 unread messages
                </p>
                <button className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}`}>
                  Click here to view and send private messages
                </button>
              </div>
            </div>

            {/* Commissioner Messages */}
            <div className={dynastyTheme.components.card.base}>
              <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Commissioner Messages</h3>
              </div>
              <div className="p-4 text-center">
                <Crown className={`w-12 h-12 mx-auto mb-3 opacity-50 ${dynastyTheme.classes.text.primary}`} />
                <p className={`text-sm mb-3 ${dynastyTheme.classes.text.neutralLight}`}>
                  There are 0 total messages and 0 unread messages
                </p>
                <button className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}`}>
                  Click here to view and send commissioner messages
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStandings = () => {
    const allTeamSlots = getAllTeamSlots();
    
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className={`p-6 border-b ${dynastyTheme.classes.border.neutral}`}>
          <h2 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white}`}>League Standings</h2>
          <p className={dynastyTheme.classes.text.neutralLight}>
            Current season standings - {teams.length}/{league?.max_teams || 12} teams joined
          </p>
        </div>
        <div className="p-6">
          {allTeamSlots.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${dynastyTheme.classes.border.neutral}`}>
                    <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Rank</th>
                    <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Team</th>
                    <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Manager</th>
                    <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Points</th>
                    <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allTeamSlots.map((team, index) => (
                    <tr key={index} className={`border-b hover:bg-black/20 ${dynastyTheme.classes.transition} ${dynastyTheme.classes.border.neutral}`}>
                      <td className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>{team.slot}</td>
                      <td className={`p-3 ${team.isEmpty ? 'text-neutral-400 italic' : dynastyTheme.classes.text.white}`}>
                        {team.team_name}
                      </td>
                      <td className={`p-3 ${dynastyTheme.classes.text.neutralLight}`}>
                        {team.manager_name || '-'}
                      </td>
                      <td className={`p-3 ${dynastyTheme.classes.text.white}`}>
                        {team.points !== null ? team.points : '-'}
                      </td>
                      <td className="p-3">
                        {team.isEmpty ? (
                          <span className={`px-2 py-1 rounded text-xs ${dynastyTheme.classes.bg.warning} ${dynastyTheme.classes.text.black}`}>
                            Open
                          </span>
                        ) : (
                          <span className={`px-2 py-1 rounded text-xs ${dynastyTheme.classes.bg.success} ${dynastyTheme.classes.text.white}`}>
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className={`w-16 h-16 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLight}`} />
              <h3 className={`text-xl font-semibold mb-2 ${dynastyTheme.classes.text.white}`}>No Teams Yet</h3>
              <p className={dynastyTheme.classes.text.neutralLight}>
                Standings will appear here once team owners join the league.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderComingSoon = (title) => (
    <div className={`${dynastyTheme.components.card.base} p-8 text-center`}>
      <h2 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white} mb-4`}>{title}</h2>
      <div className={`py-12 ${dynastyTheme.classes.text.neutralLight}`}>
        <FileText className={`w-16 h-16 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLight}`} />
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
      case 'set-up':
        return (
          <LeagueSettings 
            leagueId={leagueId}
            user={user}
            onLeagueDeleted={handleLeagueDeleted}
          />
        );
      default:
        return renderComingSoon('Feature');
    }
  };

  if (loading) {
    return (
      <div className={dynastyTheme.components.page}>
        <div className="flex justify-center items-center min-h-screen">
          <div className="flex items-center space-x-3">
            <div 
              className={`w-8 h-8 border-2 border-t-transparent animate-spin rounded-full ${dynastyTheme.classes.border.primary}`}
            />
            <span className={`${dynastyTheme.classes.text.white} text-lg`}>Loading league...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={dynastyTheme.components.page}>
      {/* Header */}
      <header 
        className={`px-6 py-4 border-b ${dynastyTheme.components.card.base} ${dynastyTheme.classes.border.light}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`lg:hidden ${dynastyTheme.classes.text.white} hover:text-yellow-400`}
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className={`flex items-center space-x-3 hover:text-white ${dynastyTheme.classes.transition} ${dynastyTheme.classes.text.neutralLight}`}
            >
              <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
              <div className="text-left">
                <div className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Dynasty Dugout</div>
                <div className="text-sm">Return to Dashboard</div>
              </div>
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className={`hidden md:block ${dynastyTheme.classes.text.neutralLight}`}>
              Welcome, {user?.given_name || user?.firstName}
            </span>
            <button
              onClick={handleSignOut}
              className={`flex items-center space-x-2 hover:text-white ${dynastyTheme.classes.transition} ${dynastyTheme.classes.text.neutralLight}`}
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
          className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static w-80 min-h-screen border-r ${dynastyTheme.classes.transition} duration-300 ease-in-out z-40 ${dynastyTheme.components.card.base} ${dynastyTheme.classes.border.light}`}
        >
          <div className="p-4 h-full overflow-y-auto">
            {/* League Info */}
            <div className={`mb-6 p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white} mb-2`}>
                {league?.league_name || 'Loading...'}
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Status:</span>
                  <span className={dynastyTheme.classes.text.success}>
                    {league?.status || 'Loading'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Role:</span>
                  <span className={dynastyTheme.classes.text.primary}>
                    {league?.role || 'Loading'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Teams:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    {teams.length}/{league?.max_teams || 12}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-6">
                <h4 
                  className={`text-xs font-semibold uppercase tracking-wider mb-3 px-2 ${dynastyTheme.classes.text.primary}`}
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
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-semibold ${dynastyTheme.classes.transition} ${
                          isActive
                            ? `${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black}`
                            : `${dynastyTheme.classes.text.white} hover:text-white hover:bg-black/20`
                        }`}
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