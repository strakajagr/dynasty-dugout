// src/pages/MyAccount.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dynastyColors, dynastyUtils, dynastyTheme } from '../services/colorService';
import '../styles/App.css';

const MyAccount = () => {
  const { updateUserProfile } = useAuth();
  
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    dateOfBirth: '',
    profilePicture: null
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [activeTab, setActiveTab] = useState('profile');
  const [profilePictureUrl, setProfilePictureUrl] = useState(null); // Simplified state

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { profile } = await response.json();
        console.log('Profile loaded:', profile);
        
        setProfileData({
          firstName: profile.given_name || '',
          lastName: profile.family_name || '',
          email: profile.email || '',
          dateOfBirth: profile.birthdate ? profile.birthdate.split('T')[0] : '',
          profilePicture: null
        });
        
        // Set profile picture URL directly
        setProfilePictureUrl(profile.picture || null);
        console.log('Profile picture URL set to:', profile.picture);
        
        setMessage({ text: '', type: '' });
      } else {
        const errorData = await response.json();
        setMessage({
          text: errorData.detail || 'Failed to load profile data',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setMessage({
        text: 'Failed to load profile data',
        type: 'error'
      });
    }
  };

  const handleProfileChange = useCallback((e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handlePasswordChange = useCallback((e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ text: 'Profile picture must be less than 10MB', type: 'error' });
      return;
    }

    if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
      setMessage({ text: 'Profile picture must be JPEG, PNG, or GIF', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: 'Uploading profile picture...', type: 'info' });
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/auth/upload-profile-picture', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const result = await response.json();
      console.log('Upload response:', result);

      if (response.ok && result.success) {
        // Immediately set the new S3 URL
        setProfilePictureUrl(result.profile_picture_url);
        console.log('Profile picture URL updated to:', result.profile_picture_url);
        
        setMessage({
          text: 'Profile picture uploaded successfully!',
          type: 'success'
        });
      } else {
        setMessage({
          text: result.message || 'Failed to upload profile picture',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({
        text: 'Network error while uploading profile picture',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    if (profileData.firstName.length < 1 || profileData.firstName.length > 100) {
      setMessage({ text: 'First name must be 1-100 characters', type: 'error' });
      setLoading(false);
      return;
    }

    if (profileData.lastName.length < 1 || profileData.lastName.length > 100) {
      setMessage({ text: 'Last name must be 1-100 characters', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const updateData = {
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        email: profileData.email.trim()
      };
      
      if (profileData.dateOfBirth) {
        updateData.dateOfBirth = profileData.dateOfBirth;
      }
      
      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success !== false) {
        setMessage({
          text: `Profile updated successfully! ${result.changes_made} changes made.`,
          type: 'success'
        });

        try {
          await updateUserProfile({
            given_name: profileData.firstName,
            family_name: profileData.lastName,
            email: profileData.email
          });
        } catch (authError) {
          console.warn('Auth context update failed:', authError);
        }
      } else {
        setMessage({
          text: result.message || result.detail || 'Failed to update profile',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage({
        text: 'Network error. Please check your connection and try again.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ text: 'New passwords do not match', type: 'error' });
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ text: 'Password must be at least 8 characters long', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ text: 'Password changed successfully!', type: 'success' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ text: result.detail || result.message || 'Failed to change password', type: 'error' });
      }
    } catch (error) {
      console.error('Password change error:', error);
      setMessage({
        text: 'Network error. Please check your connection and try again.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dynasty-page-container" style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
      padding: '2rem'
    }}>
      <div className="dynasty-content-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div className="dynasty-header-section" style={{ 
          marginBottom: '3rem', 
          textAlign: 'center',
          padding: '2rem',
          background: `linear-gradient(135deg, ${dynastyColors.dark} 0%, rgba(26, 32, 46, 0.8) 100%)`,
          borderRadius: '1rem',
          border: `1px solid ${dynastyColors.gold}`,
          boxShadow: `0 8px 32px rgba(234, 179, 8, 0.1)`
        }}>
          <h1 className="dynasty-page-title" style={{ 
            color: dynastyColors.gold,
            fontSize: '3rem',
            fontWeight: '700',
            marginBottom: '1rem',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
            background: `linear-gradient(135deg, ${dynastyColors.gold} 0%, #fcd34d 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            My Account
          </h1>
          <p className="dynasty-subtitle" style={{ 
            color: dynastyColors.lightGray,
            fontSize: '1.2rem',
            fontWeight: '400',
            opacity: '0.9',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Manage your profile information and account settings
          </p>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`dynasty-message-box ${
            message.type === 'error' ? 'dynasty-error-message' : 
            message.type === 'info' ? 'dynasty-info-message' : 'dynasty-success-message'
          }`} 
            style={{
              backgroundColor: message.type === 'error' ? dynastyColors.errorLight : 
                             message.type === 'info' ? '#1f2937' : dynastyColors.successLight,
              color: message.type === 'error' ? dynastyColors.error : 
                     message.type === 'info' ? dynastyColors.lightGray : dynastyColors.success,
              border: `1px solid ${message.type === 'error' ? dynastyColors.error : 
                                  message.type === 'info' ? dynastyColors.gold : dynastyColors.success}`,
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
            {message.text}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="dynasty-tab-container" style={dynastyTheme.components.tabs.container}>
          <button
            className={`dynasty-tab-custom ${activeTab === 'profile' ? 'dynasty-tab-active' : 'dynasty-tab-inactive'}`}
            onClick={() => setActiveTab('profile')}
            style={dynastyUtils.getTabStyles(activeTab === 'profile')}
          >
            Profile Information
          </button>
          <button
            className={`dynasty-tab-custom ${activeTab === 'security' ? 'dynasty-tab-active' : 'dynasty-tab-inactive'}`}
            onClick={() => setActiveTab('security')}
            style={dynastyUtils.getTabStyles(activeTab === 'security')}
          >
            Security Settings
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="dynasty-card-container" style={{
            backgroundColor: dynastyColors.dark,
            padding: '2rem',
            borderRadius: '0.5rem',
            border: `1px solid ${dynastyColors.gray}`
          }}>
            <form onSubmit={handleProfileSubmit} className="dynasty-form">
              {/* Profile Picture Section */}
              <div className="dynasty-profile-picture-section" style={{ marginBottom: '2rem' }}>
                <label className="dynasty-label" style={{ 
                  color: dynastyColors.white,
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  marginBottom: '1rem',
                  display: 'block'
                }}>
                  Profile Picture
                </label>
                <div className="dynasty-profile-picture-container" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div className="dynasty-profile-picture-preview" style={{
                    borderColor: dynastyColors.gold,
                    border: `2px solid ${dynastyColors.gold}`,
                    borderRadius: '50%',
                    width: '100px',
                    height: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {profilePictureUrl ? (
                      <img 
                        src={profilePictureUrl} 
                        alt="Profile Picture" 
                        className="dynasty-profile-image"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          console.error('Image failed to load:', profilePictureUrl);
                          setProfilePictureUrl(null);
                        }}
                      />
                    ) : (
                      <div className="dynasty-profile-placeholder" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%'
                      }}>
                        <span style={{ color: dynastyColors.lightGray, fontSize: '0.9rem' }}>No Image</span>
                      </div>
                    )}
                  </div>
                  <div className="dynasty-profile-picture-upload">
                    <input
                      type="file"
                      id="profilePicture"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="dynasty-file-input"
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="profilePicture"
                      className="dynasty-file-upload-button"
                      style={{
                        backgroundColor: dynastyColors.gold,
                        color: dynastyColors.black,
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        border: 'none',
                        transition: 'all 0.3s ease',
                        display: 'inline-block'
                      }}
                    >
                      Choose Image
                    </label>
                    <p className="dynasty-file-helper-text" style={{ 
                      color: dynastyColors.lightGray,
                      fontSize: '0.8rem',
                      marginTop: '0.5rem'
                    }}>
                      JPEG, PNG, or GIF. Max 10MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Name Fields */}
              <div className="dynasty-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="dynasty-form-group">
                  <label htmlFor="firstName" className="dynasty-label" style={{ 
                    color: dynastyColors.white,
                    fontSize: '1rem',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                    display: 'block'
                  }}>
                    First Name * (1-100 characters)
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={profileData.firstName}
                    onChange={handleProfileChange}
                    required
                    minLength={1}
                    maxLength={100}
                    className="dynasty-input"
                    style={{
                      borderColor: dynastyColors.gold,
                      backgroundColor: dynastyColors.gray,
                      color: dynastyColors.white,
                      border: `2px solid ${dynastyColors.gold}`,
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      width: '100%',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div className="dynasty-form-group">
                  <label htmlFor="lastName" className="dynasty-label" style={{ 
                    color: dynastyColors.white,
                    fontSize: '1rem',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                    display: 'block'
                  }}>
                    Last Name * (1-100 characters)
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={profileData.lastName}
                    onChange={handleProfileChange}
                    required
                    minLength={1}
                    maxLength={100}
                    className="dynasty-input"
                    style={{
                      borderColor: dynastyColors.gold,
                      backgroundColor: dynastyColors.gray,
                      color: dynastyColors.white,
                      border: `2px solid ${dynastyColors.gold}`,
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      width: '100%',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="dynasty-form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="email" className="dynasty-label" style={{ 
                  color: dynastyColors.white,
                  fontSize: '1rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  display: 'block'
                }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  required
                  className="dynasty-input"
                  style={{
                    borderColor: dynastyColors.gold,
                    backgroundColor: dynastyColors.gray,
                    color: dynastyColors.white,
                    border: `2px solid ${dynastyColors.gold}`,
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    width: '100%',
                    fontSize: '1rem'
                  }}
                />
                <p className="dynasty-helper-text" style={{ 
                  color: dynastyColors.lightGray,
                  fontSize: '0.8rem',
                  marginTop: '0.5rem'
                }}>
                  Changing your email will require verification and audit logging
                </p>
              </div>

              {/* Date of Birth */}
              <div className="dynasty-form-group" style={{ marginBottom: '2rem' }}>
                <label htmlFor="dateOfBirth" className="dynasty-label" style={{ 
                  color: dynastyColors.white,
                  fontSize: '1rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  display: 'block'
                }}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={profileData.dateOfBirth}
                  onChange={handleProfileChange}
                  className="dynasty-input"
                  style={{
                    borderColor: dynastyColors.gold,
                    backgroundColor: dynastyColors.gray,
                    color: dynastyColors.white,
                    border: `2px solid ${dynastyColors.gold}`,
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    width: '100%',
                    fontSize: '1rem'
                  }}
                />
              </div>

              {/* Submit Button */}
              <div className="dynasty-button-container">
                <button
                  type="submit"
                  disabled={loading}
                  className="dynasty-primary-button"
                  style={{
                    backgroundColor: dynastyColors.gold,
                    color: dynastyColors.black,
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '1rem 2rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {loading ? 'Updating...' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="dynasty-card-container" style={{
            backgroundColor: dynastyColors.dark,
            padding: '2rem',
            borderRadius: '0.5rem',
            border: `1px solid ${dynastyColors.gray}`
          }}>
            <form onSubmit={handlePasswordSubmit} className="dynasty-form">
              <div className="dynasty-section-header" style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: dynastyColors.gold, fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Change Password
                </h3>
                <p className="dynasty-section-description" style={{ 
                  color: dynastyColors.lightGray,
                  fontSize: '1rem'
                }}>
                  Update your password to keep your account secure. All changes are audit logged.
                </p>
              </div>

              <div className="dynasty-form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="currentPassword" className="dynasty-label" style={{ 
                  color: dynastyColors.white,
                  fontSize: '1rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  display: 'block'
                }}>
                  Current Password *
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  className="dynasty-input"
                  style={{
                    borderColor: dynastyColors.gold,
                    backgroundColor: dynastyColors.gray,
                    color: dynastyColors.white,
                    border: `2px solid ${dynastyColors.gold}`,
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    width: '100%',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div className="dynasty-form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="newPassword" className="dynasty-label" style={{ 
                  color: dynastyColors.white,
                  fontSize: '1rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  display: 'block'
                }}>
                  New Password *
                </label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength="8"
                  className="dynasty-input"
                  style={{
                    borderColor: dynastyColors.gold,
                    backgroundColor: dynastyColors.gray,
                    color: dynastyColors.white,
                    border: `2px solid ${dynastyColors.gold}`,
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    width: '100%',
                    fontSize: '1rem'
                  }}
                />
                <p className="dynasty-helper-text" style={{ 
                  color: dynastyColors.lightGray,
                  fontSize: '0.8rem',
                  marginTop: '0.5rem'
                }}>
                  Must be at least 8 characters long and meet AWS Cognito security requirements
                </p>
              </div>

              <div className="dynasty-form-group" style={{ marginBottom: '2rem' }}>
                <label htmlFor="confirmPassword" className="dynasty-label" style={{ 
                  color: dynastyColors.white,
                  fontSize: '1rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  display: 'block'
                }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  className="dynasty-input"
                  style={{
                    borderColor: dynastyColors.gold,
                    backgroundColor: dynastyColors.gray,
                    color: dynastyColors.white,
                    border: `2px solid ${dynastyColors.gold}`,
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    width: '100%',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div className="dynasty-button-container">
                <button
                  type="submit"
                  disabled={loading}
                  className="dynasty-primary-button"
                  style={{
                    backgroundColor: dynastyColors.gold,
                    color: dynastyColors.black,
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '1rem 2rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {loading ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAccount;