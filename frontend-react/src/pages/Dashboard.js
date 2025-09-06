// src/pages/Dashboard.js - With Player Search and My Account Removed
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, User, Users, Trophy, Calendar, MessageSquare, 
  Settings, BarChart3, FileText, Star, Target, TrendingUp,
  Search, ChevronRight, LogOut, Plus, Globe, UserPlus,
  DollarSign, Clock, Activity, Newspaper, TrendingDown,
  Flame, Snowflake, AlertCircle, ArrowUp, ArrowDown,
  UserX, UserCheck, Sparkles, Bell, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesAPI } from '../services/apiService';
import apiService from '../services/apiService';
import { dynastyTheme } from '../services/colorService';

// Import modular components
import TickerBar from '../components/dashboard/TickerBar';
import WelcomeBanner from '../components/dashboard/WelcomeBanner';
import MyLeaguesSection from '../components/dashboard/MyLeaguesSection';
import LeagueDiscoveryHub from '../components/dashboard/LeagueDiscoveryHub';
import TrendingPlayersSection from '../components/dashboard/TrendingPlayersSection';
import MLBNewsSection from '../components/dashboard/MLBNewsSection';
import InjuryReportSection from '../components/dashboard/InjuryReportSection';

// Player Search Component
const PlayerSearchBar = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 1) {
        performSearch();
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const response = await apiService.get(`/api/players/search?query=${searchQuery}`);
      if (response.data && response.data.players) {
        setSearchResults(response.data.players.slice(0, 8)); // Limit to 8 results
        setShowResults(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      // Mock data fallback for now
      setSearchResults([
        { player_id: 1, name: 'Mike Trout', team: 'LAA', position: 'OF' },
        { player_id: 2, name: 'Ronald Acuña Jr.', team: 'ATL', position: 'OF' },
        { player_id: 3, name: 'Shohei Ohtani', team: 'LAD', position: 'DH' }
      ].filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())));
      setShowResults(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlayerClick = (playerId) => {
    setShowResults(false);
    setSearchQuery('');
    navigate(`/player/${playerId}`);
  };

  return (
    <div className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search players..."
          className={`w-full pl-10 pr-4 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white} border ${dynastyTheme.classes.border.neutral} focus:border-yellow-400 focus:outline-none transition-colors`}
          onFocus={() => searchQuery.length > 1 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent animate-spin rounded-full" />
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-2 ${dynastyTheme.components.card.base} rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto`}>
          {searchResults.map((player) => (
            <button
              key={player.player_id}
              onClick={() => handlePlayerClick(player.player_id)}
              className={`w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-800 transition-colors text-left border-b ${dynastyTheme.classes.border.neutral} last:border-b-0`}
            >
              <div>
                <div className={`font-semibold ${dynastyTheme.classes.text.white}`}>
                  {player.name}
                </div>
                <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  {player.position} • {player.team}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showResults && searchQuery.length > 1 && searchResults.length === 0 && !isSearching && (
        <div className={`absolute top-full left-0 right-0 mt-2 ${dynastyTheme.components.card.base} rounded-lg shadow-xl z-50 p-4 text-center`}>
          <p className={dynastyTheme.classes.text.neutralLight}>No players found matching "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [leagues, setLeagues] = useState([]);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  // Enhanced navigation sections - REMOVED My Account from MY ACCOUNT section
  const navigationSections = [
    {
      title: 'MY ACCOUNT',
      items: [
        { id: 'dashboard', label: 'My Dashboard', icon: BarChart3 },
        // REMOVED: { id: 'account', label: 'My Account', icon: User },
        { id: 'my-leagues', label: 'My Leagues', icon: Crown },
        { id: 'watchlist', label: 'My Watchlist', icon: Star }
      ]
    },
    {
      title: 'LEAGUE MANAGEMENT',
      items: [
        { id: 'create-league', label: 'Create New League', icon: Plus },
        { id: 'join-league', label: 'Join League', icon: UserPlus },
        { id: 'public-leagues', label: 'Browse Public Leagues', icon: Globe }
      ]
    },
    {
      title: 'RESEARCH HUB',
      items: [
        { id: 'injury-tracker', label: 'Injury Tracker', icon: AlertCircle },
        { id: 'prospects', label: 'Prospect Database', icon: Sparkles },
        { id: 'schedule', label: 'MLB Schedule', icon: Calendar },
        { id: 'weather', label: 'Weather Tracker', icon: Activity }
      ]
    },
    {
      title: 'DATA CENTER',
      items: [
        { id: 'historical', label: 'Historical Stats', icon: FileText },
        { id: 'exports', label: 'Export Data', icon: Target },
        { id: 'reports', label: 'Reports', icon: FileText }
      ]
    }
  ];

  useEffect(() => {
    if (window.location.pathname === '/dashboard') {
      setActiveSection('dashboard');
    }
    
    loadLeagues();
    loadUserProfile();
  }, [user]);

  const loadLeagues = async () => {
    try {
      setLeaguesLoading(true);
      const response = await leaguesAPI.getMyLeagues();
      
      if (response.success && response.leagues) {
        setLeagues(response.leagues);
      } else {
        setLeagues([]);
      }
    } catch (error) {
      console.error('Leagues API error:', error);
      setLeagues([]);
    } finally {
      setLeaguesLoading(false);
    }
  };

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
      // Don't crash - just continue without profile picture
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNavigation = (itemId) => {
    if (itemId === 'create-league') {
      navigate('/create-league');
    } else if (itemId === 'join-league') {
      navigate('/join-league');
    } else if (itemId === 'public-leagues') {
      navigate('/browse-leagues');
    } else {
      setActiveSection(itemId);
    }
  };

  // ========================================
  // USER PROFILE PICTURE COMPONENT - UPDATED WITH GLOW AND LABEL
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

    // Fallback to initials
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

  const renderDashboardContent = () => {
    return (
      <div className="space-y-6">
        {/* Welcome Banner */}
        <WelcomeBanner user={user} />

        {/* My Leagues Section */}
        <MyLeaguesSection leagues={leagues} leaguesLoading={leaguesLoading} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* League Discovery Hub */}
            <LeagueDiscoveryHub />

            {/* Trending Players Section */}
            <TrendingPlayersSection />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* MLB News Section */}
            <MLBNewsSection />

            {/* Injury Report Section */}
            <InjuryReportSection />
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return renderDashboardContent();

      case 'my-leagues':
        return <MyLeaguesSection leagues={leagues} leaguesLoading={leaguesLoading} />;

      case 'injury-tracker':
        return <InjuryReportSection />;

      default:
        return (
          <div className={`${dynastyTheme.components.card.base} p-6 text-center`}>
            <h2 className={`${dynastyTheme.components.heading.h2} mb-4`}>
              {navigationSections.find(section => 
                section.items.find(item => item.id === activeSection)
              )?.items.find(item => item.id === activeSection)?.label || 'Feature'}
            </h2>
            <div className={`py-12 ${dynastyTheme.classes.text.neutralLight}`}>
              <FileText className={`w-16 h-16 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLighter}`} />
              <h3 className={`text-xl font-semibold mb-2`}>Coming Soon</h3>
              <p>This feature is under development and will be available soon.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={dynastyTheme.components.page}>
      {/* Ticker Bar */}
      <TickerBar leagues={leagues} />
      
      <header 
        className={`px-6 py-4 border-b ${dynastyTheme.components.card.base} ${dynastyTheme.classes.border.neutral}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* CLICKABLE USER PROFILE PICTURE - TOP LEFT */}
            <UserProfilePicture />
            
            <div className="flex items-center space-x-3">
              <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
              <h1 className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>Dynasty Dugout</h1>
            </div>
          </div>
          
          {/* NEW PLAYER SEARCH BAR IN CENTER */}
          <PlayerSearchBar />
          
          <div className="flex items-center space-x-4">
            <span className={dynastyTheme.classes.text.neutralLight}>
              Welcome, {userProfile?.firstName || user?.given_name || user?.firstName || 'User'}
            </span>
            <button
              onClick={handleSignOut}
              className={`flex items-center space-x-2 ${dynastyTheme.classes.text.neutralLight} hover:text-white ${dynastyTheme.classes.transition}`}
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside 
          className={`w-64 min-h-screen ${dynastyTheme.components.sidebar.container}`}
        >
          <div className="p-4">
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-6">
                <h3 className={dynastyTheme.components.sidebar.sectionHeader}>
                  {section.title}
                </h3>
                <nav className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigation(item.id)}
                        className={`${dynastyTheme.components.sidebar.navItem.base} ${
                          isActive
                            ? dynastyTheme.components.sidebar.navItem.active
                            : dynastyTheme.components.sidebar.navItem.inactive
                        }`}
                      >
                        <Icon className="w-4 h-4" />
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

        <main className="flex-1 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;