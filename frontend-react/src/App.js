// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CommissionerProvider } from './contexts/CommissionerContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import CreateLeague from './pages/CreateLeague';
import LeagueWelcome from './pages/LeagueWelcome';
import LeagueDashboard from './pages/LeagueDashboard';
import MyAccount from './pages/MyAccount';
import PlayerProfile from './pages/PlayerProfile';
import JoinLeague from './pages/JoinLeague';
import SalaryContractSettings from './pages/league-dashboard/salary-contract/SalaryContractSettings';
import { dynastyTheme } from './services/colorService';

function App() {
  return (
    <AuthProvider>
      <CommissionerProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              
              {/* Public invitation acceptance route - no authentication required initially */}
              <Route path="/join-league" element={<JoinLeague />} />
              
              {/* Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/my-account" 
                element={
                  <ProtectedRoute>
                    <MyAccount />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/create-league" 
                element={
                  <ProtectedRoute>
                    <CreateLeague />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/leagues/:leagueId/welcome" 
                element={
                  <ProtectedRoute>
                    <LeagueWelcome />
                  </ProtectedRoute>
                } 
              />
              
              {/* League Dashboard */}
              <Route 
                path="/leagues/:leagueId" 
                element={
                  <ProtectedRoute>
                    <LeagueDashboard />
                  </ProtectedRoute>
                } 
              />
              
              {/* Salary & Contract Settings - using dynastyTheme */}
              <Route 
                path="/leagues/:leagueId/salary-contract-settings" 
                element={
                  <ProtectedRoute>
                    <div className={dynastyTheme.components.page}>
                      <div className={dynastyTheme.components.container}>
                        <SalaryContractSettings />
                      </div>
                    </div>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/player/:playerId" 
                element={
                  <ProtectedRoute>
                    <PlayerProfile />
                  </ProtectedRoute>
                } 
              />
              
              {/* Redirect unknown routes to dashboard if authenticated, otherwise to landing */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </CommissionerProvider>
    </AuthProvider>
  );
}

export default App;