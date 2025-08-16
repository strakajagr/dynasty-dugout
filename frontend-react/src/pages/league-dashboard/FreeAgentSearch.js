import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Filter, RefreshCw, Users, Zap, ExternalLink } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';
import { DynastyTable, createFreeAgentHitterColumns, createFreeAgentPitcherColumns } from '../../services/tableService';
import { leaguesAPI } from '../../services/apiService';

const FreeAgentSearch = ({ leagueId, onPlayerAdded }) => {
  const navigate = useNavigate();
  
  // State management
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('hitters');
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(null);
  
  // League settings state
  const [leagueSettings, setLeagueSettings] = useState({
    use_contracts: true,
    use_salaries: true,
    use_waivers: false,
    show_advanced_stats: true
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Pagination settings
  const playersPerPage = 100;

  // Position mappings
  const hitterPositions = ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH'];
  const pitcherPositions = ['SP', 'RP', 'P'];

  // Load league settings
  const loadLeagueSettings = async () => {
    try {
      const response = await leaguesAPI.getLeagueSettings(leagueId);
      if (response.success) {
        setLeagueSettings(response.ui_features);
        setSettingsLoaded(true);
      }
    } catch (err) {
      console.error('Error loading league settings:', err);
      setSettingsLoaded(true);
    }
  };

  // Load free agents
  const loadFreeAgents = async (page = 1, search = searchTerm, tab = activeTab) => {
    setLoading(true);
    setError('');

    try {
      const filters = {
        limit: playersPerPage,
        offset: (page - 1) * playersPerPage
      };

      if (search.trim()) filters.search = search.trim();

      const response = await leaguesAPI.getFreeAgents(leagueId, filters);

      if (response.success) {
        // Filter players based on active tab
        let filteredPlayers = response.players || [];
        if (tab === 'hitters') {
          filteredPlayers = filteredPlayers.filter(player => 
            hitterPositions.includes(player.position)
          );
        } else if (tab === 'pitchers') {
          filteredPlayers = filteredPlayers.filter(player => 
            pitcherPositions.includes(player.position)
          );
        }

        setPlayers(filteredPlayers);
        setTotalCount(filteredPlayers.length);
        setHasMore(response.has_more || false);
        setCurrentPage(page);
      } else {
        setError(response.message || 'Failed to load free agents');
        setPlayers([]);
      }
    } catch (err) {
      console.error('Error loading free agents:', err);
      setError('Failed to load free agents');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (leagueId) {
      loadLeagueSettings();
    }
  }, [leagueId]);

  // Load free agents when settings are loaded or tab changes
  useEffect(() => {
    if (leagueId && settingsLoaded) {
      loadFreeAgents();
    }
  }, [leagueId, activeTab, settingsLoaded]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadFreeAgents(1, searchTerm, activeTab);
  };

  // Handle tab change
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setCurrentPage(1);
  };

  // Handle page navigation
  const handlePageChange = (newPage) => {
    loadFreeAgents(newPage, searchTerm, activeTab);
  };

  // Navigate to player profile
  const handlePlayerClick = (player) => {
    navigate(`/player/${player.mlb_player_id}?leagueId=${leagueId}`);
  };

  // Add player to team
  const handleAddPlayer = async (player) => {
    setAddingPlayer(player.mlb_player_id);
    setError('');

    try {
      const playerData = {
        player_id: player.mlb_player_id,
        salary: player.salary || 1.0,
        contract_years: player.contract_years || 1,
        roster_status: 'active'
      };

      const response = await leaguesAPI.addPlayerToTeam(leagueId, playerData);

      if (response.success) {
        // Remove player from free agents list
        setPlayers(prev => prev.filter(p => p.mlb_player_id !== player.mlb_player_id));
        setTotalCount(prev => prev - 1);
        
        // Notify parent component
        if (onPlayerAdded) {
          onPlayerAdded(player);
        }

        setError('');
      } else {
        setError(response.message || 'Failed to add player');
      }
    } catch (err) {
      console.error('Error adding player:', err);
      setError('Failed to add player');
    } finally {
      setAddingPlayer(null);
    }
  };

  // Enhanced hitter columns with two-line display
  const getEnhancedHitterColumns = () => {
    const baseColumns = [
      {
        key: 'player_name',
        title: 'Name',
        width: 200,
        sortable: false,
        allowOverflow: true,
        render: (_, player) => (
          <div className="text-left py-1">
            <button
              onClick={() => handlePlayerClick(player)}
              className={`font-semibold ${dynastyTheme.classes.text.white} hover:${dynastyTheme.classes.text.primary} ${dynastyTheme.classes.transition} flex items-center group text-left`}
            >
              {player.first_name} {player.last_name}
              <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className={`${dynastyTheme.classes.text.neutralLight} text-xs`}>
              L14: .{Math.round(((player.last_14_avg || player.batting_avg || 0)) * 1000).toString().padStart(3, '0')} • {player.last_14_hr || 0}HR • {player.last_14_rbi || 0}RBI
            </div>
          </div>
        )
      },
      {
        key: 'team',
        title: 'Team',
        width: 70,
        render: (_, player) => (
          <span className={`${dynastyTheme.components.badge.secondary} text-xs px-2 py-1`}>
            {player.mlb_team || '--'}
          </span>
        )
      },
      {
        key: 'positions',
        title: 'Pos',
        width: 80,
        render: (_, player) => (
          <span className={`${dynastyTheme.components.badge.info} text-xs px-2 py-1`}>
            {player.position || '--'}
          </span>
        )
      }
    ];

    // Core hitting stats
    const coreStats = [
      {
        key: 'games_played',
        title: 'G',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'at_bats',
        title: 'AB',
        width: 60,
        render: (value) => value || 0
      },
      {
        key: 'runs',
        title: 'R',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'hits',
        title: 'H',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'home_runs',
        title: 'HR',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'rbi',
        title: 'RBI',
        width: 60,
        render: (value) => value || 0
      },
      {
        key: 'strikeouts',
        title: 'SO',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'stolen_bases',
        title: 'SB',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'caught_stealing',
        title: 'CS',
        width: 50,
        render: (value) => value || 0
      }
    ];

    // Advanced rate stats
    const rateStats = [
      {
        key: 'batting_avg',
        title: 'AVG',
        width: 70,
        render: (value) => `.${Math.round((value || 0) * 1000).toString().padStart(3, '0')}`
      },
      {
        key: 'obp',
        title: 'OBP',
        width: 70,
        render: (value) => `.${Math.round((value || 0) * 1000).toString().padStart(3, '0')}`
      },
      {
        key: 'slg',
        title: 'SLG',
        width: 70,
        render: (value) => `.${Math.round((value || 0) * 1000).toString().padStart(3, '0')}`
      },
      {
        key: 'ops',
        title: 'OPS',
        width: 80,
        render: (value) => (value || 0).toFixed(3)
      }
    ];

    // Contract/salary columns
    const contractColumns = [];
    if (leagueSettings.use_salaries || leagueSettings.use_contracts) {
      contractColumns.push({
        key: 'contract',
        title: 'Contract',
        width: 100,
        render: (_, player) => (
          <div className={`${dynastyTheme.classes.text.white} text-xs`}>
            {leagueSettings.use_salaries && (
              <div>${(player.salary || 1.0).toFixed(1)}M</div>
            )}
            {leagueSettings.use_contracts && (
              <div className={dynastyTheme.classes.text.neutralLight}>
                {player.contract_years || 1}yr{(player.contract_years || 1) !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )
      });
    }

    // Action column
    const actionColumn = {
      key: 'actions',
      title: 'Action',
      width: 90,
      sortable: false,
      render: (_, player) => (
        <button
          onClick={() => handleAddPlayer(player)}
          disabled={addingPlayer === player.mlb_player_id || loading}
          className={`${dynastyTheme.utils.getComponent('button', 'primary', 'xs')} flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1`}
        >
          {addingPlayer === player.mlb_player_id ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <UserPlus className="w-3 h-3" />
          )}
          Add
        </button>
      )
    };

    return [...baseColumns, ...coreStats, ...rateStats, ...contractColumns, actionColumn];
  };

  // Enhanced pitcher columns with two-line display
  const getEnhancedPitcherColumns = () => {
    const baseColumns = [
      {
        key: 'player_name',
        title: 'Name',
        width: 200,
        sortable: false,
        allowOverflow: true,
        render: (_, player) => (
          <div className="text-left py-1">
            <button
              onClick={() => handlePlayerClick(player)}
              className={`font-semibold ${dynastyTheme.classes.text.white} hover:${dynastyTheme.classes.text.primary} ${dynastyTheme.classes.transition} flex items-center group text-left`}
            >
              {player.first_name} {player.last_name}
              <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className={`${dynastyTheme.classes.text.neutralLight} text-xs`}>
              L14: {(player.last_14_era || player.era || 0).toFixed(2)} ERA • {(player.last_14_ip || 0).toFixed(1)} IP
            </div>
          </div>
        )
      },
      {
        key: 'team',
        title: 'Team',
        width: 70,
        render: (_, player) => (
          <span className={`${dynastyTheme.components.badge.secondary} text-xs px-2 py-1`}>
            {player.mlb_team || '--'}
          </span>
        )
      }
    ];

    // Core pitching stats
    const coreStats = [
      {
        key: 'games_played',
        title: 'G',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'games_started',
        title: 'Starts',
        width: 70,
        render: (value) => value || 0
      },
      {
        key: 'quality_starts',
        title: 'QS',
        width: 50,
        render: (value, player) => {
          // Calculate QS if not provided (rough estimate: 60% of starts)
          const qs = value || Math.floor((player.games_started || 0) * 0.6);
          return qs;
        }
      },
      {
        key: 'wins',
        title: 'W',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'innings_pitched',
        title: 'IP',
        width: 70,
        render: (value) => (value || 0).toFixed(1)
      },
      {
        key: 'strikeouts_pitched',
        title: 'SO',
        width: 60,
        render: (value) => value || 0
      },
      {
        key: 'saves',
        title: 'SV',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'blown_saves',
        title: 'BS',
        width: 50,
        render: (value) => value || 0
      }
    ];

    // Rate stats
    const rateStats = [
      {
        key: 'era',
        title: 'ERA',
        width: 70,
        render: (value) => (value || 0).toFixed(2)
      },
      {
        key: 'whip',
        title: 'WHIP',
        width: 80,
        render: (value) => (value || 0).toFixed(3)
      },
      {
        key: 'hits_allowed',
        title: 'H',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'earned_runs',
        title: 'R',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'walks_allowed',
        title: 'BB',
        width: 50,
        render: (value) => value || 0
      },
      {
        key: 'k_per_ip',
        title: 'K/IP',
        width: 70,
        render: (value, player) => {
          const ip = player.innings_pitched || 0;
          const k = player.strikeouts_pitched || 0;
          return ip > 0 ? (k / ip).toFixed(2) : '0.00';
        }
      }
    ];

    // Contract/salary columns
    const contractColumns = [];
    if (leagueSettings.use_salaries || leagueSettings.use_contracts) {
      contractColumns.push({
        key: 'contract',
        title: 'Contract',
        width: 100,
        render: (_, player) => (
          <div className={`${dynastyTheme.classes.text.white} text-xs`}>
            {leagueSettings.use_salaries && (
              <div>${(player.salary || 1.0).toFixed(1)}M</div>
            )}
            {leagueSettings.use_contracts && (
              <div className={dynastyTheme.classes.text.neutralLight}>
                {player.contract_years || 1}yr{(player.contract_years || 1) !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )
      });
    }

    // Action column
    const actionColumn = {
      key: 'actions',
      title: 'Action',
      width: 90,
      sortable: false,
      render: (_, player) => (
        <button
          onClick={() => handleAddPlayer(player)}
          disabled={addingPlayer === player.mlb_player_id || loading}
          className={`${dynastyTheme.utils.getComponent('button', 'primary', 'xs')} flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1`}
        >
          {addingPlayer === player.mlb_player_id ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <UserPlus className="w-3 h-3" />
          )}
          Add
        </button>
      )
    };

    return [...baseColumns, ...coreStats, ...rateStats, ...contractColumns, actionColumn];
  };

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / playersPerPage);
  const startPlayer = (currentPage - 1) * playersPerPage + 1;
  const endPlayer = Math.min(currentPage * playersPerPage, totalCount);

  // Show loading while settings are being fetched
  if (!settingsLoaded) {
    return (
      <div className={dynastyTheme.components.section}>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <RefreshCw className={`w-6 h-6 animate-spin ${dynastyTheme.classes.text.primary}`} />
            <span className={dynastyTheme.classes.text.white}>
              Loading league settings...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={dynastyTheme.components.section}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className={dynastyTheme.components.heading.h2}>
          Free Agent Market
        </h2>
        <button
          onClick={() => loadFreeAgents(currentPage)}
          disabled={loading}
          className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} flex items-center gap-2 disabled:opacity-50`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => handleTabChange('hitters')}
          className={`flex items-center gap-2 ${dynastyTheme.utils.getComponent('button', activeTab === 'hitters' ? 'primary' : 'secondary', 'md')} ${dynastyTheme.classes.transition}`}
        >
          <Users className="w-4 h-4" />
          Hitters
          {activeTab === 'hitters' && (
            <span className={`${dynastyTheme.components.badge.success} ml-2`}>
              {players.length}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('pitchers')}
          className={`flex items-center gap-2 ${dynastyTheme.utils.getComponent('button', activeTab === 'pitchers' ? 'primary' : 'secondary', 'md')} ${dynastyTheme.classes.transition}`}
        >
          <Zap className="w-4 h-4" />
          Pitchers
          {activeTab === 'pitchers' && (
            <span className={`${dynastyTheme.components.badge.warning} ml-2`}>
              {players.length}
            </span>
          )}
        </button>
      </div>

      {/* Search Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${dynastyTheme.classes.text.neutralLight}`} />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={handleSearchChange}
              className={`${dynastyTheme.components.input} pl-10 w-full`}
            />
          </div>
        </form>
        <button
          onClick={handleSearchSubmit}
          disabled={loading}
          className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} disabled:opacity-50`}
        >
          Search
        </button>
      </div>

      {/* League Settings Info */}
      {(leagueSettings.use_salaries === false || leagueSettings.use_contracts === false) && (
        <div className={`${dynastyTheme.components.card.base} border-l-4 border-blue-500 pl-4 mb-4`}>
          <p className={`${dynastyTheme.classes.text.neutralLight} text-xs`}>
            League settings: 
            {!leagueSettings.use_salaries && " Salaries disabled"}
            {!leagueSettings.use_contracts && " Contracts disabled"}
            {!leagueSettings.use_waivers && " Waivers disabled"}
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className={`${dynastyTheme.components.card.base} border-l-4 border-red-500 pl-4 mb-4`}>
          <p className={dynastyTheme.classes.text.error}>
            {error}
          </p>
        </div>
      )}

      {/* Results Info */}
      <div className="flex items-center justify-between mb-4">
        <p className={dynastyTheme.classes.text.neutralLight}>
          {loading ? (
            'Loading players...'
          ) : totalCount > 0 ? (
            `Showing ${Math.min(players.length, playersPerPage)} ${activeTab} (${totalCount} total)`
          ) : (
            `No ${activeTab} found`
          )}
        </p>

        {searchTerm && (
          <div className="flex items-center gap-2">
            <span className={`${dynastyTheme.classes.text.neutralLight} text-xs`}>
              Search:
            </span>
            <span className={dynastyTheme.components.badge.info}>
              "{searchTerm}"
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                loadFreeAgents(1, '', activeTab);
              }}
              className={`${dynastyTheme.classes.text.primary} hover:underline text-xs transition-colors`}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Enhanced Players Table with Horizontal Scroll */}
      <DynastyTable
        data={players}
        columns={activeTab === 'hitters' ? getEnhancedHitterColumns() : getEnhancedPitcherColumns()}
        loading={loading}
        maxHeight="700px"
        minWidth={activeTab === 'hitters' ? "1600px" : "1500px"}
        enableHorizontalScroll={true}
        className="mb-4"
        title={`${activeTab === 'hitters' ? 'Available Hitters' : 'Available Pitchers'} (Season Stats + Last 14 Days)`}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Previous
          </button>

          <div className="flex items-center gap-2">
            <span className={dynastyTheme.classes.text.neutralLight}>
              Page
            </span>
            <span className={dynastyTheme.classes.text.white}>
              {currentPage}
            </span>
            <span className={dynastyTheme.classes.text.neutralLight}>
              of {totalPages}
            </span>
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Next
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg z-50">
          <div className="flex items-center gap-3 bg-gray-800 px-6 py-4 rounded-lg border border-gray-600">
            <RefreshCw className={`w-6 h-6 animate-spin ${dynastyTheme.classes.text.primary}`} />
            <span className={dynastyTheme.classes.text.white}>
              Loading {activeTab}...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreeAgentSearch;