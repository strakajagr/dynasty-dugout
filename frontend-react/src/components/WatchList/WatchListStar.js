// src/components/WatchList/WatchListStar.js
import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import apiService from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';

/**
 * WatchListStar - Reusable star button for adding/removing players from watch list
 * Shows filled star if player is on watch list, empty star if not
 * Can be embedded anywhere: search results, player cards, modals, etc.
 */
export const WatchListStar = ({ 
  playerId, 
  size = 20, 
  className = '',
  showTooltip = true,
  onToggle = null // Optional callback when toggled
}) => {
  const [isOnWatchList, setIsOnWatchList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  // Check if player is on watch list on mount
  useEffect(() => {
    if (isAuthenticated && playerId) {
      checkWatchListStatus();
    } else {
      setLoading(false);
    }
  }, [playerId, isAuthenticated]);

  const checkWatchListStatus = async () => {
    try {
      const response = await apiService.get(`/api/watchlist/player/${playerId}/status`);
      setIsOnWatchList(response.data?.is_watched || false);
    } catch (err) {
      console.error('Error checking watch list status:', err);
      setIsOnWatchList(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (e) => {
    e.stopPropagation(); // Prevent triggering parent click handlers
    
    if (!isAuthenticated) {
      alert('Please sign in to use the watch list');
      return;
    }

    if (actionLoading) return;

    setActionLoading(true);
    
    try {
      if (isOnWatchList) {
        // Remove from watch list
        await apiService.delete(`/api/watchlist/remove/${playerId}`);
        setIsOnWatchList(false);
        if (onToggle) onToggle(false);
      } else {
        // Add to watch list - send player_id as query parameter
        await apiService.post(`/api/watchlist/add?player_id=${playerId}`);
        setIsOnWatchList(true);
        if (onToggle) onToggle(true);
      }
    } catch (err) {
      console.error('Error toggling watch list:', err);
      alert(`Failed to ${isOnWatchList ? 'remove from' : 'add to'} watch list`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Don't show star if not authenticated
  }

  if (loading) {
    return (
      <div 
        className={`inline-flex items-center justify-center ${className}`} 
        style={{ width: size, height: size }}
      >
        <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent animate-spin rounded-full" />
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={actionLoading}
      className={`
        inline-flex items-center justify-center
        transition-all duration-200
        ${actionLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'}
        ${className}
      `}
      style={{ width: size, height: size }}
      title={showTooltip ? (isOnWatchList ? 'Remove from watch list' : 'Add to watch list') : undefined}
    >
      {actionLoading ? (
        <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent animate-spin rounded-full" />
      ) : (
        <Star
          className={`
            transition-all duration-200
            ${isOnWatchList 
              ? `${dynastyTheme.classes.text.primary} fill-current` 
              : `${dynastyTheme.classes.text.neutralLight} hover:${dynastyTheme.classes.text.primary}`
            }
          `}
          size={size}
        />
      )}
    </button>
  );
};
