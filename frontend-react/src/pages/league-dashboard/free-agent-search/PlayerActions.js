// src/pages/league-dashboard/free-agent-search/PlayerActions.js
// Utility functions for player actions and validation

// Validate if player can be added
export const canAddPlayer = (player, transactionsEnabled) => {
  if (!transactionsEnabled) {
    return { canAdd: false, reason: 'Transactions are not enabled' };
  }
  
  if (player.team_id || player.team_name) {
    return { canAdd: false, reason: 'Player is already owned by a team' };
  }
  
  if (!player.league_player_id) {
    return { canAdd: false, reason: 'Player not available in this league' };
  }
  
  return { canAdd: true, reason: null };
};

// Validate batch selection
export const validateBatchSelection = (selectedPlayers, transactionsEnabled) => {
  if (!transactionsEnabled) {
    return { isValid: false, reason: 'Transactions are not enabled' };
  }
  
  if (selectedPlayers.length === 0) {
    return { isValid: false, reason: 'No players selected' };
  }
  
  // Check if any selected players are owned
  const ownedPlayers = selectedPlayers.filter(p => p.team_id || p.team_name);
  if (ownedPlayers.length > 0) {
    return { 
      isValid: false, 
      reason: `Some selected players are already owned: ${ownedPlayers.map(p => `${p.first_name} ${p.last_name}`).join(', ')}` 
    };
  }
  
  // Check if any selected players don't have league_player_id
  const invalidPlayers = selectedPlayers.filter(p => !p.league_player_id);
  if (invalidPlayers.length > 0) {
    return { 
      isValid: false, 
      reason: `Some selected players are not available: ${invalidPlayers.map(p => `${p.first_name} ${p.last_name}`).join(', ')}` 
    };
  }
  
  return { isValid: true, reason: null };
};

// Create player data for API call
export const createPlayerData = (player, isCommissionerMode, getTargetTeamId) => {
  const playerData = {
    league_player_id: player.league_player_id,
    salary: player.display_price || player.price || player.salary || 1.0,
    contract_years: 2, // Default 2-year contract as specified
    roster_status: 'active'
  };

  if (isCommissionerMode) {
    playerData.commissioner_action = true;
    playerData.target_team_id = getTargetTeamId(null);
  }

  return playerData;
};

// Format success message
export const formatSuccessMessage = (playerName, teamName, isCommissionerMode) => {
  const name = playerName || 'Player';
  const team = isCommissionerMode ? teamName : 'your team';
  return `${name} added to ${team}!`;
};

// Format batch success message
export const formatBatchSuccessMessage = (count, teamName, isCommissionerMode) => {
  const team = isCommissionerMode ? teamName : 'your team';
  return `Successfully added ${count} player${count !== 1 ? 's' : ''} to ${team}!`;
};

// Format batch failure message
export const formatBatchFailureMessage = (failedResults) => {
  const failedNames = failedResults.map(f => f.name).join(', ');
  return `Failed to add: ${failedNames}`;
};