// src/pages/MyAccount.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dynastyTheme } from '../services/colorService'; // Import dynastyTheme
import { User, Lock, Image, UploadCloud, Save, KeyRound, AlertCircle, CheckCircle, Info } from 'lucide-react'; // Import Lucide icons

const MyAccount = () => {
    // Destructure updateUserProfile from AuthContext for updating local user state
    const { updateUserProfile } = useAuth();

    // State for profile information
    const [profileData, setProfileData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        dateOfBirth: '',
        profilePicture: null // File object for new upload
    });

    // State for password change form
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // UI states
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' }); // { text: 'Your message', type: 'success' | 'error' | 'info' }
    const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'security'
    const [profilePictureUrl, setProfilePictureUrl] = useState(null); // URL for displaying current profile picture

    // Effect to load user profile when component mounts
    useEffect(() => {
        loadUserProfile();
    }, []);

    /**
     * Fetches the user's profile data from the backend and updates state.
     * This is called on component mount.
     */
    const loadUserProfile = async () => {
        try {
            const response = await fetch('/api/auth/profile', {
                method: 'GET',
                credentials: 'include', // Ensures cookies are sent
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const { profile } = await response.json();
                console.log('Profile loaded:', profile);

                // Update profileData state with fetched values
                setProfileData({
                    firstName: profile.given_name || '', // Cognito uses given_name
                    lastName: profile.family_name || '', // Cognito uses family_name
                    email: profile.email || '',
                    dateOfBirth: profile.birthdate ? profile.birthdate.split('T')[0] : '', // Format date for input
                    profilePicture: null // No file initially
                });

                // Set the profile picture URL for display
                setProfilePictureUrl(profile.picture || null);
                console.log('Profile picture URL set to:', profile.picture);

                setMessage({ text: '', type: '' }); // Clear any previous messages
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
                text: 'Network error. Failed to load profile data.',
                type: 'error'
            });
        }
    };

    /**
     * Handles changes to profile input fields.
     * @param {Object} e - The event object.
     */
    const handleProfileChange = useCallback((e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
    }, []);

    /**
     * Handles changes to password input fields.
     * @param {Object} e - The event object.
     */
    const handlePasswordChange = useCallback((e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    }, []);

    /**
     * Handles profile picture file selection and upload.
     * @param {Object} e - The event object.
     */
    const handleProfilePictureChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Client-side file validation
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            setMessage({ text: 'Profile picture must be less than 10MB.', type: 'error' });
            return;
        }
        if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
            setMessage({ text: 'Profile picture must be JPEG, PNG, or GIF.', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage({ text: 'Uploading profile picture...', type: 'info' });

        try {
            const formData = new FormData();
            formData.append('file', file); // Append the file to form data

            const response = await fetch('/api/auth/upload-profile-picture', {
                method: 'POST',
                credentials: 'include',
                body: formData // No Content-Type header needed for FormData; browser sets it
            });

            const result = await response.json();
            console.log('Upload response:', result);

            if (response.ok && result.success) {
                setProfilePictureUrl(result.profile_picture_url); // Update URL for display
                console.log('Profile picture URL updated to:', result.profile_picture_url);

                setMessage({
                    text: 'Profile picture uploaded successfully!',
                    type: 'success'
                });
            } else {
                setMessage({
                    text: result.message || 'Failed to upload profile picture.',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Upload error:', error);
            setMessage({
                text: 'Network error. Please check your connection and try again.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handles submission of the profile information form.
     * @param {Object} e - The event object.
     */
    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' }); // Clear previous messages

        // Client-side validation for name lengths
        if (profileData.firstName.trim().length < 1 || profileData.firstName.trim().length > 100) {
            setMessage({ text: 'First name must be 1-100 characters.', type: 'error' });
            setLoading(false);
            return;
        }
        if (profileData.lastName.trim().length < 1 || profileData.lastName.trim().length > 100) {
            setMessage({ text: 'Last name must be 1-100 characters.', type: 'error' });
            setLoading(false);
            return;
        }

        try {
            // Data to send to the backend. Trim whitespace.
            const updateData = {
                firstName: profileData.firstName.trim(),
                lastName: profileData.lastName.trim(),
                email: profileData.email.trim()
            };

            // Only include dateOfBirth if it has a value
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
                // If response is not OK, parse error message from body
                const errorData = await response.json();
                throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success !== false) { // Backend might return {success: false} or just an error message
                setMessage({
                    text: `Profile updated successfully! ${result.changes_made || 0} changes made.`,
                    type: 'success'
                });

                // Update the user context with the new profile data
                // This ensures other parts of the app (e.g., navigation bar) reflect changes immediately
                try {
                    await updateUserProfile({
                        given_name: profileData.firstName,
                        family_name: profileData.lastName,
                        email: profileData.email
                        // Note: dateOfBirth and picture are not typically part of the core Cognito user object in context
                    });
                } catch (authError) {
                    console.warn('Auth context update failed:', authError);
                }
            } else {
                setMessage({
                    text: result.message || result.detail || 'Failed to update profile.',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Profile update error:', error);
            setMessage({
                text: error.message || 'Network error. Please check your connection and try again.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handles submission of the password change form.
     * @param {Object} e - The event object.
     */
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' }); // Clear previous messages

        // Client-side password validation
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ text: 'New passwords do not match.', type: 'error' });
            setLoading(false);
            return;
        }
        if (passwordData.newPassword.length < 8) {
            setMessage({ text: 'Password must be at least 8 characters long.', type: 'error' });
            setLoading(false);
            return;
        }
        // Add more complex password validation here if needed (e.g., regex for symbols, numbers, uppercase)

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
                // Clear password fields on success
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                setMessage({ text: result.detail || result.message || 'Failed to change password.', type: 'error' });
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

    /**
     * Helper function to get dynamic CSS classes for message display based on message type.
     * @param {string} type - The type of message ('success', 'error', 'info').
     * @returns {string} - Combined Tailwind CSS classes.
     */
    const getMessageClass = (type) => {
        switch (type) {
            case 'error':
                return `${dynastyTheme.classes.bg.error}/20 ${dynastyTheme.classes.text.error} border-${dynastyTheme.tokens.colors.error}`; // Using token for border color
            case 'success':
                return `${dynastyTheme.classes.bg.success}/20 ${dynastyTheme.classes.text.success} border-${dynastyTheme.tokens.colors.success}`; // Using token for border color
            case 'info':
                return `${dynastyTheme.classes.bg.info}/20 ${dynastyTheme.classes.text.info} border-${dynastyTheme.tokens.colors.info}`; // Using token for border color
            default:
                return `${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.neutralLight} border-${dynastyTheme.tokens.colors.neutral[600]}`; // Default neutral border
        }
    };

    return (
        <div className={dynastyTheme.patterns.pageLayout}>
            <div className={dynastyTheme.components.container}>
                {/* Header Section */}
                <div className={`${dynastyTheme.components.card.highlighted} p-8 text-center mb-12`}>
                    <h1 className={dynastyTheme.components.heading.h1}>
                        My Account
                    </h1>
                    <p className={`text-xl ${dynastyTheme.classes.text.neutralLight}`}>
                        Manage your profile information and account settings
                    </p>
                </div>

                {/* Message Display Area */}
                {message.text && (
                    <div className={`${getMessageClass(message.type)} border p-4 rounded-lg mb-6 flex items-center`}>
                        {message.type === 'error' && <AlertCircle size={20} className="mr-2" />}
                        {message.type === 'success' && <CheckCircle size={20} className="mr-2" />}
                        {message.type === 'info' && <Info size={20} className="mr-2" />}
                        <span className={dynastyTheme.classes.text.white}>{message.text}</span>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex space-x-1 mb-8">
                    {[
                        { id: 'profile', label: 'Profile Information' },
                        { id: 'security', label: 'Security Settings' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            className={`
                                ${dynastyTheme.utils.getComponent('button', 'base', 'md')} 
                                px-6 py-3 rounded-t-lg font-semibold
                                ${dynastyTheme.classes.transition}
                                ${activeTab === tab.id
                                    ? `${dynastyTheme.classes.bg.primary} ${dynastyTheme.classes.text.black}`
                                    : `${dynastyTheme.classes.bg.darkLighter} ${dynastyTheme.classes.text.primary} hover:${dynastyTheme.classes.bg.neutral[700]}` // Use neutral-700 for hover
                                }
                            `}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Profile Tab Content */}
                {activeTab === 'profile' && (
                    <div className={`${dynastyTheme.components.card.base} p-8`}>
                        <form onSubmit={handleProfileSubmit} className="space-y-6">
                            {/* Profile Picture Section */}
                            <div>
                                <label className={dynastyTheme.components.label}>
                                    Profile Picture
                                </label>
                                <div className="flex items-center gap-6">
                                    <div
                                        className={`w-24 h-24 rounded-full border-2 ${dynastyTheme.classes.border.primary} flex items-center justify-center overflow-hidden`}
                                    >
                                        {profilePictureUrl ? (
                                            <img
                                                src={profilePictureUrl}
                                                alt="Profile Picture"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    console.error('Image failed to load:', profilePictureUrl);
                                                    setProfilePictureUrl(null); // Fallback to "No Image" text
                                                }}
                                            />
                                        ) : (
                                            <span className={`${dynastyTheme.classes.text.neutralLight} text-sm`}>
                                                <Image size={32} className={`${dynastyTheme.classes.text.neutralLighter}`} />
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <input
                                            type="file"
                                            id="profilePicture"
                                            accept="image/*"
                                            onChange={handleProfilePictureChange}
                                            className="hidden" // Hide default input
                                        />
                                        <label
                                            htmlFor="profilePicture"
                                            className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} cursor-pointer flex items-center`}
                                        >
                                            <UploadCloud size={20} className="mr-2" />
                                            Choose Image
                                        </label>
                                        <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-2`}>
                                            JPEG, PNG, or GIF. Max 10MB.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Name Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="firstName" className={dynastyTheme.components.label}>
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
                                        className={`${dynastyTheme.components.input} w-full`}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="lastName" className={dynastyTheme.components.label}>
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
                                        className={`${dynastyTheme.components.input} w-full`}
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label htmlFor="email" className={dynastyTheme.components.label}>
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={profileData.email}
                                    onChange={handleProfileChange}
                                    required
                                    className={`${dynastyTheme.components.input} w-full`}
                                />
                                <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-2`}>
                                    Changing your email will require verification and audit logging.
                                </p>
                            </div>

                            {/* Date of Birth */}
                            <div>
                                <label htmlFor="dateOfBirth" className={dynastyTheme.components.label}>
                                    Date of Birth
                                </label>
                                <input
                                    type="date"
                                    id="dateOfBirth"
                                    name="dateOfBirth"
                                    value={profileData.dateOfBirth}
                                    onChange={handleProfileChange}
                                    className={`${dynastyTheme.components.input} w-full`}
                                />
                            </div>

                            {/* Submit Button */}
                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} disabled:opacity-50 flex items-center justify-center`}
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={20} className="mr-2" />
                                            Update Profile
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Security Tab Content */}
                {activeTab === 'security' && (
                    <div className={`${dynastyTheme.components.card.base} p-8`}>
                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                            <div className="mb-8">
                                <h3 className={dynastyTheme.components.heading.h3}>
                                    Change Password
                                </h3>
                                <p className={dynastyTheme.classes.text.neutralLight}>
                                    Update your password to keep your account secure. All changes are audit logged.
                                </p>
                            </div>

                            <div>
                                <label htmlFor="currentPassword" className={dynastyTheme.components.label}>
                                    Current Password *
                                </label>
                                <input
                                    type="password"
                                    id="currentPassword"
                                    name="currentPassword"
                                    value={passwordData.currentPassword}
                                    onChange={handlePasswordChange}
                                    required
                                    className={`${dynastyTheme.components.input} w-full`}
                                />
                            </div>

                            <div>
                                <label htmlFor="newPassword" className={dynastyTheme.components.label}>
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
                                    className={`${dynastyTheme.components.input} w-full`}
                                />
                                <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-2`}>
                                    Must be at least 8 characters long and meet AWS Cognito security requirements.
                                </p>
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className={dynastyTheme.components.label}>
                                    Confirm New Password *
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={passwordData.confirmPassword}
                                    onChange={handlePasswordChange}
                                    required
                                    className={`${dynastyTheme.components.input} w-full`}
                                />
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} disabled:opacity-50 flex items-center justify-center`}
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                                            Changing Password...
                                        </>
                                    ) : (
                                        <>
                                            <KeyRound size={20} className="mr-2" />
                                            Change Password
                                        </>
                                    )}
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
