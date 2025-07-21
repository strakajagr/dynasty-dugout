// src/services/apiService.js
import axios from 'axios';

// Configure axios with base settings - matches your working vanilla JS setup
const api = axios.create({
  baseURL: '/api', // Always use relative path - CloudFront proxy handles routing
  withCredentials: true, // Include httpOnly cookies - essential for your auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login if unauthorized
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  // Sign in user - matches your backend /auth/login endpoint
  signIn: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  // Sign up new user
  signUp: async (email, password, firstName, lastName, favoriteTeam) => {
    const response = await api.post('/auth/signup', {
      email,
      password,
      firstName,
      lastName,
      favoriteTeam
    });
    return response.data;
  },

  // Verify email
  verifyEmail: async (email, code) => {
    const response = await api.post('/auth/verify-email', { email, code });
    return response.data;
  },

  // Resend verification code
  resendVerification: async (email) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  // Forgot password
  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  // Reset password
  resetPassword: async (email, code, newPassword) => {
    const response = await api.post('/auth/reset-password', {
      email,
      code,
      newPassword
    });
    return response.data;
  },

  // Sign out - matches your backend /auth/logout endpoint
  signOut: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  // Check authentication status - matches your backend /auth/status endpoint
  checkAuth: async () => {
    const response = await api.get('/auth/status');
    return response.data;
  },

  // Update profile
  updateProfile: async (firstName, lastName, favoriteTeam) => {
    const response = await api.put('/auth/update-profile', {
      firstName,
      lastName,
      favoriteTeam
    });
    return response.data;
  }
};

export const playersAPI = {
  // Get all players
  getPlayers: async () => {
    const response = await api.get('/players');
    return response.data;
  },

  // Get player by ID
  getPlayer: async (playerId) => {
    const response = await api.get(`/players/${playerId}`);
    return response.data;
  },

  // NEW: Get detailed player information with stats
  getPlayerDetails: async (playerId, includeStats = true, seasonYear = 2025) => {
    const params = new URLSearchParams();
    
    if (includeStats) {
      params.append('include_stats', 'true');
    }
    
    params.append('season_year', seasonYear.toString());
    
    const queryString = params.toString();
    const endpoint = `/players/${playerId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(endpoint);
    return response.data;
  }
};

export default api;