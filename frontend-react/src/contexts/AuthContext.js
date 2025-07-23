// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/apiService';

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
    try {
      setLoading(true);
      const response = await authAPI.checkAuth();
      if (response.authenticated) {
        setUser(response.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    console.log('🔍 SignIn function called with:', { email, password: '***' });
    
    try {
      console.log('📡 About to call authAPI.signIn...');
      const response = await authAPI.signIn(email, password);
      console.log('✅ API response received:', response);
      
      if (response.success && response.user) {
        setUser(response.user);
        setIsAuthenticated(true);
        console.log('🎉 Authentication successful!');
        
        // Add explicit redirect to dashboard
        window.location.href = '/dashboard';
        
        return { success: true };
      } else {
        console.log('❌ Response indicates not authenticated:', response);
        return { success: false, error: 'Authentication failed' };
      }
    } catch (error) {
      console.error('💥 Sign in error caught:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Sign in failed'
      };
    }
  };

  const signUp = async (email, password, firstName, lastName, favoriteTeam) => {
    try {
      const response = await authAPI.signUp(email, password, firstName, lastName, favoriteTeam);
      return { success: true, message: response.message };
    } catch (error) {
      console.error('Sign up error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Sign up failed' 
      };
    }
  };

  const signOut = async () => {
    try {
      await authAPI.signOut();
      setUser(null);
      setIsAuthenticated(false);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if API call fails, clear local state
      setUser(null);
      setIsAuthenticated(false);
      return { success: true };
    }
  };

  const updateProfile = async (firstName, lastName, favoriteTeam) => {
    try {
      const response = await authAPI.updateProfile(firstName, lastName, favoriteTeam);
      // Update local user state
      setUser(prev => ({
        ...prev,
        firstName,
        lastName,
        favoriteTeam
      }));
      return { success: true, message: response.message };
    } catch (error) {
      console.error('Profile update error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Profile update failed' 
      };
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