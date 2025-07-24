import React, { useState, useEffect } from 'react';
import { 
  Crown, Settings, Trash2, AlertTriangle, Shield, Users, 
  Check, X, Eye, EyeOff, Lock, Unlock
} from 'lucide-react';
import { leaguesAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';

const LeagueSettings = ({ leagueId, user, onLeagueDeleted }) => {
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // League deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [finalConfirmation, setFinalConfirmation] = useState(false);
  
  // Admin permissions state
  const [adminUsers, setAdminUsers] = useState([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  useEffect(() => {
    loadLeagueDetails();
    loadAdminUsers();
  }, [leagueId]);

  const loadLeagueDetails = async () => {
    try {
      setLoading(true);
      const response = await leaguesAPI.getLeagueDetails(leagueId);
      if (response.success) {
        setLeague(response.league);
      }
    } catch (error) {
      console.error('Error loading league details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    try {
      // TODO: Replace with actual API call to get league admins
      const mockAdmins = [
        {
          user_id: user?.sub,
          email: user?.email,
          name: user?.given_name || user?.firstName,
          role: 'commissioner',
          granted_at: '2025-01-15T10:30:00Z'
        }
      ];
      setAdminUsers(mockAdmins);
    } catch (error) {
      console.error('Error loading admin users:', error);
    }
  };

  const handleDeleteLeague = async () => {
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

  const handleAddAdmin = async () => {
    try {
      setSaving(true);
      console.log('Adding admin:', newAdminEmail);
      
      const newAdmin = {
        user_id: 'new-user-id',
        email: newAdminEmail,
        name: newAdminEmail.split('@')[0],
        role: 'admin',
        granted_at: new Date().toISOString()
      };
      
      setAdminUsers([...adminUsers, newAdmin]);
      setNewAdminEmail('');
      setShowAddAdmin(false);
    } catch (error) {
      console.error('Error adding admin:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAdmin = async (userId) => {
    try {
      setSaving(true);
      console.log('Removing admin:', userId);
      setAdminUsers(adminUsers.filter(admin => admin.user_id !== userId));
    } catch (error) {
      console.error('Error removing admin:', error);
    } finally {
      setSaving(false);
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
                
                <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.error}/10 border border-red-500/20`}>
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
                <div className={`p-4 rounded-lg border-2 ${dynastyTheme.classes.bg.error}/10 border-red-500`}>
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

  const renderGeneralSettings = () => (
    <div className="space-y-6">
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
              value={league?.league_name || ''}
              className={`${dynastyTheme.components.input} w-full`}
              readOnly
            />
            <p className={`text-xs mt-1 ${dynastyTheme.classes.text.neutralLight}`}>
              Contact support to change league name
            </p>
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              League ID
            </label>
            <input
              type="text"
              value={league?.league_id || ''}
              className={`${dynastyTheme.components.input} w-full`}
              readOnly
            />
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              Scoring System
            </label>
            <input
              type="text"
              value={league?.scoring_system?.replace(/_/g, ' ') || ''}
              className={`${dynastyTheme.components.input} w-full`}
              readOnly
            />
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              Player Pool
            </label>
            <input
              type="text"
              value={league?.player_pool?.replace(/_/g, ' ') || ''}
              className={`${dynastyTheme.components.input} w-full`}
              readOnly
            />
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              Maximum Teams
            </label>
            <input
              type="number"
              value={league?.max_teams || ''}
              className={`${dynastyTheme.components.input} w-full`}
              readOnly
            />
          </div>
          
          <div>
            <label className={dynastyTheme.components.label}>
              Created Date
            </label>
            <input
              type="text"
              value={league?.created_at ? new Date(league.created_at).toLocaleDateString() : ''}
              className={`${dynastyTheme.components.input} w-full`}
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className={`${dynastyTheme.components.card.base} p-6 border-2 border-red-500/40`}>
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className={`w-6 h-6 ${dynastyTheme.classes.text.error}`} />
          <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>Danger Zone</h3>
        </div>
        
        <div className={`p-4 rounded-lg mb-4 ${dynastyTheme.classes.bg.error}/10 border border-red-500/20`}>
          <h4 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-2`}>Delete League</h4>
          <p className={`text-sm mb-4 ${dynastyTheme.classes.text.neutralLight}`}>
            Permanently delete this league and all associated data. This action cannot be undone.
          </p>
          
          <button
            onClick={() => setShowDeleteModal(true)}
            className={`${dynastyTheme.classes.bg.error} ${dynastyTheme.classes.text.white} px-4 py-2 rounded-lg font-semibold ${dynastyTheme.classes.transition} flex items-center space-x-2`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete League</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdminSettings = () => (
    <div className="space-y-6">
      {/* Admin Users */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Shield className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
            <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white}`}>League Administrators</h3>
          </div>
          
          <button
            onClick={() => setShowAddAdmin(true)}
            className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
          >
            Add Admin
          </button>
        </div>
        
        <p className={`mb-6 ${dynastyTheme.classes.text.neutralLight}`}>
          Administrators can manage league settings, delete the league, and perform other administrative actions.
        </p>
        
        {/* Add Admin Form */}
        {showAddAdmin && (
          <div className={`p-4 rounded-lg mb-6 ${dynastyTheme.classes.bg.darkLighter}`}>
            <h4 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-3`}>Add New Administrator</h4>
            <div className="flex space-x-3">
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Enter email address"
                className={`${dynastyTheme.components.input} flex-1`}
              />
              <button
                onClick={handleAddAdmin}
                disabled={!newAdminEmail || saving}
                className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setShowAddAdmin(false);
                  setNewAdminEmail('');
                }}
                className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {/* Admin List */}
        <div className="space-y-3">
          {adminUsers.map((admin) => (
            <div 
              key={admin.user_id}
              className={`flex items-center justify-between p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dynastyTheme.classes.bg.primary}`}>
                  <Users className={`w-5 h-5 ${dynastyTheme.classes.text.black}`} />
                </div>
                
                <div>
                  <div className={`${dynastyTheme.classes.text.white} font-semibold`}>
                    {admin.name}
                    {admin.role === 'commissioner' && (
                      <Crown className={`w-4 h-4 inline ml-2 ${dynastyTheme.classes.text.primary}`} />
                    )}
                  </div>
                  <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>{admin.email}</div>
                  <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                    {admin.role === 'commissioner' ? 'League Commissioner' : 'Administrator'} • 
                    Added {new Date(admin.granted_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              {admin.role !== 'commissioner' && (
                <button
                  onClick={() => handleRemoveAdmin(admin.user_id)}
                  className={`p-2 rounded-lg ${dynastyTheme.classes.transition} ${dynastyTheme.classes.bg.error}/20 ${dynastyTheme.classes.text.error}`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <div 
            className="w-8 h-8 border-2 border-t-transparent animate-spin rounded-full"
            style={{ 
              borderColor: dynastyTheme.tokens.colors.primary, 
              borderTopColor: 'transparent' 
            }}
          />
          <span className={`${dynastyTheme.classes.text.white} text-lg`}>Loading league settings...</span>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General Settings', icon: Settings },
    { id: 'admins', label: 'Administrators', icon: Shield }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-center space-x-3 mb-2">
          <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
          <h1 className={dynastyTheme.components.heading.h1}>League Settings</h1>
        </div>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Manage your league configuration, administrators, and advanced settings.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold ${dynastyTheme.classes.transition} ${
                isActive 
                  ? `${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black}` 
                  : `${dynastyTheme.classes.text.white} hover:bg-black/20`
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && renderGeneralSettings()}
      {activeTab === 'admins' && renderAdminSettings()}

      {/* Delete Modal */}
      {renderDeleteModal()}
    </div>
  );
};

export default LeagueSettings;