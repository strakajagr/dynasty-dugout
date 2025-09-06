// src/components/dashboard/TickerBar.js
import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';

const TickerBar = ({ leagues = [] }) => {
  const [tickerAlerts, setTickerAlerts] = useState([]);

  useEffect(() => {
    loadTickerAlerts();
  }, [leagues]);

  const loadTickerAlerts = async () => {
    try {
      const alerts = [];
      
      // Try to fetch transactions from all user's leagues
      if (leagues && leagues.length > 0) {
        for (const league of leagues) {
          try {
            // Attempt to get recent transactions
            const response = await leaguesAPI.getRecentActivity(league.league_id, 48);
            
            if (response && response.activities && response.activities.length > 0) {
              response.activities.forEach(activity => {
                alerts.push({
                  id: `${league.league_id}-${activity.id}`,
                  text: `[${league.league_name}] ${activity.text}`,
                  priority: activity.priority || 'medium'
                });
              });
            }
          } catch (e) {
            console.error(`Failed to load activity for league ${league.league_id}:`, e);
          }
        }
      }
      
      // If no transactions yet, show league status updates
      if (alerts.length === 0 && leagues && leagues.length > 0) {
        leagues.forEach((league, index) => {
          const statusMessages = {
            'setup': `⚙️ [${league.league_name}] League in setup mode - awaiting configuration`,
            'pricing': `💰 [${league.league_name}] Setting player prices - commissioner working on salary structure`,
            'draft_ready': `📋 [${league.league_name}] Ready to draft! Teams can start building rosters`,
            'drafting': `🎯 [${league.league_name}] Draft in progress - teams are selecting players`,
            'active': `✅ [${league.league_name}] Season active - ${league.current_teams || 0}/${league.max_teams} teams competing`
          };
          
          const message = statusMessages[league.league_status] || `📊 [${league.league_name}] Status: ${league.league_status}`;
          
          alerts.push({
            id: `status-${league.league_id}`,
            text: message,
            priority: league.league_status === 'pricing' || league.league_status === 'draft_ready' ? 'high' : 'medium'
          });
          
          // Add team count info if relevant
          if (league.league_status === 'setup' || league.league_status === 'pricing') {
            const openSlots = (league.max_teams || 12) - (league.current_teams || 0);
            if (openSlots > 0) {
              alerts.push({
                id: `slots-${league.league_id}`,
                text: `👥 [${league.league_name}] ${openSlots} team slot${openSlots !== 1 ? 's' : ''} still available`,
                priority: 'low'
              });
            }
          }
        });
      }
      
      // If still no alerts (user has no leagues), show welcome message
      if (alerts.length === 0) {
        alerts.push({
          id: 'welcome',
          text: '👋 Welcome to Dynasty Dugout! Create or join a league to get started',
          priority: 'medium'
        });
      }
      
      setTickerAlerts(alerts);
    } catch (error) {
      console.error('Error loading ticker:', error);
      setTickerAlerts([{
        id: 'error',
        text: '⚠️ Unable to load league updates',
        priority: 'low'
      }]);
    }
  };

  return (
    <div className={`${dynastyTheme.classes.bg.dark} border-b ${dynastyTheme.classes.border.primary} overflow-hidden`}>
      <div className="relative flex">
        <div className="flex items-center px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black">
          <Bell className="w-4 h-4 mr-2" />
          <span className="font-semibold text-sm">LIVE</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex animate-scroll">
            <div className="flex items-center whitespace-nowrap px-4">
              {tickerAlerts.concat(tickerAlerts).map((alert, idx) => (
                <span key={`${alert.id}-${idx}`} className={`text-sm ${dynastyTheme.classes.text.white} mx-8`}>
                  {alert.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default TickerBar;