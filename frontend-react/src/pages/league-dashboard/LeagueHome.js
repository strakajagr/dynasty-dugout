// src/pages/league-dashboard/LeagueHome.js
import React from 'react';
import { Users, Calendar, MessageSquare, Crown } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

const LeagueHome = ({ league, teams, setActiveSection }) => {
  
  // Helper function to create slots from teams data (competitive)
  const getAllTeamSlotsForHome = () => {
    const maxTeams = league?.max_teams || 12;
    const allSlots = [];
    
    for (let slotNumber = 1; slotNumber <= maxTeams; slotNumber++) {
      const activeTeam = teams.find((team, index) => index + 1 === slotNumber);
      
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
          points: null,
          status: 'empty',
          isEmpty: true
        });
      }
    }
    
    return allSlots;
  };

  const allTeamSlots = getAllTeamSlotsForHome();
  const halfPoint = Math.ceil(allTeamSlots.length / 2);
  const leftColumn = allTeamSlots.slice(0, halfPoint);
  const rightColumn = allTeamSlots.slice(halfPoint);

  return (
    <div className="space-y-6">
      {/* League Header */}
      <div className={`${dynastyTheme.components.card.base} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className={`text-3xl font-bold ${dynastyTheme.classes.text.white}`}>
              {league?.league_name || 'Loading...'}
            </h1>
            <p className={dynastyTheme.classes.text.neutralLight}>
              {league?.current_week} • {league?.season} Season • {league?.scoring_system?.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={dynastyTheme.components.badge.success}>
              {league?.status?.toUpperCase() || 'LOADING'}
            </span>
            {league?.role === 'commissioner' && (
              <span className={`px-3 py-1 rounded text-sm font-semibold ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black}`}>
                COMMISSIONER
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Standings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overall Standings */}
          <div className={dynastyTheme.components.card.base}>
            <div className={`flex items-center justify-between p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
                Current League Status - {teams.length}/{league?.max_teams || 12} Teams
              </h3>
              <button 
                onClick={() => setActiveSection('standings')}
                className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
              >
                View Full Standings
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`text-left border-b ${dynastyTheme.classes.border.neutral}`}>
                    <th className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Team</th>
                    <th className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Pts</th>
                    <th className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Team</th>
                    <th className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {leftColumn.map((team, index) => {
                    const rightTeam = rightColumn[index];
                    return (
                      <tr key={index} className={`border-b hover:bg-black/20 ${dynastyTheme.classes.transition} ${dynastyTheme.classes.border.neutral}`}>
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <span className={`${dynastyTheme.classes.text.white} font-medium`}>{team.slot}.</span>
                            <span className={team.status === 'empty' ? dynastyTheme.classes.text.neutralLighter + ' italic' : dynastyTheme.classes.text.white}>
                              {team.team_name}
                            </span>
                            {team.manager_name && (
                              <span className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                                ({team.manager_name})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`p-3 ${dynastyTheme.classes.text.white}`}>
                          {team.points !== null ? team.points : '-'}
                        </td>
                        <td className="p-3">
                          {rightTeam && (
                            <div className="flex items-center space-x-2">
                              <span className={`${dynastyTheme.classes.text.white} font-medium`}>{rightTeam.slot}.</span>
                              <span className={rightTeam.status === 'empty' ? dynastyTheme.classes.text.neutralLighter + ' italic' : dynastyTheme.classes.text.white}>
                                {rightTeam.team_name}
                              </span>
                              {rightTeam.manager_name && (
                                <span className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                                  ({rightTeam.manager_name})
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={`p-3 ${dynastyTheme.classes.text.white}`}>
                          {rightTeam && rightTeam.points !== null ? rightTeam.points : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
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

          {/* ✅ NEW: League Messages - MOVED HERE */}
          <div className={dynastyTheme.components.card.base}>
            <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>League Messages</h3>
            </div>
            <div className="p-4 text-center">
              <Crown className={`w-12 h-12 mx-auto mb-3 opacity-50 ${dynastyTheme.classes.text.primary}`} />
              <p className={`text-sm mb-3 ${dynastyTheme.classes.text.neutralLight}`}>
                There are 0 total messages and 0 unread messages
              </p>
              <button className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}>
                Click here to view and send league messages
              </button>
            </div>
          </div>

          {/* Current Trading Block */}
          <div className={dynastyTheme.components.card.base}>
            <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Current Trading Block</h3>
            </div>
            <div className="p-4">
              <div className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No players currently on the trading block</p>
                <button className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} mt-3`}>
                  Add Players to Trading Block
                </button>
              </div>
            </div>
          </div>

          {/* Last Night's Box */}
          <div className={dynastyTheme.components.card.base}>
            <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>Last Night's Box</h3>
            </div>
            <div className="p-4">
              <div className={`text-center py-8 ${dynastyTheme.classes.text.neutralLight}`}>
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No game data available yet</p>
                <p className="text-xs mt-2">Game boxes will appear here once the season starts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Secondary Info */}
        <div className="space-y-6">
          {/* League Information */}
          <div className={dynastyTheme.components.card.base}>
            <div className={`p-4 border-b ${dynastyTheme.classes.border.neutral}`}>
              <h3 className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>League Information</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className={dynastyTheme.classes.text.neutralLight}>Scoring:</span>
                <span className={dynastyTheme.classes.text.white}>{league?.scoring_system?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={dynastyTheme.classes.text.neutralLight}>Player Pool:</span>
                <span className={dynastyTheme.classes.text.white}>{league?.player_pool?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={dynastyTheme.classes.text.neutralLight}>Max Teams:</span>
                <span className={dynastyTheme.classes.text.white}>{league?.max_teams}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={dynastyTheme.classes.text.neutralLight}>Salary Cap:</span>
                <span className={dynastyTheme.classes.text.white}>
                  {league?.use_salaries ? `$${league?.salary_cap}` : 'None'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={dynastyTheme.classes.text.neutralLight}>Created:</span>
                <span className={dynastyTheme.classes.text.white}>
                  {league?.created_at ? new Date(league.created_at).toLocaleDateString() : '-'}
                </span>
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
                You have 0 total messages and 0 unread messages
              </p>
              <button className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}>
                Click here to view and send private messages
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeagueHome;