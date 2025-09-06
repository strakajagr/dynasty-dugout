// src/components/commissioner/CommissionerModeBar.js - COMPLETE REWRITE WITH WORKING DROPDOWN
import React, { useState, useEffect } from 'react';
import { Shield, X, Users, AlertTriangle, ChevronDown } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { useCommissioner } from '../../contexts/CommissionerContext';

const CommissionerModeBar = ({ league, onTeamSwitch }) => {
  const { 
    isCommissionerMode, 
    activeTeamName, 
    activeTeamId,
    allTeams, 
    exitCommissionerMode, 
    switchTeam 
  } = useCommissioner();
  
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);

  if (!isCommissionerMode) return null;

  const handleTeamChange = (teamId) => {
    console.log('CommissionerModeBar - Switching to team:', teamId);
    
    // Close dropdown
    setShowTeamDropdown(false);
    
    // Switch team in context
    switchTeam(teamId);
    
    // Call parent callback
    if (onTeamSwitch) {
      onTeamSwitch(teamId);
    }
  };

  const activeTeam = allTeams.find(t => t.team_id === activeTeamId);

  return (
    <div className="sticky top-0 z-40 mb-4">
      <div className="p-4 rounded-lg border-2 border-yellow-400/50 bg-yellow-500/10 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Commissioner Mode</span>
            </div>
            
            {/* Team Selection Dropdown - SAME PATTERN AS MYROSTER */}
            <div className="relative">
              <button
                onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-yellow-400/30 hover:border-yellow-400/60 transition-colors"
              >
                <Users className="w-4 h-4 text-yellow-400" />
                <span className="text-white">
                  Managing: <span className="text-yellow-400 font-medium">{activeTeamName || 'No Team Selected'}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-yellow-400 transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Team Dropdown - EXACT SAME STRUCTURE AS WORKING MYROSTER DROPDOWN */}
              {showTeamDropdown && (
                <>
                  <div className="absolute top-full left-0 mt-2 w-72 rounded-lg bg-gray-800 border border-yellow-400/30 shadow-xl z-50">
                    <div className="p-2">
                      <div className="text-xs text-gray-400 px-3 py-2 border-b border-gray-700 mb-2">
                        Switch to manage different team ({allTeams.length} teams):
                      </div>
                      {allTeams.length > 0 ? allTeams.map(team => (
                        <div
                          key={team.team_id}
                          onClick={() => handleTeamChange(team.team_id)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                            team.team_id === activeTeamId
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                          }`}
                        >
                          <div className="font-medium">{team.team_name}</div>
                          <div className="text-xs opacity-75">
                            {team.manager_name || 'Manager'} • {team.total_players || 0} players
                          </div>
                          <div className="text-xs text-gray-500">
                            ${team.salary_used || 0}
                          </div>
                        </div>
                      )) : (
                        <div className="px-3 py-2 text-gray-400 text-sm">
                          No teams loaded
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Background overlay - INSIDE conditional, same as MyRoster */}
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowTeamDropdown(false)}
                  />
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Team Info */}
            <div className="text-right text-sm">
              <div className="text-gray-400">
                {activeTeam ? (
                  <>
                    {activeTeam.total_players || 0} players • ${activeTeam.salary_used || 0}
                  </>
                ) : (
                  'No team data'
                )}
              </div>
              <div className="text-xs text-gray-500">
                Manager: {activeTeam?.manager_name || 'Unknown'}
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">Admin Actions</span>
            </div>

            {/* Exit Button */}
            <button
              onClick={() => exitCommissionerMode()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors"
              title="Exit Commissioner Mode"
            >
              <X className="w-4 h-4" />
              <span className="text-sm">Exit</span>
            </button>
          </div>
        </div>

        {/* Action Description */}
        <div className="mt-3 pt-3 border-t border-yellow-400/20">
          <div className="text-xs text-yellow-400/80">
            All roster actions (add/drop/trade) will be performed for <span className="font-medium">{activeTeamName || 'selected team'}</span>. 
            Actions are logged as commissioner overrides.
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Active ID: {activeTeamId || 'none'} | Teams loaded: {allTeams.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommissionerModeBar;