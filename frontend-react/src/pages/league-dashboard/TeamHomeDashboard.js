// src/pages/league-dashboard/TeamHomeDashboard.js
import React, { useState, useEffect } from 'react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable } from '../../services/tableService';

const TeamHomeDashboard = ({ leagueId, currentUser }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStatsTab, setActiveStatsTab] = useState('hitters');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTeamDashboard();
  }, [leagueId]);

  const fetchTeamDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Updated API endpoint to match new backend
      const response = await fetch(
        `/api/leagues/${leagueId}/team-home-data`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to load dashboard data');
      }

      if (!data.has_team) {
        setError(data.message || 'No team found for this league');
        return;
      }

      setDashboardData(data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className={`${dynastyTheme.classes.text.white} p-8 text-center`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-4"></div>
          Loading team dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className={`${dynastyTheme.classes.text.error} p-8 text-center`}>
          <h3 className="text-lg font-semibold mb-2">Dashboard Error</h3>
          <p>{error}</p>
          <button 
            onClick={fetchTeamDashboard}
            className={`${dynastyTheme.utils.getComponent('button', 'primary', 'sm')} mt-4`}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Updated destructuring to match new backend response structure
  const { 
    team_info, 
    roster_stats, 
    starting_pitchers, 
    player_notes, 
    last_night_box 
  } = dashboardData || {};

  return (
    <div className="space-y-6">
      {/* Team Name Header */}
      <div className={dynastyTheme.components.heading.h2}>
        {team_info?.team_name || 'Team Home'} - Dashboard
      </div>

      {/* Top Row: Last Night's Box (Full Width) */}
      <LastNightBox boxData={last_night_box} />

      {/* Middle Row: Starting Pitchers + Player Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StartingPitchers starters={starting_pitchers} />
        <PlayerNotes notes={player_notes} />
      </div>

      {/* Bottom Row: Two-Line Accumulated Stats */}
      <TwoLineStatsTable 
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
        <div className={`${dynastyTheme.classes.text.white} p-4`}>
          <h3 className={dynastyTheme.components.heading.h3}>📊 Last Night's Box Scores</h3>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-8`}>
            <div className="text-4xl mb-2">🌙</div>
            <p>No games played yesterday or no active players.</p>
            <p className="text-sm mt-2">Player performances will appear here after games.</p>
          </div>
        </div>
      </div>
    );
  }

  // Create table columns for hitters and pitchers
  const hitterColumns = [
    { key: 'name', title: 'Name', width: 120, sortable: false },
    { key: 'team', title: 'Tm', width: 50 },
    { key: 'position', title: 'Pos', width: 50 },
    { key: 'ab', title: 'AB', width: 40 },
    { key: 'r', title: 'R', width: 40 },
    { key: 'h', title: 'H', width: 40 },
    { key: 'rbi', title: 'RBI', width: 50 },
    { key: 'bb', title: 'BB', width: 40 },
    { key: 'so', title: 'SO', width: 40 },
    { key: 'avg', title: 'AVG', width: 60 },
    { 
      key: 'fantasy_points', 
      title: 'PTS', 
      width: 50,
      render: (value) => <span className={dynastyTheme.classes.text.success}>{value?.toFixed(1) || '0.0'}</span>
    }
  ];

  const pitcherColumns = [
    { key: 'name', title: 'Name', width: 120, sortable: false },
    { key: 'team', title: 'Tm', width: 50 },
    { key: 'w', title: 'W', width: 40 },
    { key: 'l', title: 'L', width: 40 },
    { key: 'sv', title: 'SV', width: 40 },
    { key: 'ip', title: 'IP', width: 50 },
    { key: 'er', title: 'ER', width: 40 },
    { key: 'era', title: 'ERA', width: 60 },
    { 
      key: 'fantasy_points', 
      title: 'PTS', 
      width: 50,
      render: (value) => <span className={dynastyTheme.classes.text.success}>{value?.toFixed(1) || '0.0'}</span>
    }
  ];

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className={`${dynastyTheme.classes.text.white} p-4`}>
        <h3 className={dynastyTheme.components.heading.h3}>📊 Last Night's Box Scores</h3>
        <div className={`text-sm ${dynastyTheme.classes.text.neutralLight} mb-4`}>
          {boxData.date && `Performance for ${new Date(boxData.date).toLocaleDateString()}`}
        </div>
        
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
        <div className="overflow-x-auto">
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
    </div>
  );
};

const StartingPitchers = ({ starters }) => {
  if (!starters?.length) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className={`${dynastyTheme.classes.text.white} p-4`}>
          <h3 className={dynastyTheme.components.heading.h3}>⚾ Today's Starting Pitchers</h3>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-8`}>
            <div className="text-4xl mb-2">⚾</div>
            <p>No games scheduled today or starting pitchers not yet announced.</p>
          </div>
        </div>
      </div>
    );
  }

  // Separate roster pitchers from others
  const rosterStarters = starters.filter(s => s.on_roster);
  const otherStarters = starters.filter(s => !s.on_roster);

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className={`${dynastyTheme.classes.text.white} p-4`}>
        <h3 className={dynastyTheme.components.heading.h3}>⚾ Today's Starting Pitchers</h3>
        
        <div className="space-y-4">
          {/* Your Pitchers */}
          {rosterStarters.length > 0 && (
            <div>
              <h4 className={`text-sm font-semibold ${dynastyTheme.classes.text.primary} mb-2`}>
                YOUR PITCHERS ({rosterStarters.length})
              </h4>
              <div className="space-y-2">
                {rosterStarters.map((starter, index) => (
                  <StarterCard key={`roster-${starter.player_id}-${index}`} starter={starter} isRosterPlayer={true} />
                ))}
              </div>
            </div>
          )}

          {/* All Other Starters */}
          {otherStarters.length > 0 && (
            <div>
              <h4 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight} mb-2`}>
                ALL STARTERS ({otherStarters.length})
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {otherStarters.slice(0, 10).map((starter, index) => (
                  <StarterCard key={`other-${starter.player_id}-${index}`} starter={starter} isRosterPlayer={false} />
                ))}
                {otherStarters.length > 10 && (
                  <div className={`${dynastyTheme.classes.text.neutralLight} text-xs text-center py-2`}>
                    ... and {otherStarters.length - 10} more
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

const StarterCard = ({ starter, isRosterPlayer }) => {
  const formatGameTime = (timeString) => {
    if (!timeString) return 'TBD';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        timeZone: 'America/New_York'
      });
    } catch {
      return timeString;
    }
  };

  return (
    <div className={`
      p-3 rounded-lg border ${dynastyTheme.classes.transition}
      ${isRosterPlayer 
        ? `${dynastyTheme.classes.bg.primaryLight} ${dynastyTheme.classes.border.primary} border-2` 
        : `bg-neutral-800/50 ${dynastyTheme.classes.border.neutral}`
      }
    `}>
      <div className="flex justify-between items-center">
        <div>
          <div className={`font-medium ${isRosterPlayer ? dynastyTheme.classes.text.primary : dynastyTheme.classes.text.white}`}>
            {starter.player_name}
          </div>
          <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
            {starter.mlb_team} {starter.is_home ? 'vs' : '@'} {starter.opposing_team}
          </div>
          {starter.matchup_rating && (
            <div className={`text-xs ${dynastyTheme.classes.text.warning}`}>
              Rating: {starter.matchup_rating}
            </div>
          )}
        </div>
        <div className={`text-right text-sm ${dynastyTheme.classes.text.neutralLight}`}>
          {formatGameTime(starter.game_time)}
          {isRosterPlayer && (
            <div className={`text-xs ${dynastyTheme.classes.text.primary} font-semibold`}>
              ON ROSTER
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PlayerNotes = ({ notes }) => {
  if (!notes?.length) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className={`${dynastyTheme.classes.text.white} p-4`}>
          <h3 className={dynastyTheme.components.heading.h3}>📰 Player Notes</h3>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-8`}>
            <div className="text-4xl mb-2">📰</div>
            <p>No recent news for your players.</p>
            <p className="text-sm mt-2">Player updates and news will appear here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className={`${dynastyTheme.classes.text.white} p-4`}>
        <h3 className={dynastyTheme.components.heading.h3}>📰 Player Notes</h3>
        
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {notes.slice(0, 8).map((note, index) => (
            <div key={note.note_id || index} className={`
              p-3 rounded-lg border ${dynastyTheme.classes.border.neutral} 
              bg-neutral-800/50 hover:bg-neutral-700/50 
              ${dynastyTheme.classes.transition}
            `}>
              <div className="flex justify-between items-start mb-2">
                <div className={`font-medium ${dynastyTheme.classes.text.white}`}>
                  {note.player_name}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`
                    px-2 py-1 rounded-full text-xs font-medium
                    ${note.note_type === 'injury' 
                      ? dynastyTheme.components.badge.error
                      : note.note_type === 'trade'
                      ? dynastyTheme.components.badge.warning
                      : dynastyTheme.components.badge.info
                    }
                  `}>
                    {note.note_type?.toUpperCase() || 'NEWS'}
                  </span>
                  {note.severity && (
                    <span className={`
                      px-2 py-1 rounded-full text-xs font-medium
                      ${note.severity === 'high'
                        ? dynastyTheme.components.badge.error
                        : note.severity === 'medium'
                        ? dynastyTheme.components.badge.warning
                        : dynastyTheme.components.badge.success
                      }
                    `}>
                      {note.severity.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              
              <div className={`text-sm ${dynastyTheme.classes.text.white} mb-2`}>
                {note.title}
              </div>
              
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                {note.content && note.content.length > 120 
                  ? `${note.content.substring(0, 120)}...` 
                  : note.content || 'No additional details available.'
                }
              </div>
              
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-2 flex justify-between`}>
                <span>{note.source || 'Dynasty Dugout'}</span>
                <span>{note.publish_date ? new Date(note.publish_date).toLocaleDateString() : 'Today'}</span>
              </div>
            </div>
          ))}
          
          {notes.length > 8 && (
            <div className={`${dynastyTheme.classes.text.neutralLight} text-center text-sm py-2`}>
              ... and {notes.length - 8} more notes
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Updated component name and logic to handle new TwoLinePlayerStats structure
const TwoLineStatsTable = ({ rosterStats, activeTab, setActiveTab }) => {
  if (!rosterStats?.length) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className={`${dynastyTheme.classes.text.white} p-4`}>
          <h3 className={dynastyTheme.components.heading.h3}>📈 Team vs Season Performance</h3>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-8`}>
            <div className="text-4xl mb-2">📈</div>
            <p>No players on roster yet.</p>
            <p className="text-sm mt-2">Players will appear here once added to your team.</p>
          </div>
        </div>
      </div>
    );
  }

  // Separate hitters and pitchers based on position
  const hitters = rosterStats.filter(player => 
    !['SP', 'RP', 'CP', 'P'].includes(player.position)
  );
  const pitchers = rosterStats.filter(player => 
    ['SP', 'RP', 'CP', 'P'].includes(player.position)
  );

  // Create columns for the two-line display - Updated to match new data structure
  const hitterColumns = [
    { 
      key: 'player_name', 
      title: 'Player', 
      width: 140, 
      sortable: false,
      render: (value, row) => (
        <div>
          <div className={dynastyTheme.classes.text.white}>{value}</div>
          <div className={`text-xs italic ${dynastyTheme.classes.text.primary}`}>
            On Your Team:
          </div>
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
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.games || 0}</div>
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
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.batting_avg?.toFixed(3) || '.000'}</div>
        </div>
      )
    },
    { 
      key: 'hits', 
      title: 'H', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.hits || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.hits || 0}</div>
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
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.home_runs || 0}</div>
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
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.rbi || 0}</div>
        </div>
      )
    },
    { 
      key: 'acquisition_date', 
      title: 'Acquired', 
      width: 80,
      render: (value, row) => (
        <div className="text-xs">
          <div className={dynastyTheme.classes.text.neutralLight}>
            {value ? new Date(value).toLocaleDateString() : 'N/A'}
          </div>
          <div className={dynastyTheme.classes.text.neutralLight}>
            {row.acquisition_method || 'Unknown'}
          </div>
          {row.team_stats?.days_on_team && (
            <div className={`${dynastyTheme.classes.text.primary} text-xs`}>
              {row.team_stats.days_on_team} days
            </div>
          )}
        </div>
      )
    }
  ];

  const pitcherColumns = [
    { 
      key: 'player_name', 
      title: 'Player', 
      width: 140, 
      sortable: false,
      render: (value, row) => (
        <div>
          <div className={dynastyTheme.classes.text.white}>{value}</div>
          <div className={`text-xs italic ${dynastyTheme.classes.text.primary}`}>
            On Your Team:
          </div>
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
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.wins || 0}</div>
        </div>
      )
    },
    { 
      key: 'losses', 
      title: 'L', 
      width: 50,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.losses || 0}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.losses || 0}</div>
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
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.saves || 0}</div>
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
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.era?.toFixed(2) || '0.00'}</div>
        </div>
      )
    },
    { 
      key: 'innings', 
      title: 'IP', 
      width: 60,
      render: (value, row) => (
        <div>
          <div>{row.season_stats?.innings_pitched?.toFixed(1) || '0.0'}</div>
          <div className={`text-xs ${dynastyTheme.classes.text.primary}`}>{row.team_stats?.innings_pitched?.toFixed(1) || '0.0'}</div>
        </div>
      )
    },
    { 
      key: 'acquisition_date', 
      title: 'Acquired', 
      width: 80,
      render: (value, row) => (
        <div className="text-xs">
          <div className={dynastyTheme.classes.text.neutralLight}>
            {value ? new Date(value).toLocaleDateString() : 'N/A'}
          </div>
          <div className={dynastyTheme.classes.text.neutralLight}>
            {row.acquisition_method || 'Unknown'}
          </div>
          {row.team_stats?.days_on_team && (
            <div className={`${dynastyTheme.classes.text.primary} text-xs`}>
              {row.team_stats.days_on_team} days
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div className={dynastyTheme.components.card.base}>
      <div className={`${dynastyTheme.classes.text.white} p-4`}>
        <h3 className={dynastyTheme.components.heading.h3}>📈 Team vs Season Performance</h3>
        
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

        {/* Instruction Text */}
        <div className={`text-xs mb-4 p-2 ${dynastyTheme.classes.bg.neutralDark} rounded`}>
          <div className={dynastyTheme.classes.text.neutralLight}>
            <strong>Two-Line Display:</strong> Top line shows full season stats, bottom line shows stats accumulated while on your team
          </div>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'hitters' ? (
          hitters.length > 0 ? (
            <DynastyTable
              data={hitters}
              columns={hitterColumns}
              maxHeight="400px"
              title="Roster Hitters - Season vs Team Performance"
              initialSort={{ key: 'acquisition_date', direction: 'desc' }}
            />
          ) : (
            <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-8`}>
              <p>No hitters on roster</p>
            </div>
          )
        ) : (
          pitchers.length > 0 ? (
            <DynastyTable
              data={pitchers}
              columns={pitcherColumns}
              maxHeight="400px"
              title="Roster Pitchers - Season vs Team Performance"
              initialSort={{ key: 'acquisition_date', direction: 'desc' }}
            />
          ) : (
            <div className={`${dynastyTheme.classes.text.neutralLight} text-center py-8`}>
              <p>No pitchers on roster</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default TeamHomeDashboard;