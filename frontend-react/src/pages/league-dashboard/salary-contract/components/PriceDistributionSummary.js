// src/pages/league-dashboard/salary-contract/components/PriceDistributionSummary.js
import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { dynastyTheme } from '../../../../services/colorService';

const PriceDistributionSummary = ({ generatedPrices, league, leagueId }) => {
  
  const getDistributionChart = () => {
    if (!generatedPrices?.prices) return null;
    
    const ranges = [
      { label: '$50+', min: 50, max: Infinity, count: 0, color: 'bg-red-500' },
      { label: '$40-49', min: 40, max: 49, count: 0, color: 'bg-orange-500' },
      { label: '$30-39', min: 30, max: 39, count: 0, color: 'bg-yellow-500' },
      { label: '$20-29', min: 20, max: 29, count: 0, color: 'bg-green-500' },
      { label: '$10-19', min: 10, max: 19, count: 0, color: 'bg-blue-500' },
      { label: '$5-9', min: 5, max: 9, count: 0, color: 'bg-indigo-500' },
      { label: '$1-4', min: 1, max: 4, count: 0, color: 'bg-purple-500' }
    ];
    
    generatedPrices.prices.forEach(player => {
      const salary = player.salary || 0;
      const range = ranges.find(r => salary >= r.min && salary <= r.max);
      if (range) range.count++;
    });
    
    const maxCount = Math.max(...ranges.map(r => r.count));
    
    return ranges.map(range => ({
      ...range,
      percentage: maxCount > 0 ? (range.count / maxCount) * 100 : 0
    }));
  };

  const getTop10Players = () => {
    if (!generatedPrices?.prices) return [];
    
    return [...generatedPrices.prices]
      .sort((a, b) => (b.salary || 0) - (a.salary || 0))
      .slice(0, 10);
  };

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className="p-6">
        <h3 className={dynastyTheme.components.heading.h3}>
          <BarChart3 className="inline w-5 h-5 mr-2" />
          Price Distribution Summary
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Avg Salary</div>
            <div className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>
              ${generatedPrices.summary.avgSalary}
            </div>
          </div>
          <div>
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Max Salary</div>
            <div className={`text-2xl font-bold ${dynastyTheme.classes.text.success}`}>
              ${generatedPrices.summary.maxSalary}
            </div>
          </div>
          <div>
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>{'Players > $30'}</div>
            <div className={`text-2xl font-bold ${dynastyTheme.classes.text.warning}`}>
              {generatedPrices.summary.distribution?.over30 || 0}
            </div>
          </div>
          <div>
            <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Total Players</div>
            <div className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
              {generatedPrices.prices?.length || 0}
            </div>
          </div>
        </div>
        
        {/* Distribution Chart */}
        <div className="mt-6">
          <h4 className={`text-md font-semibold mb-3 ${dynastyTheme.classes.text.warning}`}>
            Price Distribution
          </h4>
          <div className="space-y-2">
            {getDistributionChart()?.map(range => (
              <div key={range.label} className="flex items-center gap-3">
                <div className={`w-20 text-right text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  {range.label}
                </div>
                <div className="flex-1 h-6 bg-gray-700 rounded relative overflow-hidden">
                  <div
                    className={`h-full ${range.color} transition-all duration-500`}
                    style={{ width: `${range.percentage}%` }}
                  />
                  <span className="absolute right-2 top-0 leading-6 text-xs text-white">
                    {range.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top 10 Players */}
        <div className="mt-6">
          <h4 className={`text-md font-semibold mb-3 ${dynastyTheme.classes.text.warning}`}>
            Top 10 Most Expensive Players
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {getTop10Players().map((player, idx) => (
              <div 
                key={player.player_id || idx}
                className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter} border ${dynastyTheme.classes.border.neutral}`}
              >
                <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>
                  #{idx + 1} • {player.position}
                </div>
                <div className={`text-sm font-semibold ${dynastyTheme.classes.text.white} truncate mb-1`}>
                  <Link 
                    to={`/player/${player.player_id || player.mlb_player_id}${leagueId ? `?leagueId=${leagueId}` : ''}`}
                    className="hover:text-blue-400 hover:underline"
                  >
                    {player.player_name}
                  </Link>
                </div>
                <div className={`text-lg font-bold ${dynastyTheme.classes.text.success}`}>
                  ${(player.salary || 0).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceDistributionSummary;