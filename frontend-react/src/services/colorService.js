// src/services/colorService.js

/**
 * Dynasty Dugout Design System
 * Single source of truth for all colors, styles, and components
 * Best practices: semantic naming, component-based architecture, minimal hardcoding
 */

// === CORE DESIGN TOKENS ===
export const dynastyTokens = {
  // Brand Colors
  colors: {
    // Primary Dynasty brand
    primary: '#eab308',
    primaryHover: '#facc15',
    primaryDark: '#ca8a04',
    primaryLight: 'rgba(234, 179, 8, 0.1)',
    
    // Updated (Stone - warmer, no blue tint)
    neutral: {
      50: '#fafaf9',
      100: '#f5f5f4', 
      200: '#e7e5e4',
      300: '#d6d3d1',
      400: '#a8a29e',
      500: '#78716c',
      600: '#57534e',
      700: '#44403c',
      800: '#292524',
      900: '#1c1917',
      950: '#0c0a09'
    },
    
    // Semantic colors
    success: '#10b981',
    error: '#ef4444', 
    warning: '#f59e0b',
    info: '#3b82f6'
  },
  
  // Spacing scale
  spacing: {
    xs: '0.5rem',   // 8px
    sm: '0.75rem',  // 12px  
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    '2xl': '3rem'   // 48px
  },
  
  // Typography scale
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem', 
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem'
  },
  
  // Border radius
  radius: {
    none: '0',
    sm: '0.125rem',
    base: '0.375rem', 
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px'
  }
};

// === CSS UTILITY CLASSES ===
export const dynastyClasses = {
  // Backgrounds
  bg: {
    primary: 'bg-yellow-400',
    primaryHover: 'hover:bg-yellow-300',
    primaryLight: 'bg-yellow-400/10',
    
    dark: 'bg-neutral-900',
    darkLighter: 'bg-neutral-800',
    light: 'bg-neutral-50',
    
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  },
  
  // Text colors
  text: {
    primary: 'text-yellow-400',
    primaryHover: 'hover:text-yellow-300',
    
    white: 'text-white',
    black: 'text-black',
    neutral: 'text-neutral-600',
    neutralLight: 'text-neutral-500',
    neutralLighter: 'text-neutral-400',
    
    success: 'text-emerald-500',
    error: 'text-red-500', 
    warning: 'text-amber-500',
    info: 'text-blue-500'
  },
  
  // Borders
  border: {
    primary: 'border-yellow-400',
    neutral: 'border-neutral-600',
    light: 'border-yellow-400/20'
  },
  
  // Common utilities
  transition: 'transition-all duration-300 ease-in-out',
  focus: 'focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-neutral-900',
  shadow: {
    sm: 'shadow-sm',
    base: 'shadow-md',
    lg: 'shadow-lg',
    primary: 'shadow-lg shadow-yellow-400/20'
  }
};

// === PRE-BUILT COMPONENTS ===
export const dynastyComponents = {
  // Buttons
  button: {
    primary: `${dynastyClasses.bg.primary} ${dynastyClasses.text.black} font-semibold rounded-lg ${dynastyClasses.transition} ${dynastyClasses.focus} ${dynastyClasses.shadow.primary} hover:shadow-xl`,
    secondary: `${dynastyClasses.bg.darkLighter} ${dynastyClasses.text.primary} border ${dynastyClasses.border.primary} font-semibold rounded-lg ${dynastyClasses.transition} ${dynastyClasses.focus}`,
    ghost: `${dynastyClasses.text.primary} font-semibold rounded-lg ${dynastyClasses.transition} ${dynastyClasses.focus} hover:bg-yellow-400/10`
  },
  
  // Cards
  card: {
    base: `${dynastyClasses.bg.dark} border ${dynastyClasses.border.neutral} rounded-lg ${dynastyClasses.shadow.base} ${dynastyClasses.transition}`,
    interactive: `${dynastyClasses.bg.dark} border ${dynastyClasses.border.neutral} rounded-lg ${dynastyClasses.shadow.base} ${dynastyClasses.transition} hover:border-yellow-400/50 cursor-pointer`,
    highlighted: `${dynastyClasses.bg.dark} border ${dynastyClasses.border.primary} rounded-lg ${dynastyClasses.shadow.primary}`
  },
  
  // Forms
  input: `${dynastyClasses.bg.darkLighter} ${dynastyClasses.text.white} border ${dynastyClasses.border.neutral} rounded-lg ${dynastyClasses.focus} ${dynastyClasses.transition} placeholder:text-neutral-500`,
  
  label: `block ${dynastyClasses.text.neutralLight} font-medium mb-2`,
  
  // Layout
  page: 'min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900',
  container: 'max-w-6xl mx-auto px-6 py-8',
  section: `${dynastyClasses.bg.dark} border ${dynastyClasses.border.neutral} rounded-lg p-6 ${dynastyClasses.shadow.base}`,
  
  // Typography
  heading: {
    h1: `text-4xl font-bold ${dynastyClasses.text.primary} mb-6`,
    h2: `text-2xl font-bold ${dynastyClasses.text.white} mb-4`, 
    h3: `text-xl font-semibold ${dynastyClasses.text.white} mb-3`
  },
  
  // Status indicators
  badge: {
    success: `${dynastyClasses.bg.success} ${dynastyClasses.text.white} px-3 py-1 rounded-full text-xs font-semibold`,
    error: `${dynastyClasses.bg.error} ${dynastyClasses.text.white} px-3 py-1 rounded-full text-xs font-semibold`,
    warning: `${dynastyClasses.bg.warning} text-black px-3 py-1 rounded-full text-xs font-semibold`,
    info: `${dynastyClasses.bg.info} ${dynastyClasses.text.white} px-3 py-1 rounded-full text-xs font-semibold`
  }
};

// === UTILITY FUNCTIONS ===
export const dynastyUtils = {
  /**
   * Get component classes with size variations
   */
  getComponent: (component, variant = 'base', size = 'md') => {
    const baseClasses = dynastyComponents[component]?.[variant] || dynastyComponents[component] || '';
    
    const sizeClasses = {
      xs: 'px-2 py-1 text-xs',
      sm: 'px-3 py-2 text-sm', 
      md: 'px-4 py-3 text-base',
      lg: 'px-6 py-4 text-lg',
      xl: 'px-8 py-5 text-xl'
    };
    
    return `${baseClasses} ${sizeClasses[size] || sizeClasses.md}`;
  },
  
  /**
   * Get responsive padding/margin classes
   */
  spacing: (property, size) => {
    const prefix = property === 'margin' ? 'm' : 'p';
    return `${prefix}-${size}`;
  },
  
  /**
   * Generate custom gradients using design tokens
   */
  gradient: (type = 'primary') => {
    const gradients = {
      primary: `linear-gradient(135deg, ${dynastyTokens.colors.primary} 0%, ${dynastyTokens.colors.primaryHover} 100%)`,
      dark: `linear-gradient(135deg, ${dynastyTokens.colors.neutral[900]} 0%, ${dynastyTokens.colors.neutral[800]} 100%)`,
      page: `linear-gradient(135deg, ${dynastyTokens.colors.neutral[900]} 0%, ${dynastyTokens.colors.neutral[700]} 100%)`
    };
    return gradients[type] || gradients.primary;
  },
  
  /**
   * Generate consistent shadows
   */
  shadow: (intensity = 'base') => {
    const shadows = {
      none: 'none',
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      base: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      primary: `0 10px 15px -3px rgb(234 179 8 / 0.1), 0 4px 6px -4px rgb(234 179 8 / 0.1)`
    };
    return shadows[intensity] || shadows.base;
  },
  
  /**
   * Get text gradient for special headings
   */
  textGradient: () => 'bg-gradient-to-r from-yellow-400 to-yellow-300 bg-clip-text text-transparent'
};

// === THEME CONFIGURATION ===
export const dynastyTheme = {
  tokens: dynastyTokens,
  classes: dynastyClasses,
  components: dynastyComponents,
  utils: dynastyUtils,
  
  // Quick access patterns
  patterns: {
    pageLayout: `${dynastyComponents.page} ${dynastyComponents.container}`,
    cardWithHover: dynastyComponents.card.interactive,
    primaryButton: dynastyUtils.getComponent('button', 'primary', 'md'),
    formField: `${dynastyComponents.input} mb-4`
  }
};

// === EXPORTS ===
export default dynastyTheme;