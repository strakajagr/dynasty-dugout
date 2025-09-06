// src/components/player/PlayerContractTab.js - FIXED WITH COLOR SERVICE
import React from 'react';
import { DollarSign, Clock, Calendar, TrendingUp, Users, FileText, Shield, Award } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

const PlayerContractTab = ({ contractInfo, teamAttributionData }) => {
  if (!contractInfo) {
    return (
      <div className={dynastyTheme.components.section}>
        <h3 className={`${dynastyTheme.components.heading.h3} flex items-center gap-2`}>
          <DollarSign className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
          Contract & League Details
        </h3>
        <p className={dynastyTheme.classes.text.neutralLight}>
          This player is a free agent
        </p>
      </div>
    );
  }

  return (
    <div className={dynastyTheme.components.section}>
      <h3 className={`${dynastyTheme.components.heading.h3} flex items-center gap-2`}>
        <DollarSign className={`w-5 h-5 ${dynastyTheme.classes.text.primary}`} />
        Contract & Team Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Contract Terms */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6">
            <h4 className={`${dynastyTheme.components.heading.h4} flex items-center gap-2`}>
              <DollarSign className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
              Contract Terms
            </h4>
            <div className="space-y-3">
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Annual Salary:</span>
                  <span className={`${dynastyTheme.classes.text.success} font-bold text-lg`}>
                    ${(contractInfo.salary || 1.0).toFixed(1)}M
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Contract Length:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    {contractInfo.contract_years || 1} year{(contractInfo.contract_years || 1) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Total Value:</span>
                  <span className={`${dynastyTheme.classes.text.primary} font-bold`}>
                    ${((contractInfo.salary || 1.0) * (contractInfo.contract_years || 1)).toFixed(1)}M
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Years Remaining:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    {contractInfo.contract_years || 1}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Information */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6">
            <h4 className={`${dynastyTheme.components.heading.h4} flex items-center gap-2`}>
              <Users className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
              Team Information
            </h4>
            <div className="space-y-3">
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Fantasy Team:</span>
                  <span className={`${dynastyTheme.classes.text.info} font-semibold`}>
                    {contractInfo.team_name || 'Free Agent'}
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Owner:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    {contractInfo.owner_name || 'Available'}
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Status:</span>
                  <span className={`
                    ${contractInfo.roster_status === 'active' ? dynastyTheme.components.badge.success :
                      contractInfo.roster_status === 'bench' ? dynastyTheme.components.badge.warning :
                      contractInfo.roster_status === 'injured' ? dynastyTheme.components.badge.error :
                      contractInfo.roster_status === 'minors' ? dynastyTheme.components.badge.info :
                      dynastyTheme.components.badge.neutral}
                  `}>
                    {contractInfo.roster_status ? contractInfo.roster_status.toUpperCase() : 'ACTIVE'}
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Acquired:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    {contractInfo.acquisition_method || 'Draft'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* League Information */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6">
            <h4 className={`${dynastyTheme.components.heading.h4} flex items-center gap-2`}>
              <Shield className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
              League Details
            </h4>
            <div className="space-y-3">
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>League:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    {contractInfo.league_name || 'Dynasty League'}
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Type:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    Dynasty
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Season:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    2025
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Status:</span>
                  <span className={dynastyTheme.components.badge.success}>
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Attribution Data if available */}
        {teamAttributionData && (
          <div className={dynastyTheme.components.card.base}>
            <div className="p-6">
              <h4 className={`${dynastyTheme.components.heading.h4} flex items-center gap-2`}>
                <Calendar className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                Team Attribution
              </h4>
              <div className="space-y-3">
                <div className={dynastyTheme.components.listItem.base}>
                  <div className="flex justify-between">
                    <span className={dynastyTheme.classes.text.neutralLight}>Games for Team:</span>
                    <span className={dynastyTheme.classes.text.white}>
                      {teamAttributionData.team_games || 0}
                    </span>
                  </div>
                </div>
                <div className={dynastyTheme.components.listItem.base}>
                  <div className="flex justify-between">
                    <span className={dynastyTheme.classes.text.neutralLight}>First Game:</span>
                    <span className={dynastyTheme.classes.text.white}>
                      {teamAttributionData.first_game_date || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className={dynastyTheme.components.listItem.base}>
                  <div className="flex justify-between">
                    <span className={dynastyTheme.classes.text.neutralLight}>Last Updated:</span>
                    <span className={dynastyTheme.classes.text.white}>
                      {teamAttributionData.last_updated || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contract Performance */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6">
            <h4 className={`${dynastyTheme.components.heading.h4} flex items-center gap-2`}>
              <TrendingUp className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
              Value Analysis
            </h4>
            <div className="space-y-3">
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>$/WAR:</span>
                  <span className={dynastyTheme.classes.text.white}>
                    ${((contractInfo.salary || 1.0) / 2.5).toFixed(2)}M
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Market Value:</span>
                  <span className={dynastyTheme.classes.text.success}>
                    ${((contractInfo.salary || 1.0) * 1.2).toFixed(1)}M
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Surplus Value:</span>
                  <span className={`${dynastyTheme.classes.text.primary} font-bold`}>
                    +${((contractInfo.salary || 1.0) * 0.2).toFixed(1)}M
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contract Options */}
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6">
            <h4 className={`${dynastyTheme.components.heading.h4} flex items-center gap-2`}>
              <FileText className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
              Contract Options
            </h4>
            <div className="space-y-3">
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Extension Eligible:</span>
                  <span className={dynastyTheme.classes.text.warning}>
                    {contractInfo.contract_years === 1 ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Trade Eligible:</span>
                  <span className={dynastyTheme.classes.text.success}>
                    Yes
                  </span>
                </div>
              </div>
              <div className={dynastyTheme.components.listItem.base}>
                <div className="flex justify-between">
                  <span className={dynastyTheme.classes.text.neutralLight}>Can Release:</span>
                  <span className={dynastyTheme.classes.text.success}>
                    Yes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Contract Details */}
      <div className="mt-6 grid grid-cols-1 gap-6">
        <div className={dynastyTheme.components.card.highlighted}>
          <div className="p-6">
            <h4 className={`${dynastyTheme.components.heading.h4} flex items-center gap-2`}>
              <Award className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
              Contract Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className={dynastyTheme.components.statCard.container}>
                <div className={dynastyTheme.components.statCard.value}>
                  ${(contractInfo.salary || 1.0).toFixed(1)}M
                </div>
                <div className={dynastyTheme.components.statCard.label}>Per Year</div>
              </div>
              <div className={dynastyTheme.components.statCard.container}>
                <div className={dynastyTheme.components.statCard.value}>
                  {contractInfo.contract_years || 1}
                </div>
                <div className={dynastyTheme.components.statCard.label}>Years</div>
              </div>
              <div className={dynastyTheme.components.statCard.container}>
                <div className={`text-3xl font-bold ${dynastyTheme.classes.text.warning}`}>
                  ${((contractInfo.salary || 1.0) * (contractInfo.contract_years || 1)).toFixed(1)}M
                </div>
                <div className={dynastyTheme.components.statCard.label}>Total</div>
              </div>
              <div className={dynastyTheme.components.statCard.container}>
                <div className={`text-3xl font-bold ${dynastyTheme.classes.text.info}`}>
                  {contractInfo.roster_status === 'active' ? 'Active' : 
                   contractInfo.roster_status === 'bench' ? 'Bench' :
                   contractInfo.roster_status === 'injured' ? 'IL' :
                   contractInfo.roster_status === 'minors' ? 'Minors' : 'Active'}
                </div>
                <div className={dynastyTheme.components.statCard.label}>Status</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerContractTab;