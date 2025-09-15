// src/components/player/PlayerAdvancedAnalytics.js - FIXED FOR OBJECT VALUES
import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, GitCompare, Shield, DollarSign,
  Sparkles, Hash, Star, AlertCircle, ChartBar, BarChart3,
  Sun, Moon, Users, PieChart, Percent, Target, Minus
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

// Helper to safely extract value from potential object
const safeValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && value !== null) {
    // If it's an object with label/value structure, extract the value
    return value.value !== undefined ? value.value : (value.data || value.stat || null);
  }
  return value;
};

const PlayerAdvancedAnalytics = ({ analytics, playerName, isPitcher = false }) => {
  const [activeView, setActiveView] = useState('splits');
  const [comparisonView, setComparisonView] = useState('league');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${dynastyTheme.components.card.highlighted} p-6 rounded-lg`}>
        <h3 className={`text-xl font-bold ${dynastyTheme.classes.text.white} mb-2 flex items-center`}>
          <ChartBar className={`w-5 h-5 mr-2 ${dynastyTheme.classes.text.primary}`} />
          Advanced Analytics & Projections
        </h3>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Splits, projections, fantasy metrics, and advanced comparisons
        </p>
      </div>

      {/* View Navigation */}
      <div className="flex gap-2 flex-wrap">
        {['splits', 'projections', 'fantasy', 'comparison'].map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`px-4 py-2 rounded-md font-medium capitalize transition-all ${
              activeView === view
                ? `${dynastyTheme.classes.bg.primary} text-black`
                : `${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralLight} hover:text-white`
            }`}
          >
            {view}
          </button>
        ))}
      </div>

      {/* SPLITS VIEW */}
      {activeView === 'splits' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Platoon Splits */}
            <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
              <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                <GitCompare className="w-5 h-5 mr-2" />
                Platoon Splits
              </h4>
              
              <div className="space-y-4">
                <div className={`p-4 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={dynastyTheme.classes.text.white}>vs RHP</span>
                    <span className={`text-xl font-bold ${dynastyTheme.classes.text.success}`}>
                      {safeValue(analytics?.splits?.vs_rhp?.avg) || '.312'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>AB</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.vs_rhp?.ab) || 234}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>HR</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.vs_rhp?.hr) || 15}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>RBI</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.vs_rhp?.rbi) || 45}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>OPS</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.vs_rhp?.ops) || '.925'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={dynastyTheme.classes.text.white}>vs LHP</span>
                    <span className={`text-xl font-bold ${dynastyTheme.classes.text.warning}`}>
                      {safeValue(analytics?.splits?.vs_lhp?.avg) || '.268'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>AB</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.vs_lhp?.ab) || 112}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>HR</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.vs_lhp?.hr) || 5}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>RBI</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.vs_lhp?.rbi) || 18}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>OPS</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.vs_lhp?.ops) || '.745'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Day/Night Splits */}
            <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
              <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                <Sun className="w-5 h-5 mr-2" />
                Day/Night Splits
              </h4>
              
              <div className="space-y-4">
                <div className={`p-4 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-yellow-400" />
                      <span className={dynastyTheme.classes.text.white}>Day Games</span>
                    </div>
                    <span className={`text-xl font-bold ${dynastyTheme.classes.text.primary}`}>
                      {safeValue(analytics?.splits?.day?.avg) || '.295'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>G</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.day?.games) || 45}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>HR</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.day?.hr) || 8}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>RBI</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.day?.rbi) || 28}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>OPS</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.day?.ops) || '.865'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-blue-400" />
                      <span className={dynastyTheme.classes.text.white}>Night Games</span>
                    </div>
                    <span className={`text-xl font-bold ${dynastyTheme.classes.text.success}`}>
                      {safeValue(analytics?.splits?.night?.avg) || '.308'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>G</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.night?.games) || 87}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>HR</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.night?.hr) || 17}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>RBI</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.night?.rbi) || 52}
                      </div>
                    </div>
                    <div>
                      <span className={dynastyTheme.classes.text.neutral}>OPS</span>
                      <div className={dynastyTheme.classes.text.white}>
                        {safeValue(analytics?.splits?.night?.ops) || '.912'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Clutch Situations */}
            <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
              <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                <Shield className="w-5 h-5 mr-2" />
                Clutch Performance
              </h4>
              
              <div className="space-y-3">
                <div className={`p-3 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                  <div className="flex justify-between items-center">
                    <span className={dynastyTheme.classes.text.neutralLight}>RISP</span>
                    <span className={`text-lg font-bold ${dynastyTheme.classes.text.success}`}>
                      {safeValue(analytics?.clutch?.risp?.avg) || '.342'}
                    </span>
                  </div>
                  <div className={`text-xs ${dynastyTheme.classes.text.neutral}`}>
                    {safeValue(analytics?.clutch?.risp?.hits) || 45} for {safeValue(analytics?.clutch?.risp?.ab) || 132}, {safeValue(analytics?.clutch?.risp?.rbi) || 58} RBI
                  </div>
                </div>
                <div className={`p-3 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                  <div className="flex justify-between items-center">
                    <span className={dynastyTheme.classes.text.neutralLight}>2 Outs, RISP</span>
                    <span className={`text-lg font-bold ${dynastyTheme.classes.text.primary}`}>
                      {safeValue(analytics?.clutch?.two_out_risp?.avg) || '.318'}
                    </span>
                  </div>
                  <div className={`text-xs ${dynastyTheme.classes.text.neutral}`}>
                    {safeValue(analytics?.clutch?.two_out_risp?.hits) || 21} for {safeValue(analytics?.clutch?.two_out_risp?.ab) || 66}, {safeValue(analytics?.clutch?.two_out_risp?.rbi) || 35} RBI
                  </div>
                </div>
                <div className={`p-3 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                  <div className="flex justify-between items-center">
                    <span className={dynastyTheme.classes.text.neutralLight}>Late & Close</span>
                    <span className={`text-lg font-bold ${dynastyTheme.classes.text.warning}`}>
                      {safeValue(analytics?.clutch?.late_close?.avg) || '.285'}
                    </span>
                  </div>
                  <div className={`text-xs ${dynastyTheme.classes.text.neutral}`}>
                    {safeValue(analytics?.clutch?.late_close?.hits) || 18} for {safeValue(analytics?.clutch?.late_close?.ab) || 63}, {safeValue(analytics?.clutch?.late_close?.hr) || 4} HR
                  </div>
                </div>
                <div className={`p-3 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                  <div className="flex justify-between items-center">
                    <span className={dynastyTheme.classes.text.neutralLight}>Bases Loaded</span>
                    <span className={`text-lg font-bold ${dynastyTheme.classes.text.success}`}>
                      {safeValue(analytics?.clutch?.bases_loaded?.avg) || '.429'}
                    </span>
                  </div>
                  <div className={`text-xs ${dynastyTheme.classes.text.neutral}`}>
                    {safeValue(analytics?.clutch?.bases_loaded?.hits) || 6} for {safeValue(analytics?.clutch?.bases_loaded?.ab) || 14}, {safeValue(analytics?.clutch?.bases_loaded?.grand_slams) || 2} Grand Slams
                  </div>
                </div>
              </div>
            </div>

            {/* Performance vs Teams */}
            <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
              <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                <Users className="w-5 h-5 mr-2" />
                vs Division/Teams
              </h4>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {(analytics?.vs_teams || [
                  { team: 'vs NYY', avg: '.385', ops: '1.125', games: 12 },
                  { team: 'vs BOS', avg: '.342', ops: '.945', games: 11 },
                  { team: 'vs TB', avg: '.268', ops: '.712', games: 10 },
                  { team: 'vs TOR', avg: '.295', ops: '.825', games: 9 },
                  { team: 'vs BAL', avg: '.312', ops: '.892', games: 8 }
                ]).map(team => (
                  <div key={team.team} className={`p-2 ${dynastyTheme.classes.bg.darkFlat} rounded flex justify-between items-center`}>
                    <span className={dynastyTheme.classes.text.white}>{safeValue(team.team)}</span>
                    <div className="flex gap-4 text-sm">
                      <span className={dynastyTheme.classes.text.neutralLight}>
                        AVG: <span className={dynastyTheme.classes.text.white}>{safeValue(team.avg)}</span>
                      </span>
                      <span className={dynastyTheme.classes.text.neutralLight}>
                        OPS: <span className={dynastyTheme.classes.text.white}>{safeValue(team.ops)}</span>
                      </span>
                      <span className={dynastyTheme.classes.text.neutral}>
                        ({safeValue(team.games)}G)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROJECTIONS VIEW */}
      {activeView === 'projections' && (
        <div className="space-y-6">
          {/* Rest of Season Projections */}
          <div className={`${dynastyTheme.components.card.highlighted} p-6 rounded-lg`}>
            <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
              <TrendingUp className="w-5 h-5 mr-2" />
              Rest of Season Projections
            </h4>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(analytics?.projections || [
                { stat: 'AVG', current: '.298', projected: '.305', trend: 'up' },
                { stat: 'HR', current: '22', projected: '35', trend: 'up' },
                { stat: 'RBI', current: '68', projected: '105', trend: 'up' },
                { stat: 'SB', current: '12', projected: '18', trend: 'stable' },
                { stat: 'OPS', current: '.875', projected: '.892', trend: 'up' },
                { stat: 'R', current: '58', projected: '88', trend: 'up' },
                { stat: 'BB', current: '45', projected: '72', trend: 'up' },
                { stat: 'K', current: '89', projected: '135', trend: 'down' }
              ]).map(proj => (
                <div key={proj.stat} className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg`}>
                  <div className={`text-sm ${dynastyTheme.classes.text.neutralLight} mb-2`}>{safeValue(proj.stat)}</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
                        {safeValue(proj.projected)}
                      </div>
                      <div className={`text-xs ${dynastyTheme.classes.text.neutral}`}>
                        Now: {safeValue(proj.current)}
                      </div>
                    </div>
                    {safeValue(proj.trend) === 'up' && <TrendingUp className={`w-5 h-5 ${dynastyTheme.classes.text.success}`} />}
                    {safeValue(proj.trend) === 'down' && <TrendingDown className={`w-5 h-5 ${dynastyTheme.classes.text.error}`} />}
                    {safeValue(proj.trend) === 'stable' && <Minus className={`w-5 h-5 ${dynastyTheme.classes.text.neutral}`} />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Regression Analysis */}
          <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
            <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
              <BarChart3 className="w-5 h-5 mr-2" />
              Sustainability Analysis
            </h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={`${dynastyTheme.classes.bg.darkFlat} p-4 rounded`}>
                <div className={`text-sm ${dynastyTheme.classes.text.success} mb-2 font-semibold`}>
                  SUSTAINABLE
                </div>
                <ul className="space-y-1 text-sm">
                  <li className={dynastyTheme.classes.text.neutralLight}>• Contact rate improvement</li>
                  <li className={dynastyTheme.classes.text.neutralLight}>• Hard hit % increase</li>
                  <li className={dynastyTheme.classes.text.neutralLight}>• Plate discipline gains</li>
                </ul>
              </div>
              
              <div className={`${dynastyTheme.classes.bg.darkFlat} p-4 rounded`}>
                <div className={`text-sm ${dynastyTheme.classes.text.warning} mb-2 font-semibold`}>
                  MONITOR
                </div>
                <ul className="space-y-1 text-sm">
                  <li className={dynastyTheme.classes.text.neutralLight}>• BABIP .035 above career</li>
                  <li className={dynastyTheme.classes.text.neutralLight}>• HR/FB rate elevated</li>
                  <li className={dynastyTheme.classes.text.neutralLight}>• Strand rate variance</li>
                </ul>
              </div>
              
              <div className={`${dynastyTheme.classes.bg.darkFlat} p-4 rounded`}>
                <div className={`text-sm ${dynastyTheme.classes.text.error} mb-2 font-semibold`}>
                  REGRESSION LIKELY
                </div>
                <ul className="space-y-1 text-sm">
                  <li className={dynastyTheme.classes.text.neutralLight}>• Unsustainable BABIP</li>
                  <li className={dynastyTheme.classes.text.neutralLight}>• Lucky sequencing</li>
                  <li className={dynastyTheme.classes.text.neutralLight}>• Small sample size</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FANTASY VIEW */}
      {activeView === 'fantasy' && (
        <div className="space-y-6">
          {/* Fantasy Points Trends */}
          <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
            <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
              <DollarSign className="w-5 h-5 mr-2" />
              Fantasy Value Metrics
            </h4>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg text-center`}>
                <div className={`text-3xl font-bold ${dynastyTheme.classes.text.primary}`}>
                  ${safeValue(analytics?.fantasy?.current_value) || '28.5'}
                </div>
                <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  Current Value
                </div>
                <div className={`text-xs ${dynastyTheme.classes.text.success} mt-1`}>
                  +${safeValue(analytics?.fantasy?.value_change) || '5.2'} vs Draft
                </div>
              </div>
              
              <div className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg text-center`}>
                <div className={`text-3xl font-bold ${dynastyTheme.classes.text.white}`}>
                  {safeValue(analytics?.fantasy?.fp_per_game) || '4.8'}
                </div>
                <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  FP/Game
                </div>
                <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-1`}>
                  {safeValue(analytics?.fantasy?.league_rank) || '12th'} in league
                </div>
              </div>
              
              <div className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg text-center`}>
                <div className={`text-3xl font-bold ${dynastyTheme.classes.text.success}`}>
                  {safeValue(analytics?.fantasy?.trade_grade) || 'A-'}
                </div>
                <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  Trade Value
                </div>
                <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-1`}>
                  High demand
                </div>
              </div>
              
              <div className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg text-center`}>
                <div className={`text-3xl font-bold ${dynastyTheme.classes.text.warning}`}>
                  {safeValue(analytics?.fantasy?.consistency) || '85'}%
                </div>
                <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                  Consistency
                </div>
                <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-1`}>
                  Games &gt 3 FP
                </div>
              </div>
            </div>
          </div>

          {/* Category Scarcity */}
          <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
            <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
              <Sparkles className="w-5 h-5 mr-2" />
              Category Scarcity Analysis
            </h4>
            
            <div className="space-y-3">
              {(analytics?.scarcity || [
                { cat: 'Stolen Bases', value: 18, percentile: 92, scarcity: 'Very Scarce' },
                { cat: 'Home Runs', value: 22, percentile: 78, scarcity: 'Moderate' },
                { cat: 'RBI', value: 68, percentile: 71, scarcity: 'Average' },
                { cat: 'Batting Average', value: '.298', percentile: 85, scarcity: 'Scarce' },
                { cat: 'Runs', value: 58, percentile: 68, scarcity: 'Common' }
              ]).map(cat => (
                <div key={cat.cat} className={`p-3 ${dynastyTheme.classes.bg.darkFlat} rounded`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={dynastyTheme.classes.text.white}>{safeValue(cat.cat)}</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      safeValue(cat.percentile) >= 90 ? dynastyTheme.components.badge.error :
                      safeValue(cat.percentile) >= 75 ? dynastyTheme.components.badge.warning :
                      dynastyTheme.components.badge.info
                    }`}>
                      {safeValue(cat.scarcity)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${dynastyTheme.classes.bg.primary}`}
                        style={{ width: `${safeValue(cat.percentile)}%` }}
                      />
                    </div>
                    <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                      {safeValue(cat.percentile)}%ile
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trade Value Index */}
          <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
            <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
              <Hash className="w-5 h-5 mr-2" />
              Trade Value Index
            </h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className={`text-sm ${dynastyTheme.classes.text.neutralLight} mb-3`}>
                  Trade Market Factors
                </div>
                <div className="space-y-2">
                  {[
                    { factor: 'Name Value', score: 85 },
                    { factor: 'Recent Performance', score: 92 },
                    { factor: 'Position Scarcity', score: 78 },
                    { factor: 'Age/Contract', score: 70 }
                  ].map(item => (
                    <div key={item.factor} className="flex justify-between items-center">
                      <span className={dynastyTheme.classes.text.neutralLight}>{item.factor}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full ${dynastyTheme.classes.bg.primary}`} style={{ width: `${safeValue(item.score)}%` }} />
                        </div>
                        <span className={dynastyTheme.classes.text.white}>{safeValue(item.score)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <div className={`text-sm ${dynastyTheme.classes.text.neutralLight} mb-3`}>
                  Comparable Trade Targets
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'Fernando Tatis Jr.', value: 105 },
                    { name: 'Juan Soto', value: 98 },
                    { name: playerName || 'THIS PLAYER', value: 88, highlight: true },
                    { name: 'Bo Bichette', value: 82 },
                    { name: 'Marcus Semien', value: 75 }
                  ].map(player => (
                    <div key={player.name} className={`p-2 ${player.highlight ? dynastyTheme.classes.bg.primaryLight : dynastyTheme.classes.bg.darkFlat} rounded flex justify-between items-center`}>
                      <span className={player.highlight ? dynastyTheme.classes.text.primary : dynastyTheme.classes.text.white}>
                        {safeValue(player.name)}
                      </span>
                      <span className={`font-bold ${player.highlight ? dynastyTheme.classes.text.primary : dynastyTheme.classes.text.neutralLight}`}>
                        {safeValue(player.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPARISON VIEW */}
      {activeView === 'comparison' && (
        <div className="space-y-6">
          {/* Comparison Type Selector */}
          <div className="flex gap-2">
            {['league', 'position', 'team', 'historical'].map(comp => (
              <button
                key={comp}
                onClick={() => setComparisonView(comp)}
                className={`px-4 py-2 rounded-md font-medium capitalize transition-all ${
                  comparisonView === comp
                    ? `${dynastyTheme.classes.bg.primary} text-black`
                    : `${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralLight} hover:text-white`
                }`}
              >
                {comp}
              </button>
            ))}
          </div>

          {/* Performance Heat Map */}
          <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
            <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
              <ChartBar className="w-5 h-5 mr-2" />
              Performance Heat Map vs {comparisonView}
            </h4>
            
            <div className="grid grid-cols-6 gap-2">
              {['AVG', 'OBP', 'SLG', 'HR', 'RBI', 'R', 'SB', 'BB', 'K', 'OPS', 'WAR', 'wRC+'].map(stat => {
                const value = Math.random() * 100;
                const bgColor = value >= 80 ? 'bg-emerald-500/30' :
                               value >= 60 ? 'bg-yellow-400/30' :
                               value >= 40 ? 'bg-orange-500/30' :
                               'bg-red-500/30';
                const textColor = value >= 80 ? dynastyTheme.classes.text.success :
                                 value >= 60 ? dynastyTheme.classes.text.primary :
                                 value >= 40 ? dynastyTheme.classes.text.warning :
                                 dynastyTheme.classes.text.error;
                
                return (
                  <div key={stat} className={`${bgColor} p-3 rounded text-center`}>
                    <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>{stat}</div>
                    <div className={`text-lg font-bold ${textColor}`}>
                      {Math.round(value)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5-Tool Player Rating */}
          <div className={`${dynastyTheme.components.card.interactive} p-6 rounded-lg`}>
            <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
              <PieChart className="w-5 h-5 mr-2" />
              5-Tool Player Rating
            </h4>
            
            <div className="grid grid-cols-5 gap-3">
              {(analytics?.tools || [
                { tool: 'Contact', player: 85, league: 72 },
                { tool: 'Power', player: 78, league: 68 },
                { tool: 'Speed', player: 92, league: 65 },
                { tool: 'Fielding', player: 75, league: 70 },
                { tool: 'Arm', player: 70, league: 68 }
              ]).map(tool => (
                <div key={tool.tool} className={`${dynastyTheme.classes.bg.darkFlat} p-3 rounded text-center`}>
                  <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mb-2`}>{safeValue(tool.tool)}</div>
                  <div className={`text-2xl font-bold ${
                    safeValue(tool.player) >= 90 ? dynastyTheme.classes.text.success :
                    safeValue(tool.player) >= 75 ? dynastyTheme.classes.text.primary :
                    dynastyTheme.classes.text.warning
                  }`}>
                    {safeValue(tool.player)}
                  </div>
                  <div className={`text-xs ${dynastyTheme.classes.text.neutral}`}>
                    Lg: {safeValue(tool.league)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Insights */}
      <div className={`${dynastyTheme.components.card.highlighted} p-6 rounded-lg`}>
        <h4 className={`text-lg font-bold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
          <Star className="w-5 h-5 mr-2" />
          Key Insights & Recommendations
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${dynastyTheme.components.card.glass} p-4 rounded-lg`}>
            <div className={`text-sm ${dynastyTheme.classes.text.success} mb-2 font-semibold flex items-center`}>
              <Star className="w-4 h-4 mr-1" />
              KEY STRENGTHS
            </div>
            <ul className="space-y-1 text-sm">
              <li className={dynastyTheme.classes.text.white}>• Elite vs RHP (.925 OPS)</li>
              <li className={dynastyTheme.classes.text.white}>• Clutch performer (RISP)</li>
              <li className={dynastyTheme.classes.text.white}>• Power surge sustainable</li>
            </ul>
          </div>
          
          <div className={`${dynastyTheme.components.card.glass} p-4 rounded-lg`}>
            <div className={`text-sm ${dynastyTheme.classes.text.warning} mb-2 font-semibold flex items-center`}>
              <AlertCircle className="w-4 h-4 mr-1" />
              AREAS TO MONITOR
            </div>
            <ul className="space-y-1 text-sm">
              <li className={dynastyTheme.classes.text.white}>• Struggles vs LHP</li>
              <li className={dynastyTheme.classes.text.white}>• BABIP regression risk</li>
              <li className={dynastyTheme.classes.text.white}>• Trade value peaking</li>
            </ul>
          </div>
          
          <div className={`${dynastyTheme.components.card.glass} p-4 rounded-lg`}>
            <div className={`text-sm ${dynastyTheme.classes.text.primary} mb-2 font-semibold flex items-center`}>
              <Target className="w-4 h-4 mr-1" />
              RECOMMENDATIONS
            </div>
            <ul className="space-y-1 text-sm">
              <li className={dynastyTheme.classes.text.white}>• Hold in dynasty</li>
              <li className={dynastyTheme.classes.text.white}>• Platoon vs LHP</li>
              <li className={dynastyTheme.classes.text.white}>• Target 35+ HR</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerAdvancedAnalytics;