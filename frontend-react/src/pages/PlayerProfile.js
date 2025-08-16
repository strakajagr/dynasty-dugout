// src/pages/PlayerProfile.js - ENHANCED VERSION WITH PROPER DATA ROUTING
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar, MapPin, Activity, TrendingUp, TrendingDown,
  BarChart3, Target, Award, Clock, Users, Star, Flame, Snowflake,
  Zap, Eye, Gamepad2, Home, Plane, DollarSign, FileText, Brain,
  LineChart, PieChart, Gauge, Calculator
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { playersAPI, leaguesAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';
import { DynastyTable, createCareerStatsColumns, calculateCareerTotals, createGameLogsColumns } from '../services/tableService';

const PlayerProfile = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get('leagueId');
  
  // Basic player data
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Data from MAIN DB (historical)
  const [historicalStats, setHistoricalStats] = useState([]);
  const [careerTotals, setCareerTotals] = useState(null);

  // Data from LEAGUE DB (current season + league-specific)
  const [leagueGameLogs, setLeagueGameLogs] = useState([]);
  const [league2025Stats, setLeague2025Stats] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [teamAttributionData, setTeamAttributionData] = useState(null);

  // Analytics data
  const [analytics, setAnalytics] = useState({
    hotColdAnalysis: null,
    performanceTrends: null,
    splits: null,
    advanced: null
  });

  useEffect(() => {
    if (playerId) {
      loadAllPlayerData();
    }
  }, [playerId, leagueId]);

  const loadAllPlayerData = async () => {
    try {
      setLoading(true);
      console.log('Loading player data for ID:', playerId, 'League:', leagueId);
      
      // Load basic player info from main DB
      const playerResponse = await playersAPI.getPlayerById(playerId);
      console.log('Player basic info:', playerResponse);
      setPlayer(playerResponse.player);

      // Load historical stats from main DB (all years except 2025)
      await loadHistoricalData();

      // If we have a league context, load league-specific data
      if (leagueId) {
        await loadLeagueSpecificData();
      }

      // Load analytics data
      await loadAnalyticsData();
      
      setError(null);
    } catch (error) {
      console.error('Error loading player data:', error);
      setError('Failed to load player data');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    try {
      // Get career stats from main DB (2024 and earlier)
      const careerResponse = await playersAPI.getCareerStats(playerId);
      if (careerResponse.success) {
        const historicalSeasons = careerResponse.career_stats.filter(season => season.season_year < 2025);
        setHistoricalStats(historicalSeasons);
        setCareerTotals(calculateCareerTotals(historicalSeasons, isPitcher()));
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
    }
  };

  const loadLeagueSpecificData = async () => {
    try {
      // Get 2025 stats from league DB
      const league2025Response = await leaguesAPI.getLeaguePlayerStats(leagueId, playerId);
      if (league2025Response.success) {
        setLeague2025Stats(league2025Response.stats);
      }

      // Get game logs from league DB
      const gameLogsResponse = await leaguesAPI.getLeaguePlayerGameLogs(leagueId, playerId);
      if (gameLogsResponse.success) {
        setLeagueGameLogs(gameLogsResponse.game_logs);
      }

      // Get contract/salary info from league DB
      const contractResponse = await leaguesAPI.getPlayerContract(leagueId, playerId);
      if (contractResponse.success) {
        setContractInfo(contractResponse.contract);
      }

      // Get team attribution data from league DB
      const attributionResponse = await leaguesAPI.getPlayerTeamAttribution(leagueId, playerId);
      if (attributionResponse.success) {
        setTeamAttributionData(attributionResponse.attribution);
      }

    } catch (error) {
      console.error('Error loading league-specific data:', error);
    }
  };

  const loadAnalyticsData = async () => {
    try {
      // Hot/Cold Analysis
      const hotColdResponse = await playersAPI.getHotColdAnalysis(playerId);
      if (hotColdResponse.success) {
        setAnalytics(prev => ({ ...prev, hotColdAnalysis: hotColdResponse.analysis }));
      }

      // Performance Trends
      const trendsResponse = await playersAPI.getPerformanceTrends(playerId);
      if (trendsResponse.success) {
        setAnalytics(prev => ({ ...prev, performanceTrends: trendsResponse.trends }));
      }

      // If we have league context, get league-specific analytics
      if (leagueId) {
        const leagueAnalyticsResponse = await leaguesAPI.getPlayerAnalytics(leagueId, playerId);
        if (leagueAnalyticsResponse.success) {
          setAnalytics(prev => ({ 
            ...prev, 
            splits: leagueAnalyticsResponse.splits,
            advanced: leagueAnalyticsResponse.advanced
          }));
        }
      }

    } catch (error) {
      console.error('Error loading analytics data:', error);
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

  const isPitcher = () => {
    const position = player?.position?.toUpperCase();
    return position === 'P' || position === 'SP' || position === 'RP' || position === 'CL';
  };

  const getHotColdIcon = () => {
    if (!analytics.hotColdAnalysis) return <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.neutral}`} />;
    
    switch (analytics.hotColdAnalysis.status) {
      case 'hot':
        return <Flame className="w-5 h-5 text-red-500" />;
      case 'cold':
        return <Snowflake className="w-5 h-5 text-blue-400" />;
      default:
        return <Activity className={`w-5 h-5 ${dynastyTheme.classes.text.neutral}`} />;
    }
  };

  const getHotColdColor = () => {
    if (!analytics.hotColdAnalysis) return dynastyTheme.classes.text.neutral;
    
    switch (analytics.hotColdAnalysis.status) {
      case 'hot':
        return 'text-red-500';
      case 'cold':
        return 'text-blue-400';
      default:
        return dynastyTheme.classes.text.neutral;
    }
  };

  if (loading) {
    return (
      <div className={dynastyTheme.components.page}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${dynastyTheme.classes.border.primary} mx-auto mb-4`}></div>
            <p className={dynastyTheme.classes.text.white}>Loading player data...</p>
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
                    {analytics.hotColdAnalysis && (
                      <div className={`flex items-center px-3 py-1 rounded-full ${dynastyTheme.components.card.base} ${getHotColdColor()}`}>
                        {getHotColdIcon()}
                        <span className="ml-1 text-sm font-medium capitalize">
                          {analytics.hotColdAnalysis.status}
                        </span>
                        <span className="ml-1 text-xs opacity-75">
                          ({analytics.hotColdAnalysis.confidence}%)
                        </span>
                      </div>
                    )}
                  </div>
                  <p className={dynastyTheme.classes.text.neutralLight}>
                    {player.position} • {player.mlb_team || 'Free Agent'}
                    {leagueId && contractInfo && (
                      <span className={dynastyTheme.classes.text.primary}>
                        {' '} • ${contractInfo.salary}M ({contractInfo.contract_years}yr)
                      </span>
                    )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>Basic Info</h3>
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

            {/* Contract Info (League-specific) */}
            {leagueId && contractInfo && (
              <div className="space-y-3">
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>Contract</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <DollarSign className={`w-4 h-4 mr-2 ${dynastyTheme.classes.text.primary}`} />
                    <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Salary:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                      ${contractInfo.salary}M
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className={`w-4 h-4 mr-2 ${dynastyTheme.classes.text.primary}`} />
                    <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Years:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                      {contractInfo.contract_years}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <FileText className={`w-4 h-4 mr-2 ${dynastyTheme.classes.text.primary}`} />
                    <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Status:</span>
                    <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                      {contractInfo.availability_status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2025 Season Stats (League DB) */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>2025 Season</h3>
              {league2025Stats ? (
                <div className="space-y-2">
                  {isPitcher() ? (
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>ERA:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{league2025Stats.era?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>WHIP:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{league2025Stats.whip?.toFixed(3) || '0.000'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>W:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{league2025Stats.wins || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>SO:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{league2025Stats.strikeouts_pitched || 0}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>AVG:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{league2025Stats.avg?.toFixed(3) || '.000'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>HR:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{league2025Stats.home_runs || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>RBI:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{league2025Stats.rbis || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>OPS:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{league2025Stats.ops?.toFixed(3) || '.000'}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>No 2025 stats available</p>
              )}
            </div>

            {/* Team Attribution (League-specific) */}
            {leagueId && teamAttributionData && (
              <div className="space-y-3">
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>Team Performance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Games:</span>
                    <span className={`${dynastyTheme.classes.text.white} font-mono`}>{teamAttributionData.team_games || 0}</span>
                  </div>
                  {isPitcher() ? (
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Team ERA:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{teamAttributionData.team_era?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Team W:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{teamAttributionData.team_wins || 0}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Team AVG:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{teamAttributionData.team_avg?.toFixed(3) || '.000'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Team HR:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{teamAttributionData.team_home_runs || 0}</span>
                      </div>
                    </>
                  )}
                  <div className={`text-xs ${dynastyTheme.classes.text.neutral} mt-2`}>
                    Since {teamAttributionData.first_game_date}
                  </div>
                </div>
              </div>
            )}

            {/* Hot/Cold Analysis */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} flex items-center`}>
                <Zap className="w-4 h-4 mr-2" />
                Form
              </h3>
              {analytics.hotColdAnalysis ? (
                <div className="space-y-2">
                  <div className={`flex items-center px-3 py-2 rounded-lg ${dynastyTheme.components.card.base} ${getHotColdColor()}`}>
                    {getHotColdIcon()}
                    <span className="ml-2 font-medium capitalize">
                      {analytics.hotColdAnalysis.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Confidence:</span>
                    <span className={`${dynastyTheme.classes.text.white} font-mono`}>{analytics.hotColdAnalysis.confidence}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Games:</span>
                    <span className={`${dynastyTheme.classes.text.white} font-mono`}>{analytics.hotColdAnalysis.games_analyzed}</span>
                  </div>
                </div>
              ) : (
                <p className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>Analyzing...</p>
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
                { id: 'overview', label: '2025 Overview', icon: BarChart3 },
                { id: 'games', label: 'Game Logs', icon: Gamepad2 },
                { id: 'career', label: 'Career History', icon: Award },
                { id: 'analytics', label: 'Advanced Analytics', icon: Brain },
                ...(leagueId ? [{ id: 'contract', label: 'Contract Details', icon: DollarSign }] : [])
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
            {activeTab === 'overview' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>
                  2025 Season Overview
                </h3>
                {league2025Stats ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {isPitcher() ? (
                      [
                        { label: 'Games', value: league2025Stats.games_played || 0 },
                        { label: 'Innings', value: league2025Stats.innings_pitched?.toFixed(1) || '0.0' },
                        { label: 'ERA', value: league2025Stats.era?.toFixed(2) || '0.00' },
                        { label: 'WHIP', value: league2025Stats.whip?.toFixed(3) || '0.000' },
                        { label: 'Wins', value: league2025Stats.wins || 0 },
                        { label: 'Saves', value: league2025Stats.saves || 0 },
                        { label: 'Strikeouts', value: league2025Stats.strikeouts_pitched || 0 },
                        { label: 'Quality Starts', value: league2025Stats.quality_starts || 0 }
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <div className={`${dynastyTheme.classes.text.primary} text-3xl font-bold mb-2`}>{value}</div>
                          <div className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>{label}</div>
                        </div>
                      ))
                    ) : (
                      [
                        { label: 'Games', value: league2025Stats.games_played || 0 },
                        { label: 'AVG', value: league2025Stats.avg?.toFixed(3) || '.000' },
                        { label: 'Home Runs', value: league2025Stats.home_runs || 0 },
                        { label: 'RBIs', value: league2025Stats.rbis || 0 },
                        { label: 'Runs', value: league2025Stats.runs || 0 },
                        { label: 'Stolen Bases', value: league2025Stats.stolen_bases || 0 },
                        { label: 'OBP', value: league2025Stats.obp?.toFixed(3) || '.000' },
                        { label: 'OPS', value: league2025Stats.ops?.toFixed(3) || '.000' }
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <div className={`${dynastyTheme.classes.text.primary} text-3xl font-bold mb-2`}>{value}</div>
                          <div className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>{label}</div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <p className={dynastyTheme.classes.text.neutralLight}>No 2025 season statistics available</p>
                )}
              </div>
            )}

            {activeTab === 'games' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>
                  2025 Game Logs {leagueId ? '(League Database)' : ''}
                </h3>
                {leagueGameLogs.length > 0 ? (
                  <DynastyTable
                    title={`2025 Game Logs (${leagueGameLogs.length} games)`}
                    data={leagueGameLogs}
                    columns={createGameLogsColumns(isPitcher())}
                    initialSort={{ key: 'game_date', direction: 'desc' }}
                    maxHeight="500px"
                    stickyHeader={true}
                  />
                ) : (
                  <p className={dynastyTheme.classes.text.neutralLight}>No 2025 game logs available</p>
                )}
              </div>
            )}

            {activeTab === 'career' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>
                  Career Statistics (Historical - Main Database)
                </h3>
                {historicalStats.length > 0 ? (
                  <DynastyTable
                    title="Career Stats (2024 and Earlier)"
                    data={historicalStats}
                    columns={createCareerStatsColumns(isPitcher())}
                    initialSort={{ key: 'season_year', direction: 'desc' }}
                    maxHeight="500px"
                    showTotals={true}
                    totalsRow={careerTotals}
                    stickyHeader={true}
                  />
                ) : (
                  <p className={dynastyTheme.classes.text.neutralLight}>No historical career statistics available</p>
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                  <Brain className="w-5 h-5 mr-2" />
                  Advanced Analytics & Performance Intelligence
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Hot/Cold Analysis */}
                  <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
                    <h4 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                      {getHotColdIcon()}
                      <span className="ml-2">Performance Temperature</span>
                    </h4>
                    {analytics.hotColdAnalysis ? (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-lg ${dynastyTheme.components.card.base} text-center`}>
                          <div className={`text-3xl font-bold mb-2 ${getHotColdColor()}`}>
                            {analytics.hotColdAnalysis.status.toUpperCase()}
                          </div>
                          <div className={dynastyTheme.classes.text.neutralLight}>
                            {analytics.hotColdAnalysis.confidence}% confidence over {analytics.hotColdAnalysis.games_analyzed} games
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h5 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Recent vs Season Comparison:</h5>
                          {isPitcher() ? (
                            <>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Recent ERA:</span>
                                <span className={dynastyTheme.classes.text.white}>{analytics.hotColdAnalysis.recent_era}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Season ERA:</span>
                                <span className={dynastyTheme.classes.text.white}>{analytics.hotColdAnalysis.season_era}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Difference:</span>
                                <span className={analytics.hotColdAnalysis.era_change > 0 ? 'text-red-400' : 'text-green-400'}>
                                  {analytics.hotColdAnalysis.era_change > 0 ? '+' : ''}{analytics.hotColdAnalysis.era_change}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Recent AVG:</span>
                                <span className={dynastyTheme.classes.text.white}>{analytics.hotColdAnalysis.recent_avg}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Season AVG:</span>
                                <span className={dynastyTheme.classes.text.white}>{analytics.hotColdAnalysis.season_avg}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={dynastyTheme.classes.text.neutralLight}>Difference:</span>
                                <span className={analytics.hotColdAnalysis.avg_change > 0 ? 'text-green-400' : 'text-red-400'}>
                                  {analytics.hotColdAnalysis.avg_change > 0 ? '+' : ''}{analytics.hotColdAnalysis.avg_change}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className={dynastyTheme.classes.text.neutralLight}>Analyzing recent performance...</p>
                    )}
                  </div>

                  {/* Performance Trends */}
                  <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
                    <h4 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                      <LineChart className="w-5 h-5 mr-2" />
                      Performance Trends
                    </h4>
                    {analytics.performanceTrends ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <div className={`text-2xl font-bold ${analytics.performanceTrends.direction === 'improving' ? 'text-green-400' : analytics.performanceTrends.direction === 'declining' ? 'text-red-400' : dynastyTheme.classes.text.primary}`}>
                              {analytics.performanceTrends.direction === 'improving' ? '↗' : analytics.performanceTrends.direction === 'declining' ? '↘' : '→'}
                            </div>
                            <div className={dynastyTheme.classes.text.neutralLight}>Trend</div>
                          </div>
                          <div className="text-center">
                            <div className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
                              {analytics.performanceTrends.strength}%
                            </div>
                            <div className={dynastyTheme.classes.text.neutralLight}>Strength</div>
                          </div>
                        </div>
                        <div className={dynastyTheme.classes.text.neutralLight}>
                          Based on last {analytics.performanceTrends.period_days} days of performance data
                        </div>
                      </div>
                    ) : (
                      <p className={dynastyTheme.classes.text.neutralLight}>Calculating trends...</p>
                    )}
                  </div>

                  {/* Advanced Metrics (League-specific) */}
                  {leagueId && analytics.advanced && (
                    <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
                      <h4 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                        <Calculator className="w-5 h-5 mr-2" />
                        Advanced Metrics
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {isPitcher() ? (
                          <>
                            <div className="text-center">
                              <div className={`text-xl font-bold ${dynastyTheme.classes.text.primary}`}>
                                {analytics.advanced.k_per_9?.toFixed(1) || '0.0'}
                              </div>
                              <div className={dynastyTheme.classes.text.neutralLight}>K/9</div>
                            </div>
                            <div className="text-center">
                              <div className={`text-xl font-bold ${dynastyTheme.classes.text.primary}`}>
                                {analytics.advanced.bb_per_9?.toFixed(1) || '0.0'}
                              </div>
                              <div className={dynastyTheme.classes.text.neutralLight}>BB/9</div>
                            </div>
                            <div className="text-center">
                              <div className={`text-xl font-bold ${dynastyTheme.classes.text.primary}`}>
                                {analytics.advanced.hr_per_9?.toFixed(1) || '0.0'}
                              </div>
                              <div className={dynastyTheme.classes.text.neutralLight}>HR/9</div>
                            </div>
                            <div className="text-center">
                              <div className={`text-xl font-bold ${dynastyTheme.classes.text.primary}`}>
                                {analytics.advanced.strand_rate?.toFixed(1) || '0.0'}%
                              </div>
                              <div className={dynastyTheme.classes.text.neutralLight}>LOB%</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-center">
                              <div className={`text-xl font-bold ${dynastyTheme.classes.text.primary}`}>
                                {analytics.advanced.babip?.toFixed(3) || '.000'}
                              </div>
                              <div className={dynastyTheme.classes.text.neutralLight}>BABIP</div>
                            </div>
                            <div className="text-center">
                              <div className={`text-xl font-bold ${dynastyTheme.classes.text.primary}`}>
                                {analytics.advanced.k_rate?.toFixed(1) || '0.0'}%
                              </div>
                              <div className={dynastyTheme.classes.text.neutralLight}>K%</div>
                            </div>
                            <div className="text-center">
                              <div className={`text-xl font-bold ${dynastyTheme.classes.text.primary}`}>
                                {analytics.advanced.bb_rate?.toFixed(1) || '0.0'}%
                              </div>
                              <div className={dynastyTheme.classes.text.neutralLight}>BB%</div>
                            </div>
                            <div className="text-center">
                              <div className={`text-xl font-bold ${dynastyTheme.classes.text.primary}`}>
                                {analytics.advanced.iso?.toFixed(3) || '.000'}
                              </div>
                              <div className={dynastyTheme.classes.text.neutralLight}>ISO</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Performance Splits (League-specific) */}
                  {leagueId && analytics.splits && (
                    <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
                      <h4 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                        <PieChart className="w-5 h-5 mr-2" />
                        Performance Splits
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <h5 className={`font-semibold ${dynastyTheme.classes.text.white} mb-2`}>Home vs Away:</h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className={dynastyTheme.classes.text.neutralLight}>Home</div>
                              <div className={dynastyTheme.classes.text.white}>
                                {isPitcher() ? 
                                  `${analytics.splits.home_era?.toFixed(2) || '0.00'} ERA` :
                                  `${analytics.splits.home_avg?.toFixed(3) || '.000'} AVG`
                                }
                              </div>
                            </div>
                            <div>
                              <div className={dynastyTheme.classes.text.neutralLight}>Away</div>
                              <div className={dynastyTheme.classes.text.white}>
                                {isPitcher() ? 
                                  `${analytics.splits.away_era?.toFixed(2) || '0.00'} ERA` :
                                  `${analytics.splits.away_avg?.toFixed(3) || '.000'} AVG`
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className={`font-semibold ${dynastyTheme.classes.text.white} mb-2`}>vs Division:</h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className={dynastyTheme.classes.text.neutralLight}>vs Division</div>
                              <div className={dynastyTheme.classes.text.white}>
                                {isPitcher() ? 
                                  `${analytics.splits.vs_division_era?.toFixed(2) || '0.00'} ERA` :
                                  `${analytics.splits.vs_division_avg?.toFixed(3) || '.000'} AVG`
                                }
                              </div>
                            </div>
                            <div>
                              <div className={dynastyTheme.classes.text.neutralLight}>vs Others</div>
                              <div className={dynastyTheme.classes.text.white}>
                                {isPitcher() ? 
                                  `${analytics.splits.vs_others_era?.toFixed(2) || '0.00'} ERA` :
                                  `${analytics.splits.vs_others_avg?.toFixed(3) || '.000'} AVG`
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'contract' && leagueId && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4 flex items-center`}>
                  <DollarSign className="w-5 h-5 mr-2" />
                  Contract & League Details
                </h3>
                {contractInfo ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
                      <h4 className={`font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>Contract Terms</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className={dynastyTheme.classes.text.neutralLight}>Annual Salary:</span>
                          <span className={dynastyTheme.classes.text.white}>${contractInfo.salary}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dynastyTheme.classes.text.neutralLight}>Contract Length:</span>
                          <span className={dynastyTheme.classes.text.white}>{contractInfo.contract_years} years</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dynastyTheme.classes.text.neutralLight}>Total Value:</span>
                          <span className={dynastyTheme.classes.text.white}>${(contractInfo.salary * contractInfo.contract_years).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dynastyTheme.classes.text.neutralLight}>Acquired:</span>
                          <span className={dynastyTheme.classes.text.white}>{contractInfo.acquisition_date || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dynastyTheme.classes.text.neutralLight}>Method:</span>
                          <span className={dynastyTheme.classes.text.white}>{contractInfo.acquisition_method || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
                      <h4 className={`font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>Roster Status</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className={dynastyTheme.classes.text.neutralLight}>Availability:</span>
                          <span className={`font-medium ${contractInfo.availability_status === 'owned' ? dynastyTheme.classes.text.success : dynastyTheme.classes.text.warning}`}>
                            {contractInfo.availability_status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dynastyTheme.classes.text.neutralLight}>Roster Status:</span>
                          <span className={dynastyTheme.classes.text.white}>{contractInfo.roster_status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dynastyTheme.classes.text.neutralLight}>Active:</span>
                          <span className={`font-medium ${contractInfo.is_active ? dynastyTheme.classes.text.success : dynastyTheme.classes.text.error}`}>
                            {contractInfo.is_active ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {teamAttributionData && (
                      <div className={`${dynastyTheme.components.card.base} p-6 rounded-lg`}>
                        <h4 className={`font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>Team Attribution</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className={dynastyTheme.classes.text.neutralLight}>Games for Team:</span>
                            <span className={dynastyTheme.classes.text.white}>{teamAttributionData.team_games}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={dynastyTheme.classes.text.neutralLight}>First Game:</span>
                            <span className={dynastyTheme.classes.text.white}>{teamAttributionData.first_game_date}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={dynastyTheme.classes.text.neutralLight}>Last Updated:</span>
                            <span className={dynastyTheme.classes.text.white}>{teamAttributionData.last_updated}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className={dynastyTheme.classes.text.neutralLight}>No contract information available</p>
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