// src/services/colorService.js

/**
 * Dynasty Dugout Centralized Color and Style Service
 * 
 * This service provides consistent colors, styles, and utility functions
 * for all components across the Dynasty Dugout application.
 */

// Dynasty Dugout Brand Colors - HEX values
export const dynastyColors = {
  // Primary brand colors
  gold: '#eab308',
  goldHover: '#facc15',
  goldDark: '#ca8a04',
  goldLight: 'rgba(234, 179, 8, 0.1)',
  
  // Neutral colors
  dark: '#272727ff',
  darkLighter: '#363637ff',
  gray: '#4b4b4cff',
  lightGray: '#767676ff',
  white: '#ffffff',
  black: '#000000',
  
  // Status colors
  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.1)',
  successDark: '#064e3b',
  error: '#ef4444',
  errorLight: 'rgba(239, 68, 68, 0.1)',
  errorDark: '#7f1d1d',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.1)',
  info: '#3b82f6',
  infoLight: 'rgba(59, 130, 246, 0.1)'
};

// CSS Class mappings for Dynasty colors
export const dynastyClasses = {
  // Background classes
  backgrounds: {
    primary: 'bg-dynasty-gold',
    primaryHover: 'hover:bg-dynasty-gold-hover',
    primaryLight: 'bg-dynasty-gold-light',
    dark: 'bg-dynasty-dark',
    gradient: 'bg-dynasty-gradient',
    card: 'dynasty-card'
  },
  
  // Text classes
  text: {
    primary: 'text-dynasty-gold',
    primaryHover: 'hover:text-dynasty-gold-hover',
    white: 'text-white',
    gray: 'text-dynasty-gray',
    lightGray: 'text-dynasty-light-gray'
  },
  
  // Border classes
  borders: {
    primary: 'border-dynasty-gold',
    gray: 'border-dynasty-gray',
    light: 'border-dynasty-gold/20'
  },
  
  // Icon classes
  icons: {
    primary: 'icon-dynasty-gold',
    white: 'icon-dynasty-white'
  }
};

// Pre-built component style combinations
export const dynastyComponents = {
  // Button variants
  buttons: {
    primary: 'btn-dynasty-primary',
    secondary: 'btn-dynasty-secondary',
    primaryWithGlow: 'btn-dynasty-primary dynasty-glow',
    
    // Size variants
    small: 'dynasty-padding-sm',
    medium: 'dynasty-padding-md', 
    large: 'dynasty-padding-lg'
  },
  
  // Tab system with proper contrast
  tabs: {
    container: {
      display: 'flex',
      marginBottom: '2rem',
      borderBottom: `2px solid ${dynastyColors.gray}`
    },
    activeTab: {
      backgroundColor: dynastyColors.gold,
      color: dynastyColors.black,  // This should be black for contrast
      border: `2px solid ${dynastyColors.gold}`,
      borderBottom: 'none',
      padding: '1rem 2rem',
      fontSize: '1rem',
      fontWeight: '700',
      borderRadius: '0.75rem 0.75rem 0 0',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      marginRight: '4px',
      position: 'relative',
      zIndex: 2,
      boxShadow: '0 4px 12px rgba(234, 179, 8, 0.3)'
    },
    inactiveTab: {
      backgroundColor: dynastyColors.darkLighter,
      color: dynastyColors.gold,
      border: `2px solid ${dynastyColors.gold}`,
      borderBottom: 'none',
      padding: '1rem 2rem',
      fontSize: '1rem',
      fontWeight: '600',
      borderRadius: '0.75rem 0.75rem 0 0',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      marginRight: '4px',
      position: 'relative',
      zIndex: 1
    },
    // CSS classes for tabs (alternative approach)
    classes: {
      container: 'dynasty-tab-container',
      active: 'dynasty-tab-active',
      inactive: 'dynasty-tab-inactive'
    }
  },
  
  // Input styles
  inputs: {
    default: 'dynasty-input',
    withIcon: 'dynasty-input pl-10'
  },
  
  // Card styles
  cards: {
    default: 'dynasty-card',
    interactive: 'dynasty-card hover:border-dynasty-gold/50 transition-all duration-300',
    feature: 'dynasty-card dynasty-padding-lg'
  },
  
  // Table styles
  tables: {
    wrapper: 'dynasty-table',
    headerCell: 'dynasty-table th',
    bodyCell: 'dynasty-table td',
    row: 'dynasty-table tr'
  },
  
  // Status indicators
  status: {
    available: 'status-available',
    unavailable: 'status-unavailable'
  },
  
  // Message boxes
  messages: {
    success: {
      backgroundColor: dynastyColors.successDark,
      color: dynastyColors.success,
      border: `1px solid ${dynastyColors.success}`,
      padding: '1rem',
      borderRadius: '0.75rem',
      marginBottom: '1.5rem'
    },
    error: {
      backgroundColor: dynastyColors.errorDark,
      color: dynastyColors.error,
      border: `1px solid ${dynastyColors.error}`,
      padding: '1rem',
      borderRadius: '0.75rem',
      marginBottom: '1.5rem'
    },
    info: {
      backgroundColor: dynastyColors.darkLighter,
      color: dynastyColors.lightGray,
      border: `1px solid ${dynastyColors.gold}`,
      padding: '1rem',
      borderRadius: '0.75rem',
      marginBottom: '1.5rem'
    }
  }
};

// Utility functions for dynamic styling
export const dynastyUtils = {
  /**
   * Get button classes based on variant and size
   * @param {string} variant - 'primary' | 'secondary' 
   * @param {string} size - 'sm' | 'md' | 'lg'
   * @param {boolean} withGlow - Add glow effect
   * @returns {string} Combined CSS classes
   */
  getButtonClasses: (variant = 'primary', size = 'md', withGlow = false) => {
    const baseClass = dynastyComponents.buttons[variant];
    const sizeClass = dynastyComponents.buttons[size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'medium'];
    const glowClass = withGlow ? 'dynasty-glow' : '';
    
    return `${baseClass} ${sizeClass} ${glowClass}`.trim();
  },

  /**
   * Get tab styles based on active state
   * @param {boolean} isActive - Whether the tab is active
   * @returns {object} Style object for tabs
   */
  getTabStyles: (isActive) => {
    return isActive ? dynastyComponents.tabs.activeTab : dynastyComponents.tabs.inactiveTab;
  },

  /**
   * Get tab classes based on active state (alternative approach)
   * @param {boolean} isActive - Whether the tab is active
   * @returns {string} CSS classes for tabs
   */
  getTabClasses: (isActive) => {
    return isActive ? dynastyComponents.tabs.classes.active : dynastyComponents.tabs.classes.inactive;
  },

  /**
   * Get card classes based on type
   * @param {string} type - 'default' | 'interactive' | 'feature'
   * @returns {string} Combined CSS classes
   */
  getCardClasses: (type = 'default') => {
    return dynastyComponents.cards[type] || dynastyComponents.cards.default;
  },

  /**
   * Get message box styles based on type
   * @param {string} type - 'success' | 'error' | 'info'
   * @returns {object} Style object for message boxes
   */
  getMessageStyles: (type) => {
    return dynastyComponents.messages[type] || dynastyComponents.messages.info;
  },

  /**
   * Get status indicator classes
   * @param {string} status - 'available' | 'unavailable' | 'success' | 'error' | 'warning' | 'info'
   * @returns {string} CSS classes for status
   */
  getStatusClasses: (status) => {
    const statusMap = {
      'available': dynastyComponents.status.available,
      'unavailable': dynastyComponents.status.unavailable,
      'success': dynastyComponents.status.available,
      'error': dynastyComponents.status.unavailable,
      'warning': 'bg-yellow-500 text-black px-2 py-1 rounded text-xs font-semibold',
      'info': 'bg-blue-500 text-white px-2 py-1 rounded text-xs font-semibold'
    };
    
    return statusMap[status] || statusMap.available;
  },

  /**
   * Get icon classes based on color
   * @param {string} color - 'primary' | 'white' | 'gray'
   * @returns {string} Icon CSS classes
   */
  getIconClasses: (color = 'primary') => {
    const iconMap = {
      'primary': dynastyClasses.icons.primary,
      'white': dynastyClasses.icons.white,
      'gray': 'text-dynasty-gray'
    };
    
    return iconMap[color] || iconMap.primary;
  },

  /**
   * Generate consistent spacing classes
   * @param {string} type - 'margin' | 'padding'
   * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
   * @returns {string} Spacing CSS class
   */
  getSpacingClass: (type, size) => {
    return `dynasty-${type}-${size}`;
  },

  /**
   * Generate consistent shadows
   * @param {string} intensity - 'light' | 'medium' | 'heavy' | 'gold'
   * @returns {string} Box shadow CSS value
   */
  getShadow: (intensity = 'medium') => {
    const shadows = {
      light: '0 2px 8px rgba(0, 0, 0, 0.1)',
      medium: '0 4px 12px rgba(0, 0, 0, 0.15)',
      heavy: '0 8px 32px rgba(0, 0, 0, 0.3)',
      gold: '0 4px 12px rgba(234, 179, 8, 0.3)'
    };
    return shadows[intensity] || shadows.medium;
  },

  /**
   * Generate consistent gradients
   * @param {string} type - 'card' | 'gold' | 'dark' | 'page'
   * @returns {string} CSS gradient value
   */
  getGradient: (type = 'card') => {
    const gradients = {
      card: `linear-gradient(135deg, ${dynastyColors.dark} 0%, rgba(26, 32, 46, 0.8) 100%)`,
      gold: `linear-gradient(135deg, ${dynastyColors.gold} 0%, ${dynastyColors.goldHover} 100%)`,
      dark: `linear-gradient(135deg, ${dynastyColors.dark} 0%, ${dynastyColors.gray} 100%)`,
      page: `linear-gradient(135deg, ${dynastyColors.dark} 0%, ${dynastyColors.gray} 100%)`
    };
    return gradients[type] || gradients.card;
  }
};

