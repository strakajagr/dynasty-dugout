// src/services/pricingColumns.js - PRICING TABLE COLUMNS

import { dynastyTheme } from '../colorService';
import { renderDefault, renderFloat1, renderFloat2, renderFloat3, renderAvg } from './DynastyTable';

// =============================================================================
// PRICE PREVIEW COLUMNS
// =============================================================================
export const createPricePreviewColumns = (params) => {
  const { 
    bulkEditMode, 
    selectedPlayers,
    setSelectedPlayers,
    handleManualPriceChange,
    settings,
    viewMode,
    leagueId,
    getFilteredPrices
  } = params;

  const baseColumns = [];
  
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
          className={dynastyTheme.classes.text.primary}
          style={{ accentColor: '#D4AF37' }}
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
          className={dynastyTheme.classes.text.primary}
          style={{ accentColor: '#D4AF37' }}
        />
      )
    });
  }
  
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
            <a 
              href={`/player/${playerId}${leagueId ? `?leagueId=${leagueId}` : ''}`}
              className={`${dynastyTheme.classes.text.primary} ${dynastyTheme.classes.text.primaryHover} hover:underline truncate transition-colors`}
              style={{ maxWidth: '110px' }}
            >
              {v || 'Unknown Player'}
            </a>
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

  // Dynamic category columns
  cats?.forEach(cat => {
    const catUpper = cat.toUpperCase();
    const catLower = cat.toLowerCase();
    let title = catUpper;
    let width = 40;
    let render;
    let key;

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
      title: 'Generated', 
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
      title: 'Final',
      width: 85,
      render: (value, player) => (
        <div className="flex items-center gap-1">
          <span className={dynastyTheme.classes.text.success}>$</span>
          <input
            type="number"
            min={settings.min_salary}
            step={settings.salary_increment}
            value={player.salary || settings.min_salary}
            onChange={(e) => handleManualPriceChange(player.player_id || player.mlb_player_id, e.target.value)}
            className={`${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.border.neutral} ${dynastyTheme.classes.text.white} w-14 px-1 py-0 text-xs rounded border`}
            style={{ height: '22px' }}
            disabled={bulkEditMode}
          />
          {player.manual_price && player.original_salary && (
            <button
              onClick={() => handleManualPriceChange(player.player_id, player.original_salary)}
              className={`text-xs ${dynastyTheme.classes.text.neutralLight} hover:text-gray-300 transition-colors`}
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