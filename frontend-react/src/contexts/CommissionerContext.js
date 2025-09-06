// src/contexts/CommissionerContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const CommissionerContext = createContext();

export const useCommissioner = () => {
  const context = useContext(CommissionerContext);
  if (!context) {
    throw new Error('useCommissioner must be used within a CommissionerProvider');
  }
  return context;
};

export const CommissionerProvider = ({ children }) => {
  const [isCommissionerMode, setIsCommissionerMode] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeTeamName, setActiveTeamName] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [isCommissioner, setIsCommissioner] = useState(false);

  // Exit commissioner mode when component unmounts or page changes
  useEffect(() => {
    const handleBeforeUnload = () => {
      exitCommissionerMode();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      exitCommissionerMode();
    };
  }, []);

  const enterCommissionerMode = (teams, initialTeamId = null) => {
    setAllTeams(teams);
    setIsCommissionerMode(true);
    
    // Set initial team (first team if no specific team provided)
    const firstTeam = initialTeamId 
      ? teams.find(t => t.team_id === initialTeamId) 
      : teams[0];
      
    if (firstTeam) {
      setActiveTeamId(firstTeam.team_id);
      setActiveTeamName(firstTeam.team_name);
    }
    
    console.log('Commissioner mode activated, managing:', firstTeam?.team_name);
  };

  const exitCommissionerMode = () => {
    setIsCommissionerMode(false);
    setActiveTeamId(null);
    setActiveTeamName(null);
    setAllTeams([]);
    console.log('Commissioner mode deactivated');
  };

  const switchTeam = (teamId) => {
    const team = allTeams.find(t => t.team_id === teamId);
    if (team) {
      setActiveTeamId(teamId);
      setActiveTeamName(team.team_name);
      console.log('Commissioner switched to managing:', team.team_name);
    }
  };

  const getActiveTeam = () => {
    return allTeams.find(t => t.team_id === activeTeamId);
  };

  // Helper to determine if we're managing a specific team
  const isManagingTeam = (teamId) => {
    return isCommissionerMode && activeTeamId === teamId;
  };

  // Helper to get the team ID for API calls
  const getTargetTeamId = (userTeamId) => {
    return isCommissionerMode ? activeTeamId : userTeamId;
  };

  const value = {
    // State
    isCommissionerMode,
    activeTeamId,
    activeTeamName,
    allTeams,
    isCommissioner,
    
    // Actions
    setIsCommissioner,
    enterCommissionerMode,
    exitCommissionerMode,
    switchTeam,
    
    // Helpers
    getActiveTeam,
    isManagingTeam,
    getTargetTeamId
  };

  return (
    <CommissionerContext.Provider value={value}>
      {children}
    </CommissionerContext.Provider>
  );
};

export default CommissionerContext;