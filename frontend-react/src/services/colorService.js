// src/services/colorService.js

/**
 * Dynasty Dugout Design System - Enterprise Edition
 * Enhanced with softer shadows, subtle gradients, and professional polish
 * Updated with sharper corners for more modern look
 */

// === CORE DESIGN TOKENS ===
export const dynastyTokens = {
  // Brand Colors - Keep your yellow/gold
  colors: {
    // Primary Dynasty brand
    primary: '#eab308',
    primaryHover: '#facc15',
    primaryDark: '#ca8a04',
    primaryLight: 'rgba(234, 179, 8, 0.1)',
    primaryGlow: 'rgba(234, 179, 8, 0.05)',
    
    // Refined neutrals with warmer tones
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
      850: '#1f1c19',  // NEW - softer than 900
      900: '#1c1917',
      950: '#0c0a09'
    },
    
    // Semantic colors with better contrast
    success: '#10b981',
    successLight: 'rgba(16, 185, 129, 0.1)',
    error: '#ef4444',
    errorLight: 'rgba(239, 68, 68, 0.1)', 
    warning: '#f59e0b',
    warningLight: 'rgba(245, 158, 11, 0.1)',
    info: '#3b82f6',
    infoLight: 'rgba(59, 130, 246, 0.1)'
  },
  
  // Enhanced spacing for better breathing room
  spacing: {
    xs: '0.5rem',   // 8px
    sm: '0.75rem',  // 12px  
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    '2xl': '3rem',  // 48px
    '3xl': '4rem'   // 64px - NEW
  },
  
  // Refined typography scale
  fontSize: {
    '2xs': '0.625rem', // 10px - NEW
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem'   // 36px
  },
  
  // UPDATED: Sharper border radius for modern look
  radius: {
    none: '0',
    sm: '0.125rem',    // 2px - SHARPER
    base: '0.25rem',   // 4px - SHARPER
    md: '0.375rem',    // 6px - SHARPER
    lg: '0.5rem',      // 8px - SHARPER
    xl: '0.75rem',     // 12px - SHARPER
    full: '9999px'
  }
};

// === ENHANCED CSS UTILITY CLASSES ===
export const dynastyClasses = {
  // Refined backgrounds with subtle gradients
  bg: {
    primary: 'bg-yellow-400',
    primaryHover: 'hover:bg-yellow-300',
    primaryLight: 'bg-yellow-400/10',  // FIXED: Added this missing property
    primaryGlow: 'bg-gradient-to-r from-yellow-400/10 to-transparent',
    
    // Softer dark backgrounds
    dark: 'bg-gradient-to-b from-neutral-850 to-neutral-900',
    darkFlat: 'bg-neutral-900',
    darkLighter: 'bg-neutral-800/80 backdrop-blur-sm',
    darkCard: 'bg-gradient-to-br from-neutral-800/90 to-neutral-850/90 backdrop-blur-md',
    
    light: 'bg-neutral-50',
    
    // FIXED: Added missing background colors
    neutral: 'bg-neutral-800',
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  },
  
  // Enhanced text colors
  text: {
    primary: 'text-yellow-400',
    primaryHover: 'hover:text-yellow-300',
    primaryBright: 'text-yellow-300',
    
    white: 'text-white',
    whiteMuted: 'text-white/90',
    black: 'text-black',  // FIXED: Added missing black text
    
    neutral: 'text-neutral-400',
    neutralLight: 'text-neutral-500',
    neutralLighter: 'text-neutral-400',
    neutralDark: 'text-neutral-600',  // FIXED: Added missing neutralDark
    
    success: 'text-emerald-400',
    error: 'text-red-400', 
    warning: 'text-amber-400',
    info: 'text-blue-400'
  },
  
  // Softer borders
  border: {
    primary: 'border-yellow-400/30',
    primaryBright: 'border-yellow-400',
    neutral: 'border-neutral-700',  // FIXED: Added missing neutral border
    neutralLight: 'border-neutral-600/30',
    light: 'border-yellow-400/10',
    glass: 'border-white/5',
    // FIXED: Added missing semantic borders
    warning: 'border-amber-500',
    error: 'border-red-500',
    success: 'border-emerald-500',
    info: 'border-blue-500'
  },
  
  // Enhanced utilities with smooth hover states
  transition: 'transition-all duration-300 ease-out',
  transitionFast: 'transition-all duration-150 ease-out',  // FIXED: Added missing transitionFast
  transitionSlow: 'transition-all duration-500 ease-out',
  focus: 'focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:ring-offset-2 focus:ring-offset-neutral-900',
  
  // Professional shadows with hover states
  shadow: {
    none: 'shadow-none',
    sm: 'shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/30',
    base: 'shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/40',
    lg: 'shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-black/50',
    xl: 'shadow-2xl shadow-black/50',
    primary: 'shadow-lg shadow-yellow-400/10 hover:shadow-xl hover:shadow-yellow-400/20',
    glow: 'shadow-[0_0_30px_rgba(234,179,8,0.15)] hover:shadow-[0_0_40px_rgba(234,179,8,0.25)]',
    inner: 'shadow-inner shadow-black/20'
  },
  
  // FIXED: Added missing hover effects that components are trying to access
  hover: {
    lift: 'hover:-translate-y-1 hover:shadow-xl',
    liftSmall: 'hover:-translate-y-[2px] hover:shadow-lg',
    grow: 'hover:scale-[1.02]',
    growSmall: 'hover:scale-[1.01]',
    shrink: 'hover:scale-[0.98]',
    slideRight: 'hover:translate-x-1',  // FIXED: Added missing slideRight
    slideLeft: 'hover:-translate-x-1',
    rotate: 'hover:rotate-1',
    brightness: 'hover:brightness-110',  // FIXED: Added missing brightness
    glow: 'hover:drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]'
  }
};

// === ENTERPRISE-GRADE COMPONENTS ===
export const dynastyComponents = {
  // Enhanced buttons with premium hover states - SHARPER CORNERS
  button: {
    primary: `
      relative overflow-hidden
      bg-gradient-to-r from-yellow-400 to-yellow-500 
      text-black font-semibold 
      rounded-md
      shadow-lg shadow-yellow-400/20
      hover:shadow-2xl hover:shadow-yellow-400/40
      hover:scale-[1.03]
      hover:-translate-y-[2px]
      active:scale-[0.97]
      active:translate-y-0
      transition-all duration-300 ease-out
      before:absolute before:inset-0
      before:bg-gradient-to-r before:from-yellow-300 before:to-yellow-400
      before:opacity-0 hover:before:opacity-100
      before:transition-opacity before:duration-300
      ${dynastyClasses.focus}
    `,
    secondary: `
      relative overflow-hidden
      bg-neutral-800/60 backdrop-blur-sm
      text-yellow-400 
      border border-yellow-400/30
      font-semibold rounded-md
      hover:bg-neutral-800/90
      hover:border-yellow-400/60
      hover:shadow-xl hover:shadow-yellow-400/20
      hover:text-yellow-300
      hover:scale-[1.02]
      hover:-translate-y-[1px]
      active:scale-[0.98]
      transition-all duration-300 ease-out
      before:absolute before:inset-0
      before:bg-gradient-to-r before:from-yellow-400/0 before:via-yellow-400/10 before:to-yellow-400/0
      before:translate-x-[-100%] hover:before:translate-x-[100%]
      before:transition-transform before:duration-700
      ${dynastyClasses.focus}
    `,
    ghost: `
      relative
      text-yellow-400 font-semibold 
      rounded-md
      hover:bg-yellow-400/15
      hover:text-yellow-300
      hover:shadow-lg hover:shadow-yellow-400/10
      hover:scale-[1.01]
      transition-all duration-300 ease-out
      ${dynastyClasses.focus}
    `,
    danger: `
      relative overflow-hidden
      bg-gradient-to-r from-red-500 to-red-600
      text-white font-semibold
      rounded-md
      shadow-lg shadow-red-500/20
      hover:shadow-2xl hover:shadow-red-500/40
      hover:scale-[1.02]
      hover:-translate-y-[1px]
      active:scale-[0.98]
      transition-all duration-300 ease-out
      ${dynastyClasses.focus}
    `
  },
  
  // Sophisticated card designs with premium hover effects - SHARPER CORNERS
  card: {
    base: `
      relative
      bg-gradient-to-br from-neutral-800/60 to-neutral-850/60
      backdrop-blur-md
      border border-neutral-700/30
      rounded-lg
      shadow-xl shadow-black/20
      ${dynastyClasses.transition}
    `,
    interactive: `
      relative overflow-hidden
      bg-gradient-to-br from-neutral-800/60 to-neutral-850/60
      backdrop-blur-md
      border border-neutral-700/30
      rounded-lg
      shadow-xl shadow-black/20
      hover:shadow-2xl hover:shadow-yellow-400/10
      hover:border-yellow-400/40
      hover:bg-gradient-to-br hover:from-neutral-800/80 hover:to-neutral-850/80
      hover:scale-[1.01]
      hover:-translate-y-[2px]
      cursor-pointer
      transition-all duration-300 ease-out
      before:absolute before:inset-0
      before:bg-gradient-to-r before:from-transparent before:via-yellow-400/5 before:to-transparent
      before:opacity-0 hover:before:opacity-100
      before:transition-opacity before:duration-500
      after:absolute after:inset-0 after:rounded-lg
      after:bg-gradient-to-t after:from-yellow-400/0 after:to-yellow-400/0
      hover:after:from-yellow-400/5 hover:after:to-transparent
      after:transition-all after:duration-500
    `,
    highlighted: `
      relative overflow-hidden
      bg-gradient-to-br from-neutral-800/80 to-neutral-850/80
      backdrop-blur-md
      border border-yellow-400/30
      rounded-lg
      shadow-xl shadow-yellow-400/10
      hover:border-yellow-400/50
      hover:shadow-2xl hover:shadow-yellow-400/20
      hover:scale-[1.01]
      transition-all duration-300 ease-out
      before:absolute before:inset-0
      before:bg-gradient-to-br before:from-yellow-400/5 before:to-transparent
      before:animate-pulse
    `,
    glass: `
      relative overflow-hidden
      bg-white/5
      backdrop-blur-xl
      border border-white/10
      rounded-lg
      shadow-2xl shadow-black/30
      hover:bg-white/8
      hover:border-white/20
      hover:shadow-2xl hover:shadow-black/40
      hover:scale-[1.005]
      transition-all duration-300 ease-out
    `,
    flat: `
      bg-neutral-800
      rounded-md
      hover:bg-neutral-750
      transition-all duration-300 ease-out
    `
  },
  
  // Modern form inputs - SHARPER CORNERS
  input: `
    bg-neutral-800/50 
    backdrop-blur-sm
    text-white 
    border border-neutral-600/30
    rounded-md
    placeholder:text-neutral-500
    hover:border-neutral-500/50
    focus:border-yellow-400/50
    focus:bg-neutral-800/70
    ${dynastyClasses.focus}
    ${dynastyClasses.transition}
  `,
  
  label: `
    block text-neutral-400 
    font-medium text-sm 
    mb-2 tracking-wide
  `,
  
  // Enhanced layout components
  page: `
    min-h-screen 
    bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]
    from-neutral-800 via-neutral-900 to-black
    relative
    overflow-hidden
  `,
  
  pageWithPattern: `
    min-h-screen 
    bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]
    from-neutral-800 via-neutral-900 to-black
    relative
    overflow-hidden
    before:absolute before:inset-0
    before:bg-[url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23eab308' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")]
  `,
  
  container: 'max-w-7xl mx-auto px-6 py-8',
  
  section: `
    bg-gradient-to-br from-neutral-800/40 to-neutral-850/40
    backdrop-blur-sm
    border border-neutral-700/30
    rounded-lg
    p-8
    shadow-2xl shadow-black/30
  `,
  
  // Professional typography - FIXED: Added missing heading.h shortcut
  heading: {
    h1: `
      text-5xl font-bold 
      bg-gradient-to-r from-yellow-400 to-yellow-300 
      bg-clip-text text-transparent
      mb-8 tracking-tight
    `,
    h2: `
      text-3xl font-bold 
      text-white
      mb-6 tracking-tight
    `, 
    h3: `
      text-xl font-semibold 
      text-white/95
      mb-4 tracking-normal
    `,
    h4: `
      text-lg font-medium
      text-white/90
      mb-3
    `,
    // FIXED: Added the 'h' shortcut that components are looking for
    h: `
      text-lg font-medium
      text-white/90
      mb-3
    `
  },
  
  // Enhanced status indicators - SHARPER CORNERS
  badge: {
    success: `
      bg-emerald-500/20 
      text-emerald-400 
      border border-emerald-500/30
      px-3 py-1 rounded-md 
      text-xs font-semibold
      backdrop-blur-sm
    `,
    error: `
      bg-red-500/20 
      text-red-400
      border border-red-500/30
      px-3 py-1 rounded-md 
      text-xs font-semibold
      backdrop-blur-sm
    `,
    warning: `
      bg-amber-500/20 
      text-amber-400
      border border-amber-500/30
      px-3 py-1 rounded-md 
      text-xs font-semibold
      backdrop-blur-sm
    `,
    info: `
      bg-blue-500/20 
      text-blue-400
      border border-blue-500/30
      px-3 py-1 rounded-md 
      text-xs font-semibold
      backdrop-blur-sm
    `,
    neutral: `
      bg-neutral-700/20
      text-neutral-300
      border border-neutral-600/30
      px-3 py-1 rounded-md
      text-xs font-semibold
      backdrop-blur-sm
    `
  },
  
  // Enhanced sidebar with smooth hover animations - SHARPER CORNERS
  sidebar: {
    container: `
      bg-gradient-to-b from-neutral-850/95 to-neutral-900/95
      backdrop-blur-xl
      border-r border-neutral-700/30
      shadow-2xl shadow-black/30
    `,
    sectionHeader: `
      text-xs font-bold 
      uppercase tracking-wider 
      mb-3 
      text-yellow-400/80
      px-1
    `,
    navItem: {
      base: `
        w-full flex items-center 
        space-x-3 px-4 py-3 
        rounded-md
        text-sm font-medium
        transition-all duration-300 ease-out
        relative
        overflow-hidden
        group
      `,
      active: `
        bg-gradient-to-r from-yellow-400 to-yellow-500
        text-black
        shadow-lg shadow-yellow-400/20
        font-semibold
        hover:shadow-xl hover:shadow-yellow-400/30
        hover:scale-[1.02]
      `,
      inactive: `
        text-neutral-300
        hover:text-white
        hover:bg-gradient-to-r hover:from-white/10 hover:to-white/5
        hover:border-l-4 hover:border-yellow-400/50
        hover:pl-5
        hover:shadow-lg hover:shadow-black/20
        before:absolute before:inset-0
        before:bg-gradient-to-r before:from-yellow-400/0 before:via-yellow-400/5 before:to-yellow-400/0
        before:translate-x-[-100%] hover:before:translate-x-[100%]
        before:transition-transform before:duration-700
      `,
      needsAttention: `
        text-yellow-400 
        hover:text-yellow-300
        hover:bg-gradient-to-r hover:from-yellow-400/20 hover:to-yellow-400/5
        hover:pl-5
        hover:shadow-lg hover:shadow-yellow-400/10
        relative overflow-hidden
        before:absolute before:inset-0
        before:bg-gradient-to-r before:from-yellow-400/0 before:via-yellow-400/10 before:to-yellow-400/0
        before:translate-x-[-100%] hover:before:translate-x-[100%]
        before:transition-transform before:duration-700
        after:absolute after:inset-0
        after:rounded-md
        after:shadow-[0_0_20px_rgba(234,179,8,0.4)]
        after:animate-[pulseGlow_2s_ease-in-out_infinite]
      `
    }
  },
  
  // New: Data display components with hover effects - SHARPER CORNERS
  statCard: {
    container: `
      relative overflow-hidden
      bg-gradient-to-br from-neutral-800/50 to-neutral-850/50
      backdrop-blur-sm
      rounded-md
      p-6
      border border-neutral-700/30
      hover:border-yellow-400/30
      hover:shadow-xl hover:shadow-yellow-400/10
      hover:scale-[1.02]
      hover:-translate-y-1
      transition-all duration-300 ease-out
      before:absolute before:inset-0
      before:bg-gradient-to-br before:from-yellow-400/0 before:to-yellow-400/5
      before:opacity-0 hover:before:opacity-100
      before:transition-opacity before:duration-500
    `,
    value: `
      text-3xl font-bold
      bg-gradient-to-r from-yellow-400 to-yellow-300
      bg-clip-text text-transparent
    `,
    label: `
      text-sm text-neutral-400
      font-medium tracking-wide
      mt-1
    `
  },
  
  // Enhanced list items with hover animations - SHARPER CORNERS
  listItem: {
    base: `
      relative overflow-hidden
      p-3 rounded-md
      bg-neutral-800/30
      border border-transparent
      hover:bg-gradient-to-r hover:from-neutral-800/60 hover:to-neutral-800/40
      hover:border-yellow-400/20
      hover:shadow-lg hover:shadow-yellow-400/5
      hover:scale-[1.01]
      hover:translate-x-1
      transition-all duration-300 ease-out
      cursor-pointer
      before:absolute before:inset-0
      before:bg-gradient-to-r before:from-yellow-400/0 before:via-yellow-400/5 before:to-yellow-400/0
      before:translate-x-[-100%] hover:before:translate-x-[100%]
      before:transition-transform before:duration-700
    `,
    selected: `
      relative overflow-hidden
      p-3 rounded-md
      bg-gradient-to-r from-yellow-400/15 to-yellow-400/5
      border border-yellow-400/30
      shadow-lg shadow-yellow-400/10
      before:absolute before:inset-0
      before:bg-gradient-to-r before:from-yellow-400/5 before:to-transparent
      before:animate-pulse
    `,
    hoverable: `
      relative overflow-hidden
      p-3 rounded-md
      bg-neutral-800/20
      border border-neutral-700/20
      hover:bg-neutral-800/50
      hover:border-yellow-400/30
      hover:shadow-xl hover:shadow-yellow-400/10
      hover:scale-[1.02]
      hover:-translate-y-[2px]
      transition-all duration-300 ease-out
      cursor-pointer
      group
    `
  },
  
  // New: Table row hover states
  tableRow: {
    base: `
      border-b border-neutral-800/30
      hover:bg-gradient-to-r hover:from-yellow-400/5 hover:to-transparent
      hover:border-yellow-400/20
      transition-all duration-300 ease-out
      cursor-pointer
    `,
    interactive: `
      border-b border-neutral-800/30
      hover:bg-gradient-to-r hover:from-yellow-400/10 hover:to-yellow-400/5
      hover:border-yellow-400/30
      hover:shadow-lg hover:shadow-yellow-400/5
      hover:scale-[1.005]
      hover:translate-x-1
      transition-all duration-300 ease-out
      cursor-pointer
    `
  }
};

// === ENHANCED UTILITY FUNCTIONS ===
export const dynastyUtils = {
  /**
   * Get component classes with size variations
   */
  getComponent: (component, variant = 'base', size = 'md') => {
    const baseClasses = dynastyComponents[component]?.[variant] || dynastyComponents[component] || '';
    
    const sizeClasses = {
      xs: 'px-3 py-1.5 text-xs',
      sm: 'px-4 py-2 text-sm', 
      md: 'px-5 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
      xl: 'px-8 py-4 text-xl'
    };
    
    return `${baseClasses} ${sizeClasses[size] || sizeClasses.md}`;
  },
  
  /**
   * Generate hover glow effect with customizable intensity
   */
  hoverGlow: (color = dynastyTokens.colors.primary, intensity = 0.2) => `
    hover:shadow-[0_0_20px_${color}${Math.round(intensity * 100)}]
    hover:border-${color.replace('#', '')}/50
    transition-all duration-300
  `,
  
  /**
   * Generate glass hover effect
   */
  glassHover: () => `
    hover:bg-white/10
    hover:backdrop-blur-xl
    hover:border-white/20
    hover:shadow-2xl hover:shadow-black/40
    transition-all duration-300
  `,
  
  /**
   * Generate custom gradients
   */
  gradient: (type = 'primary') => {
    const gradients = {
      primary: `linear-gradient(135deg, ${dynastyTokens.colors.primary} 0%, ${dynastyTokens.colors.primaryHover} 100%)`,
      dark: `linear-gradient(180deg, ${dynastyTokens.colors.neutral[800]} 0%, ${dynastyTokens.colors.neutral[900]} 100%)`,
      page: `radial-gradient(ellipse at top, ${dynastyTokens.colors.neutral[800]} 0%, ${dynastyTokens.colors.neutral[900]} 50%, #000000 100%)`,
      card: `linear-gradient(135deg, ${dynastyTokens.colors.neutral[800]}99 0%, ${dynastyTokens.colors.neutral[850]}99 100%)`,
      text: `linear-gradient(135deg, ${dynastyTokens.colors.primary} 0%, ${dynastyTokens.colors.primaryHover} 100%)`,
      hover: `linear-gradient(135deg, ${dynastyTokens.colors.primary}20 0%, transparent 100%)`
    };
    return gradients[type] || gradients.primary;
  },
  
  /**
   * Professional box shadows
   */
  shadow: (intensity = 'base', color = '0,0,0') => {
    const shadows = {
      none: 'none',
      sm: `0 2px 4px rgb(${color} / 0.1)`,
      base: `0 10px 25px rgb(${color} / 0.15)`,
      lg: `0 20px 40px rgb(${color} / 0.2)`,
      xl: `0 25px 50px rgb(${color} / 0.25)`,
      glow: `0 0 40px rgb(234, 179, 8 / 0.15)`,
      inner: `inset 0 2px 4px rgb(${color} / 0.1)`
    };
    return shadows[intensity] || shadows.base;
  },
  
  /**
   * FIXED: Added missing animation property that components expect
   */
  animation: {
    fadeIn: 'animate-[fadeIn_0.3s_ease-in-out]',
    slideUp: 'animate-[slideUp_0.3s_ease-out]',
    slideDown: 'animate-[slideDown_0.3s_ease-out]',
    pulse: 'animate-pulse',
    spin: 'animate-spin',
    glow: 'animate-[glow_2s_ease-in-out_infinite]'
  },
  
  /**
   * Global styles for animations and enhanced hover effects
   */
  globalStyles: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes slideDown {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes slideRight {
      from { transform: translateX(-10px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes glow {
      0%, 100% { 
        box-shadow: 0 0 20px rgba(234, 179, 8, 0.3), 
                    0 0 40px rgba(234, 179, 8, 0.2);
      }
      50% { 
        box-shadow: 0 0 30px rgba(234, 179, 8, 0.4), 
                    0 0 60px rgba(234, 179, 8, 0.3);
      }
    }
    
    @keyframes shimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }
    
    @keyframes pulse-border {
      0%, 100% { border-color: rgba(234, 179, 8, 0.3); }
      50% { border-color: rgba(234, 179, 8, 0.6); }
    }
      
    @keyframes pulseGlow {
      0%, 100% { 
        box-shadow: 0 0 15px rgba(234, 179, 8, 0.3),
                    0 0 30px rgba(234, 179, 8, 0.2),
                    inset 0 0 10px rgba(234, 179, 8, 0.1);
        background-color: rgba(234, 179, 8, 0.05);
      }
      50% { 
        box-shadow: 0 0 25px rgba(234, 179, 8, 0.5),
                    0 0 50px rgba(234, 179, 8, 0.3),
                    inset 0 0 15px rgba(234, 179, 8, 0.15);
        background-color: rgba(234, 179, 8, 0.1);
      }
    }
    
    /* Enhanced hover animations */
    .hover-lift {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hover-lift:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    
    .hover-glow {
      transition: all 0.3s ease-out;
    }
    .hover-glow:hover {
      box-shadow: 0 0 30px rgba(234, 179, 8, 0.3),
                  0 10px 40px rgba(0, 0, 0, 0.3);
    }
    
    .hover-shine {
      position: relative;
      overflow: hidden;
    }
    .hover-shine::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(234, 179, 8, 0.2),
        transparent
      );
      transition: left 0.5s ease-out;
    }
    .hover-shine:hover::before {
      left: 100%;
    }
    
    .hover-border-glow {
      transition: all 0.3s ease-out;
    }
    .hover-border-glow:hover {
      border-color: rgba(234, 179, 8, 0.5);
      box-shadow: inset 0 0 20px rgba(234, 179, 8, 0.1),
                  0 0 20px rgba(234, 179, 8, 0.1);
    }
    
    /* Custom scrollbar with hover effects */
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    
    ::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
    }
    
    ::-webkit-scrollbar-thumb {
      background: rgba(234, 179, 8, 0.3);
      border-radius: 10px;
      transition: background 0.3s ease;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(234, 179, 8, 0.6);
      box-shadow: 0 0 10px rgba(234, 179, 8, 0.3);
    }
    
    /* Smooth scroll */
    html {
      scroll-behavior: smooth;
    }
    
    /* Better focus states with glow */
    *:focus-visible {
      outline: 2px solid rgba(234, 179, 8, 0.5);
      outline-offset: 2px;
      border-radius: 4px;
      box-shadow: 0 0 20px rgba(234, 179, 8, 0.2);
    }
    
    /* Link hover effects */
    a {
      transition: all 0.3s ease-out;
    }
    
    a:hover {
      color: rgb(234, 179, 8);
      text-shadow: 0 0 15px rgba(234, 179, 8, 0.3);
    }
    
    /* Button ripple effect */
    .ripple {
      position: relative;
      overflow: hidden;
    }
    
    .ripple::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }
    
    .ripple:active::after {
      width: 300px;
      height: 300px;
    }
  `
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
    secondaryButton: dynastyUtils.getComponent('button', 'secondary', 'md'),
    formField: `${dynastyComponents.input} mb-4`,
    glassCard: dynastyComponents.card.glass,
    statDisplay: dynastyComponents.statCard.container
  }
};

// === EXPORTS ===
export default dynastyTheme;