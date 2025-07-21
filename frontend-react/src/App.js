// src/App.js
import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import LoadingSpinner from './components/LoadingSpinner';
import './styles/App.css';

// Main app content that depends on auth state
function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated ? <Dashboard /> : <LandingPage />;
}

// Root App component
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;