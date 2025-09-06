// src/pages/MyAccount.js - Fixed with correct API endpoint
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dynastyTheme } from '../services/colorService';
import apiService from '../services/apiService';
import { User, Lock, Palette, Bell, AlertCircle, CheckCircle, Info, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Import sub-components
import ProfileSettings from './account/ProfileSettings';
import SecuritySettings from './account/SecuritySettings';
import CustomizationSettings from './account/CustomizationSettings';
import NotificationSettings from './account/NotificationSettings';

const MyAccount = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [profileData, setProfileData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        dateOfBirth: '',
        profilePicture: null
    });

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        try {
            // FIXED: Added /api prefix to the endpoint
            const response = await apiService.get('/api/account/profile');
            if (response.data && response.data.profile) {
                const profile = response.data.profile;
                setProfileData({
                    firstName: profile.given_name || '',
                    lastName: profile.family_name || '',
                    email: profile.email || '',
                    dateOfBirth: profile.birthdate ? profile.birthdate.split('T')[0] : '',
                    profilePicture: profile.picture || null
                });
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            setMessage({ text: 'Failed to load profile information', type: 'error' });
        }
    };

    const getMessageClass = (type) => {
        switch (type) {
            case 'error':
                return `bg-red-500/20 text-red-400 border-red-500/30`;
            case 'success':
                return `bg-emerald-500/20 text-emerald-400 border-emerald-500/30`;
            case 'info':
                return `bg-blue-500/20 text-blue-400 border-blue-500/30`;
            default:
                return `bg-gray-700 text-gray-400 border-gray-600/30`;
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        { id: 'customization', label: 'Customization', icon: Palette },
        { id: 'notifications', label: 'Notifications', icon: Bell }
    ];

    return (
        <div className={dynastyTheme.patterns.pageLayout}>
            <div className={dynastyTheme.components.container}>
                {/* Header Section */}
                <div className={`${dynastyTheme.components.card.highlighted} p-8 text-center mb-12 relative`}>
                    <button 
                        onClick={() => navigate(-1)} 
                        className='absolute left-4 top-4 flex items-center text-yellow-400 hover:text-yellow-300 transition-colors'
                    >
                        <ArrowLeft size={24} className='mr-2' />
                        Back
                    </button>
                    <h1 className={dynastyTheme.components.heading.h1}>
                        My Account
                    </h1>
                    <p className={`text-xl ${dynastyTheme.classes.text.neutralLight}`}>
                        Manage your profile, security, and personalization settings
                    </p>
                </div>

                {/* Message Display Area */}
                {message.text && (
                    <div className={`${getMessageClass(message.type)} border p-4 rounded-lg mb-6 flex items-center`}>
                        {message.type === 'error' && <AlertCircle size={20} className="mr-2" />}
                        {message.type === 'success' && <CheckCircle size={20} className="mr-2" />}
                        {message.type === 'info' && <Info size={20} className="mr-2" />}
                        <span>{message.text}</span>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            className={`
                                flex items-center px-6 py-3 rounded-lg font-semibold transition-all
                                ${activeTab === id
                                    ? `bg-yellow-400 text-black`
                                    : `bg-gray-800 text-yellow-400 hover:bg-gray-700`
                                }
                            `}
                            onClick={() => setActiveTab(id)}
                        >
                            <Icon size={20} className="mr-2" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[600px]">
                    {activeTab === 'profile' && (
                        <ProfileSettings 
                            profileData={profileData}
                            setProfileData={setProfileData}
                            setMessage={setMessage}
                        />
                    )}
                    {activeTab === 'security' && (
                        <SecuritySettings 
                            setMessage={setMessage}
                        />
                    )}
                    {activeTab === 'customization' && (
                        <CustomizationSettings 
                            profileData={profileData}
                            setMessage={setMessage}
                        />
                    )}
                    {activeTab === 'notifications' && (
                        <NotificationSettings 
                            setMessage={setMessage}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyAccount;