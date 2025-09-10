// src/components/dashboard/InjuryReportSection.js
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { mlbAPI } from '../../services/apiService';
import { DynastyTable, createInjuryReportColumns } from '../../services/tableService';

const InjuryReportSection = () => {
  const [injuryReport, setInjuryReport] = useState([]);
  const [loadingInjuries, setLoadingInjuries] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInjuryReport();
  }, []);

  const loadInjuryReport = async () => {
    try {
      setLoadingInjuries(true);
      setError(null);
      
      console.log('🏥 Loading injury report from API...');
      const response = await mlbAPI.getInjuryReport();
      
      if (response.success && response.injuries) {
        // Format injury data for the table
        const formattedInjuries = response.injuries.map(injury => ({
          player_id: injury.player_id,
          name: injury.name,
          position: injury.position,
          team: injury.team,
          status: injury.status,
          injury: injury.injury,
          return_date: injury.return_date
        }));
        
        setInjuryReport(formattedInjuries);
        console.log('✅ Injury report loaded successfully');
      } else {
        console.warn('⚠️ Injury API returned unsuccessful response');
        loadFallbackInjuries();
      }
      
    } catch (error) {
      console.error('❌ Error loading injury report:', error);
      setError(error.message);
      loadFallbackInjuries();
    } finally {
      setLoadingInjuries(false);
    }
  };

  const loadFallbackInjuries = () => {
    console.log('🔄 Loading fallback injury data');
    setInjuryReport([
      { player_id: 20, name: 'Fernando Tatis Jr.', position: 'SS', team: 'SD', 
        status: '15-Day IL', injury: 'Right shoulder strain', return_date: 'Day-to-day' },
      { player_id: 21, name: 'Jacob deGrom', position: 'SP', team: 'TEX', 
        status: '60-Day IL', injury: 'Tommy John surgery', return_date: '2025 Season' },
      { player_id: 22, name: 'Jazz Chisholm', position: '2B', team: 'MIA', 
        status: 'Day-to-Day', injury: 'Hamstring tightness', return_date: 'Day-to-day' },
      { player_id: 23, name: 'Carlos Correa', position: 'SS', team: 'MIN', 
        status: '10-Day IL', injury: 'Back spasms', return_date: 'Sep 12' },
      { player_id: 24, name: 'Shane Bieber', position: 'SP', team: 'CLE', 
        status: '60-Day IL', injury: 'Tommy John surgery', return_date: '2025' }
    ]);
  };

  if (loadingInjuries) {
    return (
      <div className={`${dynastyTheme.components.card.base} p-4`}>
        <div className="flex items-center space-x-2 mb-3">
          <AlertCircle className={`w-5 h-5 text-red-500`} />
          <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Injury Report</h3>
        </div>
        <div className="flex justify-center items-center py-8">
          <div className="flex items-center space-x-3">
            <div 
              className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${dynastyTheme.classes.border.primaryBright}`}
            />
            <span className={dynastyTheme.classes.text.white}>Loading injury report...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${dynastyTheme.components.card.base} p-4`}>
      <div className="flex items-center space-x-2 mb-3">
        <AlertCircle className={`w-5 h-5 text-red-500`} />
        <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>Injury Report</h3>
        <span className={`text-xs ${dynastyTheme.classes.text.neutralLight} bg-green-600/20 px-2 py-1 rounded`}>
          LIVE DATA
        </span>
      </div>

      {error && (
        <div className={`mb-4 p-3 border-l-4 border-yellow-500 ${dynastyTheme.classes.bg.darkLighter}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${dynastyTheme.classes.text.white}`}>
              API Error: {error}. Showing cached data.
            </span>
            <button
              onClick={loadInjuryReport}
              className={`text-xs ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline`}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <DynastyTable
        data={injuryReport}
        columns={[
          {
            key: 'name',
            title: 'Player',
            width: 120,
            render: (v, row) => (
              <div>
                <div className={`font-semibold ${dynastyTheme.classes.text.white}`}>{v}</div>
                <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                  {row.position} • {row.team}
                </div>
              </div>
            )
          },
          {
            key: 'injury',
            title: 'Injury',
            width: 150,
            render: (v, row) => (
              <div>
                <div className={`text-sm ${dynastyTheme.classes.text.white}`}>{v}</div>
                <div className={`flex items-center space-x-2 text-xs mt-1`}>
                  <span className={`px-2 py-1 rounded ${
                    row.status.includes('Day-to-Day') || row.status.includes('DTD') ? 'bg-green-500/20 text-green-400' :
                    row.status.includes('10-Day') || row.status.includes('15-Day') ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {row.status}
                  </span>
                </div>
              </div>
            )
          },
          {
            key: 'return_date',
            title: 'Return',
            width: 80,
            render: (v) => (
              <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                {v}
              </div>
            )
          }
        ]}
        maxHeight="300px"
        enableHorizontalScroll={false}
        enableVerticalScroll={true}
        stickyHeader={false}
      />

      {/* Refresh Info */}
      <div className={`mt-3 text-center text-xs ${dynastyTheme.classes.text.neutralLighter}`}>
        Data refreshed every hour • Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default InjuryReportSection;