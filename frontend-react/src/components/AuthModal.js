// src/components/AuthModal.js
import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Crown, Mail, Lock, User, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/apiService';

const AuthModal = ({ isOpen, onClose, initialTab = 'signin' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, signUp } = useAuth();

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    favoriteTeam: '',
    confirmPassword: '',
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

    const result = await signIn(formData.email, formData.password);
    
    if (result.success) {
      onClose();
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const result = await signUp(
      formData.email,
      formData.password,
      formData.firstName,
      formData.lastName,
      formData.favoriteTeam
    );

    if (result.success) {
      setMessage('Account created! Please check your email for verification.');
      setActiveTab('verify');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authAPI.verifyEmail(formData.email, formData.verificationCode);
      setMessage('Email verified successfully! You can now sign in.');
      setActiveTab('signin');
    } catch (error) {
      setError(error.response?.data?.detail || 'Verification failed');
    }

    setLoading(false);
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError('');

    try {
      await authAPI.resendVerification(formData.email);
      setMessage('Verification code resent to your email.');
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to resend verification');
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authAPI.forgotPassword(formData.email);
      setMessage('Reset code sent to your email.');
      // Stay on reset tab for code entry
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to send reset code');
    }

    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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
      setError(error.response?.data?.detail || 'Password reset failed');
    }

    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-yellow-500/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Crown className="w-6 h-6 text-yellow-500" />
            <h2 className="text-xl font-bold text-white">Dynasty Dugout</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {['signin', 'signup', 'verify', 'reset'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-yellow-500 border-b-2 border-yellow-500'
                  : 'text-gray-400 hover:text-white'
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
          <div className="mx-6 mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Forms */}
        <div className="p-6">
          {/* Sign In Form */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-12 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reset')}
                className="w-full text-sm text-gray-400 hover:text-yellow-500 transition-colors"
              >
                Forgot your password?
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Favorite Team</label>
                <div className="relative">
                  <Heart className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <select
                    name="favoriteTeam"
                    value={formData.favoriteTeam}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
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
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-12 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Email Verification Form */}
          {activeTab === 'verify' && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="text-center text-gray-300 mb-4">
                <p>Please enter the verification code sent to your email:</p>
                <p className="text-yellow-500 font-medium">{formData.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Verification Code</label>
                <input
                  type="text"
                  name="verificationCode"
                  value={formData.verificationCode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 text-center text-lg tracking-widest"
                  placeholder="000000"
                  maxLength="6"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading}
                className="w-full text-sm text-gray-400 hover:text-yellow-500 transition-colors"
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
                  <div className="text-center text-gray-300 mb-4">
                    <p>Enter your email address to receive a password reset code.</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Sending...' : 'Send Reset Code'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Reset Code</label>
                    <input
                      type="text"
                      name="resetCode"
                      value={formData.resetCode}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 text-center text-lg tracking-widest"
                      placeholder="000000"
                      maxLength="6"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-12 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-zinc-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors"
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