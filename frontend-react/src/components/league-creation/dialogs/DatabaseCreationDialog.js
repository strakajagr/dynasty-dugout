// src/components/league-creation/dialogs/DatabaseCreationDialog.js
import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Database, Loader } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';

const DatabaseCreationDialog = ({ isVisible, statusData, onClose }) => {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setTimeElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  const progress = statusData?.progress || (statusData?.status === 'completed' ? 100 : 5);
  const currentMessage = statusData?.message || "Preparing league creation...";
  const isFailed = statusData?.status === 'failed';
  const isCompleted = statusData?.status === 'completed';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" 
         style={{ padding: dynastyTheme.tokens.spacing.md }}>
      <div className={`${dynastyTheme.components.card.base} border ${dynastyTheme.classes.border.primary} max-w-md w-full`} 
           style={{ 
             borderRadius: dynastyTheme.tokens.radius.lg,
             padding: dynastyTheme.tokens.spacing['2xl']
           }}>
        
        {/* Header */}
        <div className="text-center" style={{ marginBottom: dynastyTheme.tokens.spacing['2xl'] }}>
          <div 
            className={`flex items-center justify-center mx-auto ${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.shadow.primary}`}
            style={{ 
              width: '4rem', 
              height: '4rem',
              borderRadius: dynastyTheme.tokens.radius.lg,
              marginBottom: dynastyTheme.tokens.spacing.md 
            }}
          >
            {isFailed ? (
              <AlertCircle className={`${dynastyTheme.classes.text.error} animate-pulse`} 
                          style={{ width: '2rem', height: '2rem' }} />
            ) : isCompleted ? (
              <CheckCircle className={`${dynastyTheme.classes.text.black}`} 
                          style={{ width: '2rem', height: '2rem' }} />
            ) : (
              <Database className={`${dynastyTheme.classes.text.black} animate-pulse`} 
                       style={{ width: '2rem', height: '2rem' }} />
            )}
          </div>
          
          <h2 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white}`} 
              style={{ fontSize: dynastyTheme.tokens.fontSize['2xl'], marginBottom: dynastyTheme.tokens.spacing.sm }}>
            {isFailed ? 'Creation Failed' : 
             isCompleted ? 'League Created!' : 'Creating Your League'}
          </h2>
          
          <p className={`${dynastyTheme.classes.text.neutralLight}`} 
             style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
            {isFailed 
              ? 'Something went wrong during creation' 
              : isCompleted 
              ? 'Redirecting you to your new league...'
              : 'Please be patient, this process takes 1-2 minutes'
            }
          </p>
          
          <div className={`${dynastyTheme.classes.text.primary} font-mono`} 
               style={{ fontSize: dynastyTheme.tokens.fontSize.lg, marginTop: dynastyTheme.tokens.spacing.sm }}>
            {formatTime(statusData?.elapsed_seconds || timeElapsed)}
          </div>
        </div>

        {/* Error Display */}
        {isFailed && (
          <div className={`${dynastyTheme.classes.bg.error}/20 border ${dynastyTheme.classes.border.error}`}
               style={{ 
                 borderRadius: dynastyTheme.tokens.radius.md,
                 padding: dynastyTheme.tokens.spacing.md,
                 marginBottom: dynastyTheme.tokens.spacing.lg
               }}>
            <p className={`${dynastyTheme.classes.text.error}`} style={{ fontSize: dynastyTheme.tokens.fontSize.sm }}>
              {statusData.message || statusData.error || 'An unknown error occurred'}
            </p>
            <button
              onClick={onClose}
              className={dynastyTheme.utils.getComponent('button', 'secondary', 'sm')}
              style={{ marginTop: dynastyTheme.tokens.spacing.sm }}
            >
              Close
            </button>
          </div>
        )}

        {/* Progress Section */}
        {!isFailed && (
          <>
            <div style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
              <p className={`font-medium text-center ${dynastyTheme.classes.text.white}`} 
                 style={{ fontSize: dynastyTheme.tokens.fontSize.sm, marginBottom: dynastyTheme.tokens.spacing.sm }}>
                {currentMessage}
              </p>
              <div className={`${dynastyTheme.classes.bg.neutral} overflow-hidden`}
                   style={{ 
                     width: '100%', 
                     height: '0.5rem',
                     borderRadius: dynastyTheme.tokens.radius.full,
                   }}>
                <div 
                  className={`h-full ${dynastyTheme.classes.bg.primary} transition-all duration-1000 ease-out`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                ></div>
              </div>
            </div>

            {/* Info Box */}
            <div className={`${dynastyTheme.classes.bg.primary}/10 border ${dynastyTheme.classes.border.primary}/30`}
                 style={{ 
                   borderRadius: dynastyTheme.tokens.radius.md,
                   padding: dynastyTheme.tokens.spacing.md
                 }}>
              <div className={`${dynastyTheme.classes.text.neutralLight} leading-relaxed`} 
                   style={{ fontSize: dynastyTheme.tokens.fontSize.xs }}>
                <p style={{ marginBottom: dynastyTheme.tokens.spacing.sm }}>
                  <strong className={dynastyTheme.classes.text.white}>What's happening:</strong> We're setting up your shared league database with 5,000+ MLB players and calculating initial pricing.
                </p>
                <p>
                  <strong className={dynastyTheme.classes.text.white}>Why it takes time:</strong> Each league gets comprehensive stats, rolling averages, and dynamic pricing based on your specific scoring categories.
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="text-center" style={{ marginTop: dynastyTheme.tokens.spacing.lg }}>
              <p className={dynastyTheme.classes.text.neutralLight} style={{ fontSize: dynastyTheme.tokens.fontSize.xs }}>
                ⚠️ Please don't close this window or navigate away
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DatabaseCreationDialog;