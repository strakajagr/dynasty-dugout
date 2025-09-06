// src/pages/account/CustomizationSettings.js
import React, { useState } from 'react';
import { dynastyTheme } from '../../services/colorService';
import { Palette, Layout, Table, CreditCard, Eye } from 'lucide-react';
import WelcomeBannerEditor from './WelcomeBannerEditor';
import PreviewPane from './PreviewPane';

const CustomizationSettings = ({ profileData, setMessage }) => {
    const [activeCustomization, setActiveCustomization] = useState('banner');
    const [showPreview, setShowPreview] = useState(false);
    const [currentPreviewData, setCurrentPreviewData] = useState(null);

    const customizationOptions = [
        { id: 'banner', label: 'Welcome Banner', icon: Layout, description: 'Customize your dashboard greeting' },
        { id: 'theme', label: 'Color Theme', icon: Palette, description: 'Choose your color scheme', coming: true },
        { id: 'tables', label: 'Table Styles', icon: Table, description: 'Customize data tables', coming: true },
        { id: 'cards', label: 'League Cards', icon: CreditCard, description: 'Style your league cards', coming: true }
    ];

    const handlePreviewUpdate = (data, type) => {
        setCurrentPreviewData({ data, type });
        setShowPreview(true);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
                <div className={`${dynastyTheme.components.card.base} p-4`}>
                    <h3 className="font-semibold text-white mb-4">Customization Options</h3>
                    <nav className="space-y-2">
                        {customizationOptions.map(({ id, label, icon: Icon, description, coming }) => (
                            <button
                                key={id}
                                onClick={() => !coming && setActiveCustomization(id)}
                                disabled={coming}
                                className={`
                                    w-full text-left p-3 rounded-lg transition-all
                                    ${activeCustomization === id && !coming
                                        ? 'bg-yellow-400/20 border border-yellow-400/30'
                                        : coming
                                        ? 'bg-gray-800/50 opacity-50 cursor-not-allowed'
                                        : 'hover:bg-gray-800'
                                    }
                                `}
                            >
                                <div className="flex items-start">
                                    <Icon className={`mr-3 mt-1 ${
                                        activeCustomization === id ? 'text-yellow-400' : 'text-gray-400'
                                    }`} size={20} />
                                    <div className="flex-1">
                                        <div className="flex items-center">
                                            <span className={`font-medium ${
                                                activeCustomization === id ? 'text-yellow-400' : 'text-white'
                                            }`}>
                                                {label}
                                            </span>
                                            {coming && (
                                                <span className="ml-2 text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">
                                                    Coming Soon
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">{description}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Preview Toggle */}
                <div className={`${dynastyTheme.components.card.base} p-4 mt-4`}>
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`w-full ${dynastyTheme.utils.getComponent('button', 'secondary', 'md')} flex items-center justify-center`}
                    >
                        <Eye size={20} className="mr-2" />
                        {showPreview ? 'Hide' : 'Show'} Live Preview
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3">
                {/* Preview Pane */}
                {showPreview && currentPreviewData && (
                    <div className="mb-6">
                        <PreviewPane 
                            type={currentPreviewData.type}
                            data={currentPreviewData.data}
                            profileData={profileData}
                        />
                    </div>
                )}

                {/* Content Based on Selection */}
                {activeCustomization === 'banner' && (
                    <WelcomeBannerEditor 
                        profileData={profileData}
                        setMessage={setMessage}
                        onPreviewUpdate={(data) => handlePreviewUpdate(data, 'banner')}
                    />
                )}

                {activeCustomization === 'theme' && (
                    <div className={`${dynastyTheme.components.card.base} p-8`}>
                        <h3 className={dynastyTheme.components.heading.h3}>Color Theme</h3>
                        <p className={dynastyTheme.classes.text.neutralLight}>
                            Custom color themes coming soon! You'll be able to choose from preset themes or create your own.
                        </p>
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                                { name: 'Dynasty Gold', colors: ['#eab308', '#111827'] },
                                { name: 'Ocean Blue', colors: ['#3b82f6', '#1e3a8a'] },
                                { name: 'Forest Green', colors: ['#22c55e', '#14532d'] },
                                { name: 'Sunset Orange', colors: ['#fb923c', '#7c2d12'] },
                                { name: 'Royal Purple', colors: ['#a855f7', '#581c87'] },
                                { name: 'Midnight', colors: ['#6366f1', '#1e1b4b'] }
                            ].map(theme => (
                                <div key={theme.name} className="p-4 bg-gray-800 rounded-lg opacity-50">
                                    <div className="flex space-x-2 mb-2">
                                        {theme.colors.map((color, i) => (
                                            <div 
                                                key={i}
                                                className="w-8 h-8 rounded"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-sm text-gray-400">{theme.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeCustomization === 'tables' && (
                    <div className={`${dynastyTheme.components.card.base} p-8`}>
                        <h3 className={dynastyTheme.components.heading.h3}>Table Customization</h3>
                        <p className={dynastyTheme.classes.text.neutralLight}>
                            Table styling options coming soon! You'll be able to customize row colors, text sizes, and more.
                        </p>
                    </div>
                )}

                {activeCustomization === 'cards' && (
                    <div className={`${dynastyTheme.components.card.base} p-8`}>
                        <h3 className={dynastyTheme.components.heading.h3}>League Card Styles</h3>
                        <p className={dynastyTheme.classes.text.neutralLight}>
                            League card customization coming soon! Choose how your leagues are displayed on the dashboard.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomizationSettings;