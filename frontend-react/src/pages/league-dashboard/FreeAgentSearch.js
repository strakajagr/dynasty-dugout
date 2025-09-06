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
          const pa = (p.at_bats || 0) + (p.walks || 0) + (p.hit_by_pitch || 0) + 
                     (p.sacrifice_flies || 0) + (p.sacrifice_hits || 0);
          return pa >= minPA;
        });
      }
      
      // At Bats filter
      if (advancedFilters.minAB) {
        filtered = filtered.filter(p => (p.at_bats || 0) >= parseInt(advancedFilters.minAB));
      }
      if (advancedFilters.maxAB) {
        filtered = filtered.filter(p => (p.at_bats || 0) <= parseInt(advancedFilters.maxAB));
      }
      
      // Home Runs filter
      if (advancedFilters.minHR) {
        filtered = filtered.filter(p => (p.home_runs || 0) >= parseInt(advancedFilters.minHR));
      }
      if (advancedFilters.maxHR) {
        filtered = filtered.filter(p => (p.home_runs || 0) <= parseInt(advancedFilters.maxHR));
      }
      
      // Games filter
      if (advancedFilters.minG) {
        filtered = filtered.filter(p => (p.games_played || 0) >= parseInt(advancedFilters.minG));
      }
      if (advancedFilters.maxG) {
        filtered = filtered.filter(p => (p.games_played || 0) <= parseInt(advancedFilters.maxG));
      }
      
    } else if (activeTab === 'pitchers') {
      // MLB Qualified filter for pitchers
      if (advancedFilters.pitcherQualified) {
        const minIP = advancedFilters.qualifiedIP || 162;
        filtered = filtered.filter(p => (p.innings_pitched || 0) >= minIP);
      }
      
      // Strikeouts filter
      if (advancedFilters.minK) {
        filtered = filtered.filter(p => (p.strikeouts_pitched || 0) >= parseInt(advancedFilters.minK));
      }
      if (advancedFilters.maxK) {
        filtered = filtered.filter(p => (p.strikeouts_pitched || 0) <= parseInt(advancedFilters.maxK));
      }
      
      // Games Started filter
      if (advancedFilters.minGS) {
        filtered = filtered.filter(p => (p.games_started || 0) >= parseInt(advancedFilters.minGS));
      }
      if (advancedFilters.maxGS) {
        filtered = filtered.filter(p => (p.games_started || 0) <= parseInt(advancedFilters.maxGS));
      }
      
      // Innings Pitched filter
      if (advancedFilters.minIP) {
        filtered = filtered.filter(p => (p.innings_pitched || 0) >= parseFloat(advancedFilters.minIP));
      }
      if (advancedFilters.maxIP) {
        filtered = filtered.filter(p => (p.innings_pitched || 0) <= parseFloat(advancedFilters.maxIP));
      }
    }
    
    // Price filter (both tabs)
    if (advancedFilters.minPrice) {
      filtered = filtered.filter(p => {
        const price = savedPrices[p.mlb_player_id || p.player_id] || p.price || p.salary || 0;
        return price >= parseInt(advancedFilters.minPrice);
      });
    }
    if (advancedFilters.maxPrice) {
      filtered = filtered.filter(p => {
        const price = savedPrices[p.mlb_player_id || p.player_id] || p.price || p.salary || 0;
        return price <= parseInt(advancedFilters.maxPrice);
      });
    }
    
    // Date range filter (if using rolling stats)
    if (advancedFilters.dateRange !== 'season') {
      // This would filter based on last_14_days or other rolling stats
      console.log('Date range filter:', advancedFilters.dateRange);
    }
    
    return filtered;
  }, [advancedFilters, activeTab, savedPrices]);

  // ========================================
  // ROSTER CAPACITY LOADING
  // ========================================
  const loadRosterCapacity = useCallback(async () => {
    try {
      console.log('Loading roster capacity analysis...');
      
      const rosterResponse = await leaguesAPI.getMyRoster(leagueId);
      if (rosterResponse.success) {
        setCurrentRoster(rosterResponse.players || []);
        
        const analysis = analyzeRosterCapacity(league, rosterResponse.players || []);
        setRosterCapacityAnalysis(analysis);
        
        console.log('Roster capacity analysis:', analysis);
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
        const status = response.league.league_status || 'setup';
        setLeagueStatus(status);
        
        if (['draft_ready', 'drafting', 'active'].includes(status)) {
          setTransactionsEnabled(true);
          setNoPricesWarning(false);
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

      const response = await leaguesAPI.getFreeAgentsEnhanced(leagueId, {
        ...filters,
        ...sortParams
      });

      if (response.success) {
        let playersWithPrices = (response.players || []).map(player => {
          const playerId = player.mlb_player_id || player.player_id;
          
          let price = 0;
          if (transactionsEnabled && pricesExist && Object.keys(savedPrices).length > 0) {
            price = savedPrices[playerId] || player.price || player.salary || 1.0;
          } else if (transactionsEnabled && !pricesExist) {
            price = player.price || player.salary || 1.0;
          }
          
          return {
            ...player,
            price: price,
            display_price: price,
            display_salary: player.salary || 1.0
          };
        });

        // Frontend filtering for MI/CI positions
        if (position === 'MI') {
          playersWithPrices = playersWithPrices.filter(p => 
            p.position === '2B' || p.position === 'SS'
          );
        } else if (position === 'CI') {
          playersWithPrices = playersWithPrices.filter(p => 
            p.position === '1B' || p.position === '3B'
          );
        } else if (position !== 'all') {
          playersWithPrices = playersWithPrices.filter(p => p.position === position);
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
    console.log('Single add player:', player.first_name, player.last_name);
    
    if (!transactionsEnabled) {
      setError('Transactions are not allowed until the commissioner sets player prices');
      setTimeout(() => setError(''), 5000);
      return;
    }

    if (player.team_id) {
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
      setError(`No available roster slots for ${player.first_name} ${player.last_name}`);
      setTimeout(() => setError(''), 5000);
      return;
    }

    if (suggestion.allSuggestions.length === 1 && suggestion.bestSuggestion.priority === 1) {
      console.log('Auto-assigning to best position:', suggestion.bestSuggestion);
      await executePlayerAssignment(player, suggestion.bestSuggestion);
    } else {
      setPlayerForAssignment(player);
      setShowPositionModal(true);
    }
  }, [transactionsEnabled, rosterCapacityAnalysis, league, loadRosterCapacity]);

  const executePlayerAssignment = useCallback(async (player, assignment) => {
    console.log('Executing player assignment:', {
      player: `${player.first_name} ${player.last_name}`,
      assignment,
      isCommissionerMode,
      activeTeamName
    });

    setAddingPlayer(player.league_player_id);
    setError('');

    try {
      const playerData = {
        league_player_id: player.league_player_id,
        salary: assignment.type === 'minors' ? 0 : (player.display_price || player.price || player.salary || 1.0),
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
        setSuccessMessage(`${response.player_name || player.first_name + ' ' + player.last_name} added to ${teamName} (${positionText})!`);
        
        if (!showAll) {
          setPlayers(prev => prev.filter(p => p.league_player_id !== player.league_player_id));
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
        setError(response.message || 'Failed to add player');
      }
    } catch (err) {
      console.error('Error adding player:', err);
      setError('Failed to add player');
    } finally {
      setAddingPlayer(null);
      setShowPositionModal(false);
      setPlayerForAssignment(null);
    }
  }, [isCommissionerMode, activeTeamName, getTargetTeamId, leagueId, showAll, loadPlayers, searchTerm, activeTab, positionFilter, loadRosterCapacity, onPlayerAdded, navigate]);

  const handleBatchAddPlayers = useCallback(async (selectedPlayers) => {
    console.log('Bulk add triggered with', selectedPlayers.length, 'players');
    
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
    console.log('Executing bulk assignment:', assignmentData);
    setError('');
    
    const results = {
      successful: [],
      failed: []
    };

    try {
      for (const assignment of assignmentData) {
        try {
          const playerData = {
            league_player_id: assignment.player.league_player_id,
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
            results.successful.push({
              player: assignment.player,
              name: response.player_name || `${assignment.player.first_name} ${assignment.player.last_name}`,
              position: assignment.roster_status === 'active' ? assignment.roster_position : assignment.roster_status
            });
          } else {
            results.failed.push({
              player: assignment.player,
              name: `${assignment.player.first_name} ${assignment.player.last_name}`,
              error: response.message || 'Unknown error'
            });
          }
        } catch (playerErr) {
          results.failed.push({
            player: assignment.player,
            name: `${assignment.player.first_name} ${assignment.player.last_name}`,
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
    navigate(`/player/${player.mlb_player_id || player.player_id}?leagueId=${leagueId}`);
  }, [navigate, leagueId]);

  // ========================================
  // COMPONENT INITIALIZATION
  // ========================================
  useEffect(() => {
    if (leagueId && !initialized) {
      console.log('Initializing FreeAgentSearch component:', { leagueId });
      setInitialized(true);
      
      const initializeComponent = async () => {
        console.log('Starting async initialization...');
        await loadLeagueSettings();
        console.log('League settings loaded');
        await loadSavedPrices(); 
        console.log('Prices loaded');
        await checkLeagueStatus();
        console.log('Status checked');
        await loadRosterCapacity();
        console.log('Roster capacity loaded');
        
        setAllInitialized(true);
        console.log('ALL INITIALIZATION COMPLETE');
      };
      
      initializeComponent();
    }
  }, [leagueId, initialized, loadLeagueSettings, loadSavedPrices, checkLeagueStatus, loadRosterCapacity]);

  useEffect(() => {
    if (allInitialized && (transactionsEnabled || browseMode)) {
      console.log('Loading players:', { allInitialized, transactionsEnabled, browseMode });
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
              
              <CommissionerToggle 
                leagueId={leagueId} 
                userIsCommissioner={user?.is_commissioner || isCommissioner || false}
              />
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