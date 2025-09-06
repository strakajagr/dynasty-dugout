// src/components/dashboard/TrendingPlayersSection.js
import React, { useState, useEffect } from 'react';
import { Flame, Snowflake } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { 
  DynastyTable,
  createHotPlayersColumns,
  createColdPlayersColumns,
  createWaiverAddsColumns,
  createWaiverDropsColumns
} from '../../services/tableService';

const TrendingPlayersSection = () => {
  const [hotPlayers, setHotPlayers] = useState([]);
  const [coldPlayers, setColdPlayers] = useState([]);
  const [waiverAdds, setWaiverAdds] = useState([]);
  const [waiverDrops, setWaiverDrops] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(true);

  useEffect(() => {
    loadTrendingPlayers();
    loadWaiverTrends();
  }, []);

  const loadTrendingPlayers = async () => {
    try {
      setLoadingTrends(true);
      
      // Mock data
      setHotPlayers([
        { player_id: 1, name: 'Ronald Acuña Jr.', position: 'OF', team: 'ATL', 
          last_7: { avg: .385, hr: 4, rbi: 12, ops: 1.250 }, 
          change: { avg: '+.085', trend: 'up' }
        },
        { player_id: 2, name: 'Mookie Betts', position: '2B', team: 'LAD', 
          last_7: { avg: .367, hr: 3, rbi: 9, ops: 1.180 }, 
          change: { avg: '+.067', trend: 'up' }
        },
        { player_id: 3, name: 'Juan Soto', position: 'OF', team: 'SD', 
          last_7: { avg: .412, hr: 2, rbi: 8, ops: 1.320 }, 
          change: { avg: '+.112', trend: 'up' }
        }
      ]);

      setColdPlayers([
        { player_id: 4, name: 'Mike Trout', position: 'OF', team: 'LAA', 
          last_7: { avg: .125, hr: 0, rbi: 1, ops: .450 }, 
          change: { avg: '-.175', trend: 'down' }
        },
        { player_id: 5, name: 'Jose Altuve', position: '2B', team: 'HOU', 
          last_7: { avg: .182, hr: 0, rbi: 2, ops: .520 }, 
          change: { avg: '-.118', trend: 'down' }
        }
      ]);
      
    } catch (error) {
      console.error('Error loading trending players:', error);
    } finally {
      setLoadingTrends(false);
    }
  };

  const loadWaiverTrends = async () => {
    try {
      setWaiverAdds([
        { player_id: 10, name: 'Elly De La Cruz', position: 'SS', team: 'CIN', 
          adds_today: 342, ownership: '45%', trend: '+12%' },
        { player_id: 11, name: 'Grayson Rodriguez', position: 'SP', team: 'BAL', 
          adds_today: 298, ownership: '38%', trend: '+8%' },
        { player_id: 12, name: 'Matt McLain', position: '2B/SS', team: 'CIN', 
          adds_today: 276, ownership: '32%', trend: '+6%' }
      ]);

      setWaiverDrops([
        { player_id: 13, name: 'Byron Buxton', position: 'OF', team: 'MIN', 
          drops_today: 189, ownership: '68%', trend: '-5%' },
        { player_id: 14, name: 'Jesse Winker', position: 'OF', team: 'MIL', 
          drops_today: 156, ownership: '22%', trend: '-8%' }
      ]);
      
    } catch (error) {
      console.error('Error loading waiver trends:', error);
    }
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
      {/* Hot Players Table */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-3">
          <Flame className={`w-5 h-5 text-orange-500`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Hot Players (Last 7 Days)</h3>
        </div>
        <DynastyTable
          data={hotPlayers}
          columns={createHotPlayersColumns()}
          maxHeight="250px"
          enableHorizontalScroll={false}
          enableVerticalScroll={true}
          stickyHeader={false}
        />
      </div>

      {/* Cold Players Table */}
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-3">
          <Snowflake className={`w-5 h-5 text-blue-400`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Cold Players</h3>
        </div>
        <DynastyTable
          data={coldPlayers}
          columns={createColdPlayersColumns()}
          maxHeight="200px"
          enableHorizontalScroll={false}
          enableVerticalScroll={true}
          stickyHeader={false}
        />
      </div>

      {/* Waiver Wire Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className="flex items-center space-x-2 mb-3">
            <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Most Added Today</h3>
          </div>
          <DynastyTable
            data={waiverAdds}
            columns={createWaiverAddsColumns()}
            maxHeight="200px"
            enableHorizontalScroll={false}
            enableVerticalScroll={true}
            stickyHeader={false}
          />
        </div>

        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className="flex items-center space-x-2 mb-3">
            <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Most Dropped Today</h3>
          </div>
          <DynastyTable
            data={waiverDrops}
            columns={createWaiverDropsColumns()}
            maxHeight="200px"
            enableHorizontalScroll={false}
            enableVerticalScroll={true}
            stickyHeader={false}
          />
        </div>
      </div>
    </div>
  );
};

export default TrendingPlayersSection;