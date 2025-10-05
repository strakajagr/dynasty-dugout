// src/pages/LeagueDashboard.js - COMPLETE WITH LEAGUE PLAYER SEARCH
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Crown, Users, Trophy, BarChart3, Calendar, MessageSquare,
  Settings, FileText, Star, Target, TrendingUp,
  Home, UserPlus, LogOut, Menu, X, ChevronRight,
  Search, UserCheck, Shield, Activity, DollarSign,
  ArrowRightLeft, Gavel, AlertCircle, User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PlayerModalProvider } from '../contexts/PlayerModalContext';
import { leaguesAPI } from '../services/apiService';
import apiService from '../services/apiService';
import { dynastyTheme } from '../services/colorService';
import { useCommissioner } from '../contexts/CommissionerContext';
import LeagueSettings from '../components/LeagueSettings';

// Import the league-specific player search
import PlayerSearchDropdownLeague from '../components/PlayerSearchDropdownLeague';
import PositionAssignmentDropdown from '../components/league-dashboard/PositionAssignmentDropdown';
import { analyzeRosterCapacity } from '../utils/RosterCapacityUtils';

// Import the modular components
import LeagueHome from './league-dashboard/LeagueHome';
import LeagueOwners from './league-dashboard/LeagueOwners';
import LeagueStandings from './league-dashboard/LeagueStandings';
import ComingSoon from './league-dashboard/ComingSoon';
import TeamHomeDashboard from './league-dashboard/TeamHomeDashboard';
import FreeAgentSearch from './league-dashboard/FreeAgentSearch';
import MyRoster from './league-dashboard/MyRoster';
import TeamStats from './league-dashboard/TeamStats';
import SalaryContractSettings from './league-dashboard/salary-contract/SalaryContractSettings';
import TransactionLog from './league-dashboard/TransactionLog';
import CommissionerControls from './league-dashboard/CommissionerControls';
import TeamSetup from './league-dashboard/TeamSetup';
import { WatchList } from '../components/WatchList/WatchList';

const LeagueDashboard = () => {
  const { leagueId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Call the hook unconditionally (React Hooks rule)
  const commissionerContext = useCommissioner();
  
  // Then safely extract the functions with null checks
  const setActiveTeamId = commissionerContext?.setActiveTeamId || null;
  const setActiveTeamName = commissionerContext?.setActiveTeamName || null;
  
  // Position assignment modal state (MOVED TO TOP LEVEL)
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [playerForAssignment, setPlayerForAssignment] = useState(null);
  const [positionModalRoster, setPositionModalRoster] = useState([]);
  const [positionModalCapacity, setPositionModalCapacity] = useState(null);
  
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [userTeam, setUserTeam] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [standings, setStandings] = useState([]);
  const [owners, setOwners] = useState([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('league-home');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  
  // Track team being viewed from TeamLinkDropdown navigation
  const [viewingTeamId, setViewingTeamId] = useState(null);
  const [viewingTeamName, setViewingTeamName] = useState(null);

  // Add global styles for glow effect
  useEffect(() => {
    const styleId = 'dynasty-global-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = dynastyTheme.utils.globalStyles;
      document.head.appendChild(style);
    }
  }, []);

  // Handle navigation state for section switching AND team selection
  useEffect(() => {
    if (location.state?.activeSection) {
      console.log('Setting active section from navigation:', location.state.activeSection);
      
      // Map the section names correctly
      let sectionToSet = location.state.activeSection;
      if (sectionToSet === 'team-roster') {
        sectionToSet = 'my-roster';
      }
      
      setActiveSection(sectionToSet);
      
      // Handle team selection from TeamLinkDropdown
      if (location.state.targetTeamId && location.state.targetTeamName) {
        console.log('Setting target team from navigation:', {
          id: location.state.targetTeamId,
          name: location.state.targetTeamName
        });
        
        // Store the team being viewed
        setViewingTeamId(location.state.targetTeamId);
        setViewingTeamName(location.state.targetTeamName);
        
        // If user is commissioner and context is available, set active team for editing
        if (league?.role === 'commissioner') {
          try {
            if (typeof setActiveTeamId === 'function') {
              setActiveTeamId(location.state.targetTeamId);
            }
            if (typeof setActiveTeamName === 'function') {
              setActiveTeamName(location.state.targetTeamName);
            }
          } catch (error) {
            console.warn('Could not set commissioner context:', error);
          }
        }
      }
      
      // Clear the state to prevent repeat navigation
      window.history.replaceState(null, '');
    }
  }, [location.state, league?.role]);

  // Load user profile picture from MyAccount
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      const response = await apiService.get('/api/account/profile');
      if (response.data && response.data.profile) {
        setUserProfile({
          profilePicture: response.data.profile.picture || null,
          firstName: response.data.profile.given_name || user?.given_name || '',
          lastName: response.data.profile.family_name || user?.family_name || '',
          email: response.data.profile.email || user?.email || ''
        });
      }
    } catch (error) {
      console.log('Could not load user profile picture:', error);
    }
  };

  // Check if league needs setup attention
  const needsSetupAttention = () => {
    return league?.role === 'commissioner' && 
           (league?.league_status === 'setup' || 
            league?.league_status === 'pricing' || 
            league?.league_status === 'draft_ready');
  };

  // ========================================
  // NAVIGATION WITH CONDITIONAL SALARY SETTINGS
  // ========================================
  const getNavigationSections = () => {
    const sections = [
      {
        title: 'LEAGUE',
        items: [
          { id: 'league-home', label: 'League Home', icon: Home },
          { id: 'standings', label: 'Standings', icon: Trophy },
          { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
          { id: 'live-scoring', label: 'Live Scoring', icon: Activity },
          { id: 'messages', label: 'League Chat', icon: MessageSquare },
        ]
      },
      {
        title: 'MY TEAM',
        items: [
          { id: 'team-home', label: 'Team Dashboard', icon: Users },
          { id: 'team-stats', label: 'Team Stats', icon: BarChart3 },
          { id: 'my-roster', label: 'My Roster', icon: UserCheck },
          { id: 'free-agents', label: 'Free Agents', icon: Search },
          { id: 'watch-list', label: 'Watch List', icon: Star },
          { id: 'team-setup', label: 'Team Setup', icon: Settings },
        ]
      },
      {
        title: 'PLAYERS & STATS',
        items: [
          { id: 'mlb-player-data', label: 'Player Stats', icon: BarChart3 },
          { id: 'team-rosters', label: 'All Team Rosters', icon: Users },
          { id: 'probable-pitchers', label: 'Probable Pitchers', icon: Target },
          { id: 'last-night', label: "Yesterday's Games", icon: Calendar },
        ]
      },
    ];

    // Only show admin section if user is commissioner
    if (league?.role === 'commissioner') {
      const commissionerItems = [
        { id: 'league-owners', label: 'Manage Owners', icon: UserPlus },
        { id: 'set-up', label: 'League Settings', icon: Settings },
      ];
      
      // ADD SALARY SETTINGS IF ENABLED
      if (league?.salary_cap_enabled || league?.has_salary_cap || league?.use_salaries) {
        commissionerItems.push({ 
          id: 'salary-settings', 
          label: 'Salary/Contract Settings', 
          icon: DollarSign
        });
      }
      
      commissionerItems.push({ 
        id: 'season-setup',
        label: 'Season Setup',
        icon: Gavel,
        needsAttention: needsSetupAttention()
      });
      commissionerItems.push({ id: 'admin-tools', label: 'Admin Tools', icon: Shield });
      
      sections.push({
        title: 'COMMISSIONER',
        items: commissionerItems
      });
    }

    return sections;
  };

  // ========================================
  // DATA LOADING - WITH PROPER ERROR HANDLING
  // ========================================
  useEffect(() => {
    if (leagueId) {
      loadLeagueData();
    }
  }, [leagueId, reloadTrigger]);

  const loadLeagueData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      
      // Load league details with error handling
      let leagueData = null;
      try {
        const leagueResponse = await leaguesAPI.getLeagueDetails(leagueId);
        if (leagueResponse.success) {
          leagueData = leagueResponse.league;
          setLeague(leagueData);
        }
      } catch (leagueError) {
        console.error('Failed to load league details:', leagueError);
        
        // If league not found or access denied, show error and redirect
        if (leagueError.response?.status === 404) {
          setLoadError('League not found. It may have been deleted or the ID is incorrect.');
          setTimeout(() => {
            navigate('/dashboard', { 
              state: { 
                message: 'League not found or you do not have access to this league.',
                type: 'error'
              }
            });
          }, 3000);
          return;
        } else if (leagueError.response?.status === 403) {
          setLoadError('You do not have access to this league.');
          setTimeout(() => {
            navigate('/dashboard', { 
              state: { 
                message: 'Access denied. You are not a member of this league.',
                type: 'error'
              }
            });
          }, 3000);
          return;
        }
        
        // For other errors, try to continue with limited functionality
        setLoadError('Some features may be limited due to connection issues.');
      }

      // Try to get user's team directly
      try {
        const userTeamResponse = await leaguesAPI.getUserTeam(leagueId);
        if (userTeamResponse.success && userTeamResponse.team_id) {
          setUserTeam(userTeamResponse);
        }
      } catch (teamError) {
        console.log('Could not fetch user team directly:', teamError);
      }

      // Load owner management data
      try {
        setOwnersLoading(true);
        const ownersResponse = await leaguesAPI.getLeagueOwners(leagueId);
        if (ownersResponse.success) {
          setOwners(ownersResponse.owners || []);
          
          // Fallback: Find user's team from owners data
          if (!userTeam && ownersResponse.owners?.length > 0) {
            const ownerWithTeam = ownersResponse.owners.find(
              owner => owner.user_id === user?.user_id || owner.email === user?.email
            );
            if (ownerWithTeam && ownerWithTeam.team_id) {
              setUserTeam({
                team_id: ownerWithTeam.team_id,
                team_name: ownerWithTeam.team_name || `Team ${ownerWithTeam.slot_number}`,
                team_logo_url: ownerWithTeam.team_logo_url,
                team_colors: ownerWithTeam.team_colors,
                manager_name: ownerWithTeam.manager_name,
                user_id: user?.user_id
              });
            }
          }
        }
      } catch (ownersError) {
        console.log('Owner data not available:', ownersError);
        setOwners([]);
      } finally {
        setOwnersLoading(false);
      }

      // Load league standings
      try {
        const standingsResponse = await leaguesAPI.getLeagueStandings(leagueId);
        if (standingsResponse.success) {
          setStandings(standingsResponse.standings || []);
          setTeams(standingsResponse.teams || []);
          
          // Another fallback: Find user's team from standings/teams
          if (!userTeam && standingsResponse.teams?.length > 0) {
            const teamFromStandings = standingsResponse.teams.find(
              team => team.user_id === user?.user_id
            );
            if (teamFromStandings) {
              setUserTeam(teamFromStandings);
            }
          }
        }
      } catch (standingsError) {
        console.log('Standings not available yet');
        setStandings([]);
        setTeams([]);
      }

      // Final fallback for commissioner
      if (!userTeam && leagueData?.role === 'commissioner') {
        setUserTeam({
          team_id: 'commissioner-team',
          team_name: 'Commissioner Team',
          user_id: user?.user_id
        });
      }

    } catch (error) {
      console.error('Unexpected error loading league data:', error);
      setLoadError('An unexpected error occurred. Please try again later.');
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

  const handlePlayerAdded = (player) => {
    console.log('Player added to team:', player);
    // Trigger a reload of league data
    setReloadTrigger(prev => prev + 1);
  };

  const handlePlayerDropped = (player) => {
    console.log('Player dropped from team:', player);
    // Trigger a reload of league data
    setReloadTrigger(prev => prev + 1);
  };

  // Handler for opening position assignment modal from search
  const handleOpenPositionModal = async (player) => {
    try {
      // Load roster
      const rosterResponse = await leaguesAPI.getMyRosterCanonical(leagueId);
      if (rosterResponse.success && rosterResponse.players) {
        setPositionModalRoster(rosterResponse.players);
        
        // Analyze capacity
        const analysis = analyzeRosterCapacity(rosterResponse.players, league);
        setPositionModalCapacity(analysis);
        
        // Set player and show modal
        setPlayerForAssignment(player);
        setShowPositionModal(true);
      }
    } catch (error) {
      console.error('Failed to load roster for position assignment:', error);
    }
  };

  // Handler for completing position assignment
  const handleCompletePositionAssignment = async (assignmentData) => {
    const { player, assignment } = assignmentData;
    
    try {
      const response = await leaguesAPI.addPlayerToTeam(leagueId, {
        league_player_id: player.leagueData?.league_player_id,
        salary: assignment.roster_status === 'minors' ? 0 : (player.leagueData?.salary || league?.min_salary || 1),
        contract_years: assignment.roster_status === 'minors' ? 0 : 1,
        roster_status: assignment.roster_status,
        roster_position: assignment.roster_position,
        start_contract: assignment.roster_status !== 'minors'
      });
      
      if (response.success) {
        // Close modal
        setShowPositionModal(false);
        setPlayerForAssignment(null);
        setPositionModalRoster([]);
        setPositionModalCapacity(null);
        
        // Trigger reload
        handlePlayerAdded(player);
      }
    } catch (error) {
      console.error('Failed to add player:', error);
      throw error; // Let modal handle error display
    }
  };

  const handleStatusChange = () => {
    console.log('League status changed, reloading data...');
    loadLeagueData();
  };

  // ========================================
  // USER PROFILE PICTURE COMPONENT
  // ========================================
  const UserProfilePicture = () => {
    const handleProfileClick = () => {
      navigate('/my-account');
    };

    const profileContent = userProfile?.profilePicture ? (
      <img 
        src={userProfile.profilePicture}
        alt={`${userProfile.firstName || user?.given_name || 'User'} Profile`}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.target.style.display = 'none';
          const fallbackDiv = e.target.parentElement.querySelector('.initials-fallback');
          if (fallbackDiv) {
            fallbackDiv.style.display = 'flex';
          }
        }}
      />
    ) : null;

    const initials = `${(userProfile?.firstName || user?.given_name || 'U')[0]}${(userProfile?.lastName || user?.family_name || 'U')[0]}`.toUpperCase();
    
    return (
      <button 
        onClick={handleProfileClick}
        className="flex items-center gap-2 group"
        title="Go to My Account"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-yellow-400/50 shadow-xl transition-all duration-300 group-hover:border-yellow-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(250,204,21,0.6)]">
            {profileContent}
            <div 
              className="initials-fallback w-full h-full flex items-center justify-center text-xl font-bold bg-gradient-to-br from-yellow-400 to-yellow-500 text-black"
              style={{ display: userProfile?.profilePicture ? 'none' : 'flex' }}
            >
              {initials}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xs text-yellow-400 font-semibold group-hover:text-yellow-300 transition-colors">
            My Account
          </span>
          <span className="text-[10px] text-neutral-400 group-hover:text-neutral-300 transition-colors">
            {userProfile?.firstName || user?.given_name || 'Profile'} {userProfile?.lastName?.[0] || user?.family_name?.[0] || ''}.
          </span>
        </div>
      </button>
    );
  };

  // ========================================
  // CONTENT RENDERING WITH PROPER PROPS
  // ========================================
  const renderContent = () => {
    // Show error state if critical error occurred
    if (loadError && !league) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
          <h2 className={`text-2xl font-bold ${dynastyTheme.classes.text.white} mb-2`}>
            Error Loading League
          </h2>
          <p className={`${dynastyTheme.classes.text.neutralLight} mb-4 text-center max-w-md`}>
            {loadError}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    const sharedProps = {
      league,
      leagueId,
      user,
      teams,
      standings,
      owners,
      ownersLoading,
      loadLeagueData,
      setActiveSection,
      userTeam
    };

    switch (activeSection) {
      case 'league-home':
        return <LeagueHome {...sharedProps} />;
      
      case 'standings':
        return <LeagueStandings {...sharedProps} />;
      
      case 'team-stats':
        return (
          <TeamStats 
            leagueId={leagueId}
            league={league}
            user={user}
            teams={teams.length > 0 ? teams : owners}
            userTeam={userTeam}
            // Pass viewing team info if navigated from TeamLinkDropdown
            initialViewTeamId={viewingTeamId}
            initialViewTeamName={viewingTeamName}
          />
        );
      
      case 'transactions':
        return (
          <TransactionLog 
            leagueId={leagueId}
            leagueStatus={league?.league_status}
          />
        );
      
      case 'league-owners':
        return <LeagueOwners {...sharedProps} />;
      
      case 'team-home': {
        const teamToUse = userTeam || {
          team_id: `team-${user?.user_id}`,
          team_name: `${user?.firstName || user?.given_name || 'My'} Team`,
          user_id: user?.user_id
        };
        
        return (
          <TeamHomeDashboard
            teamId={teamToUse.team_id}
            leagueId={leagueId}
            currentUser={user}
            league={league}
            userTeam={teamToUse}
          />
        );
      }

      case 'free-agents':
        return (
          <FreeAgentSearch 
            leagueId={leagueId}
            onPlayerAdded={handlePlayerAdded}
            league={league}
            user={user}
          />
        );

      case 'my-roster':
        return (
          <MyRoster 
            leagueId={leagueId}
            league={league}
            user={user}
            onPlayerDropped={handlePlayerDropped}
            // Pass viewing team info if navigated from TeamLinkDropdown
            initialViewTeamId={viewingTeamId}
            initialViewTeamName={viewingTeamName}
          />
        );

      case 'team-setup':
        return (
          <TeamSetup 
            leagueId={leagueId}
            userTeam={userTeam}
            onTeamUpdated={loadLeagueData}
            user={user}
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
      
      case 'salary-settings':
        return league?.role === 'commissioner' ? (
          <SalaryContractSettings 
            leagueId={leagueId}
            league={league}
            user={user}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <ComingSoon title="Unauthorized" description="Commissioner access only" />
        );
      
      case 'season-setup':
        return league?.role === 'commissioner' ? (
          <CommissionerControls
            leagueId={leagueId}
            league={league}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <ComingSoon title="Unauthorized" description="Commissioner access only" />
        );
      
      // Watch List - Render inline with league context
      case 'watch-list':
        return (
          <WatchList 
            leagueId={leagueId}
            league={league}
            userTeam={userTeam}
          />
        );
      
      // Coming soon pages
      case 'live-scoring':
        return <ComingSoon title="Live Scoring" description="Real-time game scores and stats" />;
      case 'messages':
        return <ComingSoon title="League Chat" description="Communicate with your league" />;
      case 'mlb-player-data':
        return <ComingSoon title="Player Stats" description="Comprehensive MLB player statistics" />;
      case 'team-rosters':
        return <ComingSoon title="All Team Rosters" description="View every team's roster" />;
      case 'probable-pitchers':
        return <ComingSoon title="Probable Pitchers" description="Upcoming pitching matchups" />;
      case 'last-night':
        return <ComingSoon title="Yesterday's Games" description="Results from last night's games" />;
      case 'admin-tools':
        return <ComingSoon title="Admin Tools" description="Commissioner controls" />;
      default:
        return <ComingSoon title="Feature" description="This feature is coming soon" />;
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
  // MAIN LAYOUT WITH PLAYER MODAL PROVIDER
  // ========================================
  return (
    <PlayerModalProvider 
      leagueId={leagueId}
      userTeamId={userTeam?.team_id}
      isCommissionerMode={league?.role === 'commissioner'}
    >
      <div className={dynastyTheme.components.page}>
        {/* Header with User Profile Picture and Player Search */}
        <header 
          className={`px-6 py-4 border-b ${dynastyTheme.components.card.base} ${dynastyTheme.classes.border.light}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <UserProfilePicture />
              
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
            
            {/* PLAYER SEARCH - LEAGUE VERSION WITH PRICING & TRANSACTIONS */}
            <PlayerSearchDropdownLeague 
              leagueId={leagueId}
              league={league}
              userTeam={userTeam}
              onPlayerAdded={handlePlayerAdded}
              onPlayerDropped={handlePlayerDropped}
              onOpenPositionModal={handleOpenPositionModal}
            />
            
            <div className="flex items-center space-x-4">
              {/* Warning if there was a non-critical error */}
              {loadError && league && (
                <div className="flex items-center gap-2 px-3 py-1 rounded bg-yellow-500/20 text-yellow-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Limited Mode</span>
                </div>
              )}

              {/* Team Name Display */}
              {userTeam && (
                <div className="hidden md:block text-right">
                  <div className={`font-semibold ${dynastyTheme.classes.text.primary}`}>
                    {userTeam.team_name}
                  </div>
                  <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                    Your Team
                  </div>
                </div>
              )}
              
              {/* League Status Badge */}
              {league && (
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  league.league_status === 'active' ? 'bg-green-500/20 text-green-400' :
                  league.league_status === 'draft_ready' ? 'bg-yellow-500/20 text-yellow-400' :
                  league.league_status === 'drafting' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {league.league_status === 'setup' ? 'Setup Mode' :
                   league.league_status === 'pricing' ? 'Setting Prices' :
                   league.league_status === 'draft_ready' ? 'Ready to Draft' :
                   league.league_status === 'drafting' ? 'Drafting' :
                   'Active'}
                </div>
              )}
              
              <span className={`hidden md:block ${dynastyTheme.classes.text.neutralLight}`}>
                Welcome, {userProfile?.firstName || user?.given_name || user?.firstName || 'User'}
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
            className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static w-72 flex-shrink-0 min-h-screen border-r ${dynastyTheme.classes.transition} duration-300 ease-in-out z-40 ${dynastyTheme.components.card.base} ${dynastyTheme.classes.border.light}`}
            style={{ minWidth: '18rem', maxWidth: '18rem' }}
          >
            <div className="p-4 h-full overflow-y-auto">
              {/* League Info Card */}
              <div className={`mb-6 p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter} border ${dynastyTheme.classes.border.light}`}>
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white} mb-3`}>
                  {league?.league_name || 'Loading...'}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={dynastyTheme.classes.text.neutralLight}>Teams:</span>
                    <span className={dynastyTheme.classes.text.white}>
                      {teams.length || owners.filter(o => o.team_id).length}/{league?.max_teams || 12}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={dynastyTheme.classes.text.neutralLight}>Your Role:</span>
                    <span className={`font-semibold ${
                      league?.role === 'commissioner' 
                        ? dynastyTheme.classes.text.primary 
                        : dynastyTheme.classes.text.success
                    }`}>
                      {league?.role === 'commissioner' ? 'Commissioner' : 'Owner'}
                    </span>
                  </div>
                  {userTeam && (
                    <div className="flex justify-between">
                      <span className={dynastyTheme.classes.text.neutralLight}>Your Team:</span>
                      <span className={`${dynastyTheme.classes.text.primary} truncate ml-2`}>
                        {userTeam.team_name || 'Team 1'}
                      </span>
                    </div>
                  )}
                  {(league?.salary_cap_enabled || league?.use_salaries) && (
                    <div className="flex justify-between">
                      <span className={dynastyTheme.classes.text.neutralLight}>Salary Cap:</span>
                      <span className={dynastyTheme.classes.text.success}>
                        ${league?.salary_cap || 260}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation Sections */}
              {getNavigationSections().map((section, sectionIndex) => (
                <div key={sectionIndex} className="mb-6">
                  <h3 className={dynastyTheme.components.sidebar.sectionHeader}>
                    {section.title}
                  </h3>
                  <nav className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;
                      const needsAttention = item.needsAttention;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveSection(item.id);
                            setSidebarOpen(false);
                            // Clear viewing team when navigating away
                            setViewingTeamId(null);
                            setViewingTeamName(null);
                          }}
                          className={`${dynastyTheme.components.sidebar.navItem.base} ${
                            isActive
                              ? dynastyTheme.components.sidebar.navItem.active
                              : needsAttention
                              ? dynastyTheme.components.sidebar.navItem.needsAttention
                              : dynastyTheme.components.sidebar.navItem.inactive
                          }`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {isActive && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                          {needsAttention && !isActive && (
                            <AlertCircle className="w-4 h-4 flex-shrink-0 text-yellow-400" />
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </aside>

          {/* Mobile Overlay */}
          {sidebarOpen && (
            <div 
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main Content Area */}
          <main className="flex-1 p-6 overflow-x-auto">
            {renderContent()}
          </main>
        </div>
        
        {/* Position Assignment Modal - Rendered at top level */}
        {showPositionModal && playerForAssignment && positionModalCapacity && (
          <PositionAssignmentDropdown
            player={playerForAssignment}
            league={league}
            currentRoster={positionModalRoster}
            onAssign={handleCompletePositionAssignment}
            onCancel={() => {
              setShowPositionModal(false);
              setPlayerForAssignment(null);
              setPositionModalRoster([]);
              setPositionModalCapacity(null);
            }}
            isVisible={showPositionModal}
          />
        )}
      </div>
    </PlayerModalProvider>
  );
};

export default LeagueDashboard;