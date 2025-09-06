// src/pages/account/SecuritySettings.js
import React, { useState, useCallback } from 'react';
import { dynastyTheme } from '../../services/colorService';
import apiService from '../../services/apiService';
import { KeyRound, Shield, Smartphone, AlertTriangle, Lock } from 'lucide-react';

const SecuritySettings = ({ setMessage }) => {
    const [loading, setLoading] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);

    const handlePasswordChange = useCallback((e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

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

        try {
            const response = await apiService.put('profile/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });

            if (response.data) {
                setMessage({ text: 'Password changed successfully!', type: 'success' });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }
        } catch (error) {
            console.error('Password change error:', error);
            setMessage({
                text: error.response?.data?.detail || 'Failed to change password.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTwoFactor = async () => {
        setLoading(true);
        try {
            if (!twoFactorEnabled) {
                setShowTwoFactorSetup(true);
                // In real implementation, this would call API to get QR code
                // const response = await apiService.post('auth/2fa/enable');
                setMessage({ text: 'Two-factor authentication setup initiated', type: 'info' });
            } else {
                // const response = await apiService.post('auth/2fa/disable');
                setTwoFactorEnabled(false);
                setMessage({ text: 'Two-factor authentication disabled', type: 'success' });
            }
        } catch (error) {
            setMessage({ text: 'Failed to update two-factor authentication', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Password Change Section */}
            <div className={`${dynastyTheme.components.card.base} p-8`}>
                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <div className="mb-6">
                        <h3 className={`${dynastyTheme.components.heading.h3} flex items-center`}>
                            <Lock className="mr-2" size={24} />
                            Change Password
                        </h3>
                        <p className={dynastyTheme.classes.text.neutralLight}>
                            Update your password to keep your account secure
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
                            autoComplete="current-password"
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
                            autoComplete="new-password"
                        />
                        <p className={`${dynastyTheme.classes.text.neutralLight} text-sm mt-2`}>
                            Must be at least 8 characters long
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
                            autoComplete="new-password"
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

            {/* Two-Factor Authentication Section */}
            <div className={`${dynastyTheme.components.card.base} p-8`}>
                <div className="mb-6">
                    <h3 className={`${dynastyTheme.components.heading.h3} flex items-center`}>
                        <Shield className="mr-2" size={24} />
                        Two-Factor Authentication
                    </h3>
                    <p className={dynastyTheme.classes.text.neutralLight}>
                        Add an extra layer of security to your account
                    </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center">
                        <Smartphone className="mr-3 text-yellow-400" size={24} />
                        <div>
                            <p className="font-medium text-white">Authenticator App</p>
                            <p className="text-sm text-gray-400">
                                {twoFactorEnabled ? 'Enabled - Your account is protected' : 'Not enabled'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleToggleTwoFactor}
                        disabled={loading}
                        className={`${
                            twoFactorEnabled 
                                ? dynastyTheme.utils.getComponent('button', 'secondary', 'md')
                                : dynastyTheme.utils.getComponent('button', 'primary', 'md')
                        } disabled:opacity-50`}
                    >
                        {twoFactorEnabled ? 'Disable' : 'Enable'}
                    </button>
                </div>

                {showTwoFactorSetup && !twoFactorEnabled && (
                    <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                        <h4 className="font-semibold text-white mb-3">Setup Instructions</h4>
                        <ol className="list-decimal list-inside space-y-2 text-gray-300">
                            <li>Download an authenticator app (Google Authenticator, Authy, etc.)</li>
                            <li>Scan the QR code below with your app</li>
                            <li>Enter the 6-digit code from your app to verify</li>
                        </ol>
                        <div className="mt-4 p-4 bg-gray-900 rounded text-center">
                            <p className="text-gray-500">[QR Code Placeholder]</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Security Recommendations */}
            <div className={`${dynastyTheme.components.card.base} p-8`}>
                <div className="mb-6">
                    <h3 className={`${dynastyTheme.components.heading.h3} flex items-center`}>
                        <AlertTriangle className="mr-2 text-yellow-400" size={24} />
                        Security Recommendations
                    </h3>
                </div>
                <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start">
                        <span className="text-yellow-400 mr-2">•</span>
                        Use a unique password that you don't use on other sites
                    </li>
                    <li className="flex items-start">
                        <span className="text-yellow-400 mr-2">•</span>
                        Enable two-factor authentication for maximum security
                    </li>
                    <li className="flex items-start">
                        <span className="text-yellow-400 mr-2">•</span>
                        Regularly review your account activity and authorized devices
                    </li>
                    <li className="flex items-start">
                        <span className="text-yellow-400 mr-2">•</span>
                        Never share your password or authentication codes with anyone
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default SecuritySettings;