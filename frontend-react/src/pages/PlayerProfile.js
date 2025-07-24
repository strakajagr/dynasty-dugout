// src/pages/PlayerProfile.js - ENHANCED VERSION WITH FULL ANALYTICS DISPLAY
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar, MapPin, Activity, TrendingUp, TrendingDown,
  BarChart3, Target, Award, Clock, Users, Star, Flame, Snowflake,
  Zap, Eye, Gamepad2, Home, Plane
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { playersAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';
import { DynastyTable, createCareerStatsColumns, calculateCareerTotals, createGameLogsColumns } from '../services/tableService';

const PlayerProfile = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState([]);
  const [careerStats, setCareerStats] = useState([]);
  const [recentPerformance, setRecentPerformance] = useState(null);
  const [gameLogs, setGameLogs] = useState([]);
  const [hotColdAnalysis, setHotColdAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('recent');

  useEffect(() => {
    if (playerId) {
      loadAllPlayerData();
    }
  }, [playerId]);

  const loadAllPlayerData = async () => {
    try {
      setLoading(true);
      console.log('Loading comprehensive player data for ID:', playerId);
      
      // Load basic player data first
      const playerResponse = await playersAPI.getPlayerDetails(playerId, true);
      console.log('Player details response:', playerResponse);
      
      setPlayer(playerResponse.player);
      setStats(playerResponse.stats || []);
      
      // Load enhanced data in parallel using direct API calls
      const axios = (await import('axios')).default;
      const enhancedAPI = axios.create({
        baseURL: '/api',
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const [careerResponse, recentResponse, gameLogsResponse, hotColdResponse] = await Promise.allSettled([
        enhancedAPI.get(`/players/${playerId}/career`),
        enhancedAPI.get(`/players/${playerId}/recent-performance`),
        enhancedAPI.get(`/players/${playerId}/game-logs`),
        enhancedAPI.get(`/players/${playerId}/hot-cold-analysis`)
      ]);
      
      // Set career stats
      if (careerResponse.status === 'fulfilled' && careerResponse.value) {
        setCareerStats(careerResponse.value.data.career_stats || []);
        console.log('Career stats loaded:', careerResponse.value.data.career_stats?.length || 0, 'seasons');
      }
      
      // Set recent performance
      if (recentResponse.status === 'fulfilled' && recentResponse.value) {
        setRecentPerformance(recentResponse.value.data);
        console.log('Recent performance loaded:', recentResponse.value.data.total_games, 'games');
      }
      
      // Set game logs
      if (gameLogsResponse.status === 'fulfilled' && gameLogsResponse.value) {
        setGameLogs(gameLogsResponse.value.data.game_logs || []);
        console.log('Game logs loaded:', gameLogsResponse.value.data.game_logs?.length || 0, 'games');
      }
      
      // Set hot/cold analysis
      if (hotColdResponse.status === 'fulfilled' && hotColdResponse.value) {
        setHotColdAnalysis(hotColdResponse.value.data.analysis);
        console.log('Hot/cold analysis loaded:', hotColdResponse.value.data.analysis?.status);
      }
      
      setError(null);
    } catch (error) {
      console.error('Error loading comprehensive player data:', error);
      if (error.response?.status === 401) {
        setError('Please log in to view player data');
      } else {
        setError('Failed to load player data');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthdate) => {
    if (!birthdate) return 'N/A';
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatHeight = (heightInches) => {
    if (!heightInches) return 'N/A';
    const feet = Math.floor(heightInches / 12);
    const inches = heightInches % 12;
    return `${feet}-${inches}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });
  };

  const isPitcher = () => {
    const position = player?.position?.toUpperCase();
    return position === 'P' || position === 'SP' || position === 'RP' || position === 'CL';
  };

  const getHotColdIcon = () => {
    if (!hotColdAnalysis) return <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.neutral}`} />;
    
    switch (hotColdAnalysis.status) {
      case 'hot':
        return <Flame className="w-5 h-5 text-red-500" />;
      case 'cold':
        return <Snowflake className="w-5 h-5 text-blue-400" />;
      default:
        return <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.neutral}`} />;
    }
  };

  const getHotColdColor = () => {
    if (!hotColdAnalysis) return dynastyTheme.classes.text.neutral;
    
    switch (hotColdAnalysis.status) {
      case 'hot':
        return 'text-red-500';
      case 'cold':
        return 'text-blue-400';
      default:
        return dynastyTheme.classes.text.neutral;
    }
  };

  const getSeasonStats = () => {
    if (!stats.length) return null;
    
    const currentSeason = Math.max(...stats.map(s => s.season_year));
    const seasonStats = stats.filter(s => s.season_year === currentSeason);
    
    if (seasonStats.length === 0) return null;
    
    if (isPitcher()) {
      const totals = seasonStats.reduce((acc, week) => ({
        games_played: (acc.games_played || 0) + (week.games_played || 0),
        innings_pitched: (acc.innings_pitched || 0) + (week.innings_pitched || 0),
        wins: (acc.wins || 0) + (week.wins || 0),
        losses: (acc.losses || 0) + (week.losses || 0),
        saves: (acc.saves || 0) + (week.saves || 0),
        strikeouts_pitched: (acc.strikeouts_pitched || 0) + (week.strikeouts_pitched || week.strikeouts || 0),
        earned_runs: (acc.earned_runs || 0) + (week.earned_runs || 0),
        hits_allowed: (acc.hits_allowed || 0) + (week.hits_allowed || 0),
        walks_allowed: (acc.walks_allowed || 0) + (week.walks_allowed || 0),
      }), {});
      
      const era = totals.innings_pitched > 0 ? ((totals.earned_runs * 9) / totals.innings_pitched).toFixed(2) : '0.00';
      const whip = totals.innings_pitched > 0 ? ((totals.hits_allowed + totals.walks_allowed) / totals.innings_pitched).toFixed(2) : '0.00';
      
      return {
        ...totals,
        ERA: era,
        WHIP: whip,
        IP: totals.innings_pitched.toFixed(1),
        SO: totals.strikeouts_pitched,
        isPitcher: true
      };
    } else {
      const totals = seasonStats.reduce((acc, week) => ({
        games_played: (acc.games_played || 0) + (week.games_played || 0),
        at_bats: (acc.at_bats || 0) + (week.at_bats || 0),
        hits: (acc.hits || 0) + (week.hits || 0),
        runs: (acc.runs || 0) + (week.runs || 0),
        rbis: (acc.rbis || 0) + (week.rbis || 0),
        home_runs: (acc.home_runs || 0) + (week.home_runs || 0),
        doubles: (acc.doubles || 0) + (week.doubles || 0),
        triples: (acc.triples || 0) + (week.triples || 0),
        stolen_bases: (acc.stolen_bases || 0) + (week.stolen_bases || 0),
        walks: (acc.walks || 0) + (week.walks || 0),
        strikeouts: (acc.strikeouts || 0) + (week.strikeouts || 0),
      }), {});
      
      const avg = totals.at_bats > 0 ? (totals.hits / totals.at_bats).toFixed(3) : '.000';
      const obp = (totals.at_bats + totals.walks) > 0 ? ((totals.hits + totals.walks) / (totals.at_bats + totals.walks)).toFixed(3) : '.000';
      const totalBases = totals.hits + totals.doubles + (totals.triples * 2) + (totals.home_runs * 3);
      const slg = totals.at_bats > 0 ? (totalBases / totals.at_bats).toFixed(3) : '.000';
      const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);
      
      return {
        ...totals,
        AVG: avg,
        OBP: obp,
        SLG: slg,
        OPS: ops,
        isPitcher: false
      };
    }
  };

  const seasonStats = getSeasonStats();

  if (loading) {
    return (
      <div className={dynastyTheme.components.page}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${dynastyTheme.classes.border.primary} mx-auto mb-4`}></div>
            <p className={dynastyTheme.classes.text.white}>Loading comprehensive player data...</p>
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
            <p className={`${dynastyTheme.classes.text.error} text-xl mb-4`}>{error || 'Player not found'}</p>
            <button 
              onClick={() => navigate(-1)}
              className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} flex items-center`}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={dynastyTheme.components.page}>
      {/* Header with Hot/Cold Status */}
      <header className={`${dynastyTheme.components.card.base} border-b ${dynastyTheme.classes.border.light}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button 
                onClick={() => navigate(-1)}
                className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} flex items-center`}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
              <div className="flex items-center ml-4">
                <User className={`w-8 h-8 mr-3 ${dynastyTheme.classes.text.primary}`} />
                <div>
                  <div className="flex items-center">
                    <h1 className={`text-2xl font-bold ${dynastyTheme.classes.text.white} mr-3`}>
                      {player.first_name} {player.last_name}
                    </h1>
                    {hotColdAnalysis && (
                      <div className={`flex items-center px-3 py-1 rounded-full ${dynastyTheme.components.card.base} ${getHotColdColor()}`}>
                        {getHotColdIcon()}
                        <span className="ml-1 text-sm font-medium capitalize">
                          {hotColdAnalysis.status}
                        </span>
                        <span className="ml-1 text-xs opacity-75">
                          ({hotColdAnalysis.confidence}%)
                        </span>
                      </div>
                    )}
                  </div>
                  <p className={dynastyTheme.classes.text.neutralLight}>
                    {player.position} • {player.mlb_team || 'Free Agent'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className={dynastyTheme.classes.text.primary}>Welcome, {user?.given_name}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Player Info Card */}
        <div className={`${dynastyTheme.components.card.base} p-6 mb-8`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>Player Information</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <User className={`w-4 h-4 mr-2 ${dynastyTheme.classes.text.primary}`} />
                  <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Name:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.first_name} {player.last_name}
                  </span>
                </div>
                <div className="flex items-center">
                  <MapPin className={`w-4 h-4 mr-2 ${dynastyTheme.classes.text.primary}`} />
                  <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Team:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.mlb_team || 'Free Agent'}
                  </span>
                </div>
                <div className="flex items-center">
                  <Target className={`w-4 h-4 mr-2 ${dynastyTheme.classes.text.primary}`} />
                  <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Position:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.position}
                  </span>
                </div>
              </div>
            </div>

            {/* Physical Stats */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>Physical</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Activity className={`w-4 h-4 mr-2 ${dynastyTheme.classes.text.primary}`} />
                  <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Height:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {formatHeight(player.height_inches)}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Weight:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.weight_pounds || 'N/A'} lbs
                  </span>
                </div>
                <div className="flex items-center">
                  <Calendar className={`w-4 h-4 mr-2 ${dynastyTheme.classes.text.primary}`} />
                  <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Age:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {calculateAge(player.birthdate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>Status</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Activity className={`w-4 h-4 mr-2 ${dynastyTheme.classes.text.primary}`} />
                  <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Status:</span>
                  <span className={`ml-1 font-medium ${player.is_active ? dynastyTheme.classes.text.success : dynastyTheme.classes.text.error}`}>
                    {player.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Injury:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.injury_status || 'Healthy'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2025 Season Stats */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>2025 Season</h3>
              {seasonStats ? (
                <div className="space-y-2">
                  {seasonStats.isPitcher ? (
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>ERA:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.ERA}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>WHIP:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.WHIP}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>W:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.wins}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>SO:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.SO}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>AVG:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.AVG}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>HR:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.home_runs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>RBI:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.rbis}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>OPS:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.OPS}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>No stats available</p>
              )}
            </div>

            {/* Recent Performance Summary */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} flex items-center`}>
                <Zap className="w-4 h-4 mr-2" />
                Recent Form
              </h3>
              {recentPerformance && recentPerformance.aggregated_stats && recentPerformance.aggregated_stats.games > 0 ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Games:</span>
                    <span className={`${dynastyTheme.classes.text.white} font-mono`}>
                      {recentPerformance.aggregated_stats.games}
                    </span>
                  </div>
                  {recentPerformance.aggregated_stats.type === 'hitting' ? (
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>AVG:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>
                          {recentPerformance.aggregated_stats.avg.toFixed(3)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>HR:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>
                          {recentPerformance.aggregated_stats.home_runs}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>ERA:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>
                          {recentPerformance.aggregated_stats.era}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>WHIP:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>
                          {recentPerformance.aggregated_stats.whip}
                        </span>
                      </div>
                    </>
                  )}
                  <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-2`}>
                    Last {recentPerformance.period_days} days
                  </div>
                </div>
              ) : (
                <p className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>No recent games</p>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Stats Tabs */}
        <div className={`${dynastyTheme.components.card.base} p-6`}>
          {/* Tab Navigation */}
          <div className={`border-b ${dynastyTheme.classes.border.neutral} mb-6`}>
            <nav className="flex space-x-8">
              {[
                { id: 'recent', label: 'Recent Performance', icon: TrendingUp },
                { id: 'season', label: 'Season Stats', icon: BarChart3 },
                { id: 'games', label: 'Game Logs', icon: Gamepad2 },
                { id: 'career', label: 'Career', icon: Award },
                { id: 'analysis', label: 'Advanced Analysis', icon: Eye }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${dynastyTheme.classes.transition} ${
                    activeTab === id
                      ? `${dynastyTheme.classes.border.primary} ${dynastyTheme.classes.text.primary}`
                      : `border-transparent ${dynastyTheme.classes.text.neutralLight} hover:${dynastyTheme.classes.text.white} hover:border-neutral-300`
                  }`}
                >
                  <Icon className="w-4 h-4 inline mr-2" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === 'recent' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Recent Performance Analysis (Last 4 Weeks)
                </h3>
                
                {recentPerformance && recentPerformance.aggregated_stats && recentPerformance.aggregated_stats.games > 0 ? (
                  <div className="space-y-6">
                    {/* Performance Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                      {recentPerformance.aggregated_stats.type === 'hitting' ? (
                        [
                          { label: 'G', value: recentPerformance.aggregated_stats.games },
                          { label: 'AVG', value: recentPerformance.aggregated_stats.avg.toFixed(3) },
                          { label: 'HR', value: recentPerformance.aggregated_stats.home_runs },
                          { label: 'RBI', value: recentPerformance.aggregated_stats.rbis },
                          { label: 'R', value: recentPerformance.aggregated_stats.runs },
                          { label: 'SB', value: recentPerformance.aggregated_stats.stolen_bases },
                          { label: 'BB', value: recentPerformance.aggregated_stats.walks },
                          { label: 'K', value: recentPerformance.aggregated_stats.strikeouts }
                        ].map(({ label, value }) => (
                          <div key={label} className="text-center">
                            <div className={`${dynastyTheme.classes.text.primary} text-2xl font-bold`}>{value}</div>
                            <div className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>{label}</div>
                          </div>
                        ))
                      ) : (
                        [
                          { label: 'G', value: recentPerformance.aggregated_stats.games },
                          { label: 'IP', value: recentPerformance.aggregated_stats.innings_pitched },
                          { label: 'ERA', value: recentPerformance.aggregated_stats.era },
                          { label: 'WHIP', value: recentPerformance.aggregated_stats.whip },
                          { label: 'W', value: recentPerformance.aggregated_stats.wins },
                          { label: 'L', value: recentPerformance.aggregated_stats.losses },
                          { label: 'SV', value: recentPerformance.aggregated_stats.saves },
                          { label: 'SO', value: recentPerformance.aggregated_stats.strikeouts }
                        ].map(({ label, value }) => (
                          <div key={label} className="text-center">
                            <div className={`${dynastyTheme.classes.text.primary} text-2xl font-bold`}>{value}</div>
                            <div className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>{label}</div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Recent Games Table */}
                    {recentPerformance.recent_games && recentPerformance.recent_games.length > 0 && (
                      <div className="mt-6">
                        <DynastyTable
                          title={`Last ${recentPerformance.recent_games.length} Games (all 2025 games)`}
                          data={recentPerformance.recent_games}
                          columns={createGameLogsColumns()}
                          initialSort={{ key: 'game_date', direction: 'desc' }}
                          maxHeight="400px"
                          stickyHeader={true}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className={dynastyTheme.classes.text.neutralLight}>No recent performance data available</p>
                )}
              </div>
            )}

            {activeTab === 'games' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                  <Gamepad2 className="w-5 h-5 mr-2" />
                  Game Logs
                </h3>
                {gameLogs.length > 0 ? (
                  <DynastyTable
                    title={`Last ${gameLogs.length} Games`}
                    data={gameLogs}
                    columns={createGameLogsColumns()}
                    initialSort={{ key: 'game_date', direction: 'desc' }}
                    maxHeight="500px"
                    stickyHeader={true}
                  />
                ) : (
                  <p className={dynastyTheme.classes.text.neutralLight}>No game logs available</p>
                )}
              </div>
            )}

            {activeTab === 'career' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>Career Statistics</h3>
                {careerStats.length > 0 ? (
                  <DynastyTable
                    title="Career Stats"
                    data={careerStats}
                    columns={createCareerStatsColumns(isPitcher())}
                    initialSort={{ key: 'season_year', direction: 'desc' }}
                    maxHeight="500px"
                    showTotals={true}
                    totalsRow={calculateCareerTotals(careerStats, isPitcher())}
                    stickyHeader={true}
                  />
                ) : (
                  <p className={dynastyTheme.classes.text.neutralLight}>No career statistics available</p>
                )}
              </div>
            )}

            {activeTab === 'analysis' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>Advanced Analysis</h3>
                {hotColdAnalysis ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Hot/Cold Status */}
                      <div className={`p-6 rounded-lg ${dynastyTheme.components.card.base}`}>
                        <div className="flex items-center mb-4">
                          {getHotColdIcon()}
                          <h4 className={`text-lg font-semibold ml-2 ${getHotColdColor()}`}>
                            Player is {hotColdAnalysis.status.toUpperCase()}
                          </h4>
                        </div>
                        <p className={`${dynastyTheme.classes.text.neutralLight} mb-2`}>
                          Confidence: {hotColdAnalysis.confidence}%
                        </p>
                        <p className={`${dynastyTheme.classes.text.white} text-sm`}>
                          Based on {hotColdAnalysis.games_analyzed} recent games
                        </p>
                      </div>

                      {/* Performance Comparison */}
                      <div className={`p-6 ${dynastyTheme.components.card.base} rounded-lg`}>
                        <h4 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>
                          Recent vs Season
                        </h4>
                        <div className="space-y-3">
                          {hotColdAnalysis.type === 'hitting' ? (
                            <>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Recent AVG:</span>
                                <span className={dynastyTheme.classes.text.white}>{hotColdAnalysis.recent_avg}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Season AVG:</span>
                                <span className={dynastyTheme.classes.text.white}>{hotColdAnalysis.season_avg}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Difference:</span>
                                <span className={`${hotColdAnalysis.avg_change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {hotColdAnalysis.avg_change > 0 ? '+' : ''}{hotColdAnalysis.avg_change}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Recent ERA:</span>
                                <span className={dynastyTheme.classes.text.white}>{hotColdAnalysis.recent_era}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Season ERA:</span>
                                <span className={dynastyTheme.classes.text.white}>{hotColdAnalysis.season_era}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Difference:</span>
                                <span className={`${hotColdAnalysis.era_change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {hotColdAnalysis.era_change > 0 ? '+' : ''}{hotColdAnalysis.era_change}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className={dynastyTheme.classes.text.neutralLight}>Loading advanced analysis...</p>
                )}
              </div>
            )}

            {activeTab === 'season' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>2025 Season Statistics</h3>
                {seasonStats ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {seasonStats.isPitcher ? (
                      [
                        { label: 'Games', value: seasonStats.games_played },
                        { label: 'Innings', value: seasonStats.IP },
                        { label: 'ERA', value: seasonStats.ERA },
                        { label: 'WHIP', value: seasonStats.WHIP },
                        { label: 'Wins', value: seasonStats.wins },
                        { label: 'Losses', value: seasonStats.losses },
                        { label: 'Saves', value: seasonStats.saves },
                        { label: 'Strikeouts', value: seasonStats.SO }
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <div className={`${dynastyTheme.classes.text.primary} text-3xl font-bold mb-2`}>{value}</div>
                          <div className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>{label}</div>
                        </div>
                      ))
                    ) : (
                      [
                        { label: 'Games', value: seasonStats.games_played },
                        { label: 'AVG', value: seasonStats.AVG },
                        { label: 'Home Runs', value: seasonStats.home_runs },
                        { label: 'RBIs', value: seasonStats.rbis },
                        { label: 'Runs', value: seasonStats.runs },
                        { label: 'Stolen Bases', value: seasonStats.stolen_bases },
                        { label: 'OBP', value: seasonStats.OBP },
                        { label: 'OPS', value: seasonStats.OPS }
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <div className={`${dynastyTheme.classes.text.primary} text-3xl font-bold mb-2`}>{value}</div>
                          <div className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>{label}</div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <p className={dynastyTheme.classes.text.neutralLight}>No season statistics available</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;