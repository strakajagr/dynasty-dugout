// src/components/league-creation/StepNavigation.js
import React from 'react';
import { Crown, Trophy, Users, DollarSign, Settings, Check } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

const stepIcons = {
  1: Crown,
  2: Trophy, 
  3: Users,
  4: DollarSign,
  5: Settings
};

const StepNavigation = ({ steps, currentStep }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = stepIcons[step.id] || Crown;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center">
                <div 
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-colors
                    ${isActive 
                      ? `${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black}` 
                      : isCompleted 
                      ? `bg-emerald-500 ${dynastyTheme.classes.text.white}` 
                      : `${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralLight}`
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="ml-3">
                  <div className={`text-sm font-medium ${
                    isActive ? dynastyTheme.classes.text.primary :
                    isCompleted ? dynastyTheme.classes.text.success :
                    dynastyTheme.classes.text.neutralLight
                  }`}>
                    Step {step.id}
                  </div>
                  <div className={`text-xs ${
                    isActive ? dynastyTheme.classes.text.white :
                    isCompleted ? dynastyTheme.classes.text.success :
                    dynastyTheme.classes.text.neutralDark
                  }`}>
                    {step.title}
                  </div>
                </div>
              </div>

              {/* Connection Line */}
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  isCompleted ? 'bg-emerald-500' : dynastyTheme.classes.bg.neutral
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default StepNavigation;