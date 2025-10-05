// src/pages/league-dashboard/FreeAgentSearch.js - COMPLETE WITH FILTERING FIXES
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { leaguesAPI } from '../../services/apiService';
import { useCommissioner } from '../../contexts/CommissionerContext';
import { useBatchSelection } from './free-agent-search/BatchSelectionProvider';
import { 
  analyzeRosterCapacity, 
  canAddPlayers,
  findBestPositionForPlayer,
  validateSinglePlayerAssignment 
} from '../../utils/RosterCapacityUtils';

// Import modular components
import BatchSelectionProvider from './free-agent-search/BatchSelectionProvider';
import SearchControls from './free-agent-search/SearchControls';
import StatusBanners from './free-agent-search/StatusBanners';
import PlayerTable from './free-agent-search/PlayerTable';
import CommissionerToggle from '../../components/commissioner/CommissionerToggle';
import CommissionerModeBar from '../../components/commissioner/CommissionerModeBar';
import PositionAssignmentDropdown from '../../components/league-dashboard/PositionAssignmentDropdown';
import BulkPositionAssignmentModal from '../../components/league-dashboard/BulkPositionAssignmentModal';

// ========================================
// WRAPPER COMPONENT WITH BATCH PROVIDER
// ========================================
const FreeAgentSearch = ({ leagueId, onPlayerAdded, league, user }) => {
  return (
    <BatchSelectionProvider>
      <FreeAgentSearchInner 
        leagueId={leagueId}
        onPlayerAdded={onPlayerAdded}
        league={league}
        user={user}
      />
    </BatchSelectionProvider>
  );
};

// ========================================
// INNER COMPONENT WITH BATCH CONTEXT ACCESS
// ========================================
const FreeAgentSearchInner = ({ leagueId, onPlayerAdded, league, user }) => {
  const navigate = useNavigate();
  const { 
    isCommissionerMode, 
    activeTeamId,
    activeTeamName, 
    getTargetTeamId,
    isCommissioner 
  } = useCommissioner();
  
  // Access batch selection context
  const { getSelectedPlayerObjects, clearAllSelections } = useBatchSelection();
  
  // Core state management
  const [players, setPlayers] = useState([]);
  const [unfilteredPlayers, setUnfilteredPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('hitters');
  const [positionFilter, setPositionFilter] = useState('all');
  const [totalCount, setTotalCount] = useState(0);
  const [leagueSettings, setLeagueSettings] = useState({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(null);
  const [leagueStatus, setLeagueStatus] = useState('setup');
  const [savedPrices, setSavedPrices] = useState({});
  
  // Position assignment state
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [playerForAssignment, setPlayerForAssignment] = useState(null);
  const [showBulkAssignmentModal, setShowBulkAssignmentModal] = useState(false);
  const [currentRoster, setCurrentRoster] = useState([]);
  const [rosterCapacityAnalysis, setRosterCapacityAnalysis] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const PLAYERS_PER_PAGE = 500;
  
  // View mode state
  const [viewMode, setViewMode] = useState('free_agents');
  const [showAll, setShowAll] = useState(false);
  
  // Browse mode states  
  const [browseMode, setBrowseMode] = useState(false);
  const [transactionsEnabled, setTransactionsEnabled] = useState(false);
  const [noPricesWarning, setNoPricesWarning] = useState(false);
  const [pricesExist, setPricesExist] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [allInitialized, setAllInitialized] = useState(false);

  // ========================================
  // ADVANCED FILTERS STATE
  // ========================================
  const [advancedFilters, setAdvancedFilters] = useState({
    // Hitter filters
    minAB: '',
    maxAB: '',
    minHR: '',
    maxHR: '',
    minG: '',
    maxG: '',
    minPrice: '',
    maxPrice: '',
    hitterQualified: false,
    
    // Pitcher filters
    minK: '',
    maxK: '',
    minGS: '',
    maxGS: '',
    minIP: '',
    maxIP: '',
    pitcherQualified: false,
    
    // Date filters
    dateRange: 'season',
    customStartDate: '',
    customEndDate: '',
    
    // MLB Qualification thresholds
    qualifiedPA: 502,
    qualifiedIP: 162
  });

  // ========================================
  // FRONTEND FILTERING LOGIC
  // ========================================
  const applyFrontendFilters = useCallback((playersToFilter) => {
    if (!advancedFilters) return playersToFilter;
    
    let filtered = [...playersToFilter];
    
    // Apply stat filters based on active tab
    if (activeTab === 'hitters') {
      // MLB Qualified filter for hitters
      if (advancedFilters.hitterQualified) {
        const minPA = advancedFilters.qualifiedPA || 502;
        filtered = filtered.filter(p => {
          // Calculate plate appearances: AB + BB + HBP + SF + SH
          const pa = (p.stats?.season?.at_bats || 0) + (p.stats?.season?.walks || 0) + (p.stats?.season?.hit_by_pitch || 0) + 
                     (p.stats?.season?.sacrifice_flies || 0) + (p.stats?.season?.sacrifice_hits || 0);
          return pa >= minPA;
        });
      }
      
      // At Bats filter
      if (advancedFilters.minAB) {
        filtered = filtered.filter(p => (p.stats?.season?.at_bats || 0) >= parseInt(advancedFilters.minAB));
      }
      if (advancedFilters.maxAB) {
        filtered = filtered.filter(p => (p.stats?.season?.at_bats || 0) <= parseInt(advancedFilters.maxAB));
      }
      
      // Home Runs filter
      if (advancedFilters.minHR) {
        filtered = filtered.filter(p => (p.stats?.season?.home_runs || 0) >= parseInt(advancedFilters.minHR));
      }
      if (advancedFilters.maxHR) {
        filtered = filtered.filter(p => (p.stats?.season?.home_runs || 0) <= parseInt(advancedFilters.maxHR));
      }
      
      // Games filter
      if (advancedFilters.minG) {
        filtered = filtered.filter(p => (p.stats?.season?.games_played || 0) >= parseInt(advancedFilters.minG));
      }
      if (advancedFilters.maxG) {
        filtered = filtered.filter(p => (p.stats?.season?.games_played || 0) <= parseInt(advancedFilters.maxG));
      }
      
    } else if (activeTab === 'pitchers') {
      // MLB Qualified filter for pitchers
      if (advancedFilters.pitcherQualified) {
        const minIP = advancedFilters.qualifiedIP || 162;
        filtered = filtered.filter(p => (p.stats?.season?.innings_pitched || 0) >= minIP);
      }
      
      // Strikeouts filter
      if (advancedFilters.minK) {
        filtered = filtered.filter(p => (p.stats?.season?.strikeouts_pitched || 0) >= parseInt(advancedFilters.minK));
      }
      if (advancedFilters.maxK) {
        filtered = filtered.filter(p => (p.stats?.season?.strikeouts_pitched || 0) <= parseInt(advancedFilters.maxK));
      }
      
      // Games Started filter
      if (advancedFilters.minGS) {
        filtered = filtered.filter(p => (p.stats?.season?.games_started || 0) >= parseInt(advancedFilters.minGS));
      }
      if (advancedFilters.maxGS) {
        filtered = filtered.filter(p => (p.stats?.season?.games_started || 0) <= parseInt(advancedFilters.maxGS));
      }
      
      // Innings Pitched filter
      if (advancedFilters.minIP) {
        filtered = filtered.filter(p => (p.stats?.season?.innings_pitched || 0) >= parseFloat(advancedFilters.minIP));
      }
      if (advancedFilters.maxIP) {
        filtered = filtered.filter(p => (p.stats?.season?.innings_pitched || 0) <= parseFloat(advancedFilters.maxIP));
      }
    }
    
    // Price filter (both tabs)
    if (advancedFilters.minPrice) {
      filtered = filtered.filter(p => {
        const price = savedPrices[p.ids?.mlb || p.player_id] || p.price || p.financial?.contract_salary || 0;
        return price >= parseInt(advancedFilters.minPrice);
      });
    }
    if (advancedFilters.maxPrice) {
      filtered = filtered.filter(p => {
        const price = savedPrices[p.ids?.mlb || p.player_id] || p.price || p.financial?.contract_salary || 0;
        return price <= parseInt(advancedFilters.maxPrice);
      });
    }
    
    // Date range filter (if using rolling stats)
    if (advancedFilters.dateRange !== 'season') {
      // This would filter based on last_14_days or other rolling stats
    }
    
    return filtered;
  }, [advancedFilters, activeTab, savedPrices]);

  // ========================================
  // ROSTER CAPACITY LOADING
  // ========================================
  const loadRosterCapacity = useCallback(async () => {
    try {
      const rosterResponse = await leaguesAPI.getMyRosterCanonical(leagueId);
      if (rosterResponse.success) {
        setCurrentRoster(rosterResponse.players || []);
        
        const analysis = analyzeRosterCapacity(league, rosterResponse.players || []);
        setRosterCapacityAnalysis(analysis);
      } else {
        console.error('Failed to load roster for capacity analysis');
      }
    } catch (err) {
      console.error('Error loading roster capacity:', err);
    }
  }, [leagueId, league]);

  // ========================================
  // INITIALIZATION FUNCTIONS
  // ========================================
  const loadLeagueSettings = useCallback(async () => {
    try {
      const response = await leaguesAPI.getLeagueSettings(leagueId);
      if (response.success) {
        setLeagueSettings(response.settings || {});
      }
    } catch (err) {
      console.error('Error loading league settings:', err);
    } finally {
      setSettingsLoaded(true);
    }
  }, [leagueId]);

  const loadSavedPrices = useCallback(async () => {
    try {
      
      // Original price loading logic for non-offline drafts
      let response;
      
      if (typeof leaguesAPI.checkPriceStatus === 'function') {
        const priceStatus = await leaguesAPI.checkPriceStatus(leagueId);
        if (priceStatus.success) {
          if (priceStatus.has_prices) {
            setTransactionsEnabled(true);
            setNoPricesWarning(false);
            setPricesExist(true);
          } else {
            setTransactionsEnabled(false);
            setNoPricesWarning(true);
            setPricesExist(false);
          }
          
          if (priceStatus.prices) {
            response = { success: true, prices: priceStatus.prices };
          }
        }
      }
      
      if (!response && typeof leaguesAPI.getSalarySettings === 'function') {
        const salaryResponse = await leaguesAPI.getSalarySettings(leagueId);
        if (salaryResponse.success && salaryResponse.existing_prices) {
          response = { success: true, prices: salaryResponse.existing_prices };
          setPricesExist(true);
        }
      }
      
      if (!response && typeof leaguesAPI.getPlayerPrices === 'function') {
        response = await leaguesAPI.getPlayerPrices(leagueId);
        if (response && response.success && response.prices) {
          setPricesExist(true);
        }
      }
      
      if (response && response.success && response.prices) {
        const priceMap = {};
        response.prices.forEach(p => {
          const playerId = p.player_id || p.mlb_player_id;
          priceMap[playerId] = p.price || p.salary || 1.0;
        });
        setSavedPrices(priceMap);
      } else {
        setSavedPrices({});
        setPricesExist(false);
      }
    } catch (err) {
      console.error('Error loading saved prices:', err);
      setSavedPrices({});
      setPricesExist(false);
    }
  }, [leagueId]);

  const checkLeagueStatus = useCallback(async () => {
    try {
      const response = await leaguesAPI.getLeagueDetails(leagueId);
      if (response.success) {
        const status = response.league.league_status || response.league.status || 'setup';
        
        // Check for draft type - simplified
        const draftType = response.league.draft_type || 
                         response.league.draft_settings?.type ||
                         response.league.season_setup?.draft_type ||
                         null;
        
        const isOfflineDraft = draftType === 'offline';
        
        // Set league status
        if (isOfflineDraft) {
          setLeagueStatus('offline_draft');
          // Force enable transactions for offline draft
          setTransactionsEnabled(true);
          setNoPricesWarning(false);
          setBrowseMode(false);
        } else {
          setLeagueStatus(status);
          // Enable transactions for normal draft/active states
          if (['draft_ready', 'drafting', 'active'].includes(status)) {
            setTransactionsEnabled(true);
            setNoPricesWarning(false);
          }
        }
      }
    } catch (err) {
      console.error('Error checking league status:', err);
    }
  }, [leagueId]);

  const handleBrowseAnyway = useCallback(() => {
    setBrowseMode(true);
    setNoPricesWarning(false);
  }, []);

  // ========================================
  // PLAYER LOADING
  // ========================================
  const loadPlayers = useCallback(async (search = searchTerm, tab = activeTab, position = positionFilter, showAllPlayers = showAll, pageNum = 0, append = false) => {
    if (pageNum === 0) {
      setLoading(true);
      setPlayers([]);
      setPage(0);
      setHasMore(true);
    } else {
      setBackgroundLoading(true);
    }
    
    setError('');
    setSuccessMessage('');

    try {
      const filters = {
        position: tab,
        limit: PLAYERS_PER_PAGE,
        offset: pageNum * PLAYERS_PER_PAGE,
        show_all: showAllPlayers
      };

      if (position !== 'all' && position !== 'MI' && position !== 'CI') {
        filters.specificPosition = position;
      }

      if (search.trim()) {
        filters.search = search.trim();
      }

      const sortParams = {
        sort_by: activeTab === 'hitters' ? 'at_bats' : 'games_started', 
        sort_order: 'desc'
      };

      const response = await leaguesAPI.getFreeAgentsCanonical(leagueId, {
        ...filters,
        ...sortParams
      });

      if (response.success) {
        let playersWithPrices = (response.players || []).map(player => {
          const playerId = player.ids?.mlb || player.player_id;
          
          let price = 0;
          if (transactionsEnabled && pricesExist && Object.keys(savedPrices).length > 0) {
            price = savedPrices[playerId] || player.financial?.market_price || player.financial?.contract_salary || 1.0;
          } else if (transactionsEnabled && !pricesExist) {
            price = player.financial?.market_price || player.financial?.contract_salary || 1.0;
          }
          
          return {
            ...player,
            price: price,
            display_price: price,
            display_salary: player.financial?.contract_salary || 1.0
          };
        });

        // Frontend filtering for MI/CI positions
        if (position === 'MI') {
          playersWithPrices = playersWithPrices.filter(p => 
            p.info?.position === '2B' || p.info?.position === 'SS'
          );
        } else if (position === 'CI') {
          playersWithPrices = playersWithPrices.filter(p => 
            p.info?.position === '1B' || p.info?.position === '3B'
          );
        } else if (position !== 'all') {
          playersWithPrices = playersWithPrices.filter(p => p.info?.position === position);
        }

        // Store unfiltered for later filtering
        if (append && pageNum > 0) {
          setUnfilteredPlayers(prev => [...prev, ...playersWithPrices]);
        } else {
          setUnfilteredPlayers(playersWithPrices);
        }
        
        // Apply frontend filters
        const filteredPlayers = applyFrontendFilters(playersWithPrices);
        
        if (append && pageNum > 0) {
          setPlayers(prev => {
            const prevUnfiltered = unfilteredPlayers.slice(0, prev.length);
            const prevFiltered = applyFrontendFilters(prevUnfiltered);
            return [...prevFiltered, ...filteredPlayers];
          });
        } else {
          setPlayers(filteredPlayers);
        }
        
        if (pageNum === 0) {
          setTotalCount(filteredPlayers.length);
        }
        setHasMore(response.has_more || false);
        setPage(pageNum);
        
      } else {
        setError(response.message || `Failed to load ${showAllPlayers ? 'all players' : 'free agents'}`);
        if (!append) {
          setPlayers([]);
        }
      }
    } catch (err) {
      console.error(`Error loading ${showAllPlayers ? 'all players' : 'free agents'}:`, err);
      setError(`Failed to load ${showAllPlayers ? 'all players' : 'free agents'}`);
      if (!append) {
        setPlayers([]);
      }
    } finally {
      if (pageNum === 0) {
        setLoading(false);
      } else {
        setBackgroundLoading(false);
      }
    }
  }, [leagueId, searchTerm, activeTab, positionFilter, showAll, transactionsEnabled, pricesExist, savedPrices, applyFrontendFilters, unfilteredPlayers]);

  // Re-apply filters when they change
  useEffect(() => {
    if (unfilteredPlayers.length > 0) {
      const filtered = applyFrontendFilters(unfilteredPlayers);
      setPlayers(filtered);
      setTotalCount(filtered.length);
    }
  }, [advancedFilters, unfilteredPlayers, applyFrontendFilters]);

  // ========================================
  // PLAYER ACTIONS
  // ========================================
  const handleAddPlayer = useCallback(async (player) => {
    // Check if transactions are allowed
    const isOfflineDraft = leagueStatus === 'offline_draft';
    const isDraftMode = ['drafting', 'draft_ready', 'offline_draft'].includes(leagueStatus);
    
    // Allow transactions in offline draft mode, commissioner mode, or when normally enabled
    if (!isOfflineDraft && !isDraftMode && !isCommissionerMode && !transactionsEnabled) {
      setError('Transactions are not allowed until the commissioner sets player prices');
      setTimeout(() => setError(''), 5000);
      return;
    }

    // Check ownership using canonical structure
    const isOwned = player.league_context?.team?.team_name || player.team_id;
    if (isOwned) {
      setError('Player is already owned by a team');
      setTimeout(() => setError(''), 5000);
      return;
    }

    if (!rosterCapacityAnalysis) {
      await loadRosterCapacity();
      setError('Checking roster capacity...');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const capacityCheck = canAddPlayers(1, rosterCapacityAnalysis);
    if (!capacityCheck.canAdd) {
      setError(`Cannot add player: ${capacityCheck.message}`);
      setTimeout(() => setError(''), 5000);
      return;
    }

    const suggestion = findBestPositionForPlayer(player, rosterCapacityAnalysis, league);
    
    if (!suggestion.hasSuggestions) {
      const firstName = player.info?.first_name || player.first_name;
      const lastName = player.info?.last_name || player.last_name;
      setError(`No available roster slots for ${firstName} ${lastName}`);
      setTimeout(() => setError(''), 5000);
      return;
    }

    // Always show modal for user confirmation (with best position pre-selected)
    setPlayerForAssignment(player);
    setShowPositionModal(true);
  }, [transactionsEnabled, leagueStatus, isCommissionerMode, rosterCapacityAnalysis, league, loadRosterCapacity]);

  const executePlayerAssignment = useCallback(async (player, assignment) => {
    const firstName = player.info?.first_name || player.first_name;
    const lastName = player.info?.last_name || player.last_name;
    const leaguePlayerId = player.ids?.league_player || player.league_player_id;

    setAddingPlayer(leaguePlayerId);
    setError('');

    try {
      const playerData = {
        league_player_id: leaguePlayerId,
        salary: assignment.type === 'minors' ? 0 : (player.display_price || player.price || player.financial?.market_price || player.salary || 1.0),
        contract_years: assignment.type === 'minors' ? 0 : 2,
        roster_status: assignment.type || 'active',
        roster_position: assignment.type === 'active' ? assignment.slotId : null,
        start_contract: assignment.type !== 'minors'
      };

      if (isCommissionerMode) {
        playerData.commissioner_action = true;
        playerData.target_team_id = getTargetTeamId(null);
      }

      const response = await leaguesAPI.addPlayerToTeam(leagueId, playerData);

      if (response.success) {
        const teamName = isCommissionerMode ? activeTeamName : 'your team';
        const positionText = assignment.type === 'active' ? assignment.position.toUpperCase() : assignment.type;
        const firstName = player.info?.first_name || player.first_name;
        const lastName = player.info?.last_name || player.last_name;
        setSuccessMessage(`${response.player_name || firstName + ' ' + lastName} added to ${teamName} (${positionText})!`);
        
        const leaguePlayerId = player.ids?.league_player || player.league_player_id;
        if (!showAll) {
          setPlayers(prev => prev.filter(p => {
            const pId = p.ids?.league_player || p.league_player_id;
            return pId !== leaguePlayerId;
          }));
          setTotalCount(prev => prev - 1);
        } else {
          loadPlayers(searchTerm, activeTab, positionFilter, showAll);
        }
        
        await loadRosterCapacity();
        
        window.dispatchEvent(new Event('roster-updated'));
        
        if (onPlayerAdded) {
          onPlayerAdded(player);
        }
        
        setTimeout(() => {
          navigate(`/leagues/${leagueId}`, { 
            state: { activeSection: 'my-roster' },
            replace: false 
          });
        }, 1000);
        
      } else {
        const errorMsg = response.message || response.error?.message || response.error || 'Failed to add player';
        setError(errorMsg);
      }
    } catch (err) {
      if (err.response?.data) {
        const errorMsg = err.response.data.message || 
                        err.response.data.error?.message || 
                        err.response.data.error ||
                        JSON.stringify(err.response.data) ||
                        'Failed to add player';
        setError(errorMsg);
      } else {
        setError(err.message || 'Failed to add player');
      }
    } finally {
      setAddingPlayer(null);
      setShowPositionModal(false);
      setPlayerForAssignment(null);
    }
  }, [isCommissionerMode, activeTeamName, getTargetTeamId, leagueId, showAll, loadPlayers, searchTerm, activeTab, positionFilter, loadRosterCapacity, onPlayerAdded, navigate]);

  const handleBatchAddPlayers = useCallback(async (selectedPlayers) => {
    if (!transactionsEnabled) {
      setError('Transactions are not allowed until prices are set');
      return;
    }

    if (selectedPlayers.length === 0) {
      setError('No players selected');
      return;
    }

    if (!rosterCapacityAnalysis) {
      await loadRosterCapacity();
      setError('Checking roster capacity...');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const capacityCheck = canAddPlayers(selectedPlayers.length, rosterCapacityAnalysis);
    if (!capacityCheck.canAdd) {
      setError(`Cannot add ${selectedPlayers.length} players: ${capacityCheck.message}`);
      setTimeout(() => setError(''), 8000);
      return;
    }

    setShowBulkAssignmentModal(true);
  }, [transactionsEnabled, rosterCapacityAnalysis, loadRosterCapacity]);

  const handleBulkAssignmentComplete = useCallback(async (assignmentData) => {
    setError('');
    
    const results = {
      successful: [],
      failed: []
    };

    try {
      for (const assignment of assignmentData) {
        try {
          const leaguePlayerId = assignment.player.ids?.league_player || assignment.player.league_player_id;
          const playerData = {
            league_player_id: leaguePlayerId,
            salary: assignment.salary,
            contract_years: assignment.contract_years,
            roster_status: assignment.roster_status,
            roster_position: assignment.roster_position,
            start_contract: assignment.start_contract
          };

          if (isCommissionerMode) {
            playerData.commissioner_action = true;
            playerData.target_team_id = getTargetTeamId(null);
          }

          const response = await leaguesAPI.addPlayerToTeam(leagueId, playerData);

          if (response.success) {
            const firstName = assignment.player.info?.first_name || assignment.player.first_name;
            const lastName = assignment.player.info?.last_name || assignment.player.last_name;
            results.successful.push({
              player: assignment.player,
              name: response.player_name || `${firstName} ${lastName}`,
              position: assignment.roster_status === 'active' ? assignment.roster_position : assignment.roster_status
            });
          } else {
            const firstName = assignment.player.info?.first_name || assignment.player.first_name;
            const lastName = assignment.player.info?.last_name || assignment.player.last_name;
            results.failed.push({
              player: assignment.player,
              name: `${firstName} ${lastName}`,
              error: response.message || 'Unknown error'
            });
          }
        } catch (playerErr) {
          const firstName = assignment.player.info?.first_name || assignment.player.first_name;
          const lastName = assignment.player.info?.last_name || assignment.player.last_name;
          results.failed.push({
            player: assignment.player,
            name: `${firstName} ${lastName}`,
            error: playerErr.message || 'Network error'
          });
        }
      }

      if (results.successful.length > 0) {
        const teamName = isCommissionerMode ? activeTeamName : 'your team';
        setSuccessMessage(`Successfully added ${results.successful.length} players to ${teamName}!`);
        
        clearAllSelections();
        
        await loadRosterCapacity();
        window.dispatchEvent(new Event('roster-updated'));
        
        navigate(`/leagues/${leagueId}`, { 
          state: { activeSection: 'my-roster' } 
        });
      }

      if (results.failed.length > 0) {
        const failedNames = results.failed.map(f => f.name).join(', ');
        setError(`Failed to add: ${failedNames}`);
      }

    } catch (err) {
      console.error('Error in bulk assignment completion:', err);
      setError('Bulk assignment failed');
    } finally {
      setShowBulkAssignmentModal(false);
    }
  }, [isCommissionerMode, activeTeamName, getTargetTeamId, leagueId, clearAllSelections, loadRosterCapacity, navigate]);

  const handlePlayerClick = useCallback((player) => {
    const playerId = player.ids?.mlb || player.mlb_player_id || player.player_id;
    navigate(`/player/${playerId}?leagueId=${leagueId}`);
  }, [navigate, leagueId]);

  // ========================================
  // COMPONENT INITIALIZATION
  // ========================================
  useEffect(() => {
    if (leagueId && !initialized) {
      setInitialized(true);
      
      const initializeComponent = async () => {
        // Force enable transactions if in commissioner mode
        if (isCommissionerMode) {
          setTransactionsEnabled(true);
          setNoPricesWarning(false);
          setBrowseMode(false);
        }
        
        await loadLeagueSettings();
        await loadSavedPrices(); 
        await checkLeagueStatus();
        await loadRosterCapacity();
        
        setAllInitialized(true);
      };
      
      initializeComponent();
    }
  }, [leagueId, initialized, isCommissionerMode, loadLeagueSettings, loadSavedPrices, checkLeagueStatus, loadRosterCapacity]);

  useEffect(() => {
    if (allInitialized && (transactionsEnabled || browseMode)) {
      loadPlayers(searchTerm, activeTab, positionFilter, showAll, 0, false);
    }
  }, [allInitialized, transactionsEnabled, browseMode, activeTab, positionFilter, showAll]);

  useEffect(() => {
    if ((leagueStatus === 'setup' || leagueStatus === 'pricing') && !browseMode) {
      const interval = setInterval(() => {
        checkLeagueStatus();
        loadSavedPrices();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [leagueStatus, browseMode, checkLeagueStatus, loadSavedPrices]);

  // ========================================
  // LOADING STATE
  // ========================================
  if (!allInitialized) {
    return (
      <div className={dynastyTheme.components.section}>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <RefreshCw className={`w-6 h-6 animate-spin ${dynastyTheme.classes.text.primary}`} />
            <span className={dynastyTheme.classes.text.white}>
              Loading league settings and roster capacity...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // STATE OBJECT FOR CHILD COMPONENTS
  // ========================================
  const freeAgentState = {
    players,
    totalCount,
    loading,
    backgroundLoading,
    hasMore,
    page,
    searchTerm,
    setSearchTerm,
    activeTab,
    setActiveTab,
    positionFilter,
    setPositionFilter,
    viewMode,
    setViewMode,
    showAll,
    setShowAll,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    leagueStatus,
    transactionsEnabled,
    browseMode,
    noPricesWarning,
    pricesExist,
    addingPlayer,
    rosterCapacityAnalysis,
    loadPlayers,
    handlePlayerClick,
    handleAddPlayer,
    handleBatchAddPlayers,
    handleBrowseAnyway,
    checkLeagueStatus,
    loadSavedPrices,
    loadRosterCapacity,
    savedPrices,
    advancedFilters,
    setAdvancedFilters,
    loadMore: () => {
      if (!backgroundLoading && hasMore) {
        loadPlayers(searchTerm, activeTab, positionFilter, showAll, page + 1, true);
      }
    }
  };

  // ========================================
  // MAIN COMPONENT RENDER
  // ========================================
  return (
    <div className={dynastyTheme.components.section}>
      <CommissionerModeBar 
        league={league}
        onTeamSwitch={() => {
          if (transactionsEnabled || browseMode) {
            loadPlayers(searchTerm, activeTab, positionFilter, showAll, 0, false);
            loadRosterCapacity();
          }
        }}
      />
      
      {/* Commissioner Toggle - Prominently Displayed */}
      {(user?.is_commissioner || isCommissioner) && (
        <div className="mb-4">
          <CommissionerToggle 
            leagueId={leagueId} 
            userIsCommissioner={user?.is_commissioner || isCommissioner || false}
          />
        </div>
      )}

      {/* Status Banners */}
      {allInitialized && !transactionsEnabled && !browseMode && !addingPlayer && !loading && (
        <StatusBanners 
          state={freeAgentState}
          isCommissionerMode={isCommissionerMode}
          activeTeamName={activeTeamName}
        />
      )}

      {/* Main Content */}
      {(transactionsEnabled || browseMode) && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className={dynastyTheme.components.heading.h2}>
                {viewMode === 'all_players' ? 'All Players' : 'Free Agent Search'} 
                {browseMode && !transactionsEnabled && ' (View Only)'}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              {transactionsEnabled && leagueStatus === 'active' && (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                  Season Active
                </span>
              )}
              {transactionsEnabled && leagueStatus === 'drafting' && (
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                  Drafting
                </span>
              )}
              {transactionsEnabled && leagueStatus === 'draft_ready' && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                  Draft Ready
                </span>
              )}
              
              {/* Roster Capacity Indicator */}
              {rosterCapacityAnalysis && (
                <div className={`px-3 py-1 rounded-full text-sm ${
                  rosterCapacityAnalysis.availableSlots > 5 
                    ? 'bg-green-500/20 text-green-400'
                    : rosterCapacityAnalysis.availableSlots > 0
                    ? 'bg-yellow-500/20 text-yellow-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {rosterCapacityAnalysis.availableSlots} roster slots
                </div>
              )}
              
              <button
                onClick={() => {
                  checkLeagueStatus();
                  loadSavedPrices();
                  loadRosterCapacity();
                  loadPlayers(searchTerm, activeTab, positionFilter, showAll);
                }}
                disabled={loading}
                className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} flex items-center gap-2 disabled:opacity-50`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <SearchControls 
            state={freeAgentState}
            leagueId={leagueId}
            isCommissionerMode={isCommissionerMode}
            activeTeamName={activeTeamName}
          />

          <PlayerTable 
            state={freeAgentState}
            leagueId={leagueId}
            isCommissionerMode={isCommissionerMode}
            activeTeamName={activeTeamName}
          />
        </>
      )}

      {/* POSITION ASSIGNMENT MODALS */}
      
      {/* Single Player Position Assignment */}
      <PositionAssignmentDropdown
        player={playerForAssignment}
        league={league}
        currentRoster={currentRoster}
        onAssign={(assignmentData) => executePlayerAssignment(assignmentData.player, {
          position: assignmentData.assignment === 'bench' ? 'bench' : 
                   assignmentData.assignment === 'minors' ? 'minors' :
                   assignmentData.assignment.split('_')[0],
          slotId: assignmentData.assignment,
          type: assignmentData.roster_status,
          reason: 'Manual selection',
          priority: 1
        })}
        onCancel={() => {
          setShowPositionModal(false);
          setPlayerForAssignment(null);
        }}
        isVisible={showPositionModal}
      />
      
      {/* Bulk Player Position Assignment */}
      <BulkPositionAssignmentModal
        selectedPlayers={getSelectedPlayerObjects(players)}
        league={league}
        capacityAnalysis={rosterCapacityAnalysis}
        currentRoster={currentRoster}
        onAssignAll={handleBulkAssignmentComplete}
        onCancel={() => setShowBulkAssignmentModal(false)}
        isVisible={showBulkAssignmentModal}
      />
    </div>
  );
};

export default FreeAgentSearch;