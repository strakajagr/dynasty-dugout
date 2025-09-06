// src/pages/league-dashboard/free-agent-search/BatchSelectionProvider.js
import React, { createContext, useContext, useState, useMemo } from 'react';

const BatchSelectionContext = createContext();

export const useBatchSelection = () => {
  const context = useContext(BatchSelectionContext);
  if (!context) {
    throw new Error('useBatchSelection must be used within BatchSelectionProvider');
  }
  return context;
};

const BatchSelectionProvider = ({ children }) => {
  const [selectedPlayers, setSelectedPlayers] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false); // NEW: Bulk mode toggle state

  // NEW: Toggle bulk mode on/off
  const toggleBulkMode = () => {
    setBulkMode(prev => {
      const newMode = !prev;
      // Clear selections when turning off bulk mode
      if (!newMode) {
        setSelectedPlayers(new Set());
      }
      return newMode;
    });
  };

  // Toggle single player selection
  const togglePlayerSelection = (player) => {
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);
      const playerId = player.league_player_id;
      
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        // Only allow selection if player is available (not owned)
        if (!player.team_name && player.league_player_id) {
          newSet.add(playerId);
        }
      }
      
      return newSet;
    });
  };

  // Check if player is selected
  const isPlayerSelected = (player) => {
    return selectedPlayers.has(player.league_player_id);
  };

  // Select all available players
  const selectAllPlayers = (players) => {
    const availablePlayers = players.filter(p => 
      !p.team_name && p.league_player_id
    );
    
    const newSet = new Set();
    availablePlayers.forEach(player => {
      newSet.add(player.league_player_id);
    });
    
    setSelectedPlayers(newSet);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedPlayers(new Set());
  };

  // Get selected player objects from a list of players
  const getSelectedPlayerObjects = (players) => {
    return players.filter(player => 
      selectedPlayers.has(player.league_player_id)
    );
  };

  // Get selection stats
  const selectionStats = useMemo(() => {
    return {
      count: selectedPlayers.size,
      hasSelections: selectedPlayers.size > 0
    };
  }, [selectedPlayers]);

  const value = {
    selectedPlayers,
    selectionStats,
    bulkMode, // NEW: Expose bulk mode state
    toggleBulkMode, // NEW: Expose bulk mode toggle
    togglePlayerSelection,
    isPlayerSelected,
    selectAllPlayers,
    clearAllSelections,
    getSelectedPlayerObjects
  };

  return (
    <BatchSelectionContext.Provider value={value}>
      {children}
    </BatchSelectionContext.Provider>
  );
};

export default BatchSelectionProvider;