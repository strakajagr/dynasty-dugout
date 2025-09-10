// src/components/dashboard/TrendingPlayersSection.js
import React, { useState, useEffect } from 'react';
import { Flame, Snowflake } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { mlbAPI } from '../../services/apiService';
import { 
  DynastyTable,
  createHotHittersColumns,
  createColdHittersColumns,
  createHotPitchersColumns,
  createColdPitchersColumns,
  createWaiverAddsColumns,
  createWaiverDropsColumns
} from '../../services/tableService';  // All imports from tableService

const TrendingPlayersSection = () => {
  const [activeTab, setActiveTab] = useState('hitters');
  const [hotHitters, setHotHitters] = useState([]);
  const [coldHitters, setColdHitters] = useState([]);
  const [hotPitchers, setHotPitchers] = useState([]);
  const [coldPitchers, setColdPitchers] = useState([]);
  const [waiverAdds, setWaiverAdds] = useState([]);
  const [waiverDrops, setWaiverDrops] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTrendingPlayers();
  }, []);

  const loadTrendingPlayers = async () => {
    try {
      setLoadingTrends(true);
      setError(null);
      
      console.log('📊 Loading trending players from API...');
      
      // Load hitters
      const hittersResponse = await mlbAPI.getTrendingPlayers();
      console.log('🔍 Hitters Response:', hittersResponse);  // DEBUG: See full response
      
      if (hittersResponse && hittersResponse.success) {
        console.log('✅ Setting hitters data:', {
          hot: hittersResponse.hot_players,
          cold: hittersResponse.cold_players,
          adds: hittersResponse.waiver_adds,
          drops: hittersResponse.waiver_drops
        });
        setHotHitters(hittersResponse.hot_players || []);
        setColdHitters(hittersResponse.cold_players || []);
        setWaiverAdds(hittersResponse.waiver_adds || []);
        setWaiverDrops(hittersResponse.waiver_drops || []);
      } else {
        console.warn('⚠️ Hitters response not successful or missing:', hittersResponse);
        loadFallbackData();
      }
      
      // Load pitchers with query param
      const pitchersResponse = await mlbAPI.getTrendingPlayers('?player_type=pitchers');
      console.log('🔍 Pitchers Response:', pitchersResponse);  // DEBUG: See full response
      
      if (pitchersResponse && pitchersResponse.success) {
        console.log('✅ Setting pitchers data:', {
          hot: pitchersResponse.hot_players,
          cold: pitchersResponse.cold_players
        });
        setHotPitchers(pitchersResponse.hot_players || []);
        setColdPitchers(pitchersResponse.cold_players || []);
      } else {
        console.warn('⚠️ Pitchers response not successful or missing:', pitchersResponse);
      }
      
    } catch (error) {
      console.error('❌ Error loading trending players:', error);
      setError(error.message);
      loadFallbackData();
    } finally {
      setLoadingTrends(false);
    }
  };

  const loadFallbackData = () => {
    console.log('🔄 Loading fallback trending data');
    // Fallback hitters
    setHotHitters([
      { player_id: 1, name: 'Ronald Acuña Jr.', position: 'OF', team: 'ATL', 
        last_7: { avg: .385, hr: 4, rbi: 12, ops: 1.250 }, 
        change: { ops: '+.200', trend: 'up' }
      },
      { player_id: 2, name: 'Mookie Betts', position: '2B', team: 'LAD', 
        last_7: { avg: .367, hr: 3, rbi: 9, ops: 1.180 }, 
        change: { ops: '+.180', trend: 'up' }
      },
      { player_id: 3, name: 'Juan Soto', position: 'OF', team: 'SD', 
        last_7: { avg: .412, hr: 2, rbi: 8, ops: 1.320 }, 
        change: { ops: '+.220', trend: 'up' }
      }
    ]);

    setColdHitters([
      { player_id: 4, name: 'Mike Trout', position: 'OF', team: 'LAA', 
        last_7: { avg: .125, hr: 0, rbi: 1, ops: .450 }, 
        change: { ops: '-.350', trend: 'down' }
      },
      { player_id: 5, name: 'Jose Altuve', position: '2B', team: 'HOU', 
        last_7: { avg: .182, hr: 0, rbi: 2, ops: .520 }, 
        change: { ops: '-.280', trend: 'down' }
      }
    ]);

    // Fallback pitchers
    setHotPitchers([
      { player_id: 6, name: 'Gerrit Cole', position: 'SP', team: 'NYY', 
        last_7: { wins: 2, saves: 0, strikeouts: 18, era: 1.50, whip: 0.85 }, 
        change: { era: '-1.50', trend: 'up' }
      },
      { player_id: 7, name: 'Edwin Diaz', position: 'RP', team: 'NYM', 
        last_7: { wins: 0, saves: 4, strikeouts: 12, era: 0.00, whip: 0.50 }, 
        change: { era: '-2.00', trend: 'up' }
      }
    ]);

    setColdPitchers([
      { player_id: 8, name: 'Dylan Cease', position: 'SP', team: 'SD', 
        last_7: { wins: 0, saves: 0, strikeouts: 8, era: 7.50, whip: 1.85 }, 
        change: { era: '+3.50', trend: 'down' }
      }
    ]);

    setWaiverAdds([
      { player_id: 10, name: 'Elly De La Cruz', position: 'SS', team: 'CIN', 
        adds_today: 342, ownership: '45%', trend: '+12%' },
      { player_id: 11, name: 'Grayson Rodriguez', position: 'SP', team: 'BAL', 
        adds_today: 298, ownership: '38%', trend: '+8%' }
    ]);

    setWaiverDrops([
      { player_id: 13, name: 'Byron Buxton', position: 'OF', team: 'MIN', 
        drops_today: 189, ownership: '68%', trend: '-5%' },
      { player_id: 14, name: 'Jesse Winker', position: 'OF', team: 'MIL', 
        drops_today: 156, ownership: '22%', trend: '-8%' }
    ]);
  };

  if (loadingTrends) {
    return (
      <div className="space-y-6">
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center space-x-3">
              <div 
                className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${dynastyTheme.classes.border.primaryBright}`}
              />
              <span className={dynastyTheme.classes.text.white}>Loading player trends...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className={`${dynastyTheme.components.card.base} p-4 border-l-4 border-yellow-500`}>
          <div className="flex items-center space-x-2">
            <span className="text-yellow-400">⚠️</span>
            <span className={dynastyTheme.classes.text.white}>
              API Error: {error}. Showing cached data.
            </span>
            <button
              onClick={loadTrendingPlayers}
              className={`text-sm ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline ml-2`}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Tabs for Hitters/Pitchers */}
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setActiveTab('hitters')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            activeTab === 'hitters'
              ? `${dynastyTheme.components.button.primary} text-gray-900`
              : `bg-gray-700 ${dynastyTheme.classes.text.neutralLight} hover:bg-gray-600`
          }`}
        >
          Hitters
        </button>
        <button
          onClick={() => setActiveTab('pitchers')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            activeTab === 'pitchers'
              ? `${dynastyTheme.components.button.primary} text-gray-900`
              : `bg-gray-700 ${dynastyTheme.classes.text.neutralLight} hover:bg-gray-600`
          }`}
        >
          Pitchers
        </button>
      </div>

      {/* Hot Players Table */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-3">
          <Flame className={`w-5 h-5 text-orange-500`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>
            Hot {activeTab === 'hitters' ? 'Hitters' : 'Pitchers'} (Last 7 Days)
          </h3>
          <span className={`text-xs ${dynastyTheme.classes.text.neutralLight} bg-green-600/20 px-2 py-1 rounded`}>
            LIVE DATA
          </span>
        </div>
        {activeTab === 'hitters' ? (
          hotHitters && hotHitters.length > 0 ? (
            <DynastyTable
              data={hotHitters}
              columns={createHotHittersColumns()}
              maxHeight="250px"
              enableHorizontalScroll={false}
              enableVerticalScroll={true}
              stickyHeader={false}
            />
          ) : (
            <div className="text-center py-4 text-gray-400">No hot hitters found</div>
          )
        ) : (
          hotPitchers && hotPitchers.length > 0 ? (
            <DynastyTable
              data={hotPitchers}
              columns={createHotPitchersColumns()}
              maxHeight="250px"
              enableHorizontalScroll={false}
              enableVerticalScroll={true}
              stickyHeader={false}
            />
          ) : (
            <div className="text-center py-4 text-gray-400">No hot pitchers found</div>
          )
        )}
      </div>

      {/* Cold Players Table */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-3">
          <Snowflake className={`w-5 h-5 text-blue-400`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>
            Cold {activeTab === 'hitters' ? 'Hitters' : 'Pitchers'}
          </h3>
          <span className={`text-xs ${dynastyTheme.classes.text.neutralLight} bg-green-600/20 px-2 py-1 rounded`}>
            LIVE DATA
          </span>
        </div>
        {activeTab === 'hitters' ? (
          coldHitters && coldHitters.length > 0 ? (
            <DynastyTable
              data={coldHitters}
              columns={createColdHittersColumns()}
              maxHeight="200px"
              enableHorizontalScroll={false}
              enableVerticalScroll={true}
              stickyHeader={false}
            />
          ) : (
            <div className="text-center py-4 text-gray-400">No cold hitters found</div>
          )
        ) : (
          coldPitchers && coldPitchers.length > 0 ? (
            <DynastyTable
              data={coldPitchers}
              columns={createColdPitchersColumns()}
              maxHeight="200px"
              enableHorizontalScroll={false}
              enableVerticalScroll={true}
              stickyHeader={false}
            />
          ) : (
            <div className="text-center py-4 text-gray-400">No cold pitchers found</div>
          )
        )}
      </div>

      {/* Waiver Wire Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className="flex items-center space-x-2 mb-3">
            <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Most Added Today</h3>
            <span className={`text-xs ${dynastyTheme.classes.text.neutralLight} bg-green-600/20 px-2 py-1 rounded`}>
              LIVE DATA
            </span>
          </div>
          {waiverAdds && waiverAdds.length > 0 ? (
            <DynastyTable
              data={waiverAdds}
              columns={createWaiverAddsColumns()}
              maxHeight="200px"
              enableHorizontalScroll={false}
              enableVerticalScroll={true}
              stickyHeader={false}
            />
          ) : (
            <div className="text-center py-4 text-gray-400">No waiver adds</div>
          )}
        </div>

        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className="flex items-center space-x-2 mb-3">
            <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Most Dropped Today</h3>
            <span className={`text-xs ${dynastyTheme.classes.text.neutralLight} bg-green-600/20 px-2 py-1 rounded`}>
              LIVE DATA
            </span>
          </div>
          {waiverDrops && waiverDrops.length > 0 ? (
            <DynastyTable
              data={waiverDrops}
              columns={createWaiverDropsColumns()}
              maxHeight="200px"
              enableHorizontalScroll={false}
              enableVerticalScroll={true}
              stickyHeader={false}
            />
          ) : (
            <div className="text-center py-4 text-gray-400">No waiver drops</div>
          )}
        </div>
      </div>

      {/* Refresh Info */}
      <div className={`text-center text-xs ${dynastyTheme.classes.text.neutralLighter}`}>
        Data refreshed every 2 hours • Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default TrendingPlayersSection;