/**
 * API Service - Centralized API calls
 */
class ApiService {
    static BASE_URL = 'https://mnn6lw869j.execute-api.us-east-1.amazonaws.com/Prod';
    
    static async getPlayers() {
        try {
            const response = await fetch(`${this.BASE_URL}/api/players`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching players:', error);
            throw error;
        }
    }
    
    static async getPlayer(id) {
        try {
            const response = await fetch(`${this.BASE_URL}/api/players/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching player:', error);
            throw error;
        }
    }
    
    // Future: Add methods for teams, rosters, etc.
    static async getTeams() {
        // TODO: Implement when API is ready
    }
    
    static async getUserRoster(userId) {
        // TODO: Implement when authentication is ready
    }
}
