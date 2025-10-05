// src/components/league-dashboard/PositionAssignmentDropdown.js - Smart Position Assignment

import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, AlertTriangle, CheckCircle, Users, 
  Crown, Shield, Heart, Activity, X 
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

const PositionAssignmentDropdown = ({ 
  player, 
  league, 
  currentRoster, 
  onAssign, 
  onCancel,
  isVisible = false 
}) => {
  const [selectedOption, setSelectedOption] = useState('');
  const [error, setError] = useState('');
  const [showAlternatives, setShowAlternatives] = useState(false);

  // ========================================
  // POSITION AVAILABILITY ANALYSIS
  // ========================================
  const analyzePositionAvailability = useMemo(() => {
    if (!league?.position_requirements || !Array.isArray(currentRoster)) {
      return { 
        available: [], 
        alternatives: [], 
        benchOption: null, 
        minorsOption: null 
      };
    }

    // Extract position from canonical structure
    const playerPosition = player?.info?.position;
    const eligiblePositions = player?.eligible_positions || (playerPosition ? [playerPosition] : []);
    
    const positionRequirements = league.position_requirements;
    const benchSlots = league.bench_slots || 0;
    const dlSlots = league.dl_slots || 0;
    const minorSlots = league.minor_league_slots || 0;

    // Count current active assignments
    const activeAssignments = {};
    currentRoster.forEach(rosterPlayer => {
      if (rosterPlayer.roster_status === 'active' && rosterPlayer.roster_position) {
        const position = rosterPlayer.roster_position.split('_')[0]; // Extract position from "C_0" format
        activeAssignments[position] = (activeAssignments[position] || 0) + 1;
      }
    });

    // Count bench/DL/minors usage
    const benchCount = currentRoster.filter(p => p.roster_status === 'bench').length;
    const dlCount = currentRoster.filter(p => p.roster_status === 'dl').length;
    const minorsCount = currentRoster.filter(p => p.roster_status === 'minors').length;

    // Helper function to check position eligibility with special cases
    const isEligibleForPosition = (pos) => {
      if (eligiblePositions.includes(pos)) return true;
      
      // Special position logic
      if (pos === 'MI' && (eligiblePositions.includes('2B') || eligiblePositions.includes('SS'))) return true;
      if (pos === 'CI' && (eligiblePositions.includes('1B') || eligiblePositions.includes('3B'))) return true;
      if (pos === 'UTIL' && !['SP', 'RP', 'P'].some(p => eligiblePositions.includes(p))) return true;
      if (pos === 'P' && ['SP', 'RP'].some(p => eligiblePositions.includes(p))) return true;
      if (pos === 'OF' && ['LF', 'CF', 'RF', 'OF'].some(p => eligiblePositions.includes(p))) return true;
      
      return false;
    };

    // Analyze each position type
    const available = [];
    const alternatives = [];

    Object.entries(positionRequirements).forEach(([position, config]) => {
      const maxSlots = config?.slots || 0;
      const currentlyFilled = activeAssignments[position] || 0;
      const availableSlots = maxSlots - currentlyFilled;
      
      if (isEligibleForPosition(position)) {
        const option = {
          position,
          availableSlots,
          maxSlots,
          currentlyFilled,
          canAssign: availableSlots > 0,
          slotId: availableSlots > 0 ? `${position}_${currentlyFilled}` : null
        };
        
        if (availableSlots > 0) {
          available.push(option);
        } else {
          alternatives.push(option);
        }
      }
    });

    // Bench option (if enabled and has space)
    const benchOption = benchSlots > 0 ? {
      position: 'bench',
      availableSlots: benchSlots - benchCount,
      maxSlots: benchSlots,
      currentlyFilled: benchCount,
      canAssign: benchCount < benchSlots,
      slotId: 'bench'
    } : null;

    // Minors option (if enabled and has space)
    const minorsOption = minorSlots > 0 ? {
      position: 'minors',
      availableSlots: minorSlots - minorsCount,
      maxSlots: minorSlots,
      currentlyFilled: minorsCount,
      canAssign: minorsCount < minorSlots,
      slotId: 'minors'
    } : null;

    console.log('Position analysis results:', { available, alternatives, benchOption, minorsOption });

    return { 
      available, 
      alternatives, 
      benchOption, 
      minorsOption,
      activeAssignments 
    };
  }, [league, currentRoster, player]);

  // ========================================
  // AUTO-SELECT BEST POSITION ON MODAL OPEN
  // ========================================
  React.useEffect(() => {
    if (isVisible && player && !selectedOption) {
      const { available, benchOption, minorsOption } = analyzePositionAvailability;
      
      // Priority order: direct position match > utility positions > bench > minors
      let bestOption = null;
      
      // Find direct position match first
      const playerPosition = player?.info?.position || player?.position;
      const directMatch = available.find(opt => opt.position === playerPosition);
      
      if (directMatch) {
        bestOption = directMatch.slotId;
      } else if (available.length > 0) {
        // Use first available position (sorted by priority in analysis)
        bestOption = available[0].slotId;
      } else if (benchOption?.canAssign) {
        bestOption = benchOption.slotId;
      } else if (minorsOption?.canAssign) {
        bestOption = minorsOption.slotId;
      }
      
      if (bestOption) {
        setSelectedOption(bestOption);
        console.log(`Auto-selected position: ${bestOption} for ${player?.info?.first_name} ${player?.info?.last_name}`);
      }
    }
    
    // Reset selection when modal closes
    if (!isVisible) {
      setSelectedOption('');
      setError('');
      setShowAlternatives(false);
    }
  }, [isVisible, player, analyzePositionAvailability, selectedOption]);

  // ========================================
  // EVENT HANDLERS
  // ========================================
  const handleAssignment = async () => {
    if (!selectedOption) {
      setError('Please select a position assignment option');
      return;
    }

    setError('');
    
    try {
      await onAssign({
        player,
        assignment: selectedOption,
        roster_status: selectedOption === 'bench' ? 'bench' : 
                     selectedOption === 'minors' ? 'minors' : 'active',
        roster_position: selectedOption === 'bench' || selectedOption === 'minors' ? null : selectedOption
      });
    } catch (err) {
      setError(err.message || 'Failed to assign position');
    }
  };

  const resetSelection = () => {
    setSelectedOption('');
    setError('');
    setShowAlternatives(false);
  };

  // ========================================
  // OPTION RENDERING
  // ========================================
  const renderPositionOption = (option, isAlternative = false) => {
    const { position, availableSlots, maxSlots, currentlyFilled, canAssign, slotId } = option;
    
    const getPositionIcon = (pos) => {
      if (pos === 'bench') return Users;
      if (pos === 'minors') return Shield;
      if (pos === 'dl') return Heart;
      return Activity;
    };
    
    const Icon = getPositionIcon(position);
    const isSelected = selectedOption === slotId;
    
    return (
      <div
        key={slotId || position}
        onClick={() => canAssign && setSelectedOption(slotId)}
        className={`
          p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
          ${isSelected 
            ? `${dynastyTheme.classes.border.primaryBright} bg-yellow-400/10` 
            : canAssign 
              ? `${dynastyTheme.classes.border.neutral} hover:border-yellow-400/50 hover:bg-yellow-400/5`
              : `${dynastyTheme.classes.border.neutral} opacity-50 cursor-not-allowed bg-neutral-800/20`
          }
          ${isAlternative ? 'border-amber-500/30 bg-amber-500/5' : ''}
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`w-4 h-4 ${
              canAssign 
                ? dynastyTheme.classes.text.primary 
                : dynastyTheme.classes.text.neutralDark
            }`} />
            <div>
              <span className={`font-medium text-sm ${
                canAssign 
                  ? dynastyTheme.classes.text.white 
                  : dynastyTheme.classes.text.neutralDark
              }`}>
                {position === 'bench' ? 'Bench' :
                 position === 'minors' ? 'Minor Leagues' :
                 position.toUpperCase()}
              </span>
              {position === 'minors' && (
                <div className={`text-xs ${dynastyTheme.classes.text.warning} mt-1`}>
                  No contract until called up
                </div>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-xs ${
              canAssign 
                ? dynastyTheme.classes.text.neutralLight 
                : dynastyTheme.classes.text.neutralDark
            }`}>
              {currentlyFilled}/{maxSlots} slots
            </div>
            {canAssign ? (
              <div className={`text-xs ${dynastyTheme.classes.text.success} font-medium`}>
                {availableSlots} available
              </div>
            ) : (
              <div className={`text-xs ${dynastyTheme.classes.text.error} font-medium`}>
                Full
              </div>
            )}
          </div>
        </div>
        
        {isSelected && (
          <div className={`mt-2 pt-2 border-t border-yellow-400/30`}>
            <div className="flex items-center justify-between">
              <div className={`text-xs ${dynastyTheme.classes.text.primary} flex items-center gap-1`}>
                <CheckCircle className="w-3 h-3" />
                Selected
              </div>
              {!isAlternative && (
                <span className={`text-xs px-2 py-0.5 rounded ${dynastyTheme.classes.bg.success} ${dynastyTheme.classes.text.black} font-medium`}>
                  Recommended
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========================================
  // ELIGIBILITY CHECK DISPLAY
  // ========================================
  const renderEligibilityInfo = () => {
    const eligiblePositions = player?.eligible_positions || [player?.position];
    
    return (
      <div className={`p-3 ${dynastyTheme.classes.bg.darkLighter} rounded-lg mb-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Crown className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
          <span className={`text-sm font-medium ${dynastyTheme.classes.text.white}`}>
            {player?.first_name} {player?.last_name}
          </span>
          <span className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
            {player?.mlb_team}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className={`text-xs ${dynastyTheme.classes.text.neutralLight} mr-2`}>Eligible:</span>
          {eligiblePositions.map(pos => (
            <span 
              key={pos}
              className={`text-xs px-2 py-1 ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black} rounded font-medium`}
            >
              {pos}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // ========================================
  // MAIN COMPONENT RENDER
  // ========================================
  if (!isVisible) return null;

  const { available, alternatives, benchOption, minorsOption } = analyzePositionAvailability;
  const hasAvailableOptions = available.length > 0 || 
                            (benchOption && benchOption.canAssign) || 
                            (minorsOption && minorsOption.canAssign);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${dynastyTheme.components.card.base} w-full max-w-md max-h-[90vh] overflow-y-auto`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={`${dynastyTheme.components.heading.h3} mb-0`}>
              Assign Roster Position
            </h2>
            <button
              onClick={onCancel}
              className={`p-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} hover:bg-neutral-600/50 ${dynastyTheme.classes.transition}`}
            >
              <X className={`w-4 h-4 ${dynastyTheme.classes.text.neutralLight}`} />
            </button>
          </div>

          {/* Player Eligibility Info */}
          {renderEligibilityInfo()}

          {/* Error Message */}
          {error && (
            <div className={`${dynastyTheme.components.badge.error} p-3 rounded-lg mb-4`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${dynastyTheme.classes.text.error}`} />
                <span className={dynastyTheme.classes.text.error}>{error}</span>
              </div>
            </div>
          )}

          {/* No Available Options */}
          {!hasAvailableOptions && (
            <div className={`${dynastyTheme.components.badge.warning} p-4 rounded-lg mb-4`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-5 h-5 ${dynastyTheme.classes.text.warning}`} />
                <span className={`font-medium ${dynastyTheme.classes.text.warning}`}>All Positions Full</span>
              </div>
              <p className={`text-sm ${dynastyTheme.classes.text.warning} mb-3`}>
                All eligible positions are currently filled. Consider:
              </p>
              <div className="space-y-2 text-sm">
                <div>• Dropping another player to make room</div>
                <div>• Trading players to create space</div>
                <div>• Checking if bench slots are available</div>
              </div>
            </div>
          )}

          {/* Available Position Options */}
          {available.length > 0 && (
            <div className="mb-6">
              <h3 className={`text-sm font-medium ${dynastyTheme.classes.text.white} mb-3 flex items-center gap-2`}>
                <CheckCircle className={`w-4 h-4 ${dynastyTheme.classes.text.success}`} />
                Available Active Lineup Positions
              </h3>
              <div className="space-y-2">
                {available.map(option => renderPositionOption(option))}
              </div>
            </div>
          )}

          {/* Bench Option */}
          {benchOption && benchOption.canAssign && (
            <div className="mb-6">
              <h3 className={`text-sm font-medium ${dynastyTheme.classes.text.white} mb-3 flex items-center gap-2`}>
                <Users className={`w-4 h-4 ${dynastyTheme.classes.text.info}`} />
                Bench Assignment
              </h3>
              <div className="space-y-2">
                {renderPositionOption(benchOption)}
              </div>
            </div>
          )}

          {/* Minors Option */}
          {minorsOption && minorsOption.canAssign && (
            <div className="mb-6">
              <h3 className={`text-sm font-medium ${dynastyTheme.classes.text.white} mb-3 flex items-center gap-2`}>
                <Shield className={`w-4 h-4 ${dynastyTheme.classes.text.info}`} />
                Minor League Assignment
              </h3>
              <div className="space-y-2">
                {renderPositionOption(minorsOption)}
              </div>
            </div>
          )}

          {/* Show Alternatives Button */}
          {alternatives.length > 0 && !showAlternatives && (
            <button
              onClick={() => setShowAlternatives(true)}
              className={`w-full p-3 mb-4 ${dynastyTheme.classes.bg.darkLighter} rounded-lg border-2 border-amber-500/30 hover:bg-amber-500/10 ${dynastyTheme.classes.transition}`}
            >
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${dynastyTheme.classes.text.warning}`} />
                <span className={`${dynastyTheme.classes.text.warning} font-medium`}>
                  View Full Positions ({alternatives.length} currently full)
                </span>
                <ChevronDown className={`w-4 h-4 ${dynastyTheme.classes.text.warning}`} />
              </div>
            </button>
          )}

          {/* Full Positions (Alternatives) */}
          {showAlternatives && alternatives.length > 0 && (
            <div className="mb-6">
              <h3 className={`text-sm font-medium ${dynastyTheme.classes.text.warning} mb-3 flex items-center gap-2`}>
                <AlertTriangle className={`w-4 h-4 ${dynastyTheme.classes.text.warning}`} />
                Currently Full Positions
                <button
                  onClick={() => setShowAlternatives(false)}
                  className={`ml-auto text-xs ${dynastyTheme.classes.text.neutralLight} hover:text-white`}
                >
                  Hide
                </button>
              </h3>
              <div className="space-y-2">
                {alternatives.map(option => renderPositionOption(option, true))}
              </div>
              <div className={`mt-3 p-3 ${dynastyTheme.classes.bg.darkLighter} rounded-lg`}>
                <p className={`text-xs ${dynastyTheme.classes.text.warning}`}>
                  These positions are full. You would need to move another player first.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}
            >
              Cancel
            </button>
            <button
              onClick={handleAssignment}
              disabled={!selectedOption || !hasAvailableOptions}
              className={`
                ${!selectedOption || !hasAvailableOptions 
                  ? 'px-5 py-2.5 text-base bg-neutral-700/50 text-neutral-500 cursor-not-allowed rounded-md' 
                  : dynastyTheme.utils.getComponent('button', 'primary', 'md')
                }
                flex-1
              `}
            >
              {selectedOption ? 'Assign Player' : 'Select Position'}
            </button>
          </div>

          {/* Helpful Tips */}
          <div className={`mt-6 p-4 ${dynastyTheme.classes.bg.darkLighter} rounded-lg`}>
            <h4 className={`text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>Tips:</h4>
            <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} space-y-1`}>
              <div>• Active lineup players count against salary cap</div>
              <div>• Bench players count against salary cap</div>
              <div>• Minor league players have no contract (no salary)</div>
              {league?.dl_slots > 0 && <div>• DL players count against salary cap but don't play</div>}
              <div>• You can move players between positions later</div>
            </div>
          </div>

          {/* Debug Info (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className={`mt-4 p-3 ${dynastyTheme.classes.bg.darkLighter} rounded-lg`}>
              <h4 className={`text-xs font-bold ${dynastyTheme.classes.text.primary} mb-2`}>Debug Info:</h4>
              <pre className={`text-xs ${dynastyTheme.classes.text.neutralLight} overflow-auto`}>
                {JSON.stringify({
                  playerEligible: player?.eligible_positions,
                  leaguePositions: league?.position_requirements,
                  benchSlots: league?.bench_slots,
                  dlSlots: league?.dl_slots,
                  minorSlots: league?.minor_league_slots,
                  activeAssignments: analyzePositionAvailability.activeAssignments,
                  selectedOption
                }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PositionAssignmentDropdown;