// src/pages/league-dashboard/salary-contract/SalaryContractSettings.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DollarSign, Download, Save, RefreshCw, Bell, Check, ArrowLeft, Loader, AlertTriangle } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';
import { AdaptiveSalaryEngine } from '../../../services/adaptiveSalaryEngine';
import pricingDataService from '../../../services/pricingDataService';
import { leaguesAPI } from '../../../services/apiService';

// Import tab components
import ContractSettingsTab from './tabs/ContractSettingsTab';
import ExtensionsTab from './tabs/ExtensionsTab';
import PricingTab from './tabs/PricingTab';
import PreviewTab from './tabs/PreviewTab';

// Import modals
import BulkPriceAdjustmentModal from './components/BulkPriceAdjustmentModal';

// Progress Modal Component
const SaveProgressModal = ({ isOpen, progress, message, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`${dynastyTheme.components.card.base} p-6 max-w-md w-full mx-4`}>
        <h3 className={`${dynastyTheme.components.heading.h3} mb-4`}>
          Saving Player Prices
        </h3>
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={dynastyTheme.classes.text.neutralLight}>Progress</span>
            <span className={dynastyTheme.classes.text.primary}>{progress}%</span>
          </div>
          <div className="w-full bg-neutral-700 rounded-full h-3">
            <div 
              className="bg-yellow-400 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {message && (
          <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mb-4`}>
            {message}
          </p>
        )}
        
        <div className="flex items-center justify-center">
          <Loader className="w-6 h-6 animate-spin text-yellow-400" />
          <span className={`ml-2 ${dynastyTheme.classes.text.white}`}>
            Processing...
          </span>
        </div>
        
        {progress === 100 && (
          <button
            onClick={onClose}
            className={`mt-4 w-full ${dynastyTheme.utils.getComponent('button', 'primary', 'md')}`}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
};

const SalaryContractSettings = ({ league, user, onStatusChange }) => {
  const { leagueId: urlLeagueId } = useParams();
  const leagueId = league?.league_id || urlLeagueId;
  const navigate = useNavigate();
  
  // Core State with proper defaults that persist even if API fails
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pricingData, setPricingData] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [apiErrors, setApiErrors] = useState([]);
  
  // Default settings that should never be lost
  const defaultSettings = {
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
  };
  
  const [settings, setSettings] = useState(defaultSettings);
  const [generatedPrices, setGeneratedPrices] = useState(null);
  const [customPrices, setCustomPrices] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [activeTab, setActiveTab] = useState('contracts');
  const [leagueStatus, setLeagueStatus] = useState(league?.league_status || 'setup');
  const [pricesAlreadySet, setPricesAlreadySet] = useState(false);
  
  // Bulk edit state
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState(new Set());
  const [priceAdjustmentModal, setPriceAdjustmentModal] = useState(false);
  
  // Async save state
  const [saveProgressModal, setSaveProgressModal] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');

  // Data loading functions with improved error handling
  useEffect(() => {
    if (leagueId) {
      loadSettings();
      checkPriceStatus();
      loadPricingData();
      checkLeagueStatus();
    }
  }, [leagueId]);

  const addApiError = (error, context) => {
    const errorMessage = `${context}: ${error.message}`;
    setApiErrors(prev => [...prev.filter(e => !e.includes(context)), errorMessage]);
    console.error(errorMessage, error);
  };

  const clearApiError = (context) => {
    setApiErrors(prev => prev.filter(e => !e.includes(context)));
  };

  const checkLeagueStatus = async () => {
    try {
      const response = await leaguesAPI.getLeagueDetails(leagueId);
      if (response.success) {
        setLeagueStatus(response.league.league_status || 'setup');
        clearApiError('League Status');
      }
    } catch (error) {
      addApiError(error, 'League Status');
      // Keep default status from props or 'setup'
      setLeagueStatus(league?.league_status || 'setup');
    }
  };

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
        clearApiError('Pricing Data');
        
        if (data.scoring_categories) {
          setSettings(prev => ({
            ...prev,
            hitting_categories: data.scoring_categories.hitting || prev.hitting_categories,
            pitching_categories: data.scoring_categories.pitching || prev.pitching_categories
          }));
        }
      }
    } catch (error) {
      addApiError(error, 'Pricing Data');
      setDataLoaded(false);
      // Don't fail completely - we can still work with default settings
    } finally {
      setLoading(false);
    }
  };

  const checkPriceStatus = async () => {
    try {
      const response = await leaguesAPI.checkPriceStatus(leagueId);
      if (response.success) {
        setPricesAlreadySet(response.prices_set);
        clearApiError('Price Status');
      }
    } catch (error) {
      addApiError(error, 'Price Status');
      // Default to false if we can't check
      setPricesAlreadySet(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await leaguesAPI.getSalarySettings(leagueId);
      if (response.success && response.settings) {
        // Merge with defaults to ensure we don't lose any important settings
        setSettings(prevSettings => ({
          ...defaultSettings, // Start with defaults
          ...prevSettings,    // Keep any existing local changes
          ...response.settings, // Apply server settings
          // Ensure critical arrays don't get overwritten with undefined
          extension_rules: response.settings.extension_rules || prevSettings.extension_rules || defaultSettings.extension_rules,
          hitting_categories: response.settings.hitting_categories || prevSettings.hitting_categories || defaultSettings.hitting_categories,
          pitching_categories: response.settings.pitching_categories || prevSettings.pitching_categories || defaultSettings.pitching_categories
        }));
        
        if (response.existing_prices) {
          setGeneratedPrices({
            prices: response.existing_prices,
            summary: response.summary
          });
        }
        clearApiError('Salary Settings');
      }
    } catch (error) {
      addApiError(error, 'Salary Settings');
      // EXPLICITLY set defaults when API fails
      setSettings(prevSettings => ({
        ...defaultSettings,
        // Keep any local changes that were made
        ...prevSettings,
        // Force the essential defaults
        extension_rules: prevSettings.extension_rules || defaultSettings.extension_rules,
        hitting_categories: prevSettings.hitting_categories || defaultSettings.hitting_categories,
        pitching_categories: prevSettings.pitching_categories || defaultSettings.pitching_categories
      }));
      console.log('Using default settings due to API error, extension_rules:', defaultSettings.extension_rules);
    }
  };

  const handleBackToSeasonSetup = () => {
    // Navigate back to league dashboard and set active section to season-setup
    navigate(`/leagues/${leagueId}`, { 
      state: { activeSection: 'season-setup' } 
    });
  };

  const handleSaveSettings = async () => {
    // Declare requestPayload outside try block for proper scoping
    let requestPayload;
    
    try {
      setSaving(true);
      
      const pricesToSave = generatedPrices?.prices || customPrices;
      
      if (!pricesToSave || pricesToSave.length === 0) {
        alert('No prices to save! Please generate or upload prices first.');
        setSaving(false);
        return;
      }
      
      // Format each player price to match backend expectations
      const formattedPrices = pricesToSave.map(player => ({
        player_id: parseInt(player.player_id || player.mlb_player_id || player.id),
        price: parseFloat(player.salary || player.price || player.generated_price || 0),
        salary: parseFloat(player.salary || player.price || player.generated_price || 0),
        tier: player.tier || player.price_tier || null,
        manual_override: false,
        contract_years: parseInt(player.contract_years || 1)
      }));
      
      // Build request matching SavePricesRequest structure with all current settings
      requestPayload = {
        settings: {
          use_dual_cap: settings.use_dual_cap || true,
          draft_cap: parseFloat(settings.draft_cap || 600),
          season_cap: parseFloat(settings.season_cap || 200),
          total_cap: parseFloat(settings.total_cap || settings.salary_cap || 800),
          salary_cap: parseFloat(settings.salary_cap || 800),
          min_salary: parseFloat(settings.min_salary || 2),
          salary_increment: parseFloat(settings.salary_increment || 2),
          rookie_price: parseFloat(settings.rookie_price || 20),
          standard_contract_length: parseInt(settings.standard_contract_length || 2),
          draft_cap_usage: parseFloat(settings.draft_cap_usage || 0.75),
          extension_rules: settings.extension_rules || defaultSettings.extension_rules,
          pricing_method: settings.price_generation_method || settings.pricing_method || 'adaptive',
          hitting_categories: settings.hitting_categories || defaultSettings.hitting_categories,
          pitching_categories: settings.pitching_categories || defaultSettings.pitching_categories
        },
        prices: formattedPrices,
        method: settings.price_generation_method || settings.pricing_method || 'adaptive'
      };
      
      console.log(`Saving ${formattedPrices.length} player prices...`);
      console.log('Sending payload:', JSON.stringify(requestPayload, null, 2));
      
      // Use async save for large datasets
      if (formattedPrices.length > 100) {
        setSaveProgressModal(true);
        setSaveProgress(0);
        setSaveMessage('Starting async save...');
        
        try {
          // Start async job
          const jobResponse = await leaguesAPI.startAsyncPriceSave(leagueId, requestPayload);
          
          if (jobResponse.success && jobResponse.job_id) {
            console.log(`Async job started: ${jobResponse.job_id}`);
            
            // Poll for completion
            await leaguesAPI.pollPriceSaveJob(leagueId, jobResponse.job_id, {
              onProgress: (status) => {
                setSaveProgress(status.progress || 0);
                setSaveMessage(status.message || `Processing ${status.processed_players}/${status.total_players} players...`);
                console.log(`Progress: ${status.progress}%`, status.message);
              },
              pollInterval: 2000,
              maxAttempts: 150
            });
            
            // Success!
            setSaveProgress(100);
            setSaveMessage('All prices saved successfully!');
            
            // Handle post-save actions (status update, etc)
            await handlePostSaveActions(formattedPrices);
            
            setTimeout(() => {
              setSaveProgressModal(false);
              // handlePostSaveActions will handle navigation
            }, 1500);
          } else {
            throw new Error('Failed to start async save job');
          }
        } catch (asyncError) {
          console.warn('Async save failed, falling back to synchronous save:', asyncError);
          setSaveProgressModal(false);
          
          // Fall back to synchronous save
          const response = await leaguesAPI.updateSalarySettings(leagueId, requestPayload);
          
          if (response.success) {
            await handlePostSaveActions(formattedPrices);
          } else {
            throw new Error(response.message || 'Failed to save settings');
          }
        }
      } else {
        // Use synchronous save for small datasets
        const response = await leaguesAPI.updateSalarySettings(leagueId, requestPayload);
        
        if (response.success) {
          await handlePostSaveActions(formattedPrices);
          // handlePostSaveActions will handle navigation
        } else {
          throw new Error(response.message || 'Failed to save settings');
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveProgressModal(false);
      alert(`Failed to save settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePostSaveActions = async (formattedPrices) => {
    const isFirstTimeSettingPrices = !pricesAlreadySet && formattedPrices.length > 0;
    
    if (isFirstTimeSettingPrices) {
      if (leagueStatus === 'setup' || leagueStatus === 'pricing') {
        try {
          const statusResponse = await leaguesAPI.updateLeagueStatus(leagueId, 'draft_ready');
          
          if (statusResponse.success) {
            setLeagueStatus('draft_ready');
            setPricesAlreadySet(true);
            
            if (league?.league_name) {
              try {
                await leaguesAPI.notifyOwners(leagueId, {
                  subject: 'Player Prices Set!',
                  message: `The commissioner has set player prices for ${league.league_name}. You can now begin building your roster!`,
                  type: 'prices_set'
                });
              } catch (notifyError) {
                console.log('Could not notify owners:', notifyError);
              }
            }
            
            if (onStatusChange) {
              onStatusChange();
            }
            
            // Show success message
            alert('Prices saved successfully! League is now ready for drafting.');
            
            // Navigate back to league dashboard with season-setup section active
            navigate(`/leagues/${leagueId}`, { 
              state: { activeSection: 'season-setup' } 
            });
            
            // Force the section to be set after navigation
            setTimeout(() => {
              const event = new CustomEvent('setActiveSection', { detail: 'season-setup' });
              window.dispatchEvent(event);
            }, 100);
          } else {
            throw new Error('Failed to update league status');
          }
        } catch (statusError) {
          console.error('Error updating league status:', statusError);
          alert('Prices saved but failed to update league status. You may need to manually advance the league status.');
          handleBackToSeasonSetup();
        }
      }
    } else {
      // Just updating existing prices, go back normally
      alert('Prices updated successfully!');
      handleBackToSeasonSetup();
    }
  };

  const handleGeneratePrices = async (regenerate = false) => {
    // Only allow generation in pricing phase
    if (leagueStatus !== 'pricing' && leagueStatus !== 'setup') {
      alert('Price generation is only allowed during the pricing phase. Manual adjustments can still be made.');
      return;
    }
    
    try {
      setGenerating(true);
      
      let dataToUse = pricingData;
      
      if (!dataToUse || !dataToUse.players || dataToUse.players.length === 0) {
        console.log('No pricing data available, loading...');
        
        // Load and wait for the data
        const data = await pricingDataService.getPricingData(leagueId);
        
        if (data && data.players) {
          console.log(`Loaded ${data.players.length} players with normalized stats`);
          setPricingData(data);
          setDataLoaded(true);
          dataToUse = data; // Use the freshly loaded data
          
          if (data.scoring_categories) {
            setSettings(prev => ({
              ...prev,
              hitting_categories: data.scoring_categories.hitting || prev.hitting_categories,
              pitching_categories: data.scoring_categories.pitching || prev.pitching_categories
            }));
          }
        }
        
        if (!dataToUse || !dataToUse.players || dataToUse.players.length === 0) {
          alert('Unable to load player data. Please try again.');
          setGenerating(false);
          return;
        }
      }
      
      console.log(`Generating prices for ${dataToUse.players.length} players...`);
      
      const engine = new AdaptiveSalaryEngine({
        ...settings,
        num_teams: league?.max_teams || 12,
        roster_size: league?.max_players_total || 25,
        draft_cap_usage: settings.draft_cap_usage,
        hitting_categories: settings.hitting_categories,
        pitching_categories: settings.pitching_categories
      });
      
      const result = engine.generatePrices(dataToUse.players);
      
      if (result.prices) {
        result.prices = result.prices.map(priceEntry => {
          const player = dataToUse.players.find(p => 
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
      setActiveTab('preview');
      
      if (regenerate) {
        alert('Prices regenerated with new settings!');
      }
      
    } catch (error) {
      console.error('Error generating prices:', error);
      alert('Failed to generate prices: ' + error.message);
      setActiveTab('pricing'); // Stay on pricing tab if there's an error
    } finally {
      setGenerating(false);
    }
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

  // Props to pass to all tabs
  const sharedProps = {
    settings,
    setSettings,
    generatedPrices,
    setGeneratedPrices,
    customPrices,
    setCustomPrices,
    uploadedFile,
    setUploadedFile,
    loading,
    generating,
    dataLoaded,
    pricingData,
    leagueStatus,
    pricesAlreadySet,
    league,
    leagueId,
    bulkEditMode,
    setBulkEditMode,
    selectedPlayers,
    setSelectedPlayers,
    setPriceAdjustmentModal,
    handleGeneratePrices,
    setActiveTab,
    defaultSettings // Pass defaults to ensure tabs can access them
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

          {/* API Error Messages */}
          {apiErrors.length > 0 && (
            <div className={`mt-4 p-3 rounded-lg bg-orange-500/20 border border-orange-500/50`}>
              <AlertTriangle className="w-4 h-4 inline mr-2 text-orange-400" />
              <span className="text-orange-400 text-sm font-medium">API Issues Detected:</span>
              <ul className="text-orange-400 text-sm mt-2 ml-6 list-disc">
                {apiErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
              <p className="text-orange-400 text-xs mt-2">
                Using default settings. Some features may be limited until backend endpoints are available.
              </p>
            </div>
          )}

          {(leagueStatus === 'setup' || leagueStatus === 'pricing') && !pricesAlreadySet && (
            <div className={`mt-4 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50`}>
              <Bell className="w-4 h-4 inline mr-2 text-yellow-400" />
              <span className="text-yellow-400 text-sm">
                You must generate and save player prices before teams can make transactions
              </span>
            </div>
          )}
          
          {(leagueStatus === 'draft_ready' || leagueStatus === 'drafting' || leagueStatus === 'active') && (
            <div className={`mt-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/50`}>
              <Bell className="w-4 h-4 inline mr-2 text-blue-400" />
              <span className="text-blue-400 text-sm">
                Price generation is disabled. Manual price adjustments are still allowed and will be logged.
              </span>
            </div>
          )}
          
          {dataLoaded && apiErrors.length === 0 && (
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

      {/* Tab Content */}
      {activeTab === 'contracts' && <ContractSettingsTab {...sharedProps} />}
      {activeTab === 'extensions' && <ExtensionsTab {...sharedProps} />}
      {activeTab === 'pricing' && <PricingTab {...sharedProps} />}
      {activeTab === 'preview' && <PreviewTab {...sharedProps} />}
      
      {/* Modals */}
      {priceAdjustmentModal && (
        <BulkPriceAdjustmentModal
          selectedPlayers={selectedPlayers}
          generatedPrices={generatedPrices}
          setGeneratedPrices={setGeneratedPrices}
          settings={settings}
          setSelectedPlayers={setSelectedPlayers}
          setBulkEditMode={setBulkEditMode}
          setPriceAdjustmentModal={setPriceAdjustmentModal}
        />
      )}
      
      {/* Async Save Progress Modal */}
      <SaveProgressModal
        isOpen={saveProgressModal}
        progress={saveProgress}
        message={saveMessage}
        onClose={() => setSaveProgressModal(false)}
      />
    </div>
  );
};

export default SalaryContractSettings;