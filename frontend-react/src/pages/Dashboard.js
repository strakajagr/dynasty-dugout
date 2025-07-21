// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Crown, LogOut, User, Users, Trophy, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { playersAPI } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [showProfile, setShowProfile] = useState(false);

  const playersPerPage = 25;

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const response = await playersAPI.getPlayers();
      setPlayers(response.players || []);
    } catch (error) {
      console.error('Error loading players:', error);
      setError('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Filter players based on search term
  const filteredPlayers = players.filter(player =>
    player.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.team?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginate filtered players
  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage);
  const startIndex = currentPage * playersPerPage;
  const currentPlayers = filteredPlayers.slice(startIndex, startIndex + playersPerPage);

  if (loading) {
    return <LoadingSpinner message="Loading your dynasty..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-yellow-500/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Crown className="w-8 h-8 text-yellow-500" />
              <h1 className="text-2xl font-bold text-white">Dynasty Dugout</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center space-x-2 px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:block">
                  {user?.firstName} {user?.lastName}
                </span>
              </button>
              
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:block">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Panel */}
      {showProfile && (
        <div className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="bg-gray-900/50 rounded-lg p-4 border border-yellow-500/20">
              <h3 className="text-lg font-semibold text-white mb-2">Profile Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Name:</span>
                  <span className="text-white ml-2">{user?.firstName} {user?.lastName}</span>
                </div>
                <div>
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white ml-2">{user?.email}</span>
                </div>
                <div>
                  <span className="text-gray-400">Favorite Team:</span>
                  <span className="text-yellow-500 ml-2">{user?.favoriteTeam || 'Not set'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.firstName}!
          </h2>
          <p className="text-gray-400">
            Your dynasty awaits. Browse {players.length} available MLB players.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">{players.length}</p>
                <p className="text-gray-400">Available Players</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700">
            <div className="flex items-center space-x-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">0</p>
                <p className="text-gray-400">Teams Created</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700">
            <div className="flex items-center space-x-3">
              <Crown className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">0</p>
                <p className="text-gray-400">Leagues Joined</p>
              </div>
            </div>
          </div>
        </div>

        {/* Players Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Available Players</h3>
            
            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search players, teams, positions..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0); // Reset to first page when searching
                }}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              />
            </div>
          </div>

          {error ? (
            <div className="p-6 text-center text-red-400">
              {error}
            </div>
          ) : (
            <>
              {/* Players Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Player
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {currentPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{player.name}</div>
                          <div className="text-sm text-gray-400">#{player.jersey_number || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-white">{player.team}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold bg-yellow-500/20 text-yellow-300 rounded-full">
                            {player.position}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold bg-green-500/20 text-green-300 rounded-full">
                            Available
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-6 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      Showing {startIndex + 1} to {Math.min(startIndex + playersPerPage, filteredPlayers.length)} of {filteredPlayers.length} players
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                        disabled={currentPage === 0}
                        className="px-3 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-2 text-sm text-gray-400">
                        Page {currentPage + 1} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                        disabled={currentPage === totalPages - 1}
                        className="px-3 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;