import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService'; // Import dynastyTheme for consistency if needed elsewhere in context

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status when app loads
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    console.log('🔍 AuthContext: checkAuthStatus initiated.'); // Added log
    try {
      setLoading(true);
      const response = await authAPI.checkAuth();
      if (response.authenticated) {
        setUser(response.user);
        setIsAuthenticated(true);
        console.log('✅ AuthContext: checkAuthStatus completed. Authenticated: true, User:', response.user); // Added log
      } else {
        setUser(null);
        setIsAuthenticated(false);
        console.log('❌ AuthContext: checkAuthStatus completed. Authenticated: false.'); // Added log
      }
    } catch (error) {
      console.error('💥 AuthContext: Auth check failed in checkAuthStatus:', error); // Added log
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
      console.log('🔄 AuthContext: checkAuthStatus finished, loading set to false.'); // Added log
    }
  };

  const signIn = async (email, password) => {
    console.log('🔍 AuthContext: SignIn function called with:', { email, password: '***' });
    
    try {
      console.log('📡 AuthContext: About to call authAPI.signIn...');
      const response = await authAPI.signIn(email, password);
      console.log('✅ AuthContext: API response received:', response);
      
      if (response.success && response.user) {
        setUser(response.user);
        setIsAuthenticated(true);
        console.log('🎉 AuthContext: Authentication successful!');
        
        // --- FIX APPLIED HERE ---
        // REMOVED: window.location.href = '/dashboard';
        // The calling component (e.g., AuthModal or JoinLeague) will now handle navigation.
        
        return { success: true, user: response.user }; // Return user data for calling component
      } else {
        console.log('❌ AuthContext: Response indicates not authenticated:', response);
        return { success: false, error: 'Authentication failed' };
      }
    } catch (error) {
      console.error('💥 AuthContext: Sign in error caught:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Sign in failed'
      };
    }
  };

  const signUp = async (userData) => { // Correctly accepts userData object
    console.log('🔍 AuthContext: SignUp function called with:', userData);
    try {
      const response = await authAPI.signUp(userData);
      console.log('✅ AuthContext: SignUp API response received:', response);
      return { success: true, message: response.message, requiresVerification: response.requiresVerification, userSub: response.userSub };
    } catch (error) {
      console.error('💥 AuthContext: Sign up error caught:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Sign up failed' 
      };
    }
  };

  const signOut = async () => {
    console.log('🔍 AuthContext: SignOut function called.');
    try {
      await authAPI.signOut();
      setUser(null);
      setIsAuthenticated(false);
      console.log('👋 AuthContext: SignOut successful.');
      return { success: true };
    } catch (error) {
      console.error('💥 AuthContext: Sign out error caught:', error);
      // Even if API call fails, clear local state to ensure logout
      setUser(null);
      setIsAuthenticated(false);
      return { success: true }; // Still return success if local state cleared
    }
  };

  const updateProfile = async (profileData) => {
    console.log('🔍 AuthContext: Update profile called with:', profileData);
    try {
      const response = await authAPI.updateProfile(profileData);
      if (response.success && response.profile) {
        setUser(response.profile); // Assuming API returns updated user data
      }
      return { success: true, message: response.message };
    } catch (error) {
      console.error('💥 AuthContext: Profile update error:', error);
      return { success: false, error: error.response?.data?.detail || 'Profile update failed' };
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};