// src/pages/league-dashboard/LeagueOwners.js - COMPLETE WITH MULTI-COMMISSIONER
import React, { useState } from 'react';
import { Users, Crown, Send, Edit, Trash2 } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';

const LeagueOwners = ({ league, leagueId, user, owners, ownersLoading, loadLeagueData }) => {
  
  // ========================================
  // LOCAL STATE - Owner management specific
  // ========================================
  const [inviteForm, setInviteForm] = useState({
    ownerName: '',
    ownerEmail: '',
    personalMessage: '',
    targetSlot: null
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editForm, setEditForm] = useState({
    teamName: '',
    ownerName: '',
    ownerEmail: ''
  });

  // ========================================
  // CALCULATED VALUES
  // ========================================
  const maxTeams = league?.max_teams || 12;
  const activeTeamsCount = owners.filter(owner => owner.status === 'Active').length;
  const pendingInvitesCount = owners.filter(owner => owner.status === 'Pending').length;
  const openSlots = owners.filter(owner => owner.status === 'Open').length;

  // ========================================
  // EVENT HANDLERS
  // ========================================
  const handleInviteForSlot = (slotNumber) => {
    setInviteForm({
      ownerName: '',
      ownerEmail: '',
      personalMessage: `You're invited to join "${league?.league_name}" as the owner of Team ${slotNumber}!`,
      targetSlot: slotNumber
    });
    
    // Scroll to invitation form
    const inviteSection = document.getElementById('invite-form-section');
    if (inviteSection) {
      inviteSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    
    if (!inviteForm.ownerName.trim() || !inviteForm.ownerEmail.trim()) {
      setInviteStatus({
        type: 'error',
        message: 'Please fill in both owner name and email address.'
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteForm.ownerEmail)) {
      setInviteStatus({
        type: 'error', 
        message: 'Please enter a valid email address.'
      });
      return;
    }

    // Check if email is already invited or belongs to existing team
    const existingOwner = owners.find(owner => 
      owner.owner_email === inviteForm.ownerEmail.trim() && 
      (owner.status === 'Active' || owner.status === 'Pending')
    );
    if (existingOwner) {
      setInviteStatus({
        type: 'error',
        message: 'This email address is already associated with this league.'
      });
      return;
    }

    try {
      setInviteLoading(true);
      setInviteStatus(null);

      const response = await leaguesAPI.inviteOwner(leagueId, {
        ownerName: inviteForm.ownerName.trim(),
        ownerEmail: inviteForm.ownerEmail.trim(),
        personalMessage: inviteForm.personalMessage.trim(),
        leagueName: league?.league_name,
        commissionerName: user?.given_name || user?.firstName || 'League Commissioner',
        targetSlot: inviteForm.targetSlot
      });

      if (response.success) {
        setInviteStatus({
          type: 'success',
          message: `Invitation sent successfully to ${inviteForm.ownerName} (${inviteForm.ownerEmail})`
        });
        
        // Clear form and reload owner data
        setInviteForm({
          ownerName: '',
          ownerEmail: '',
          personalMessage: '',
          targetSlot: null
        });
        
        // Reload owner data to show the new pending invitation
        loadLeagueData();
        
      } else {
        throw new Error(response.message || 'Failed to send invitation');
      }

    } catch (error) {
      console.error('Error sending invitation:', error);
      setInviteStatus({
        type: 'error',
        message: error.message || 'Failed to send invitation. Please try again.'
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    try {
      const response = await leaguesAPI.cancelInvitation(leagueId, invitationId);
      
      if (response.success) {
        setInviteStatus({
          type: 'success',
          message: 'Invitation cancelled successfully.'
        });
        
        // Reload owner data to reflect the cancellation
        loadLeagueData();
      } else {
        throw new Error(response.message || 'Failed to cancel invitation');
      }
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      setInviteStatus({
        type: 'error',
        message: 'Failed to cancel invitation. Please try again.'
      });
    }
  };

  const handleToggleCommissioner = async (teamId, currentStatus) => {
    const action = currentStatus ? 'remove' : 'grant';
    if (!window.confirm(`Are you sure you want to ${action} commissioner rights?`)) {
      return;
    }
    
    try {
      const response = await leaguesAPI.toggleCommissionerStatus(leagueId, teamId, !currentStatus);
      
      if (response.success) {
        setInviteStatus({
          type: 'success',
          message: `Commissioner rights ${currentStatus ? 'removed' : 'granted'} successfully.`
        });
        loadLeagueData();
      } else {
        throw new Error(response.message || 'Failed to update commissioner status');
      }
    } catch (error) {
      console.error('Error updating commissioner status:', error);
      setInviteStatus({
        type: 'error',
        message: 'Failed to update commissioner rights.'
      });
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }
    
    try {
      // TODO: Call API to delete team
      // await leaguesAPI.deleteTeam(leagueId, teamId);
      
      setInviteStatus({
        type: 'success',
        message: 'Team deletion not yet implemented.'
      });
    } catch (error) {
      console.error('Error deleting team:', error);
      setInviteStatus({
        type: 'error',
        message: 'Failed to delete team. Please try again.'
      });
    }
  };

  const handleEditTeam = (owner) => {
    setEditingTeam(owner.team_id);
    setEditForm({
      teamName: owner.team_name,
      ownerName: owner.owner_name || '',
      ownerEmail: owner.owner_email || ''
    });
  };

  const handleSaveTeamEdit = async (teamId) => {
    try {
      // TODO: Call API to update team
      // await leaguesAPI.updateTeam(leagueId, teamId, editForm);
      
      setEditingTeam(null);
      setInviteStatus({
        type: 'success',
        message: 'Team editing not yet implemented.'
      });
    } catch (error) {
      console.error('Error updating team:', error);
      setInviteStatus({
        type: 'error',
        message: 'Failed to update team. Please try again.'
      });
    }
  };

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          <Users className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
          <div>
            <h2 className={dynastyTheme.components.heading.h2}>
              League Owners
            </h2>
            <p className={dynastyTheme.classes.text.neutralLight}>
              Manage team ownership and send invitations to new owners
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
            <div className={`text-2xl font-bold ${dynastyTheme.classes.text.success}`}>{activeTeamsCount}</div>
            <div className={dynastyTheme.classes.text.neutralLight}>Active Teams</div>
          </div>
          <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
            <div className={`text-2xl font-bold ${dynastyTheme.classes.text.warning}`}>{pendingInvitesCount}</div>
            <div className={dynastyTheme.classes.text.neutralLight}>Pending Invitations</div>
          </div>
          <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
            <div className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>{openSlots}</div>
            <div className={dynastyTheme.classes.text.neutralLight}>Open Slots</div>
          </div>
          <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
            <div className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>{maxTeams}</div>
            <div className={dynastyTheme.classes.text.neutralLight}>Total Slots</div>
          </div>
        </div>
      </div>

      {/* Visual Team Slots */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-4`}>
          Team Slots Overview
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {owners.map((owner) => (
            <div 
              key={owner.slot}
              className={`p-4 rounded-lg border ${dynastyTheme.classes.transition} ${
                owner.status === 'Active' 
                  ? `${dynastyTheme.classes.border.primary} ${dynastyTheme.classes.bg.primaryLight}`
                  : owner.status === 'Pending'
                  ? `border-amber-500 ${dynastyTheme.classes.bg.darkLighter}`
                  : `${dynastyTheme.classes.border.neutral} ${dynastyTheme.classes.bg.darkLighter}`
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${dynastyTheme.classes.text.primary}`}>
                  Slot {owner.slot}
                </span>
                {owner.is_commissioner && (
                  <Crown className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                )}
              </div>
              
              <div className={`font-medium ${dynastyTheme.classes.text.white} mb-1`}>
                {owner.team_name}
              </div>
              
              <div className={`text-sm ${dynastyTheme.classes.text.neutralLight} mb-2`}>
                {owner.owner_name || 'Awaiting Owner'}
              </div>
              
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  owner.status === 'Active' 
                    ? dynastyTheme.components.badge.success
                    : owner.status === 'Pending'
                    ? dynastyTheme.components.badge.warning
                    : `px-2 py-1 rounded text-xs font-semibold ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white}`
                }`}>
                  {owner.status}
                </span>
                
                {owner.status === 'Open' && (
                  <button 
                    onClick={() => handleInviteForSlot(owner.slot)}
                    className={dynastyTheme.utils.getComponent('button', 'primary', 'xs')}
                  >
                    Invite
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invitation Form */}
      <div id="invite-form-section" className={`${dynastyTheme.components.card.base} p-6`}>
        <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-4`}>
          Invite New Owner {inviteForm.targetSlot ? `for Team ${inviteForm.targetSlot}` : ''}
        </h3>
        
        {inviteStatus && (
          <div className={`p-4 rounded-lg mb-6 ${
            inviteStatus.type === 'success' 
              ? dynastyTheme.classes.bg.success 
              : dynastyTheme.classes.bg.error
          }`}>
            <p className={dynastyTheme.classes.text.white}>{inviteStatus.message}</p>
          </div>
        )}

        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={dynastyTheme.components.label}>
                Owner Name *
              </label>
              <input
                type="text"
                value={inviteForm.ownerName}
                onChange={(e) => setInviteForm({...inviteForm, ownerName: e.target.value})}
                placeholder="Enter the new owner's full name"
                className={dynastyTheme.components.input}
                required
              />
            </div>
            
            <div>
              <label className={dynastyTheme.components.label}>
                Email Address *
              </label>
              <input
                type="email"
                value={inviteForm.ownerEmail}
                onChange={(e) => setInviteForm({...inviteForm, ownerEmail: e.target.value})}
                placeholder="owner@example.com"
                className={dynastyTheme.components.input}
                required
              />
            </div>
          </div>

          <div>
            <label className={dynastyTheme.components.label}>
              Personal Message (Optional)
            </label>
            <textarea
              value={inviteForm.personalMessage}
              onChange={(e) => setInviteForm({...inviteForm, personalMessage: e.target.value})}
              placeholder="Add a personal message to include with the invitation..."
              rows={3}
              className={dynastyTheme.components.input}
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              <p>The invitation will include a link to join "{league?.league_name}" and create a team.</p>
            </div>
            
            <div className="flex items-center space-x-3">
              {inviteForm.targetSlot && (
                <button
                  type="button"
                  onClick={() => setInviteForm({...inviteForm, targetSlot: null, personalMessage: ''})}
                  className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}
                >
                  Clear Target Slot
                </button>
              )}
              
              <button
                type="submit"
                disabled={inviteLoading}
                className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} flex items-center space-x-2 ${
                  inviteLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {inviteLoading ? (
                  <>
                    <div className={`w-4 h-4 border-2 ${dynastyTheme.classes.text.black} border-t-transparent rounded-full animate-spin`} />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Invitation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Owner Management Table */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.white} mb-4`}>
          Owner Management ({activeTeamsCount + pendingInvitesCount}/{maxTeams} Slots)
        </h3>
        
        {ownersLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 border-2 border-t-transparent animate-spin rounded-full ${dynastyTheme.classes.border.primary}`} />
              <span className={dynastyTheme.classes.text.white}>Loading owner data...</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${dynastyTheme.classes.border.neutral}`}>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Slot</th>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Owner Name</th>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Owner Email</th>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Team Name</th>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Status</th>
                  {league?.role === 'commissioner' && (
                    <th className={`text-center p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Admin Rights</th>
                  )}
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((owner) => (
                  <tr key={owner.team_id || owner.invitation_id || `empty-${owner.slot}`} className={`border-b hover:${dynastyTheme.classes.bg.primaryLight} ${dynastyTheme.classes.transition} ${dynastyTheme.classes.border.neutral}`}>
                    <td className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>
                      {owner.slot}
                    </td>
                    <td className={`p-3`}>
                      {editingTeam === owner.team_id ? (
                        <input
                          type="text"
                          value={editForm.ownerName}
                          onChange={(e) => setEditForm({...editForm, ownerName: e.target.value})}
                          className={`${dynastyTheme.components.input} text-sm`}
                        />
                      ) : (
                        <span className={owner.owner_name ? dynastyTheme.classes.text.white : `${dynastyTheme.classes.text.neutralLighter} italic`}>
                          {owner.owner_name || 'Awaiting Owner'}
                        </span>
                      )}
                    </td>
                    <td className={`p-3`}>
                      {editingTeam === owner.team_id ? (
                        <input
                          type="email"
                          value={editForm.ownerEmail}
                          onChange={(e) => setEditForm({...editForm, ownerEmail: e.target.value})}
                          className={`${dynastyTheme.components.input} text-sm`}
                        />
                      ) : (
                        <span className={dynastyTheme.classes.text.neutralLight}>
                          {owner.owner_email || 'N/A'}
                        </span>
                      )}
                    </td>
                    <td className={`p-3`}>
                      {editingTeam === owner.team_id ? (
                        <input
                          type="text"
                          value={editForm.teamName}
                          onChange={(e) => setEditForm({...editForm, teamName: e.target.value})}
                          className={`${dynastyTheme.components.input} text-sm`}
                        />
                      ) : (
                        <span className={dynastyTheme.classes.text.white}>
                          {owner.team_name}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={
                        owner.status === 'Active' 
                          ? dynastyTheme.components.badge.success
                          : owner.status === 'Pending'
                          ? dynastyTheme.components.badge.warning
                          : `px-2 py-1 rounded text-xs font-semibold ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white}`
                      }>
                        {owner.status}
                      </span>
                    </td>
                    
                    {league?.role === 'commissioner' && (
                      <td className="p-3 text-center">
                        {owner.status === 'Active' && owner.team_id ? (
                          <input
                            type="checkbox"
                            checked={owner.is_commissioner || false}
                            onChange={() => handleToggleCommissioner(owner.team_id, owner.is_commissioner)}
                            disabled={owner.user_id === user?.sub}
                            className={`w-5 h-5 rounded ${dynastyTheme.classes.text.primary} ${
                              owner.user_id === user?.sub ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                            title={
                              owner.user_id === user?.sub 
                                ? "You cannot remove your own commissioner rights" 
                                : owner.is_commissioner 
                                  ? "Remove commissioner rights" 
                                  : "Grant commissioner rights"
                            }
                          />
                        ) : (
                          <span className={dynastyTheme.classes.text.neutralLight}>-</span>
                        )}
                      </td>
                    )}
                    
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        {editingTeam === owner.team_id ? (
                          <>
                            <button 
                              onClick={() => handleSaveTeamEdit(owner.team_id)}
                              className={dynastyTheme.utils.getComponent('button', 'primary', 'xs')}
                            >
                              Save
                            </button>
                            <button 
                              onClick={() => setEditingTeam(null)}
                              className={dynastyTheme.utils.getComponent('button', 'secondary', 'xs')}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {owner.actions?.includes('Cancel') && owner.invitation_id && (
                              <button 
                                onClick={() => handleCancelInvitation(owner.invitation_id)}
                                className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'xs')} ${dynastyTheme.classes.text.error}`}
                                title="Cancel invitation"
                              >
                                Cancel
                              </button>
                            )}
                            {owner.actions?.includes('Invite') && (
                              <button 
                                onClick={() => handleInviteForSlot(owner.slot)}
                                className={dynastyTheme.utils.getComponent('button', 'primary', 'xs')}
                              >
                                Invite
                              </button>
                            )}
                            {owner.actions?.includes('Edit') && owner.team_id && (
                              <>
                                <button 
                                  onClick={() => handleEditTeam(owner)}
                                  className={dynastyTheme.utils.getComponent('button', 'secondary', 'xs')}
                                  title="Edit team details"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                {!owner.is_commissioner && (
                                  <button 
                                    onClick={() => handleDeleteTeam(owner.team_id)}
                                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'xs')} ${dynastyTheme.classes.text.error}`}
                                    title="Delete team"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueOwners;