// src/pages/PlayerProfile.js - WITH DEBUG LOGGING
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { dynastyTheme } from '../services/colorService';
import { usePlayerData } from '../hooks/usePlayerData';
import PlayerInfoCard from '../components/player/PlayerInfoCard';

const PlayerProfile = () => {
  const { playerId, leagueId } = useParams();
  const navigate = useNavigate();
  
  // Get all data from the hook - with CORRECT field names
  const {
    loading,
    error,
    player,
    season_stats,      // CORRECT backend name
    rolling_14_day,    // CORRECT backend name
    career_stats,      // CORRECT backend name
    career_totals,
    game_logs,         // CORRECT backend name
    contract_info,
    analytics,
    isPitcher
  } = usePlayerData(playerId, leagueId);

  // DEBUG LOGGING
  console.log('=== PlayerProfile Debug ===');
  console.log('Data from usePlayerData hook:', {
    player: !!player,
    player_name: player ? `${player.first_name} ${player.last_name}` : 'N/A',
    season_stats: !!season_stats,
    rolling_14_day: !!rolling_14_day,
    game_logs: game_logs,
    game_logs_count: game_logs?.length || 0,
    game_logs_type: Array.isArray(game_logs) ? 'array' : typeof game_logs,
    first_game_log: game_logs?.[0],
    career_stats_count: career_stats?.length || 0,
    contract_info: !!contract_info,
    analytics: !!analytics,
    hasAnalytics: !!(analytics?.hotColdAnalysis || analytics?.performanceTrends)
  });

  if (loading) {
    return (
      <div className={dynastyTheme.components.page}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <p className={dynastyTheme.classes.text.neutralLight}>Loading player data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !player) {
    console.log('=== PlayerProfile Error ===', {
      error: error,
      player: player
    });
    return (
      <div className={dynastyTheme.components.page}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className={dynastyTheme.classes.text.error}>Error: {error || 'Player not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    if (leagueId) {
      navigate(`/league/${leagueId}`);
    } else {
      navigate('/dashboard');
    }
  };

  // Build league player data for PlayerInfoCard
  const leaguePlayerData = leagueId && contract_info ? {
    isOwned: !!contract_info.team_id,
    ownedByUser: contract_info.owned_by_user || false,
    team_name: contract_info.team_name || null,
    owner_name: contract_info.owner_name || null,
    salary: contract_info.salary || 0,
    contract_years: contract_info.contract_years || 0,
    roster_status: contract_info.roster_status || 'free_agent',
    acquisition_method: contract_info.acquisition_method || null,
    acquisition_date: contract_info.acquisition_date || null
  } : null;

  // Build pricing data
  const pricingData = {
    generated_price: contract_info?.suggested_price || analytics?.value?.price || 0,
    price: contract_info?.salary || 0,
    market_value: analytics?.value?.market || 0
  };

  // DEBUG: Log what we're passing to PlayerInfoCard
  console.log('=== Props being passed to PlayerInfoCard ===', {
    player: !!player,
    playerId: playerId,  // ADD THIS TO DEBUG LOG
    season_stats: !!season_stats,
    rolling_14_day: !!rolling_14_day,
    career_stats_count: career_stats?.length || 0,
    career_totals: !!career_totals,
    game_logs_being_passed: game_logs,
    game_logs_count_being_passed: game_logs?.length || 0,
    contract_info: !!contract_info,
    analytics: !!analytics,
    isPitcher: isPitcher()
  });

  return (
    <div className={dynastyTheme.components.pageWithPattern}>
      <div className="max-w-[1600px] mx-auto p-6">
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={handleBack}
            className={`
              inline-flex items-center gap-2 px-4 py-2 rounded-lg
              ${dynastyTheme.classes.bg.darkLighter} 
              ${dynastyTheme.classes.text.neutralLight}
              hover:${dynastyTheme.classes.text.white}
              hover:${dynastyTheme.classes.bg.neutral}
              border ${dynastyTheme.classes.border.neutral}
              transition-all duration-200
            `}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {leagueId ? 'League' : 'Dashboard'}</span>
          </button>
        </div>

        {/* ONLY PlayerInfoCard - IT HANDLES ALL TABS INTERNALLY */}
        <PlayerInfoCard 
          player={player}
          playerId={playerId}                   // ADD THIS - needed for tile analytics
          season_stats={season_stats}           // Backend name
          rolling_14_day={rolling_14_day}       // Backend name
          career_stats={career_stats}           // Backend name
          career_totals={career_totals}         // Backend name
          game_logs={game_logs}                 // Backend name - THIS IS THE KEY ONE
          contract_info={contract_info}         // Backend name
          analytics={analytics}
          isPitcher={isPitcher()}
          leagueId={leagueId}
          pricingData={pricingData}
          leaguePlayerData={leaguePlayerData}
          onAddPlayer={(player) => {
            console.log('Add player:', player);
            // TODO: Implement actual add logic
          }}
          onDropPlayer={(player) => {
            console.log('Drop player:', player);
            // TODO: Implement actual drop logic
          }}
          onInitiateTrade={(player) => {
            console.log('Trade player:', player);
            // TODO: Implement actual trade logic
          }}
        />
        
        {/* NOTHING ELSE - NO DUPLICATE TABS, NO DUPLICATE OVERVIEW */}
      </div>
    </div>
  );
};

export default PlayerProfile;