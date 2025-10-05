// src/contexts/PlayerModalContext.js
import React, { createContext, useContext, useState } from 'react';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { leaguesAPI } from '../services/apiService';

const PlayerModalContext = createContext();

export const usePlayerModal = () => {
  const context = useContext(PlayerModalContext);
  if (!context) {
    throw new Error('usePlayerModal must be used within a PlayerModalProvider');
  }
  return context;
};

export const PlayerModalProvider = ({ children, leagueId, userTeamId, isCommissionerMode = false }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    playerId: null,
    playerData: null
  });

  const openPlayerModal = (playerId, playerData = null) => {
    setModalState({
      isOpen: true,
      playerId: playerId,
      playerData: playerData
    });
  };

  const closePlayerModal = () => {
    setModalState({
      isOpen: false,
      playerId: null,
      playerData: null
    });
  };

  const handlePlayerAction = async (action, playerData) => {
    console.log(`Player action: ${action}`, playerData);
    
    try {
      switch (action) {
        case 'add':
          // Use existing add player logic from FreeAgentSearch
          const addData = {
            league_player_id: playerData.league_player_id,
            salary: playerData.financial?.market_price || playerData.financial?.contract_salary || 1.0,
            contract_years: 2,
            roster_status: 'active',
            start_contract: true
          };
          
          if (isCommissionerMode) {
            addData.commissioner_action = true;
            addData.target_team_id = userTeamId;
          }
          
          const addResponse = await leaguesAPI.addPlayerToTeam(leagueId, addData);
          if (addResponse.success) {
            alert(`${playerData.first_name} ${playerData.last_name} added to team!`);
            // Trigger roster refresh
            window.dispatchEvent(new Event('roster-updated'));
          } else {
            alert(`Failed to add player: ${addResponse.message}`);
          }
          break;
          
        case 'drop':
          if (window.confirm(`Drop ${playerData.first_name} ${playerData.last_name}?`)) {
            const dropOptions = {};
            if (isCommissionerMode) {
              dropOptions.commissioner_action = true;
              dropOptions.target_team_id = userTeamId;
            }
            
            const dropResponse = await leaguesAPI.dropPlayerFromTeam(
              leagueId, 
              playerData.league_player_id, 
              dropOptions
            );
            
            if (dropResponse.success) {
              alert(`${playerData.first_name} ${playerData.last_name} dropped!`);
              window.dispatchEvent(new Event('roster-updated'));
            } else {
              alert(`Failed to drop player: ${dropResponse.message}`);
            }
          }
          break;
          
        case 'trade':
          // Navigate to trade interface or show trade modal
          alert(`Trade functionality for ${playerData.first_name} ${playerData.last_name} - Coming Soon!`);
          break;
          
        default:
          console.log('Unknown action:', action);
      }
    } catch (err) {
      console.error(`Error ${action} player:`, err);
      alert(`Failed to ${action} player. Please try again.`);
    }
  };

  return (
    <PlayerModalContext.Provider
      value={{
        openPlayerModal,
        closePlayerModal,
        ...modalState
      }}
    >
      {children}
      
      <PlayerProfileModal
        playerId={modalState.playerId}
        leagueId={leagueId}
        isOpen={modalState.isOpen}
        onClose={closePlayerModal}
        userTeamId={userTeamId}
        onPlayerAction={handlePlayerAction}
        isCommissionerMode={isCommissionerMode}
      />
    </PlayerModalContext.Provider>
  );
};

// Convenience hook for easy usage
export const useShowPlayerProfile = () => {
  const { openPlayerModal } = usePlayerModal();
  
  return (player) => {
    const playerId = player.mlb_player_id || player.player_id;
    openPlayerModal(playerId, player);
  };
};