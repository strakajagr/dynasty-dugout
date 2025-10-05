// src/components/commissioner/CommissionerToggle.js
import React, { useState, useEffect } from 'react';
import { Shield, Users, Loader } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { useCommissioner } from '../../contexts/CommissionerContext';
import { leaguesAPI } from '../../services/apiService';

const CommissionerToggle = ({ leagueId, userIsCommissioner = false }) => {
  const { 
    isCommissionerMode, 
    enterCommissionerMode, 
    isCommissioner,
    setIsCommissioner 
  } = useCommissioner();
  
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    setIsCommissioner(userIsCommissioner);
  }, [userIsCommissioner, setIsCommissioner]);

  // Don't show if not commissioner or already in commissioner mode
  // USE PROP DIRECTLY - context may not be synced on first render
  if (!userIsCommissioner || isCommissionerMode) return null;

  const handleEnterCommissionerMode = async () => {
    try {
      setLoading(true);
      
      // Fetch all teams in the league
      const response = await leaguesAPI.getLeagueTeams(leagueId);
      
      if (response.success && response.teams) {
        const teamList = response.teams.map(team => ({
          team_id: team.team_id,
          team_name: team.team_name || 'Unnamed Team',
          manager_name: team.manager_name || 'Manager',
          total_players: team.total_players || 0,
          salary_used: team.salary_used || 0,
          salary_cap: team.salary_cap || 0
        }));
        
        enterCommissionerMode(teamList);
      } else {
        console.error('Failed to load teams for commissioner mode');
        alert('Failed to load league teams. Please try again.');
      }
    } catch (error) {
      console.error('Error entering commissioner mode:', error);
      alert('Error entering commissioner mode: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleEnterCommissionerMode}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} border-2 border-yellow-400/30 hover:border-yellow-400/60 hover:bg-yellow-500/10 transition-all`}
      title="Enter commissioner mode to manage any team's roster"
    >
      {loading ? (
        <Loader className="w-4 h-4 animate-spin text-yellow-400" />
      ) : (
        <Shield className="w-4 h-4 text-yellow-400" />
      )}
      <span className={dynastyTheme.classes.text.white}>
        {loading ? 'Loading Teams...' : 'Commissioner Mode'}
      </span>
      <Users className="w-4 h-4 text-yellow-400/60" />
    </button>
  );
};

export default CommissionerToggle;