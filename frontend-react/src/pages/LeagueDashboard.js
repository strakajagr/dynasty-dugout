// src/pages/LeagueDashboard.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Crown, Users, Trophy, BarChart3, Calendar, MessageSquare,
  Settings, FileText, Star, Target, TrendingUp, Clock,
  Home, UserPlus, LogOut, Menu, X, ChevronRight, Plus,
  Search, UserCheck  // ✅ NEW: Icons for free agent system
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';
import LeagueSettings from '../components/LeagueSettings';

// Import the modular components
import LeagueHome from './league-dashboard/LeagueHome';
import LeagueOwners from './league-dashboard/LeagueOwners';
import LeagueStandings from './league-dashboard/LeagueStandings';
import ComingSoon from './league-dashboard/ComingSoon';
import TeamHomeDashboard from './league-dashboard/TeamHomeDashboard';

// ✅ NEW: Import free agent system components
import FreeAgentSearch from './league-dashboard/FreeAgentSearch';
import MyRoster from './league-dashboard/MyRoster';

const LeagueDashboard = () => {
  const { leagueId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  // ========================================
  // STATE MANAGEMENT - All shared state lives here
  // ========================================
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]); // Competitive data from /standings
  const [standings, setStandings] = useState([]);
  const [owners, setOwners] = useState([]); // Administrative data from /owners
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('league-home');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Navigation structure
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
        { id: 'my-roster', label: 'My Roster', icon: UserCheck }, // ✅ NEW: My Roster
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
        { id: 'free-agents', label: 'Free Agent Market', icon: Search }, // ✅ NEW: Free Agents
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
        { id: 'league-owners', label: 'League Owners', icon: UserPlus },
        { id: 'transactions-admin', label: 'Transactions', icon: FileText },
        { id: 'messages-admin', label: 'Messages/Email/Polls/Chat', icon: MessageSquare },
        { id: 'set-up', label: 'Set Up', icon: Settings }
      ]
    }
  ];

  // ========================================
  // DATA LOADING - Centralized data management
  // ========================================
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

      // Load owner management data (administrative)
      try {
        setOwnersLoading(true);
        const ownersResponse = await leaguesAPI.getLeagueOwners(leagueId);
        if (ownersResponse.success) {
          setOwners(ownersResponse.owners || []);
        }
      } catch (ownersError) {
        console.log('Owner data not available:', ownersError);
        setOwners([]);
      } finally {
        setOwnersLoading(false);
      }

      // Load league standings (competitive)
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

  // ========================================
  // EVENT HANDLERS
  // ========================================
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

  // ✅ NEW: Handle free agent system events
  const handlePlayerAdded = (player) => {
    console.log('Player added to team:', player);
    // Optional: Show success message, refresh data, etc.
    // loadLeagueData(); // Could refresh data if needed
  };

  const handlePlayerDropped = (player) => {
    console.log('Player dropped from team:', player);
    // Optional: Show success message, refresh data, etc.
    // loadLeagueData(); // Could refresh data if needed
  };

  // ========================================
  // CONTENT RENDERING - Route to appropriate component
  // ========================================
  const renderContent = () => {
    // Shared props that all components might need
    const sharedProps = {
      league,
      leagueId,
      user,
      teams,
      standings,
      owners,
      ownersLoading,
      loadLeagueData, // Allow child components to refresh data
      setActiveSection
    };

    switch (activeSection) {
      case 'league-home':
        return <LeagueHome {...sharedProps} />;
      
      case 'standings':
        return <LeagueStandings {...sharedProps} />;
      
      case 'league-owners':
        return <LeagueOwners {...sharedProps} />;
      
      case 'team-home':
        // Find the current user's team
        const userTeam = teams?.find(team => team.user_id === user?.user_id);
        if (!userTeam) {
          return (
            <div className={dynastyTheme.components.card.base}>
              <div className={`${dynastyTheme.classes.text.white} p-6 text-center`}>
                <h3 className={dynastyTheme.components.heading.h3}>No Team Found</h3>
                <p className={dynastyTheme.classes.text.neutralLight}>
                  You don't have a team in this league yet. Contact the commissioner to join!
                </p>
                <button
                  onClick={() => setActiveSection('league-owners')}
                  className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} mt-4`}
                >
                  View Owner Management
                </button>
              </div>
            </div>
          );
        }
        return (
          <TeamHomeDashboard
            teamId={userTeam.team_id}
            leagueId={leagueId}
            currentUser={user}
          />
        );

      // ✅ NEW: Free Agent System routes
      case 'free-agents':
        return (
          <FreeAgentSearch 
            leagueId={leagueId}
            onPlayerAdded={handlePlayerAdded}
          />
        );

      case 'my-roster':
        return (
          <MyRoster 
            leagueId={leagueId}
            onPlayerDropped={handlePlayerDropped}
          />
        );
      
      case 'set-up':
        return (
          <LeagueSettings 
            leagueId={leagueId}
            user={user}
            onLeagueDeleted={handleLeagueDeleted}
          />
        );
      
      // All the coming soon pages
      case 'team-stats':
        return <ComingSoon title="Team Statistics" />;
      case 'last-night':
        return <ComingSoon title="Last Night's Boxes" />;
      case 'live-scoring':
        return <ComingSoon title="Live Scoring" />;
      case 'team-rosters':
        return <ComingSoon title="Team Rosters" />;
      case 'available-players':
        return <ComingSoon title="Available Players" />;
      case 'mlb-player-data':
        return <ComingSoon title="MLB Player Data" />;
      case 'make-transactions':
        return <ComingSoon title="Make Transactions" />;
      case 'messages':
        return <ComingSoon title="Messages" />;
      case 'team-setup':
        return <ComingSoon title="Team Setup Options" />;
      default:
        return <ComingSoon title="Feature" />;
    }
  };

  // ========================================
  // LOADING STATE
  // ========================================
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

  // ========================================
  // MAIN LAYOUT RENDER
  // ========================================
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