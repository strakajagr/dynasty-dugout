// src/pages/account/ProfileSettings.js - FIXED WITH PRESIGNED URL PATTERN
import React, { useState, useCallback } from 'react';
import { dynastyTheme } from '../../services/colorService';
import apiService from '../../services/apiService';
import { Save, UploadCloud, Image, User, Mail, Calendar } from 'lucide-react';

const ProfileSettings = ({ profileData, setProfileData, setMessage }) => {
    const [loading, setLoading] = useState(false);
    const [profilePictureUrl, setProfilePictureUrl] = useState(profileData.profilePicture);
    const [uploadingPicture, setUploadingPicture] = useState(false);

    const handleProfileChange = useCallback((e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
    }, [setProfileData]);

    const handleProfilePictureChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setMessage({ text: 'Profile picture must be less than 10MB.', type: 'error' });
            return;
        }
        if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
            setMessage({ text: 'Profile picture must be JPEG, PNG, or GIF.', type: 'error' });
            return;
        }

        setUploadingPicture(true);
        setMessage({ text: 'Uploading profile picture...', type: 'info' });

        try {
            // Use the accountAPI function that follows same pattern as team logos
            const result = await apiService.account.uploadProfilePicture(file);
            
            if (result.success) {
                // Update UI with the new profile picture URL
                const publicUrl = result.profile_picture_url;
                
                // Force a cache-busting reload of the image
                const timestamp = new Date().getTime();
                setProfilePictureUrl(`${publicUrl}?t=${timestamp}`);
                setProfileData(prev => ({ ...prev, profilePicture: publicUrl }));
                
                setMessage({
                    text: 'Profile picture uploaded successfully!',
                    type: 'success'
                });
            } else {
                throw new Error('Upload failed');
            }

        } catch (error) {
            console.error('Upload error:', error);
            setMessage({
                text: error.message || 'Failed to upload profile picture.',
                type: 'error'
            });
        } finally {
            setUploadingPicture(false);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

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
            const updateData = {
                firstName: profileData.firstName.trim(),
                lastName: profileData.lastName.trim(),
                email: profileData.email.trim()
            };

            if (profileData.dateOfBirth) {
                updateData.dateOfBirth = profileData.dateOfBirth;
            }

            const response = await apiService.put('/api/account/update-profile', updateData);

            if (response.data && response.data.success !== false) {
                setMessage({
                    text: `Profile updated successfully! ${response.data.changes_made || 0} changes made.`,
                    type: 'success'
                });
            } else {
                setMessage({
                    text: response.data?.message || 'Failed to update profile.',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Profile update error:', error);
            setMessage({
                text: error.response?.data?.detail || 'Network error. Please try again.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`${dynastyTheme.components.card.base} p-8`}>
            <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="mb-6">
                    <h3 className={`${dynastyTheme.components.heading.h3} flex items-center`}>
                        <User className="mr-2" size={24} />
                        Profile Information
                    </h3>
                    <p className={dynastyTheme.classes.text.neutralLight}>
                        Update your personal information and profile picture
                    </p>
                </div>

                {/* Profile Picture Section */}
                <div>
                    <label className={dynastyTheme.components.label}>
                        Profile Picture
                    </label>
                    <div className="flex items-center gap-6">
                        <div className={`w-24 h-24 rounded-full border-2 border-yellow-400 flex items-center justify-center overflow-hidden bg-gray-800`}>
                            {profilePictureUrl ? (
                                <img
                                    src={profilePictureUrl}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        console.error('Image failed to load:', profilePictureUrl);
                                        setProfilePictureUrl(null);
                                    }}
                                />
                            ) : (
                                <Image size={32} className="text-gray-500" />
                            )}
                        </div>
                        <div>
                            <input
                                type="file"
                                id="profilePicture"
                                accept="image/*"
                                onChange={handleProfilePictureChange}
                                className="hidden"
                                disabled={uploadingPicture}
                            />
                            <label
                                htmlFor="profilePicture"
                                className={`${dynastyTheme.utils.getComponent('button', 'primary', 'md')} cursor-pointer flex items-center ${
                                    uploadingPicture ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                <UploadCloud size={20} className="mr-2" />
                                {uploadingPicture ? 'Uploading...' : 'Choose Image'}
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
                        <label htmlFor="firstName" className={`${dynastyTheme.components.label} flex items-center`}>
                            <User size={16} className="mr-2" />
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
                    <label htmlFor="email" className={`${dynastyTheme.components.label} flex items-center`}>
                        <Mail size={16} className="mr-2" />
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
                        Changing your email will require verification
                    </p>
                </div>

                {/* Date of Birth */}
                <div>
                    <label htmlFor="dateOfBirth" className={`${dynastyTheme.components.label} flex items-center`}>
                        <Calendar size={16} className="mr-2" />
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
                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading || uploadingPicture}
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
    );
};

export default ProfileSettings;