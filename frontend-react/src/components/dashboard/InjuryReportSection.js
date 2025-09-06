// src/components/dashboard/InjuryReportSection.js
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable, createInjuryReportColumns } from '../../services/tableService';

const InjuryReportSection = () => {
  const [injuryReport, setInjuryReport] = useState([]);
  const [loadingInjuries, setLoadingInjuries] = useState(true);

  useEffect(() => {
    loadInjuryReport();
  }, []);

  const loadInjuryReport = async () => {
    try {
      setLoadingInjuries(true);
      
      setInjuryReport([
        { player_id: 20, name: 'Gerrit Cole', position: 'SP', team: 'NYY', 
          status: 'IL-15', injury: 'Elbow inflammation', return_date: 'Sep 5' },
        { player_id: 21, name: 'Jazz Chisholm', position: '2B', team: 'MIA', 
          status: 'DTD', injury: 'Hamstring tightness', return_date: 'Day-to-day' },
        { player_id: 22, name: 'Carlos Correa', position: 'SS', team: 'MIN', 
          status: 'IL-10', injury: 'Back spasms', return_date: 'Sep 2' },
        { player_id: 23, name: 'Shane Bieber', position: 'SP', team: 'CLE', 
          status: 'IL-60', injury: 'Tommy John surgery', return_date: '2026' }
      ]);
      
    } catch (error) {
      console.error('Error loading injury report:', error);
    } finally {
      setLoadingInjuries(false);
    }
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
      </div>
      <DynastyTable
        data={injuryReport}
        columns={createInjuryReportColumns()}
        maxHeight="250px"
        enableHorizontalScroll={false}
        enableVerticalScroll={true}
        stickyHeader={false}
      />
    </div>
  );
};

export default InjuryReportSection;