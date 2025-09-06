// src/pages/league-dashboard/LeagueStandings.js - COMPLETE WITH TEAM LINK DROPDOWNS
import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, TrendingUp } from 'lucide-react';
import { dynastyTheme, dynastyTokens } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';
import TeamLinkDropdown from '../../components/league-dashboard/TeamLinkDropdown';

const LeagueStandings = ({ league, teams, leagueId }) => {
  const [standingsData, setStandingsData] = useState(null);
  const [currentWeekData, setCurrentWeekData] = useState(null);
  const [teamsWithLogos, setTeamsWithLogos] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [scoringCategories, setScoringCategories] = useState({
    hitting: ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
    pitching: ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
  });
  
  // Fetch league settings for dynamic categories
  useEffect(() => {
    fetchLeagueSettings();
  }, [leagueId]);
  
  // Fetch team data including logos
  useEffect(() => {
    fetchTeamsWithLogos();
  }, [teams, leagueId]);
  
  useEffect(() => {
    if ((league?.scoring_system === 'rotisserie' || 
         league?.scoring_system === 'roto' || 
         league?.scoring_system === 'rotisserie_ytd') && 
        teamsWithLogos.length > 0) {
      fetchAllStandings();
    }
  }, [league?.scoring_system, teamsWithLogos, scoringCategories]);

  const fetchLeagueSettings = async () => {
    try {
      const response = await leaguesAPI.getLeagueSettings(leagueId);
      if (response.success && response.settings) {
        // Parse and set scoring categories from database
        if (response.settings.scoring_categories) {
          const categories = typeof response.settings.scoring_categories === 'string'
            ? JSON.parse(response.settings.scoring_categories)
            : response.settings.scoring_categories;
          
          setScoringCategories({
            hitting: categories.hitters || categories.hitting || scoringCategories.hitting,
            pitching: categories.pitchers || categories.pitching || scoringCategories.pitching
          });
        } else if (response.league?.rotisserie_hitting_categories) {
          // Fallback to league object if present
          setScoringCategories({
            hitting: response.league.rotisserie_hitting_categories || response.league.hitting_categories || scoringCategories.hitting,
            pitching: response.league.rotisserie_pitching_categories || response.league.pitching_categories || scoringCategories.pitching
          });
        }
      }
    } catch (error) {
      console.log('Could not fetch league settings, using defaults:', error);
    }
  };

  const fetchTeamsWithLogos = async () => {
    if (!leagueId) {
      setTeamsWithLogos([]);
      return;
    }
    
    try {
      setLoadingData(true);
      const response = await leaguesAPI.getLeagueTeams(leagueId);
      if (response.success && response.teams) {
        setTeamsWithLogos(response.teams);
      } else {
        // Fallback to fetching individual team data
        const teamsWithDetails = await Promise.all(
          teams.map(async (team) => {
            try {
              const teamResponse = await leaguesAPI.getTeamRoster(leagueId, team.team_id);
              return {
                ...team,
                team_logo_url: teamResponse.team?.team_logo_url || team.team_logo_url,
                team_colors: teamResponse.team?.team_colors || team.team_colors
              };
            } catch (e) {
              return team;
            }
          })
        );
        setTeamsWithLogos(teamsWithDetails);
      }
    } catch (error) {
      console.log('Could not fetch team details:', error);
      setTeamsWithLogos(teams);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchAllStandings = async () => {
    try {
      const teamsToUse = teamsWithLogos.length > 0 ? teamsWithLogos : teams;

      // Try to fetch real standings first
      try {
        const standingsResponse = await leaguesAPI.getLeagueStandings(leagueId);
        
        if (standingsResponse.success && standingsResponse.standings) {
          // Format the real standings data
          const formattedStandings = {
            categories: standingsResponse.categories || scoringCategories,
            teams: standingsResponse.standings.map(team => ({
              ...team,
              stats: team.stats || {},
              totalPoints: team.total_points || team.totalPoints || 0,
              category_points: team.category_points || {},
              category_ranks: team.category_ranks || {}
            }))
          };
          
          setStandingsData(formattedStandings);
          // For now, use same data for week - should have separate API endpoint
          setCurrentWeekData(formattedStandings); 
          return;
        }
      } catch (apiError) {
        console.log('Using mock data as fallback:', apiError);
      }
      
      // Fallback to mock data if API fails
      const seasonStandings = createStandingsData(teamsToUse, scoringCategories, 'season');
      setStandingsData(seasonStandings);
      
      const weekStandings = createStandingsData(teamsToUse, scoringCategories, 'week');
      setCurrentWeekData(weekStandings);
      
    } catch (error) {
      console.error('Error fetching standings:', error);
    }
  };

  const createStandingsData = (teamsToUse, scoringCats, period) => {
    const standings = {
      categories: scoringCats,
      teams: teamsToUse.map((team) => {
        const teamStats = {};
        const allCats = [...scoringCats.hitting, ...scoringCats.pitching];
        
        // Generate values for each category
        allCats.forEach(cat => {
          let value;
          // Adjust ranges based on period (week has smaller numbers)
          const multiplier = period === 'week' ? 0.1 : 1;
          
          switch(cat) {
            case 'AVG':
            case 'OBP':
            case 'SLG':
              value = (Math.random() * 0.05 + 0.250).toFixed(3);
              break;
            case 'OPS':
              value = (Math.random() * 0.100 + 0.700).toFixed(3);
              break;
            case 'ERA':
              value = (Math.random() * 1.5 + 3.0).toFixed(2);
              break;
            case 'WHIP':
              value = (Math.random() * 0.3 + 1.1).toFixed(2);
              break;
            case 'R':
            case 'RBI':
              value = Math.floor((Math.random() * 100 + 600) * multiplier);
              break;
            case 'HR':
              value = Math.floor((Math.random() * 50 + 150) * multiplier);
              break;
            case 'SB':
            case 'SV':
              value = Math.floor((Math.random() * 30 + 20) * multiplier);
              break;
            case 'W':
              value = Math.floor((Math.random() * 20 + 60) * multiplier);
              break;
            case 'SO':
            case 'K':
              value = Math.floor((Math.random() * 200 + 900) * multiplier);
              break;
            case 'QS':
              value = Math.floor((Math.random() * 30 + 70) * multiplier);
              break;
            default:
              value = Math.floor((Math.random() * 100) * multiplier);
          }
          teamStats[cat] = { value: value, rank: 0 };
        });
        
        return {
          ...team,
          team_logo_url: team.team_logo_url,
          team_colors: team.team_colors,
          stats: teamStats
        };
      })
    };
    
    // Calculate rankings dynamically
    const numTeams = standings.teams.length;
    const allCategories = [...scoringCats.hitting, ...scoringCats.pitching];
    
    allCategories.forEach(cat => {
      // Categories where lower is better
      const isReversed = ['ERA', 'WHIP', 'BAA', 'BB', 'BB/9'].includes(cat);
      const sorted = [...standings.teams].sort((a, b) => {
        const aVal = parseFloat(a.stats[cat].value);
        const bVal = parseFloat(b.stats[cat].value);
        return isReversed ? aVal - bVal : bVal - aVal;
      });
      
      sorted.forEach((team, index) => {
        const teamIndex = standings.teams.findIndex(t => t.team_id === team.team_id);
        standings.teams[teamIndex].stats[cat].rank = numTeams - index;
        
        // Also add category_points for compatibility
        if (!standings.teams[teamIndex].category_points) {
          standings.teams[teamIndex].category_points = {};
        }
        standings.teams[teamIndex].category_points[cat] = numTeams - index;
      });
    });
    
    // Calculate total points
    standings.teams.forEach(team => {
      team.totalPoints = allCategories.reduce((sum, cat) => sum + team.stats[cat].rank, 0);
    });
    
    return standings;
  };

  // Team Logo Component
  const TeamLogo = ({ team, size = 'small' }) => {
    const sizeClasses = size === 'small' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
      
    if (team.team_logo_url) {
      return (
        <>
          <img 
            src={team.team_logo_url}
            alt={`${team.team_name} Logo`}
            className={`${sizeClasses} rounded object-cover border border-neutral-700`}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
          <div 
            className={`${sizeClasses} rounded border border-neutral-700 hidden items-center justify-center font-bold`}
            style={{
              background: team.team_colors?.primary ? 
                `linear-gradient(135deg, ${team.team_colors.primary}, ${team.team_colors.secondary || team.team_colors.primary})` : 
                `linear-gradient(135deg, ${dynastyTokens.colors.primary}, ${dynastyTokens.colors.primaryDark})`,
              color: team.team_colors?.text || dynastyTokens.colors.neutral[900],
              display: 'none'
            }}
          >
            {team.team_name?.substring(0, 2).toUpperCase() || 'T'}
          </div>
        </>
      );
    }

    return (
      <div 
        className={`${sizeClasses} rounded border border-neutral-700 flex items-center justify-center font-bold`}
        style={{
          background: team.team_colors?.primary ? 
            `linear-gradient(135deg, ${team.team_colors.primary}, ${team.team_colors.secondary || team.team_colors.primary})` : 
            'linear-gradient(135deg, #FFD700, #8B7500)',
          color: team.team_colors?.text || '#000000'
        }}
      >
        {team.team_name?.substring(0, 2).toUpperCase() || 'T'}
      </div>
    );
  };

  // UPDATED Rotisserie Standings Table Component - WITH TEAM LINKS
  const RotisserieTable = ({ data, title, icon: Icon }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'totalPoints', direction: 'desc' });
    
    if (!data) return null;

    // Handle sorting
    const handleSort = (key) => {
      setSortConfig(prevConfig => ({
        key,
        direction: prevConfig.key === key && prevConfig.direction === 'desc' ? 'asc' : 'desc'
      }));
    };

    // Sort teams based on current sort configuration
    const sortedTeams = [...data.teams].sort((a, b) => {
      let aValue, bValue;
      
      if (sortConfig.key === 'totalPoints') {
        aValue = a.totalPoints || a.total_points || 0;
        bValue = b.totalPoints || b.total_points || 0;
      } else if (sortConfig.key === 'team_name') {
        aValue = a.team_name || '';
        bValue = b.team_name || '';
      } else if (sortConfig.key.startsWith('points_')) {
        const cat = sortConfig.key.replace('points_', '');
        aValue = a.category_points?.[cat] || a.stats?.[cat]?.rank || 0;
        bValue = b.category_points?.[cat] || b.stats?.[cat]?.rank || 0;
      } else if (sortConfig.key.startsWith('stats_')) {
        const cat = sortConfig.key.replace('stats_', '');
        const aVal = a.stats?.[cat]?.value || a.stats?.[cat] || 0;
        const bVal = b.stats?.[cat]?.value || b.stats?.[cat] || 0;
        aValue = typeof aVal === 'object' ? aVal.value : aVal;
        bValue = typeof bVal === 'object' ? bVal.value : bVal;
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

    const hittingCategories = data.categories.hitting;
    const pitchingCategories = data.categories.pitching;
    const numTeams = data.teams.length;

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
      <div className={dynastyTheme.components.card.base}>
        <div className={`flex items-center justify-between p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
          <div className="flex items-center gap-3">
            <Icon className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
            <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
              {title}
            </h3>
          </div>
          {title.includes('Current') && (
            <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
              {league?.current_week || 'Week 1'}
            </span>
          )}
        </div>
        
        <div className="p-4 overflow-x-auto">
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
                    {/* Points Row - COMPACT HEIGHT */}
                    <tr className={`border-b ${dynastyTheme.classes.border.neutral} ${
                      isLeader ? 'bg-yellow-400/10' : 'hover:bg-neutral-800/50'
                    } transition-colors`}>
                      <td className={`py-0.5 px-2 sticky left-0 ${isLeader ? 'bg-yellow-400/10' : dynastyTheme.classes.bg.darkFlat} z-10 min-w-[250px]`}>
                        <div className="flex items-center gap-2">
                          <span className={`${dynastyTheme.classes.text.white} font-medium text-[11px] w-4`}>
                            {teamIndex + 1}.
                          </span>
                          <TeamLogo team={team} size="small" />
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
                        const points = team.category_points?.[cat] || team.stats?.[cat]?.rank || 0;
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
                        const points = team.category_points?.[cat] || team.stats?.[cat]?.rank || 0;
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
                        const statData = team.stats?.[cat];
                        const value = typeof statData === 'object' ? statData.value : (team.stats?.[cat] || 0);
                        
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
                        const statData = team.stats?.[cat];
                        const value = typeof statData === 'object' ? statData.value : (team.stats?.[cat] || 0);
                        
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
      </div>
    );
  };

  // Non-rotisserie standings (head-to-head) WITH TEAM LINKS
  const HeadToHeadStandings = () => {
    const getAllTeamSlots = () => {
      const maxTeams = league?.max_teams || 12;
      const allSlots = [];
      
      for (let slotNumber = 1; slotNumber <= maxTeams; slotNumber++) {
        const activeTeam = teamsWithLogos.find((team, index) => index + 1 === slotNumber);
        
        if (activeTeam) {
          allSlots.push({
            ...activeTeam,
            slot: slotNumber,
            status: 'active',
            isEmpty: false
          });
        } else {
          allSlots.push({
            slot: slotNumber,
            team_name: `Team ${slotNumber}`,
            manager_name: null,
            wins: null,
            losses: null,
            ties: null,
            points: null,
            status: 'empty',
            isEmpty: true
          });
        }
      }
      return allSlots;
    };

    const allTeamSlots = getAllTeamSlots();

    return (
      <div className={dynastyTheme.components.card.base}>
        <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
          <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
            Head-to-Head Standings
          </h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${dynastyTheme.classes.border.neutral}`}>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Rank</th>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Team</th>
                  <th className={`text-center p-3 ${dynastyTheme.classes.text.white} font-semibold`}>W</th>
                  <th className={`text-center p-3 ${dynastyTheme.classes.text.white} font-semibold`}>L</th>
                  <th className={`text-center p-3 ${dynastyTheme.classes.text.white} font-semibold`}>T</th>
                  <th className={`text-center p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Pts</th>
                  <th className={`text-center p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {allTeamSlots.map((team, index) => (
                  <tr key={index} className={`border-b hover:bg-black/20 ${dynastyTheme.classes.transition} ${dynastyTheme.classes.border.neutral}`}>
                    <td className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>{team.slot}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {!team.isEmpty && <TeamLogo team={team} size="small" />}
                        <div>
                          {/* UPDATED: Use TeamLinkDropdown for active teams */}
                          {team.status === 'active' ? (
                            <TeamLinkDropdown 
                              team={team}
                              leagueId={leagueId}
                              className={dynastyTheme.classes.text.white}
                            />
                          ) : (
                            <div className={`${dynastyTheme.classes.text.neutralLighter} italic`}>
                              {team.team_name}
                            </div>
                          )}
                          {team.manager_name && (
                            <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                              {team.manager_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`p-3 text-center ${dynastyTheme.classes.text.white}`}>
                      {team.wins !== null ? team.wins : '-'}
                    </td>
                    <td className={`p-3 text-center ${dynastyTheme.classes.text.white}`}>
                      {team.losses !== null ? team.losses : '-'}
                    </td>
                    <td className={`p-3 text-center ${dynastyTheme.classes.text.white}`}>
                      {team.ties !== null ? team.ties : '-'}
                    </td>
                    <td className={`p-3 text-center ${dynastyTheme.classes.text.white} font-bold`}>
                      {team.points !== null ? team.points : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={
                        team.status === 'active' 
                          ? dynastyTheme.components.badge.success
                          : dynastyTheme.components.badge.info
                      }>
                        {team.status === 'active' ? 'Active' : 'Empty'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h2 className={dynastyTheme.components.heading.h2}>
            {(league?.scoring_system === 'rotisserie' || 
              league?.scoring_system === 'roto' || 
              league?.scoring_system === 'rotisserie_ytd') ? 'Rotisserie' : 'League'} Standings
          </h2>
          <p className={dynastyTheme.classes.text.neutralLight}>
            {league?.league_name} • {league?.season} Season • {teams.length}/{league?.max_teams || 12} Teams
          </p>
          {scoringCategories && (
            <p className={`text-xs mt-2 ${dynastyTheme.classes.text.neutralLight}`}>
              Categories: {[...scoringCategories.hitting, ...scoringCategories.pitching].join(', ')}
            </p>
          )}
        </div>
      </div>

      {(league?.scoring_system === 'rotisserie' || 
        league?.scoring_system === 'roto' || 
        league?.scoring_system === 'rotisserie_ytd') ? (
        <>
          {/* Season-Long Standings */}
          <RotisserieTable 
            data={standingsData} 
            title="Season Standings - Overall" 
            icon={Trophy}
          />
          
          {/* Current Week Standings */}
          <RotisserieTable 
            data={currentWeekData} 
            title="Current Week Standings" 
            icon={Calendar}
          />
        </>
      ) : (
        <HeadToHeadStandings />
      )}
    </div>
  );
};

export default LeagueStandings;