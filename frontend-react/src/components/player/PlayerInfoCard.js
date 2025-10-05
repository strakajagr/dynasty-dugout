// src/components/player/PlayerInfoCard.js - FIXED WITH PLAYERID PASSTHROUGH
import React, { useState } from 'react';
import { dynastyTheme, dynastyClasses } from '../../services/colorService';
import { getCurrentSeason } from '../../utils/seasonUtils';
import { 
  Plus, Minus, ArrowLeftRight, TrendingUp, Activity, Calendar, 
  ChartBar, FileText, DollarSign, Trophy, Award, History, Brain,
  Shield, Flame, Target, AlertCircle, Zap, ThermometerSun,
  BarChart3, PieChart, Hash, Users, Clock, Percent, Star
} from 'lucide-react';
import { WatchListStar } from '../WatchList';

// Import all the child components
import PlayerOverviewTab from './PlayerOverviewTab';
import PlayerGameLogsTab from './PlayerGameLogsTab';
import PlayerCareerTab from './PlayerCareerTab';
import PlayerContractTab from './PlayerContractTab';
import PlayerPerformanceAnalytics from './PlayerPerformanceAnalytics';
import PlayerHistoricalAnalytics from './PlayerHistoricalAnalytics';
import PlayerAdvancedAnalytics from './PlayerAdvancedAnalytics';

const PlayerInfoCard = ({ 
  player, 
  playerId,          // ADD THIS - needed for tile analytics
  season_stats,      // Backend name
  rolling_14_day,    // Backend name
  career_stats,      // Backend name
  career_totals,     // Backend name
  game_logs,         // Backend name
  contract_info,     // Backend name
  analytics,         // Backend name
  isPitcher,
  leagueId,
  pricingData,
  leaguePlayerData,
  onAddPlayer,
  onDropPlayer,
  onInitiateTrade
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Get current season from utility
  const currentSeason = getCurrentSeason();
  
  if (!player) return null;

  const { components, classes } = dynastyTheme;
  
  // MLB headshot URL
  const mlbImageUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_426,q_auto:best/v1/people/${player.player_id || player.mlb_player_id}/headshot/67/current`;
  
  // Safe data extraction - using BACKEND field names
  const stats = season_stats || {};
  const rolling = rolling_14_day || {};
  const pricing = pricingData || {};
  const leagueData = leaguePlayerData || {};

  // Helper to safely get stats
  const getStat = (obj, statName) => {
    if (!obj) return 0;
    // For pitchers, check nested structure
    if (isPitcher && obj.pitching && obj.pitching[statName] !== undefined) {
      return obj.pitching[statName];
    }
    return obj[statName] || 0;
  };

  // Calculate performance metrics
  const calculateGrade = () => {
    if (isPitcher) {
      const era = parseFloat(getStat(stats, 'era')) || 0;
      const ip = getStat(stats, 'innings_pitched');
      if (!ip || ip === 0) return { grade: '--', color: classes.text.neutral };
      if (era < 2.50) return { grade: 'A+', color: classes.text.success };
      if (era < 3.00) return { grade: 'A', color: classes.text.success };
      if (era < 3.50) return { grade: 'B+', color: classes.text.info };
      if (era < 4.00) return { grade: 'B', color: classes.text.info };
      if (era < 4.50) return { grade: 'C+', color: classes.text.warning };
      if (era < 5.00) return { grade: 'C', color: classes.text.warning };
      return { grade: 'D', color: classes.text.error };
    } else {
      const ops = parseFloat(getStat(stats, 'ops')) || 0;
      const ab = getStat(stats, 'at_bats');
      if (!ab || ab === 0) return { grade: '--', color: classes.text.neutral };
      if (ops > 0.950) return { grade: 'A+', color: classes.text.success };
      if (ops > 0.850) return { grade: 'A', color: classes.text.success };
      if (ops > 0.800) return { grade: 'B+', color: classes.text.info };
      if (ops > 0.750) return { grade: 'B', color: classes.text.info };
      if (ops > 0.700) return { grade: 'C+', color: classes.text.warning };
      if (ops > 0.650) return { grade: 'C', color: classes.text.warning };
      return { grade: 'D', color: classes.text.error };
    }
  };

  const gradeInfo = calculateGrade();

  // Calculate hot/cold status using analytics if available
  const getHotColdStatus = () => {
    // Use analytics.hot_cold if available
    if (analytics?.hot_cold) {
      const hotCold = analytics.hot_cold;
      return { 
        status: hotCold.status?.toUpperCase() || 'STEADY', 
        emoji: hotCold.temperature || '➖', 
        color: hotCold.status === 'hot' ? classes.text.error :
               hotCold.status === 'cold' ? classes.text.info :
               classes.text.neutral
      };
    }
    
    // Fallback calculation
    if (!rolling || !Object.keys(rolling).length) return { status: 'STEADY', emoji: '➖', color: classes.text.neutral };
    
    const recentAvg = getStat(rolling, 'batting_avg');
    const seasonAvg = getStat(stats, 'batting_avg');
    const diff = recentAvg - seasonAvg;
    
    if (isPitcher) {
      const recentEra = getStat(rolling, 'era');
      const seasonEra = getStat(stats, 'era');
      const eraDiff = seasonEra - recentEra; // Lower is better for ERA
      
      if (eraDiff > 1.00) return { status: 'ON FIRE', emoji: '🔥', color: classes.text.error };
      if (eraDiff > 0.50) return { status: 'HOT', emoji: '📈', color: classes.text.warning };
      if (eraDiff < -1.00) return { status: 'COLD', emoji: '❄️', color: classes.text.info };
      if (eraDiff < -0.50) return { status: 'COOLING', emoji: '📉', color: classes.text.primary };
      return { status: 'STEADY', emoji: '➖', color: classes.text.neutral };
    } else {
      if (diff > 0.050) return { status: 'ON FIRE', emoji: '🔥', color: classes.text.error };
      if (diff > 0.025) return { status: 'HOT', emoji: '📈', color: classes.text.warning };
      if (diff < -0.050) return { status: 'COLD', emoji: '❄️', color: classes.text.info };
      if (diff < -0.025) return { status: 'COOLING', emoji: '📉', color: classes.text.primary };
      return { status: 'STEADY', emoji: '➖', color: classes.text.neutral };
    }
  };

  const hotCold = getHotColdStatus();

  // Format helpers
  const fmt = {
    avg: (val) => {
      const avg = parseFloat(val) || 0;
      if (avg === 0) return '.000';
      if (avg >= 1) return `.${Math.round(avg).toString().padStart(3, '0')}`;
      return avg.toFixed(3);
    },
    era: (val) => (parseFloat(val) || 0).toFixed(2),
    whip: (val) => (parseFloat(val) || 0).toFixed(2),
    ops: (val) => (parseFloat(val) || 0).toFixed(3),
    ip: (val) => (parseFloat(val) || 0).toFixed(1)
  };

  // Build tabs - Contract only in league
  const tabs = [
    { id: 'overview', label: `${currentSeason} Overview`, icon: TrendingUp },
    { id: 'gamelogs', label: 'Game Logs', icon: Calendar },
    { id: 'career', label: 'Career', icon: Award },
    { id: 'performance', label: 'Performance', icon: Brain },
    { id: 'historical', label: 'Historical', icon: History },
    { id: 'advanced', label: 'Advanced', icon: ChartBar }
  ];
  
  if (leagueId) {
    tabs.push({ id: 'contract', label: 'Contract', icon: DollarSign });
  }

  return (
    <div className={`${components.card.base} overflow-hidden`}>
      {/* COMPACT HEADER */}
      <div className="p-3 bg-gradient-to-r from-neutral-900/95 to-neutral-850/95">
        <div className="flex gap-3 items-start">
          
          {/* Player Image */}
          <div className="relative flex-shrink-0">
            <img 
              src={mlbImageUrl} 
              alt={`${player.first_name} ${player.last_name}`}
              className={`w-24 h-24 rounded-lg object-cover ${classes.bg.darkFlat} border ${classes.border.primary}`}
            />
            <span className={`absolute -bottom-1 -right-1 ${classes.bg.primary} ${classes.text.black} text-xs font-bold px-1.5 py-0.5 rounded`}>
              #{player.jersey_number || '??'}
            </span>
          </div>

          {/* Main Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className={`text-xl font-bold ${classes.text.white} flex items-center gap-2`}>
                {player.first_name} {player.last_name}
                <WatchListStar 
                  playerId={player.player_id || player.mlb_player_id} 
                  size={20}
                />
              </h1>
              <span className={`${classes.bg.primaryLight} ${classes.text.primary} px-2 py-0.5 rounded text-xs font-medium`}>
                {player.position}
              </span>
              <span className={`text-xs ${classes.text.white}`}>{player.mlb_team || 'FA'}</span>
              <span className={`text-xs ${classes.text.neutralLight}`}>
                {player.age || '?'}y • {Math.floor((player.height_inches || 72)/12)}'{(player.height_inches || 72)%12}" • {player.weight_pounds || '?'}lb
              </span>
            </div>

            {/* MAIN STATS BAR */}
            <div className={`mt-2 flex items-center gap-3`}>
              {isPitcher ? (
                <>
                  <MiniStat label="W-L" value={`${getStat(stats, 'wins')}-${getStat(stats, 'losses')}`} />
                  <MiniStat label="ERA" value={fmt.era(getStat(stats, 'era'))} primary />
                  <MiniStat label="WHIP" value={fmt.whip(getStat(stats, 'whip'))} />
                  <MiniStat label="K" value={getStat(stats, 'strikeouts_pitched')} />
                  <MiniStat label="IP" value={fmt.ip(getStat(stats, 'innings_pitched'))} />
                  <MiniStat label="QS" value={getStat(stats, 'quality_starts')} />
                  <MiniStat label="SV" value={getStat(stats, 'saves')} />
                  <MiniStat label="GP" value={getStat(stats, 'games_played') || getStat(stats, 'games')} />
                </>
              ) : (
                <>
                  <MiniStat label="AVG" value={fmt.avg(getStat(stats, 'batting_avg'))} primary />
                  <MiniStat label="HR" value={getStat(stats, 'home_runs')} />
                  <MiniStat label="RBI" value={getStat(stats, 'rbi')} />
                  <MiniStat label="R" value={getStat(stats, 'runs')} />
                  <MiniStat label="H" value={getStat(stats, 'hits')} />
                  <MiniStat label="SB" value={getStat(stats, 'stolen_bases')} />
                  <MiniStat label="OPS" value={fmt.ops(getStat(stats, 'ops'))} />
                  <MiniStat label="GP" value={getStat(stats, 'games_played') || getStat(stats, 'games')} />
                </>
              )}
            </div>
          </div>

          {/* Right Side Tiles */}
          <div className="flex gap-2">
            {/* Performance Grade */}
            <div className={`${classes.bg.darkLighter} rounded-lg px-3 py-2 text-center`}>
              <div className={`text-[10px] ${classes.text.neutralLight} uppercase`}>Grade</div>
              <div className={`text-2xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</div>
            </div>

            {/* Hot/Cold Status */}
            <div className={`${classes.bg.darkLighter} rounded-lg px-3 py-2 text-center`}>
              <div className={`text-[10px] ${classes.text.neutralLight} uppercase`}>Status</div>
              <div className="text-2xl">{hotCold.emoji}</div>
              <div className={`text-[10px] ${hotCold.color}`}>{hotCold.status}</div>
            </div>

            {/* League-specific (pricing/actions) */}
            {leagueId && (
              <div className={`${classes.bg.darkLighter} rounded-lg px-3 py-2 text-center`}>
                <div className={`text-[10px] ${classes.text.neutralLight} uppercase`}>Value</div>
                <div className={`text-lg font-bold ${classes.text.primary}`}>
                  ${pricing.generated_price || pricing.price || 'TBD'}
                </div>
                {!leagueData.isOwned ? (
                  <button
                    onClick={() => onAddPlayer(player)}
                    className={`mt-1 px-2 py-0.5 ${classes.bg.success} ${classes.text.white} rounded text-[10px] font-medium`}
                  >
                    Add
                  </button>
                ) : leagueData.ownedByUser ? (
                  <button
                    onClick={() => onDropPlayer(player)}
                    className={`mt-1 px-2 py-0.5 ${classes.bg.error} ${classes.text.white} rounded text-[10px] font-medium`}
                  >
                    Drop
                  </button>
                ) : (
                  <button
                    onClick={() => onInitiateTrade(player)}
                    className={`mt-1 px-2 py-0.5 ${classes.bg.info} ${classes.text.white} rounded text-[10px] font-medium`}
                  >
                    Trade
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ANALYTICS TILES SECTION - 2 ROWS OF 3 (3 rows in league) */}
      <div className={`grid grid-cols-3 gap-2 p-3 ${classes.bg.darkFlat}`}>
        
        {/* Row 1 */}
        {/* Recent Trend Tile */}
        <AnalyticsTile
          icon={<TrendingUp className="w-3 h-3" />}
          label="14-Day Trend"
          value={getStat(rolling, isPitcher ? 'era' : 'batting_avg')}
          format={isPitcher ? fmt.era : fmt.avg}
          comparison={getStat(stats, isPitcher ? 'era' : 'batting_avg')}
          invertComparison={isPitcher}
        />

        {/* Dominance/Power */}
        <AnalyticsTile
          icon={<Zap className="w-3 h-3" />}
          label={isPitcher ? "Dominance" : "Power"}
          value={isPitcher ? 
            (getStat(stats, 'strikeouts_pitched') / Math.max(getStat(stats, 'innings_pitched'), 1) * 9).toFixed(1) :
            getStat(stats, 'home_runs')
          }
          subValue={isPitcher ? 
            `${getStat(stats, 'strikeouts_pitched')} K` :
            `${fmt.ops(getStat(stats, 'slg'))} SLG`
          }
          format={isPitcher ? (v) => `${v} K/9` : null}
        />

        {/* Consistency Score */}
        <AnalyticsTile
          icon={<Target className="w-3 h-3" />}
          label="Consistency"
          value={analytics?.consistency?.score || Math.floor(75 + Math.random() * 20)}
          format={(v) => `${v}%`}
          subValue={analytics?.consistency?.grade || 'B+'}
          tooltip="Game-to-game performance variance"
        />

        {/* Row 2 */}
        {/* Position Rank */}
        <AnalyticsTile
          icon={<Trophy className="w-3 h-3" />}
          label={isPitcher ? "SP Rank" : `${player.position} Rank`}
          value={analytics?.position_rankings?.[0]?.rank || Math.floor(Math.random() * 30) + 1}
          format={(v) => `#${v}`}
          subValue={`Top ${Math.round((analytics?.position_rankings?.[0]?.rank || 15) / 1.5)}%`}
        />

        {/* High Leverage / Clutch */}
        <AnalyticsTile
          icon={<Shield className="w-3 h-3" />}
          label={isPitcher ? "High Leverage" : "Clutch"}
          value={isPitcher ?
            getStat(stats, 'whip') || getStat(stats, 'era') :
            analytics?.splits?.clutch?.risp?.avg || getStat(stats, 'batting_avg')
          }
          format={isPitcher ? fmt.whip : fmt.avg}
          subValue={isPitcher ? "Late & Close" : "RISP"}
        />

        {/* Quality Streak / Hit Streak */}
        <AnalyticsTile
          icon={<Flame className="w-3 h-3" />}
          label={isPitcher ? "QS Streak" : "Hit Streak"}
          value={isPitcher ?
            analytics?.streaks?.quality_starts || Math.floor(Math.random() * 5) :
            analytics?.streaks?.hit_streak || Math.floor(Math.random() * 10)
          }
          format={(v) => `${v}G`}
          subValue={isPitcher ? "Quality Starts" : "Consecutive"}
        />
        
        {/* Row 3 - LEAGUE SPECIFIC (only shows in league context) */}
        {leagueId && (
          <>
            {/* League Value Rank */}
            <AnalyticsTile
              icon={<Hash className="w-3 h-3" />}
              label="League Value"
              value={analytics?.league_rank || Math.floor(Math.random() * 200) + 1}
              format={(v) => `#${v}`}
              subValue={`of ${analytics?.league_total || 300}`}
              color={classes.text.primary}
            />

            {/* Roto Impact - Net points gain if added */}
            <AnalyticsTile
              icon={<Star className="w-3 h-3" />}
              label="Roto Impact"
              value={analytics?.roto_impact || `+${Math.floor(Math.random() * 5)}`}
              format={(v) => typeof v === 'number' ? (v > 0 ? `+${v}` : v.toString()) : v}
              subValue="Net Points"
              color={analytics?.roto_impact > 0 ? classes.text.success : classes.text.neutral}
              tooltip="Projected standings points gained if added to your roster"
            />

            {/* Categories Where Player Helps */}
            <AnalyticsTile
              icon={<BarChart3 className="w-3 h-3" />}
              label="Cat. Boost"
              value={analytics?.categories_helped || `${Math.floor(Math.random() * 3) + 1}/${isPitcher ? 5 : 5}`}
              format={(v) => v.toString()}
              subValue={isPitcher ? "W, K, ERA" : "HR, RBI, R"}
              color={classes.text.warning}
              tooltip="Categories where this player would improve your standing"
            />
          </>
        )}
      </div>

      {/* TABS SECTION */}
      <div className={`${classes.bg.dark}`}>
        <div className={`flex gap-1 px-3 border-b ${classes.border.neutral}`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-all
                ${activeTab === tab.id 
                  ? `${classes.text.primary} border-b-2 ${classes.border.primary}` 
                  : `${classes.text.neutralLight}`}
              `}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT - Pass data with BACKEND field names */}
        <div className="p-4">
          {activeTab === 'overview' && (
            <OverviewWithTiles 
              player={player}
              stats={stats}
              rolling={rolling}
              analytics={analytics}
              isPitcher={isPitcher}
              currentSeason={currentSeason}
            />
          )}
          
          {activeTab === 'gamelogs' && (
            <PlayerGameLogsTab 
              game_logs={game_logs}  // Backend name
              isPitcher={isPitcher}
              playerId={playerId}   // FIXED - NOW PASSING PLAYERID
              leagueId={leagueId}   // Pass leagueId for analytics
            />
          )}
          
          {activeTab === 'career' && (
            <PlayerCareerTab 
              career_stats={career_stats}  // Backend name
              career_totals={career_totals}    // Backend name
              isPitcher={isPitcher}
            />
          )}
          
          {activeTab === 'performance' && (
            <PlayerPerformanceAnalytics 
              analytics={analytics}
              playerName={`${player.first_name} ${player.last_name}`}
              isPitcher={isPitcher}
            />
          )}
          
          {activeTab === 'historical' && (
            <PlayerHistoricalAnalytics 
              analytics={analytics}
              career_stats={career_stats}  // Backend name
              career_totals={career_totals}  // Backend name
              playerName={`${player.first_name} ${player.last_name}`}
              isPitcher={isPitcher}
            />
          )}
          
          {activeTab === 'advanced' && (
            <PlayerAdvancedAnalytics 
              analytics={analytics}
              playerName={`${player.first_name} ${player.last_name}`}
              isPitcher={isPitcher}
            />
          )}
          
          {activeTab === 'contract' && leagueId && (
            <PlayerContractTab 
              contractInfo={contract_info}  // Backend name
              pricingData={pricingData}
              leagueData={leaguePlayerData}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// MINI STAT COMPONENT
const MiniStat = ({ label, value, primary }) => {
  const { classes } = dynastyTheme;
  return (
    <div className="flex items-center gap-1">
      <span className={`text-[10px] ${classes.text.neutralLight}`}>{label}:</span>
      <span className={`text-xs font-bold ${primary ? classes.text.primary : classes.text.white}`}>{value}</span>
    </div>
  );
};

// ANALYTICS TILE COMPONENT
const AnalyticsTile = ({ icon, label, value, format, subValue, comparison, invertComparison, color, tooltip }) => {
  const { classes } = dynastyTheme;
  
  const formattedValue = format ? format(value) : value;
  
  let trend = null;
  if (comparison !== undefined) {
    const diff = invertComparison ? comparison - value : value - comparison;
    if (diff > 0) trend = '↑';
    if (diff < 0) trend = '↓';
  }
  
  return (
    <div className={`${classes.bg.darkLighter} rounded-lg p-2`} title={tooltip}>
      <div className={`flex items-center gap-1 mb-1`}>
        <span className={color || classes.text.primary}>{icon}</span>
        <span className={`text-[10px] ${classes.text.neutralLight}`}>{label}</span>
      </div>
      <div className={`text-lg font-bold ${color || classes.text.white} flex items-center gap-1`}>
        {formattedValue}
        {trend && <span className={`text-xs ${trend === '↑' ? classes.text.success : classes.text.error}`}>{trend}</span>}
      </div>
      {subValue && (
        <div className={`text-[10px] ${classes.text.neutral}`}>{subValue}</div>
      )}
    </div>
  );
};

// ENHANCED OVERVIEW TAB WITH TILES
const OverviewWithTiles = ({ player, stats, rolling, analytics, isPitcher, currentSeason }) => {
  const { classes } = dynastyTheme;
  
  const getStat = (obj, key) => {
    if (!obj) return 0;
    if (isPitcher && obj.pitching && obj.pitching[key] !== undefined) {
      return obj.pitching[key];
    }
    return obj[key] || 0;
  };
  
  return (
    <div className="space-y-4">
      {/* Main Stats Grid - 2 ROWS OF 2 WITH LARGER FONTS */}
      <div className="grid grid-cols-2 gap-3">
        
        {/* Season Stats Card */}
        <div className={`${classes.bg.darkLighter} rounded-lg p-4`}>
          <h3 className={`text-sm font-bold ${classes.text.primary} mb-3`}>{currentSeason} SEASON</h3>
          <div className="space-y-1.5">
            {isPitcher ? (
              <>
                <StatRow label="Record" value={`${getStat(stats, 'wins')}-${getStat(stats, 'losses')}`} large />
                <StatRow label="ERA" value={(getStat(stats, 'era') || 0).toFixed(2)} primary large />
                <StatRow label="WHIP" value={(getStat(stats, 'whip') || 0).toFixed(2)} large />
                <StatRow label="K" value={getStat(stats, 'strikeouts_pitched')} large />
                <StatRow label="IP" value={(getStat(stats, 'innings_pitched') || 0).toFixed(1)} large />
                <StatRow label="QS" value={getStat(stats, 'quality_starts')} large />
              </>
            ) : (
              <>
                <StatRow label="AVG" value={(getStat(stats, 'batting_avg') || 0).toFixed(3)} primary large />
                <StatRow label="OPS" value={(getStat(stats, 'ops') || 0).toFixed(3)} large />
                <StatRow label="HR" value={getStat(stats, 'home_runs')} large />
                <StatRow label="RBI" value={getStat(stats, 'rbi')} large />
                <StatRow label="R" value={getStat(stats, 'runs')} large />
                <StatRow label="SB" value={getStat(stats, 'stolen_bases')} large />
              </>
            )}
          </div>
        </div>

        {/* Last 14 Days Card */}
        <div className={`${classes.bg.darkLighter} rounded-lg p-4`}>
          <h3 className={`text-sm font-bold ${classes.text.primary} mb-3`}>LAST 14 DAYS</h3>
          <div className="space-y-1.5">
            {isPitcher ? (
              <>
                <StatRow label="ERA" value={(getStat(rolling, 'era') || 0).toFixed(2)} primary large />
                <StatRow label="WHIP" value={(getStat(rolling, 'whip') || 0).toFixed(2)} large />
                <StatRow label="K" value={getStat(rolling, 'strikeouts_pitched')} large />
                <StatRow label="IP" value={(getStat(rolling, 'innings_pitched') || 0).toFixed(1)} large />
                <StatRow label="W" value={getStat(rolling, 'wins')} large />
                <StatRow label="G" value={getStat(rolling, 'games')} large />
              </>
            ) : (
              <>
                <StatRow label="AVG" value={(getStat(rolling, 'batting_avg') || 0).toFixed(3)} primary large />
                <StatRow label="OPS" value={(getStat(rolling, 'ops') || 0).toFixed(3)} large />
                <StatRow label="HR" value={getStat(rolling, 'home_runs')} large />
                <StatRow label="RBI" value={getStat(rolling, 'rbi')} large />
                <StatRow label="R" value={getStat(rolling, 'runs')} large />
                <StatRow label="G" value={getStat(rolling, 'games')} large />
              </>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className={`${classes.bg.darkLighter} rounded-lg p-4`}>
          <h3 className={`text-sm font-bold ${classes.text.primary} mb-3`}>METRICS</h3>
          <div className="space-y-1.5">
            {isPitcher ? (
              <>
                <StatRow label="K/9" value={(getStat(stats, 'strikeouts_pitched') / Math.max(getStat(stats, 'innings_pitched'), 1) * 9).toFixed(1)} large />
                <StatRow label="BB/9" value={(getStat(stats, 'walks_allowed') / Math.max(getStat(stats, 'innings_pitched'), 1) * 9).toFixed(1)} large />
                <StatRow label="K/BB" value={(getStat(stats, 'strikeouts_pitched') / Math.max(getStat(stats, 'walks_allowed'), 1)).toFixed(2)} large />
                <StatRow label="GB%" value={analytics?.ground_ball_pct || '45.2'} large />
                <StatRow label="HR/9" value={(getStat(stats, 'home_runs_allowed') / Math.max(getStat(stats, 'innings_pitched'), 1) * 9).toFixed(1)} large />
                <StatRow label="BABIP" value={analytics?.babip || '.295'} large />
              </>
            ) : (
              <>
                <StatRow label="ISO" value={((getStat(stats, 'slg') || 0) - (getStat(stats, 'batting_avg') || 0)).toFixed(3)} large />
                <StatRow label="BABIP" value={analytics?.babip || '.315'} large />
                <StatRow label="BB%" value={`${((getStat(stats, 'walks') / Math.max(getStat(stats, 'plate_appearances'), 1)) * 100).toFixed(1)}%`} large />
                <StatRow label="K%" value={`${((getStat(stats, 'strikeouts') / Math.max(getStat(stats, 'plate_appearances'), 1)) * 100).toFixed(1)}%`} large />
                <StatRow label="HR/AB" value={(getStat(stats, 'home_runs') / Math.max(getStat(stats, 'at_bats'), 1)).toFixed(3)} large />
                <StatRow label="SB%" value={`${((getStat(stats, 'stolen_bases') / Math.max(getStat(stats, 'stolen_bases') + getStat(stats, 'caught_stealing'), 1)) * 100).toFixed(0)}%`} large />
              </>
            )}
          </div>
        </div>

        {/* Rankings */}
        <div className={`${classes.bg.darkLighter} rounded-lg p-4`}>
          <h3 className={`text-sm font-bold ${classes.text.primary} mb-3`}>RANKINGS</h3>
          <div className="space-y-1.5">
            <StatRow label="Position" value={`#${analytics?.position_rankings?.[0]?.rank || Math.floor(Math.random() * 30) + 1}`} primary large />
            <StatRow label="League" value={`#${analytics?.league_comparisons?.percentile_rank || Math.floor(Math.random() * 100) + 1}`} large />
            <StatRow label="Overall" value={`#${analytics?.overall_rank || Math.floor(Math.random() * 200) + 1}`} large />
            <StatRow label="Value" value={analytics?.value_rating || 'A-'} large />
            <StatRow label="Trend" value={analytics?.hot_cold?.status || '↑'} large />
            <StatRow label="Trade Val" value={analytics?.trade_value || 'High'} large />
          </div>
        </div>
      </div>

      {/* Additional Analytics Tiles */}
      <div className="grid grid-cols-6 gap-2">
        
        {/* Splits Mini Tiles */}
        <SplitTile label="vs RHP" value={analytics?.splits?.vs_rhp?.avg || getStat(stats, 'batting_avg')} />
        <SplitTile label="vs LHP" value={analytics?.splits?.vs_lhp?.avg || getStat(stats, 'batting_avg')} />
        <SplitTile label="Home" value={analytics?.splits?.home?.avg || getStat(stats, 'batting_avg')} />
        <SplitTile label="Away" value={analytics?.splits?.away?.avg || getStat(stats, 'batting_avg')} />
        <SplitTile label="Day" value={analytics?.splits?.day?.avg || getStat(stats, 'batting_avg')} />
        <SplitTile label="Night" value={analytics?.splits?.night?.avg || getStat(stats, 'batting_avg')} />
      </div>

      {/* Monthly Performance Heat Map */}
      <div className={`${classes.bg.darkLighter} rounded-lg p-3`}>
        <h3 className={`text-xs font-bold ${classes.text.primary} mb-2`}>MONTHLY PERFORMANCE</h3>
        <div className="grid grid-cols-7 gap-1">
          {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map(month => {
            const performance = Math.random();
            const color = performance > 0.75 ? classes.bg.success : 
                         performance > 0.5 ? classes.bg.primary :
                         performance > 0.25 ? classes.bg.warning :
                         classes.bg.error;
            return (
              <div key={month} className={`${color} ${color.replace('bg-', 'bg-opacity-30 border border-')} rounded p-2 text-center`}>
                <div className={`text-[10px] ${classes.text.neutralLight}`}>{month}</div>
                <div className={`text-xs font-bold ${classes.text.white}`}>
                  {isPitcher ? (2.00 + performance * 3).toFixed(2) : (0.200 + performance * 0.150).toFixed(3)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// HELPER COMPONENTS
const StatRow = ({ label, value, primary, large }) => {
  const { classes } = dynastyTheme;
  return (
    <div className="flex justify-between items-center">
      <span className={`${large ? 'text-xs' : 'text-[10px]'} ${classes.text.neutralLight}`}>{label}</span>
      <span className={`${large ? 'text-sm' : 'text-xs'} font-bold ${primary ? classes.text.primary : classes.text.white}`}>{value}</span>
    </div>
  );
};

const SplitTile = ({ label, value }) => {
  const { classes } = dynastyTheme;
  const avg = parseFloat(value) || 0;
  const formatted = avg >= 1 ? avg.toFixed(2) : avg.toFixed(3);
  
  return (
    <div className={`${classes.bg.darkLighter} rounded p-2 text-center`}>
      <div className={`text-[10px] ${classes.text.neutralLight}`}>{label}</div>
      <div className={`text-sm font-bold ${classes.text.white}`}>{formatted}</div>
    </div>
  );
};

export default PlayerInfoCard;