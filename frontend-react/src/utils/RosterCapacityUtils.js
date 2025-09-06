// src/utils/RosterCapacityUtils.js - Smart Roster Analysis & Position Conflict Resolution

/**
 * Comprehensive roster capacity analysis and intelligent position assignment
 * Handles single player additions and bulk assignment with conflict resolution
 */

// ========================================
// POSITION ELIGIBILITY LOGIC
// ========================================

export const isPlayerEligibleForPosition = (player, position) => {
  const eligiblePositions = player?.eligible_positions || [player?.position];
  
  // Direct match
  if (eligiblePositions.includes(position)) return true;
  
  // Special position eligibility rules
  // UTIL can accept any non-pitcher
  if (position === 'UTIL') {
    return eligiblePositions.some(pos => !['SP', 'RP', 'P'].includes(pos));
  }
  
  // P can accept any pitcher type
  if (position === 'P') {
    return eligiblePositions.some(pos => ['SP', 'RP'].includes(pos));
  }
  
  // OF can accept any outfield position
  if (position === 'OF') {
    return eligiblePositions.some(pos => ['LF', 'CF', 'RF', 'OF'].includes(pos));
  }
  
  // MI (Middle Infield) accepts 2B or SS
  if (position === 'MI') {
    return eligiblePositions.some(pos => ['2B', 'SS'].includes(pos));
  }
  
  // CI (Corner Infield) accepts 1B or 3B
  if (position === 'CI') {
    return eligiblePositions.some(pos => ['1B', '3B'].includes(pos));
  }
  
  return false;
};

// ========================================
// ROSTER CAPACITY ANALYSIS
// ========================================

export const analyzeRosterCapacity = (league, currentRoster) => {
  if (!league?.position_requirements || !Array.isArray(currentRoster)) {
    return {
      hasCapacity: false,
      totalSlots: 0,
      usedSlots: 0,
      availableSlots: 0,
      positionBreakdown: {},
      error: 'Missing league configuration or roster data'
    };
  }

  // Count current roster assignments
  const activeAssignments = {};
  const statusCounts = {
    active: 0,
    bench: 0,
    dl: 0,
    minors: 0
  };

  currentRoster.forEach(player => {
    const status = player.roster_status || 'bench';
    statusCounts[status]++;
    
    if (status === 'active' && player.roster_position) {
      const position = player.roster_position.split('_')[0];
      activeAssignments[position] = (activeAssignments[position] || 0) + 1;
    }
  });

  // Analyze position availability
  const positionBreakdown = {};
  let totalActiveSlots = 0;
  let usedActiveSlots = 0;

  Object.entries(league.position_requirements).forEach(([position, config]) => {
    const maxSlots = config?.slots || 0;
    const usedSlots = activeAssignments[position] || 0;
    const availableSlots = maxSlots - usedSlots;
    
    totalActiveSlots += maxSlots;
    usedActiveSlots += usedSlots;
    
    positionBreakdown[position] = {
      maxSlots,
      usedSlots,
      availableSlots,
      isFull: availableSlots === 0
    };
  });

  // Check bench/DL/minors capacity
  const benchSlots = league.bench_slots || 0;
  const dlSlots = league.dl_slots || 0;
  const minorSlots = league.minor_league_slots || 0;
  
  const benchCapacity = {
    maxSlots: benchSlots,
    usedSlots: statusCounts.bench,
    availableSlots: benchSlots - statusCounts.bench
  };
  
  const dlCapacity = {
    maxSlots: dlSlots,
    usedSlots: statusCounts.dl,
    availableSlots: dlSlots - statusCounts.dl
  };
  
  const minorsCapacity = {
    maxSlots: minorSlots,
    usedSlots: statusCounts.minors,
    availableSlots: minorSlots - statusCounts.minors
  };

  // Calculate total capacity
  const totalRosterSlots = totalActiveSlots + benchSlots + dlSlots + minorSlots;
  const totalUsedSlots = usedActiveSlots + statusCounts.bench + statusCounts.dl + statusCounts.minors;
  const totalAvailableSlots = totalRosterSlots - totalUsedSlots;

  return {
    hasCapacity: totalAvailableSlots > 0,
    totalSlots: totalRosterSlots,
    usedSlots: totalUsedSlots,
    availableSlots: totalAvailableSlots,
    positionBreakdown,
    benchCapacity,
    dlCapacity,
    minorsCapacity,
    statusCounts,
    activeAssignments
  };
};

// ========================================
// SMART POSITION SUGGESTIONS
// ========================================

export const findBestPositionForPlayer = (player, capacityAnalysis, league) => {
  const eligiblePositions = player?.eligible_positions || [player?.position];
  const suggestions = [];

  // Check direct eligible positions first
  Object.entries(capacityAnalysis.positionBreakdown).forEach(([position, breakdown]) => {
    if (breakdown.availableSlots > 0 && isPlayerEligibleForPosition(player, position)) {
      suggestions.push({
        position,
        slotId: `${position}_${breakdown.usedSlots}`,
        type: 'active',
        priority: 1, // Highest priority - direct eligible position
        reason: `Direct position match`
      });
    }
  });

  // Check special positions if no direct matches
  if (suggestions.length === 0) {
    // Try UTIL for hitters
    if (!['SP', 'RP', 'P'].includes(player.position)) {
      const utilBreakdown = capacityAnalysis.positionBreakdown['UTIL'];
      if (utilBreakdown && utilBreakdown.availableSlots > 0) {
        suggestions.push({
          position: 'UTIL',
          slotId: `UTIL_${utilBreakdown.usedSlots}`,
          type: 'active',
          priority: 2,
          reason: 'Utility position available'
        });
      }
    }

    // Try MI/CI for eligible players
    if (eligiblePositions.some(pos => ['2B', 'SS'].includes(pos))) {
      const miBreakdown = capacityAnalysis.positionBreakdown['MI'];
      if (miBreakdown && miBreakdown.availableSlots > 0) {
        suggestions.push({
          position: 'MI',
          slotId: `MI_${miBreakdown.usedSlots}`,
          type: 'active',
          priority: 2,
          reason: 'Middle infield eligible'
        });
      }
    }

    if (eligiblePositions.some(pos => ['1B', '3B'].includes(pos))) {
      const ciBreakdown = capacityAnalysis.positionBreakdown['CI'];
      if (ciBreakdown && ciBreakdown.availableSlots > 0) {
        suggestions.push({
          position: 'CI',
          slotId: `CI_${ciBreakdown.usedSlots}`,
          type: 'active',
          priority: 2,
          reason: 'Corner infield eligible'
        });
      }
    }
  }

  // Check bench if no active slots available
  if (suggestions.length === 0 && capacityAnalysis.benchCapacity.availableSlots > 0) {
    suggestions.push({
      position: 'bench',
      slotId: 'bench',
      type: 'bench',
      priority: 3,
      reason: 'Bench slot available'
    });
  }

  // Check minors if enabled and available
  if (suggestions.length === 0 && capacityAnalysis.minorsCapacity.availableSlots > 0) {
    suggestions.push({
      position: 'minors',
      slotId: 'minors', 
      type: 'minors',
      priority: 4,
      reason: 'Minor league slot available (no contract)'
    });
  }

  // Sort by priority (lower number = higher priority)
  suggestions.sort((a, b) => a.priority - b.priority);

  return {
    hasSuggestions: suggestions.length > 0,
    bestSuggestion: suggestions[0] || null,
    allSuggestions: suggestions,
    playerName: `${player.first_name} ${player.last_name}`,
    eligiblePositions
  };
};

// ========================================
// BULK ASSIGNMENT CONFLICT RESOLUTION
// ========================================

export const analyzeBulkAssignmentConflicts = (selectedPlayers, capacityAnalysis, league) => {
  const assignments = new Map(); // playerId -> assignment
  const conflicts = [];
  const warnings = [];
  
  // Track remaining capacity as we assign players
  const remainingCapacity = {
    positions: { ...capacityAnalysis.positionBreakdown },
    bench: { ...capacityAnalysis.benchCapacity },
    minors: { ...capacityAnalysis.minorsCapacity }
  };

  // Auto-assign players using smart suggestions
  selectedPlayers.forEach((player, index) => {
    const suggestion = findBestPositionForPlayer(player, {
      positionBreakdown: remainingCapacity.positions,
      benchCapacity: remainingCapacity.bench,
      minorsCapacity: remainingCapacity.minors
    }, league);

    if (suggestion.hasSuggestions) {
      const bestSuggestion = suggestion.bestSuggestion;
      
      // Assign the position
      assignments.set(player.league_player_id, {
        player,
        assignment: bestSuggestion,
        autoAssigned: true
      });

      // Update remaining capacity
      if (bestSuggestion.type === 'active') {
        const pos = bestSuggestion.position;
        if (remainingCapacity.positions[pos]) {
          remainingCapacity.positions[pos].availableSlots--;
          remainingCapacity.positions[pos].usedSlots++;
        }
      } else if (bestSuggestion.type === 'bench') {
        remainingCapacity.bench.availableSlots--;
        remainingCapacity.bench.usedSlots++;
      } else if (bestSuggestion.type === 'minors') {
        remainingCapacity.minors.availableSlots--;
        remainingCapacity.minors.usedSlots++;
      }

      // Add warning if not ideal placement
      if (bestSuggestion.priority > 2) {
        warnings.push({
          player,
          assignment: bestSuggestion,
          message: `${player.first_name} ${player.last_name} assigned to ${bestSuggestion.reason.toLowerCase()}`
        });
      }
    } else {
      // No available slots for this player
      conflicts.push({
        player,
        issue: 'no_capacity',
        message: `No available roster slots for ${player.first_name} ${player.last_name}`
      });
    }
  });

  // Check for assignment conflicts (shouldn't happen with smart assignment, but verify)
  const positionCounts = {};
  assignments.forEach((assignment) => {
    if (assignment.assignment.type === 'active') {
      const pos = assignment.assignment.position;
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    }
  });

  Object.entries(positionCounts).forEach(([position, count]) => {
    const maxSlots = capacityAnalysis.positionBreakdown[position]?.maxSlots || 0;
    if (count > capacityAnalysis.positionBreakdown[position]?.availableSlots) {
      conflicts.push({
        position,
        issue: 'overassignment', 
        message: `Too many players assigned to ${position}: ${count} assigned, ${maxSlots - capacityAnalysis.positionBreakdown[position].usedSlots} available`
      });
    }
  });

  return {
    assignments: Array.from(assignments.values()),
    conflicts,
    warnings,
    canProceed: conflicts.length === 0,
    summary: {
      totalPlayers: selectedPlayers.length,
      successfulAssignments: assignments.size,
      conflicts: conflicts.length,
      warnings: warnings.length
    }
  };
};

// ========================================
// ASSIGNMENT VALIDATION
// ========================================

export const validateSinglePlayerAssignment = (player, assignment, capacityAnalysis) => {
  const { position, type } = assignment;
  
  if (type === 'active') {
    const breakdown = capacityAnalysis.positionBreakdown[position];
    if (!breakdown || breakdown.availableSlots <= 0) {
      return {
        isValid: false,
        error: `No available ${position} slots (${breakdown?.usedSlots || 0}/${breakdown?.maxSlots || 0} used)`
      };
    }
  } else if (type === 'bench') {
    if (capacityAnalysis.benchCapacity.availableSlots <= 0) {
      return {
        isValid: false,
        error: `No available bench slots (${capacityAnalysis.benchCapacity.usedSlots}/${capacityAnalysis.benchCapacity.maxSlots} used)`
      };
    }
  } else if (type === 'minors') {
    if (capacityAnalysis.minorsCapacity.availableSlots <= 0) {
      return {
        isValid: false,
        error: `No available minor league slots (${capacityAnalysis.minorsCapacity.usedSlots}/${capacityAnalysis.minorsCapacity.maxSlots} used)`
      };
    }
  }

  // Check player eligibility
  if (type === 'active' && !isPlayerEligibleForPosition(player, position)) {
    return {
      isValid: false,
      error: `${player.first_name} ${player.last_name} is not eligible for ${position} position`
    };
  }

  return { isValid: true, error: null };
};

export const validateBulkAssignments = (assignments, capacityAnalysis) => {
  const errors = [];
  const positionCounts = {};
  const statusCounts = { bench: 0, minors: 0 };

  // Count assignments by position/status
  assignments.forEach(({ player, assignment }) => {
    if (assignment.type === 'active') {
      const pos = assignment.position;
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    } else {
      statusCounts[assignment.type]++;
    }
  });

  // Check position overages
  Object.entries(positionCounts).forEach(([position, count]) => {
    const available = capacityAnalysis.positionBreakdown[position]?.availableSlots || 0;
    if (count > available) {
      errors.push({
        type: 'position_overflow',
        position,
        message: `${count} players assigned to ${position}, but only ${available} slots available`
      });
    }
  });

  // Check bench overage
  if (statusCounts.bench > capacityAnalysis.benchCapacity.availableSlots) {
    errors.push({
      type: 'bench_overflow',
      message: `${statusCounts.bench} players assigned to bench, but only ${capacityAnalysis.benchCapacity.availableSlots} slots available`
    });
  }

  // Check minors overage  
  if (statusCounts.minors > capacityAnalysis.minorsCapacity.availableSlots) {
    errors.push({
      type: 'minors_overflow',
      message: `${statusCounts.minors} players assigned to minors, but only ${capacityAnalysis.minorsCapacity.availableSlots} slots available`
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    positionCounts,
    statusCounts
  };
};

// ========================================
// SMART ASSIGNMENT ALGORITHMS
// ========================================

export const generateOptimalAssignments = (selectedPlayers, capacityAnalysis, league) => {
  const assignments = [];
  const unassignedPlayers = [];
  
  // Create working copy of capacity
  const workingCapacity = {
    positions: {},
    bench: capacityAnalysis.benchCapacity.availableSlots,
    minors: capacityAnalysis.minorsCapacity.availableSlots
  };

  Object.entries(capacityAnalysis.positionBreakdown).forEach(([pos, breakdown]) => {
    workingCapacity.positions[pos] = breakdown.availableSlots;
  });

  // Sort players by position specificity (more specific positions first)
  const prioritizedPlayers = [...selectedPlayers].sort((a, b) => {
    const aEligible = (a.eligible_positions || [a.position]).length;
    const bEligible = (b.eligible_positions || [b.position]).length;
    return aEligible - bEligible; // Fewer eligible positions = higher priority
  });

  // Assign players in priority order
  prioritizedPlayers.forEach(player => {
    const eligiblePositions = player?.eligible_positions || [player?.position];
    let assigned = false;

    // Try direct position matches first
    for (const position of eligiblePositions) {
      if (workingCapacity.positions[position] > 0) {
        const currentUsed = (capacityAnalysis.positionBreakdown[position]?.usedSlots || 0) + 
                          (capacityAnalysis.positionBreakdown[position]?.maxSlots || 0) - 
                          workingCapacity.positions[position];
        
        assignments.push({
          player,
          assignment: {
            position,
            slotId: `${position}_${currentUsed}`,
            type: 'active',
            reason: `Direct position match`,
            priority: 1
          }
        });
        
        workingCapacity.positions[position]--;
        assigned = true;
        break;
      }
    }

    // Try special positions if no direct match
    if (!assigned) {
      // Try UTIL for hitters
      if (!['SP', 'RP', 'P'].includes(player.position) && workingCapacity.positions['UTIL'] > 0) {
        const currentUsed = (capacityAnalysis.positionBreakdown['UTIL']?.usedSlots || 0) + 
                          (capacityAnalysis.positionBreakdown['UTIL']?.maxSlots || 0) - 
                          workingCapacity.positions['UTIL'];
        
        assignments.push({
          player,
          assignment: {
            position: 'UTIL',
            slotId: `UTIL_${currentUsed}`,
            type: 'active', 
            reason: 'Utility position',
            priority: 2
          }
        });
        
        workingCapacity.positions['UTIL']--;
        assigned = true;
      }
      
      // Try MI for 2B/SS
      else if (eligiblePositions.some(pos => ['2B', 'SS'].includes(pos)) && 
               workingCapacity.positions['MI'] > 0) {
        const currentUsed = (capacityAnalysis.positionBreakdown['MI']?.usedSlots || 0) + 
                          (capacityAnalysis.positionBreakdown['MI']?.maxSlots || 0) - 
                          workingCapacity.positions['MI'];
        
        assignments.push({
          player,
          assignment: {
            position: 'MI',
            slotId: `MI_${currentUsed}`,
            type: 'active',
            reason: 'Middle infield eligible',
            priority: 2
          }
        });
        
        workingCapacity.positions['MI']--;
        assigned = true;
      }
      
      // Try CI for 1B/3B
      else if (eligiblePositions.some(pos => ['1B', '3B'].includes(pos)) && 
               workingCapacity.positions['CI'] > 0) {
        const currentUsed = (capacityAnalysis.positionBreakdown['CI']?.usedSlots || 0) + 
                          (capacityAnalysis.positionBreakdown['CI']?.maxSlots || 0) - 
                          workingCapacity.positions['CI'];
        
        assignments.push({
          player,
          assignment: {
            position: 'CI',
            slotId: `CI_${currentUsed}`,
            type: 'active',
            reason: 'Corner infield eligible',
            priority: 2
          }
        });
        
        workingCapacity.positions['CI']--;
        assigned = true;
      }
    }

    // Try bench if no active positions available
    if (!assigned && workingCapacity.bench > 0) {
      assignments.push({
        player,
        assignment: {
          position: 'bench',
          slotId: 'bench',
          type: 'bench',
          reason: 'Active lineup full',
          priority: 3
        }
      });
      
      workingCapacity.bench--;
      assigned = true;
    }

    // Try minors if bench full
    if (!assigned && workingCapacity.minors > 0) {
      assignments.push({
        player,
        assignment: {
          position: 'minors', 
          slotId: 'minors',
          type: 'minors',
          reason: 'Active lineup and bench full',
          priority: 4
        }
      });
      
      workingCapacity.minors--;
      assigned = true;
    }

    // Player cannot be assigned anywhere
    if (!assigned) {
      unassignedPlayers.push({
        player,
        reason: 'No available roster slots'
      });
    }
  });

  return {
    assignments,
    unassignedPlayers,
    canAssignAll: unassignedPlayers.length === 0,
    summary: {
      totalPlayers: selectedPlayers.length,
      assigned: assignments.length,
      unassigned: unassignedPlayers.length,
      activeLineup: assignments.filter(a => a.assignment.type === 'active').length,
      bench: assignments.filter(a => a.assignment.type === 'bench').length,
      minors: assignments.filter(a => a.assignment.type === 'minors').length
    }
  };
};

// ========================================
// ROSTER CAPACITY CHECKING
// ========================================

export const canAddPlayers = (playerCount, capacityAnalysis) => {
  if (capacityAnalysis.availableSlots >= playerCount) {
    return {
      canAdd: true,
      availableSlots: capacityAnalysis.availableSlots,
      message: `${capacityAnalysis.availableSlots} roster slots available`
    };
  }

  return {
    canAdd: false,
    availableSlots: capacityAnalysis.availableSlots,
    message: `Only ${capacityAnalysis.availableSlots} roster slots available, but trying to add ${playerCount} players`
  };
};

export const getRosterCapacitySummary = (capacityAnalysis) => {
  const activeSlots = Object.values(capacityAnalysis.positionBreakdown)
    .reduce((sum, breakdown) => sum + breakdown.maxSlots, 0);
  
  const usedActiveSlots = Object.values(capacityAnalysis.positionBreakdown)
    .reduce((sum, breakdown) => sum + breakdown.usedSlots, 0);

  return {
    active: {
      used: usedActiveSlots,
      total: activeSlots,
      available: activeSlots - usedActiveSlots
    },
    bench: {
      used: capacityAnalysis.benchCapacity.usedSlots,
      total: capacityAnalysis.benchCapacity.maxSlots,
      available: capacityAnalysis.benchCapacity.availableSlots
    },
    dl: {
      used: capacityAnalysis.dlCapacity.usedSlots,
      total: capacityAnalysis.dlCapacity.maxSlots,
      available: capacityAnalysis.dlCapacity.availableSlots
    },
    minors: {
      used: capacityAnalysis.minorsCapacity.usedSlots,
      total: capacityAnalysis.minorsCapacity.maxSlots,
      available: capacityAnalysis.minorsCapacity.availableSlots
    },
    overall: {
      used: capacityAnalysis.usedSlots,
      total: capacityAnalysis.totalSlots,
      available: capacityAnalysis.availableSlots
    }
  };
};