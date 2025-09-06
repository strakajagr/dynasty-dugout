// src/pages/PlayerProfile.js - CLEANED VERSION USING CHILD COMPONENTS
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  TrendingUp, Calendar, Award, Brain, History, 
  ChartBar, DollarSign 
} from 'lucide-react';
import { dynastyTheme } from '../services/colorService';
import { usePlayerData } from '../hooks/usePlayerData';

// Import all child components
import PlayerInfoCard from '../components/player/PlayerInfoCard';
import PlayerOverviewTab from '../components/player/PlayerOverviewTab';
import PlayerGameLogsTab from '../components/player/PlayerGameLogsTab';
import PlayerCareerTab from '../components/player/PlayerCareerTab';
import PlayerContractTab from '../components/player/PlayerContractTab';
import PlayerPerformanceAnalytics from '../components/player/PlayerPerformanceAnalytics';
import PlayerHistoricalAnalytics from '../components/player/PlayerHistoricalAnalytics';
import PlayerAdvancedAnalytics from '../components/player/PlayerAdvancedAnalytics';

const PlayerProfile = () => {
  const { playerId, leagueId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Get all data from the hook
  const {
    loading,
    error,
    player,
    historicalStats,
    careerTotals,
    mainDBGameLogs,
    league2025Stats,
    rollingStats,
    contractInfo,
    analytics,
    isPitcher
  } = usePlayerData(playerId, leagueId);

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

  const tabs = [
    { id: 'overview', label: '2025 Overview', icon: TrendingUp },
    { id: 'gamelogs', label: 'Game Logs', icon: Calendar },
    { id: 'career', label: 'Career History', icon: Award },
    { id: 'performance', label: 'Performance Analytics', icon: Brain },
    { id: 'historical', label: 'Historical Analytics', icon: History },
    { id: 'advanced', label: 'Advanced Analytics', icon: ChartBar },
    { id: 'contract', label: 'Contract Details', icon: DollarSign }
  ];

  return (
    <div className={dynastyTheme.components.pageWithPattern}>
      <div className="max-w-[1600px] mx-auto p-6">
        {/* Player Header with Info Card - uses redesigned component */}
        <PlayerInfoCard 
          player={player}
          contractInfo={contractInfo}
          league2025Stats={league2025Stats}
          rollingStats={rollingStats}
          teamAttributionData={null}
          analytics={analytics}
          isPitcher={isPitcher()}
        />

        {/* Tabs */}
        <div className={`${dynastyTheme.components.card.base} mb-6`}>
          <div className="border-b border-neutral-700">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 border-b-2 transition-all whitespace-nowrap
                    ${activeTab === tab.id 
                      ? 'border-yellow-400 text-yellow-400 bg-yellow-400/10' 
                      : 'border-transparent text-neutral-400 hover:text-white hover:bg-neutral-800/50'}
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className={`${dynastyTheme.components.card.base} p-6`}>
          {activeTab === 'overview' && (
            <PlayerOverviewTab 
              player={player}
              leagueStats={league2025Stats}
              rollingStats={rollingStats}
              isPitcher={isPitcher()}
            />
          )}

          {activeTab === 'gamelogs' && (
            <PlayerGameLogsTab 
              gameLogs={mainDBGameLogs}
              isPitcher={isPitcher()}
            />
          )}

          {activeTab === 'career' && (
            <PlayerCareerTab 
              historicalStats={historicalStats}
              careerTotals={careerTotals}
              isPitcher={isPitcher()}
            />
          )}

          {activeTab === 'performance' && (
            <PlayerPerformanceAnalytics 
              analytics={analytics}
              playerName={`${player.first_name} ${player.last_name}`}
              isPitcher={isPitcher()}
            />
          )}

          {activeTab === 'historical' && (
            <PlayerHistoricalAnalytics 
              analytics={analytics}
              careerStats={historicalStats}
              careerTotals={careerTotals}
              playerName={`${player.first_name} ${player.last_name}`}
              isPitcher={isPitcher()}
            />
          )}

          {activeTab === 'advanced' && (
            <PlayerAdvancedAnalytics 
              analytics={analytics}
              playerName={`${player.first_name} ${player.last_name}`}
              isPitcher={isPitcher()}
            />
          )}

          {activeTab === 'contract' && (
            <PlayerContractTab 
              contractInfo={contractInfo}
              teamAttributionData={null}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;