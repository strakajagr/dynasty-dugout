// src/pages/league-dashboard/salary-contract/tabs/PricingTab.js
import React from 'react';
import { Calculator, Upload, FileText, RefreshCw, AlertCircle, Lock } from 'lucide-react';
import { dynastyTheme } from '../../../../services/colorService';
import DraftCapSlider from '../components/DraftCapSlider';

const PricingTab = ({ 
  settings, 
  setSettings, 
  loading,
  generating,
  dataLoaded,
  handleGeneratePrices,
  generatedPrices,
  customPrices,
  setCustomPrices,
  uploadedFile,
  setUploadedFile,
  setActiveTab,
  leagueStatus
}) => {

  const canGeneratePrices = leagueStatus === 'setup' || leagueStatus === 'pricing';

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

  return (
    <div className="space-y-6">
      {/* Draft Cap Usage Slider - Always Available */}
      <DraftCapSlider 
        settings={settings}
        setSettings={setSettings}
      />

      {/* Status Warning if not in pricing phase */}
      {!canGeneratePrices && (
        <div className={`${dynastyTheme.components.card.base} p-4`}>
          <div className={`flex items-center gap-3 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50`}>
            <Lock className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-yellow-400 font-semibold">
                Price Generation Locked
              </p>
              <p className="text-yellow-300 text-sm mt-1">
                League status is "{leagueStatus}". Price generation is only available during the setup/pricing phase. 
                Manual price adjustments can still be made in the Preview tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Method Selection */}
      <div className={dynastyTheme.components.card.base}>
        <div className="p-6">
          <h2 className={dynastyTheme.components.heading.h2}>
            <Calculator className="inline w-6 h-6 mr-2" />
            Player Pricing Method
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <button
              onClick={() => canGeneratePrices && setSettings({ ...settings, price_generation_method: 'adaptive' })}
              disabled={!canGeneratePrices}
              className={`p-4 rounded-lg border-2 ${dynastyTheme.classes.transition} ${
                !canGeneratePrices ? 'opacity-50 cursor-not-allowed' : ''
              } ${
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
              {!canGeneratePrices && (
                <p className="text-xs text-red-400 mt-2">Locked</p>
              )}
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
              {canGeneratePrices ? (
                <>
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
                </>
              ) : (
                <div className={`p-4 rounded-lg ${dynastyTheme.classes.bg.darkLighter} w-full`}>
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-gray-400" />
                    <span className={dynastyTheme.classes.text.neutralLight}>
                      Price generation is disabled. Use the Preview tab to make manual adjustments.
                    </span>
                  </div>
                </div>
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

      {/* Custom Upload - Always Available */}
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

      {/* Manual Entry Info */}
      {settings.price_generation_method === 'manual' && (
        <div className={dynastyTheme.components.card.base}>
          <div className="p-6">
            <h3 className={dynastyTheme.components.heading.h3}>
              Manual Price Entry
            </h3>
            <p className={`${dynastyTheme.classes.text.neutralLight} mt-2`}>
              Go to the Preview tab to manually set individual player prices. 
              You can adjust prices at any time, even during the season.
            </p>
            <button
              onClick={() => setActiveTab('preview')}
              className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} mt-4`}
            >
              Go to Preview Tab
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingTab;