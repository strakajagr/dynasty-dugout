// src/components/dashboard/WelcomeBanner.js - MATCHING LEAGUE HOME EXACTLY
import React, { useState, useEffect } from 'react';
import { dynastyTheme } from '../../services/colorService';
import apiService from '../../services/apiService';

const WelcomeBanner = ({ user }) => {
  const [settings, setSettings] = useState({
    backgroundImage: '',
    backgroundType: 'gradient',
    backgroundColor: '#0F172A',
    gradientStart: '#1a1a1a',  // Dynasty dark gray
    gradientEnd: '#0a0a0a',    // Dynasty nearly black
    textColor: '#facc15',      // Dynasty gold - but we'll override for main title
    fontSize: 'text-3xl',
    fontWeight: 'font-bold',
    customGreeting: '',
    customSubtext: '',
    imageOpacity: 0.3,
    textShadow: true,
    bannerHeight: 'medium'
  });

  useEffect(() => {
    loadSettings();
    
    // Listen for settings updates from MyAccount page
    const handleSettingsUpdate = (event) => {
      setSettings(event.detail);
    };
    
    window.addEventListener('welcomeSettingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('welcomeSettingsUpdated', handleSettingsUpdate);
  }, []);

  const loadSettings = async () => {
    try {
      // FIXED: Added leading slash to API endpoint
      const response = await apiService.get('/api/account/welcome-settings');
      
      if (response.data && response.data.settings) {
        setSettings(prev => ({ ...prev, ...response.data.settings }));
      }
    } catch (error) {
      console.error('Error loading welcome settings:', error);
    }
  };

  const userName = user?.given_name || user?.firstName || 'Tony';
  const greeting = settings.customGreeting || `Welcome back, ${userName}!`;
  const subtext = settings.customSubtext || 'Your dynasty awaits. Manage your leagues and build your empire.';

  // Default baseball stadium image for consistency with League Home
  const defaultBannerImage = 'https://images.unsplash.com/photo-1578662996442-48f60103fc61?w=1920&h=400&fit=crop&crop=center';
  const bannerImage = (settings.backgroundType === 'image' && settings.backgroundImage) 
    ? settings.backgroundImage 
    : defaultBannerImage;

  // Match League Home card styling exactly
  return (
    <div className={`${dynastyTheme.components.card.highlighted} relative overflow-hidden`}>
      {/* Background Layer - softer like League Home */}
      <div className="absolute inset-0">
        {settings.backgroundType === 'image' ? (
          <>
            <img 
              src={bannerImage}
              alt="Welcome Banner"
              className="w-full h-full object-cover opacity-30"
              onError={(e) => {
                console.error('Failed to load welcome banner');
                e.target.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-900/70 to-neutral-900"></div>
          </>
        ) : (
          // Softer gradient background - matching League Home
          <div className="w-full h-full" 
               style={{ 
                 background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.6), rgba(10, 10, 10, 0.8))' 
               }} 
          />
        )}
      </div>

      {/* Content Layer - EXACT League Home structure */}
      <div className="relative p-6">
        <div className="flex items-center justify-between">
          <div>
            {/* Main title - WHITE with glow like League Home */}
            <h1 className={`text-3xl font-bold drop-shadow-lg`}
                style={{ 
                  color: '#FFFFFF',  // WHITE not yellow
                  textShadow: '0 0 30px rgba(250,204,21,0.4), 0 2px 4px rgba(0,0,0,0.8)'  // Subtle yellow glow
                }}>
              {greeting}
            </h1>
            
            {/* Subtitle - smaller, lighter, no glow like League Home */}
            <p className="drop-shadow-md"
               style={{ 
                 color: 'rgba(255, 255, 255, 0.7)',  // Light white/gray
                 fontSize: '0.875rem',  // Smaller text
                 textShadow: '0 2px 4px rgba(0,0,0,0.7)'  // Just shadow, no glow
               }}>
              Week 17 • 2025 Season • {subtext}
            </p>
          </div>

          {/* Right side date - matching League Home */}
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded text-sm font-semibold"
                  style={{
                    backgroundColor: dynastyTheme.tokens.colors.primary,
                    color: '#000000'
                  }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;