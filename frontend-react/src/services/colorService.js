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
  goldLight: 'rgba(234, 179, 8, 0.1)',
  
  // Neutral colors
  dark: '#111827',
  gray: '#374151',
  lightGray: '#6b7280',
  white: '#ffffff',
  black: '#000000',
  
  // Status colors
  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.1)',
  error: '#ef4444',
  errorLight: 'rgba(239, 68, 68, 0.1)',
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
   * Get card classes based on type
   * @param {string} type - 'default' | 'interactive' | 'feature'
   * @returns {string} Combined CSS classes
   */
  getCardClasses: (type = 'default') => {
    return dynastyComponents.cards[type] || dynastyComponents.cards.default;
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
  }
};

// Export everything for easy importing
export default dynastyTheme;