// src/components/league-creation/dialogs/CancelConfirmationDialog.js
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { dynastyTheme } from '../../../services/colorService';

const CancelConfirmationDialog = ({ isVisible, onConfirm, onCancel }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className={`${dynastyTheme.components.card.base} border ${dynastyTheme.classes.border.neutral} max-w-md w-full`}
           style={{ 
             borderRadius: dynastyTheme.tokens.radius.lg,
             padding: dynastyTheme.tokens.spacing.xl
           }}>
        
        {/* Header */}
        <div className="text-center" style={{ marginBottom: dynastyTheme.tokens.spacing.lg }}>
          <div 
            className={`flex items-center justify-center mx-auto ${dynastyTheme.classes.bg.warning} ${dynastyTheme.classes.shadow.base}`}
            style={{ 
              width: '3rem', 
              height: '3rem',
              borderRadius: dynastyTheme.tokens.radius.lg,
              marginBottom: dynastyTheme.tokens.spacing.md 
            }}
          >
            <AlertTriangle className={`${dynastyTheme.classes.text.black}`} 
                          style={{ width: '1.5rem', height: '1.5rem' }} />
          </div>
          
          <h3 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white} mb-4`}>
            Cancel League Creation?
          </h3>
        </div>

        {/* Warning Message */}
        <div className={`${dynastyTheme.classes.bg.warning}/10 border ${dynastyTheme.classes.border.warning}/30 mb-6`}
             style={{ 
               borderRadius: dynastyTheme.tokens.radius.md,
               padding: dynastyTheme.tokens.spacing.md
             }}>
          <p className={`${dynastyTheme.classes.text.neutralLight} mb-2`}>
            Are you sure you want to cancel? All your configuration will be lost:
          </p>
          <ul className={`${dynastyTheme.classes.text.neutralLight} text-sm space-y-1 ml-4`}>
            <li>• League name and basic settings</li>
            <li>• Scoring categories selection</li>
            <li>• Roster position requirements</li>
            <li>• Financial and salary configuration</li>
            <li>• Advanced league settings</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}
          >
            Continue Editing
          </button>
          <button
            onClick={onConfirm}
            className={`${dynastyTheme.utils.getComponent('button', 'ghost', 'md')} ${dynastyTheme.classes.text.error} hover:bg-red-500/20`}
          >
            Cancel Creation
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelConfirmationDialog;