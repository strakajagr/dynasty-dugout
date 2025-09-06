// src/pages/account/NotificationSettings.js
import React, { useState, useEffect } from 'react';
import { dynastyTheme } from '../../services/colorService';
import apiService from '../../services/apiService';
import { Bell, Mail, Smartphone, Calendar, Trophy, Users, TrendingUp, Save } from 'lucide-react';

const NotificationSettings = ({ setMessage }) => {
    const [loading, setLoading] = useState(false);
    const [preferences, setPreferences] = useState({
        email: {
            leagueUpdates: true,
            tradeOffers: true,
            waiverResults: true,
            draftReminders: true,
            injuryAlerts: false,
            weeklyRecap: true,
            promotions: false
        },
        push: {
            leagueUpdates: false,
            tradeOffers: true,
            waiverResults: true,
            draftReminders: true,
            injuryAlerts: true,
            dailyLineups: false
        },
        frequency: {
            emailDigest: 'daily', // 'realtime', 'daily', 'weekly', 'never'
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            weekendNotifications: true
        }
    });

    useEffect(() => {
        loadNotificationPreferences();
    }, []);

    const loadNotificationPreferences = async () => {
        try {
            const response = await apiService.get('profile/notification-preferences');
            if (response.data && response.data.preferences) {
                setPreferences(response.data.preferences);
            }
        } catch (error) {
            console.error('Error loading notification preferences:', error);
        }
    };

    const handleToggle = (category, setting) => {
        setPreferences(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [setting]: !prev[category][setting]
            }
        }));
    };

    const handleFrequencyChange = (setting, value) => {
        setPreferences(prev => ({
            ...prev,
            frequency: {
                ...prev.frequency,
                [setting]: value
            }
        }));
    };

    const handleSavePreferences = async () => {
        setLoading(true);
        try {
            const response = await apiService.put('profile/notification-preferences', preferences);
            if (response.data) {
                setMessage({ text: 'Notification preferences saved successfully!', type: 'success' });
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
            setMessage({ 
                text: error.response?.data?.detail || 'Failed to save notification preferences', 
                type: 'error' 
            });
        } finally {
            setLoading(false);
        }
    };

    const notificationTypes = {
        email: [
            { key: 'leagueUpdates', label: 'League Updates', icon: Users, description: 'League news and announcements' },
            { key: 'tradeOffers', label: 'Trade Offers', icon: TrendingUp, description: 'When you receive trade proposals' },
            { key: 'waiverResults', label: 'Waiver Results', icon: Trophy, description: 'Waiver claim results and priority changes' },
            { key: 'draftReminders', label: 'Draft Reminders', icon: Calendar, description: 'Upcoming draft notifications' },
            { key: 'injuryAlerts', label: 'Injury Alerts', icon: Bell, description: 'Player injury updates for your teams' },
            { key: 'weeklyRecap', label: 'Weekly Recap', icon: Mail, description: 'Weekly performance summaries' },
            { key: 'promotions', label: 'Promotions & Updates', icon: Bell, description: 'Platform updates and special offers' }
        ],
        push: [
            { key: 'leagueUpdates', label: 'League Updates', icon: Users, description: 'Real-time league activity' },
            { key: 'tradeOffers', label: 'Trade Offers', icon: TrendingUp, description: 'Instant trade notifications' },
            { key: 'waiverResults', label: 'Waiver Results', icon: Trophy, description: 'Immediate waiver outcomes' },
            { key: 'draftReminders', label: 'Draft Starting Soon', icon: Calendar, description: '15-minute draft warnings' },
            { key: 'injuryAlerts', label: 'Injury Alerts', icon: Bell, description: 'Breaking injury news' },
            { key: 'dailyLineups', label: 'Daily Lineup Reminders', icon: Users, description: 'Set your lineup reminders' }
        ]
    };

    return (
        <div className="space-y-6">
            {/* Email Notifications */}
            <div className={`${dynastyTheme.components.card.base} p-8`}>
                <div className="mb-6">
                    <h3 className={`${dynastyTheme.components.heading.h3} flex items-center`}>
                        <Mail className="mr-2" size={24} />
                        Email Notifications
                    </h3>
                    <p className={dynastyTheme.classes.text.neutralLight}>
                        Choose which updates you want to receive via email
                    </p>
                </div>

                <div className="space-y-4">
                    {notificationTypes.email.map(({ key, label, icon: Icon, description }) => (
                        <div key={key} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                            <div className="flex items-start">
                                <Icon className="mr-3 mt-1 text-gray-400" size={20} />
                                <div>
                                    <p className="font-medium text-white">{label}</p>
                                    <p className="text-sm text-gray-400">{description}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle('email', key)}
                                className={`
                                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                                    ${preferences.email[key] ? 'bg-yellow-400' : 'bg-gray-600'}
                                `}
                            >
                                <span
                                    className={`
                                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                        ${preferences.email[key] ? 'translate-x-6' : 'translate-x-1'}
                                    `}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Push Notifications */}
            <div className={`${dynastyTheme.components.card.base} p-8`}>
                <div className="mb-6">
                    <h3 className={`${dynastyTheme.components.heading.h3} flex items-center`}>
                        <Smartphone className="mr-2" size={24} />
                        Push Notifications
                    </h3>
                    <p className={dynastyTheme.classes.text.neutralLight}>
                        Real-time alerts sent to your device
                    </p>
                </div>

                <div className="space-y-4">
                    {notificationTypes.push.map(({ key, label, icon: Icon, description }) => (
                        <div key={key} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                            <div className="flex items-start">
                                <Icon className="mr-3 mt-1 text-gray-400" size={20} />
                                <div>
                                    <p className="font-medium text-white">{label}</p>
                                    <p className="text-sm text-gray-400">{description}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle('push', key)}
                                className={`
                                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                                    ${preferences.push[key] ? 'bg-yellow-400' : 'bg-gray-600'}
                                `}
                            >
                                <span
                                    className={`
                                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                        ${preferences.push[key] ? 'translate-x-6' : 'translate-x-1'}
                                    `}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Notification Frequency */}
            <div className={`${dynastyTheme.components.card.base} p-8`}>
                <div className="mb-6">
                    <h3 className={`${dynastyTheme.components.heading.h3} flex items-center`}>
                        <Calendar className="mr-2" size={24} />
                        Notification Schedule
                    </h3>
                    <p className={dynastyTheme.classes.text.neutralLight}>
                        Control when and how often you receive notifications
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Email Digest Frequency */}
                    <div>
                        <label className={dynastyTheme.components.label}>
                            Email Digest Frequency
                        </label>
                        <select
                            value={preferences.frequency.emailDigest}
                            onChange={(e) => handleFrequencyChange('emailDigest', e.target.value)}
                            className={`${dynastyTheme.components.input} w-full md:w-auto`}
                        >
                            <option value="realtime">Real-time (as they happen)</option>
                            <option value="daily">Daily Digest</option>
                            <option value="weekly">Weekly Summary</option>
                            <option value="never">Never (disabled)</option>
                        </select>
                    </div>

                    {/* Quiet Hours */}
                    <div>
                        <label className={dynastyTheme.components.label}>
                            Quiet Hours (no push notifications)
                        </label>
                        <div className="flex items-center space-x-4">
                            <div>
                                <label className="text-sm text-gray-400">From</label>
                                <input
                                    type="time"
                                    value={preferences.frequency.quietHoursStart}
                                    onChange={(e) => handleFrequencyChange('quietHoursStart', e.target.value)}
                                    className={`${dynastyTheme.components.input} ml-2`}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">To</label>
                                <input
                                    type="time"
                                    value={preferences.frequency.quietHoursEnd}
                                    onChange={(e) => handleFrequencyChange('quietHoursEnd', e.target.value)}
                                    className={`${dynastyTheme.components.input} ml-2`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Weekend Notifications */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-white">Weekend Notifications</p>
                            <p className="text-sm text-gray-400">Receive notifications on weekends</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleFrequencyChange('weekendNotifications', !preferences.frequency.weekendNotifications)}
                            className={`
                                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                                ${preferences.frequency.weekendNotifications ? 'bg-yellow-400' : 'bg-gray-600'}
                            `}
                        >
                            <span
                                className={`
                                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                    ${preferences.frequency.weekendNotifications ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSavePreferences}
                    disabled={loading}
                    className={`${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} disabled:opacity-50 flex items-center`}
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={20} className="mr-2" />
                            Save Notification Preferences
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default NotificationSettings;