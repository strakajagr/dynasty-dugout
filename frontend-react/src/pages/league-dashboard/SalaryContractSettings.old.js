// src/pages/league-dashboard/SalaryContractSettings.js - COMPLETE FIXED VERSION
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { dynastyTheme } from '../../services/colorService';
import { AdaptiveSalaryEngine } from '../../services/adaptiveSalaryEngine';
import pricingDataService from '../../services/pricingDataService';
import { leaguesAPI } from '../../services/apiService';
import { DynastyTable } from '../../services/tableService';
import { 
  DollarSign, Upload, Settings, TrendingUp, Calculator,
  Save, AlertCircle, Check, X, Plus, FileText,
  RefreshCw, Download, BarChart3, Info, Edit, Search, Bell,
  ChevronDown, Sliders, Users, Shield, Eye, EyeOff, Copy,
  TrendingDown, Activity, Target, Zap, Award, Star, ArrowLeft
} from 'lucide-react';

const SalaryContractSettings = ({ league, user, onStatusChange }) => {
  const { leagueId: urlLeagueId } = useParams();
  const leagueId = league?.league_id || urlLeagueId;
  const navigate = useNavigate();
  
  // Core State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pricingData, setPricingData] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [settings, setSettings] = useState({
    use_dual_cap: league?.use_dual_cap ?? true,
    draft_cap: league?.draft_cap || 600,
    season_cap: league?.season_cap || 200,
    salary_cap: league?.salary_cap || 800,
    standard_contract_length: league?.standard_contract_length || 2,
    min_salary: league?.min_salary || 2,
    salary_increment: league?.salary_increment || 2,
    rookie_price: league?.rookie_price || 20,
    extension_rules: league?.extension_rules || [
      { years: 1, cost_increase: 0, description: 'Same price, returns to draft pool' },
      { years: 2, cost_increase: 10, description: '+$10 to current salary' },
      { years: 3, cost_increase: 20, description: '+$20 to current salary' },
      { years: 4, cost_increase: 30, description: '+$30 to current salary' },
      { years: 5, cost_increase: 40, description: '+$40 to current salary' }
    ],
    price_generation_method: 'adaptive',
    draft_cap_usage: league?.draft_cap_usage || 0.75,
    hitting_categories: league?.hitting_categories || ['R', 'RBI', 'HR', 'SB', 'AVG', 'OPS'],
    pitching_categories: league?.pitching_categories || ['W', 'QS', 'K', 'S', 'ERA', 'WHIP']
  });

  const [generatedPrices, setGeneratedPrices] = useState(null);
  const [customPrices, setCustomPrices] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [activeTab, setActiveTab] = useState('contracts');
  const [validation, setValidation] = useState(null);
  const [showValidation, setShowValidation] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [viewMode, setViewMode] = useState('hitters');
  const [leagueStatus, setLeagueStatus] = useState(league?.league_status || 'setup');
  const [pricesAlreadySet, setPricesAlreadySet] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState(new Set());
  const [priceAdjustmentModal, setPriceAdjustmentModal] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'salary', direction: 'desc' });

  const positions = {
    hitters: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'UTIL'],
    pitchers: ['SP', 'RP', 'CP', 'P']
  };

  useEffect(() => {
    if (leagueId) {
      loadSettings();
      checkPriceStatus();
      loadPricingData();
    }
  }, [leagueId]);

  const loadPricingData = async () => {
    if (!leagueId) {
      console.error('No league ID available');
      return;
    }
    
    try {
      console.log(`Loading pricing data for league ${leagueId}`);
      setLoading(true);
      
      const data = await pricingDataService.getPricingData(leagueId);
      
      if (data && data.players) {
        console.log(`Loaded ${data.players.length} players with normalized stats`);
        setPricingData(data);
        setDataLoaded(true);
        
        if (data.scoring_categories) {
          setSettings(prev => ({
            ...prev,
            hitting_categories: data.scoring_categories.hitting || prev.hitting_categories,
            pitching_categories: data.scoring_categories.pitching || prev.pitching_categories
          }));
        }
      }
    } catch (error) {
      console.error('Error loading pricing data:', error);
      setDataLoaded(false);
    } finally {
      setLoading(false);
    }
  };

  const checkPriceStatus = async () => {
    try {
      const response = await leaguesAPI.checkPriceStatus(leagueId);
      if (response.success) {
        setPricesAlreadySet(response.prices_set);
      }
    } catch (error) {
      console.error('Error checking price status:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await leaguesAPI.getSalarySettings(leagueId);
      if (response.success && response.settings) {
        setSettings(prevSettings => ({
          ...prevSettings,
          ...response.settings,
          hitting_categories: response.settings.hitting_categories || prevSettings.hitting_categories,
          pitching_categories: response.settings.pitching_categories || prevSettings.pitching_categories
        }));
        if (response.existing_prices) {
          setGeneratedPrices({
            prices: response.existing_prices,
            summary: response.summary
          });
        }
      }
    } catch (error) {
      console.error('Error loading salary settings:', error);
    }
  };

  const handleBackToSeasonSetup = () => {
    navigate(`/leagues/${leagueId}`);
    window.localStorage.setItem('activeSection', 'season-setup');
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      const pricesToSave = generatedPrices?.prices || customPrices;
      
      if (!pricesToSave || pricesToSave.length === 0) {
        alert('No prices to save! Please generate or upload prices first.');
        setSaving(false);
        return;
      }
      
      // FIX: Use the correct saveSalarySettings endpoint
      const response = await leaguesAPI.saveSalarySettings(leagueId, {
        settings: settings,
        prices: pricesToSave,
        method: settings.price_generation_method
      });
      
      if (response.success) {
        const isFirstTimeSettingPrices = !pricesAlreadySet && pricesToSave.length > 0;
        
        if (isFirstTimeSettingPrices) {
          // Move to draft_ready status
          if (leagueStatus === 'setup' || leagueStatus === 'pricing') {
            const statusResponse = await leaguesAPI.updateLeagueStatus(leagueId, 'draft_ready');
            
            if (statusResponse.success) {
              setLeagueStatus('draft_ready');
              setPricesAlreadySet(true);
              
              // Notify owners if needed
              if (league?.league_name) {
                try {
                  await leaguesAPI.notifyOwners(leagueId, {
                    subject: 'Player Prices Set! 💰',
                    message: `The commissioner has set player prices for ${league.league_name}. You can now begin building your roster!`,
                    type: 'prices_set'
                  });
                } catch (notifyError) {
                  console.log('Could not notify owners:', notifyError);
                }
              }
              
              // Call parent's status change handler
              if (onStatusChange) {
                onStatusChange();
              }
              
              alert('✅ Prices saved successfully! League is now ready for drafting.');
              
              // Navigate back to Season Setup
              handleBackToSeasonSetup();
            }
          }
        } else {
          alert('Settings saved successfully!');
          // Navigate back to Season Setup even if just updating prices
          handleBackToSeasonSetup();
        }
      } else {
        alert('Failed to save settings: ' + (response.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePrices = async (regenerate = false) => {
    try {
      setGenerating(true);
      
      if (!pricingData || !pricingData.players || pricingData.players.length === 0) {
        console.log('No pricing data available, loading...');
        await loadPricingData();
        
        if (!pricingData || !pricingData.players || pricingData.players.length === 0) {
          alert('Unable to load player data. Please try again.');
          setGenerating(false);
          return;
        }
      }
      
      console.log(`Generating prices for ${pricingData.players.length} players...`);
      
      const engine = new AdaptiveSalaryEngine({
        ...settings,
        num_teams: league?.max_teams || 12,
        roster_size: league?.max_players_total || 25,
        draft_cap_usage: settings.draft_cap_usage,
        hitting_categories: settings.hitting_categories,
        pitching_categories: settings.pitching_categories
      });
      
      const result = engine.generatePrices(pricingData.players);
      
      if (result.prices) {
        result.prices = result.prices.map(priceEntry => {
          const player = pricingData.players.find(p => 
            p.player_id === priceEntry.player_id || 
            p.mlb_player_id === priceEntry.player_id
          );
          
          if (player) {
            return {
              ...player,
              ...priceEntry,
              player_name: player.player_name || priceEntry.player_name
            };
          }
          
          return priceEntry;
        });
      }
      
      setGeneratedPrices(result);
      setShowValidation(true);
      setActiveTab('preview');
      
      if (regenerate) {
        alert('Prices regenerated with new settings!');
      }
      
    } catch (error) {
      console.error('Error generating prices:', error);
      alert('Failed to generate prices: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setUploadedFile(file);
      parseCSV(file);
    } else {
      alert('Please upload a CSV file');
    }
  };

  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const prices = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 4) {
          prices.push({
            player_name: values[0].trim(),
            position: values[1].trim(),
            team: values[2].trim(),
            salary: parseFloat(values[3]) || settings.min_salary
          });
        }
      }
      
      setCustomPrices(prices);
      setSettings({ ...settings, price_generation_method: 'custom' });
      setActiveTab('preview');
    };
    reader.readAsText(file);
  };

  const downloadPricesCSV = () => {
    const prices = generatedPrices?.prices || customPrices;
    if (!prices || prices.length === 0) {
      alert('No prices to download');
      return;
    }
    
    const headers = 'player_name,position,team,salary,tier,impact_score,normalization_method\n';
    const rows = prices.map(p => 
      `"${p.player_name}",${p.position},${p.team},${p.salary},${p.tier || ''},${p.impact_score || ''},${p.normalization_method || 'none'}`
    ).join('\n');
    
    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${league?.league_name || 'league'}_salaries_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExtensionRuleChange = (index, field, value) => {
    const updatedRules = [...settings.extension_rules];
    updatedRules[index][field] = field === 'years' || field === 'cost_increase' 
      ? parseInt(value) || 0 
      : value;
    setSettings({ ...settings, extension_rules: updatedRules });
  };

  const addExtensionRule = () => {
    const lastRule = settings.extension_rules[settings.extension_rules.length - 1];
    const newRule = {
      years: lastRule.years + 1,
      cost_increase: lastRule.cost_increase + 10,
      description: `+$${lastRule.cost_increase + 10} to current salary`
    };
    setSettings({
      ...settings,
      extension_rules: [...settings.extension_rules, newRule]
    });
  };

  const removeExtensionRule = (index) => {
    if (settings.extension_rules.length > 1) {
      const updatedRules = settings.extension_rules.filter((_, i) => i !== index);
      setSettings({ ...settings, extension_rules: updatedRules });
    }
  };

  const handleManualPriceChange = (playerId, newPrice) => {
    const prices = [...(generatedPrices?.prices || [])];
    const playerIndex = prices.findIndex(p => 
      p.player_id === playerId || p.mlb_player_id === playerId
    );
    
    if (playerIndex >= 0) {
      const price = parseFloat(newPrice);
      const rounded = Math.round(price / settings.salary_increment) * settings.salary_increment;
      const finalPrice = Math.max(settings.min_salary, rounded);
      
      if (!prices[playerIndex].original_salary) {
        prices[playerIndex].original_salary = prices[playerIndex].salary;
      }
      
      prices[playerIndex] = {
        ...prices[playerIndex],
        manual_price: finalPrice,
        salary: finalPrice
      };
      
      setGeneratedPrices({
        ...generatedPrices,
        prices: prices
      });
      
      const engine = new AdaptiveSalaryEngine(settings);
      const newSummary = engine.generateSummary(prices);
      setGeneratedPrices(prev => ({
        ...prev,
        summary: newSummary
      }));
    }
  };

  const handleBulkPriceAdjustment = (adjustmentType, adjustmentValue) => {
    if (selectedPlayers.size === 0) {
      alert('No players selected');
      return;
    }
    
    const prices = [...(generatedPrices?.prices || [])];
    const updatedPrices = prices.map(player => {
      if (selectedPlayers.has(player.player_id)) {
        let newSalary = player.salary;
        
        if (adjustmentType === 'percentage') {
          newSalary = player.salary * (1 + adjustmentValue / 100);
        } else if (adjustmentType === 'fixed') {
          newSalary = player.salary + adjustmentValue;
        } else if (adjustmentType === 'set') {
          newSalary = adjustmentValue;
        }
        
        newSalary = Math.round(newSalary / settings.salary_increment) * settings.salary_increment;
        newSalary = Math.max(settings.min_salary, newSalary);
        
        return {
          ...player,
          salary: newSalary,
          manual_price: newSalary,
          original_salary: player.original_salary || player.salary
        };
      }
      return player;
    });
    
    setGeneratedPrices({
      ...generatedPrices,
      prices: updatedPrices
    });
    
    setSelectedPlayers(new Set());
    setBulkEditMode(false);
    setPriceAdjustmentModal(false);
    
    const engine = new AdaptiveSalaryEngine(settings);
    const newSummary = engine.generateSummary(updatedPrices);
    setGeneratedPrices(prev => ({
      ...prev,
      summary: newSummary
    }));
  };

  const getFilteredPrices = () => {
    if (!generatedPrices?.prices) return [];
    
    let filtered = generatedPrices.prices;
    
    const isPitcherPosition = (pos) => ['SP', 'RP', 'CP', 'P'].includes(pos);
    if (viewMode === 'hitters') {
      filtered = filtered.filter(p => !isPitcherPosition(p.position));
    } else {
      filtered = filtered.filter(p => isPitcherPosition(p.position));
    }
    
    if (positionFilter !== 'all') {
      filtered = filtered.filter(p => p.position === positionFilter);
    }
    
    if (searchFilter) {
      filtered = filtered.filter(p => 
        p.player_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.team?.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }
    
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key] || 0;
        const bVal = b[sortConfig.key] || 0;
        
        if (sortConfig.direction === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return bVal < aVal ? -1 : bVal > aVal ? 1 : 0;
        }
      });
    }
    
    return filtered;
  };

  const createPricePreviewColumns = () => {
    const renderDefault = (v) => v || 0;
    const renderFloat1 = (v) => (parseFloat(v) || 0).toFixed(1);
    const renderFloat2 = (v) => (parseFloat(v) || 0).toFixed(2);
    const renderFloat3 = (v) => (parseFloat(v) || 0).toFixed(3);
    const renderAvg = (v) => {
      const val = parseFloat(v) || 0;
      if (val === 0) return '.000';
      if (val >= 1) return val.toFixed(3);
      return `.${Math.round(val * 1000).toString().padStart(3, '0')}`;
    };

    const baseColumns = [];
    
    // Checkbox column for bulk edit mode
    if (bulkEditMode) {
      baseColumns.push({
        key: 'select',
        title: (
          <input
            type="checkbox"
            checked={selectedPlayers.size === getFilteredPrices().length}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedPlayers(new Set(getFilteredPrices().map(p => p.player_id)));
              } else {
                setSelectedPlayers(new Set());
              }
            }}
          />
        ),
        width: 30,
        render: (v, player) => (
          <input
            type="checkbox"
            checked={selectedPlayers.has(player.player_id)}
            onChange={(e) => {
              const newSelected = new Set(selectedPlayers);
              if (e.target.checked) {
                newSelected.add(player.player_id);
              } else {
                newSelected.delete(player.player_id);
              }
              setSelectedPlayers(newSelected);
            }}
          />
        )
      });
    }
    
    // Player name column with link
    baseColumns.push(
      { 
        key: 'player_name', 
        title: 'Name', 
        width: 140,
        render: (v, player) => {
          const badges = [];
          if (player.is_rookie) badges.push('🆕');
          if (player.normalization_method === 'prior_year') badges.push('📊');
          if (player.normalization_method === 'prior_year_reduced') badges.push('📅');
          if (player.normalization_method === 'league_average') badges.push('📈');
          
          const playerId = player.player_id || player.mlb_player_id;
          
          return (
            <div className="flex items-center gap-1">
              <Link 
                to={`/player/${playerId}${leagueId ? `?leagueId=${leagueId}` : ''}`}
                className="text-blue-400 hover:text-blue-300 hover:underline truncate"
                style={{ maxWidth: '110px' }}
              >
                {v || 'Unknown Player'}
              </Link>
              {badges.length > 0 && (
                <span className="text-xs" title={`Normalization: ${player.normalization_method}`}>
                  {badges.join(' ')}
                </span>
              )}
            </div>
          );
        }
      },
      { key: 'position', title: 'Pos', width: 40 },
      { key: 'team', title: 'Team', width: 45 }
    );

    // Dynamic stat columns based on league categories
    const statColumns = [];
    const cats = viewMode === 'hitters' 
      ? settings.hitting_categories 
      : settings.pitching_categories;

    // Always add AB for hitters, IP/GS for pitchers first
    if (viewMode === 'hitters') {
      statColumns.push({ 
        key: 'at_bats', 
        title: 'AB', 
        width: 40,
        render: (v, player) => {
          const stats = player.stats_2025 || player.stats || {};
          return renderDefault(stats.at_bats || stats.ab || 0);
        }
      });
    } else {
      statColumns.push({ 
        key: 'games_started', 
        title: 'GS', 
        width: 35,
        render: (v, player) => {
          const stats = player.stats_2025 || player.stats || {};
          return renderDefault(stats.games_started || stats.gs || 0);
        }
      });
      statColumns.push({ 
        key: 'innings_pitched', 
        title: 'IP', 
        width: 40,
        render: (v, player) => {
          const stats = player.stats_2025 || player.stats || {};
          return renderFloat1(stats.innings_pitched || stats.ip || 0);
        }
      });
    }

    // Dynamic category columns with reduced widths
    cats?.forEach(cat => {
      const catUpper = cat.toUpperCase();
      const catLower = cat.toLowerCase();
      let title = catUpper;
      let width = 40; // Reduced from 50
      let render;
      let key;

      // Map category names to stat fields
      const statMapping = {
        'R': ['runs', 'r'],
        'RBI': ['rbi'],
        'HR': ['home_runs', 'hr'],
        'SB': ['stolen_bases', 'sb'],
        'AVG': ['batting_avg', 'avg'],
        'OBP': ['obp'],
        'SLG': ['slg'],
        'OPS': ['ops'],
        'W': ['wins', 'w'],
        'L': ['losses', 'l'],
        'SV': ['saves', 's', 'sv'],
        'S': ['saves', 's', 'sv'],
        'ERA': ['era'],
        'WHIP': ['whip'],
        'K': ['strikeouts_pitched', 'strikeouts', 'k'],
        'QS': ['quality_starts', 'qs']
      };

      const possibleKeys = statMapping[catUpper] || [catLower];
      key = possibleKeys[0];

      // Adjust widths for specific stats
      if (['AVG', 'OBP', 'SLG', 'OPS', 'ERA', 'WHIP'].includes(catUpper)) {
        width = 45;
      }

      if (['AVG', 'OBP', 'SLG', 'OPS'].includes(catUpper)) {
        render = (v, player) => {
          const stats = player.stats_2025 || player.stats || {};
          for (const k of possibleKeys) {
            if (stats[k] !== undefined) {
              return renderAvg(stats[k]);
            }
          }
          return '.000';
        };
      } else if (['ERA'].includes(catUpper)) {
        render = (v, player) => {
          const stats = player.stats_2025 || player.stats || {};
          return renderFloat2(stats.era || 0);
        };
      } else if (['WHIP'].includes(catUpper)) {
        render = (v, player) => {
          const stats = player.stats_2025 || player.stats || {};
          return renderFloat3(stats.whip || 0);
        };
      } else {
        render = (v, player) => {
          const stats = player.stats_2025 || player.stats || {};
          for (const k of possibleKeys) {
            if (stats[k] !== undefined) {
              return renderDefault(stats[k]);
            }
          }
          return 0;
        };
      }

      statColumns.push({ key, title, width, render });
    });

    const endColumns = [
      { 
        key: 'salary', 
        title: 'Gen$', 
        width: 55,
        render: (v, player) => (
          <span className={player.manual_price ? dynastyTheme.classes.text.neutralLight : dynastyTheme.classes.text.success}>
            ${renderDefault(player.original_salary || v)}
          </span>
        )
      },
      { 
        key: 'tier', 
        title: 'Tier', 
        width: 55,
        render: (v) => {
          const tierColors = {
            elite: dynastyTheme.components.badge.error,
            star: dynastyTheme.components.badge.warning,
            solid: dynastyTheme.components.badge.info,
            regular: dynastyTheme.components.badge.success,
            replacement: dynastyTheme.classes.text.neutralLight,
            rookie: dynastyTheme.components.badge.warning
          };
          return <span className={tierColors[v?.toLowerCase()] || dynastyTheme.classes.text.neutralLight}>{v || '-'}</span>;
        }
      },
      { 
        key: 'impact_score', 
        title: 'Impact', 
        width: 55,
        render: (v) => renderFloat2(v)
      },
      {
        key: 'manual_price',
        title: 'Final$',
        width: 85,
        render: (value, player) => (
          <div className="flex items-center gap-1">
            <span>$</span>
            <input
              type="number"
              min={settings.min_salary}
              step={settings.salary_increment}
              value={player.salary || settings.min_salary}
              onChange={(e) => handleManualPriceChange(player.player_id || player.mlb_player_id, e.target.value)}
              className={`${dynastyTheme.components.input} w-14 px-1 py-0 text-xs`}
              style={{ height: '22px' }}
              disabled={bulkEditMode}
            />
            {player.manual_price && player.original_salary && (
              <button
                onClick={() => handleManualPriceChange(player.player_id, player.original_salary)}
                className="text-xs text-gray-400 hover:text-gray-200"
                title="Reset to original"
                style={{ fontSize: '10px' }}
              >
                ↺
              </button>
            )}
          </div>
        )
      }
    ];

    return [...baseColumns, ...statColumns, ...endColumns];
  };

  const getStatusBadge = () => {
    const badges = {
      setup: { color: 'bg-gray-500/20 text-gray-400', icon: '⚙️', label: 'Setup Mode' },
      pricing: { color: 'bg-yellow-500/20 text-yellow-400', icon: '💰', label: 'Setting Prices' },
      draft_ready: { color: 'bg-blue-500/20 text-blue-400', icon: '📋', label: 'Ready to Draft' },
      drafting: { color: 'bg-purple-500/20 text-purple-400', icon: '🎯', label: 'Drafting' },
      active: { color: 'bg-green-500/20 text-green-400', icon: '✅', label: 'Season Active' }
    };
    
    const badge = badges[leagueStatus] || badges.setup;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  const getTop10Players = () => {
    if (!generatedPrices?.prices) return [];
    
    return [...generatedPrices.prices]
      .sort((a, b) => (b.salary || 0) - (a.salary || 0))
      .slice(0, 10);
  };

  const getDistributionChart = () => {
    if (!generatedPrices?.prices) return null;
    
    const ranges = [
      { label: '$50+', min: 50, max: Infinity, count: 0, color: 'bg-red-500' },
      { label: '$40-49', min: 40, max: 49, count: 0, color: 'bg-orange-500' },
      { label: '$30-39', min: 30, max: 39, count: 0, color: 'bg-yellow-500' },
      { label: '$20-29', min: 20, max: 29, count: 0, color: 'bg-green-500' },
      { label: '$10-19', min: 10, max: 19, count: 0, color: 'bg-blue-500' },
      { label: '$5-9', min: 5, max: 9, count: 0, color: 'bg-indigo-500' },
      { label: '$1-4', min: 1, max: 4, count: 0, color: 'bg-purple-500' }
    ];
    
    generatedPrices.prices.forEach(player => {
      const salary = player.salary || 0;
      const range = ranges.find(r => salary >= r.min && salary <= r.max);
      if (range) range.count++;
    });
    
    const maxCount = Math.max(...ranges.map(r => r.count));
    
    return ranges.map(range => ({
      ...range,
      percentage: maxCount > 0 ? (range.count / maxCount) * 100 : 0
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToSeasonSetup}
                className={dynastyTheme.utils.getComponent('button', 'ghost', 'sm')}
                title="Back to Season Setup"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className={dynastyTheme.components.heading.h1}>
                  <DollarSign className="inline w-8 h-8 mr-2" />
                  Salary & Contract Settings
                </h1>
                <p className={dynastyTheme.classes.text.neutralLight}>
                  Configure salary caps, contracts, and player pricing for {league?.league_name || 'your league'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {getStatusBadge()}
              <button
                onClick={downloadPricesCSV}
                disabled={!generatedPrices && customPrices.length === 0}
                className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={saving || (!generatedPrices?.prices && customPrices.length === 0)}
                className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save & Continue
                  </>
                )}
              </button>
            </div>
          </div>

          {leagueStatus === 'setup' && !pricesAlreadySet && (
            <div className={`mt-4 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50`}>
              <Bell className="w-4 h-4 inline mr-2 text-yellow-400" />
              <span className="text-yellow-400 text-sm">
                You must generate and save player prices before teams can make transactions
              </span>
            </div>
          )}
          
          {dataLoaded && (
            <div className={`mt-4 p-3 rounded-lg bg-green-500/20 border border-green-500/50`}>
              <Check className="w-4 h-4 inline mr-2 text-green-400" />
              <span className="text-green-400 text-sm">
                Player data loaded - normalization applied where needed
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-4">
          <div className="flex space-x-4">
            {['contracts', 'extensions', 'pricing', 'preview'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium ${dynastyTheme.classes.transition} ${
                  activeTab === tab
                    ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                    : dynastyTheme.utils.getComponent('button', 'ghost', 'sm')
                }`}
              >
                {tab === 'preview' && (generatedPrices || customPrices.length > 0) && (
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                )}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB: Contract Settings */}
      {activeTab === 'contracts' && (
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6 space-y-6">
            <h2 className={dynastyTheme.components.heading.h2}>
              <Settings className="inline w-6 h-6 mr-2" />
              Contract & Cap Settings
            </h2>

            <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.use_dual_cap}
                  onChange={(e) => setSettings({ ...settings, use_dual_cap: e.target.checked })}
                  className="w-5 h-5"
                  disabled={leagueStatus === 'active'}
                />
                <span className={dynastyTheme.classes.text.white}>
                  Use Dual Cap System (Draft Cap + Season Cap)
                </span>
              </label>
              <p className={`text-xs ${dynastyTheme.classes.text.neutralLight} mt-2 ml-8`}>
                When enabled, unspent draft budget carries over as FAAB
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {settings.use_dual_cap ? (
                <>
                  <div>
                    <label className={dynastyTheme.components.label}>Draft Cap ($)</label>
                    <input
                      type="number"
                      value={settings.draft_cap}
                      onChange={(e) => setSettings({
                        ...settings,
                        draft_cap: parseInt(e.target.value) || 0
                      })}
                      className={dynastyTheme.components.input}
                      disabled={leagueStatus === 'active'}
                    />
                  </div>
                  <div>
                    <label className={dynastyTheme.components.label}>Season Cap ($)</label>
                    <input
                      type="number"
                      value={settings.season_cap}
                      onChange={(e) => setSettings({
                        ...settings,
                        season_cap: parseInt(e.target.value) || 0
                      })}
                      className={dynastyTheme.components.input}
                      disabled={leagueStatus === 'active'}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className={dynastyTheme.components.label}>Total Salary Cap ($)</label>
                  <input
                    type="number"
                    value={settings.salary_cap}
                    onChange={(e) => setSettings({
                        ...settings,
                        salary_cap: parseInt(e.target.value) || 0
                      })}
                      className={dynastyTheme.components.input}
                      disabled={leagueStatus === 'active'}
                    />
                  </div>
                )}

                <div>
                  <label className={dynastyTheme.components.label}>Standard Contract Length</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={settings.standard_contract_length}
                    onChange={(e) => setSettings({
                      ...settings,
                      standard_contract_length: parseInt(e.target.value) || 1
                    })}
                    className={dynastyTheme.components.input}
                  />
                </div>

                <div>
                  <label className={dynastyTheme.components.label}>Minimum Salary ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={settings.min_salary}
                    onChange={(e) => setSettings({
                      ...settings,
                      min_salary: parseInt(e.target.value) || 1
                    })}
                    className={dynastyTheme.components.input}
                  />
                </div>

                <div>
                  <label className={dynastyTheme.components.label}>Salary Increment ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={settings.salary_increment}
                    onChange={(e) => setSettings({
                      ...settings,
                      salary_increment: parseInt(e.target.value) || 1
                    })}
                    className={dynastyTheme.components.input}
                  />
                </div>

                <div>
                  <label className={dynastyTheme.components.label}>Rookie Price ($)</label>
                  <input
                    type="number"
                    value={settings.rookie_price}
                    onChange={(e) => setSettings({
                      ...settings,
                      rookie_price: parseInt(e.target.value) || 1
                    })}
                    className={dynastyTheme.components.input}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Extensions */}
        {activeTab === 'extensions' && (
          <div className={dynastyTheme.components.card.base}>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className={dynastyTheme.components.heading.h2}>
                  <TrendingUp className="inline w-6 h-6 mr-2" />
                  Contract Extension Rules
                </h2>
                <button
                  onClick={addExtensionRule}
                  className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rule
                </button>
              </div>

              <div className="space-y-4">
                {settings.extension_rules.map((rule, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg border ${dynastyTheme.classes.border.neutral} ${dynastyTheme.classes.bg.darkLighter}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`${dynastyTheme.classes.text.primary} font-semibold`}>
                        Extension Option {index + 1}
                      </h3>
                      {settings.extension_rules.length > 1 && (
                        <button
                          onClick={() => removeExtensionRule(index)}
                          className={`${dynastyTheme.classes.text.error} hover:text-red-400`}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Years</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={rule.years}
                          onChange={(e) => handleExtensionRuleChange(index, 'years', e.target.value)}
                          className={`${dynastyTheme.components.input} mt-1`}
                        />
                      </div>
                      <div>
                        <label className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Cost Increase ($)</label>
                        <input
                          type="number"
                          min="0"
                          value={rule.cost_increase}
                          onChange={(e) => handleExtensionRuleChange(index, 'cost_increase', e.target.value)}
                          className={`${dynastyTheme.components.input} mt-1`}
                        />
                      </div>
                      <div>
                        <label className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Description</label>
                        <input
                          type="text"
                          value={rule.description}
                          onChange={(e) => handleExtensionRuleChange(index, 'description', e.target.value)}
                          className={`${dynastyTheme.components.input} mt-1`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Pricing */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            {/* Draft Cap Usage Slider */}
            <div className={dynastyTheme.components.card.highlighted}>
              <div className="p-6">
                <h3 className={`${dynastyTheme.components.heading.h3} mb-4`}>
                  <Sliders className="inline w-5 h-5 mr-2" />
                  Draft Cap Distribution
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className={dynastyTheme.classes.text.white}>
                        Target Draft Spending
                      </label>
                      <span className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
                        {Math.round(settings.draft_cap_usage * 100)}%
                      </span>
                    </div>
                    
                    <div className="relative w-full h-3 rounded-lg overflow-hidden" style={{ backgroundColor: dynastyTheme.tokens.colors.neutral[700] }}>
                      <div 
                        className="absolute h-full rounded-lg transition-all duration-200"
                        style={{
                          width: `${((settings.draft_cap_usage * 100 - 50) / 45) * 100}%`,
                          backgroundColor: dynastyTheme.tokens.colors.primary
                        }}
                      />
                      
                      <input
                        type="range"
                        min="50"
                        max="95"
                        step="5"
                        value={Math.round(settings.draft_cap_usage * 100)}
                        onChange={(e) => setSettings({
                          ...settings,
                          draft_cap_usage: parseInt(e.target.value) / 100
                        })}
                        className="absolute w-full h-full opacity-0 cursor-pointer"
                        style={{ 
                          zIndex: 10,
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none'
                        }}
                      />
                      
                      <div 
                        className="absolute rounded-full border-2 shadow-lg transition-all duration-200 pointer-events-none"
                        style={{
                          backgroundColor: dynastyTheme.tokens.colors.primary,
                          borderColor: dynastyTheme.tokens.colors.neutral[900],
                          width: '20px',
                          height: '20px',
                          left: `calc(${((settings.draft_cap_usage * 100 - 50) / 45) * 100}% - 10px)`,
                          top: '-4px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                        }}
                      />
                    </div>
                    
                    <div className="flex justify-between text-xs mt-2">
                      <span className={dynastyTheme.classes.text.neutralLight}>50% (Conservative)</span>
                      <span className={dynastyTheme.classes.text.neutralLight}>75% (Balanced)</span>
                      <span className={dynastyTheme.classes.text.neutralLight}>95% (Aggressive)</span>
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
                    <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                      With a ${settings.draft_cap} draft cap and {Math.round(settings.draft_cap_usage * 100)}% target spending:
                    </p>
                    <ul className={`text-sm ${dynastyTheme.classes.text.white} mt-2`}>
                      <li>• Teams will spend ~${Math.round(settings.draft_cap * settings.draft_cap_usage)} on average</li>
                      <li>• Leaving ~${Math.round(settings.draft_cap * (1 - settings.draft_cap_usage))} for in-season moves</li>
                      <li>• Total FAAB: ${Math.round(settings.draft_cap * (1 - settings.draft_cap_usage)) + settings.season_cap}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Method Selection */}
            <div className={dynastyTheme.components.card.base}>
              <div className="p-6">
                <h2 className={dynastyTheme.components.heading.h2}>
                  <Calculator className="inline w-6 h-6 mr-2" />
                  Player Pricing Method
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <button
                    onClick={() => setSettings({ ...settings, price_generation_method: 'adaptive' })}
                    className={`p-4 rounded-lg border-2 ${dynastyTheme.classes.transition} ${
                      settings.price_generation_method === 'adaptive'
                        ? `${dynastyTheme.classes.border.primary} ${dynastyTheme.classes.bg.primaryLight}`
                        : `${dynastyTheme.classes.border.neutral} hover:border-yellow-400/50`
                    }`}
                  >
                    <Calculator className={`w-8 h-8 mb-2 ${dynastyTheme.classes.text.primary}`} />
                    <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>
                      Adaptive Engine
                    </h3>
                    <p className={`text-sm ${dynastyTheme.classes.text.neutralLight} mt-2`}>
                      Smart pricing based on stats
                    </p>
                  </button>

                  <button
                    onClick={() => setSettings({ ...settings, price_generation_method: 'custom' })}
                    className={`p-4 rounded-lg border-2 ${dynastyTheme.classes.transition} ${
                      settings.price_generation_method === 'custom'
                        ? `${dynastyTheme.classes.border.primary} ${dynastyTheme.classes.bg.primaryLight}`
                        : `${dynastyTheme.classes.border.neutral} hover:border-yellow-400/50`
                    }`}
                  >
                    <Upload className={`w-8 h-8 mb-2 ${dynastyTheme.classes.text.primary}`} />
                    <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>
                      Upload CSV
                    </h3>
                    <p className={`text-sm ${dynastyTheme.classes.text.neutralLight} mt-2`}>
                      Import your own prices
                    </p>
                  </button>

                  <button
                    onClick={() => setSettings({ ...settings, price_generation_method: 'manual' })}
                    className={`p-4 rounded-lg border-2 ${dynastyTheme.classes.transition} ${
                      settings.price_generation_method === 'manual'
                        ? `${dynastyTheme.classes.border.primary} ${dynastyTheme.classes.bg.primaryLight}`
                        : `${dynastyTheme.classes.border.neutral} hover:border-yellow-400/50`
                    }`}
                  >
                    <FileText className={`w-8 h-8 mb-2 ${dynastyTheme.classes.text.primary}`} />
                    <h3 className={`font-semibold ${dynastyTheme.classes.text.white}`}>
                      Manual Entry
                    </h3>
                    <p className={`text-sm ${dynastyTheme.classes.text.neutralLight} mt-2`}>
                      Set prices individually
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Adaptive Engine */}
            {settings.price_generation_method === 'adaptive' && (
              <div className={dynastyTheme.components.card.base}>
                <div className="p-6">
                  <h3 className={dynastyTheme.components.heading.h3}>
                    Adaptive Price Generation
                  </h3>
                  
                  <div className={`mt-4 p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
                    <h4 className={`${dynastyTheme.classes.text.primary} font-semibold mb-3`}>
                      Your League's Scoring Categories
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Hitting:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {settings.hitting_categories?.map(cat => (
                            <span key={cat} className={dynastyTheme.components.badge.info}>
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Pitching:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {settings.pitching_categories?.map(cat => (
                            <span key={cat} className={dynastyTheme.components.badge.warning}>
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={() => handleGeneratePrices(false)}
                      disabled={generating || loading}
                      className={dynastyTheme.utils.getComponent('button', 'primary', 'lg')}
                    >
                      {generating ? (
                        <>
                          <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Calculator className="w-5 h-5 mr-2" />
                          Generate Prices
                        </>
                      )}
                    </button>

                    {generatedPrices && (
                      <button
                        onClick={() => handleGeneratePrices(true)}
                        disabled={generating}
                        className={dynastyTheme.utils.getComponent('button', 'secondary', 'lg')}
                      >
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Regenerate
                      </button>
                    )}
                  </div>
                  
                  {loading && (
                    <div className={`mt-4 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50`}>
                      <AlertCircle className="w-4 h-4 inline mr-2 text-yellow-400" />
                      <span className="text-yellow-400 text-sm">
                        Loading player data... Please wait
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom Upload */}
            {settings.price_generation_method === 'custom' && (
              <div className={dynastyTheme.components.card.base}>
                <div className="p-6">
                  <h3 className={dynastyTheme.components.heading.h3}>
                    Upload Custom Prices
                  </h3>

                  <div className={`mt-4 p-8 rounded-lg border-2 border-dashed ${dynastyTheme.classes.border.neutral} text-center`}>
                    <Upload className={`w-12 h-12 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLight}`} />
                    <label className="cursor-pointer">
                      <span className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}>
                        Choose CSV File
                      </span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-4`}>
                      Format: player_name, position, team, salary
                    </p>
                  </div>

                  {uploadedFile && (
                    <div className={`mt-4 p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className={`w-5 h-5 mr-2 ${dynastyTheme.classes.text.primary}`} />
                          <span className={dynastyTheme.classes.text.white}>{uploadedFile.name}</span>
                        </div>
                        <span className={`${dynastyTheme.classes.text.success} text-sm`}>
                          {customPrices.length} players loaded
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Preview */}
        {activeTab === 'preview' && (
          <div className="space-y-6">
            {/* Summary Stats with Charts */}
            {generatedPrices?.summary && (
              <div className={dynastyTheme.components.card.base}>
                <div className="p-6">
                  <h3 className={dynastyTheme.components.heading.h3}>
                    <BarChart3 className="inline w-5 h-5 mr-2" />
                    Price Distribution Summary
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Avg Salary</div>
                      <div className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>
                        ${generatedPrices.summary.avgSalary}
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Max Salary</div>
                      <div className={`text-2xl font-bold ${dynastyTheme.classes.text.success}`}>
                        ${generatedPrices.summary.maxSalary}
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>{'Players > $30'}</div>
                      <div className={`text-2xl font-bold ${dynastyTheme.classes.text.warning}`}>
                        {generatedPrices.summary.distribution?.over30 || 0}
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>Total Players</div>
                      <div className={`text-2xl font-bold ${dynastyTheme.classes.text.primary}`}>
                        {generatedPrices.prices?.length || 0}
                      </div>
                    </div>
                  </div>
                  
                  {/* Distribution Chart */}
                  <div className="mt-6">
                    <h4 className={`text-md font-semibold mb-3 ${dynastyTheme.classes.text.warning}`}>
                      Price Distribution
                    </h4>
                    <div className="space-y-2">
                      {getDistributionChart()?.map(range => (
                        <div key={range.label} className="flex items-center gap-3">
                          <div className={`w-20 text-right text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                            {range.label}
                          </div>
                          <div className="flex-1 h-6 bg-gray-700 rounded relative overflow-hidden">
                            <div
                              className={`h-full ${range.color} transition-all duration-500`}
                              style={{ width: `${range.percentage}%` }}
                            />
                            <span className="absolute right-2 top-0 leading-6 text-xs text-white">
                              {range.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Top 10 Players */}
                  <div className="mt-6">
                    <h4 className={`text-md font-semibold mb-3 ${dynastyTheme.classes.text.warning}`}>
                      Top 10 Most Expensive Players
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {getTop10Players().map((player, idx) => (
                        <div 
                          key={player.player_id || idx}
                          className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter} border ${dynastyTheme.classes.border.neutral}`}
                        >
                          <div className={`text-xs ${dynastyTheme.classes.text.neutralLight} mb-1`}>
                            #{idx + 1} • {player.position}
                          </div>
                          <div className={`text-sm font-semibold ${dynastyTheme.classes.text.white} truncate mb-1`}>
                            <Link 
                              to={`/player/${player.player_id || player.mlb_player_id}${leagueId ? `?leagueId=${leagueId}` : ''}`}
                              className="hover:text-blue-400 hover:underline"
                            >
                              {player.player_name}
                            </Link>
                          </div>
                          <div className={`text-lg font-bold ${dynastyTheme.classes.text.success}`}>
                            ${(player.salary || 0).toFixed(0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Player Price Table */}
            {generatedPrices?.prices && generatedPrices.prices.length > 0 ? (
              <div className={dynastyTheme.components.card.base}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`${dynastyTheme.components.heading.h3}`}>
                      <Edit className="inline w-5 h-5 mr-2" />
                      Player Price Editor
                    </h3>
                    
                    {/* Bulk Edit Controls */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBulkEditMode(!bulkEditMode)}
                        className={bulkEditMode 
                          ? dynastyTheme.utils.getComponent('button', 'warning', 'sm')
                          : dynastyTheme.utils.getComponent('button', 'secondary', 'sm')
                        }
                      >
                        <Users className="w-4 h-4 mr-2" />
                        {bulkEditMode ? 'Cancel Bulk Edit' : 'Bulk Edit'}
                      </button>
                      
                      {bulkEditMode && selectedPlayers.size > 0 && (
                        <button
                          onClick={() => setPriceAdjustmentModal(true)}
                          className={dynastyTheme.utils.getComponent('button', 'primary', 'sm')}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Adjust {selectedPlayers.size} Players
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Controls */}
                  <div className="flex gap-4 mb-4">
                    <div className="flex border rounded-lg">
                      <button
                        onClick={() => {
                          setViewMode('hitters');
                          setPositionFilter('all');
                        }}
                        className={`px-4 py-2 ${
                          viewMode === 'hitters'
                            ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                            : dynastyTheme.utils.getComponent('button', 'ghost', 'sm')
                        }`}
                      >
                        Hitters
                      </button>
                      <button
                        onClick={() => {
                          setViewMode('pitchers');
                          setPositionFilter('all');
                        }}
                        className={`px-4 py-2 ${
                          viewMode === 'pitchers'
                            ? dynastyTheme.utils.getComponent('button', 'primary', 'sm')
                            : dynastyTheme.utils.getComponent('button', 'ghost', 'sm')
                        }`}
                      >
                        Pitchers
                      </button>
                    </div>

                    <div className="relative">
                      <select
                        value={positionFilter}
                        onChange={(e) => setPositionFilter(e.target.value)}
                        className={`${dynastyTheme.components.input} pr-8`}
                      >
                        <option value="all">All Positions</option>
                        {positions[viewMode].map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Search players..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className={`${dynastyTheme.components.input} w-full pl-8`}
                      />
                      <Search className="w-4 h-4 absolute left-2 top-3 text-gray-400" />
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg ${dynastyTheme.classes.bg.darkLighter} mb-4`}>
                    <span className={dynastyTheme.classes.text.neutralLight}>
                      Showing {getFilteredPrices().length} of {generatedPrices.prices.length} players
                    </span>
                  </div>

                  <DynastyTable
                    data={getFilteredPrices()}
                    columns={createPricePreviewColumns()}
                    maxHeight="500px"
                    initialSort={{ key: 'salary', direction: 'desc' }}
                  />
                </div>
              </div>
            ) : (
              <div className={dynastyTheme.components.card.base}>
                <div className="p-6 text-center py-12">
                  <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLight}`} />
                  <p className={dynastyTheme.classes.text.neutralLight}>
                    No prices generated yet. Go to the Pricing tab to generate or upload prices.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Bulk Price Adjustment Modal */}
        {priceAdjustmentModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className={`${dynastyTheme.components.card.base} p-6 max-w-md w-full`}>
              <h3 className={dynastyTheme.components.heading.h3}>
                Bulk Price Adjustment
              </h3>
              <p className={`${dynastyTheme.classes.text.neutralLight} mb-4`}>
                Adjusting {selectedPlayers.size} selected players
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className={dynastyTheme.components.label}>Adjustment Type</label>
                  <select 
                    id="adjustmentType"
                    className={dynastyTheme.components.input}
                  >
                    <option value="percentage">Percentage Change</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="set">Set to Value</option>
                  </select>
                </div>
                
                <div>
                  <label className={dynastyTheme.components.label}>Value</label>
                  <input
                    type="number"
                    id="adjustmentValue"
                    className={dynastyTheme.components.input}
                    placeholder="Enter value"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const type = document.getElementById('adjustmentType').value;
                      const value = parseFloat(document.getElementById('adjustmentValue').value);
                      if (!isNaN(value)) {
                        handleBulkPriceAdjustment(type, value);
                      }
                    }}
                    className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setPriceAdjustmentModal(false)}
                    className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  export default SalaryContractSettings;