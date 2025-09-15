// src/components/DashboardPreviewOverlay.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Users, Trophy, BarChart3, Calendar, DollarSign, Target, AlertCircle, Mail } from 'lucide-react';
import { dynastyTheme } from '../services/colorService';

const DashboardPreviewOverlay = ({ onClose, onInteractionBlocked }) => {
  const { signIn, signUp } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [authMode, setAuthMode] = useState(null); // 'signin', 'signup', 'verify', 'forgot', 'reset'
  const [authForm, setAuthForm] = useState({ 
    email: '', 
    password: '', 
    firstName: '', 
    lastName: '',
    resetCode: '',
    newPassword: '',
    verificationCode: ''
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'https://13cpdms4x1.execute-api.us-east-1.amazonaws.com/Prod';

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  const handleSignUp = () => {
    setAuthMode('signup');
    setAuthError('');
    setAuthSuccess('');
  };

  const handleSignIn = () => {
    setAuthMode('signin');
    setAuthError('');
    setAuthSuccess('');
  };

  const handleVerify = () => {
    setAuthMode('verify');
    setAuthError('');
    setAuthSuccess('');
  };

  const handleForgotPassword = () => {
    setAuthMode('forgot');
    setAuthError('');
    setAuthSuccess('');
  };

  const handleResendVerification = async () => {
    setAuthLoading(true);
    setAuthError('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authForm.email.toLowerCase().trim()
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setAuthSuccess('Verification code resent! Please check your email.');
      } else {
        setAuthError(data.detail || 'Failed to resend verification code');
      }
    } catch (error) {
      setAuthError('Failed to resend verification code');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      if (authMode === 'signup') {
        const response = await fetch(`${API_URL}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: authForm.email.toLowerCase().trim(),
            password: authForm.password,
            firstName: authForm.firstName,
            lastName: authForm.lastName
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.detail || 'Sign up failed');
        }
        
        setAuthSuccess('Account created! Check your email for the verification code.');
        // Automatically switch to verification mode after 2 seconds
        setTimeout(() => {
          setAuthMode('verify');
          // Keep the email but clear other fields
          setAuthForm({ ...authForm, password: '', firstName: '', lastName: '' });
        }, 2000);
        
      } else if (authMode === 'verify') {
        const response = await fetch(`${API_URL}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authForm.email.toLowerCase().trim(),
            code: authForm.verificationCode
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          if (response.status === 400) {
            if (data.detail?.includes('expired')) {
              setAuthError(
                <div className="space-y-2">
                  <p>Verification code has expired.</p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className={`${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline font-semibold`}
                  >
                    Resend verification code
                  </button>
                </div>
              );
            } else {
              setAuthError('Invalid verification code. Please check and try again.');
            }
          } else {
            setAuthError(data.detail || 'Verification failed');
          }
          return;
        }
        
        setAuthSuccess('Email verified successfully! You can now sign in.');
        setTimeout(() => {
          setAuthMode('signin');
          setAuthForm({ ...authForm, verificationCode: '' });
        }, 2000);
        
      } else if (authMode === 'signin') {
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: authForm.email.toLowerCase().trim(),
            password: authForm.password
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          // Handle specific error cases
          if (response.status === 404 || data.error_code === 'USER_NOT_FOUND') {
            setAuthError(
              <div className="space-y-2">
                <p>No account found with this email.</p>
                <button
                  type="button"
                  onClick={handleSignUp}
                  className={`${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline font-semibold`}
                >
                  Sign up here!
                </button>
              </div>
            );
            return;
          } else if (response.status === 401) {
            setAuthError('Incorrect password. Please try again.');
          } else if (response.status === 403 || data.detail?.includes('verify')) {
            setAuthError(
              <div className="space-y-2">
                <p>Please verify your email before signing in.</p>
                <button
                  type="button"
                  onClick={handleVerify}
                  className={`${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline font-semibold`}
                >
                  Enter verification code
                </button>
              </div>
            );
          } else {
            setAuthError(data.detail || 'Login failed. Please try again.');
          }
          return;
        }
        
        // Success - close overlay
        if (signIn) {
          await signIn(authForm.email, authForm.password);
        }
        handleClose();
        
      } else if (authMode === 'forgot') {
        const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authForm.email.toLowerCase().trim()
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          setAuthSuccess('If an account exists with this email, password reset instructions have been sent.');
          setAuthMode('reset');
        } else {
          setAuthError(data.detail || 'Failed to send reset email');
        }
        
      } else if (authMode === 'reset') {
        const response = await fetch(`${API_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authForm.email.toLowerCase().trim(),
            code: authForm.resetCode,
            password: authForm.newPassword
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          if (response.status === 400) {
            setAuthError(data.detail || 'Invalid or expired reset code');
          } else {
            setAuthError(data.detail || 'Password reset failed');
          }
          return;
        }
        
        setAuthSuccess('Password reset successful! You can now sign in.');
        setTimeout(() => {
          setAuthMode('signin');
          setAuthForm({ ...authForm, password: '', resetCode: '', newPassword: '' });
        }, 2000);
      }
    } catch (error) {
      if (React.isValidElement(error)) {
        setAuthError(error);
      } else {
        setAuthError(error.message || 'Authentication failed');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleBackToPreview = () => {
    setAuthMode(null);
    setAuthForm({ email: '', password: '', firstName: '', lastName: '', resetCode: '', newPassword: '', verificationCode: '' });
    setAuthError('');
    setAuthSuccess('');
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
                {authMode === 'signup' ? 'Create Account' : 
                 authMode === 'signin' ? 'Sign In' :
                 authMode === 'verify' ? 'Verify Email' :
                 authMode === 'forgot' ? 'Reset Password' :
                 'Enter Reset Code'}
              </h2>
              <button
                onClick={handleBackToPreview}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {authMode === 'verify' && (
              <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500 rounded-lg">
                <p className="text-blue-400 text-sm flex items-start">
                  <Mail className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  Check your email for a 6-digit verification code
                </p>
              </div>
            )}

            {authSuccess && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-lg">
                <p className="text-green-400 text-sm flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  {authSuccess}
                </p>
              </div>
            )}

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
              
              {authMode === 'verify' && (
                <>
                  <div>
                    <label className={`block text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={authForm.email}
                      onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                      placeholder="Enter your email"
                      className={`w-full px-3 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white} border ${dynastyTheme.classes.border.neutral} focus:border-yellow-400 focus:outline-none`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>
                      Verification Code
                    </label>
                    <input
                      type="text"
                      required
                      value={authForm.verificationCode}
                      onChange={(e) => setAuthForm({...authForm, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                      placeholder="000000"
                      maxLength="6"
                      className={`w-full px-3 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white} border ${dynastyTheme.classes.border.neutral} focus:border-yellow-400 focus:outline-none text-center text-2xl tracking-wider font-mono`}
                    />
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      className={`text-xs ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline mt-2`}
                    >
                      Didn't receive the code? Resend it
                    </button>
                  </div>
                </>
              )}
              
              {(authMode === 'signin' || authMode === 'signup' || authMode === 'forgot') && authMode !== 'verify' && (
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
                    disabled={authMode === 'reset'}
                  />
                </div>
              )}
              
              {(authMode === 'signin' || authMode === 'signup') && (
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
              )}

              {authMode === 'reset' && (
                <>
                  <div>
                    <label className={`block text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>
                      Reset Code (from email)
                    </label>
                    <input
                      type="text"
                      required
                      value={authForm.resetCode}
                      onChange={(e) => setAuthForm({...authForm, resetCode: e.target.value})}
                      placeholder="Enter 6-digit code"
                      className={`w-full px-3 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white} border ${dynastyTheme.classes.border.neutral} focus:border-yellow-400 focus:outline-none`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${dynastyTheme.classes.text.white} mb-2`}>
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={authForm.newPassword}
                      onChange={(e) => setAuthForm({...authForm, newPassword: e.target.value})}
                      className={`w-full px-3 py-2 rounded-lg ${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.white} border ${dynastyTheme.classes.border.neutral} focus:border-yellow-400 focus:outline-none`}
                    />
                  </div>
                </>
              )}

              {authError && (
                <div className="text-red-400 text-sm text-center">
                  {React.isValidElement(authError) ? authError : authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className={`w-full ${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {authLoading ? 'Please wait...' : 
                 authMode === 'signup' ? 'Create Account' : 
                 authMode === 'signin' ? 'Sign In' :
                 authMode === 'verify' ? 'Verify Email' :
                 authMode === 'forgot' ? 'Send Reset Email' :
                 'Reset Password'}
              </button>
            </form>

            <div className="mt-6 text-center space-y-2">
              {authMode === 'signin' && (
                <>
                  <button
                    onClick={handleVerify}
                    className={`text-sm ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline block`}
                  >
                    Have a verification code?
                  </button>
                  <button
                    onClick={handleForgotPassword}
                    className={`text-sm ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline block`}
                  >
                    Forgot your password?
                  </button>
                  <div className="mt-3">
                    <button
                      onClick={() => setAuthMode('signup')}
                      className={`text-sm ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline`}
                    >
                      Need an account? Sign Up
                    </button>
                  </div>
                </>
              )}
              {authMode === 'signup' && (
                <button
                  onClick={() => setAuthMode('signin')}
                  className={`text-sm ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline`}
                >
                  Already have an account? Sign In
                </button>
              )}
              {authMode === 'verify' && (
                <button
                  onClick={() => setAuthMode('signin')}
                  className={`text-sm ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline`}
                >
                  Back to Sign In
                </button>
              )}
              {(authMode === 'forgot' || authMode === 'reset') && (
                <button
                  onClick={() => setAuthMode('signin')}
                  className={`text-sm ${dynastyTheme.classes.text.primary} hover:text-yellow-300 underline`}
                >
                  Back to Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preview overlay (unchanged)
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
            <button
              onClick={handleVerify}
              className={`${dynastyTheme.utils.getComponent('button', 'ghost', 'lg')} px-8 py-3 text-lg`}
            >
              Verify Account
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