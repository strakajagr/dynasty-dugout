// src/pages/league-dashboard/free-agent-search/StatusBanners.js
import React from 'react';
import { AlertCircle, AlertTriangle, Lock } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';

const StatusBanners = ({ state, isCommissionerMode, activeTeamName }) => {
  const {
    error,
    successMessage,
    browseMode,
    transactionsEnabled,
    noPricesWarning,
    players,
    handleBrowseAnyway
  } = state;

  // Show transactions not available screen
  if (!transactionsEnabled && !browseMode && noPricesWarning) {
    return (
      <div className={dynastyTheme.components.card.base}>
        <div className="p-8 text-center">
          <Lock className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className={`${dynastyTheme.components.heading.h2} mb-4`}>
            Transactions Not Yet Available
          </h2>
          <p className={`${dynastyTheme.classes.text.neutralLight} mb-6`}>
            The commissioner must set player prices before transactions can begin. Once prices are set, you'll be able to add players to your roster.
          </p>
          <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter} text-left max-w-md mx-auto mb-6`}>
            <h3 className={`text-sm font-semibold mb-2 ${dynastyTheme.classes.text.white}`}>Current Status:</h3>
            <ul className={`text-sm space-y-1 ${dynastyTheme.classes.text.neutralLight}`}>
              <li>✓ League created</li>
              <li>⏳ Player prices pending</li>
              <li>⏳ Draft mode pending</li>
            </ul>
          </div>
          <button
            onClick={handleBrowseAnyway}
            className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} mt-6`}
          >
            Browse Players Anyway (View Only)
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Browse Mode Warning Banner */}
      {browseMode && !transactionsEnabled && (
        <div className={`${dynastyTheme.components.card.base} border-l-4 border-yellow-500 p-4 mb-4`}>
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
            <span className={dynastyTheme.classes.text.white}>
              Browse-Only Mode: Player prices must be set by commissioner before transactions can be made. All prices showing as $0.
            </span>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className={`${dynastyTheme.components.card.base} border-green-500 p-4 mb-4`}>
          <p className={dynastyTheme.classes.text.success}>
            ✅ {successMessage}
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className={`${dynastyTheme.components.card.base} border-l-4 border-red-500 p-4 mb-4`}>
          <p className={dynastyTheme.classes.text.error}>
            <AlertCircle className="w-4 h-4 inline mr-2" />
            {error}
          </p>
        </div>
      )}

      {/* Backend Data Warning */}
      {players.length > 0 && players[0]?.home_runs === 0 && players[0]?.at_bats === 0 && (
        <div className={`${dynastyTheme.components.card.base} border-l-4 border-yellow-500 p-4 mb-4`}>
          <p className="text-yellow-400">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Warning: Stats are showing as zeros. This is a backend data issue - the API is not returning player statistics.
          </p>
        </div>
      )}

      {/* Commissioner Mode Legend */}
      {isCommissionerMode && (
        <div className={`${dynastyTheme.components.card.base} border-l-4 border-yellow-400 p-4 mb-4`}>
          <h3 className={`${dynastyTheme.classes.text.primary} font-bold text-sm mb-2`}>
            Commissioner Mode Active
          </h3>
          <div className="text-xs text-yellow-400/80">
            All players will be added to <span className="font-medium">{activeTeamName}</span>. 
            All actions will be logged as commissioner overrides.
          </div>
        </div>
      )}
    </>
  );
};

export default StatusBanners;