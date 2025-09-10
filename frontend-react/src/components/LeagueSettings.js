// src/components/LeagueSettings.js - FIXED WITH PRESIGNED URL UPLOAD AND INVITE CODE DISPLAY
import React, { useState, useEffect } from 'react';
import { 
  Crown, Settings, Trash2, AlertTriangle, Shield, Users, 
  Check, X, Eye, EyeOff, Lock, Unlock, Upload, Save, 
  AlertCircle, Trophy, DollarSign, Camera, Calendar,
  Globe, Copy, Share2
} from 'lucide-react';
import { leaguesAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';

const LeagueSettings = ({ leagueId, user, onLeagueDeleted }) => {
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [copiedInviteCode, setCopiedInviteCode] = useState(false);
  
  // New banner upload states
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerPreview, setBannerPreview] = useState(null);
  
  // League settings state
  const [settings, setSettings] = useState({
    league_name: '',
    league_id: '',
    max_teams: 12,
    scoring_system: '',
    player_pool: '',
    league_status: '',
    created_date: '',
    league_banner_url: '',
    is_public: true,
    invite_code: '',
    
    // Scoring categories (from DB)
    scoring_categories: {
      hitting: ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
      pitching: ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
    },
    
    // Financial settings
    use_salaries: false,
    salary_cap: 260,
    min_salary: 1,
    
    // Position requirements
    position_requirements: {},
    bench_slots: 5,
    dl_slots: 0,
    minor_league_slots: 0
  });
  
  const [isCommissioner, setIsCommissioner] = useState(false);
  
  // League deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [finalConfirmation, setFinalConfirmation] = useState(false);

  useEffect(() => {
    loadLeagueDetails();
    loadLeagueSettings();
  }, [leagueId]);

  const loadLeagueDetails = async () => {
    try {
      setLoading(true);
      const response = await leaguesAPI.getLeagueDetails(leagueId);
      if (response.success) {
        setLeague(response.league);
        setIsCommissioner(response.league.role === 'commissioner' || response.league.is_commissioner);
        
        // Set basic settings from league object
        setSettings(prev => ({
          ...prev,
          league_name: response.league.league_name || '',
          league_id: leagueId,
          max_teams: response.league.max_teams || 12,
          scoring_system: response.league.scoring_system || 'rotisserie_ytd',
          player_pool: response.league.player_pool || 'american_national',
          league_status: response.league.league_status || 'setup',
          created_date: response.league.created_at ? new Date(response.league.created_at).toLocaleDateString() : '',
          use_salaries: response.league.use_salaries || response.league.salary_cap_enabled || false,
          salary_cap: response.league.salary_cap || 260,
          min_salary: response.league.min_salary || 1,
          is_public: response.league.is_public !== undefined ? response.league.is_public : true,
          invite_code: response.league.invite_code || ''
        }));
        
        // Load banner if exists
        if (response.league.league_banner_url) {
          setBannerPreview(response.league.league_banner_url);
          setSettings(prev => ({ ...prev, league_banner_url: response.league.league_banner_url }));
        }
      }
    } catch (error) {
      console.error('Error loading league details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeagueSettings = async () => {
    try {
      // Get detailed settings from league_settings table
      const settingsResponse = await leaguesAPI.getLeagueSettings(leagueId);
      if (settingsResponse.success && settingsResponse.settings) {
        const dbSettings = settingsResponse.settings;
        
        // Parse scoring categories
        if (dbSettings.scoring_categories) {
          const categories = typeof dbSettings.scoring_categories === 'string' 
            ? JSON.parse(dbSettings.scoring_categories) 
            : dbSettings.scoring_categories;
            
          setSettings(prev => ({
            ...prev,
            scoring_categories: {
              hitting: categories.hitters || categories.hitting || prev.scoring_categories.hitting,
              pitching: categories.pitchers || categories.pitching || prev.scoring_categories.pitching
            }
          }));
        }
        
        // Parse position requirements
        if (dbSettings.position_requirements) {
          const positions = typeof dbSettings.position_requirements === 'string'
            ? JSON.parse(dbSettings.position_requirements)
            : dbSettings.position_requirements;
          
          setSettings(prev => ({
            ...prev,
            position_requirements: positions,
            bench_slots: parseInt(dbSettings.bench_slots) || 5,
            dl_slots: parseInt(dbSettings.dl_slots) || 0,
            minor_league_slots: parseInt(dbSettings.minor_league_slots) || 0
          }));
        }
        
        // Update other settings including privacy
        setSettings(prev => ({
          ...prev,
          max_teams: parseInt(dbSettings.max_teams) || prev.max_teams,
          league_banner_url: dbSettings.league_banner_url || prev.league_banner_url,
          is_public: dbSettings.is_public !== undefined ? dbSettings.is_public : prev.is_public,
          invite_code: dbSettings.invite_code || prev.invite_code
        }));
        
        if (dbSettings.league_banner_url) {
          setBannerPreview(dbSettings.league_banner_url);
        }
      }
    } catch (error) {
      console.log('Could not fetch league settings:', error);
    }
  };

  const copyInviteCode = () => {
    if (settings.invite_code) {
      navigator.clipboard.writeText(settings.invite_code);
      setCopiedInviteCode(true);
      setMessage({ text: 'Invite code copied to clipboard!', type: 'success' });
      setTimeout(() => {
        setCopiedInviteCode(false);
        setMessage({ text: '', type: '' });
      }, 3000);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check permissions
    if (!isCommissioner) {
      setMessage({ text: 'Only commissioners can upload league banners', type: 'error' });
      return;
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Please select an image file', type: 'error' });
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit for panoramic banners
      setMessage({ text: 'Image must be less than 50MB', type: 'error' });
      return;
    }

    try {
      setUploadingBanner(true);
      setMessage({ text: 'Uploading league banner...', type: 'info' });

      // Use the new uploadLeagueBanner function from apiService
      const result = await leaguesAPI.uploadLeagueBanner(leagueId, file);
      
      if (result.success) {
        const bannerUrl = result.banner_url;
        
        // Update preview and settings
        setBannerPreview(bannerUrl);
        setSettings(prev => ({
          ...prev,
          league_banner_url: bannerUrl
        }));

        // Save to database
        await saveLeagueBanner(bannerUrl);
        
        setMessage({ text: 'League banner uploaded successfully!', type: 'success' });
      } else {
        throw new Error('Upload failed');
      }

    } catch (error) {
      console.error('Banner upload error:', error);
      setMessage({ text: error.message || 'Failed to upload banner', type: 'error' });
    } finally {
      setUploadingBanner(false);
    }
  };

  const saveLeagueBanner = async (bannerUrl) => {
    try {
      await leaguesAPI.updateLeagueSettings(leagueId, {
        league_banner_url: bannerUrl
      });
    } catch (error) {
      console.error('Failed to save banner URL:', error);
    }
  };

  const handleMaxTeamsChange = (value) => {
    // Check permissions
    if (!isCommissioner) {
      setMessage({ text: 'Only commissioners can change settings', type: 'error' });
      return;
    }

    // Only allow changes if not in draft or active status
    if (['drafting', 'active'].includes(settings.league_status)) {
      setMessage({ text: 'Cannot change max teams after draft has started', type: 'error' });
      return;
    }
    
    const newValue = parseInt(value);
    if (newValue < 4 || newValue > 20) {
      setMessage({ text: 'Max teams must be between 4 and 20', type: 'error' });
      return;
    }
    
    setSettings(prev => ({ ...prev, max_teams: newValue }));
  };

  const saveSettings = async () => {
    if (!isCommissioner) {
      setMessage({ text: 'Only commissioners can save settings', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      
      const updateData = {
        max_teams: settings.max_teams,
        league_name: settings.league_name,
        league_banner_url: settings.league_banner_url
      };

      const response = await leaguesAPI.updateLeagueSettings(leagueId, updateData);
      
      if (response.success) {
        setMessage({ text: 'Settings saved successfully!', type: 'success' });
        // Update the league object
        if (league) {
          setLeague({ ...league, max_teams: settings.max_teams });
        }
      } else {
        throw new Error(response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Save settings error:', error);
      setMessage({ text: 'Failed to save settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!isCommissioner) {
      setMessage({ text: 'Only commissioners can delete leagues', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      
      const response = await leaguesAPI.deleteLeague(leagueId);
      
      if (response.success) {
        if (onLeagueDeleted) {
          onLeagueDeleted(league.league_name);
        }
      } else {
        throw new Error(response.message || 'Failed to delete league');
      }
      
    } catch (error) {
      console.error('Error deleting league:', error);
      alert('Failed to delete league. Please try again.');
    } finally {
      setSaving(false);
      setShowDeleteModal(false);
      setDeleteStep(1);
      setDeleteConfirmText('');
      setFinalConfirmation(false);
    }
  };

  const renderDeleteModal = () => {
    if (!showDeleteModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`${dynastyTheme.components.card.base} p-6 w-full max-w-md mx-4`}>
          {deleteStep === 1 && (
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className={`w-8 h-8 ${dynastyTheme.classes.text.warning}`} />
                <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Delete League</h3>
              </div>
              
              <div className="space-y-4">
                <p className={dynastyTheme.classes.text.white}>
                  Are you sure you want to delete <strong>"{league?.league_name}"</strong>?
                </p>
                
                <div className={`p-4 rounded-lg bg-red-500/10 border border-red-500/20`}>
                  <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                    This action is <strong className={dynastyTheme.classes.text.white}>permanent and irreversible</strong>. 
                    All league data, team rosters, transaction history, and settings will be permanently deleted.
                  </p>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex-1`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    className={`${dynastyTheme.classes.bg.error} ${dynastyTheme.classes.text.white} flex-1 px-4 py-2 rounded-lg font-semibold ${dynastyTheme.classes.transition}`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {deleteStep === 2 && (
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Trash2 className={`w-8 h-8 ${dynastyTheme.classes.text.error}`} />
                <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Confirm Deletion</h3>
              </div>
              
              <div className="space-y-4">
                <p className={dynastyTheme.classes.text.white}>
                  Type the league name <strong>"{league?.league_name}"</strong> to confirm deletion:
                </p>
                
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className={`${dynastyTheme.components.input} w-full`}
                  placeholder="Enter league name"
                  autoFocus
                />
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setDeleteStep(1)}
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex-1`}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setDeleteStep(3)}
                    disabled={deleteConfirmText !== league?.league_name}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold ${dynastyTheme.classes.transition} disabled:opacity-50 ${dynastyTheme.classes.text.white}`}
                    style={{ 
                      backgroundColor: deleteConfirmText === league?.league_name 
                        ? dynastyTheme.tokens.colors.error 
                        : dynastyTheme.tokens.colors.neutral[600]
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {deleteStep === 3 && (
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className={`w-8 h-8 ${dynastyTheme.classes.text.error}`} />
                <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Final Confirmation</h3>
              </div>
              
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border-2 bg-red-500/10 border-red-500`}>
                  <p className={`${dynastyTheme.classes.text.white} font-semibold mb-2`}>This will permanently delete:</p>
                  <ul className={`text-sm space-y-1 ${dynastyTheme.classes.text.neutralLight}`}>
                    <li>• League configuration and settings</li>
                    <li>• All team rosters and player assignments</li>
                    <li>• Complete transaction history</li>
                    <li>• League standings and statistics</li>
                    <li>• All league-specific data</li>
                  </ul>
                </div>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={finalConfirmation}
                    onChange={(e) => setFinalConfirmation(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className={`${dynastyTheme.classes.text.white} text-sm`}>
                    I understand this action cannot be undone
                  </span>
                </label>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setDeleteStep(2)}
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex-1`}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleDeleteLeague}
                    disabled={!finalConfirmation || saving}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold ${dynastyTheme.classes.transition} disabled:opacity-50 flex items-center justify-center space-x-2 ${dynastyTheme.classes.text.white}`}
                    style={{ 
                      backgroundColor: finalConfirmation 
                        ? dynastyTheme.tokens.colors.error 
                        : dynastyTheme.tokens.colors.neutral[600]
                    }}
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Delete League Forever</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 border-2 border-t-transparent animate-spin rounded-full ${dynastyTheme.classes.border.primary}`} />
          <span className={`${dynastyTheme.classes.text.white} text-lg`}>Loading league settings...</span>
        </div>
      </div>
    );
  }

  // Non-commissioners get read-only view
  if (!isCommissioner) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className={`${dynastyTheme.components.card.base} p-6`}>
          <div className="flex items-center space-x-3 mb-2">
            <Lock className={`w-8 h-8 ${dynastyTheme.classes.text.neutral}`} />
            <h1 className={dynastyTheme.components.heading.h1}>League Settings</h1>
          </div>
          <p className={dynastyTheme.classes.text.error}>
            View Only - Commissioner access required to edit settings
          </p>
        </div>

        {/* Private League Invite Code Display (visible to all members) */}
        {!settings.is_public && settings.invite_code && (
          <div className={`${dynastyTheme.components.card.base} p-6`}>
            <div className="flex items-center space-x-3 mb-4">
              <Lock className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
              <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Private League</h3>
            </div>
            
            <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter} border ${dynastyTheme.classes.border.primary}`}>
              <p className={`text-sm ${dynastyTheme.classes.text.neutralLight} mb-3`}>
                Share this invite code with players you want to join:
              </p>
              <div className="flex items-center gap-3">
                <code className={`text-2xl font-bold ${dynastyTheme.classes.text.primary} tracking-wider`}>
                  {settings.invite_code}
                </code>
                <button
                  onClick={copyInviteCode}
                  className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} flex items-center gap-2`}
                >
                  {copiedInviteCode ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Show read-only settings */}
        <div className={`${dynastyTheme.components.card.base} p-6`}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={dynastyTheme.components.label}>League Name</label>
                <div className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralLight}`}>
                  {settings.league_name || 'N/A'}
                </div>
              </div>
              <div>
                <label className={dynastyTheme.components.label}>League ID</label>
                <div className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralLight}`}>
                  {settings.league_id || 'N/A'}
                </div>
              </div>
              <div>
                <label className={dynastyTheme.components.label}>Maximum Teams</label>
                <div className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralLight}`}>
                  {settings.max_teams}
                </div>
              </div>
              <div>
                <label className={dynastyTheme.components.label}>League Status</label>
                <div className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralLight}`}>
                  {settings.league_status?.replace(/_/g, ' ') || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Commissioner view - full edit access
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-center space-x-3 mb-2">
          <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
          <h1 className={dynastyTheme.components.heading.h1}>League Settings</h1>
        </div>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Manage your league configuration and settings.
        </p>
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`p-4 rounded-lg border flex items-center gap-2 ${
          message.type === 'error' 
            ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : message.type === 'info'
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        }`}>
          <AlertCircle className="w-5 h-5" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Privacy Settings & Invite Code */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          {settings.is_public ? (
            <>
              <Globe className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
              <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Public League</h3>
            </>
          ) : (
            <>
              <Lock className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
              <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Private League</h3>
            </>
          )}
        </div>
        
        {settings.is_public ? (
          <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
            <p className={`text-sm ${dynastyTheme.classes.text.white} mb-2`}>
              This league is visible in public league discovery
            </p>
            <p className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
              Anyone can find and join this league through the browse leagues feature.
            </p>
          </div>
        ) : (
          <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter} border ${dynastyTheme.classes.border.primary}`}>
            <p className={`text-sm ${dynastyTheme.classes.text.white} mb-3`}>
              Share this invite code with players you want to join:
            </p>
            <div className="flex items-center gap-3">
              <code className={`text-2xl font-bold ${dynastyTheme.classes.text.primary} tracking-wider`}>
                {settings.invite_code || 'GENERATING...'}
              </code>
              {settings.invite_code && (
                <button
                  onClick={copyInviteCode}
                  className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} flex items-center gap-2`}
                >
                  {copiedInviteCode ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
            <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-3`}>
              Only people with this code can join your league.
            </p>
          </div>
        )}
      </div>

      {/* League Banner Upload */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          <Camera className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>League Banner</h3>
        </div>
        
        {/* Banner Preview */}
        {bannerPreview && (
          <div className="mb-4 relative">
            <img 
              src={bannerPreview} 
              alt="League Banner"
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              onClick={() => {
                setBannerPreview(null);
                setSettings(prev => ({ ...prev, league_banner_url: '' }));
              }}
              className={`absolute top-2 right-2 p-2 rounded-full ${dynastyTheme.classes.bg.error} ${dynastyTheme.classes.text.white}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-4">
          <label className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} ${
            uploadingBanner ? 'opacity-50 cursor-not-allowed' : ''
          }`}>
            <input
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              className="hidden"
              disabled={uploadingBanner}
            />
            <Upload className="inline w-4 h-4 mr-2" />
            {uploadingBanner ? 'Uploading...' : 'Upload Banner'}
          </label>
        </div>
        <p className={`mt-2 text-xs ${dynastyTheme.classes.text.neutralLight}`}>
          Recommended: 1920x400px panoramic, max 50MB. This banner will appear on your League Home page.
        </p>
      </div>

      {/* League Information */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          <Settings className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>League Information</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={dynastyTheme.components.label}>
              League Name
            </label>
            <input
              type="text"
              value={settings.league_name || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, league_name: e.target.value }))}
              className={`${dynastyTheme.components.input} w-full`}
            />
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              League ID
            </label>
            <input
              type="text"
              value={settings.league_id || ''}
              className={`${dynastyTheme.components.input} w-full opacity-50`}
              readOnly
            />
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              Scoring System
            </label>
            <input
              type="text"
              value={settings.scoring_system?.replace(/_/g, ' ') || ''}
              className={`${dynastyTheme.components.input} w-full opacity-50`}
              readOnly
            />
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              Player Pool
            </label>
            <input
              type="text"
              value={settings.player_pool?.replace(/_/g, ' ') || ''}
              className={`${dynastyTheme.components.input} w-full opacity-50`}
              readOnly
            />
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              Maximum Teams
              {['drafting', 'active'].includes(settings.league_status) && (
                <span className="ml-2 text-xs text-amber-400">(Locked)</span>
              )}
            </label>
            <input
              type="number"
              value={settings.max_teams || ''}
              onChange={(e) => handleMaxTeamsChange(e.target.value)}
              className={`${dynastyTheme.components.input} w-full`}
              min="4"
              max="20"
              disabled={['drafting', 'active'].includes(settings.league_status)}
            />
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              Created Date
            </label>
            <input
              type="text"
              value={settings.created_date || ''}
              className={`${dynastyTheme.components.input} w-full opacity-50`}
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Scoring Categories Display */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          <Trophy className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
          <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Scoring Categories</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className={`font-semibold mb-2 ${dynastyTheme.classes.text.white}`}>
              Hitting Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              {settings.scoring_categories.hitting.map(cat => (
                <span key={cat} className={dynastyTheme.components.badge.neutral}>
                  {cat}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className={`font-semibold mb-2 ${dynastyTheme.classes.text.white}`}>
              Pitching Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              {settings.scoring_categories.pitching.map(cat => (
                <span key={cat} className={dynastyTheme.components.badge.neutral}>
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
        >
          <Save className="inline w-5 h-5 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className={`${dynastyTheme.components.card.base} p-6 border-2 border-red-500/40`}>
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className={`w-6 h-6 ${dynastyTheme.classes.text.error}`} />
          <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Danger Zone</h3>
        </div>
        
        <div className={`p-4 rounded-lg mb-4 bg-red-500/10 border border-red-500/20`}>
          <h4 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-2`}>Delete League</h4>
          <p className={`text-sm mb-4 ${dynastyTheme.classes.text.neutralLight}`}>
            Permanently delete this league and all associated data. This action cannot be undone.
          </p>
          
          <button
            onClick={() => setShowDeleteModal(true)}
            className={dynastyTheme.utils.getComponent('button', 'danger', 'sm')}
          >
            <Trash2 className="inline w-4 h-4 mr-2" />
            Delete League
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      {renderDeleteModal()}
    </div>
  );
};

export default LeagueSettings;