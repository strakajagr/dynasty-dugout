// src/pages/league-dashboard/LeagueHome.js - COMPLETE WITH TEAM LINK DROPDOWNS
import React, { useState, useEffect } from 'react';
import { Users, Calendar, MessageSquare, Crown, AlertCircle, ArrowRight, Shield, Trophy } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';
import TeamLinkDropdown from '../../components/league-dashboard/TeamLinkDropdown';

const LeagueHome = ({ league, teams, setActiveSection, leagueId }) => {
  const [teamsWithLogos, setTeamsWithLogos] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [standingsData, setStandingsData] = useState(null);
  const [leagueBanner, setLeagueBanner] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [scoringCategories, setScoringCategories] = useState({
    hitting: ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
    pitching: ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
  });
  
  // Check if league needs setup
  const isInSetupMode = league?.league_status === 'setup' || 
                        league?.league_status === 'pricing' || 
                        league?.league_status === 'draft_ready';
  
  // Fetch league settings including banner and categories
  useEffect(() => {
    if (leagueId) {
      fetchLeagueSettings();
    }
  }, [leagueId]);

  // Fetch team data including logos
  useEffect(() => {
    if (teams && teams.length > 0 && leagueId) {
      fetchTeamsWithLogos();
    }
    if (league?.scoring_system === 'rotisserie' || league?.scoring_system === 'roto' || league?.scoring_system === 'rotisserie_ytd') {
      fetchRotisserieStandings();
    }
  }, [teams, leagueId, league?.scoring_system, scoringCategories]);

  const fetchLeagueSettings = async () => {
    if (!leagueId) return;
    
    setLoadingSettings(true);
    setSettingsError(null);
    
    try {
      console.log(`Fetching settings for league: ${leagueId}`);
      
      // Try the settings endpoint first
      const response = await leaguesAPI.getLeagueSettings(leagueId);
      
      if (response && response.success && response.settings) {
        // Set league banner
        if (response.settings.league_banner_url) {
          setLeagueBanner(response.settings.league_banner_url);
        }
        
        // Parse and set scoring categories  
        if (response.settings.scoring_categories) {
          const categories = typeof response.settings.scoring_categories === 'string'
            ? JSON.parse(response.settings.scoring_categories)
            : response.settings.scoring_categories;
          
          setScoringCategories({
            hitting: categories.hitters || categories.hitting || scoringCategories.hitting,
            pitching: categories.pitchers || categories.pitching || scoringCategories.pitching
          });
        }
      }
    } catch (error) {
      console.error('Could not fetch league settings:', error);
      
      // Try fallback to league details endpoint
      try {
        console.log('Trying fallback to league details endpoint...');
        const detailsResponse = await leaguesAPI.getLeagueDetails(leagueId);
        
        if (detailsResponse && detailsResponse.success && detailsResponse.league) {
          const leagueData = detailsResponse.league;
          
          // Try to get banner from league object
          if (leagueData.league_banner_url) {
            setLeagueBanner(leagueData.league_banner_url);
          }
          
          // Try to get categories from league object
          if (leagueData.scoring_categories) {
            const categories = typeof leagueData.scoring_categories === 'string'
              ? JSON.parse(leagueData.scoring_categories)
              : leagueData.scoring_categories;
            
            setScoringCategories({
              hitting: categories.hitters || categories.hitting || scoringCategories.hitting,
              pitching: categories.pitchers || categories.pitching || scoringCategories.pitching
            });
          }
        }
      } catch (fallbackError) {
        console.error('Fallback to league details also failed:', fallbackError);
        setSettingsError('Could not load league settings. Some features may be limited.');
        // Don't crash - continue with defaults
      }
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchTeamsWithLogos = async () => {
    if (!teams?.length || !leagueId) {
      setTeamsWithLogos([]);
      return;
    }
    
    try {
      setLoadingTeams(true);
      const response = await leaguesAPI.getLeagueTeams(leagueId);
      if (response.success && response.teams) {
        setTeamsWithLogos(response.teams);
      } else {
        setTeamsWithLogos(teams);
      }
    } catch (error) {
      console.log('Could not fetch team details:', error);
      setTeamsWithLogos(teams);
    } finally {
      setLoadingTeams(false);
    }
  };

  const fetchRotisserieStandings = async () => {
    if (!leagueId) return;
    
    try {
      // Using REAL API CALL
      const response = await leaguesAPI.getLeagueStandings(leagueId);
      
      if (response.success && response.standings) {
        // Format the real standings data
        const formattedStandings = {
          categories: response.categories || scoringCategories,
          teams: response.standings.map(team => ({
            ...team,
            stats: team.stats || {},
            totalPoints: team.total_points || team.totalPoints || 0
          }))
        };
        
        setStandingsData(formattedStandings);
      } else {
        console.error('Failed to fetch standings:', response);
      }
    } catch (error) {
      console.error('Error fetching standings:', error);
      // Don't crash - standings will just not display
    }
  };

  const getSetupMessage = () => {
    switch(league?.league_status) {
      case 'setup':
        return 'Your league is in setup mode. Continue to Season Setup to configure prices and draft settings.';
      case 'pricing':
        return 'Player prices are being configured. Visit Season Setup to complete this process.';
      case 'draft_ready':
        return 'League is ready for draft! Visit Season Setup to begin the draft process.';
      default:
        return null;
    }
  };

  // Team Logo Component
  const TeamLogo = ({ team }) => {
    if (team.team_logo_url) {
      return (
        <img 
          src={team.team_logo_url}
          alt={`${team.team_name} Logo`}
          className="w-6 h-6 rounded object-cover border border-neutral-700"
          onError={(e) => {
            e.target.style.display = 'none';
            if (e.target.nextElementSibling) {
              e.target.nextElementSibling.style.display = 'flex';
            }
          }}
        />
      );
    }

    const displayColors = team.team_colors || {};
    return (
      <div 
        className="w-6 h-6 rounded border border-neutral-700 flex items-center justify-center text-[10px] font-bold"
        style={{
          background: displayColors.primary ? 
            `linear-gradient(135deg, ${displayColors.primary}, ${displayColors.secondary || displayColors.primary})` : 
            'linear-gradient(135deg, #FFD700, #8B7500)',
          color: displayColors.text || '#000000'
        }}
      >
        {team.team_name?.substring(0, 2).toUpperCase() || 'T'}
      </div>
    );
  };

  // Rotisserie Standings Component - USES REAL DATA WITH TEAM LINKS
  const RotisserieStandings = () => {
    const [sortConfig, setSortConfig] = useState({ key: 'totalPoints', direction: 'desc' });
    
    if (!standingsData || !standingsData.teams || standingsData.teams.length === 0) {
      return (
        <div className="text-center py-8">
          <p className={dynastyTheme.classes.text.neutralLight}>
            Loading rotisserie standings...
          </p>
        </div>
      );
    }

    // Handle sorting
    const handleSort = (key) => {
      setSortConfig(prevConfig => ({
        key,
        direction: prevConfig.key === key && prevConfig.direction === 'desc' ? 'asc' : 'desc'
      }));
    };

    // Sort teams based on current sort configuration
    const sortedTeams = [...standingsData.teams].sort((a, b) => {
      let aValue, bValue;
      
      if (sortConfig.key === 'totalPoints') {
        aValue = a.totalPoints || a.total_points || 0;
        bValue = b.totalPoints || b.total_points || 0;
      } else if (sortConfig.key === 'team_name') {
        aValue = a.team_name || '';
        bValue = b.team_name || '';
      } else if (sortConfig.key.startsWith('points_')) {
        const cat = sortConfig.key.replace('points_', '');
        aValue = a.category_points?.[cat] || 0;
        bValue = b.category_points?.[cat] || 0;
      } else if (sortConfig.key.startsWith('stats_')) {
        const cat = sortConfig.key.replace('stats_', '');
        aValue = a.stats?.[cat] || 0;
        bValue = b.stats?.[cat] || 0;
      } else {
        aValue = 0;
        bValue = 0;
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    const hittingCategories = standingsData.categories.hitting;
    const pitchingCategories = standingsData.categories.pitching;
    const numTeams = standingsData.teams.length;

    // Sort indicator component
    const SortIndicator = ({ isActive, direction }) => {
      if (!isActive) return null;
      return (
        <span className="ml-1">
          {direction === 'desc' ? '▼' : '▲'}
        </span>
      );
    };

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={`${dynastyTheme.classes.bg.darkLighter} border-b ${dynastyTheme.classes.border.neutral}`}>
              <th 
                className={`py-1 px-2 text-left ${dynastyTheme.classes.text.white} font-bold sticky left-0 ${dynastyTheme.classes.bg.darkLighter} z-10 min-w-[250px] cursor-pointer hover:bg-neutral-800/50`}
                onClick={() => handleSort('team_name')}
              >
                Team
                <SortIndicator isActive={sortConfig.key === 'team_name'} direction={sortConfig.direction} />
              </th>
              
              {/* Hitting Categories */}
              {hittingCategories.map(cat => (
                <th 
                  key={cat} 
                  className={`py-1 px-1 text-center ${dynastyTheme.classes.text.primary} font-semibold min-w-[40px] text-[10px] cursor-pointer hover:bg-neutral-800/50`}
                  onClick={() => handleSort(`points_${cat}`)}
                >
                  {cat}
                  <SortIndicator isActive={sortConfig.key === `points_${cat}`} direction={sortConfig.direction} />
                </th>
              ))}
              
              {/* Separator between hitting and pitching */}
              <th className="w-[2px] p-0 bg-neutral-600"></th>
              
              {/* Pitching Categories */}
              {pitchingCategories.map(cat => (
                <th 
                  key={cat} 
                  className={`py-1 px-1 text-center ${dynastyTheme.classes.text.primary} font-semibold min-w-[40px] text-[10px] cursor-pointer hover:bg-neutral-800/50`}
                  onClick={() => handleSort(`points_${cat}`)}
                >
                  {cat}
                  <SortIndicator isActive={sortConfig.key === `points_${cat}`} direction={sortConfig.direction} />
                </th>
              ))}
              
              <th 
                className={`py-1 px-1 text-center ${dynastyTheme.classes.text.white} font-bold min-w-[45px] cursor-pointer hover:bg-neutral-800/50`}
                onClick={() => handleSort('totalPoints')}
              >
                TOTAL
                <SortIndicator isActive={sortConfig.key === 'totalPoints'} direction={sortConfig.direction} />
              </th>
              <th className={`py-1 px-1 text-center ${dynastyTheme.classes.text.success} font-bold min-w-[40px]`}>
                +/-
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team, teamIndex) => {
              const isLeader = teamIndex === 0 && sortConfig.key === 'totalPoints' && sortConfig.direction === 'desc';
              const totalPoints = team.totalPoints || team.total_points || 0;
              const leaderPoints = sortedTeams[0].totalPoints || sortedTeams[0].total_points || 0;
              
              return (
                <React.Fragment key={team.team_id}>
                  {/* Points Row - SLIGHTLY SMALLER */}
                  <tr className={`border-b ${dynastyTheme.classes.border.neutral} ${
                    isLeader ? 'bg-yellow-400/10' : 'hover:bg-neutral-800/50'
                  } transition-colors`}>
                    <td className={`py-0.5 px-2 sticky left-0 ${isLeader ? 'bg-yellow-400/10' : dynastyTheme.classes.bg.darkFlat} z-10 min-w-[250px]`}>
                      <div className="flex items-center gap-2">
                        <span className={`${dynastyTheme.classes.text.white} font-medium text-[11px] w-4`}>
                          {teamIndex + 1}.
                        </span>
                        <TeamLogo team={team} />
                        <div className="flex-1 min-w-0">
                          {/* UPDATED: Use TeamLinkDropdown instead of plain div */}
                          <TeamLinkDropdown 
                            team={team}
                            leagueId={leagueId}
                            className={`${dynastyTheme.classes.text.white} font-medium text-xs truncate block`}
                          />
                          {team.manager_name && (
                            <div className={`${dynastyTheme.classes.text.neutralLight} text-[10px] truncate`}>
                              {team.manager_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Hitting points */}
                    {hittingCategories.map(cat => {
                      const points = team.category_points?.[cat] || 
                                   (team.category_ranks?.[cat] ? (numTeams - team.category_ranks[cat] + 1) : 0);
                      const isMax = points === numTeams;
                      const isMin = points === 1;
                      return (
                        <td key={cat} className={`py-0.5 px-1 text-center text-[13px] font-bold ${
                          isMax ? dynastyTheme.classes.text.success :
                          isMin ? dynastyTheme.classes.text.error :
                          dynastyTheme.classes.text.white
                        }`}>
                          {points}
                        </td>
                      );
                    })}
                    
                    {/* Separator */}
                    <td className="w-[2px] p-0 bg-neutral-600"></td>
                    
                    {/* Pitching points */}
                    {pitchingCategories.map(cat => {
                      const points = team.category_points?.[cat] || 
                                   (team.category_ranks?.[cat] ? (numTeams - team.category_ranks[cat] + 1) : 0);
                      const isMax = points === numTeams;
                      const isMin = points === 1;
                      return (
                        <td key={cat} className={`py-0.5 px-1 text-center text-[13px] font-bold ${
                          isMax ? dynastyTheme.classes.text.success :
                          isMin ? dynastyTheme.classes.text.error :
                          dynastyTheme.classes.text.white
                        }`}>
                          {points}
                        </td>
                      );
                    })}
                    
                    <td className={`py-0.5 px-1 text-center font-bold text-sm ${dynastyTheme.classes.text.primary}`}>
                      {totalPoints}
                    </td>
                    <td className={`py-0.5 px-1 text-center font-semibold text-[12px] ${
                      teamIndex === 0 ? dynastyTheme.classes.text.success :
                      teamIndex < Math.floor(numTeams / 3) ? dynastyTheme.classes.text.warning :
                      dynastyTheme.classes.text.error
                    }`}>
                      {teamIndex === 0 && sortConfig.key === 'totalPoints' && sortConfig.direction === 'desc' ? '-' : `-${Math.abs(leaderPoints - totalPoints).toFixed(1)}`}
                    </td>
                  </tr>
                  
                  {/* Stats Row - SLIGHTLY LARGER */}
                  <tr className={`border-b ${dynastyTheme.classes.border.neutral} bg-neutral-900/50`}>
                    <td className={`py-1 px-2 sticky left-0 bg-neutral-900/50 z-10 ${dynastyTheme.classes.text.neutralLight} min-w-[250px] text-[10px]`}>
                      <span className="pl-12 italic">stats</span>
                    </td>
                    
                    {/* Hitting stats */}
                    {hittingCategories.map(cat => {
                      const value = team.stats?.[cat];
                      let displayValue = value || 0;
                      if (typeof value === 'number') {
                        if (cat === 'AVG' || cat === 'OBP' || cat === 'SLG' || cat === 'OPS') {
                          displayValue = value.toFixed(3);
                        } else if (cat === 'ERA' || cat === 'WHIP') {
                          displayValue = value.toFixed(2);
                        } else if (Number.isInteger(value)) {
                          displayValue = value;
                        } else {
                          displayValue = value.toFixed(1);
                        }
                      }
                      
                      return (
                        <td key={`${cat}-stats`} className={`py-1 px-1 text-center text-[11px] ${dynastyTheme.classes.text.neutralLight}`}>
                          {displayValue}
                        </td>
                      );
                    })}
                    
                    {/* Separator */}
                    <td className="w-[2px] p-0 bg-neutral-600"></td>
                    
                    {/* Pitching stats */}
                    {pitchingCategories.map(cat => {
                      const value = team.stats?.[cat];
                      let displayValue = value || 0;
                      if (typeof value === 'number') {
                        if (cat === 'AVG' || cat === 'OBP' || cat === 'SLG' || cat === 'OPS') {
                          displayValue = value.toFixed(3);
                        } else if (cat === 'ERA' || cat === 'WHIP') {
                          displayValue = value.toFixed(2);
                        } else if (Number.isInteger(value)) {
                          displayValue = value;
                        } else {
                          displayValue = value.toFixed(1);
                        }
                      }
                      
                      return (
                        <td key={`${cat}-stats`} className={`py-1 px-1 text-center text-[11px] ${dynastyTheme.classes.text.neutralLight}`}>
                          {displayValue}
                        </td>
                      );
                    })}
                    
                    <td colSpan="2"></td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Error Message if Settings Failed */}
      {settingsError && (
        <div className={`p-3 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center gap-2`}>
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{settingsError}</span>
        </div>
      )}

      {isInSetupMode && league?.role === 'commissioner' && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${dynastyTheme.classes.bg.primaryLight} border ${dynastyTheme.classes.border.primaryBright} ${dynastyTheme.classes.text.primary}`}>
          <AlertCircle className="w-6 h-6" />
          <span className="flex-1 font-medium">{getSetupMessage()}</span>
          <button
            onClick={() => setActiveSection('season-setup')}
            className={`${dynastyTheme.utils.getComponent('button', 'primary', 'sm')} flex items-center gap-2`}
          >
            Go to Season Setup
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* NON-COMMISSIONER SETUP NOTICE */}
      {isInSetupMode && league?.role !== 'commissioner' && (
        <div className={`p-4 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center gap-3`}>
          <AlertCircle className="w-6 h-6" />
          <span>The commissioner is currently setting up the league. You'll be notified when it's ready for action.</span>
        </div>
      )}

      {/* League Header with Banner - ENHANCED FOR MAXIMUM IMPACT */}
      <div className={`${dynastyTheme.components.card.highlighted} relative overflow-hidden min-h-[160px]`}>
        {/* League Banner Background - MADE TO POP */}
        {leagueBanner && (
          <div className="absolute inset-0">
            <img 
              src={leagueBanner}
              alt="League Banner"
              className="w-full h-full object-cover opacity-90"  // Increased opacity
              style={{
                filter: 'contrast(1.1) brightness(1.1)'  // Brighter image
              }}
              onError={(e) => {
                console.error('Failed to load league banner');
                e.target.style.display = 'none';
              }}
            />
            {/* Gradient overlay - more subtle for image visibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/20 via-transparent to-neutral-900/70"></div>
            {/* Vignette effect for depth */}
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(28,25,23,0.4) 100%)'
            }}></div>
            {/* Edge darkening for text contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/50 via-transparent to-neutral-900/50"></div>
          </div>
        )}
        
        {/* Content over banner with enhanced readability - COMPACT VERTICAL PADDING */}
        <div className="relative py-6 px-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              {/* Text with strong shadow for readability - BIGGER FONT */}
              <h1 className={`text-4xl font-bold ${dynastyTheme.classes.text.white}`}
                  style={{
                    textShadow: leagueBanner ? '2px 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)' : 'none'
                  }}>
                {league?.league_name || 'Loading...'}
              </h1>
              <p className={`text-base ${dynastyTheme.classes.text.neutralLight}`}
                 style={{
                   textShadow: leagueBanner ? '1px 1px 6px rgba(0,0,0,0.9), 0 0 15px rgba(0,0,0,0.7)' : 'none'
                 }}>
                {league?.current_week} • {league?.season} Season • {league?.scoring_system?.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {/* Badges with backdrop blur for visibility */}
              <span className={`${dynastyTheme.components.badge.success} ${leagueBanner ? 'backdrop-blur-md bg-neutral-900/60' : ''}`}>
                {league?.status?.toUpperCase() || 'LOADING'}
              </span>
              {league?.role === 'commissioner' && (
                <span className={`px-3 py-1 rounded text-sm font-semibold ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black} ${leagueBanner ? 'shadow-xl' : ''}`}>
                  COMMISSIONER
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="space-y-6">
        {/* 1. STANDINGS - Full Width */}
        <div className={dynastyTheme.components.card.base}>
          <div className={`flex items-center justify-between p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
            <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
              {(league?.scoring_system === 'rotisserie' || league?.scoring_system === 'roto' || league?.scoring_system === 'rotisserie_ytd') 
                ? 'Rotisserie Standings' 
                : 'Current League Status'} - {teams.length}/{league?.max_teams || 12} Teams
            </h3>
            <button 
              onClick={() => setActiveSection('standings')}
              className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
            >
              View Full Standings
            </button>
          </div>

          {(league?.scoring_system === 'rotisserie' || league?.scoring_system === 'roto' || league?.scoring_system === 'rotisserie_ytd') ? (
            <div className="p-4">
              <RotisserieStandings />
            </div>
          ) : (
            // Head-to-head standings (original layout)
            <div className="p-4">
              <div className="text-center py-8">
                <p className={dynastyTheme.classes.text.neutralLight}>
                  Head-to-head standings will appear here
                </p>
              </div>
            </div>
          )}
          
          {teams.length === 0 && (
            <div className="p-6 text-center">
              <Users className={`w-12 h-12 mx-auto mb-3 opacity-50 ${dynastyTheme.classes.text.neutralLight}`} />
              <h4 className={`${dynastyTheme.classes.text.white} font-semibold mb-2`}>League Setup in Progress</h4>
              <p className={`text-sm mb-4 ${dynastyTheme.classes.text.neutralLight}`}>
                This league can support up to {league?.max_teams || 12} teams. 
                Once owners join, standings will appear here.
              </p>
              {league?.role === 'commissioner' && (
                <button 
                  onClick={() => setActiveSection('league-owners')}
                  className={dynastyTheme.utils.getComponent('button', 'primary', 'sm')}
                >
                  Invite Team Owners
                </button>
              )}
            </div>
          )}
        </div>

        {/* 2. LEAGUE MESSAGES - Full Width */}
        <div className={dynastyTheme.components.card.base}>
          <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
            <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>League Message Board</h3>
          </div>
          <div className="p-6">
            <div className="text-center">
              <Crown className={`w-12 h-12 mx-auto mb-3 opacity-50 ${dynastyTheme.classes.text.primary}`} />
              <p className={`text-sm mb-3 ${dynastyTheme.classes.text.neutralLight}`}>
                There are 0 total messages and 0 unread messages
              </p>
              <button className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}>
                View and send messages
              </button>
            </div>
          </div>
        </div>

        {/* 3. LAST NIGHT'S BOX - Full Width */}
        <div className={dynastyTheme.components.card.base}>
          <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
            <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Last Night's Box Scores</h3>
          </div>
          <div className="p-6">
            <div className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No game data available yet</p>
              <p className="text-xs mt-2">Game boxes will appear here once the season starts</p>
            </div>
          </div>
        </div>

        {/* 4. THREE COLUMNS - Trading Block, MLB Transactions, Private Messages */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Trading Block */}
          <div className={dynastyTheme.components.card.base}>
            <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Current Trading Block</h3>
            </div>
            <div className="p-4">
              <div className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No players on the block</p>
                <button className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} mt-3`}>
                  Add Players
                </button>
              </div>
            </div>
          </div>

          {/* Recent MLB Transactions */}
          <div className={dynastyTheme.components.card.base}>
            <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Recent MLB Transactions</h3>
            </div>
            <div className="p-4 text-center">
              <MessageSquare className={`w-12 h-12 mx-auto mb-3 opacity-50 ${dynastyTheme.classes.text.neutralLight}`} />
              <p className={`text-sm mb-3 ${dynastyTheme.classes.text.neutralLight}`}>
                MLB transaction feed coming soon
              </p>
            </div>
          </div>

          {/* Private Messages */}
          <div className={dynastyTheme.components.card.base}>
            <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Private Messages</h3>
            </div>
            <div className="p-4 text-center">
              <MessageSquare className={`w-12 h-12 mx-auto mb-3 opacity-50 ${dynastyTheme.classes.text.neutralLight}`} />
              <p className={`text-sm mb-3 ${dynastyTheme.classes.text.neutralLight}`}>
                You have 0 unread messages
              </p>
              <button className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}>
                View messages
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeagueHome;