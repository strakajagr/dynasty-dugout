// src/pages/league-dashboard/TeamHomeDashboard.js
import React, { useState, useEffect } from 'react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable } from '../../services/tableService';
import { leaguesAPI } from '../../services/apiService';
import { User, Shield, Star, Search, Plus, Minus, ArrowRightLeft, Crown } from 'lucide-react';
import PlayerSearchDropdownLeague from '../../components/PlayerSearchDropdownLeague';
import { useNavigate } from 'react-router-dom';

const TeamHomeDashboard = ({ leagueId, teamId, currentUser, league, userTeam }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStatsTab, setActiveStatsTab] = useState('hitters');
  const [error, setError] = useState(null);
  const [teamInfo, setTeamInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeamDashboard();
    fetchTeamInfo();
  }, [leagueId, teamId]);

  const fetchTeamInfo = async () => {
    try {
      const response = await leaguesAPI.getUserTeam(leagueId);
      if (response.success) {
        setTeamInfo(response);
      }
    } catch (error) {
      console.log('Could not fetch team info:', error);
    }
  };

  const fetchTeamDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to get team data - if it fails, create empty structure
      try {
        const data = await leaguesAPI.getTeamHomeData(leagueId);
        
        // Even if no players on roster, show the dashboard structure
        setDashboardData({
          team_info: data.team_info || { 
            team_name: `Team ${currentUser?.firstName || 'Home'}`,
            team_id: teamId
          },
          roster_stats: data.roster_stats || [],
          starting_pitchers: data.starting_pitchers || [],
          player_notes: data.player_notes || [],
          last_night_box: data.last_night_box || { hitters: [], pitchers: [] }
        });
      } catch (apiError) {
        console.log('API error, using default structure:', apiError);
        // Even if API fails, show empty dashboard
        setDashboardData({
          team_info: { 
            team_name: `Team ${currentUser?.firstName || 'Home'}`,
            team_id: teamId
          },
          roster_stats: [],
          starting_pitchers: [],
          player_notes: [],
          last_night_box: { hitters: [], pitchers: [] }
        });
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to get initials from team name
  const getTeamInitials = (name) => {
    if (!name) return 'T';
    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, 2).toUpperCase();
    }
    return words.map(word => word[0]).join('').substring(0, 2).toUpperCase();
  };

  // Handler for player transactions
  const handlePlayerAdded = (player) => {
    console.log('Player added to team:', player);
    fetchTeamDashboard(); // Reload dashboard data
  };

  const handlePlayerDropped = (player) => {
    console.log('Player dropped from team:', player);
    fetchTeamDashboard(); // Reload dashboard data
  };

  if (loading) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className={`${dynastyTheme.classes.text.white} p-8 text-center`}>
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${dynastyTheme.classes.border.primary} mx-auto mb-4`}></div>
          Loading team dashboard...
        </div>
      </div>
    );
  }

  const { 
    team_info, 
    roster_stats, 
    starting_pitchers, 
    player_notes, 
    last_night_box 
  } = dashboardData || {};

  const displayTeamName = teamInfo?.team_name || team_info?.team_name || 'My Team';
  const logoUrl = teamInfo?.team_logo_url;
  const teamColors = teamInfo?.team_colors;
  const teamMotto = teamInfo?.team_motto;

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Search Bar */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-start justify-between gap-6 mb-6">
          {/* Left side: Logo and Team Info */}
          <div className="flex items-start gap-6">
            {/* Team Logo Section */}
            <div className="flex-shrink-0">
              {logoUrl ? (
                <div className="relative group">
                  <img 
                    src={logoUrl}
                    alt={`${displayTeamName} Logo`}
                    className="w-32 h-32 rounded-xl object-cover border-4 border-neutral-700 shadow-xl"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="w-32 h-32 rounded-xl border-4 border-neutral-700 shadow-xl hidden items-center justify-center text-3xl font-bold"
                    style={{
                      background: teamColors ? 
                        `linear-gradient(135deg, ${teamColors.primary || '#FFD700'}, ${teamColors.secondary || '#8B7500'})` : 
                        dynastyTheme.utils.getGradient('primary'),
                      color: teamColors?.text || '#000000'
                    }}
                  >
                    {getTeamInitials(displayTeamName)}
                  </div>
                  {/* Hover effect */}
                  <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Shield className="w-8 h-8 text-yellow-400" />
                  </div>
                </div>
              ) : (
                <div 
                  className="w-32 h-32 rounded-xl border-4 border-neutral-700 shadow-xl flex items-center justify-center text-3xl font-bold"
                  style={{
                    background: teamColors ? 
                      `linear-gradient(135deg, ${teamColors.primary || '#FFD700'}, ${teamColors.secondary || '#8B7500'})` : 
                      'linear-gradient(135deg, #FFD700, #8B7500)',
                    color: teamColors?.text || '#000000'
                  }}
                >
                  {getTeamInitials(displayTeamName)}
                </div>
              )}
            </div>

            {/* Team Info Section */}
            <div className="flex-1">
              <h1 className={`text-4xl font-bold ${dynastyTheme.classes.text.white} mb-2`}>
                {displayTeamName}
              </h1>
              {teamMotto && (
                <p className={`text-lg italic ${dynastyTheme.classes.text.neutralLight} mb-3`}>
                  "{teamMotto}"
                </p>
              )}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                  <span className={dynastyTheme.classes.text.neutralLight}>
                    Manager: <span className={dynastyTheme.classes.text.white}>
                      {teamInfo?.manager_name || currentUser?.firstName || 'Unknown'}
                    </span>
                  </span>
                </div>
                {roster_stats?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Star className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                    <span className={dynastyTheme.classes.text.neutralLight}>
                      Roster: <span className={dynastyTheme.classes.text.white}>
                        {roster_stats.length} players
                      </span>
                    </span>
                  </div>
                )}
              </div>
              
              {/* Quick Actions */}
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={() => window.location.href = `#/leagues/${leagueId}/team-setup`}
                  className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
                >
                  Edit Team
                </button>
                {roster_stats?.length === 0 && (
                  <button 
                    onClick={() => window.location.href = `#/leagues/${leagueId}/free-agents`}
                    className={dynastyTheme.utils.getComponent('button', 'primary', 'sm')}
                  >
                    Add Players
                  </button>
                )}
              </div>

              {roster_stats?.length === 0 && (
                <div className={`${dynastyTheme.components.badge.warning} inline-block mt-4`}>
                  No players on roster yet - Add players from Free Agents
                </div>
              )}
            </div>
          </div>

          {/* Right side: Player Search with Roster Status */}
          <div className="flex-shrink-0">
            <PlayerSearchDropdownLeague 
              leagueId={leagueId}
              league={league}
              userTeam={userTeam || teamInfo}
              onPlayerAdded={handlePlayerAdded}
              onPlayerDropped={handlePlayerDropped}
              showRosterStatus={true}
              compact={false}
            />
          </div>
        </div>

        {/* Search Instructions */}
        <div className={`mt-4 p-3 ${dynastyTheme.classes.bg.darkLighter} rounded-lg`}>
          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} flex items-center gap-6`}>
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded ${dynastyTheme.classes.bg.success} flex items-center justify-center`}>
                <Plus className="w-4 h-4 text-black" />
              </div>
              <span>Add Free Agent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded ${dynastyTheme.classes.bg.error} flex items-center justify-center`}>
                <Minus className="w-4 h-4 text-white" />
              </div>
              <span>Drop from Roster</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded ${dynastyTheme.classes.bg.primary} flex items-center justify-center`}>
                <ArrowRightLeft className="w-4 h-4 text-black" />
              </div>
              <span>Trade (On Another Team)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Row: Last Night's Box (Full Width) */}
      <LastNightBox boxData={last_night_box} />

      {/* Middle Row: Starting Pitchers + Player Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StartingPitchers starters={starting_pitchers} rosterPlayers={roster_stats} />
        <PlayerNotes notes={player_notes} rosterPlayers={roster_stats} />
      </div>

      {/* Bottom Row: Three-Line Stats Table */}
      <ThreeLineStatsTable 
        rosterStats={roster_stats}
        activeTab={activeStatsTab}
        setActiveTab={setActiveStatsTab}
      />
    </div>
  );
};

const LastNightBox = ({ boxData }) => {
  const [activeTab, setActiveTab] = useState('hitters');
  
  if (!boxData || (!boxData.hitters?.length && !boxData.pitchers?.length)) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h3 className={dynastyTheme.components.heading.h3}>📊 Last Night's Box Scores</h3>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-12`}>
            <div className="text-5xl mb-3">🌙</div>
            <p className="text-lg">No games played yesterday</p>
            <p className={`text-sm mt-2 ${dynastyTheme.classes.text.neutralLighter}`}>
              Your players' performances will appear here after games
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hitterColumns = [
    { key: 'name', title: 'Player', width: 150, sortable: false },
    { key: 'team', title: 'Tm', width: 50 },
    { key: 'position', title: 'Pos', width: 60 },
    { key: 'ab', title: 'AB', width: 40 },
    { key: 'r', title: 'R', width: 40 },
    { key: 'h', title: 'H', width: 40 },
    { key: 'hr', title: 'HR', width: 40 },
    { key: 'rbi', title: 'RBI', width: 50 },
    { key: 'bb', title: 'BB', width: 40 },
    { key: 'so', title: 'SO', width: 40 },
    { key: 'avg', title: 'AVG', width: 60 },
    { 
      key: 'fantasy_points', 
      title: 'PTS', 
      width: 60,
      render: (value) => (
        <span className={dynastyTheme.classes.text.success}>
          {value?.toFixed(1) || '0.0'}
        </span>
      )
    }
  ];

  const pitcherColumns = [
    { key: 'name', title: 'Player', width: 150, sortable: false },
    { key: 'team', title: 'Tm', width: 50 },
    { key: 'w', title: 'W', width: 40 },
    { key: 'l', title: 'L', width: 40 },
    { key: 'sv', title: 'SV', width: 40 },
    { key: 'ip', title: 'IP', width: 50 },
    { key: 'h', title: 'H', width: 40 },
    { key: 'er', title: 'ER', width: 40 },
    { key: 'bb', title: 'BB', width: 40 },
    { key: 'so', title: 'SO', width: 40 },
    { key: 'era', title: 'ERA', width: 60 },
    { 
      key: 'fantasy_points', 
      title: 'PTS', 
      width: 60,
      render: (value) => (
        <span className={dynastyTheme.classes.text.success}>
          {value?.toFixed(1) || '0.0'}
        </span>
      )
    }
  ];

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className="p-6">
        <h3 className={dynastyTheme.components.heading.h3}>📊 Last Night's Box Scores</h3>
        
        {/* Tab Headers */}
        <div className={`flex border-b ${dynastyTheme.classes.border.neutral} mb-4`}>
          <button
            onClick={() => setActiveTab('hitters')}
            className={`px-4 py-2 font-medium ${dynastyTheme.classes.transition} ${
              activeTab === 'hitters'
                ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primary}`
                : dynastyTheme.classes.text.neutralLight
            }`}
          >
            Hitters ({boxData.hitters?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('pitchers')}
            className={`px-4 py-2 font-medium ${dynastyTheme.classes.transition} ml-6 ${
              activeTab === 'pitchers'
                ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primary}`
                : dynastyTheme.classes.text.neutralLight
            }`}
          >
            Pitchers ({boxData.pitchers?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'hitters' ? (
          <DynastyTable
            data={boxData.hitters || []}
            columns={hitterColumns}
            maxHeight="300px"
            initialSort={{ key: 'fantasy_points', direction: 'desc' }}
          />
        ) : (
          <DynastyTable
            data={boxData.pitchers || []}
            columns={pitcherColumns}
            maxHeight="300px"
            initialSort={{ key: 'fantasy_points', direction: 'desc' }}
          />
        )}
      </div>
    </div>
  );
};

