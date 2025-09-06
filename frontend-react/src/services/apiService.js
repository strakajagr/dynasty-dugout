// frontend-react/src/services/apiService.js
// Updated with team browsing, commissioner support, S3 logo upload, and TEAM STATS ENDPOINTS FIXED

import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  withCredentials: true,
  baseURL: process.env.REACT_APP_API_URL || 'https://13cpdms4x1.execute-api.us-east-1.amazonaws.com/Prod',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`📡 API: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response from ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else {
      console.error('API Network Error:', error);
    }
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

  signUp: async (userData) => {
    const response = await api.post('/api/auth/signup', {
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
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
// ACCOUNT API - ENHANCED WITH PROFILE PICTURE UPLOAD
// =============================================================================

export const accountAPI = {
  // Profile Management
  getProfile: async () => {
    const response = await api.get('/api/account/profile');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/api/account/profile', profileData);
    return response.data;
  },

  // ===============================================
  // PROFILE PICTURE UPLOAD - NEW FUNCTIONS
  // ===============================================
  
  // Get presigned URL for profile picture upload
  getProfilePictureUploadUrl: async (filename, contentType) => {
    const response = await api.post('/api/account/get-profile-picture-upload-url', {
      filename: filename,
      content_type: contentType
    });
    return response.data;
  },

  // Upload file to S3 using presigned URL
  uploadProfilePictureToS3: async (presignedUrl, file) => {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
    
    return { success: true, status: response.status };
  },

  // Complete profile picture upload flow (same pattern as team logo)
  uploadProfilePicture: async (file) => {
    try {
      console.log('📸 Starting profile picture upload for:', file.name);
      
      // Step 1: Get presigned URL
      const urlResponse = await accountAPI.getProfilePictureUploadUrl(file.name, file.type);
      
      if (!urlResponse.success) {
        throw new Error(urlResponse.message || 'Failed to get upload URL');
      }
      
      // Step 2: Upload file to S3
      await accountAPI.uploadProfilePictureToS3(urlResponse.upload_url, file);
      
      console.log('✅ Profile picture uploaded successfully to:', urlResponse.public_url);
      
      // Step 3: Return public URL for display
      return {
        success: true,
        profile_picture_url: urlResponse.public_url,
        s3_key: urlResponse.s3_key
      };
      
    } catch (error) {
      console.error('❌ Profile picture upload failed:', error);
      throw error;
    }
  },

  // Welcome Settings
  getWelcomeSettings: async () => {
    const response = await api.get('/api/account/welcome-settings');
    return response.data;
  },

  updateWelcomeSettings: async (settings) => {
    const response = await api.put('/api/account/welcome-settings', settings);
    return response.data;
  },

  // Banner Image Upload (DEPRECATED - use profile picture instead)
  uploadBannerImage: async (formData) => {
    const response = await api.post('/api/account/upload-banner-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Account Health Check
  healthCheck: async () => {
    const response = await api.get('/api/account/account-health');
    return response.data;
  }
};

// =============================================================================
// TEAM STATS API - NEW SECTION
// =============================================================================

export const teamStatsAPI = {
  // Get team statistics with 3-line display (just the array)
  getTeamStats: async (leagueId, teamId) => {
    const response = await api.get(`/api/leagues/${leagueId}/teams/${teamId}/stats`);
    return response.data;
  },

  // Get current user's team statistics
  getMyTeamStats: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/my-team-stats`);
    return response.data;
  },

  // Get complete team stats dashboard with totals and transactions
  getTeamStatsDashboard: async (leagueId, teamId) => {
    const response = await api.get(`/api/leagues/${leagueId}/team-stats-dashboard/${teamId}`);
    return response.data;
  }
};

// =============================================================================
// LEAGUES API
// =============================================================================

