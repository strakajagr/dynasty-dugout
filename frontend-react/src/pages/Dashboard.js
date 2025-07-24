// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, User, Users, Trophy, Calendar, MessageSquare, 
  Settings, BarChart3, FileText, Star, Target, TrendingUp,
  Search, ChevronRight, LogOut, Plus, Globe, UserPlus,
  DollarSign, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { playersAPI, leaguesAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [players, setPlayers] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');

  // Navigation structure
  const navigationSections = [
    {
      title: 'MY ACCOUNT',
      items: [
        { id: 'dashboard', label: 'My Dashboard', icon: BarChart3 },
        { id: 'account', label: 'My Account', icon: User },
        { id: 'my-leagues', label: 'My Leagues', icon: Crown }
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
      title: 'CURRENT LEAGUE',
      items: [
        { id: 'team-home', label: 'Team Home', icon: Users },
        { id: 'league-home', label: 'League Home', icon: Crown },
        { id: 'standings', label: 'League Standings', icon: Trophy },
        { id: 'team-stats', label: 'Team Stats', icon: BarChart3 },
        { id: 'last-night', label: "Last Night's Boxes", icon: Calendar },
        { id: 'live-scoring', label: 'Live Scoring', icon: TrendingUp },
        { id: 'transactions', label: 'Transactions', icon: FileText }
      ]
    },
    {
      title: 'PLAYERS & DATA',
      items: [
        { id: 'available-players', label: 'Available Players', icon: Star },
        { id: 'all-players', label: 'All Players', icon: Users },
        { id: 'player-search', label: 'Player Search', icon: Search },
        { id: 'draft-results', label: 'Draft Results', icon: Target }
      ]
    },
    {
      title: 'COMMUNICATION',
      items: [
        { id: 'messages', label: 'League Messages', icon: MessageSquare },
        { id: 'polls', label: 'Polls/Chat', icon: MessageSquare }
      ]
    },
    {
      title: 'TOOLS',
      items: [
        { id: 'reports', label: 'Reports', icon: FileText },
        { id: 'settings', label: 'League Settings', icon: Settings }
      ]
    }
  ];

  useEffect(() => {
    loadPlayers();
    loadLeagues();
  }, [user]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const response = await playersAPI.getPlayers();
      
      let playersData = [];
      if (response.players) {
        playersData = response.players;
      } else if (response.data) {
        playersData = response.data;
      } else if (Array.isArray(response)) {
        playersData = response;
      }
      
      setPlayers(playersData);
    } catch (error) {
      console.error('Players API error:', error);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSignOut = async () => {
    await signOut();
  };

  const handlePlayerClick = (player) => {
    navigate(`/player/${player.player_id}`);
  };

  const handleNavigation = (itemId) => {
    if (itemId === 'account') {
      navigate('/my-account');
    } else if (itemId === 'create-league') {
      navigate('/create-league');
    } else {
      setActiveSection(itemId);
    }
  };

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

  const getLeagueStatusColor = (status) => {
    const statusMap = {
      'setup': dynastyTheme.classes.bg.warning,
      'active': dynastyTheme.classes.bg.success,
      'completed': dynastyTheme.classes.bg.neutral,
      'draft': dynastyTheme.classes.bg.info
    };
    return statusMap[status] || dynastyTheme.classes.bg.neutral;
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

  const filteredPlayers = players.filter(player => {
    const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
    
    const matchesSearch = searchTerm === '' || 
                         fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.mlb_id?.toString().includes(searchTerm);
    
    const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
    
    return matchesSearch && matchesPosition;
  });

  const positions = ['all', ...new Set(players.map(p => p.position).filter(Boolean))];

  const renderMyLeagues = () => {
    if (leaguesLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="flex items-center space-x-3">
            <div 
              className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${dynastyTheme.classes.border.primary}`}
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
          <h3 className={`${dynastyTheme.components.heading.h3} ${dynastyTheme.classes.text.white} mb-2`}>No Leagues Yet</h3>
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
              onClick={() => setActiveSection('public-leagues')}
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
            className={`${dynastyTheme.components.card.interactive} group`}
            onClick={() => navigate(`/leagues/${league.league_id}`)}
          >
            {/* League Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white} group-hover:text-yellow-400 ${dynastyTheme.classes.transition}`}>
                  {league.league_name}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${getLeagueStatusColor(league.status || 'setup')} ${dynastyTheme.classes.text.white}`}
                  >
                    {(league.status || 'setup').toUpperCase()}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.primary}`}
                  >
                    {league.role?.toUpperCase() || 'MEMBER'}
                  </span>
                </div>
              </div>
              <ChevronRight 
                className={`w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 ${dynastyTheme.classes.transition} ${dynastyTheme.classes.text.primary}`}
              />
            </div>

            {/* League Details */}
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

            {/* League Actions */}
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

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Welcome Section */}
            <div className={`${dynastyTheme.components.card.base} p-6`}>
              <h2 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white} mb-2`}>
                Welcome back, {user?.given_name || user?.firstName}!
              </h2>
              <p className={dynastyTheme.classes.text.neutralLight}>
                Your dynasty awaits. Manage your leagues and build your empire.
              </p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`${dynastyTheme.components.card.base} p-6`}>
                <div className="flex items-center space-x-3">
                  <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
                  <div>
                    <div className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>{leagues.length}</div>
                    <div className={dynastyTheme.classes.text.neutralLight}>Leagues Joined</div>
                  </div>
                </div>
              </div>
              
              <div className={`${dynastyTheme.components.card.base} p-6`}>
                <div className="flex items-center space-x-3">
                  <Trophy className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
                  <div>
                    <div className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>0</div>
                    <div className={dynastyTheme.classes.text.neutralLight}>Championships</div>
                  </div>
                </div>
              </div>

              <div className={`${dynastyTheme.components.card.base} p-6`}>
                <div className="flex items-center space-x-3">
                  <Users className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
                  <div>
                    <div className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>0</div>
                    <div className={dynastyTheme.classes.text.neutralLight}>Active Teams</div>
                  </div>
                </div>
              </div>
            </div>

            {/* My Leagues Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
                  <div>
                    <h3 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white}`}>My Leagues</h3>
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

              {renderMyLeagues()}
            </div>

            {/* Quick Actions */}
            {leagues.length > 0 && (
              <div className={`${dynastyTheme.components.card.base} p-6`}>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-4`}>Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => navigate('/create-league')}
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex items-center justify-center space-x-2 py-3`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New League</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveSection('available-players')}
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex items-center justify-center space-x-2 py-3`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Browse Players</span>
                  </button>
                  
                  <button
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex items-center justify-center space-x-2 py-3 opacity-50 cursor-not-allowed`}
                    disabled
                  >
                    <Clock className="w-4 h-4" />
                    <span>Recent Activity</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'my-leagues':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
                <div>
                  <h2 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white}`}>My Leagues</h2>
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

            {renderMyLeagues()}

            {/* Quick Actions for My Leagues */}
            {leagues.length > 0 && (
              <div className={`${dynastyTheme.components.card.base} p-6`}>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-4`}>Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => navigate('/create-league')}
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex items-center justify-center space-x-2 py-3`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New League</span>
                  </button>
                  
                  <button
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex items-center justify-center space-x-2 py-3 opacity-50 cursor-not-allowed`}
                    disabled
                  >
                    <Users className="w-4 h-4" />
                    <span>Join League</span>
                  </button>
                  
                  <button
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex items-center justify-center space-x-2 py-3 opacity-50 cursor-not-allowed`}
                    disabled
                  >
                    <Clock className="w-4 h-4" />
                    <span>Recent Activity</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'available-players':
        return (
          <div className="space-y-6">
            <div className={`${dynastyTheme.components.card.base} p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white}`}>Available Players</h2>
                <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  Free agents and waiver wire players
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className={`absolute left-3 top-3 w-5 h-5 ${dynastyTheme.classes.text.neutralLight}`} />
                    <input
                      type="text"
                      placeholder="Search players, teams, positions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`${dynastyTheme.components.input} w-full pl-10`}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <select
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className={dynastyTheme.components.input}
                  >
                    {positions.map(pos => (
                      <option key={pos} value={pos}>
                        {pos === 'all' ? 'All Positions' : pos}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${dynastyTheme.classes.border.neutral}`}>
                      <th className={`text-left py-3 px-4 font-semibold ${dynastyTheme.classes.text.white}`}>PLAYER</th>
                      <th className={`text-left py-3 px-4 font-semibold ${dynastyTheme.classes.text.white}`}>TEAM</th>
                      <th className={`text-left py-3 px-4 font-semibold ${dynastyTheme.classes.text.white}`}>POSITION</th>
                      <th className={`text-left py-3 px-4 font-semibold ${dynastyTheme.classes.text.white}`}>STATUS</th>
                      <th className={`text-left py-3 px-4 font-semibold ${dynastyTheme.classes.text.white}`}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5" className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
                          Loading players...
                        </td>
                      </tr>
                    ) : filteredPlayers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
                          No players found matching your criteria
                        </td>
                      </tr>
                    ) : (
                      filteredPlayers.slice(0, 50).map((player, index) => (
                        <tr key={player.mlb_id || player.player_id || index} className={`border-b hover:bg-black/20 ${dynastyTheme.classes.transition} ${dynastyTheme.classes.border.neutral}`}>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handlePlayerClick(player)}
                              className={`${dynastyTheme.classes.text.white} hover:text-yellow-400 ${dynastyTheme.classes.transition} font-medium text-left hover:underline`}
                            >
                              {`${player.first_name || ''} ${player.last_name || ''}`.trim() || `Player #${player.mlb_id || index + 1}`}
                            </button>
                          </td>
                          <td className={`py-3 px-4 ${dynastyTheme.classes.text.neutralLight}`}>
                            {player.mlb_team || player.team || player.team_name || 'Free Agent'}
                          </td>
                          <td className="py-3 px-4">
                            <span 
                              className={`px-2 py-1 rounded text-xs font-semibold ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.primary}`}
                            >
                              {player.position || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span 
                              className={`px-2 py-1 rounded text-xs font-semibold ${dynastyTheme.classes.text.white} ${
                                player.is_active ? dynastyTheme.classes.bg.success : dynastyTheme.classes.bg.warning
                              }`}
                            >
                              {player.is_active ? 'Available' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button 
                              className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'xs')} px-3 py-1`}
                              onClick={() => console.log('Add to team:', player)}
                            >
                              Add to Team
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className={`${dynastyTheme.components.card.base} p-6 text-center`}>
            <h2 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white} mb-4`}>
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
      {/* Header */}
      <header 
        className={`px-6 py-4 border-b ${dynastyTheme.components.card.base} ${dynastyTheme.classes.border.light}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
            <h1 className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>Dynasty Dugout</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className={dynastyTheme.classes.text.neutralLight}>
              Welcome, {user?.given_name || user?.firstName}
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
        {/* Left Sidebar */}
        <aside 
          className={`w-64 min-h-screen border-r ${dynastyTheme.components.card.base} ${dynastyTheme.classes.border.light}`}
        >
          <div className="p-4">
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-6">
                <h3 
                  className={`text-xs font-semibold uppercase tracking-wider mb-2 ${dynastyTheme.classes.text.primary}`}
                >
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
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-semibold ${dynastyTheme.classes.transition} ${
                          isActive
                            ? `${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black}`
                            : `${dynastyTheme.classes.text.white} hover:text-white hover:bg-neutral-800`
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

        {/* Main Content */}
        <main className="flex-1 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;