const StartingPitchers = ({ starters, rosterPlayers = [] }) => {
  // Get player IDs from roster
  const rosterPlayerIds = rosterPlayers.map(p => p.player_id);
  
  // Mark which starters are on roster
  const startersWithRosterFlag = (starters || []).map(starter => ({
    ...starter,
    on_roster: rosterPlayerIds.includes(starter.player_id)
  }));

  // Separate roster pitchers from others
  const rosterStarters = startersWithRosterFlag.filter(s => s.on_roster);
  const otherStarters = startersWithRosterFlag.filter(s => !s.on_roster);

  if (!startersWithRosterFlag.length) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h3 className={dynastyTheme.components.heading.h3}>⚾ Today's Starting Pitchers</h3>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-12`}>
            <div className="text-5xl mb-3">⚾</div>
            <p className="text-lg">No games today</p>
            <p className={`text-sm mt-2 ${dynastyTheme.classes.text.neutralLighter}`}>
              Starting pitchers will appear here on game days
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className="p-6">
        <h3 className={dynastyTheme.components.heading.h3}>⚾ Today's Starting Pitchers</h3>
        
        <div className="space-y-4 mt-4">
          {/* Your Pitchers - Highlighted */}
          {rosterStarters.length > 0 && (
            <div>
              <h4 className={`text-sm font-bold ${dynastyTheme.classes.text.primary} mb-3`}>
                YOUR STARTERS ({rosterStarters.length})
              </h4>
              <div className="space-y-2">
                {rosterStarters.map((starter, idx) => (
                  <StarterCard key={idx} starter={starter} isHighlighted={true} />
                ))}
              </div>
            </div>
          )}

          {/* All Other Starters */}
          {otherStarters.length > 0 && (
            <div>
              <h4 className={`text-sm font-bold ${dynastyTheme.classes.text.neutralLight} mb-3`}>
                ALL STARTERS ({otherStarters.length})
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {otherStarters.slice(0, 15).map((starter, idx) => (
                  <StarterCard key={idx} starter={starter} isHighlighted={false} />
                ))}
                {otherStarters.length > 15 && (
                  <div className={`${dynastyTheme.classes.text.neutralLighter} text-xs text-center py-2`}>
                    ... and {otherStarters.length - 15} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StarterCard = ({ starter, isHighlighted }) => {
  return (
    <div className={`
      p-3 rounded-lg border ${dynastyTheme.classes.transition}
      ${isHighlighted 
        ? `${dynastyTheme.classes.bg.primaryLight} ${dynastyTheme.classes.border.primary} border-2` 
        : `bg-neutral-800/50 ${dynastyTheme.classes.border.neutral}`
      }
    `}>
      <div className="flex justify-between items-center">
        <div>
          <div className={`font-medium ${
            isHighlighted ? dynastyTheme.classes.text.primary : dynastyTheme.classes.text.white
          }`}>
            {starter.player_name}
          </div>
          <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
            {starter.mlb_team} {starter.is_home ? 'vs' : '@'} {starter.opposing_team}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
            {starter.game_time || 'TBD'}
          </div>
          {isHighlighted && (
            <div className={`text-xs font-bold ${dynastyTheme.classes.text.primary}`}>
              ON ROSTER
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PlayerNotes = ({ notes, rosterPlayers = [] }) => {
  // Filter notes for roster players only
  const rosterPlayerIds = rosterPlayers.map(p => p.player_id);
  const rosterNotes = (notes || []).filter(note => 
    rosterPlayerIds.includes(note.player_id)
  );

  if (!rosterNotes.length) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h3 className={dynastyTheme.components.heading.h3}>📰 Player Notes</h3>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-12`}>
            <div className="text-5xl mb-3">📰</div>
            <p className="text-lg">No recent news</p>
            <p className={`text-sm mt-2 ${dynastyTheme.classes.text.neutralLighter}`}>
              Updates about your players will appear here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className="p-6">
        <h3 className={dynastyTheme.components.heading.h3}>📰 Player Notes</h3>
        
        <div className="space-y-3 max-h-80 overflow-y-auto mt-4">
          {rosterNotes.slice(0, 10).map((note, index) => (
            <div key={index} className={`
              p-3 rounded-lg border ${dynastyTheme.classes.border.neutral} 
              bg-neutral-800/50 hover:bg-neutral-700/50 
              ${dynastyTheme.classes.transition}
            `}>
              <div className="flex justify-between items-start mb-2">
                <div className={`font-medium ${dynastyTheme.classes.text.white}`}>
                  {note.player_name}
                </div>
                <span className={`
                  px-2 py-1 rounded-full text-xs font-medium
                  ${note.note_type === 'injury' 
                    ? dynastyTheme.components.badge.error
                    : note.note_type === 'news'
                    ? dynastyTheme.components.badge.info
                    : dynastyTheme.components.badge.warning
                  }
                `}>
                  {note.note_type?.toUpperCase() || 'NEWS'}
                </span>
              </div>
              
              <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                {note.content?.substring(0, 150)}...
              </div>
              
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLighter} mt-2`}>
                {note.source || 'MLB'} • {new Date(note.date || Date.now()).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// THREE-LINE STATS TABLE (Season, Last 14 Days, Accrued on Team)
const ThreeLineStatsTable = ({ rosterStats, activeTab, setActiveTab }) => {
  if (!rosterStats?.length) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h3 className={dynastyTheme.components.heading.h3}>📈 Roster Statistics</h3>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-12`}>
            <div className="text-5xl mb-3">📈</div>
            <p className="text-lg">No players on roster</p>
            <p className={`text-sm mt-2 ${dynastyTheme.classes.text.neutralLighter}`}>
              Add players from the Free Agents page to build your team
            </p>
            <button 
              onClick={() => window.location.href = '#/free-agents'}
              className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} mt-4`}
            >
              Browse Free Agents
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Separate hitters and pitchers
  const hitters = rosterStats.filter(player => 
    !['SP', 'RP', 'CP', 'P'].includes(player.position)
  );
  const pitchers = rosterStats.filter(player => 
    ['SP', 'RP', 'CP', 'P'].includes(player.position)
  );

  // Create columns for three-line display
  const hitterColumns = [
    { 
      key: 'player_name', 
      title: 'Player', 
      width: 160, 
      sortable: false,
      render: (value, row) => (
        <div>
          <div className={dynastyTheme.classes.text.white}>{value}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>Season Total:</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning} mt-1`}>Last 14 Days:</div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary} mt-1`}>On Your Team:</div>
        </div>
      )
    },
    { key: 'position', title: 'Pos', width: 50 },
    { key: 'mlb_team', title: 'Team', width: 60 },
    { 
      key: 'games', 
      title: 'G', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.games || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.games || 0}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.games || 0}
          </div>
        </div>
      )
    },
    { 
      key: 'avg', 
      title: 'AVG', 
      width: 70,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.batting_avg?.toFixed(3) || '.000'}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.batting_avg?.toFixed(3) || '.000'}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.batting_avg?.toFixed(3) || '.000'}
          </div>
        </div>
      )
    },
    { 
      key: 'home_runs', 
      title: 'HR', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.home_runs || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.home_runs || 0}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.home_runs || 0}
          </div>
        </div>
      )
    },
    { 
      key: 'rbi', 
      title: 'RBI', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.rbi || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.rbi || 0}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.rbi || 0}
          </div>
        </div>
      )
    },
    { 
      key: 'runs', 
      title: 'R', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.runs || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.runs || 0}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.runs || 0}
          </div>
        </div>
      )
    },
    { 
      key: 'stolen_bases', 
      title: 'SB', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.stolen_bases || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.stolen_bases || 0}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.stolen_bases || 0}
          </div>
        </div>
      )
    }
  ];

  const pitcherColumns = [
    { 
      key: 'player_name', 
      title: 'Player', 
      width: 160, 
      sortable: false,
      render: (value, row) => (
        <div>
          <div className={dynastyTheme.classes.text.white}>{value}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-1`}>Season Total:</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning} mt-1`}>Last 14 Days:</div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary} mt-1`}>On Your Team:</div>
        </div>
      )
    },
    { key: 'mlb_team', title: 'Team', width: 60 },
    { 
      key: 'wins', 
      title: 'W', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.wins || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.wins || 0}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.wins || 0}
          </div>
        </div>
      )
    },
    { 
      key: 'saves', 
      title: 'SV', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.saves || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.saves || 0}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.saves || 0}
          </div>
        </div>
      )
    },
    { 
      key: 'era', 
      title: 'ERA', 
      width: 70,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.era?.toFixed(2) || '0.00'}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.era?.toFixed(2) || '0.00'}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.era?.toFixed(2) || '0.00'}
          </div>
        </div>
      )
    },
    { 
      key: 'whip', 
      title: 'WHIP', 
      width: 70,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.whip?.toFixed(3) || '0.000'}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.whip?.toFixed(3) || '0.000'}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.whip?.toFixed(3) || '0.000'}
          </div>
        </div>
      )
    },
    { 
      key: 'strikeouts', 
      title: 'K', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.strikeouts_pitched || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
            {row.last_14_days?.strikeouts_pitched || 0}
          </div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>
            {row.team_stats?.strikeouts_pitched || 0}
          </div>
        </div>
      )
    }
  ];

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className="p-6">
        <h3 className={dynastyTheme.components.heading.h3}>📈 Roster Performance</h3>
        
        {/* Tab Headers */}
        <div className={`flex border-b ${dynastyTheme.classes.border.neutral} mb-4`}>
          <button
            onClick={() => setActiveTab('hitters')}
            className={`px-4 py-2 font-medium ${dynastyTheme.classes.transition} ${
              activeTab === 'hitters'
                ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primary}`
                : dynastyTheme.classes.text.neutralLight
            }`}
          >
            Hitters ({hitters.length})
          </button>
          <button
            onClick={() => setActiveTab('pitchers')}
            className={`px-4 py-2 font-medium ${dynastyTheme.classes.transition} ml-6 ${
              activeTab === 'pitchers'
                ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primary}`
                : dynastyTheme.classes.text.neutralLight
            }`}
          >
            Pitchers ({pitchers.length})
          </button>
        </div>

        {/* Legend */}
        <div className={`text-xs mb-4 p-3 ${dynastyTheme.classes.bg.darkLighter} rounded-lg flex gap-6`}>
          <div className={dynastyTheme.classes.text.neutralLight}>
            <span className="font-bold">White:</span> Full Season
          </div>
          <div className={dynastyTheme.classes.text.warning}>
            <span className="font-bold">Orange:</span> Last 14 Days
          </div>
          <div className={dynastyTheme.classes.text.primary}>
            <span className="font-bold">Yellow:</span> Accrued on Your Team
          </div>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'hitters' ? (
          hitters.length > 0 ? (
            <DynastyTable
              data={hitters}
              columns={hitterColumns}
              maxHeight="500px"
              initialSort={{ key: 'home_runs', direction: 'desc' }}
            />
          ) : (
            <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-8`}>
              No hitters on roster
            </div>
          )
        ) : (
          pitchers.length > 0 ? (
            <DynastyTable
              data={pitchers}
              columns={pitcherColumns}
              maxHeight="500px"
              initialSort={{ key: 'wins', direction: 'desc' }}
            />
          ) : (
            <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-8`}>
              No pitchers on roster
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default TeamHomeDashboard;