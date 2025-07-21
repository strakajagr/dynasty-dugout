// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // ADDED: For routing to player profiles
import { 
  Crown, User, Users, Trophy, Calendar, MessageSquare, 
  Settings, BarChart3, FileText, Star, Target, TrendingUp,
  Search, ChevronRight, LogOut
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { playersAPI } from '../services/apiService';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate(); // ADDED: Hook for navigation
  const [activeSection, setActiveSection] = useState('dashboard');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');

  // Navigation structure matching your league site
  const navigationSections = [
    {
      title: 'MY ACCOUNT',
      items: [
        { id: 'dashboard', label: 'My Dashboard', icon: BarChart3 },
        { id: 'account', label: 'My Account', icon: User },
        { id: 'team-home', label: 'Team Home', icon: Users },
        { id: 'mobile-home', label: 'Mobile Friendly Team Home', icon: Users }
      ]
    },
    {
      title: 'LEAGUE PAGES',
      items: [
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
    console.log('Dashboard useEffect running...');
    console.log('User from AuthContext:', user);
    loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user, not loadPlayers to avoid infinite loops

  const loadPlayers = async () => {
    try {
      setLoading(true);
      console.log('=== STARTING LOAD PLAYERS ===');
      console.log('User authenticated?', !!user);
      console.log('User details:', user);
      
      // Check if cookies are being sent
      console.log('Document cookies:', document.cookie);
      
      const response = await playersAPI.getPlayers();
      console.log('=== API RESPONSE SUCCESS ===');
      console.log('Full response:', response);
      console.log('Response.players:', response.players);
      console.log('Response.data:', response.data);
      console.log('Type of response:', typeof response);
      
      // Try multiple possible data structures
      let playersData = [];
      if (response.players) {
        playersData = response.players;
        console.log('Using response.players');
      } else if (response.data) {
        playersData = response.data;
        console.log('Using response.data');
      } else if (Array.isArray(response)) {
        playersData = response;
        console.log('Response is array, using directly');
      } else {
        console.log('Unknown response structure, using empty array');
      }
      
      console.log('Final playersData:', playersData);
      console.log('Players count:', playersData.length);
      
      setPlayers(playersData);
    } catch (error) {
      console.error('=== API ERROR ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Error response status:', error.response?.status);
      console.error('Error response headers:', error.response?.headers);
      
      // Set empty array on error
      setPlayers([]);
    } finally {
      console.log('=== LOAD PLAYERS FINISHED ===');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // ADDED: Function to handle player name clicks
  const handlePlayerClick = (player) => {
    console.log('Navigating to player profile:', player.player_id, player.first_name, player.last_name);
    navigate(`/player/${player.player_id}`);
  };

  const filteredPlayers = players.filter(player => {
    // Build full name from first_name and last_name
    const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
    
    // Check if search matches name or mlb_id
    const matchesSearch = searchTerm === '' || 
                         fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.mlb_id?.toString().includes(searchTerm);
    
    // Check position filter  
    const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
    
    return matchesSearch && matchesPosition;
  });

  // Debug: Log the first player to see actual structure
  if (players.length > 0 && !window.playerDebugLogged) {
    console.log('=== PLAYER STRUCTURE DEBUG ===');
    console.log('First player object:', players[0]);
    console.log('All player properties:', Object.keys(players[0]));
    console.log('Total players:', players.length);
    console.log('Filtered players:', filteredPlayers.length);
    window.playerDebugLogged = true;
  }

  const positions = ['all', ...new Set(players.map(p => p.position).filter(Boolean))];

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="dynasty-card-gradient">
              <h2 className="text-2xl font-bold text-white mb-2">
                Welcome back, {user?.given_name || user?.firstName}!
              </h2>
              <p className="dynasty-text-secondary">
                Your dynasty awaits. Browse {players.length} available MLB players and manage your empire.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="dynasty-card">
                <div className="flex items-center space-x-3">
                  <Star className="w-8 h-8 dynasty-text-primary" />
                  <div>
                    <div className="text-2xl font-bold text-white">{players.length}</div>
                    <div className="dynasty-text-secondary">Available Players</div>
                  </div>
                </div>
              </div>
              
              <div className="dynasty-card">
                <div className="flex items-center space-x-3">
                  <Trophy className="w-8 h-8 dynasty-text-primary" />
                  <div>
                    <div className="text-2xl font-bold text-white">0</div>
                    <div className="dynasty-text-secondary">Teams Created</div>
                  </div>
                </div>
              </div>
              
              <div className="dynasty-card">
                <div className="flex items-center space-x-3">
                  <Crown className="w-8 h-8 dynasty-text-primary" />
                  <div>
                    <div className="text-2xl font-bold text-white">0</div>
                    <div className="dynasty-text-secondary">Leagues Joined</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="dynasty-card">
              <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button 
                  onClick={() => setActiveSection('available-players')}
                  className="dynasty-button-secondary flex items-center justify-center space-x-2 p-4"
                >
                  <Star className="w-5 h-5" />
                  <span>Browse Players</span>
                </button>
                <button 
                  onClick={() => setActiveSection('team-home')}
                  className="dynasty-button-secondary flex items-center justify-center space-x-2 p-4"
                >
                  <Users className="w-5 h-5" />
                  <span>My Team</span>
                </button>
                <button 
                  onClick={() => setActiveSection('standings')}
                  className="dynasty-button-secondary flex items-center justify-center space-x-2 p-4"
                >
                  <Trophy className="w-5 h-5" />
                  <span>Standings</span>
                </button>
                <button 
                  onClick={() => setActiveSection('messages')}
                  className="dynasty-button-secondary flex items-center justify-center space-x-2 p-4"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Messages</span>
                </button>
              </div>
            </div>
          </div>
        );

      case 'available-players':
        return (
          <div className="space-y-6">
            <div className="dynasty-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Available Players</h2>
                <div className="text-sm dynasty-text-secondary">
                  Free agents and waiver wire players ready to join your team
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 dynasty-text-secondary" />
                    <input
                      type="text"
                      placeholder="Search players, teams, positions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="dynasty-input w-full pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <select
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className="dynasty-input"
                  >
                    {positions.map(pos => (
                      <option key={pos} value={pos}>
                        {pos === 'all' ? 'All Positions' : pos}
                      </option>
                    ))}
                  </select>
                  {/* Debug button - temporary */}
                  <button 
                    onClick={() => {
                      console.log('=== COMPLETE PLAYER DATA STRUCTURE ===');
                      console.log('First player (complete):', JSON.stringify(players[0], null, 2));
                      console.log('All properties of first player:', Object.keys(players[0] || {}));
                      console.log('Sample of 3 players:', players.slice(0, 3));
                    }}
                    className="dynasty-button-secondary text-xs px-3"
                  >
                    Debug Data
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="dynasty-table-header">
                      <th className="text-left py-3 px-4">PLAYER</th>
                      <th className="text-left py-3 px-4">TEAM</th>
                      <th className="text-left py-3 px-4">POSITION</th>
                      <th className="text-left py-3 px-4">STATUS</th>
                      <th className="text-left py-3 px-4">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="text-center py-8 dynasty-text-secondary">
                          Loading players...
                        </td>
                      </tr>
                    ) : filteredPlayers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-8 dynasty-text-secondary">
                          No players found matching your criteria
                          <div className="text-xs mt-2">
                            Debug: Total players loaded: {players.length}
                          </div>
                          <div className="text-xs mt-1">
                            Debug: Filtered players: {filteredPlayers.length}
                          </div>
                          <div className="text-xs mt-1">
                            Debug: Search term: "{searchTerm}", Position filter: "{positionFilter}"
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredPlayers.map((player, index) => (
                        <tr key={player.mlb_id || player.player_id || index} className="dynasty-table-row">
                          <td className="py-3 px-4">
                            <div className="text-white font-medium">
                              {/* UPDATED: Make player name clickable */}
                              <button
                                onClick={() => handlePlayerClick(player)}
                                className="dynasty-text-primary hover:dynasty-text-accent transition-colors duration-200 font-medium text-left hover:underline cursor-pointer"
                                title={`View ${player.first_name} ${player.last_name}'s profile`}
                              >
                                {`${player.first_name || ''} ${player.last_name || ''}`.trim() || `Player #${player.mlb_id || index + 1}`}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 dynasty-text-muted">
                            {player.mlb_team || player.team || player.team_name || 'Free Agent'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="dynasty-position-badge">
                              {player.position || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`dynasty-badge-${player.is_active ? 'success' : 'warning'}`}>
                              {player.is_active ? 'Available' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button 
                              className="dynasty-button-accent"
                              onClick={() => console.log('Add to team:', player)}
                              title={`Add ${player.first_name} ${player.last_name} to your team`}
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

              {/* ADDED: Helpful instructions */}
              {!loading && filteredPlayers.length > 0 && (
                <div className="mt-4 p-3 dynasty-bg-secondary rounded-lg">
                  <p className="dynasty-text-secondary text-sm">
                    💡 <strong>Tip:</strong> Click on any player's name to view their detailed profile with statistics and performance history.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'team-home':
        return (
          <div className="dynasty-card">
            <h2 className="text-2xl font-bold text-white mb-4">My Team</h2>
            <div className="text-center py-12 dynasty-text-secondary">
              <Users className="w-16 h-16 mx-auto mb-4 dynasty-text-muted" />
              <h3 className="text-xl font-semibold mb-2">No Team Created Yet</h3>
              <p className="mb-4">Create your dynasty team to start building your roster.</p>
              <button className="dynasty-button">Create Team</button>
            </div>
          </div>
        );

      case 'standings':
        return (
          <div className="dynasty-card">
            <h2 className="text-2xl font-bold text-white mb-4">League Standings</h2>
            <div className="text-center py-12 dynasty-text-secondary">
              <Trophy className="w-16 h-16 mx-auto mb-4 dynasty-text-muted" />
              <h3 className="text-xl font-semibold mb-2">No Active Leagues</h3>
              <p className="mb-4">Join or create a league to see standings.</p>
              <button className="dynasty-button">Find Leagues</button>
            </div>
          </div>
        );

      default:
        return (
          <div className="dynasty-card">
            <h2 className="text-2xl font-bold text-white mb-4">
              {navigationSections.find(section => 
                section.items.find(item => item.id === activeSection)
              )?.items.find(item => item.id === activeSection)?.label}
            </h2>
            <div className="text-center py-12 dynasty-text-secondary">
              <FileText className="w-16 h-16 mx-auto mb-4 dynasty-text-muted" />
              <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
              <p>This feature is under development and will be available soon.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen dynasty-bg-primary">
      {/* Header */}
      <header className="dynasty-bg-secondary dynasty-border-bottom px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Crown className="w-8 h-8 dynasty-text-primary" />
            <h1 className="text-2xl font-bold text-white">Dynasty Dugout</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="dynasty-text-muted">
              Welcome, {user?.given_name || user?.firstName}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 dynasty-text-secondary hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar */}
        <aside className="w-64 dynasty-bg-secondary dynasty-border-right min-h-screen">
          <div className="p-4">
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-6">
                <h3 className="text-xs font-semibold dynasty-text-primary uppercase tracking-wider mb-2">
                  {section.title}
                </h3>
                <nav className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'dynasty-nav-active'
                            : 'dynasty-nav-item'
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