export const leaguesAPI = {
  // League Management
  getMyLeagues: async () => {
    const response = await api.get('/api/leagues/my-leagues');
    return response.data;
  },

  createLeague: async (leagueData) => {
    const response = await api.post('/api/leagues/create', leagueData);
    return response.data;
  },

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

  // League Status Management - COMPLETE SET
  getLeagueStatus: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/status`);
    return response.data;
  },

  updateLeagueStatus: async (leagueId, newStatus) => {
    const response = await api.put(`/api/leagues/${leagueId}/status`, { 
      league_status: newStatus 
    });
    return response.data;
  },

  setDraftType: async (leagueId, draftType) => {
    const response = await api.put(`/api/leagues/${leagueId}/draft-type`, { 
      draft_type: draftType 
    });
    return response.data;
  },

  startSeason: async (leagueId) => {
    const response = await api.post(`/api/leagues/${leagueId}/start-season`);
    return response.data;
  },

  checkPriceStatus: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/price-status`);
    return response.data;
  },

  // ===============================================
  // PRICING ENGINE ENDPOINTS
  // ===============================================
  
  getPricingData: async (leagueId) => {
    try {
      const response = await api.get(`/api/leagues/${leagueId}/salaries/pricing-data`);
      return response.data;
    } catch (error) {
      console.error('Error fetching pricing data:', error);
      throw error;
    }
  },

  // ===============================================
  // SALARY & CONTRACT SETTINGS - WITH ASYNC SUPPORT
  // ===============================================
  
  getSalarySettings: async (leagueId) => {
    try {
      const response = await api.get(`/api/leagues/${leagueId}/salaries/settings`);
      return response.data;
    } catch (error) {
      console.error('Error fetching salary settings:', error);
      return { 
        success: true,
        settings: {
          use_dual_cap: true,
          draft_cap: 600,
          season_cap: 200,
          salary_cap: 800,
          min_salary: 2,
          salary_increment: 2,
          rookie_price: 20,
          draft_cap_usage: 0.75,
          hitting_categories: ['R', 'RBI', 'HR', 'SB', 'AVG', 'OPS'],
          pitching_categories: ['W', 'QS', 'K', 'S', 'ERA', 'WHIP']
        }
      };
    }
  },

  // Synchronous update for small datasets (< 100 players)
  updateSalarySettings: async (leagueId, settings) => {
    const response = await api.post(`/api/leagues/${leagueId}/salaries/prices`, settings);
    return response.data;
  },

  // NEW: Async save for large datasets
  startAsyncPriceSave: async (leagueId, settings) => {
    const response = await api.post(`/api/leagues/${leagueId}/salaries/prices/async`, settings);
    return response.data;
  },

  // NEW: Check async job status
  checkPriceSaveStatus: async (leagueId, jobId) => {
    const response = await api.get(`/api/leagues/${leagueId}/salaries/job/${jobId}`);
    return response.data;
  },

  // NEW: Poll for job completion
  pollPriceSaveJob: async (leagueId, jobId, options = {}) => {
    const { 
      onProgress, 
      pollInterval = 2000, 
      maxAttempts = 150  // 5 minutes max
    } = options;
    
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const status = await leaguesAPI.checkPriceSaveStatus(leagueId, jobId);
          
          if (onProgress) {
            onProgress(status);
          }
          
          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'failed') {
            reject(new Error(status.error || 'Price save failed'));
          } else if (attempts >= maxAttempts) {
            reject(new Error('Price save timed out'));
          } else {
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  },

  savePrices: async (leagueId, prices, settings, method = 'adaptive') => {
    const response = await api.post(`/api/leagues/${leagueId}/save-prices`, {
      prices,
      settings,
      method
    });
    return response.data;
  },

  resetPrices: async (leagueId) => {
    const response = await api.post(`/api/leagues/${leagueId}/reset-prices`);
    return response.data;
  },

  // League Settings & Info
  getLeagueSettings: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/settings`);
    return response.data;
  },

  getLeagueOwners: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/owners`);
    return response.data;
  },

  getLeagueStandings: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/standings`);
    return response.data;
  },

  getUserTeam: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/my-team?t=${Date.now()}`);
    return response.data;
  },

  // ===============================================
  // TEAM MANAGEMENT & LOGO UPLOAD
  // ===============================================
  
  // Team Setup
  setupTeam: async (leagueId, teamData) => {
    const response = await api.post(`/api/leagues/${leagueId}/setup-team`, teamData);
    return response.data;
  },

  // NEW: Get presigned URL for logo upload
  getLogoUploadUrl: async (leagueId, filename, contentType) => {
    const response = await api.post(`/api/leagues/${leagueId}/upload-logo-url`, {
      filename: filename,
      content_type: contentType
    });
    return response.data;
  },

  // NEW: Upload file to S3 using presigned URL
  uploadLogoToS3: async (presignedUrl, file) => {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
    
    return { success: true, status: response.status };
  },

  // NEW: Complete logo upload flow (get URL + upload + return public URL)
  uploadTeamLogo: async (leagueId, file) => {
    try {
      console.log('🖼️ Starting team logo upload for:', file.name);
      
      // Step 1: Get presigned URL
      const urlResponse = await leaguesAPI.getLogoUploadUrl(leagueId, file.name, file.type);
      
      if (!urlResponse.success) {
        throw new Error(urlResponse.message || 'Failed to get upload URL');
      }
      
      // Step 2: Upload file to S3
      await leaguesAPI.uploadLogoToS3(urlResponse.upload_url, file);
      
      console.log('✅ Logo uploaded successfully to:', urlResponse.public_url);
      
      // Step 3: Return public URL for saving to database
      return {
        success: true,
        logo_url: urlResponse.public_url,
        s3_key: urlResponse.s3_key
      };
      
    } catch (error) {
      console.error('❌ Logo upload failed:', error);
      throw error;
    }
  },

  // NEW: Delete team logo
  deleteTeamLogo: async (leagueId) => {
    const response = await api.delete(`/api/leagues/${leagueId}/team-logo`);
    return response.data;
  },

  // ===============================================
  // LEAGUE BANNER UPLOAD - NEW FUNCTIONS
  // ===============================================
  
  // Get presigned URL for league banner upload
  getLeagueBannerUploadUrl: async (leagueId, filename, contentType) => {
    const response = await api.post(`/api/leagues/${leagueId}/upload-banner-url`, {
      filename: filename,
      content_type: contentType
    });
    return response.data;
  },

  // Upload file to S3 using presigned URL
  uploadBannerToS3: async (presignedUrl, file) => {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
    
    return { success: true, status: response.status };
  },

  // Complete league banner upload flow
  uploadLeagueBanner: async (leagueId, file) => {
    try {
      console.log('🏆 Starting league banner upload for:', file.name);
      
      // Step 1: Get presigned URL
      const urlResponse = await leaguesAPI.getLeagueBannerUploadUrl(leagueId, file.name, file.type);
      
      if (!urlResponse.success) {
        throw new Error(urlResponse.message || 'Failed to get upload URL');
      }
      
      // Step 2: Upload file to S3
      await leaguesAPI.uploadBannerToS3(urlResponse.upload_url, file);
      
      console.log('✅ League banner uploaded successfully to:', urlResponse.public_url);
      
      // Step 3: Return public URL for display
      return {
        success: true,
        banner_url: urlResponse.public_url,
        s3_key: urlResponse.s3_key
      };
      
    } catch (error) {
      console.error('❌ League banner upload failed:', error);
      throw error;
    }
  },

  // Update league settings including banner URL
  updateLeagueSettings: async (leagueId, settings) => {
    const response = await api.put(`/api/leagues/${leagueId}/settings`, settings);
    return response.data;
  },

  // ===============================================
  // TEAM BROWSING & ROSTER MANAGEMENT - ENHANCED
  // ===============================================
  
  // Get all teams in league for browsing
  getLeagueTeams: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/teams`);
    return response.data;
  },

  // Get current user's roster (original functionality)
  getMyRoster: async (leagueId, options = {}) => {
    let url = `/api/leagues/${leagueId}/my-roster`;
    
    // Support commissioner mode parameters
    if (options.commissioner_action && options.target_team_id) {
      const params = new URLSearchParams({
        target_team_id: options.target_team_id,
        commissioner_action: 'true'
      });
      url += `?${params.toString()}`;
    }
    
    const response = await api.get(url);
    return response.data;
  },

  // NEW: Get any team's roster by team_id (read-only for non-owners)
  getTeamRoster: async (leagueId, teamId) => {
    const response = await api.get(`/api/leagues/${leagueId}/teams/${teamId}/roster`);
    return response.data;
  },

  // Enhanced version with rolling stats
  getMyRosterEnhanced: async (leagueId, options = {}) => {
    let url = `/api/leagues/${leagueId}/my-roster-enhanced`;
    
    // Support commissioner mode parameters
    if (options.commissioner_action && options.target_team_id) {
      const params = new URLSearchParams({
        target_team_id: options.target_team_id,
        commissioner_action: 'true'
      });
      url += `?${params.toString()}`;
    }
    
    const response = await api.get(url);
    return response.data;
  },

  // NEW: Get any team's enhanced roster with stats
  getTeamRosterEnhanced: async (leagueId, teamId) => {
    const response = await api.get(`/api/leagues/${leagueId}/teams/${teamId}/roster-enhanced`);
    return response.data;
  },

  // Move roster player between positions/status
  moveRosterPlayer: async (leagueId, moveData) => {
    const response = await api.post(`/api/leagues/${leagueId}/roster-move`, moveData);
    return response.data;
  },

  // Add player to team (supports commissioner mode)
  addPlayerToTeam: async (leagueId, playerData) => {
    const requestData = {
      league_player_id: playerData.league_player_id,
      salary: playerData.salary || 1.0,
      contract_years: playerData.contract_years || 1,
      roster_status: playerData.roster_status || 'active',
      roster_position: playerData.roster_position || null
    };
    // Add commissioner support
    if (playerData.commissioner_action && playerData.target_team_id) {
      requestData.commissioner_action = true;
      requestData.target_team_id = playerData.target_team_id;
    }
    const response = await api.post(`/api/leagues/${leagueId}/add-player`, requestData);
    return response.data;
  },

  // Drop player from team (supports commissioner mode)
  dropPlayerFromTeam: async (leagueId, leaguePlayerId, options = {}) => {
    const requestData = {
      league_player_id: leaguePlayerId
    };

    // Add commissioner support
    if (options.commissioner_action && options.target_team_id) {
      requestData.commissioner_action = true;
      requestData.target_team_id = options.target_team_id;
    }

    const response = await api.post(`/api/leagues/${leagueId}/drop-player`, requestData);
    return response.data;
  },

  // ===============================================
  // TEAM STATISTICS - THREE-LINE DISPLAY
  // ===============================================
  
  // Get team statistics with 3-line display (Season/Accrued/14-day)
  getTeamStats: async (leagueId, teamId) => {
    const response = await api.get(`/api/leagues/${leagueId}/teams/${teamId}/stats`);
    return response.data;
  },

  // Get current user's team statistics
  getMyTeamStats: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/my-team-stats`);
    return response.data;
  },

  // Get complete team stats dashboard with totals
  getTeamStatsDashboard: async (leagueId, teamId) => {
    const response = await api.get(`/api/leagues/${leagueId}/team-stats-dashboard/${teamId}`);
    return response.data;
  },

  getTeamHomeData: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/players/team-home-data`);
    return response.data;
  },

  // Free Agents
  getFreeAgents: async (leagueId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.position) params.append('position', filters.position);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    
    const queryString = params.toString();
    const url = queryString 
      ? `/api/leagues/${leagueId}/free-agents?${queryString}` 
      : `/api/leagues/${leagueId}/free-agents`;
    
    const response = await api.get(url);
    return response.data;
  },

  getFreeAgentsEnhanced: async (leagueId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.position) params.append('position', filters.position);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    if (filters.show_all !== undefined) params.append('show_all', filters.show_all);
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.sort_order) params.append('sort_order', filters.sort_order);
    
    const queryString = params.toString();
    const url = queryString 
      ? `/api/leagues/${leagueId}/free-agents-enhanced?${queryString}` 
      : `/api/leagues/${leagueId}/free-agents-enhanced`;
    
    const response = await api.get(url);
    return response.data;
  },

  // Player Stats
  getLeaguePlayerStats: async (leagueId, playerId) => {
    const response = await api.get(`/api/leagues/${leagueId}/players/${playerId}/stats`);
    return response.data;
  },

  getLeaguePlayerGameLogs: async (leagueId, playerId) => {
    const response = await api.get(`/api/leagues/${leagueId}/players/${playerId}/game-logs`);
    return response.data;
  },

  getPlayerContract: async (leagueId, playerId) => {
    const response = await api.get(`/api/leagues/${leagueId}/players/${playerId}/contract`);
    return response.data;
  },

  // Transactions
  getTransactions: async (leagueId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.transaction_type) params.append('transaction_type', filters.transaction_type);
    if (filters.days_back) params.append('days_back', filters.days_back);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    const url = queryString 
      ? `/api/leagues/${leagueId}/transactions?${queryString}` 
      : `/api/leagues/${leagueId}/transactions`;
    
    const response = await api.get(url);
    return response.data;
  },

  processTransaction: async (leagueId, transactionData) => {
    const response = await api.post(`/api/leagues/${leagueId}/transactions`, transactionData);
    return response.data;
  },

  logTransaction: async (leagueId, transactionData) => {
    const response = await api.post(`/api/leagues/${leagueId}/log-transaction`, transactionData);
    return response.data;
  },

  getRecentActivity: async (leagueId, hoursBack = 48) => {
    try {
      const response = await api.get(`/api/leagues/${leagueId}/transactions`, {
        params: {
          days_back: Math.ceil(hoursBack / 24),
          limit: 20
        }
      });
      
      // Transform transactions into ticker-friendly format
      const activities = [];
      if (response.data.success && response.data.transactions) {
        response.data.transactions.forEach(t => {
          let text = '';
          if (t.transaction_type === 'add') {
            text = `📈 ${t.team_name || 'Team'} added ${t.player_name}`;
          } else if (t.transaction_type === 'drop') {
            text = `📉 ${t.team_name || 'Team'} dropped ${t.player_name}`;
          } else if (t.transaction_type === 'trade') {
            text = `🔄 Trade completed: ${t.notes}`;
          } else {
            text = t.notes || `${t.transaction_type}: ${t.player_name}`;
          }
          
          activities.push({
            id: t.transaction_id,
            text: text,
            priority: t.transaction_type === 'trade' ? 'high' : 'medium'
          });
        });
      }
      
      return { success: true, activities };
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return { success: false, activities: [] };
    }
  },

  // Trades
  createTrade: async (leagueId, tradeData) => {
    const response = await api.post(`/api/leagues/${leagueId}/trades`, tradeData);
    return response.data;
  },

  getTrades: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/trades`);
    return response.data;
  },

  // NEW: Initiate trade with specific team and players
  initiateTrade: async (leagueId, tradeData) => {
    const response = await api.post(`/api/leagues/${leagueId}/trades/initiate`, tradeData);
    return response.data;
  },

  // Invitations
  inviteOwner: async (leagueId, invitationData) => {
    const response = await api.post(`/api/leagues/${leagueId}/invite-owner`, invitationData);
    return response.data;
  },

  getInvitations: async (leagueId) => {
    const response = await api.get(`/api/leagues/${leagueId}/invitations`);
    return response.data;
  },

  cancelInvitation: async (leagueId, invitationId) => {
    const response = await api.delete(`/api/leagues/${leagueId}/invitations/${invitationId}`);
    return response.data;
  },

  resendInvitation: async (leagueId, invitationId) => {
    const response = await api.post(`/api/leagues/${leagueId}/invitations/${invitationId}/resend`);
    return response.data;
  },

  verifyInvitation: async (token) => {
    const response = await api.get(`/api/invitation/verify?token=${encodeURIComponent(token)}`);
    return response.data;
  },

  acceptInvitation: async (token) => {
    const response = await api.post('/api/invitation/accept', { token });
    return response.data;
  },

  toggleCommissionerStatus: async (leagueId, teamId, isCommissioner) => {
    const response = await api.put(`/api/leagues/${leagueId}/teams/${teamId}/commissioner-status`, {
      is_commissioner: isCommissioner
    });
    return response.data;
  },

  // Data Sync
  syncPlayers: async (leagueId) => {
    const response = await api.post(`/api/leagues/${leagueId}/sync-players`);
    return response.data;
  },

  syncLeagueData: async (leagueId) => {
    const response = await api.post(`/api/leagues/${leagueId}/sync-data`);
    return response.data;
  },

  notifyOwners: async (leagueId, notification) => {
    const response = await api.post(`/api/leagues/${leagueId}/notify-owners`, notification);
    return response.data;
  }
};

// =============================================================================
// PLAYERS API (Global - No League Context)
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
  },

  getCareerStats: async (playerId) => {
    const response = await api.get(`/api/players/${playerId}/career-stats`);
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
  }
};

// =============================================================================
// HELPER FUNCTIONS FOR ASYNC OPERATIONS
// =============================================================================

export const createLeagueWithPolling = async (leagueData, callbacks = {}) => {
  const { onProgress, onComplete, onError, pollInterval = 3000, maxAttempts = 60 } = callbacks;

  try {
    const createResponse = await leaguesAPI.createLeague(leagueData);

    if (!createResponse.success || !createResponse.league_id) {
      throw new Error(createResponse.message || 'Failed to start league creation');
    }

    const leagueId = createResponse.league_id;
    let attempts = 0;

    const pollStatus = async () => {
      try {
        attempts++;
        const statusResponse = await leaguesAPI.checkLeagueCreationStatus(leagueId);

        if (statusResponse.success) {
          if (onProgress) {
            onProgress(statusResponse);
          }

          if (statusResponse.status === 'completed') {
            if (onComplete) {
              onComplete(statusResponse);
            }
            return statusResponse;

          } else if (statusResponse.status === 'failed') {
            const error = new Error(statusResponse.message || 'League creation failed');
            if (onError) {
              onError(error);
            }
            throw error;

          } else if (attempts >= maxAttempts) {
            const error = new Error('League creation timed out');
            if (onError) {
              onError(error);
            }
            throw error;

          } else {
            setTimeout(pollStatus, pollInterval);
          }
        }
      } catch (error) {
        if (onError) {
          onError(error);
        }
        throw error;
      }
    };

    setTimeout(pollStatus, pollInterval);
    return { league_id: leagueId, status: 'polling_started' };

  } catch (error) {
    if (onError) {
      onError(error);
    }
    throw error;
  }
};

// =============================================================================
// DEFAULT EXPORT - Support direct api.get(), api.post() calls
// =============================================================================

// Default export with direct access methods for backwards compatibility
export default {
  // Direct access to axios methods
  get: api.get.bind(api),
  post: api.post.bind(api),
  put: api.put.bind(api),
  delete: api.delete.bind(api),
  patch: api.patch.bind(api),
  
  // Named API exports for organized access
  auth: authAPI,
  account: accountAPI,
  leagues: leaguesAPI,
  teamStats: teamStatsAPI,
  players: playersAPI,
  utilities: utilitiesAPI
};

// Build timestamp: Team Stats Endpoints Fixed - teamStatsAPI Export Added