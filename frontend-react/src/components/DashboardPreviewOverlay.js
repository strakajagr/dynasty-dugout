// src/components/DashboardPreviewOverlay.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Users, Trophy, BarChart3, Calendar, DollarSign, Target } from 'lucide-react';
import { dynastyTheme } from '../services/colorService';

const DashboardPreviewOverlay = ({ onClose, onInteractionBlocked }) => {
  const { signIn, signUp } = useAuth(); // Use auth context methods if available
  const [isVisible, setIsVisible] = useState(true);
  const [authMode, setAuthMode] = useState(null); // 'signin' or 'signup'
  const [authForm, setAuthForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  const handleSignUp = () => {
    setAuthMode('signup');
    setAuthError('');
  };

  const handleSignIn = () => {
    setAuthMode('signin');
    setAuthError('');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      if (authMode === 'signup') {
        if (signUp) {
          await signUp(authForm.email, authForm.password, authForm.firstName, authForm.lastName);
        } else {
          throw new Error('Sign up functionality not available');
        }
      } else {
        if (signIn) {
          await signIn(authForm.email, authForm.password);
        } else {
          throw new Error('Sign in functionality not available');
        }
      }
      // Auth success - close overlay
      handleClose();
    } catch (error) {
      setAuthError(error.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleBackToPreview = () => {
    setAuthMode(null);
    setAuthForm({ email: '', password: '', firstName: '', lastName: '' });
    setAuthError('');
  };

  if (!isVisible) return null;

  // If showing auth form
  if (authMode) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className={`${dynastyTheme.components.card.base} max-w-md w-full`}>
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>
                {authMode === 'signup' ? 'Create Account' : 'Sign In'}
              </h2>
              <button
                onClick={handleBackToPreview}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <>
                  <div>
                    <label className={`block text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={authForm.firstName}
                      onChange={(e) => setAuthForm({...authForm, firstName: e.target.value})}
                      className={`w-full px-3 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white} border ${dynastyTheme.classes.border.neutral} focus:border-yellow-400 focus:outline-none`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      value={authForm.lastName}
                      onChange={(e) => setAuthForm({...authForm, lastName: e.target.value})}
                      className={`w-full px-3 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white} border ${dynastyTheme.classes.border.neutral} focus:border-yellow-400 focus:outline-none`}
                    />
                  </div>
                </>
              )}
              
              <div>
                <label className={`block text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white} border ${dynastyTheme.classes.border.neutral} focus:border-yellow-400 focus:outline-none`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white} border ${dynastyTheme.classes.border.neutral} focus:border-yellow-400 focus:outline-none`}
                />
              </div>

              {authError && (
                <div className="text-red-400 text-sm text-center">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className={`w-full ${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {authLoading ? 'Please wait...' : (authMode === 'signup' ? 'Create Account' : 'Sign In')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}
                className={`text-sm ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline`}
              >
                {authMode === 'signup' ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preview overlay
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors z-10"
        title="Preview Dashboard"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Main Overlay Content */}
      <div className={`${dynastyTheme.components.card.base} max-w-4xl w-full max-h-[80vh] overflow-y-auto`}>
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-black font-bold" />
              </div>
              <h1 className={`text-4xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent`}>
                Dynasty Dugout
              </h1>
            </div>
            <p className={`text-xl ${dynastyTheme.classes.text.neutralLight} max-w-2xl mx-auto`}>
              The most advanced fantasy baseball platform for serious players. Build dynasties, not just teams.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className={`${dynastyTheme.components.card.interactive} p-6 text-center group`}>
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className={`font-semibold mb-2 ${dynastyTheme.classes.text.white}`}>Advanced Leagues</h3>
              <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                Salary caps, contract years, and sophisticated scoring systems that mirror real baseball.
              </p>
            </div>

            <div className={`${dynastyTheme.components.card.interactive} p-6 text-center group`}>
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className={`font-semibold mb-2 ${dynastyTheme.classes.text.white}`}>Live MLB Data</h3>
              <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                Real-time scores, injury reports, trending players, and advanced analytics you can see behind this overlay.
              </p>
            </div>

            <div className={`${dynastyTheme.components.card.interactive} p-6 text-center group`}>
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className={`font-semibold mb-2 ${dynastyTheme.classes.text.white}`}>Smart Analytics</h3>
              <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                AI-powered player valuations, hot/cold analysis, and statistical insights that give you an edge.
              </p>
            </div>
          </div>

          {/* Value Props */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className={`text-xl font-semibold mb-4 ${dynastyTheme.classes.text.primary}`}>
                What Makes Us Different
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start space-x-3">
                  <DollarSign className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                    <strong className={dynastyTheme.classes.text.white}>Salary Cap System:</strong> Real economic decisions with contract years and budget management
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                    <strong className={dynastyTheme.classes.text.white}>Multi-Year Planning:</strong> Build for the future with keeper contracts and rookie drafts
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <BarChart3 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                    <strong className={dynastyTheme.classes.text.white}>Advanced Stats:</strong> Sabermetric analysis and predictive modeling built-in
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className={`text-xl font-semibold mb-4 ${dynastyTheme.classes.text.primary}`}>
                Behind This Overlay
              </h3>
              <p className={`text-sm ${dynastyTheme.classes.text.neutralLight} mb-4`}>
                You're seeing the actual Dynasty Dugout dashboard with live MLB data, real player analytics, 
                and all the tools serious fantasy players use to dominate their leagues.
              </p>
              <p className={`text-sm ${dynastyTheme.classes.text.neutralLight}`}>
                Close this overlay to preview the interface, or sign up to start building your dynasty.
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleSignUp}
              className={`${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} px-8 py-3 text-lg font-semibold`}
            >
              Start Your Dynasty
            </button>
            <button
              onClick={handleSignIn}
              className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'lg')} px-8 py-3 text-lg`}
            >
              Sign In
            </button>
          </div>

          {/* Preview Hint */}
          <div className="text-center mt-6">
            <p className={`text-xs ${dynastyTheme.classes.text.neutralLighter}`}>
              Click the X above to preview the dashboard • All interactions require an account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPreviewOverlay;