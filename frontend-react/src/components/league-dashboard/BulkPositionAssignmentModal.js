// src/components/league-dashboard/BulkPositionAssignmentModal.js - FIXED FUNCTION NAME ERROR

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, AlertTriangle, CheckCircle, RefreshCw, Users, Crown,
  Activity, Shield, Heart, Zap, ChevronDown, UserPlus,
  AlertCircle, TrendingUp, Layers
} from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { 
  analyzeBulkAssignmentConflicts, 
  validateBulkAssignments,
  getRosterCapacitySummary,
  isPlayerEligibleForPosition // FIXED: Correct function name
} from '../../utils/RosterCapacityUtils';

const BulkPositionAssignmentModal = ({ 
  selectedPlayers,
  league, 
  capacityAnalysis,
  currentRoster,
  onAssignAll, 
  onCancel,
  isVisible = false 
}) => {
  const [assignments, setAssignments] = useState(new Map());
  const [conflicts, setConflicts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [autoAssignComplete, setAutoAssignComplete] = useState(false);

  // ========================================
  // AUTO-ASSIGNMENT ON MODAL OPEN
  // ========================================
  useEffect(() => {
    if (isVisible && selectedPlayers.length > 0 && !autoAssignComplete) {
      console.log('🤖 Running auto-assignment for', selectedPlayers.length, 'players');
      
      const result = analyzeBulkAssignmentConflicts(selectedPlayers, capacityAnalysis, league);
      
      // Convert to Map format
      const assignmentMap = new Map();
      result.assignments.forEach(({ player, assignment }) => {
        assignmentMap.set(player.league_player_id, assignment);
      });
      
      setAssignments(assignmentMap);
      setConflicts(result.conflicts);
      setWarnings(result.warnings);
      setAutoAssignComplete(true);
      
      console.log('✅ Auto-assignment complete:', result.summary);
    }
  }, [isVisible, selectedPlayers, capacityAnalysis, league, autoAssignComplete]);

  // ========================================
  // POSITION ASSIGNMENT HELPERS
  // ========================================
  const getAvailablePositionsForPlayer = (player) => {
    const options = [];
    
    // Check active lineup positions
    Object.entries(capacityAnalysis.positionBreakdown).forEach(([position, breakdown]) => {
      if (isPlayerEligibleForPosition(player, position)) { // FIXED: Correct function name
        // Count how many assignments are already made to this position
        const assignedToPosition = Array.from(assignments.values())
          .filter(assignment => assignment.position === position && assignment.type === 'active').length;
        
        const reallyAvailable = breakdown.availableSlots - assignedToPosition;
        
        options.push({
          value: `${position}_${breakdown.usedSlots + assignedToPosition}`,
          label: position.toUpperCase(),
          type: 'active',
          available: reallyAvailable > 0,
          slotInfo: `${breakdown.usedSlots + assignedToPosition + 1}/${breakdown.maxSlots}`
        });
      }
    });

    // Check bench
    if (capacityAnalysis.benchCapacity.maxSlots > 0) {
      const assignedToBench = Array.from(assignments.values())
        .filter(assignment => assignment.type === 'bench').length;
      const reallyAvailable = capacityAnalysis.benchCapacity.availableSlots - assignedToBench;
      
      options.push({
        value: 'bench',
        label: 'Bench',
        type: 'bench', 
        available: reallyAvailable > 0,
        slotInfo: `${capacityAnalysis.benchCapacity.usedSlots + assignedToBench + 1}/${capacityAnalysis.benchCapacity.maxSlots}`
      });
    }

    // Check minors
    if (capacityAnalysis.minorsCapacity.maxSlots > 0) {
      const assignedToMinors = Array.from(assignments.values())
        .filter(assignment => assignment.type === 'minors').length;
      const reallyAvailable = capacityAnalysis.minorsCapacity.availableSlots - assignedToMinors;
      
      options.push({
        value: 'minors',
        label: 'Minor League',
        type: 'minors',
        available: reallyAvailable > 0,
        slotInfo: `${capacityAnalysis.minorsCapacity.usedSlots + assignedToMinors + 1}/${capacityAnalysis.minorsCapacity.maxSlots}`,
        note: 'No contract until called up'
      });
    }

    return options.sort((a, b) => {
      // Available first, then by priority
      if (a.available !== b.available) return a.available ? -1 : 1;
      
      const priority = { active: 1, bench: 2, minors: 3 };
      return priority[a.type] - priority[b.type];
    });
  };

  // ========================================
  // ASSIGNMENT HANDLERS
  // ========================================
  const handleAssignmentChange = (player, newAssignmentValue) => {
    const newAssignments = new Map(assignments);
    
    if (newAssignmentValue === '') {
      newAssignments.delete(player.league_player_id);
    } else {
      const [position, type] = newAssignmentValue === 'bench' || newAssignmentValue === 'minors' 
        ? [newAssignmentValue, newAssignmentValue]
        : [newAssignmentValue.split('_')[0], 'active'];
      
      newAssignments.set(player.league_player_id, {
        position,
        slotId: newAssignmentValue,
        type,
        reason: 'Manual selection',
        priority: 1
      });
    }
    
    setAssignments(newAssignments);
    
    // Re-validate assignments
    const validation = validateBulkAssignments(
      Array.from(newAssignments.values()).map(assignment => ({ assignment })),
      capacityAnalysis
    );
    
    if (!validation.isValid) {
      setConflicts(validation.errors.map(err => ({ message: err.message })));
    } else {
      setConflicts([]);
    }
  };

  const handleSubmitAssignments = async () => {
    setProcessing(true);
    setError('');

    try {
      // Convert assignments to API format
      const assignmentData = selectedPlayers.map(player => {
        const assignment = assignments.get(player.league_player_id);
        
        return {
          player,
          roster_status: assignment?.type || 'bench',
          roster_position: assignment?.type === 'active' ? assignment.slotId : null,
          salary: assignment?.type === 'minors' ? 0 : (player.display_price || player.price || player.salary || 1.0),
          contract_years: assignment?.type === 'minors' ? 0 : 2,
          start_contract: assignment?.type !== 'minors'
        };
      });

      await onAssignAll(assignmentData);
    } catch (err) {
      setError(err.message || 'Failed to assign players');
    } finally {
      setProcessing(false);
    }
  };

  // ========================================
  // SUMMARY CALCULATIONS
  // ========================================
  const assignmentSummary = useMemo(() => {
    const summary = {
      assigned: 0,
      unassigned: 0,
      active: 0,
      bench: 0, 
      minors: 0,
      totalSalary: 0
    };

    selectedPlayers.forEach(player => {
      const assignment = assignments.get(player.league_player_id);
      
      if (assignment) {
        summary.assigned++;
        
        if (assignment.type === 'active') summary.active++;
        else if (assignment.type === 'bench') summary.bench++;
        else if (assignment.type === 'minors') summary.minors++;
        
        // Calculate salary (minors = 0)
        if (assignment.type !== 'minors') {
          summary.totalSalary += player.display_price || player.price || player.salary || 1.0;
        }
      } else {
        summary.unassigned++;
      }
    });

    return summary;
  }, [selectedPlayers, assignments]);

  // ========================================
  // RENDER PLAYER ROW
  // ========================================
  const renderPlayerRow = (player, index) => {
    const assignment = assignments.get(player.league_player_id);
    const availableOptions = getAvailablePositionsForPlayer(player);
    const isEven = index % 2 === 0;
    
    return (
      <div 
        key={player.league_player_id}
        className={`
          flex items-center gap-4 p-3 border-b border-neutral-700/30
          ${isEven 
            ? 'bg-gradient-to-r from-neutral-900/60 to-neutral-850/40' 
            : 'bg-gradient-to-r from-neutral-800/50 to-neutral-750/30'
          }
          hover:bg-gradient-to-r hover:from-yellow-400/10 hover:to-yellow-400/5
          transition-all duration-200
        `}
      >
        {/* Player Info */}
        <div className="w-48 min-w-0">
          <div className={`${dynastyTheme.classes.text.white} font-medium text-sm truncate`}>
            {player.first_name} {player.last_name}
          </div>
          <div className={`${dynastyTheme.classes.text.neutralLight} text-xs truncate`}>
            {player.position} - {player.mlb_team}
          </div>
        </div>

        {/* Eligible Positions */}
        <div className="w-32 min-w-0">
          <div className="flex flex-wrap gap-1">
            {(player.eligible_positions || [player.position]).slice(0, 3).map(pos => (
              <span 
                key={pos}
                className={`text-xs px-1.5 py-0.5 ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black} rounded font-medium`}
              >
                {pos}
              </span>
            ))}
            {(player.eligible_positions?.length || 1) > 3 && (
              <span className={`text-xs ${dynastyTheme.classes.text.neutralDark}`}>
                +{(player.eligible_positions?.length || 1) - 3}
              </span>
            )}
          </div>
        </div>

        {/* Position Assignment Dropdown */}
        <div className="w-48 min-w-0">
          <select
            value={assignment?.slotId || ''}
            onChange={(e) => handleAssignmentChange(player, e.target.value)}
            className={`w-full ${dynastyTheme.components.input} text-sm ${
              !assignment ? 'border-red-500/50 bg-red-500/10' : 'border-emerald-500/50'
            }`}
          >
            <option value="">-- Select Position --</option>
            {availableOptions.map(option => (
              <option 
                key={option.value} 
                value={option.value}
                disabled={!option.available}
              >
                {option.label} ({option.slotInfo})
                {!option.available && ' - FULL'}
                {option.note && ` - ${option.note}`}
              </option>
            ))}
          </select>
        </div>

        {/* Assignment Status */}
        <div className="w-24 text-center">
          {assignment ? (
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
              assignment.type === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
              assignment.type === 'bench' ? 'bg-blue-500/20 text-blue-400' :
              'bg-amber-500/20 text-amber-400'
            }`}>
              {assignment.type === 'active' && <Activity className="w-3 h-3" />}
              {assignment.type === 'bench' && <Users className="w-3 h-3" />}
              {assignment.type === 'minors' && <Shield className="w-3 h-3" />}
              <span className="text-xs font-medium">
                {assignment.position.toUpperCase()}
              </span>
            </div>
          ) : (
            <span className={`text-xs ${dynastyTheme.classes.text.error} italic`}>
              Unassigned
            </span>
          )}
        </div>

        {/* Salary Impact */}
        <div className="w-16 text-right">
          {assignment?.type === 'minors' ? (
            <span className={`text-xs ${dynastyTheme.classes.text.neutralDark} italic`}>
              $0
            </span>
          ) : (
            <span className={`${dynastyTheme.classes.text.success} text-sm font-medium`}>
              ${player.display_price || player.price || player.salary || 1.0}
            </span>
          )}
        </div>
      </div>
    );
  };

  // ========================================
  // MAIN RENDER
  // ========================================
  if (!isVisible) return null;

  const canSubmit = assignments.size === selectedPlayers.length && conflicts.length === 0;
  const rosterSummary = getRosterCapacitySummary(capacityAnalysis);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${dynastyTheme.components.card.base} w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-700/30">
          <div>
            <h2 className={`${dynastyTheme.components.heading.h2} mb-0 flex items-center gap-3`}>
              <UserPlus className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
              Bulk Position Assignment
            </h2>
            <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-1`}>
              Assign roster positions for {selectedPlayers.length} selected players
            </p>
          </div>
          <button
            onClick={onCancel}
            className={`p-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} hover:bg-neutral-600/50 ${dynastyTheme.classes.transition}`}
          >
            <X className={`w-5 h-5 ${dynastyTheme.classes.text.neutralLight}`} />
          </button>
        </div>

        {/* Status Summary Cards */}
        <div className="p-6 border-b border-neutral-700/30">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className={`${dynastyTheme.components.statCard.container} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className={`w-4 h-4 ${dynastyTheme.classes.text.success}`} />
                <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Assigned</h3>
              </div>
              <p className={`text-2xl font-bold ${dynastyTheme.classes.text.success}`}>
                {assignmentSummary.assigned}/{selectedPlayers.length}
              </p>
            </div>

            <div className={`${dynastyTheme.components.statCard.container} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className={`w-4 h-4 ${dynastyTheme.classes.text.primary}`} />
                <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Active</h3>
              </div>
              <p className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
                {assignmentSummary.active}
              </p>
            </div>

            <div className={`${dynastyTheme.components.statCard.container} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Users className={`w-4 h-4 ${dynastyTheme.classes.text.info}`} />
                <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Bench/Minors</h3>
              </div>
              <p className={`text-2xl font-bold ${dynastyTheme.classes.text.info}`}>
                {assignmentSummary.bench + assignmentSummary.minors}
              </p>
            </div>

            <div className={`${dynastyTheme.components.statCard.container} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className={`w-4 h-4 ${dynastyTheme.classes.text.success}`} />
                <h3 className={`text-sm font-semibold ${dynastyTheme.classes.text.neutralLight}`}>Total Salary</h3>
              </div>
              <p className={`text-2xl font-bold ${dynastyTheme.classes.text.success}`}>
                ${assignmentSummary.totalSalary}
              </p>
            </div>
          </div>

          {/* Conflicts & Warnings */}
          {conflicts.length > 0 && (
            <div className={`${dynastyTheme.components.badge.error} p-3 rounded-lg mb-4`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 ${dynastyTheme.classes.text.error}`} />
                <span className={`font-medium ${dynastyTheme.classes.text.error}`}>Conflicts Must Be Resolved</span>
              </div>
              <div className="text-sm space-y-1">
                {conflicts.map((conflict, idx) => (
                  <div key={idx} className={dynastyTheme.classes.text.error}>• {conflict.message}</div>
                ))}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className={`${dynastyTheme.components.badge.warning} p-3 rounded-lg mb-4`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className={`w-4 h-4 ${dynastyTheme.classes.text.warning}`} />
                <span className={`font-medium ${dynastyTheme.classes.text.warning}`}>Assignment Warnings</span>
              </div>
              <div className="text-sm space-y-1">
                {warnings.map((warning, idx) => (
                  <div key={idx} className={dynastyTheme.classes.text.warning}>• {warning.message}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Player Assignment Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-2">
            {/* Table Header */}
            <div className={`flex items-center gap-4 p-3 ${dynastyTheme.classes.bg.darkLighter} rounded-lg font-medium text-sm ${dynastyTheme.classes.text.white}`}>
              <div className="w-48">Player</div>
              <div className="w-32">Eligible</div>
              <div className="w-48">Assign To</div>
              <div className="w-24 text-center">Status</div>
              <div className="w-16 text-right">Salary</div>
            </div>

            {/* Player Rows */}
            <div className="space-y-1">
              {selectedPlayers.map((player, index) => renderPlayerRow(player, index))}
            </div>
          </div>
        </div>

        {/* Roster Capacity Summary */}
        <div className="p-6 border-t border-neutral-700/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className={`text-xs ${dynastyTheme.classes.text.neutralDark} uppercase tracking-wide`}>Active Lineup</div>
              <div className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
                {rosterSummary.active.used + assignmentSummary.active}/{rosterSummary.active.total}
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                {rosterSummary.active.available - assignmentSummary.active} remaining
              </div>
            </div>
            <div className="text-center">
              <div className={`text-xs ${dynastyTheme.classes.text.neutralDark} uppercase tracking-wide`}>Bench</div>
              <div className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
                {rosterSummary.bench.used + assignmentSummary.bench}/{rosterSummary.bench.total}
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                {rosterSummary.bench.available - assignmentSummary.bench} remaining
              </div>
            </div>
            <div className="text-center">
              <div className={`text-xs ${dynastyTheme.classes.text.neutralDark} uppercase tracking-wide`}>Minors</div>
              <div className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
                {rosterSummary.minors.used + assignmentSummary.minors}/{rosterSummary.minors.total}
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                {rosterSummary.minors.available - assignmentSummary.minors} remaining
              </div>
            </div>
            <div className="text-center">
              <div className={`text-xs ${dynastyTheme.classes.text.neutralDark} uppercase tracking-wide`}>Total Roster</div>
              <div className={`text-lg font-bold ${dynastyTheme.classes.text.white}`}>
                {rosterSummary.overall.used + assignmentSummary.assigned}/{rosterSummary.overall.total}
              </div>
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                {rosterSummary.overall.available - assignmentSummary.assigned} remaining
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className={`mx-6 mb-6 ${dynastyTheme.components.badge.error} p-3 rounded-lg`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${dynastyTheme.classes.text.error}`} />
              <span className={dynastyTheme.classes.text.error}>{error}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 p-6 border-t border-neutral-700/30">
          <button
            onClick={onCancel}
            disabled={processing}
            className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} disabled:opacity-50`}
          >
            Cancel
          </button>
          
          <div className="flex-1" />
          
          {/* Auto-assign button if needed */}
          {assignmentSummary.unassigned > 0 && (
            <button
              onClick={() => {
                setAutoAssignComplete(false);
                setAssignments(new Map());
              }}
              disabled={processing}
              className={`${dynastyTheme.utils.getComponent('button', 'ghost', 'md')} disabled:opacity-50`}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Re-run Auto-assign
            </button>
          )}
          
          <button
            onClick={handleSubmitAssignments}
            disabled={!canSubmit || processing}
            className={`
              ${!canSubmit || processing
                ? 'px-5 py-2.5 text-base bg-neutral-700/50 text-neutral-500 cursor-not-allowed rounded-md' 
                : dynastyTheme.utils.getComponent('button', 'primary', 'md')
              } 
              flex items-center gap-2
            `}
          >
            {processing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Adding Players...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Add {assignmentSummary.assigned} Player{assignmentSummary.assigned !== 1 ? 's' : ''}
                {assignmentSummary.totalSalary > 0 && ` ($${assignmentSummary.totalSalary})`}
              </>
            )}
          </button>
        </div>

        {/* Helper Tips */}
        <div className={`mx-6 mb-6 p-4 ${dynastyTheme.classes.bg.darkLighter} rounded-lg`}>
          <h4 className={`text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>Tips:</h4>
          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} space-y-1`}>
            <div>• Auto-assignment prioritizes direct position matches first</div>
            <div>• Players in minors have no contract until called up</div>
            <div>• Use dropdowns to manually adjust assignments</div>
            <div>• Red dropdowns indicate unassigned players</div>
            {warnings.length > 0 && (
              <div>• Yellow warnings show sub-optimal but valid assignments</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkPositionAssignmentModal;