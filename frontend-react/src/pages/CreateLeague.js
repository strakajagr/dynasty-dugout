// src/pages/CreateLeague.js - Main Coordinator Component
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Crown, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dynastyTheme } from '../services/colorService';

// Import modular components
import StepNavigation from '../components/league-creation/StepNavigation';
import BasicInfoStep from '../components/league-creation/steps/BasicInfoStep';
import ScoringStep from '../components/league-creation/steps/ScoringStep';
import RosterStep from '../components/league-creation/steps/RosterStep';
import FinancialStep from '../components/league-creation/steps/FinancialStep';
import AdvancedStep from '../components/league-creation/steps/AdvancedStep';
import DatabaseCreationDialog from '../components/league-creation/dialogs/DatabaseCreationDialog';
import CancelConfirmationDialog from '../components/league-creation/dialogs/CancelConfirmationDialog';
import { useLeagueCreation } from '../hooks/useLeagueCreation';

const CreateLeague = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  const {
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
  } = useLeagueCreation();

  const steps = [
    { id: 1, title: 'Basic Info', component: BasicInfoStep },
    { id: 2, title: 'Scoring', component: ScoringStep },
    { id: 3, title: 'Rosters', component: RosterStep },
    { id: 4, title: 'Financial', component: FinancialStep },
    { id: 5, title: 'Advanced', component: AdvancedStep }
  ];

  const nextStep = () => {
    if (validateCurrentStep(currentStep) && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(''); // Clear errors when going back
    }
  };

  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    navigate('/dashboard');
  };

  const renderCurrentStep = () => {
    const StepComponent = steps[currentStep - 1].component;
    return (
      <StepComponent
        formData={formData}
        onInputChange={handleInputChange}
        onCategoryChange={handleCategoryChange}
        onPositionChange={handlePositionChange}
        error={error}
      />
    );
  };

  return (
    <div className={dynastyTheme.components.page}>
      {/* Cancel Confirmation Dialog */}
      <CancelConfirmationDialog 
        isVisible={showCancelDialog}
        onConfirm={confirmCancel}
        onCancel={() => setShowCancelDialog(false)}
      />

      {/* Database Creation Dialog */}
      <DatabaseCreationDialog 
        isVisible={isCreating} 
        statusData={creationStatus}
        onClose={() => {
          // Handle close logic in hook
        }} 
      />

      {/* Header */}
      <div className={`border-b ${dynastyTheme.components.card.base} ${dynastyTheme.classes.border.light}`}>
        <div className="max-w-4xl mx-auto" style={{ padding: `${dynastyTheme.tokens.spacing.md} ${dynastyTheme.tokens.spacing.lg}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: dynastyTheme.tokens.spacing.md }}>
              <button
                onClick={() => navigate('/dashboard')}
                className={`flex items-center ${dynastyTheme.classes.transition} ${dynastyTheme.classes.text.neutralLight} hover:text-white`}
                style={{ gap: dynastyTheme.tokens.spacing.sm }}
              >
                <ChevronLeft style={{ width: '1.25rem', height: '1.25rem' }} />
                <span>Back to Dashboard</span>
              </button>
              <div className={dynastyTheme.classes.bg.neutral} style={{ width: '1px', height: '1.5rem' }}></div>
              <h1 className={`font-bold ${dynastyTheme.classes.text.white} flex items-center`} 
                  style={{ fontSize: dynastyTheme.tokens.fontSize.xl, gap: dynastyTheme.tokens.spacing.sm }}>
                <Crown className={dynastyTheme.classes.text.primary} style={{ width: '1.5rem', height: '1.5rem' }} />
                <span>Create New League</span>
              </h1>
            </div>
            <button
              onClick={handleCancel}
              className={`${dynastyTheme.utils.getComponent('button', 'ghost', 'sm')} ${dynastyTheme.classes.text.error}`}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-4xl mx-auto" 
           style={{ padding: `${dynastyTheme.tokens.spacing['2xl']} ${dynastyTheme.tokens.spacing.lg}` }}>
        
        {/* Step Navigation */}
        <StepNavigation 
          steps={steps.map(s => ({ id: s.id, title: s.title }))}
          currentStep={currentStep}
        />

        {/* Error Display */}
        {error && (
          <div 
            className={`${dynastyTheme.classes.bg.error}/20 border ${dynastyTheme.classes.border.error}`}
            style={{ 
              borderRadius: dynastyTheme.tokens.radius.md,
              padding: dynastyTheme.tokens.spacing.md,
              marginBottom: dynastyTheme.tokens.spacing.lg
            }}
          >
            <p className={dynastyTheme.classes.text.error} style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
              {error}
            </p>
          </div>
        )}

        {/* Step Content */}
        <div 
          className={`${dynastyTheme.components.card.base} border ${dynastyTheme.classes.border.neutral}`}
          style={{ 
            borderRadius: dynastyTheme.tokens.radius.lg,
            padding: dynastyTheme.tokens.spacing['2xl']
          }}
        >
          {renderCurrentStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between" style={{ marginTop: dynastyTheme.tokens.spacing['2xl'] }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`${
              currentStep === 1 
                ? `${dynastyTheme.utils.getComponent('button', 'ghost', 'md')} opacity-50 cursor-not-allowed`
                : dynastyTheme.utils.getComponent('button', 'secondary', 'md')
            } flex items-center`}
            style={{ gap: dynastyTheme.tokens.spacing.sm }}
          >
            <ChevronLeft style={{ width: '1rem', height: '1rem' }} />
            <span>Previous</span>
          </button>

          {currentStep === 5 ? (
            <button
              onClick={() => handleSubmit(formData)}
              disabled={isCreating || !formData.league_name}
              className={`${
                isCreating || !formData.league_name 
                  ? `${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} opacity-50 cursor-not-allowed`
                  : dynastyTheme.utils.getComponent('button', 'primary', 'lg')
              } flex items-center`}
              style={{ gap: dynastyTheme.tokens.spacing.sm }}
            >
              {isCreating ? (
                <>
                  <Crown className="animate-pulse" style={{ width: '1rem', height: '1rem' }} />
                  <span>Creating League...</span>
                </>
              ) : (
                <>
                  <Crown style={{ width: '1rem', height: '1rem' }} />
                  <span>Create League</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={nextStep}
              className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} flex items-center`}
              style={{ gap: dynastyTheme.tokens.spacing.sm }}
            >
              <span>Next</span>
              <ChevronLeft className="rotate-180" style={{ width: '1rem', height: '1rem' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateLeague;