// src/components/LoadingSpinner.js
import React from 'react';
import { Crown } from 'lucide-react';
import { dynastyTheme } from '../services/colorService';

const LoadingSpinner = ({ message = "Loading Dynasty Dugout..." }) => {
  return (
    <div className={dynastyTheme.components.page + " flex items-center justify-center"}>
      <div className="text-center">
        <div className="relative">
          {/* Spinning crown icon */}
          <Crown className={`w-16 h-16 ${dynastyTheme.classes.text.primary} animate-spin mx-auto mb-4`} />
          
          {/* Loading dots */}
          <div className="flex justify-center space-x-1 mb-4">
            <div className={`w-2 h-2 ${dynastyTheme.classes.bg.primary} rounded-full animate-bounce`}></div>
            <div className={`w-2 h-2 ${dynastyTheme.classes.bg.primary} rounded-full animate-bounce`} style={{animationDelay: '0.1s'}}></div>
            <div className={`w-2 h-2 ${dynastyTheme.classes.bg.primary} rounded-full animate-bounce`} style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>
        
        <p className={`text-lg ${dynastyTheme.classes.text.white} font-medium`}>{message}</p>
        <p className={`${dynastyTheme.classes.text.neutralLight} mt-2`}>Building your dynasty...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;