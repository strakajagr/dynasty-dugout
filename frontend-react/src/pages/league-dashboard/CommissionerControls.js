// src/pages/league-dashboard/CommissionerControls.js - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gavel, Lock, AlertCircle, Check, Users, DollarSign, Calendar, ArrowLeft, ChevronLeft } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';

const CommissionerControls = ({ leagueId, league, onStatusChange }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(league?.league_status || 'setup');
  const [draftType, setDraftType] = useState(null);
  const [pricesSet, setPricesSet] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch status directly from the status endpoint on mount
  useEffect(() => {
    fetchCurrentStatus();
  }, [leagueId]);

  // Don't sync with parent league prop - it may be stale
  // Only fetch fresh data from backend

  const fetchCurrentStatus = async () => {
    try {
      // Get status directly from the status endpoint using leaguesAPI
      const statusData = await leaguesAPI.getLeagueStatus(leagueId);
      console.log('Fetched status from backend:', statusData);
      
      if (statusData.success) {
        setCurrentStatus(statusData.league_status);
        setDraftType(statusData.draft_type);
        setPricesSet(statusData.prices_set);
      }
      
      // Also check price status separately if needed
      const priceResponse = await leaguesAPI.checkPriceStatus(leagueId);
      if (priceResponse.success) {
        setPricesSet(priceResponse.prices_set);
      }
    } catch (error) {
      console.error('Error fetching current status:', error);
      setError('Failed to fetch current status');
      setTimeout(() => setError(''), 5000);
    }
  };

  const updateLeagueStatus = async (newStatus, isGoingBack = false) => {
    try {
      setLoading(true);
      setError('');
      setMessage('');
      
      if (isGoingBack) {
        const confirmMessage = `Are you sure you want to go back to the ${newStatus} step? This will revert the league status.`;
        if (!window.confirm(confirmMessage)) {
          setLoading(false);
          return;
        }
      }
      
      console.log('Updating league status to:', newStatus);
      
      const response = await leaguesAPI.updateLeagueStatus(leagueId, newStatus);
      
      console.log('Update response:', response);
      
      if (response && response.success) {
        // Update local state immediately
        setCurrentStatus(newStatus);
        setRefreshKey(prev => prev + 1);
        
        // Show success message
        const successMessage = isGoingBack 
          ? `Successfully reverted to ${newStatus} step` 
          : `League status updated to: ${newStatus}`;
        setMessage(successMessage);
        
        // Clear message after 3 seconds
        setTimeout(() => {
          setMessage('');
        }, 3000);
        
        // Notify parent if exists
        if (onStatusChange) {
          try {
            onStatusChange();
          } catch (e) {
            console.error('Parent notification failed:', e);
          }
        }
        
        // Fetch fresh status after a delay to confirm backend update
        setTimeout(() => {
          fetchCurrentStatus().catch(err => {
            console.error('Status refresh failed:', err);
          });
        }, 1000);
        
      } else {
        const errorMessage = response?.message || 'Failed to update league status';
        console.error('Update failed:', errorMessage);
        setError(errorMessage);
        
        // Refresh status to ensure we're in sync
        fetchCurrentStatus();
        
        setTimeout(() => setError(''), 5000);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      let errorMessage = 'Failed to update league status';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      // Refresh status to ensure we're in sync
      fetchCurrentStatus();
      
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    const statusSteps = ['setup', 'pricing', 'draft_ready', 'drafting', 'active'];
    const currentIndex = statusSteps.indexOf(currentStatus);
    
    if (currentIndex > 0) {
      const previousStatus = statusSteps[currentIndex - 1];
      updateLeagueStatus(previousStatus, true);
    }
  };

  const setLeagueDraftType = async (type) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await leaguesAPI.setDraftType(leagueId, type);
      
      if (response && response.success) {
        setDraftType(type);
        await updateLeagueStatus('drafting');
      } else {
        setError('Failed to set draft type');
        setTimeout(() => setError(''), 5000);
      }
    } catch (error) {
      console.error('Error setting draft type:', error);
      setError('Failed to set draft type');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const startSeason = async () => {
    if (!window.confirm('Are you sure you want to start the season? This will lock rosters and prices.')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await leaguesAPI.startSeason(leagueId);
      
      if (response && response.success) {
        setCurrentStatus('active');
        setRefreshKey(prev => prev + 1);
        setMessage('Season started successfully!');
        if (onStatusChange) onStatusChange();
        
        setTimeout(() => {
          fetchCurrentStatus();
        }, 500);
      } else {
        setError('Failed to start season');
        setTimeout(() => setError(''), 5000);
      }
    } catch (error) {
      console.error('Error starting season:', error);
      setError('Failed to start season');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      setup: { color: 'bg-gray-500/20 text-gray-400', icon: '⚙️', label: 'Setup' },
      pricing: { color: 'bg-yellow-500/20 text-yellow-400', icon: '💰', label: 'Setting Prices' },
      draft_ready: { color: 'bg-blue-500/20 text-blue-400', icon: '📋', label: 'Ready to Draft' },
      drafting: { color: 'bg-purple-500/20 text-purple-400', icon: '🎯', label: 'Drafting' },
      active: { color: 'bg-green-500/20 text-green-400', icon: '✅', label: 'Active' }
    };
    
    const badge = badges[status] || badges.setup;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  const statusSteps = ['setup', 'pricing', 'draft_ready', 'drafting', 'active'];
  const currentStepIndex = statusSteps.indexOf(currentStatus);
  const progressPercentage = ((currentStepIndex + 1) / statusSteps.length) * 100;
  const canGoBack = currentStepIndex > 0 && currentStatus !== 'active';

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Header */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h1 className={dynastyTheme.components.heading.h1}>
            <Gavel className="inline w-8 h-8 mr-2" />
            Season Setup
          </h1>
          <p className={dynastyTheme.classes.text.neutralLight}>
            Manage league state and progression
          </p>
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.success}/20 text-green-400`}>
          <Check className="inline w-5 h-5 mr-2" />
          {message}
        </div>
      )}
      
      {error && (
        <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.error}/20 text-red-400`}>
          <AlertCircle className="inline w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* Current Status with Back Button */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className={dynastyTheme.components.heading.h2}>Current League Status</h2>
            {canGoBack && (
              <button
                onClick={handleGoBack}
                disabled={loading}
                className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
                title="Go back to previous step"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Previous Step
              </button>
            )}
          </div>
          <div className="mt-4">
            {getStatusBadge(currentStatus)}
          </div>
          
          {/* Status Timeline */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              {statusSteps.map((status, idx) => (
                <div key={status} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    currentStepIndex >= idx
                      ? dynastyTheme.classes.bg.primary + ' text-black'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="text-xs mt-2 text-center">{status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
            <div className="relative mt-4 -mt-8 pt-8">
              <div className="absolute top-0 left-5 right-5 h-1 bg-gray-700"></div>
              <div 
                className={`absolute top-0 left-5 h-1 ${dynastyTheme.classes.bg.primary} transition-all duration-500`}
                style={{ width: `calc(${progressPercentage}% - 2.5rem)` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Based on Status */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h2 className={dynastyTheme.components.heading.h2}>League Actions</h2>
          
          {currentStatus === 'setup' && (
            <div className="mt-4 space-y-4">
              <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
                <h3 className="font-semibold mb-2">Next Step: Set Player Prices</h3>
                <p className="text-sm text-gray-400 mb-4">
                  You need to generate or upload player prices before teams can make transactions.
                </p>
                <button
                  onClick={() => updateLeagueStatus('pricing')}
                  disabled={loading}
                  className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
                >
                  {loading ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    'Move to Pricing Phase'
                  )}
                </button>
              </div>
            </div>
          )}

          {currentStatus === 'pricing' && (
            <div className="mt-4 space-y-4">
              <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
                <h3 className="font-semibold mb-2">Set Player Prices</h3>
                <p className="text-sm text-gray-400 mb-4">
                  {pricesSet 
                    ? '✅ Prices have been set. You can review/adjust them or proceed to draft.' 
                    : '⚠️ You must set player prices before proceeding.'}
                </p>
                <button
                  onClick={() => navigate(`/leagues/${leagueId}/salary-contract-settings`)}
                  className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} mb-4 block`}
                >
                  <DollarSign className="w-4 h-4 mr-2 inline" />
                  {pricesSet ? 'Review/Adjust Prices' : 'Set Player Prices'}
                </button>
                <button
                  onClick={() => updateLeagueStatus('draft_ready')}
                  disabled={loading || !pricesSet}
                  className={dynastyTheme.utils.getComponent('button', pricesSet ? 'primary' : 'secondary', 'md')}
                >
                  {loading ? 'Updating...' : pricesSet ? 'Proceed to Draft Setup' : 'Prices Required First'}
                </button>
              </div>
            </div>
          )}

          {currentStatus === 'draft_ready' && (
            <div className="mt-4 space-y-4">
              <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
                <h3 className="font-semibold mb-2">Select Draft Type</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Choose how teams will build their rosters.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setLeagueDraftType('offline')}
                    disabled={loading}
                    className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
                  >
                    <Users className="w-4 h-4 mr-2 inline" />
                    {loading ? 'Setting...' : 'Offline Draft'}
                  </button>
                  <button
                    disabled
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} opacity-50`}
                  >
                    <Calendar className="w-4 h-4 mr-2 inline" />
                    Live Draft (Coming Soon)
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Offline: Teams add players manually within cap constraints
                </p>
              </div>
            </div>
          )}

          {currentStatus === 'drafting' && (
            <div className="mt-4 space-y-4">
              <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
                <h3 className="font-semibold mb-2">Draft Mode: {draftType === 'offline' ? 'Offline' : 'Live'}</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Teams are currently building their rosters. Once all teams are ready, start the season.
                </p>
                <button
                  onClick={startSeason}
                  disabled={loading}
                  className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
                >
                  <Lock className="w-4 h-4 mr-2 inline" />
                  {loading ? 'Starting...' : 'Start Season (Lock Rosters)'}
                </button>
                <p className="text-xs text-red-400 mt-2">
                  ⚠️ This action cannot be undone. Prices will be locked except for manual adjustments.
                </p>
              </div>
            </div>
          )}

          {currentStatus === 'active' && (
            <div className="mt-4 space-y-4">
              <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.success}/20`}>
                <h3 className="font-semibold mb-2 text-green-400">✅ Season Active</h3>
                <p className="text-sm text-gray-400">
                  The season is active. Teams can make transactions within cap constraints.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h2 className={dynastyTheme.components.heading.h2}>Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 mt-4">
            <button
              onClick={() => navigate(`/leagues/${leagueId}/salary-contract-settings`)}
              className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
            >
              <DollarSign className="w-4 h-4 mr-2 inline" />
              Manage Prices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommissionerControls;