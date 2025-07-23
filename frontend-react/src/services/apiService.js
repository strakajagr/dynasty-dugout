// src/services/apiService.js
import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://d20wx6xzxkf84y.cloudfront.net',
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
    console.log('Request config:', config);
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log(`Response from ${response.config.url}:`, response.data);
    return response;
  },
  (error) => {
    console.error('Response interceptor error:', error);
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// Auth API - Method names matching AuthContext
export const authAPI = {
  signIn: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  signUp: async (email, password, firstName, lastName, favoriteTeam) => {
    const response = await api.post('/api/auth/register', {
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      favorite_team: favoriteTeam
    });
    return response.data;
  },

  signOut: async () => {
    const response = await api.post('/api/auth/logout');
    return response.data;
  },

  checkAuth: async () => {
    const response = await api.get('/api/auth/status');
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/api/auth/profile');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/api/auth/profile', profileData);
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword
    });
    return response.data;
  },

  // Additional methods for AuthModal features
  verifyEmail: async (email, code) => {
    const response = await api.post('/api/auth/verify', { email, code });
    return response.data;
  },

  resendVerification: async (email) => {
    const response = await api.post('/api/auth/resend-verification', { email });
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (email, code, newPassword) => {
    const response = await api.post('/api/auth/reset-password', {
      email,
      code,
      new_password: newPassword
    });
    return response.data;
  }
};

// Players API
export const playersAPI = {
  getPlayers: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.position) params.append('position', filters.position);
    if (filters.team) params.append('team', filters.team);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    
    const queryString = params.toString();
    const url = queryString ? `/api/players?${queryString}` : '/api/players';
    
    const response = await api.get(url);
    return response.data;
  },

  getPlayerById: async (playerId) => {
    const response = await api.get(`/api/players/${playerId}`);
    return response.data;
  },

  searchPlayers: async (searchTerm) => {
    const response = await api.get(`/api/players/search?q=${encodeURIComponent(searchTerm)}`);
    return response.data;
  }
};

// Analytics API
export const analyticsAPI = {
  getCareerStats: async (playerId) => {
    const response = await api.get(`/api/analytics/career-stats/${playerId}`);
    return response.data;
  },

  getHotColdAnalysis: async (playerId) => {
    const response = await api.get(`/api/analytics/hot-cold/${playerId}`);
    return response.data;
  },

  getRecentPerformance: async (playerId) => {
    const response = await api.get(`/api/analytics/recent-performance/${playerId}`);
    return response.data;
  },

  getTrendingPlayers: async () => {
    const response = await api.get('/api/analytics/trending-players');
    return response.data;
  }
};

// Leagues API - COMPLETE with all missing methods
export const leaguesAPI = {
  // Get user's leagues
  getMyLeagues: async () => {
    const response = await api.get('/api/leagues/my-leagues');
    return response.data;
  },

  // Create a new league
  createLeague: async (leagueData) => {
    const response = await api.post('/api/leagues/create', leagueData);
    return response.data;
  },

  // Get single league details (MISSING METHOD - ADDED)
  getLeague: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}`);
    return response.data;
  },

  // Get league standings (MISSING METHOD - ADDED)
  getLeagueStandings: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/standings`);
    return response.data;
  },

  // Get team stats for league (MISSING METHOD - ADDED)
  getTeamStats: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/team-stats`);
    return response.data;
  },

  // Get my roster in a league (MISSING METHOD - ADDED)
  getMyRoster: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/my-roster`);
    return response.data;
  },

  // Get available players in a league (MISSING METHOD - ADDED)
  getAvailablePlayers: async (leagueId, filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.position) params.append('position', filters.position);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    
    const queryString = params.toString();
    const url = queryString ? `/api/leagues/${leagueId}/available-players?${queryString}` : `/api/leagues/${leagueId}/available-players`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Process transactions (MISSING METHOD - ADDED)
  processTransaction: async (leagueId, transactionData) => {
    const response = await api.post(`/api/leagues/${leagueId}/transactions`, transactionData);
    return response.data;
  },

  // Create trade proposal (MISSING METHOD - ADDED)
  createTrade: async (leagueId, tradeData) => {
    const response = await api.post(`/api/leagues/${leagueId}/trades`, tradeData);
    return response.data;
  },

  // Get transaction history (MISSING METHOD - ADDED)
  getTransactionHistory: async (leagueId, filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.transaction_type) params.append('transaction_type', filters.transaction_type);
    if (filters.days_back) params.append('days_back', filters.days_back);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    const url = queryString ? `/api/leagues/${leagueId}/transactions?${queryString}` : `/api/leagues/${leagueId}/transactions`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Team setup/creation (MISSING METHOD - ADDED)
  createTeam: async (leagueId, teamData) => {
    // For now, this could be a placeholder - we'll need to add this endpoint to backend later
    // or handle team creation differently
    const response = await api.post(`/api/leagues/${leagueId}/teams`, teamData);
    return response.data;
  },

  // Sync league players with MLB updates (MISSING METHOD - ADDED)
  syncPlayers: async (leagueId) => {
    const response = await api.post(`/api/leagues/${leagueId}/sync-players`);
    return response.data;
  },

  // Get league pool statistics (MISSING METHOD - ADDED)
  getPoolStats: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/pool-stats`);
    return response.data;
  },

  // Delete league (commissioner only) (MISSING METHOD - ADDED)
  deleteLeague: async (leagueId) => {
    const response = await api.delete(`/api/leagues/${leagueId}/cleanup`);
    return response.data;
  },

  // Get players in a specific league (EXISTING - KEPT)
  getLeaguePlayers: async (leagueId, filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.position) params.append('position', filters.position);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    
    const queryString = params.toString();
    const url = queryString ? `/api/leagues/${leagueId}/players?${queryString}` : `/api/leagues/${leagueId}/players`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Health check for leagues (EXISTING - KEPT)
  healthCheck: async () => {
    const response = await api.get('/api/leagues/health');
    return response.data;
  },

  // Cleanup test tables (development only) (EXISTING - KEPT)
  cleanupTestTables: async () => {
    const response = await api.delete('/api/leagues/cleanup-test-tables');
    return response.data;
  }
};

// Utilities API
export const utilitiesAPI = {
  healthCheck: async () => {
    const response = await api.get('/api/health');
    return response.data;
  },

  debugCookies: async () => {
    const response = await api.get('/api/debug/cookies');
    return response.data;
  }
};

// Export the axios instance for custom requests
export default api;// Updated: Wed Jul 23 15:48:39 EDT 2025
