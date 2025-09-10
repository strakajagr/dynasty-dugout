// src/components/auth/InteractionBlocker.js
import React from 'react';

const InteractionBlocker = ({ onInteractionAttempt, isActive }) => {
  const handleInteraction = (e) => {
    if (isActive) {
      e.preventDefault();
      e.stopPropagation();
      onInteractionAttempt();
    }
  };

  if (!isActive) return null;

  return (
    <div 
      className="fixed inset-0 z-40 cursor-pointer"
      onClick={handleInteraction}
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
      style={{ 
        background: 'transparent',
        pointerEvents: 'all'
      }}
      title="Sign up to interact with the dashboard"
    />
  );
};

export default InteractionBlocker;