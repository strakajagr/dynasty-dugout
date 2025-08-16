import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Crown, Mail, Lock, User, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/apiService';
import { dynastyTheme } from '../services/colorService';

const AuthModal = ({ isOpen, onClose, initialTab = 'signin' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, signUp } = useAuth(); // Destructure signIn and signUp from useAuth

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    favoriteTeam: '',
    confirmPassword: '', // This state field needs a corresponding input
    verificationCode: '',
    resetCode: ''
  });

  // MLB teams for dropdown
  const mlbTeams = [
    'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox',
    'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians',
    'Colorado Rockies', 'Detroit Tigers', 'Houston Astros', 'Kansas City Royals',
    'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins', 'Milwaukee Brewers',
    'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
    'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
    'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
    'Toronto Blue Jays', 'Washington Nationals'
  ];

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      clearForm();
    }
  }, [isOpen, initialTab]);

  const clearForm = () => {
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      favoriteTeam: '',
      confirmPassword: '',
      verificationCode: '',
      resetCode: ''
    });
    setError('');
    setMessage('');
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage(''); 

    const result = await signIn(formData.email, formData.password);
    
    if (result.success) {
      onClose(); // Close modal on successful sign-in
      // --- DIAGNOSTIC FIX APPLIED HERE ---
      // This is a temporary measure to break the login loop by forcing a redirect.
      // If this works, the issue is a React Router/state sync timing.
      console.log("AuthModal: Sign-in successful, forcing redirect to dashboard.");
      window.location.href = '/dashboard'; 
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage(''); 

    // --- FIX APPLIED HERE: Now 'confirmPassword' will be populated from the new input field ---
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    console.log("AuthModal: Submitting with formData:", formData); // Debugging log

    try {
      const result = await signUp(formData); 
      console.log("AuthModal: Signup result:", result);

      if (result.success) {
        setMessage('Account created! Please check your email for verification.');
        setActiveTab('verify');
      } else {
        setError(result.error || 'Signup failed. Please try again.'); 
      }
    } catch (err) {
      console.error("AuthModal: Error during signup API call:", err);
      setError(err.response?.data?.detail || err.message || 'An unexpected error occurred during signup.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage(''); 

    try {
      const response = await authAPI.verifyEmail(formData.email, formData.verificationCode);
      console.log("AuthModal: Verify Email API response:", response);

      if (response.success) {
        setMessage('Email verified successfully! You can now sign in.');
        setActiveTab('signin'); // Transition to signin tab after successful verification
      } else {
        setError(response.message || 'Verification failed');
      }
    } catch (error) {
      console.error("AuthModal: Email verification error:", error);
      setError(error.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError('');
    setMessage(''); 

    try {
      const response = await authAPI.resendVerification(formData.email);
      console.log("AuthModal: Resend verification API response:", response);
      if (response.success) {
        setMessage('Verification code resent to your email.');
      } else {
        setError(response.message || 'Failed to resend verification');
      }
    } catch (error) {
      console.error("AuthModal: Resend verification error:", error);
      setError(error.response?.data?.detail || 'Failed to resend verification');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage(''); 

    try {
      await authAPI.forgotPassword(formData.email);
      setMessage('Reset code sent to your email.');
    } catch (error) {
      console.error("AuthModal: Forgot password error:", error);
      setError(error.response?.data?.detail || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage(''); 

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await authAPI.resetPassword(formData.email, formData.resetCode, formData.password);
      setMessage('Password reset successfully! You can now sign in.');
      setActiveTab('signin');
    } catch (error) {
      console.error("AuthModal: Password reset error:", error);
      setError(error.response?.data?.detail || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // --- STYLING (using dynastyTheme) ---
  const modalOverlay = 'fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  const modalContainer = `${dynastyTheme.components.card.base} w-full max-w-md max-h-[90vh] overflow-y-auto border ${dynastyTheme.classes.border.light}`;
  const tabButton = `flex-1 py-3 px-4 text-sm font-medium capitalize ${dynastyTheme.classes.transition}`;
  const inputWithIcon = `${dynastyTheme.components.input} pl-10 pr-4 py-3`;
  const inputWithIconRight = `${dynastyTheme.components.input} pl-10 pr-12 py-3`;
  const inputBasic = `${dynastyTheme.components.input} px-4 py-3`;
  const iconLeft = `absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${dynastyTheme.classes.text.neutralLighter}`;
  const iconRight = `absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 ${dynastyTheme.classes.text.neutralLighter} cursor-pointer hover:${dynastyTheme.classes.text.white}`;
  const iconCenterClass = `h-12 w-12 ${dynastyTheme.classes.text.primary} mx-auto mb-4`;
  const messageSuccessClass = `${dynastyTheme.classes.bg.success}/20 border ${dynastyTheme.classes.border.success} rounded-lg p-4 mb-6 ${dynastyTheme.classes.text.white} flex items-center`;
  const messageErrorClass = `${dynastyTheme.classes.bg.error}/20 border ${dynastyTheme.classes.border.error} rounded-lg p-4 mb-6 ${dynastyTheme.classes.text.white} flex items-center`;
  const messageInfoClass = `${dynastyTheme.classes.bg.info}/20 border ${dynastyTheme.classes.border.info} rounded-lg p-4 mb-6 ${dynastyTheme.classes.text.white} flex items-center`;
  const buttonPrimaryClass = `${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} w-full flex items-center justify-center`;
  const buttonSecondaryClass = `${dynastyTheme.utils.getComponent('button', 'secondary', 'lg')} w-full flex items-center justify-center`;
  const buttonGhostClass = `${dynastyTheme.classes.text.neutralLighter} hover:${dynastyTheme.classes.text.white} text-sm flex items-center justify-center mx-auto`;
  const labelClass = `${dynastyTheme.components.label}`;


  return (
    <div className={modalOverlay}>
      <div className={modalContainer}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${dynastyTheme.classes.border.neutral}`}>
          <div className="flex items-center space-x-3">
            <Crown className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
            <h2 className={dynastyTheme.components.heading.h2}>Dynasty Dugout</h2>
          </div>
          <button
            onClick={onClose}
            className={dynastyTheme.components.button.ghost}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${dynastyTheme.classes.border.neutral}`}>
          {['signin', 'signup', 'verify', 'reset'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${tabButton} ${
                activeTab === tab
                  ? `${dynastyTheme.classes.text.primary} border-b-2 ${dynastyTheme.classes.border.primary}`
                  : `${dynastyTheme.classes.text.neutralLighter} ${dynastyTheme.classes.text.primaryHover}`
              }`}
            >
              {tab === 'signin' ? 'Sign In' : 
               tab === 'signup' ? 'Sign Up' :
               tab === 'verify' ? 'Verify' :
               'Reset'}
            </button>
          ))}
        </div>

        {/* Messages */}
        {message && (
          <div className={messageInfoClass}>
            <span className={dynastyTheme.classes.text.white}>{message}</span>
          </div>
        )}
        {error && (
          <div className={messageErrorClass}>
            <span className={dynastyTheme.classes.text.white}>{error}</span>
          </div>
        )}

        {/* Forms */}
        <div className="p-6">
          {/* Sign In Form */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className={iconLeft} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={inputWithIcon}
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className={iconLeft} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={inputWithIconRight}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={iconRight}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={buttonPrimaryClass}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reset')}
                className={`w-full text-sm ${dynastyTheme.classes.text.neutralLighter} ${dynastyTheme.classes.text.primaryHover} ${dynastyTheme.classes.transition}`}
              >
                Forgot your password?
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>First Name</label>
                  <div className="relative">
                    <User className={iconLeft} />
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={inputWithIcon}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={inputBasic}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className={iconLeft} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={inputWithIcon}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Favorite Team</label>
                <div className="relative">
                  <Heart className={iconLeft} />
                  <select
                    name="favoriteTeam"
                    value={formData.favoriteTeam}
                    onChange={handleInputChange}
                    className={inputWithIcon}
                    required
                  >
                    <option value="">Select your favorite team</option>
                    {mlbTeams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className={iconLeft} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={inputWithIconRight}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={iconRight}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* --- FIX APPLIED HERE: Added Confirm Password field --- */}
              <div>
                <label className={labelClass}>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={inputBasic}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={buttonPrimaryClass}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Email Verification Form */}
          {activeTab === 'verify' && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className={`text-center mb-6`}>
                <Mail className={iconCenterClass} />
                <h2 className={dynastyTheme.components.heading.h2}>Check Your Email</h2>
                <p className={`${dynastyTheme.classes.text.neutralLight}`}>
                  We've sent a verification code to <strong>{formData.email}</strong>
                </p>
              </div>
              
              <div>
                <label className={labelClass}>Verification Code</label>
                <input
                  type="text"
                  name="verificationCode"
                  value={formData.verificationCode}
                  onChange={handleInputChange}
                  className={`${inputBasic} text-center text-lg tracking-widest`}
                  placeholder="000000"
                  maxLength="6"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={buttonPrimaryClass}
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading}
                className={buttonGhostClass}
              >
                Resend verification code
              </button>
            </form>
          )}

          {/* Password Reset Form */}
          {activeTab === 'reset' && (
            <form onSubmit={message ? handleResetPassword : handleForgotPassword} className="space-y-4">
              {!message ? (
                <>
                  <div className={`text-center mb-4`}>
                    <p className={`${dynastyTheme.classes.text.neutralLight}`}>Enter your email address to receive a password reset code.</p>
                  </div>
                  
                  <div>
                    <label className={labelClass}>Email</label>
                    <div className="relative">
                      <Mail className={iconLeft} />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={inputWithIcon}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={buttonPrimaryClass}
                  >
                    {loading ? 'Sending...' : 'Send Reset Code'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>Reset Code</label>
                    <input
                      type="text"
                      name="resetCode"
                      value={formData.resetCode}
                      onChange={handleInputChange}
                      className={`${inputBasic} text-center text-lg tracking-widest`}
                      placeholder="000000"
                      maxLength="6"
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>New Password</label>
                    <div className="relative">
                      <Lock className={iconLeft} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={inputWithIconRight}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={iconRight}
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Confirm New Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={inputBasic}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={buttonPrimaryClass}
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;