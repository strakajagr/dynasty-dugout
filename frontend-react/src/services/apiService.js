import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://d20wx6xzxkf84y.cloudfront.net',
  withCredentials: true,
  timeout: 30000, // Keep 30 second timeout for regular requests
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`📡 apiService: Making ${config.method?.toUpperCase()} request to: ${config.url}`);
    console.log('📡 apiService: Request config:', config);
    return config;
  },
  (error) => {
    console.error('💥 apiService: Request interceptor error:', error);
    return Promise.reject(error); // Keep this standard
  }
);

// --- FIX APPLIED HERE ---
// Response interceptor: Simplified to avoid potential promise resolution issues on redirect
api.interceptors.response.use(
  (response) => {
    console.log(`✅ apiService: Response from ${response.config.url}:`, response.data);
    return response;
  },
  (error) => {
    // Log error details for debugging
    if (error.response) {
      console.error('❌ apiService: Error status:', error.response.status);
      console.error('❌ apiService: Error data:', error.response.data);
    } else {
      console.error('❌ apiService: Network or unexpected error:', error);
    }
    // Re-throw the error so the calling async function's try/catch can handle it naturally
    return Promise.reject(error); 
  }
);

// =============================================================================
// AUTH API
// =============================================================================

export const authAPI = {
  signIn: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  // Consolidated signup function: Sends firstName and lastName as expected by backend
  signUp: async (userData) => { // Takes a single userData object
    const response = await api.post('/api/auth/signup', {
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName, // Fixed: Sending as firstName (camelCase)
      lastName: userData.lastName,   // Fixed: Sending as lastName (camelCase)
      favoriteTeam: userData.favoriteTeam
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

  verifyEmail: async (email, code) => {
    const response = await api.post('/api/auth/verify-email', { email, code });
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

// =============================================================================
// LEAGUES API - UPDATED WITH HYBRID INVITATION SYSTEM + FREE AGENT SYSTEM
// =============================================================================

export const leaguesAPI = {
  // League Management - UPDATED ASYNC APPROACH
  getMyLeagues: async () => {
    const response = await api.get('/api/leagues/my-leagues');
    return response.data;
  },

  /**
   * Create league asynchronously - Returns immediately with league_id and status URL
   * Frontend should then poll checkLeagueCreationStatus() until completion
   */
  createLeague: async (leagueData) => {
    const response = await api.post('/api/leagues/create', leagueData);
    return response.data;
  },

  /**
   * Check the status of asynchronous league creation
   * Poll this endpoint every 3-5 seconds until status is 'completed' or 'failed'
   */
  checkLeagueCreationStatus: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/creation-status`);
    return response.data;
  },

  getLeagueDetails: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}`);
    return response.data;
  },

  deleteLeague: async (leagueId) => {
    const response = await api.delete(`/api/leagues/${leagueId}/cleanup`);
    return response.data;
  },

  // League Information
  getLeagueStandings: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/standings`);
    return response.data;
  },

  getLeagueOwners: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/owners`);
    return response.data;
  },

  /**
   * Get league settings including UI feature toggles
   * @param {string} leagueId - The league ID
   * @returns {Promise<object>} API response with league settings
   */
  getLeagueSettings: async (leagueId) => {
    try {
      const response = await api.get(`/api/leagues/${leagueId}/settings`);
      return response.data;
    } catch (error) {
      console.error('Error getting league settings:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to get league settings',
        ui_features: {
          use_contracts: true,
          use_salaries: true,
          use_waivers: false,
          show_advanced_stats: true
        }
      };
    }
  },

  getTeamStats: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/team-stats`);
    return response.data;
  },

  getPoolStats: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/pool-stats`);
    return response.data;
  },

  getDatabaseInfo: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/database-info`);
    return response.data;
  },

  // Roster Management
  getMyRoster: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/my-roster`);
    return response.data;
  },

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

  // Transactions
  processTransaction: async (leagueId, transactionData) => {
    const response = await api.post(`/api/leagues/${leagueId}/transactions`, transactionData);
    return response.data;
  },

  createTrade: async (leagueId, tradeData) => {
    const response = await api.post(`/api/leagues/${leagueId}/trades`, tradeData);
    return response.data;
  },

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

  // Team Management
  setupTeam: async (leagueId, teamData) => {
    const response = await api.post(`/api/leagues/${leagueId}/setup-team`, teamData);
    return response.data;
  },

  // League Administration
  syncPlayers: async (leagueId) => {
    const response = await api.post(`/api/leagues/${leagueId}/sync-players`);
    return response.data;
  },

  /**
   * Sync league data (game logs and season stats)
   * @param {string} leagueId - The league ID
   * @returns {Promise<object>} API response
   */
  syncLeagueData: async (leagueId) => {
    try {
      const response = await api.post(`/api/leagues/${leagueId}/sync-data`);
      return response.data;
    } catch (error) {
      console.error('Error syncing league data:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to sync league data'
      };
    }
  },

  // System
  healthCheck: async () => {
    const response = await api.get('/api/leagues/health');
    return response.data;
  },

  // =============================================================================
  // FREE AGENT SYSTEM - NEW METHODS ADDED
  // =============================================================================

  /**
   * Get available free agents for the league
   * @param {string} leagueId - The league ID
   * @param {object} filters - Optional filters (position, search, limit, offset)
   * @returns {Promise<object>} API response with free agents list
   */
  getFreeAgents: async (leagueId, filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.position) params.append('position', filters.position);
      if (filters.search) params.append('search', filters.search);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);
      
      const queryString = params.toString();
      const url = queryString ? `/api/leagues/${leagueId}/free-agents?${queryString}` : `/api/leagues/${leagueId}/free-agents`;
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error getting free agents:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to get free agents',
        players: [],
        total_count: 0
      };
    }
  },

  /**
   * Add a free agent player to user's team
   * @param {string} leagueId - The league ID
   * @param {object} playerData - Player data (player_id, salary, contract_years, roster_status)
   * @returns {Promise<object>} API response
   */
  addPlayerToTeam: async (leagueId, playerData) => {
    try {
      const response = await api.post(`/api/leagues/${leagueId}/add-player`, {
        player_id: playerData.player_id,
        salary: playerData.salary || 1.0,
        contract_years: playerData.contract_years || 1,
        roster_status: playerData.roster_status || 'active'
      });
      return response.data;
    } catch (error) {
      console.error('Error adding player:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to add player'
      };
    }
  },

  /**
   * Drop a player from user's team
   * @param {string} leagueId - The league ID
   * @param {string} leaguePlayerId - The league player ID to drop
   * @returns {Promise<object>} API response
   */
  dropPlayerFromTeam: async (leagueId, leaguePlayerId) => {
    try {
      const response = await api.post(`/api/leagues/${leagueId}/drop-player`, {
        league_player_id: leaguePlayerId
      });
      return response.data;
    } catch (error) {
      console.error('Error dropping player:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to drop player'
      };
    }
  },

  /**
   * Get current user's roster for the league
   * @param {string} leagueId - The league ID
   * @returns {Promise<object>} API response with roster data
   */
  getMyRoster: async (leagueId) => {
    try {
      const response = await api.get(`/api/leagues/${leagueId}/my-roster`);
      return response.data;
    } catch (error) {
      console.error('Error getting roster:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to get roster',
        team_id: null,
        team_name: 'No Team',
        players: [],
        total_salary: 0.0,
        roster_spots: { active: 0, bench: 0, injured: 0, total: 0 }
      };
    }
  },

  // =============================================================================
  // HYBRID INVITATION SYSTEM - UPDATED PATHS
  // =============================================================================

  /**
   * Send an invitation to join a league (League-specific admin endpoint)
   * @param {string} leagueId - The league ID
   * @param {object} invitationData - Invitation details
   * @returns {Promise<object>} API response
   */
  inviteOwner: async (leagueId, invitationData) => {
    try {
      const response = await api.post(`/api/leagues/${leagueId}/invite-owner`, invitationData);
      return response.data;
    } catch (error) {
      console.error('Error sending invitation:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to send invitation'
      };
    }
  },

  /**
   * Get all pending invitations for a league (League-specific admin endpoint)
   * @param {string} leagueId - The league ID
   * @returns {Promise<object>} API response with invitations array
   */
  getInvitations: async (leagueId) => {
    try {
      const response = await api.get(`/api/leagues/${leagueId}/invitations`);
      return response.data;
    } catch (error) {
      console.error('Error fetching invitations:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to fetch invitations',
        invitations: []
      };
    }
  },

  /**
   * Cancel a pending invitation (League-specific admin endpoint)
   * @param {string} leagueId - The league ID
   * @param {string} invitationId - The invitation ID to cancel
   * @returns {Promise<object>} API response
   */
  cancelInvitation: async (leagueId, invitationId) => {
    try {
      const response = await api.delete(`/api/leagues/${leagueId}/invitations/${invitationId}`);
      return response.data;
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to cancel invitation'
      };
    }
  },

  /**
   * Resend an invitation email (League-specific admin endpoint)
   * @param {string} leagueId - The league ID
   * @param {string} invitationId - The invitation ID to resend
   * @returns {Promise<object>} API response
   */
  resendInvitation: async (leagueId, invitationId) => {
    try {
      const response = await api.post(`/api/leagues/${leagueId}/invitations/${invitationId}/resend`);
      return response.data;
    } catch (error) {
      console.error('Error resending invitation:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to resend invitation'
      };
    }
  },

  /**
   * Verify an invitation token (Public endpoint - no auth required)
   * UPDATED PATH: Now calls separate invitation router
   * @param {string} token - The invitation token from the URL
   * @returns {Promise<object>} API response with invitation details
   */
  verifyInvitation: async (token) => {
    try {
      const response = await api.get(`/api/invitation/verify?token=${encodeURIComponent(token)}`);
      return response.data;
    } catch (error) {
      console.error('Error verifying invitation:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Invalid or expired invitation link'
      };
    }
  },

  /**
   * Accept an invitation and join the league (Public endpoint with auth required)
   * UPDATED PATH: Now calls separate invitation router
   * @param {string} token - The invitation token
   * @returns {Promise<object>} API response with team details
   */
  acceptInvitation: async (token) => {
    try {
      const response = await api.post('/api/invitation/accept', { token });
      return response.data;
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to join league'
      };
    }
  }
};

// =============================================================================
// PLAYERS API
// =============================================================================

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

// =============================================================================
// ANALYTICS API
// =============================================================================

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

// =============================================================================
// UTILITIES API
// =============================================================================

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

// =============================================================================
// HELPER FUNCTIONS FOR ASYNC LEAGUE CREATION
// =============================================================================

/**
 * Utility function to handle async league creation with automatic polling
 * Usage:
 *
 * const result = await createLeagueWithPolling(leagueData, {
 * onProgress: (status) => console.log('Progress:', status),
 * onComplete: (result) => console.log('League created:', result),
 * onError: (error) => console.error('Creation failed:', error)
 * });
 */
export const createLeagueWithPolling = async (leagueData, callbacks = {}) => {
  const { onProgress, onComplete, onError, pollInterval = 3000, maxAttempts = 60 } = callbacks;

  try {
    // Start league creation
    const createResponse = await leaguesAPI.createLeague(leagueData);

    if (!createResponse.success || !createResponse.league_id) {
      throw new Error(createResponse.message || 'Failed to start league creation');
    }

    const leagueId = createResponse.league_id;
    let attempts = 0;

    // Polling function
    const pollStatus = async () => {
      try {
        attempts++;
        const statusResponse = await leaguesAPI.checkLeagueCreationStatus(leagueId);

        if (statusResponse.success) {
          // Call progress callback if provided
          if (onProgress) {
            onProgress(statusResponse);
          }

          if (statusResponse.status === 'completed') {
            // Success!
            if (onComplete) {
              onComplete(statusResponse);
            }
            return statusResponse;

          } else if (statusResponse.status === 'failed') {
            // Creation failed
            const error = new Error(statusResponse.message || statusResponse.error || 'League creation failed');
            if (onError) {
              onError(error);
            }
            throw error;

          } else if (attempts >= maxAttempts) {
            // Timeout
            const error = new Error('League creation timed out');
            if (onError) {
              onError(error);
            }
            throw error;

          } else {
            // Still in progress, continue polling
            setTimeout(pollStatus, pollInterval);
          }
        } else {
          throw new Error('Failed to get league creation status');
        }
      } catch (error) {
        if (onError) {
          onError(error);
        }
        throw error;
      }
    };

    // Start polling
    setTimeout(pollStatus, pollInterval);

    return { league_id: leagueId, status: 'polling_started' };

  } catch (error) {
    if (onError) {
      onError(error);
    }
    throw error;
  }
};

/**
 * Simple promise-based league creation that resolves when complete
 * Returns the final league creation result
 */
export const createLeagueAsync = (leagueData, options = {}) => {
  const { pollInterval = 3000, maxAttempts = 60 } = options;

  return new Promise((resolve, reject) => {
    createLeagueWithPolling(leagueData, {
      pollInterval,
      maxAttempts,
      onComplete: resolve,
      onError: reject
    });
  });
};

// Export the axios instance for custom requests
export default api;