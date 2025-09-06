// src/hooks/useLeagueCreation.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaguesAPI } from '../services/apiService';

export const useLeagueCreation = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [creationStatus, setCreationStatus] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  
  const [formData, setFormData] = useState({
    // Basic Info
    league_name: '',
    max_teams: 12,
    player_pool: 'american_national',
    include_minor_leagues: false,
    
    // Scoring
    scoring_system: 'rotisserie_ytd',
    scoring_categories: {
      hitters: ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'],
      pitchers: ['W', 'SV', 'ERA', 'WHIP', 'SO', 'QS']
    },
    
    // Rosters - CRITICAL: This needs to be saved to league_settings
    max_players_total: 23,
    min_hitters: 13,
    max_pitchers: 10,
    min_pitchers: 10,
    bench_slots: 5,
    dl_slots: 0,
    minor_league_slots: 0,
    position_requirements: {
      'C': { slots: 2 },
      '1B': { slots: 1 },
      '2B': { slots: 1 },
      '3B': { slots: 1 },
      'SS': { slots: 1 },
      'OF': { slots: 4 },
      'MI': { slots: 1 },
      'CI': { slots: 1 },
      'UTIL': { slots: 1 },
      'P': { slots: 10 }
    },
    
    // Financial
    use_salaries: true,
    use_contracts: true,
    use_dual_cap: true,
    draft_cap: 600,
    season_cap: 200,
    salary_cap: 800,
    standard_contract_length: 2,
    min_salary: 2,
    salary_increment: 2,
    rookie_price: 20,
    draft_cap_usage: 0.75,
    
    // Advanced
    transaction_deadline: 'monday',
    use_waivers: false,
    season_start_date: '2025-03-28',
    season_end_date: '2025-09-28'
  });

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleCategoryChange = (type, categories) => {
    setFormData(prev => ({
      ...prev,
      scoring_categories: {
        ...prev.scoring_categories,
        [type]: categories
      }
    }));
  };

  const handlePositionChange = (position, field, value) => {
    setFormData(prev => ({
      ...prev,
      position_requirements: {
        ...prev.position_requirements,
        [position]: {
          ...prev.position_requirements[position],
          [field]: parseInt(value) || 0
        }
      }
    }));
  };

  const validateCurrentStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.league_name || formData.league_name.length < 3) {
          setError('League name must be at least 3 characters long');
          return false;
        }
        break;
      case 2:
        if (formData.scoring_categories.hitters.length === 0) {
          setError('Please select at least one hitting category');
          return false;
        }
        if (formData.scoring_categories.pitchers.length === 0) {
          setError('Please select at least one pitching category');
          return false;
        }
        break;
      case 3:
        if (formData.max_players_total < 15 || formData.max_players_total > 40) {
          setError('Total players must be between 15 and 40');
          return false;
        }
        break;
      case 4:
        if (formData.use_salaries && formData.use_dual_cap) {
          if (formData.draft_cap <= 0) {
            setError('Draft cap must be greater than 0');
            return false;
          }
        }
        break;
      case 5:
        if (formData.season_start_date && formData.season_end_date) {
          const startDate = new Date(formData.season_start_date);
          const endDate = new Date(formData.season_end_date);
          if (startDate >= endDate) {
            setError('Season end date must be after start date');
            return false;
          }
        }
        break;
    }
    setError('');
    return true;
  };

  // Status polling function
  const pollLeagueStatus = async (leagueId) => {
    try {
      const statusResponse = await leaguesAPI.checkLeagueCreationStatus(leagueId);
      
      if (statusResponse && statusResponse.status) {
        setCreationStatus(statusResponse);
        
        if (statusResponse.status === 'completed') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          
          setTimeout(() => {
            setIsCreating(false);
            navigate(`/leagues/${leagueId}/welcome`);
          }, 2000);
          
        } else if (statusResponse.status === 'failed') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          
          setError(statusResponse.message || statusResponse.error || 'League creation failed');
          setIsCreating(false);
        }
      }
    } catch (error) {
      console.error('Status polling error:', error);
    }
  };

  const handleSubmit = async (formData) => {
    if (!validateCurrentStep(5)) {
      return;
    }

    setIsCreating(true);
    setError('');
    setCreationStatus({ status: 'initializing', progress: 5, message: 'Starting league creation...' });
    
    try {
      console.log('Creating league with data:', formData);
      
      const response = await leaguesAPI.createLeague(formData);
      
      if (response.success && response.league_id) {
        const interval = setInterval(() => {
          pollLeagueStatus(response.league_id);
        }, 3000);
        
        setPollingInterval(interval);
        pollLeagueStatus(response.league_id);
        
      } else {
        throw new Error(response.message || 'Failed to start league creation');
      }
    } catch (error) {
      console.error('League creation error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create league';
      setError(errorMessage);
      setIsCreating(false);
      setCreationStatus(null);
    }
  };

  return {
    formData,
    isCreating,
    error,
    creationStatus,
    handleInputChange,
    handleCategoryChange,
    handlePositionChange,
    validateCurrentStep,
    handleSubmit,
    setError
  };
};