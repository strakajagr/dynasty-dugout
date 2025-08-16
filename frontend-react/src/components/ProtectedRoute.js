import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner'; 

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth(); 

  // --- FIX HERE: Introduce micro-delay if not authenticated ---
  // This helps combat race conditions where isAuthenticated might be briefly false
  const [shouldRedirect, setShouldRedirect] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      // If not loading and not authenticated, set a small delay before redirecting
      // This gives AuthContext a moment more to confirm state
      const timer = setTimeout(() => {
        setShouldRedirect(true);
      }, 50); // 50ms delay - adjust if needed

      return () => clearTimeout(timer); // Cleanup timer
    } else if (isAuthenticated) {
      setShouldRedirect(false); // Reset if becomes authenticated
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return <LoadingSpinner message="Loading user session..." />;
  }

  if (shouldRedirect) { // Redirect only after the delay confirms it
    return <Navigate to="/" replace />;
  }

  // If not loading and authenticated, render children
  if (isAuthenticated) {
    return children;
  }

  // Fallback, theoretically shouldn't be reached if logic is sound
  return null; 
};

export default ProtectedRoute;