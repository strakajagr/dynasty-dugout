// src/components/league-dashboard/TeamLinkDropdown.js - SIMPLIFIED WITHOUT COMMISSIONER CONTEXT
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Users, BarChart3 } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

const TeamLinkDropdown = ({ team, leagueId, className = '' }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    const handleScroll = () => {
      if (showDropdown && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 2,
          left: rect.left
        });
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      
      // Update position when dropdown opens
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 2,
          left: rect.left
        });
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showDropdown]);

  const handleTeamClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 2,
        left: rect.left
      });
    }
    
    setShowDropdown(!showDropdown);
  };

  const handleNavigate = (section) => {
    // Close dropdown immediately for better UX
    setShowDropdown(false);
    
    // Navigate to the league page with the appropriate section and team info
    navigate(`/leagues/${leagueId}`, { 
      state: { 
        activeSection: section,
        targetTeamId: team.team_id,
        targetTeamName: team.team_name
      }
    });
  };

  // Render dropdown using portal to escape overflow containers
  const dropdownContent = showDropdown && ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      className={`fixed z-[9999] ${dynastyTheme.classes.bg.darkFlat} border ${dynastyTheme.classes.border.primary} rounded shadow-xl overflow-hidden`}
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        minWidth: '120px'
      }}
    >
      <button
        onClick={() => handleNavigate('my-roster')}
        className={`w-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-yellow-400/20 ${dynastyTheme.classes.text.white} hover:${dynastyTheme.classes.text.primary} transition-all duration-150 text-left text-xs`}
      >
        <Users className="w-3 h-3" />
        <span>Roster</span>
      </button>
      
      <button
        onClick={() => handleNavigate('team-stats')}
        className={`w-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-yellow-400/20 ${dynastyTheme.classes.text.white} hover:${dynastyTheme.classes.text.primary} transition-all duration-150 text-left text-xs border-t ${dynastyTheme.classes.border.neutral}`}
      >
        <BarChart3 className="w-3 h-3" />
        <span>Stats</span>
      </button>
    </div>,
    document.body // Render to body instead of inside table
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleTeamClick}
        className={`${className} hover:${dynastyTheme.classes.text.primary} transition-colors duration-150 cursor-pointer relative`}
      >
        {team.team_name}
        {showDropdown && (
          <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-yellow-400"></span>
        )}
      </button>
      {dropdownContent}
    </>
  );
};

export default TeamLinkDropdown;