// Theme configuration object for easy customization
export const dynastyTheme = {
  colors: dynastyColors,
  classes: dynastyClasses,
  components: dynastyComponents,
  utils: dynastyUtils,
  
  // Quick access to commonly used combinations
  common: {
    pageBackground: 'min-h-screen bg-dynasty-gradient',
    headerBackground: 'bg-black/50 backdrop-blur-sm border-b border-dynasty-gold/20',
    cardHover: 'hover:border-dynasty-gold/50 transition-all duration-300',
    focusRing: 'focus:outline-none focus:ring-2 focus:ring-dynasty-gold focus:ring-offset-2',
    textGradient: 'bg-gradient-to-r from-dynasty-gold to-dynasty-gold-hover bg-clip-text text-transparent'
  },
  
  // Global overrides for Tailwind interference
  globalOverrides: {
    // CSS to inject globally to override Tailwind
    css: `
      /* Dynasty Dugout Global Overrides - Anti-Tailwind */
      .dynasty-tab-custom:focus,
      .dynasty-tab-custom:active,
      .dynasty-tab-custom:hover {
        outline: none !important;
      }
      
      /* Remove all blue focus states globally */
      button:focus,
      input:focus,
      select:focus,
      textarea:focus {
        outline: none !important;
        border-color: ${dynastyColors.gold} !important;
        box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.2) !important;
      }
      
      /* Force Dynasty colors over Tailwind defaults */
      .dynasty-tab-active {
        background-color: ${dynastyColors.gold} !important;
        color: #000000 !important;
        border-color: ${dynastyColors.gold} !important;
      }
      
      .dynasty-tab-inactive {
        background-color: ${dynastyColors.darkLighter} !important;
        color: ${dynastyColors.gold} !important;
        border-color: ${dynastyColors.gold} !important;
      }
      
      /* Override any blue colors with Dynasty grays */
      .text-blue-500,
      .text-blue-600,
      .text-blue-700 {
        color: ${dynastyColors.lightGray} !important;
      }
      
      .bg-blue-500,
      .bg-blue-600,
      .bg-blue-700 {
        background-color: ${dynastyColors.gray} !important;
      }
      
      .border-blue-500,
      .border-blue-600,
      .border-blue-700 {
        border-color: ${dynastyColors.gray} !important;
      }
    `
  },
  
  // Predefined layouts
  layouts: {
    page: {
      background: dynastyUtils.getGradient('page'),
      minHeight: '100vh',
      padding: '2rem'
    },
    container: {
      maxWidth: '800px',
      margin: '0 auto'
    },
    header: {
      marginBottom: '3rem',
      textAlign: 'center',
      padding: '2rem',
      background: dynastyUtils.getGradient('card'),
      borderRadius: '1rem',
      border: `1px solid ${dynastyColors.gold}`,
      boxShadow: dynastyUtils.getShadow('gold')
    },
    title: {
      color: dynastyColors.gold,
      fontSize: '3rem',
      fontWeight: '700',
      marginBottom: '1rem',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
      background: dynastyUtils.getGradient('gold'),
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text'
    },
    subtitle: {
      color: dynastyColors.lightGray,
      fontSize: '1.2rem',
      fontWeight: '400',
      opacity: '0.9',
      maxWidth: '600px',
      margin: '0 auto'
    }
  }
};

// Export everything for easy importing
export default dynastyTheme;