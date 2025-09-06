// src/pages/account/WelcomeBannerEditor.js
import React, { useState, useEffect } from 'react';
import { dynastyTheme } from '../../services/colorService';
import apiService from '../../services/apiService';
import { 
    Save, UploadCloud, ImageIcon, Palette, Type, 
    Sliders, RotateCcw, Download
} from 'lucide-react';

const WelcomeBannerEditor = ({ profileData = {}, setMessage, onPreviewUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [welcomeSettings, setWelcomeSettings] = useState({
        backgroundImage: '',
        backgroundType: 'gradient',
        backgroundColor: '#0a0a0a',
        gradientStart: '#1a1a1a',  // FIXED: Dynasty dark gray
        gradientEnd: '#0a0a0a',    // FIXED: Dynasty nearly black
        textColor: '#facc15',      // FIXED: Dynasty bright gold
        fontSize: 'text-3xl',
        fontWeight: 'font-bold',
        customGreeting: '',
        customSubtext: '',
        imageOpacity: 0.3,
        textShadow: true,
        bannerHeight: 'medium'
    });

    const presetThemes = [
        {
            name: 'Dynasty Default',
            settings: {
                backgroundType: 'gradient',
                gradientStart: '#1a1a1a',  // FIXED: Dynasty dark gray
                gradientEnd: '#0a0a0a',    // FIXED: Dynasty nearly black  
                textColor: '#facc15',      // FIXED: Dynasty bright gold
                fontSize: 'text-3xl',
                fontWeight: 'font-bold'
            }
        },
        {
            name: 'Sunrise',
            settings: {
                backgroundType: 'gradient',
                gradientStart: '#fbbf24',
                gradientEnd: '#dc2626',
                textColor: '#ffffff',
                fontSize: 'text-4xl',
                fontWeight: 'font-extrabold'
            }
        },
        {
            name: 'Ocean',
            settings: {
                backgroundType: 'gradient',
                gradientStart: '#0891b2',
                gradientEnd: '#1e3a8a',
                textColor: '#e0f2fe',
                fontSize: 'text-3xl',
                fontWeight: 'font-semibold'
            }
        },
        {
            name: 'Forest',
            settings: {
                backgroundType: 'gradient',
                gradientStart: '#16a34a',
                gradientEnd: '#14532d',
                textColor: '#bbf7d0',
                fontSize: 'text-3xl',
                fontWeight: 'font-bold'
            }
        }
    ];

    useEffect(() => {
        loadWelcomeSettings();
    }, []);

    useEffect(() => {
        // Update preview whenever settings change
        if (onPreviewUpdate) {
            onPreviewUpdate(welcomeSettings);
        }
    }, [welcomeSettings, onPreviewUpdate]);

    const loadWelcomeSettings = async () => {
        try {
            // FIXED: Added leading slash
            const response = await apiService.get('/api/account/welcome-settings');
            if (response.data && response.data.settings) {
                setWelcomeSettings(prev => ({ ...prev, ...response.data.settings }));
            }
        } catch (error) {
            console.error('Error loading welcome settings:', error);
        }
    };

    const handleWelcomeSettingChange = (field, value) => {
        setWelcomeSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleBannerImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setMessage({ text: 'Image must be less than 5MB.', type: 'error' });
            return;
        }
        if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
            setMessage({ text: 'Image must be JPEG, PNG, GIF, or WebP.', type: 'error' });
            return;
        }

        setUploadingBanner(true);
        setMessage({ text: 'Uploading banner image...', type: 'info' });

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'welcome_banner');

            // FIXED: Added leading slash
            const response = await apiService.post('/api/account/upload-banner-image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data && response.data.success) {
                setWelcomeSettings(prev => ({ 
                    ...prev, 
                    backgroundImage: response.data.image_url,
                    backgroundType: 'image'
                }));
                setMessage({
                    text: 'Banner image uploaded successfully!',
                    type: 'success'
                });
            } else {
                setMessage({
                    text: response.data?.message || 'Failed to upload banner image.',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Upload error:', error);
            setMessage({
                text: 'Network error. Please try again.',
                type: 'error'
            });
        } finally {
            setUploadingBanner(false);
        }
    };

    const handleWelcomeSettingsSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            // FIXED: Added leading slash
            const response = await apiService.put('/api/account/welcome-settings', welcomeSettings);

            if (response.data) {
                setMessage({ text: 'Welcome banner settings saved successfully!', type: 'success' });
                window.dispatchEvent(new CustomEvent('welcomeSettingsUpdated', { detail: welcomeSettings }));
            }
        } catch (error) {
            console.error('Settings save error:', error);
            setMessage({
                text: error.response?.data?.detail || 'Failed to save settings.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const applyPreset = (preset) => {
        setWelcomeSettings(prev => ({ ...prev, ...preset.settings }));
        setMessage({ text: `Applied "${preset.name}" theme`, type: 'info' });
    };

    const resetWelcomeSettings = () => {
        const defaultSettings = {
            backgroundImage: '',
            backgroundType: 'gradient',
            backgroundColor: '#0a0a0a',    // FIXED: Dynasty dark
            gradientStart: '#1a1a1a',      // FIXED: Dynasty dark gray
            gradientEnd: '#0a0a0a',        // FIXED: Dynasty nearly black
            textColor: '#facc15',          // FIXED: Dynasty bright gold
            fontSize: 'text-3xl',
            fontWeight: 'font-bold',
            customGreeting: '',
            customSubtext: '',
            imageOpacity: 0.3,
            textShadow: true,
            bannerHeight: 'medium'
        };
        setWelcomeSettings(defaultSettings);
        setMessage({ text: 'Settings reset to defaults', type: 'info' });
    };

    return (
        <div className={`${dynastyTheme.components.card.base} p-8`}>
            <form onSubmit={handleWelcomeSettingsSubmit} className="space-y-8">
                <div className="mb-8">
                    <h3 className={dynastyTheme.components.heading.h3}>
                        Customize Welcome Banner
                    </h3>
                    <p className={dynastyTheme.classes.text.neutralLight}>
                        Personalize your dashboard greeting with custom backgrounds, colors, and text
                    </p>
                </div>

                {/* Preset Themes */}
                <div>
                    <h4 className="font-semibold text-white mb-3">Quick Presets</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {presetThemes.map(preset => (
                            <button
                                key={preset.name}
                                type="button"
                                onClick={() => applyPreset(preset)}
                                className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all text-left"
                            >
                                <div className="flex space-x-2 mb-2">
                                    <div 
                                        className="w-6 h-6 rounded"
                                        style={{ background: `linear-gradient(135deg, ${preset.settings.gradientStart}, ${preset.settings.gradientEnd})` }}
                                    />
                                    <div 
                                        className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                                        style={{ backgroundColor: preset.settings.textColor }}
                                    >
                                        A
                                    </div>
                                </div>
                                <p className="text-sm text-gray-300">{preset.name}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Background Settings */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-white">Background</h4>
                    
                    {/* Background Type Selector */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { value: 'gradient', label: 'Gradient', icon: Palette },
                            { value: 'image', label: 'Image', icon: ImageIcon },
                            { value: 'solid', label: 'Solid Color', icon: Palette }
                        ].map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => handleWelcomeSettingChange('backgroundType', value)}
                                className={`
                                    p-4 rounded-lg border-2 transition-all
                                    ${welcomeSettings.backgroundType === value
                                        ? 'border-yellow-400 bg-yellow-400/10'
                                        : 'border-gray-600 hover:border-gray-500'
                                    }
                                `}
                            >
                                <Icon className={`w-6 h-6 mx-auto mb-2 ${
                                    welcomeSettings.backgroundType === value 
                                        ? 'text-yellow-400' 
                                        : 'text-gray-400'
                                }`} />
                                <span className={`text-sm ${
                                    welcomeSettings.backgroundType === value 
                                        ? 'text-yellow-400' 
                                        : 'text-gray-300'
                                }`}>
                                    {label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Image Upload */}
                    {welcomeSettings.backgroundType === 'image' && (
                        <div className="space-y-3">
                            {welcomeSettings.backgroundImage ? (
                                <div>
                                    <div className="relative h-32 rounded-lg overflow-hidden">
                                        <img 
                                            src={welcomeSettings.backgroundImage} 
                                            alt="Banner background" 
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <span className="text-white text-sm">Current Background</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <input
                                            type="file"
                                            id="bannerImage"
                                            accept="image/*"
                                            onChange={handleBannerImageUpload}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="bannerImage"
                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer flex items-center text-sm"
                                        >
                                            <UploadCloud size={16} className="mr-2" />
                                            Change Image
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => handleWelcomeSettingChange('backgroundImage', '')}
                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-gray-500 transition-colors">
                                    <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                    <input
                                        type="file"
                                        id="bannerImageUpload"
                                        accept="image/*"
                                        onChange={handleBannerImageUpload}
                                        className="hidden"
                                        disabled={uploadingBanner}
                                    />
                                    <label
                                        htmlFor="bannerImageUpload"
                                        className={`${dynastyTheme.utils.getComponent('button', 'primary', 'sm')} cursor-pointer inline-flex items-center ${
                                            uploadingBanner ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        {uploadingBanner ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud size={16} className="mr-2" />
                                                Choose File
                                            </>
                                        )}
                                    </label>
                                    <p className="text-xs text-gray-400 mt-2">JPEG, PNG, GIF, or WebP up to 5MB</p>
                                </div>
                            )}
                            
                            {/* Image Opacity */}
                            {welcomeSettings.backgroundImage && (
                                <div>
                                    <label className="text-sm text-gray-300">
                                        Image Opacity: {Math.round(welcomeSettings.imageOpacity * 100)}%
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={welcomeSettings.imageOpacity * 100}
                                        onChange={(e) => handleWelcomeSettingChange('imageOpacity', e.target.value / 100)}
                                        className="w-full"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Gradient Settings */}
                    {welcomeSettings.backgroundType === 'gradient' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-300">Start Color</label>
                                <div className="flex items-center space-x-2 mt-1">
                                    <input
                                        type="color"
                                        value={welcomeSettings.gradientStart}
                                        onChange={(e) => handleWelcomeSettingChange('gradientStart', e.target.value)}
                                        className="w-12 h-10 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={welcomeSettings.gradientStart}
                                        onChange={(e) => handleWelcomeSettingChange('gradientStart', e.target.value)}
                                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-300">End Color</label>
                                <div className="flex items-center space-x-2 mt-1">
                                    <input
                                        type="color"
                                        value={welcomeSettings.gradientEnd}
                                        onChange={(e) => handleWelcomeSettingChange('gradientEnd', e.target.value)}
                                        className="w-12 h-10 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={welcomeSettings.gradientEnd}
                                        onChange={(e) => handleWelcomeSettingChange('gradientEnd', e.target.value)}
                                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Solid Color */}
                    {welcomeSettings.backgroundType === 'solid' && (
                        <div>
                            <label className="text-sm text-gray-300">Background Color</label>
                            <div className="flex items-center space-x-2 mt-1">
                                <input
                                    type="color"
                                    value={welcomeSettings.backgroundColor}
                                    onChange={(e) => handleWelcomeSettingChange('backgroundColor', e.target.value)}
                                    className="w-12 h-10 rounded cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={welcomeSettings.backgroundColor}
                                    onChange={(e) => handleWelcomeSettingChange('backgroundColor', e.target.value)}
                                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm font-mono"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Text Settings */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-white flex items-center">
                        <Type className="mr-2" size={20} />
                        Text Settings
                    </h4>

                    <div>
                        <label className="text-sm text-gray-300">Custom Greeting (optional)</label>
                        <input
                            type="text"
                            value={welcomeSettings.customGreeting}
                            onChange={(e) => handleWelcomeSettingChange('customGreeting', e.target.value)}
                            placeholder={`Welcome back, ${profileData?.firstName || 'Tony'}!`}
                            className="w-full mt-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded"
                            maxLength={100}
                        />
                    </div>

                    <div>
                        <label className="text-sm text-gray-300">Custom Subtext (optional)</label>
                        <input
                            type="text"
                            value={welcomeSettings.customSubtext}
                            onChange={(e) => handleWelcomeSettingChange('customSubtext', e.target.value)}
                            placeholder="Your dynasty awaits. Manage your leagues and build your empire."
                            className="w-full mt-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded"
                            maxLength={150}
                        />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm text-gray-300">Text Color</label>
                            <div className="flex items-center space-x-2 mt-1">
                                <input
                                    type="color"
                                    value={welcomeSettings.textColor}
                                    onChange={(e) => handleWelcomeSettingChange('textColor', e.target.value)}
                                    className="w-10 h-8 rounded cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={welcomeSettings.textColor}
                                    onChange={(e) => handleWelcomeSettingChange('textColor', e.target.value)}
                                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Font Size</label>
                            <select
                                value={welcomeSettings.fontSize}
                                onChange={(e) => handleWelcomeSettingChange('fontSize', e.target.value)}
                                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                            >
                                <option value="text-xl">Small</option>
                                <option value="text-2xl">Medium</option>
                                <option value="text-3xl">Large</option>
                                <option value="text-4xl">Extra Large</option>
                                <option value="text-5xl">Huge</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Font Weight</label>
                            <select
                                value={welcomeSettings.fontWeight}
                                onChange={(e) => handleWelcomeSettingChange('fontWeight', e.target.value)}
                                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                            >
                                <option value="font-normal">Normal</option>
                                <option value="font-medium">Medium</option>
                                <option value="font-semibold">Semi Bold</option>
                                <option value="font-bold">Bold</option>
                                <option value="font-extrabold">Extra Bold</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-sm text-gray-300">Banner Height</label>
                            <select
                                value={welcomeSettings.bannerHeight}
                                onChange={(e) => handleWelcomeSettingChange('bannerHeight', e.target.value)}
                                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
                            >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                                <option value="xlarge">Extra Large</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-300">Text Shadow</label>
                        <button
                            type="button"
                            onClick={() => handleWelcomeSettingChange('textShadow', !welcomeSettings.textShadow)}
                            className={`
                                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                                ${welcomeSettings.textShadow ? 'bg-yellow-400' : 'bg-gray-600'}
                            `}
                        >
                            <span
                                className={`
                                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                    ${welcomeSettings.textShadow ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            />
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-700">
                    <button
                        type="button"
                        onClick={resetWelcomeSettings}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center"
                    >
                        <RotateCcw size={20} className="mr-2" />
                        Reset to Defaults
                    </button>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} disabled:opacity-50 flex items-center`}
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={20} className="mr-2" />
                                Save Settings
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default WelcomeBannerEditor;