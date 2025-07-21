// src/components/LoadingSpinner.js
import React from 'react';
import { Crown } from 'lucide-react';

const LoadingSpinner = ({ message = "Loading Dynasty Dugout..." }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          {/* Spinning crown icon */}
          <Crown className="w-16 h-16 text-yellow-500 animate-spin mx-auto mb-4" />
          
          {/* Loading dots */}
          <div className="flex justify-center space-x-1 mb-4">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>
        
        <p className="text-lg text-white font-medium">{message}</p>
        <p className="text-gray-400 mt-2">Building your dynasty...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;