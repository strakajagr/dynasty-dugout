// AuthService.js - Secure Cookie Authentication (Simplified)
class AuthService {
    constructor() {
        // API configuration
        this.API_BASE_URL = '';
        
        // No more token storage - cookies handle everything!
        // No more cross-tab sync - cookies work everywhere automatically!
    }

    /**
     * Check if user is authenticated by calling the server
     * The server checks the httpOnly cookie for us
     */
    async isAuthenticated() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/auth/status`, {
                method: 'GET',
                credentials: 'include', // Important: includes cookies
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.authenticated;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking auth status:', error);
            return false;
        }
    }

    /**
     * Login user with email and password
     * Server sets secure httpOnly cookie on success
     */
    async login(credentials) {
        try {
            console.log('🔐 Attempting login...');
            
            const response = await fetch(`${this.API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                credentials: 'include', // Important: allows cookies to be set
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Login successful, cookie set by server');
                
                // Notify all tabs that auth state changed
                window.dispatchEvent(new CustomEvent('authStateChanged', { 
                    detail: { authenticated: true, user: data.user } 
                }));
                
                return { success: true, user: data.user };
            } else {
                const error = await response.json();
                console.log('❌ Login failed:', error.detail);
                return { success: false, error: error.detail };
            }
            
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error during login' };
        }
    }

    /**
     * Logout user by clearing the server-side cookie
     */
    async logout() {
        try {
            console.log('🚪 Logging out...');
            
            const response = await fetch(`${this.API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include', // Important: includes cookies for logout
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log('✅ Logout successful, cookie cleared by server');
            } else {
                console.log('⚠️ Logout request failed, but continuing...');
            }
            
            // Notify all tabs that user logged out
            window.dispatchEvent(new CustomEvent('authStateChanged', { 
                detail: { authenticated: false } 
            }));
            
            // Redirect to login page
            this.redirectToLogin();
            
        } catch (error) {
            console.error('Logout error:', error);
            // Even if logout request fails, still redirect to login
            this.redirectToLogin();
        }
    }

    /**
     * Make authenticated API calls - cookies are included automatically!
     * This is now MUCH simpler - no token management needed
     */
    async makeAuthenticatedRequest(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                credentials: 'include', // Important: includes cookies
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            // If we get a 401, user needs to log in again
            if (response.status === 401) {
                console.log('❌ Authentication required, redirecting to login...');
                
                // Notify tabs that auth failed
                window.dispatchEvent(new CustomEvent('authStateChanged', { 
                    detail: { authenticated: false } 
                }));
                
                this.redirectToLogin();
                throw new Error('Authentication required');
            }

            return response;
            
        } catch (error) {
            console.error('Error making authenticated request:', error);
            throw error;
        }
    }

    /**
     * Get current user information from server
     */
    async getUserInfo() {
        try {
            const response = await this.makeAuthenticatedRequest(`${this.API_BASE_URL}/api/auth/user`);
            
            if (response.ok) {
                const userData = await response.json();
                return userData;
            }
            
            return null;
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    }

    /**
     * Register a new user
     */
    async register(userData) {
        try {
            console.log('📝 Attempting registration...');
            
            const response = await fetch(`${this.API_BASE_URL}/api/auth/signup`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Registration successful');
                return { success: true, message: data.message };
            } else {
                const error = await response.json();
                console.log('❌ Registration failed:', error.detail);
                return { success: false, error: error.detail };
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Network error during registration' };
        }
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        // Don't redirect if we're already on the login page
        if (!window.location.pathname.includes('login') && 
            !window.location.pathname.includes('index.html')) {
            console.log('🔄 Redirecting to login page...');
            window.location.href = '/index.html';
        }
    }

    /**
     * Initialize auth service when page loads
     * Much simpler now - just check if authenticated
     */
    static async initializeForPage() {
        const authService = new AuthService();
        
        // Check if user is authenticated
        const isAuth = await authService.isAuthenticated();
        
        if (!isAuth) {
            // If this is not the login page, redirect to login
            if (!window.location.pathname.includes('login') && 
                !window.location.pathname.includes('index.html')) {
                console.log('❌ Not authenticated, redirecting to login...');
                authService.redirectToLogin();
                return null;
            }
        } else {
            console.log('✅ User is authenticated');
        }
        
        return authService;
    }

    /**
     * Setup cross-tab authentication sync
     * This listens for auth state changes from other tabs
     */
    setupCrossTabSync() {
        // Listen for auth state changes from other tabs
        window.addEventListener('authStateChanged', (event) => {
            if (event.detail.authenticated) {
                console.log('✅ User authenticated in another tab');
                // Optionally refresh current page or update UI
            } else {
                console.log('❌ User logged out in another tab');
                this.redirectToLogin();
            }
        });

        // Listen for storage events (in case we want to use localStorage for some non-sensitive data)
        window.addEventListener('storage', (event) => {
            // This can be used for non-sensitive cross-tab communication
            if (event.key === 'auth_state_change') {
                const authState = JSON.parse(event.newValue || '{}');
                window.dispatchEvent(new CustomEvent('authStateChanged', { 
                    detail: authState 
                }));
            }
        });
    }

    /**
     * Trigger cross-tab auth state change
     * This notifies other tabs about auth changes
     */
    triggerCrossTabAuthChange(authenticated, user = null) {
        // Use localStorage event to notify other tabs
        const authState = { authenticated, user, timestamp: Date.now() };
        localStorage.setItem('auth_state_change', JSON.stringify(authState));
        
        // Remove it immediately (we just want to trigger the event)
        setTimeout(() => {
            localStorage.removeItem('auth_state_change');
        }, 100);
    }
}

// Export for use in other files
window.AuthService = AuthService;

// Usage Examples:
/*

// Initialize on any page
document.addEventListener('DOMContentLoaded', async function() {
    const authService = await AuthService.initializeForPage();
    
    if (authService) {
        // Page is authenticated, proceed with loading data
        await loadPageData(authService);
    }
});

// Login example
async function handleLogin(email, password) {
    const authService = new AuthService();
    const result = await authService.login({ email, password });
    
    if (result.success) {
        console.log('Login successful!', result.user);
        // Redirect to dashboard or refresh page
    } else {
        console.error('Login failed:', result.error);
        // Show error message to user
    }
}

// Make API calls (cookies included automatically)
async function loadPlayerData(authService) {
    try {
        const response = await authService.makeAuthenticatedRequest('/api/players');
        const data = await response.json();
        console.log('Players loaded:', data);
    } catch (error) {
        console.error('Failed to load players:', error);
    }
}

// Logout example
async function handleLogout() {
    const authService = new AuthService();
    await authService.logout();
    // Will automatically redirect to login
}

*/