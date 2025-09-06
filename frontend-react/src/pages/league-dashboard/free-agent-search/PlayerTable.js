// src/pages/league-dashboard/free-agent-search/PlayerTable.js
import React from 'react';
import { RefreshCw, Users, AlertCircle } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';
import { DynastyTable } from '../../../services/tableService';
import { createDynamicColumns } from './TableColumns';
import { useBatchSelection } from './BatchSelectionProvider';

const PlayerTable = ({ state, leagueId, isCommissionerMode, activeTeamName }) => {
  const { bulkMode } = useBatchSelection();
  
  const {
    // Data
    players,
    loading,
    backgroundLoading,
    hasMore,
    
    // View state
    activeTab,
    showAll,
    
    // Functions
    handlePlayerClick,
    handleAddPlayer,
    loadMore,
    
    // League state
    transactionsEnabled,
    addingPlayer,
    
    // Pricing data - CRITICAL FOR DISPLAY
    savedPrices
  } = state;

  // Create columns using the imported function - NOW WITH PRICING
  const columns = createDynamicColumns({
    showAll,
    activeTab,
    handlePlayerClick,
    handleAddPlayer,
    transactionsEnabled,
    addingPlayer,
    loading,
    isCommissionerMode,
    activeTeamName,
    bulkMode,
    savedPrices: savedPrices || {} // PASS SAVED PRICES TO COLUMNS
  });

  // Process players to ensure rolling stats are properly formatted
  const processedPlayers = players.map(player => {
    // Ensure last_14_days data exists and is properly formatted
    const processedPlayer = { ...player };
    
    // If last_14_days is missing or empty, create it from rolling_14 or set defaults
    if (!processedPlayer.last_14_days || Object.keys(processedPlayer.last_14_days).length === 0) {
      if (player.rolling_14) {
        processedPlayer.last_14_days = player.rolling_14;
      } else if (player.stats_last_14) {
        processedPlayer.last_14_days = player.stats_last_14;
      } else {
        // Create empty rolling stats structure
        processedPlayer.last_14_days = {
          games_played: 0,
          at_bats: 0,
          runs: 0,
          hits: 0,
          doubles: 0,
          triples: 0,
          home_runs: 0,
          rbi: 0,
          stolen_bases: 0,
          caught_stealing: 0,
          walks: 0,
          strikeouts: 0,
          batting_avg: 0,
          obp: 0,
          slg: 0,
          ops: 0,
          games_started: 0,
          wins: 0,
          losses: 0,
          saves: 0,
          blown_saves: 0,
          holds: 0,
          quality_starts: 0,
          innings_pitched: 0,
          hits_allowed: 0,
          runs_allowed: 0,
          earned_runs: 0,
          home_runs_allowed: 0,
          walks_allowed: 0,
          strikeouts_pitched: 0,
          era: 0,
          whip: 0,
          k_per_9: 0,
          bb_per_9: 0
        };
      }
    }
    
    // Calculate derived stats for last 14 days if needed
    if (processedPlayer.last_14_days) {
      const l14 = processedPlayer.last_14_days;
      
      // Calculate K/9 and BB/9 for pitchers
      if (activeTab === 'pitchers') {
        const ip = parseFloat(l14.innings_pitched) || 0;
        if (ip > 0) {
          l14.k_per_9 = ((l14.strikeouts_pitched || 0) * 9 / ip).toFixed(1);
          l14.bb_per_9 = ((l14.walks_allowed || 0) * 9 / ip).toFixed(1);
        }
      }
      
      // Calculate HR/AB for hitters
      if (activeTab === 'hitters') {
        const ab = l14.at_bats || 0;
        if (ab > 0) {
          l14.hr_per_ab = ((l14.home_runs || 0) / ab * 100).toFixed(1);
        }
      }
    }
    
    return processedPlayer;
  });

  return (
    <>
      {/* Players Table */}
      <div className="relative">
        <DynastyTable
          data={processedPlayers}
          columns={columns}
          initialSort={{ 
            key: activeTab === 'hitters' ? 'home_runs' : 'strikeouts_pitched', 
            direction: activeTab === 'hitters' ? 'desc' : 'desc' 
          }}
          maxHeight="800px"
          minWidth={showAll ? (activeTab === 'hitters' ? "1100px" : "1000px") : (activeTab === 'hitters' ? "1000px" : "950px")} // REDUCED: Less width needed without removed columns
          stickyHeader={true}
          enableHorizontalScroll={true}
          enableVerticalScroll={true}
          twoRowMode={true}
          title={`${showAll ? 'All' : 'Available'} ${activeTab === 'hitters' ? 'Hitters' : 'Pitchers'} (Season Stats + Last 14 Days)${bulkMode ? ' - Bulk Selection Mode' : ''}`}
          showTotals={false}
          className="mb-4"
        />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg z-50">
            <div className={`flex items-center gap-3 ${dynastyTheme.components.card.base} px-6 py-4 rounded-lg`}>
              <RefreshCw className={`w-6 h-6 animate-spin ${dynastyTheme.classes.text.primary}`} />
              <span className={dynastyTheme.classes.text.white}>
                Loading {showAll ? 'all players' : 'free agents'}...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {!loading && players.length === 0 && (
        <div className={`${dynastyTheme.components.card.base} p-8`}>
          <div className="text-center">
            <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLight}`} />
            <h3 className={`${dynastyTheme.components.heading.h3} mb-2`}>
              No {activeTab} Found
            </h3>
            <p className={dynastyTheme.classes.text.neutralLight}>
              Try adjusting your search filters or check back later for updated player data.
            </p>
          </div>
        </div>
      )}

      {/* Load More Button */}
      {hasMore && players.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={backgroundLoading}
            className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'lg')} flex items-center gap-2 disabled:opacity-50`}
          >
            {backgroundLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading more players...
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                Load More Players
              </>
            )}
          </button>
        </div>
      )}

      {/* Background Loading Indicator */}
      {backgroundLoading && (
        <div className="flex justify-center mt-4">
          <div className={`flex items-center gap-2 ${dynastyTheme.classes.text.neutralLight} text-sm`}>
            <RefreshCw className="w-3 h-3 animate-spin" />
            Loading more players in background...
          </div>
        </div>
      )}

      {/* Stats Legend - UPDATED WITH NEW METRICS */}
      <div className={`${dynastyTheme.components.card.base} mt-6 p-4`}>
        <h3 className={`${dynastyTheme.classes.text.primary} font-bold text-sm mb-2`}>
          {showAll ? 'All Players Legend' : 'Free Agents Legend'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {bulkMode && (
            <div>
              <span className={dynastyTheme.classes.text.neutralLight}>☑️ Select:</span>
              <span className={`${dynastyTheme.classes.text.white} ml-1`}>Check to batch add</span>
            </div>
          )}
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>L14:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-1`}>Last 14 days rolling stats</span>
          </div>
          {showAll && (
            <>
              <div>
                <span className={dynastyTheme.classes.text.neutralLight}>Salary:</span>
                <span className={`${dynastyTheme.classes.text.white} ml-1`}>What owners pay</span>
              </div>
              <div>
                <span className={dynastyTheme.classes.text.neutralLight}>Price:</span>
                <span className={`${dynastyTheme.classes.text.white} ml-1`}>Cost to acquire (from pricing engine)</span>
              </div>
            </>
          )}
          {!showAll && (
            <div>
              <span className={dynastyTheme.classes.text.neutralLight}>Price:</span>
              <span className={`${dynastyTheme.classes.text.white} ml-1`}>Draft price set by commissioner</span>
            </div>
          )}
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>AVG:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-1`}>Batting Average</span>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>OPS:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-1`}>On-Base Plus Slugging</span>
          </div>
          {activeTab === 'hitters' && (
            <div>
              <span className={dynastyTheme.classes.text.neutralLight}>HR/AB:</span>
              <span className={`${dynastyTheme.classes.text.white} ml-1`}>Home run percentage</span>
            </div>
          )}
          {activeTab === 'pitchers' && (
            <>
              <div>
                <span className={dynastyTheme.classes.text.neutralLight}>ERA:</span>
                <span className={`${dynastyTheme.classes.text.white} ml-1`}>Earned Run Average</span>
              </div>
              <div>
                <span className={dynastyTheme.classes.text.neutralLight}>WHIP:</span>
                <span className={`${dynastyTheme.classes.text.white} ml-1`}>Walks + Hits per IP</span>
              </div>
              <div>
                <span className={dynastyTheme.classes.text.neutralLight}>K/9:</span>
                <span className={`${dynastyTheme.classes.text.white} ml-1`}>Strikeouts per 9 innings</span>
              </div>
              <div>
                <span className={dynastyTheme.classes.text.neutralLight}>BB/9:</span>
                <span className={`${dynastyTheme.classes.text.white} ml-1`}>Walks per 9 innings</span>
              </div>
            </>
          )}
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Contract:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-1`}>New players get 2 years</span>
          </div>
          <div>
            <span className={dynastyTheme.classes.text.neutralLight}>Qualified:</span>
            <span className={`${dynastyTheme.classes.text.white} ml-1`}>
              {activeTab === 'hitters' ? '502+ PA (batting title)' : '162+ IP (ERA title)'}
            </span>
          </div>
        </div>
        
        {/* Active Filters Indicator */}
        {state.advancedFilters && Object.values(state.advancedFilters).some(v => v && v !== 'season' && v !== '') && (
          <div className="mt-3 pt-3 border-t border-yellow-400/20">
            <div className="text-xs text-yellow-400">
              <span className="font-bold">Active Filters:</span> Results are filtered based on your advanced criteria
            </div>
          </div>
        )}
        
        {/* Commissioner Mode Legend */}
        {isCommissionerMode && (
          <div className="mt-3 pt-3 border-t border-yellow-400/20">
            <div className="text-xs text-yellow-400">
              <span className="font-bold">Commissioner Mode:</span> All actions will be performed for {activeTeamName}
            </div>
          </div>
        )}

        {/* Bulk Mode Instructions */}
        {bulkMode && (
          <div className="mt-3 pt-3 border-t border-yellow-400/20">
            <div className="text-xs text-yellow-400">
              <span className="font-bold">Bulk Mode:</span> Select multiple players using checkboxes, then click "Assign Positions" to add them all at once with intelligent position assignment.
            </div>
          </div>
        )}

        {/* Pricing Status */}
        {state.pricesExist && savedPrices && Object.keys(savedPrices).length > 0 && (
          <div className="mt-3 pt-3 border-t border-green-400/20">
            <div className="text-xs text-green-400">
              <span className="font-bold">Pricing Active:</span> Showing prices from league pricing engine ({Object.keys(savedPrices).length} players priced)
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PlayerTable;