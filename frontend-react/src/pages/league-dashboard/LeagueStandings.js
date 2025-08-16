// src/pages/league-dashboard/LeagueStandings.js
import React from 'react';
import { Trophy } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

const LeagueStandings = ({ league, teams }) => {
  
  // Helper function to create slots from teams data (competitive)
  const getAllTeamSlotsForStandings = () => {
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

  const allTeamSlots = getAllTeamSlotsForStandings();
  
  return (
    <div className={dynastyTheme.components.card.base}>
      <div className={`p-6 border-b ${dynastyTheme.classes.border.neutral}`}>
        <h2 className={dynastyTheme.components.heading.h2}>League Standings</h2>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Current season standings - {teams.length}/{league?.max_teams || 12} teams joined
        </p>
      </div>
      <div className="p-6">
        {allTeamSlots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${dynastyTheme.classes.border.neutral}`}>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Rank</th>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Team</th>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Manager</th>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Points</th>
                  <th className={`text-left p-3 ${dynastyTheme.classes.text.white} font-semibold`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {allTeamSlots.map((team, index) => (
                  <tr key={index} className={`border-b hover:bg-black/20 ${dynastyTheme.classes.transition} ${dynastyTheme.classes.border.neutral}`}>
                    <td className={`p-3 ${dynastyTheme.classes.text.white} font-semibold`}>{team.slot}</td>
                    <td className={`p-3 ${team.status === 'empty' ? dynastyTheme.classes.text.neutralLighter + ' italic' : dynastyTheme.classes.text.white}`}>
                      {team.team_name}
                    </td>
                    <td className={`p-3 ${dynastyTheme.classes.text.neutralLight}`}>
                      {team.manager_name || '-'}
                    </td>
                    <td className={`p-3 ${dynastyTheme.classes.text.white}`}>
                      {team.points !== null ? team.points : '-'}
                    </td>
                    <td className="p-3">
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
        ) : (
          <div className="text-center py-12">
            <Trophy className={`w-16 h-16 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLight}`} />
            <h3 className={`text-xl font-semibold mb-2 ${dynastyTheme.classes.text.white}`}>No Teams Yet</h3>
            <p className={dynastyTheme.classes.text.neutralLight}>
              Standings will appear here once team owners join the league.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueStandings;