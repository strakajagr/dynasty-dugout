// src/pages/PlayerProfile.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar, MapPin, Activity, TrendingUp,
  BarChart3, Target, Award, Clock, Users, Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { playersAPI } from '../services/apiService';
import { dynastyUtils, dynastyComponents, dynastyTheme } from '../services/colorService';

const PlayerProfile = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('recent');

  useEffect(() => {
    if (playerId) {
      loadPlayerData();
    }
  }, [playerId]);

  const loadPlayerData = async () => {
    try {
      setLoading(true);
      console.log('Loading player data for ID:', playerId);
      
      const response = await playersAPI.getPlayerDetails(playerId, true);
      console.log('Player data response:', response);
      
      setPlayer(response.player);
      setStats(response.stats || []);
      setError(null);
    } catch (error) {
      console.error('Error loading player data:', error);
      setError('Failed to load player data');
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

  // ENHANCED: Check if player is a pitcher
  const isPitcher = () => {
    const position = player?.position?.toUpperCase();
    return position === 'P' || position === 'SP' || position === 'RP' || position === 'CL';
  };

  // ENHANCED: Calculate recent performance (last 4 weeks) - handles pitchers vs hitters
  const getRecentStats = () => {
    if (!stats.length) return null;
    
    console.log('All stats for recent calculation:', stats);
    
    // Sort by week and take last 4 weeks
    const sortedStats = [...stats].sort((a, b) => (b.week_number || 0) - (a.week_number || 0));
    const recentStats = sortedStats.slice(0, 4);
    
    console.log('Recent stats (last 4 weeks):', recentStats);
    
    if (recentStats.length === 0) return null;
    
    if (isPitcher()) {
      // Pitcher stats aggregation
      const totalGames = recentStats.reduce((sum, stat) => sum + (stat.games_played || 0), 0);
      const totalInnings = recentStats.reduce((sum, stat) => sum + (stat.innings_pitched || 0), 0);
      const totalEarnedRuns = recentStats.reduce((sum, stat) => sum + (stat.earned_runs || 0), 0);
      const totalWins = recentStats.reduce((sum, stat) => sum + (stat.wins || 0), 0);
      const totalLosses = recentStats.reduce((sum, stat) => sum + (stat.losses || 0), 0);
      const totalStrikeouts = recentStats.reduce((sum, stat) => sum + (stat.strikeouts_pitched || stat.strikeouts || 0), 0);
      const totalHitsAllowed = recentStats.reduce((sum, stat) => sum + (stat.hits_allowed || 0), 0);
      const totalWalksAllowed = recentStats.reduce((sum, stat) => sum + (stat.walks_allowed || 0), 0);
      const totalSaves = recentStats.reduce((sum, stat) => sum + (stat.saves || 0), 0);
      
      const era = totalInnings > 0 ? ((totalEarnedRuns * 9) / totalInnings).toFixed(2) : '0.00';
      const whip = totalInnings > 0 ? ((totalHitsAllowed + totalWalksAllowed) / totalInnings).toFixed(2) : '0.00';
      
      return {
        G: totalGames,
        IP: totalInnings.toFixed(1),
        ERA: era,
        W: totalWins,
        L: totalLosses,
        SV: totalSaves,
        SO: totalStrikeouts,
        WHIP: whip,
        isPitcher: true
      };
    } else {
      // Hitter stats aggregation
      const totalGames = recentStats.reduce((sum, stat) => sum + (stat.games_played || 0), 0);
      const totalAtBats = recentStats.reduce((sum, stat) => sum + (stat.at_bats || 0), 0);
      const totalHits = recentStats.reduce((sum, stat) => sum + (stat.hits || 0), 0);
      const totalRuns = recentStats.reduce((sum, stat) => sum + (stat.runs || 0), 0);
      const totalRbis = recentStats.reduce((sum, stat) => sum + (stat.rbis || stat.rbi || 0), 0);
      const totalHomeruns = recentStats.reduce((sum, stat) => sum + (stat.home_runs || 0), 0);
      const totalStolenBases = recentStats.reduce((sum, stat) => sum + (stat.stolen_bases || 0), 0);
      const totalWalks = recentStats.reduce((sum, stat) => sum + (stat.walks || 0), 0);
      const totalStrikeouts = recentStats.reduce((sum, stat) => sum + (stat.strikeouts || 0), 0);
      
      const avg = totalAtBats > 0 ? (totalHits / totalAtBats).toFixed(3) : '.000';
      const obp = (totalAtBats + totalWalks) > 0 ? ((totalHits + totalWalks) / (totalAtBats + totalWalks)).toFixed(3) : '.000';
      
      return {
        G: totalGames,
        AB: totalAtBats,
        H: totalHits,
        AVG: avg,
        OBP: obp,
        R: totalRuns,
        RBI: totalRbis,
        HR: totalHomeruns,
        SB: totalStolenBases,
        BB: totalWalks,
        K: totalStrikeouts,
        isPitcher: false
      };
    }
  };

  // ENHANCED: Calculate season totals - handles pitchers vs hitters
  const getSeasonStats = () => {
    if (!stats.length) return null;
    
    console.log('All stats for season calculation:', stats);
    
    // Aggregate all weeks for current season
    const currentSeason = Math.max(...stats.map(s => s.season_year));
    const seasonStats = stats.filter(s => s.season_year === currentSeason);
    
    if (seasonStats.length === 0) return null;
    
    if (isPitcher()) {
      // Pitcher season totals
      const totalGames = seasonStats.reduce((sum, stat) => sum + (stat.games_played || 0), 0);
      const totalInnings = seasonStats.reduce((sum, stat) => sum + (stat.innings_pitched || 0), 0);
      const totalEarnedRuns = seasonStats.reduce((sum, stat) => sum + (stat.earned_runs || 0), 0);
      const totalWins = seasonStats.reduce((sum, stat) => sum + (stat.wins || 0), 0);
      const totalLosses = seasonStats.reduce((sum, stat) => sum + (stat.losses || 0), 0);
      const totalSaves = seasonStats.reduce((sum, stat) => sum + (stat.saves || 0), 0);
      const totalStrikeouts = seasonStats.reduce((sum, stat) => sum + (stat.strikeouts_pitched || stat.strikeouts || 0), 0);
      const totalHitsAllowed = seasonStats.reduce((sum, stat) => sum + (stat.hits_allowed || 0), 0);
      const totalWalksAllowed = seasonStats.reduce((sum, stat) => sum + (stat.walks_allowed || 0), 0);
      
      const era = totalInnings > 0 ? ((totalEarnedRuns * 9) / totalInnings).toFixed(2) : '0.00';
      const whip = totalInnings > 0 ? ((totalHitsAllowed + totalWalksAllowed) / totalInnings).toFixed(2) : '0.00';
      
      return {
        G: totalGames,
        IP: totalInnings.toFixed(1),
        ERA: era,
        WHIP: whip,
        W: totalWins,
        L: totalLosses,
        SV: totalSaves,
        SO: totalStrikeouts,
        season: currentSeason,
        isPitcher: true
      };
    } else {
      // Hitter season totals
      const totalGames = seasonStats.reduce((sum, stat) => sum + (stat.games_played || 0), 0);
      const totalAtBats = seasonStats.reduce((sum, stat) => sum + (stat.at_bats || 0), 0);
      const totalHits = seasonStats.reduce((sum, stat) => sum + (stat.hits || 0), 0);
      const totalRuns = seasonStats.reduce((sum, stat) => sum + (stat.runs || 0), 0);
      const totalRbis = seasonStats.reduce((sum, stat) => sum + (stat.rbis || stat.rbi || 0), 0);
      const totalHomeruns = seasonStats.reduce((sum, stat) => sum + (stat.home_runs || 0), 0);
      const totalDoubles = seasonStats.reduce((sum, stat) => sum + (stat.doubles || 0), 0);
      const totalTriples = seasonStats.reduce((sum, stat) => sum + (stat.triples || 0), 0);
      const totalStolenBases = seasonStats.reduce((sum, stat) => sum + (stat.stolen_bases || 0), 0);
      const totalWalks = seasonStats.reduce((sum, stat) => sum + (stat.walks || 0), 0);
      const totalStrikeouts = seasonStats.reduce((sum, stat) => sum + (stat.strikeouts || 0), 0);
      
      const avg = totalAtBats > 0 ? (totalHits / totalAtBats).toFixed(3) : '.000';
      const obp = (totalAtBats + totalWalks) > 0 ? ((totalHits + totalWalks) / (totalAtBats + totalWalks)).toFixed(3) : '.000';
      const totalBases = totalHits + totalDoubles + (totalTriples * 2) + (totalHomeruns * 3);
      const slg = totalAtBats > 0 ? (totalBases / totalAtBats).toFixed(3) : '.000';
      const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);
      
      return {
        G: totalGames,
        AB: totalAtBats,
        H: totalHits,
        AVG: avg,
        OBP: obp,
        SLG: slg,
        OPS: ops,
        R: totalRuns,
        RBI: totalRbis,
        HR: totalHomeruns,
        '2B': totalDoubles,
        '3B': totalTriples,
        SB: totalStolenBases,
        BB: totalWalks,
        SO: totalStrikeouts,
        season: currentSeason,
        isPitcher: false
      };
    }
  };

  const recentStats = getRecentStats();
  const seasonStats = getSeasonStats();

  if (loading) {
    return (
      <div className={dynastyTheme.common.pageBackground}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dynasty-gold mx-auto mb-4"></div>
            <p className={dynastyTheme.classes.text.white}>Loading player profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className={dynastyTheme.common.pageBackground}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-dynasty-error text-xl mb-4">{error || 'Player not found'}</p>
            <button 
              onClick={() => navigate(-1)}
              className={dynastyUtils.getButtonClasses('primary', 'md')}
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
    <div className={dynastyTheme.common.pageBackground}>
      {/* Header */}
      <header className={dynastyTheme.common.headerBackground}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button 
                onClick={() => navigate(-1)}
                className={dynastyUtils.getButtonClasses('secondary', 'sm')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
              <div className="flex items-center ml-4">
                <User className={`w-8 h-8 mr-3 ${dynastyUtils.getIconClasses('primary')}`} />
                <div>
                  <h1 className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>
                    {player.first_name} {player.last_name}
                  </h1>
                  <p className={dynastyTheme.classes.text.lightGray}>
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
        <div className={`${dynastyUtils.getCardClasses('default')} mb-8`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>Player Information</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <User className={`w-4 h-4 mr-2 ${dynastyUtils.getIconClasses('primary')}`} />
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>Name:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.first_name} {player.last_name}
                  </span>
                </div>
                <div className="flex items-center">
                  <MapPin className={`w-4 h-4 mr-2 ${dynastyUtils.getIconClasses('primary')}`} />
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>Team:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.mlb_team || 'Free Agent'}
                  </span>
                </div>
                <div className="flex items-center">
                  <Target className={`w-4 h-4 mr-2 ${dynastyUtils.getIconClasses('primary')}`} />
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>Position:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.position}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>Jersey #:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.jersey_number || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Physical Stats */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>Physical</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Activity className={`w-4 h-4 mr-2 ${dynastyUtils.getIconClasses('primary')}`} />
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>Height:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {formatHeight(player.height_inches)}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>Weight:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.weight_pounds || 'N/A'} lbs
                  </span>
                </div>
                <div className="flex items-center">
                  <Calendar className={`w-4 h-4 mr-2 ${dynastyUtils.getIconClasses('primary')}`} />
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>DOB:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {formatDate(player.birthdate)} ({calculateAge(player.birthdate)})
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>B/T:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.bats || 'N/A'}/{player.throws || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>Status</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Activity className={`w-4 h-4 mr-2 ${dynastyUtils.getIconClasses('primary')}`} />
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>Status:</span>
                  <span className={`ml-1 font-medium ${player.is_active ? 'text-dynasty-success' : 'text-dynasty-error'}`}>
                    {player.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>Injury:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.injury_status || 'Healthy'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>Salary:</span>
                  <span className={`${dynastyTheme.classes.text.white} ml-1 font-medium`}>
                    {player.salary ? `$${player.salary.toLocaleString()}` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats - ENHANCED to show appropriate stats for pitchers vs hitters */}
            <div className="space-y-3">
              <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary}`}>2025 Season</h3>
              {seasonStats ? (
                <div className="space-y-2">
                  {seasonStats.isPitcher ? (
                    // Pitcher quick stats
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>ERA:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.ERA}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>WHIP:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.WHIP}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>W:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.W}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>SO:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.SO}</span>
                      </div>
                    </>
                  ) : (
                    // Hitter quick stats
                    <>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>AVG:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.AVG}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>HR:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.HR}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>RBI:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.RBI}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${dynastyTheme.classes.text.lightGray} text-sm`}>SB:</span>
                        <span className={`${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.SB}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className={`${dynastyTheme.classes.text.lightGray} text-sm`}>No stats available</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Tabs */}
        <div className={dynastyUtils.getCardClasses('default')}>
          {/* Tab Navigation */}
          <div className={`border-b ${dynastyTheme.classes.borders.gray} mb-6`}>
            <nav className="flex space-x-8">
              {[
                { id: 'recent', label: 'Recent Performance', icon: TrendingUp },
                { id: 'season', label: 'Season Stats', icon: BarChart3 },
                { id: 'weekly', label: 'Weekly Logs', icon: Clock },
                { id: 'career', label: 'Career', icon: Award }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === id
                      ? `${dynastyTheme.classes.borders.primary} ${dynastyTheme.classes.text.primary}`
                      : `border-transparent ${dynastyTheme.classes.text.lightGray} hover:${dynastyTheme.classes.text.white} hover:border-gray-300`
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
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>Recent Performance (Last 4 Weeks)</h3>
                {recentStats ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    {recentStats.isPitcher ? (
                      // Pitcher recent stats display
                      [
                        { label: 'G', value: recentStats.G },
                        { label: 'IP', value: recentStats.IP },
                        { label: 'ERA', value: recentStats.ERA },
                        { label: 'WHIP', value: recentStats.WHIP },
                        { label: 'W', value: recentStats.W },
                        { label: 'L', value: recentStats.L },
                        { label: 'SV', value: recentStats.SV },
                        { label: 'SO', value: recentStats.SO }
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <div className={`${dynastyTheme.classes.text.primary} text-2xl font-bold`}>{value}</div>
                          <div className={`${dynastyTheme.classes.text.lightGray} text-sm`}>{label}</div>
                        </div>
                      ))
                    ) : (
                      // Hitter recent stats display
                      [
                        { label: 'G', value: recentStats.G },
                        { label: 'AVG', value: recentStats.AVG },
                        { label: 'HR', value: recentStats.HR },
                        { label: 'RBI', value: recentStats.RBI },
                        { label: 'R', value: recentStats.R },
                        { label: 'SB', value: recentStats.SB },
                        { label: 'BB', value: recentStats.BB },
                        { label: 'K', value: recentStats.K }
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <div className={`${dynastyTheme.classes.text.primary} text-2xl font-bold`}>{value}</div>
                          <div className={`${dynastyTheme.classes.text.lightGray} text-sm`}>{label}</div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <p className={dynastyTheme.classes.text.lightGray}>No recent performance data available</p>
                )}
              </div>
            )}

            {activeTab === 'season' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>2025 Season Statistics</h3>
                {seasonStats ? (
                  <div className={dynastyComponents.tables.wrapper}>
                    <table className="min-w-full">
                      <thead>
                        <tr className={`border-b ${dynastyTheme.classes.borders.gray}`}>
                          {seasonStats.isPitcher ? (
                            // Pitcher season headers
                            ['G', 'IP', 'ERA', 'WHIP', 'W', 'L', 'SV', 'SO'].map(header => (
                              <th key={header} className={`text-left py-3 px-4 ${dynastyTheme.classes.text.primary} font-medium`}>
                                {header}
                              </th>
                            ))
                          ) : (
                            // Hitter season headers
                            ['G', 'AB', 'R', 'H', 'HR', 'RBI', 'SB', 'BB', 'K', 'AVG', 'OBP', 'SLG', 'OPS'].map(header => (
                              <th key={header} className={`text-left py-3 px-4 ${dynastyTheme.classes.text.primary} font-medium`}>
                                {header}
                              </th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-800">
                          {seasonStats.isPitcher ? (
                            // Pitcher season data
                            <>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.G}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.IP}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.ERA}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.WHIP}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.W}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.L}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.SV}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.SO}</td>
                            </>
                          ) : (
                            // Hitter season data
                            <>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.G}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.AB}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.R}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.H}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.HR}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.RBI}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.SB}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.BB}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{seasonStats.SO}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.AVG}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.OBP}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.SLG}</td>
                              <td className={`py-3 px-4 ${dynastyTheme.classes.text.white} font-mono`}>{seasonStats.OPS}</td>
                            </>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={dynastyTheme.classes.text.lightGray}>No season statistics available</p>
                )}
              </div>
            )}

            {activeTab === 'weekly' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>Weekly Performance Logs</h3>
                {stats.length > 0 ? (
                  <div className={dynastyComponents.tables.wrapper}>
                    <table className="min-w-full">
                      <thead>
                        <tr className={`border-b ${dynastyTheme.classes.borders.gray}`}>
                          {isPitcher() ? (
                            // Pitcher weekly headers
                            ['Week', 'Year', 'G', 'IP', 'ERA', 'W', 'L', 'SV', 'SO', 'WHIP'].map(header => (
                              <th key={header} className={`text-left py-3 px-4 ${dynastyTheme.classes.text.primary} font-medium`}>
                                {header}
                              </th>
                            ))
                          ) : (
                            // Hitter weekly headers
                            ['Week', 'Year', 'G', 'AB', 'R', 'H', 'HR', 'RBI', 'SB', 'BB', 'K'].map(header => (
                              <th key={header} className={`text-left py-3 px-4 ${dynastyTheme.classes.text.primary} font-medium`}>
                                {header}
                              </th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {stats
                          .sort((a, b) => b.season_year - a.season_year || b.week_number - a.week_number)
                          .slice(0, 20)
                          .map((stat, index) => (
                          <tr key={index} className="border-b border-gray-800">
                            <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.week_number}</td>
                            <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.season_year}</td>
                            <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.games_played || 0}</td>
                            {isPitcher() ? (
                              // Pitcher weekly data
                              <>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{(stat.innings_pitched || 0).toFixed(1)}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white} font-mono`}>
                                  {stat.innings_pitched > 0 ? ((stat.earned_runs || 0) * 9 / stat.innings_pitched).toFixed(2) : '0.00'}
                                </td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.wins || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.losses || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.saves || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.strikeouts_pitched || stat.strikeouts || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white} font-mono`}>
                                  {stat.innings_pitched > 0 ? (((stat.hits_allowed || 0) + (stat.walks_allowed || 0)) / stat.innings_pitched).toFixed(2) : '0.00'}
                                </td>
                              </>
                            ) : (
                              // Hitter weekly data
                              <>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.at_bats || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.runs || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.hits || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.home_runs || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.rbis || stat.rbi || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.stolen_bases || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.walks || 0}</td>
                                <td className={`py-3 px-4 ${dynastyTheme.classes.text.white}`}>{stat.strikeouts || 0}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className={`${dynastyTheme.classes.text.lightGray} mb-4`}>No weekly performance data available</p>
                    <p className={`${dynastyTheme.classes.text.gray} text-sm`}>
                      Statistical data will be populated when available from the database.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'career' && (
              <div>
                <h3 className={`text-lg font-semibold ${dynastyTheme.classes.text.primary} mb-4`}>Career Statistics</h3>
                <div className="space-y-4">
                  <p className={dynastyTheme.classes.text.lightGray}>Career stats aggregation coming soon...</p>
                  <p className={`${dynastyTheme.classes.text.gray} text-sm`}>
                    This will show year-by-year career totals similar to the OnRoto interface you showed.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;