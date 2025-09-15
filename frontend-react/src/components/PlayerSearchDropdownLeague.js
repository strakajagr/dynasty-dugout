// src/components/PlayerSearchDropdownLeague.js - League version with pricing and transactions
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, User, TrendingUp, Activity, ChevronRight, X, Lock, AlertCircle, Plus, Minus, ArrowLeftRight, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dynastyTheme } from '../services/colorService';
import apiService from '../services/apiService';
import { leaguesAPI } from '../services/apiService';
import ReactDOM from 'react-dom';
import PlayerProfileModal from './PlayerProfileModal';

const PlayerSearchDropdownLeague = ({ leagueId, league, userTeam, onPlayerAdded, onPlayerDropped }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchError, setSearchError] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [processingTransaction, setProcessingTransaction] = useState(null);
  
  // Modal state
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const { isAuthenticated, user } = useAuth();

  // Update dropdown position when showing results
  useEffect(() => {
    if (showResults && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 600) // Wider for league data
      });
    }
  }, [showResults]);

  // Debounced search function - ENHANCED FOR LEAGUE DATA
  const performSearch = useCallback(async (query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    const trimmedQuery = query.trim();
    
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    if (!isAuthenticated) {
      setSearchError('Sign in to search players');
      setSearchResults([]);
      setShowResults(true);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    
    try {
      // Search players with league context to get pricing
      const response = await apiService.players.searchPlayers(trimmedQuery, 12);
      
      if (response.success && response.players) {
        // If we have a leagueId, enhance with league-specific data
        let enhancedPlayers = response.players;
        
        if (leagueId) {
          try {
            // Get league player data for ownership/pricing info
            const leaguePlayersResponse = await leaguesAPI.getLeaguePlayers(leagueId);
            if (leaguePlayersResponse.success && leaguePlayersResponse.players) {
              const leaguePlayerMap = {};
              leaguePlayersResponse.players.forEach(lp => {
                leaguePlayerMap[lp.mlb_player_id] = lp;
              });
              
              // Enhance search results with league data
              enhancedPlayers = response.players.map(player => {
                const leaguePlayer = leaguePlayerMap[player.player_id];
                return {
                  ...player,
                  leagueData: leaguePlayer || null,
                  isOwned: leaguePlayer?.availability_status === 'owned',
                  ownedByUser: leaguePlayer?.team_id === userTeam?.team_id,
                  salary: leaguePlayer?.salary || null,
                  contractYears: leaguePlayer?.contract_years || null,
                  teamName: leaguePlayer?.team_name || null
                };
              });
            }
          } catch (leagueError) {
            console.error('Could not fetch league player data:', leagueError);
          }
        }
        
        setSearchResults(enhancedPlayers);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to search players');
      setSearchResults([]);
      setShowResults(true);
    } finally {
      setIsSearching(false);
    }
  }, [isAuthenticated, leagueId, userTeam]);

  // Handle transaction actions
  const handleAddPlayer = async (player, e) => {
    e.stopPropagation();
    if (!leagueId || !userTeam?.team_id) return;
    
    setProcessingTransaction(player.player_id);
    
    try {
      const response = await leaguesAPI.addPlayerToTeam(leagueId, userTeam.team_id, {
        player_id: player.player_id,
        salary: player.leagueData?.salary || league?.min_salary || 1,
        contract_years: 1
      });
      
      if (response.success) {
        if (onPlayerAdded) onPlayerAdded(player);
        // Refresh search results
        performSearch(searchQuery);
      }
    } catch (error) {
      console.error('Failed to add player:', error);
    } finally {
      setProcessingTransaction(null);
    }
  };

  const handleDropPlayer = async (player, e) => {
    e.stopPropagation();
    if (!leagueId || !userTeam?.team_id) return;
    
    if (!window.confirm(`Drop ${player.first_name} ${player.last_name}?`)) return;
    
    setProcessingTransaction(player.player_id);
    
    try {
      const response = await leaguesAPI.dropPlayerFromTeam(
        leagueId, 
        userTeam.team_id, 
        player.leagueData?.league_player_id
      );
      
      if (response.success) {
        if (onPlayerDropped) onPlayerDropped(player);
        // Refresh search results
        performSearch(searchQuery);
      }
    } catch (error) {
      console.error('Failed to drop player:', error);
    } finally {
      setProcessingTransaction(null);
    }
  };

  // Handle search input change with debouncing
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSelectedIndex(-1);
    setSearchError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    const trimmedQuery = query.trim();
    
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showResults || (searchResults.length === 0 && !searchError)) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handlePlayerSelect(searchResults[selectedIndex]);
        } else if (searchResults.length === 1) {
          handlePlayerSelect(searchResults[0]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // Handle player selection - OPEN MODAL
  const handlePlayerSelect = (player) => {
    setShowResults(false);
    setSearchQuery('');
    setSelectedIndex(-1);
    setSearchError(null);
    
    // Open modal with selected player
    setSelectedPlayer(player);
    setShowPlayerModal(true);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
    setSearchError(null);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setIsSearching(false);
    inputRef.current?.focus();
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format stats display
  const formatStat = (value, decimals = 3) => {
    if (value === null || value === undefined || value === 0) return '-';
    if (decimals === 0) return Math.floor(value).toString();
    if (typeof value === 'number') {
      const formatted = value.toFixed(decimals);
      if (decimals === 3 && value < 1) {
        return formatted.replace(/^0\./, '.');
      }
      return formatted;
    }
    return value;
  };

  // Get position color
  const getPositionColor = (position) => {
    if (!position) return 'text-gray-400';
    const pos = position.toUpperCase();
    if (['SP', 'RP', 'P', 'CP'].includes(pos)) return 'text-blue-400';
    if (['C'].includes(pos)) return 'text-red-400';
    if (['1B', '2B', '3B', 'SS'].includes(pos)) return 'text-green-400';
    if (['OF', 'LF', 'CF', 'RF'].includes(pos)) return 'text-yellow-400';
    if (['DH'].includes(pos)) return 'text-purple-400';
    return 'text-gray-400';
  };

  const isPitcher = (position) => {
    if (!position) return false;
    const pos = position.toUpperCase();
    return ['SP', 'RP', 'P', 'CP'].includes(pos);
  };

  // Render dropdown with portal to body
  const renderDropdown = () => {
    if (!showResults) return null;

    const dropdownContent = (
      <div
        ref={dropdownRef}
        style={{
          position: 'absolute',
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
          zIndex: 9999,
          maxHeight: '480px'
        }}
      >
        {/* Search Results with League Data */}
        {searchResults.length > 0 && (
          <div className="bg-neutral-900/95 backdrop-blur-sm rounded-lg shadow-2xl border border-neutral-700 overflow-hidden max-h-[480px] overflow-y-auto">
            <div className="py-2">
              {searchResults.map((player, index) => (
                <div
                  key={player.player_id}
                  onClick={() => handlePlayerSelect(player)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-4 py-3 cursor-pointer transition-all duration-150 ${
                    index === selectedIndex 
                      ? dynastyTheme.classes.bg.darkLighter + ' border-l-4 border-yellow-400' 
                      : 'hover:' + dynastyTheme.classes.bg.darkLighter + ' border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${dynastyTheme.classes.text.white}`}>
                          {player.first_name && player.last_name 
                            ? `${player.first_name} ${player.last_name}`
                            : player.name || 'Unknown'}
                        </span>
                        {player.jersey_number > 0 && (
                          <span className={`text-xs ${dynastyTheme.classes.text.neutralLight}`}>
                            #{player.jersey_number}
                          </span>
                        )}
                        {/* Ownership Badge */}
                        {leagueId && player.isOwned && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            player.ownedByUser 
                              ? 'bg-yellow-500/20 text-yellow-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {player.ownedByUser ? 'Your Team' : player.teamName || 'Owned'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-sm font-medium ${getPositionColor(player.position)}`}>
                          {player.position || 'N/A'}
                        </span>
                        <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                          {player.mlb_team || 'FA'}
                        </span>
                        {/* Contract Info for League Context */}
                        {leagueId && player.salary && (
                          <>
                            <span className="text-xs text-yellow-400">
                              <DollarSign className="w-3 h-3 inline" />
                              {player.salary}
                            </span>
                            {player.contractYears && (
                              <span className="text-xs text-neutral-400">
                                {player.contractYears}yr
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Stats */}
                      <div className="flex items-center gap-3 text-sm">
                        {!isPitcher(player.position) ? (
                          <>
                            {player.stats?.batting_avg !== undefined && player.stats?.batting_avg > 0 && (
                              <div className="text-right">
                                <div className={`${dynastyTheme.classes.text.neutralLighter} text-xs`}>AVG</div>
                                <div className={dynastyTheme.classes.text.white}>
                                  {formatStat(player.stats.batting_avg)}
                                </div>
                              </div>
                            )}
                            {player.stats?.home_runs !== undefined && (
                              <div className="text-right">
                                <div className={`${dynastyTheme.classes.text.neutralLighter} text-xs`}>HR</div>
                                <div className={dynastyTheme.classes.text.white}>
                                  {player.stats.home_runs || 0}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="text-right">
                              <div className={`${dynastyTheme.classes.text.neutralLighter} text-xs`}>ERA</div>
                              <div className={dynastyTheme.classes.text.white}>
                                {player.stats?.era ? formatStat(player.stats.era, 2) : '0.00'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`${dynastyTheme.classes.text.neutralLighter} text-xs`}>K</div>
                              <div className={dynastyTheme.classes.text.white}>
                                {player.stats?.strikeouts || player.stats?.strikeouts_pitched || 0}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Transaction Buttons */}
                      {leagueId && userTeam && (
                        <div className="flex items-center gap-1">
                          {!player.isOwned ? (
                            <button
                              onClick={(e) => handleAddPlayer(player, e)}
                              disabled={processingTransaction === player.player_id}
                              className={`p-1.5 rounded ${
                                processingTransaction === player.player_id
                                  ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              } transition-colors`}
                              title="Add to roster"
                            >
                              {processingTransaction === player.player_id ? (
                                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent animate-spin rounded-full" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                            </button>
                          ) : player.ownedByUser ? (
                            <button
                              onClick={(e) => handleDropPlayer(player, e)}
                              disabled={processingTransaction === player.player_id}
                              className={`p-1.5 rounded ${
                                processingTransaction === player.player_id
                                  ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              } transition-colors`}
                              title="Drop from roster"
                            >
                              {processingTransaction === player.player_id ? (
                                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent animate-spin rounded-full" />
                              ) : (
                                <Minus className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <button
                              className="p-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                              title="Propose trade"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Open trade modal
                                console.log('Trade for player:', player);
                              }}
                            >
                              <ArrowLeftRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                      
                      <ChevronRight className="w-4 h-4 text-neutral-400 ml-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className={`px-4 py-2 border-t ${dynastyTheme.classes.border.neutral} ${dynastyTheme.classes.bg.dark}`}>
              <div className={`text-xs ${dynastyTheme.classes.text.neutralLighter} flex items-center justify-between`}>
                <span>
                  {searchResults.length} player{searchResults.length !== 1 ? 's' : ''} found
                </span>
                <span>
                  Press <kbd className="px-1 py-0.5 mx-1 bg-gray-700 rounded text-[10px]">↵</kbd> to view details
                </span>
              </div>
            </div>
          </div>
        )}

        {/* No Results */}
        {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && !searchError && (
          <div className={`${dynastyTheme.components.card.base} rounded-lg shadow-2xl border ${dynastyTheme.classes.border.neutral} overflow-hidden p-4`}>
            <div className={`text-center ${dynastyTheme.classes.text.neutralLight}`}>
              <User className="w-8 h-8 mx-auto mb-2 text-neutral-500" />
              <p>No players found matching "{searchQuery.trim()}"</p>
              <p className={`text-xs ${dynastyTheme.classes.text.neutralLighter} mt-1`}>
                Try searching by name, team, or position
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {searchError && (
          <div className={`${dynastyTheme.components.card.base} rounded-lg shadow-2xl border border-red-500/50 overflow-hidden p-4`}>
            <div className="text-center text-red-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p>{searchError}</p>
            </div>
          </div>
        )}
      </div>
    );

    // Render to body using portal
    return ReactDOM.createPortal(dropdownContent, document.body);
  };

  return (
    <>
      <div className="relative w-full max-w-md">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              const trimmedQuery = searchQuery.trim();
              if (trimmedQuery.length >= 2) {
                if (searchResults.length > 0 || searchError) {
                  setShowResults(true);
                }
              }
            }}
            placeholder={isAuthenticated ? "Search players..." : "Sign in to search"}
            disabled={!isAuthenticated}
            className={`w-full pl-10 pr-10 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${
              isAuthenticated ? dynastyTheme.classes.text.white : 'text-gray-500'
            } border ${dynastyTheme.classes.border.neutral} ${
              isAuthenticated ? 'focus:border-yellow-400' : 'cursor-not-allowed'
            } focus:outline-none transition-colors`}
          />
          
          {/* Loading Spinner or Clear Button */}
          {!isAuthenticated ? (
            <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          ) : isSearching ? (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent animate-spin rounded-full" />
            </div>
          ) : searchQuery.length > 0 ? (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Min characters helper text */}
        {searchQuery.length > 0 && searchQuery.trim().length < 2 && !isSearching && (
          <div className={`absolute top-full mt-1 text-xs ${dynastyTheme.classes.text.neutralLighter}`}>
            Enter at least 2 characters to search
          </div>
        )}

        {/* Render dropdown using portal */}
        {renderDropdown()}
      </div>

      {/* Player Profile Modal - with league context */}
      {showPlayerModal && selectedPlayer && (
        <PlayerProfileModal
          playerId={selectedPlayer.player_id}
          leagueId={leagueId}
          isOpen={showPlayerModal}
          onClose={() => {
            setShowPlayerModal(false);
            setSelectedPlayer(null);
          }}
          initialPlayer={selectedPlayer}
          isLeagueContext={true}
        />
      )}
    </>
  );
};

export default PlayerSearchDropdownLeague;