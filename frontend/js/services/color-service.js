/**
 * Diamond Dynasty Color Service
 * Centralized color management for dynamic styling and theme switching
 * Matches the CSS color service variables
 */

class ColorService {
    constructor() {
        // Define the color palette matching your CSS variables
        this.colors = {
            // Primary Brand Colors
            primary: {
                yellow: '#F1C40F',
                yellowDark: '#D4AC0D',
                yellowLight: '#F7DC6F',
                yellowPale: '#FEF9E7'
            },

            // Secondary Gray Colors (replacing blues)
            secondary: {
                gray: '#6C757D',
                grayDark: '#495057',
                grayLight: '#ADB5BD',
                grayPale: '#E9ECEF'
            },

            // Neutral Colors
            neutral: {
                white: '#FFFFFF',
                black: '#000000',
                darkGray: '#343A40',
                mediumGray: '#6C757D',
                lightGray: '#F8F9FA',
                borderGray: '#DEE2E6'
            },

            // Semantic Colors
            semantic: {
                success: '#28A745',
                successLight: '#D4EDDA',
                error: '#DC3545',
                errorLight: '#F8D7DA',
                warning: '#FFC107',
                warningLight: '#FFF3CD',
                info: '#17A2B8',
                infoLight: '#D1ECF1'
            },

            // Text Colors
            text: {
                primary: '#343A40',
                secondary: '#6C757D',
                muted: '#ADB5BD',
                onYellow: '#343A40',
                onGray: '#FFFFFF'
            },

            // Interactive States
            interactive: {
                hoverYellow: '#D4AC0D',
                hoverGray: '#495057',
                activeYellow: '#B7950B',
                activeGray: '#373A3C',
                focusRing: 'rgba(241, 196, 15, 0.25)'
            }
        };

        // Layout presets
        this.layouts = {
            header: this.colors.primary.yellow,
            sidebar: this.colors.primary.yellow,
            main: this.colors.neutral.lightGray,
            card: this.colors.neutral.white,
            footer: this.colors.secondary.grayDark
        };

        // Initialize the service
        this.init();
    }

    /**
     * Initialize the color service
     */
    init() {
        // Apply colors to CSS custom properties if not already set
        this.applyCSSVariables();
        
        // Set up theme change listeners
        this.setupThemeListeners();
        
        console.log('Diamond Dynasty Color Service initialized');
    }

    /**
     * Apply colors to CSS custom properties
     */
    applyCSSVariables() {
        const root = document.documentElement;
        
        // Apply all color variables to CSS
        root.style.setProperty('--primary-yellow', this.colors.primary.yellow);
        root.style.setProperty('--primary-yellow-dark', this.colors.primary.yellowDark);
        root.style.setProperty('--primary-yellow-light', this.colors.primary.yellowLight);
        root.style.setProperty('--primary-yellow-pale', this.colors.primary.yellowPale);
        
        root.style.setProperty('--secondary-gray', this.colors.secondary.gray);
        root.style.setProperty('--secondary-gray-dark', this.colors.secondary.grayDark);
        root.style.setProperty('--secondary-gray-light', this.colors.secondary.grayLight);
        root.style.setProperty('--secondary-gray-pale', this.colors.secondary.grayPale);
        
        root.style.setProperty('--text-primary', this.colors.text.primary);
        root.style.setProperty('--text-secondary', this.colors.text.secondary);
        root.style.setProperty('--text-muted', this.colors.text.muted);
        root.style.setProperty('--text-on-yellow', this.colors.text.onYellow);
        root.style.setProperty('--text-on-gray', this.colors.text.onGray);
        
        // Add more as needed...
    }

    /**
     * Get a color by path (e.g., 'primary.yellow', 'text.onYellow')
     */
    getColor(path) {
        const keys = path.split('.');
        let color = this.colors;
        
        for (const key of keys) {
            if (color[key]) {
                color = color[key];
            } else {
                console.warn(`Color path '${path}' not found`);
                return null;
            }
        }
        
        return color;
    }

    /**
     * Apply a color theme to an element
     */
    applyTheme(element, theme = 'primary') {
        if (!element) return;

        switch (theme) {
            case 'primary':
                element.style.backgroundColor = this.colors.primary.yellow;
                element.style.color = this.colors.text.onYellow;
                break;
            case 'secondary':
                element.style.backgroundColor = this.colors.secondary.gray;
                element.style.color = this.colors.text.onGray;
                break;
            case 'card':
                element.style.backgroundColor = this.colors.neutral.white;
                element.style.color = this.colors.text.primary;
                element.style.border = `1px solid ${this.colors.neutral.borderGray}`;
                break;
            default:
                console.warn(`Theme '${theme}' not recognized`);
        }
    }

    /**
     * Create a button with Diamond Dynasty styling
     */
    createButton(text, type = 'primary', onClick = null) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = `btn btn-${type}`;
        
        // Apply inline styles for consistency
        const styles = this.getButtonStyles(type);
        Object.assign(button.style, styles);
        
        if (onClick) {
            button.addEventListener('click', onClick);
        }
        
        // Add hover effects
        this.addHoverEffects(button, type);
        
        return button;
    }

    /**
     * Get button styles based on type
     */
    getButtonStyles(type) {
        const baseStyles = {
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontSize: '1rem'
        };

        switch (type) {
            case 'primary':
                return {
                    ...baseStyles,
                    backgroundColor: this.colors.primary.yellow,
                    color: this.colors.text.onYellow
                };
            case 'secondary':
                return {
                    ...baseStyles,
                    backgroundColor: this.colors.secondary.gray,
                    color: this.colors.text.onGray
                };
            case 'outline-primary':
                return {
                    ...baseStyles,
                    backgroundColor: 'transparent',
                    color: this.colors.primary.yellow,
                    border: `2px solid ${this.colors.primary.yellow}`
                };
            default:
                return baseStyles;
        }
    }

    /**
     * Add hover effects to buttons
     */
    addHoverEffects(button, type) {
        const originalStyles = { ...button.style };
        
        button.addEventListener('mouseenter', () => {
            switch (type) {
                case 'primary':
                    button.style.backgroundColor = this.colors.interactive.hoverYellow;
                    break;
                case 'secondary':
                    button.style.backgroundColor = this.colors.interactive.hoverGray;
                    break;
                case 'outline-primary':
                    button.style.backgroundColor = this.colors.primary.yellow;
                    button.style.color = this.colors.text.onYellow;
                    break;
            }
            button.style.transform = 'translateY(-1px)';
        });

        button.addEventListener('mouseleave', () => {
            Object.assign(button.style, originalStyles);
        });
    }

    /**
     * Create a status message with appropriate colors
     */
    createStatusMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.className = `status-message status-${type}`;
        
        const styles = {
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontWeight: '500'
        };

        switch (type) {
            case 'success':
                styles.backgroundColor = this.colors.semantic.successLight;
                styles.color = '#166534';
                styles.border = `1px solid ${this.colors.semantic.success}`;
                break;
            case 'error':
                styles.backgroundColor = this.colors.semantic.errorLight;
                styles.color = '#991b1b';
                styles.border = `1px solid ${this.colors.semantic.error}`;
                break;
            case 'warning':
                styles.backgroundColor = this.colors.semantic.warningLight;
                styles.color = '#a16207';
                styles.border = `1px solid ${this.colors.semantic.warning}`;
                break;
            case 'info':
            default:
                styles.backgroundColor = this.colors.semantic.infoLight;
                styles.color = '#0C5460';
                styles.border = `1px solid ${this.colors.semantic.info}`;
                break;
        }

        Object.assign(messageDiv.style, styles);
        return messageDiv;
    }

    /**
     * Setup theme change listeners for future dark mode support
     */
    setupThemeListeners() {
        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener(() => {
                // Future: implement dark mode toggle
                console.log('System theme changed');
            });
        }
    }

    /**
     * Generate a random color from the primary palette
     */
    getRandomPrimaryColor() {
        const primaryColors = Object.values(this.colors.primary);
        return primaryColors[Math.floor(Math.random() * primaryColors.length)];
    }

    /**
     * Check if a color is light or dark (for text contrast)
     */
    isLightColor(color) {
        // Convert hex to RGB
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        return luminance > 0.5;
    }

    /**
     * Get contrasting text color for a background
     */
    getContrastingTextColor(backgroundColor) {
        return this.isLightColor(backgroundColor) ? 
            this.colors.text.primary : 
            this.colors.neutral.white;
    }

    /**
     * Update theme dynamically (for future features)
     */
    updateTheme(newColors) {
        // Merge new colors with existing ones
        this.colors = { ...this.colors, ...newColors };
        
        // Reapply CSS variables
        this.applyCSSVariables();
        
        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { colors: this.colors } 
        }));
    }
}

// Create global instance
window.DiamondDynastyColors = new ColorService();

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorService;
}