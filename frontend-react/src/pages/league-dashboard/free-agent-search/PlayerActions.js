// src/pages/league-dashboard/free-agent-search/PlayerActions.js
// Utility functions for player actions and validation
// UPDATED: Using canonical data structure

// Validate if player can be added
export const canAddPlayer = (player, transactionsEnabled) => {
  if (!transactionsEnabled) {
    return { canAdd: false, reason: 'Transactions are not enabled' };
  }
  
  // Check ownership using canonical structure
  const isOwned = player.league_context?.team?.team_name || player.team_id || player.team_name;
  if (isOwned) {
    return { canAdd: false, reason: 'Player is already owned by a team' };
  }
  
  // Check league player ID using canonical structure
  const leaguePlayerId = player.ids?.league_player || player.league_player_id;
  if (!leaguePlayerId) {
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
  
  // Check if any selected players are owned (using canonical structure)
  const ownedPlayers = selectedPlayers.filter(p => 
    p.league_context?.team?.team_name || p.team_id || p.team_name
  );
  if (ownedPlayers.length > 0) {
    return { 
      isValid: false, 
      reason: `Some selected players are already owned: ${ownedPlayers.map(p => {
        const firstName = p.info?.first_name || p.first_name;
        const lastName = p.info?.last_name || p.last_name;
        return `${firstName} ${lastName}`;
      }).join(', ')}` 
    };
  }
  
  // Check if any selected players don't have league_player_id (using canonical structure)
  const invalidPlayers = selectedPlayers.filter(p => {
    const leaguePlayerId = p.ids?.league_player || p.league_player_id;
    return !leaguePlayerId;
  });
  if (invalidPlayers.length > 0) {
    return { 
      isValid: false, 
      reason: `Some selected players are not available: ${invalidPlayers.map(p => {
        const firstName = p.info?.first_name || p.first_name;
        const lastName = p.info?.last_name || p.last_name;
        return `${firstName} ${lastName}`;
      }).join(', ')}` 
    };
  }
  
  return { isValid: true, reason: null };
};

// Create player data for API call
export const createPlayerData = (player, isCommissionerMode, getTargetTeamId) => {
  // Use canonical structure for league player ID
  const leaguePlayerId = player.ids?.league_player || player.league_player_id;
  
  // Use canonical structure for pricing
  const salary = player.financial?.market_price || 
                 player.financial?.contract_salary || 
                 1.0;
  
  const playerData = {
    league_player_id: leaguePlayerId,
    salary: salary,
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

// Helper function to get player name from canonical structure
export const getPlayerName = (player) => {
  const firstName = player.info?.first_name || player.first_name || '';
  const lastName = player.info?.last_name || player.last_name || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown Player';
};

// Helper function to get league player ID from canonical structure
export const getLeaguePlayerId = (player) => {
  return player.ids?.league_player || player.league_player_id || null;
};

// Helper function to check if player is owned
export const isPlayerOwned = (player) => {
  return !!(player.league_context?.team?.team_name || player.team_id || player.team_name);
};