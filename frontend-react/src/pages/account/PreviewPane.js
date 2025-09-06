// src/pages/account/PreviewPane.js
import React from 'react';
import { dynastyTheme } from '../../services/colorService';

const PreviewPane = ({ type, data, profileData }) => {
    const renderBannerPreview = () => {
        const heightClasses = {
            small: 'py-4',
            medium: 'py-6',
            large: 'py-8',
            xlarge: 'py-12'
        };

        const getBackgroundStyle = () => {
            if (data.backgroundType === 'image' && data.backgroundImage) {
                return {
                    backgroundImage: `linear-gradient(rgba(0,0,0,${1 - data.imageOpacity}), rgba(0,0,0,${1 - data.imageOpacity})), url(${data.backgroundImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                };
            } else if (data.backgroundType === 'gradient') {
                return {
                    background: `linear-gradient(135deg, ${data.gradientStart}, ${data.gradientEnd})`
                };
            } else {
                return {
                    backgroundColor: data.backgroundColor
                };
            }
        };

        const userName = profileData?.firstName || 'Tony';
        const greeting = data.customGreeting || `Welcome back, ${userName}!`;
        const subtext = data.customSubtext || 'Your dynasty awaits. Manage your leagues and build your empire.';

        return (
            <div 
                className={`rounded-lg ${heightClasses[data.bannerHeight]} px-6`}
                style={getBackgroundStyle()}
            >
                <h2 
                    className={`${data.fontSize} ${data.fontWeight} mb-2`}
                    style={{ 
                        color: data.textColor,
                        textShadow: data.textShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none'
                    }}
                >
                    {greeting}
                </h2>
                <p 
                    style={{ 
                        color: data.textColor,
                        opacity: 0.9,
                        textShadow: data.textShadow ? '1px 1px 2px rgba(0,0,0,0.5)' : 'none'
                    }}
                >
                    {subtext}
                </p>
            </div>
        );
    };

    const renderThemePreview = () => {
        return (
            <div className="p-6 rounded-lg" style={{ backgroundColor: data.backgroundColor }}>
                <h3 className="text-xl font-bold mb-2" style={{ color: data.primaryColor }}>
                    Theme Preview
                </h3>
                <p style={{ color: data.textColor }}>
                    This is how your theme will look across the application.
                </p>
                <div className="mt-4 space-y-2">
                    <button 
                        className="px-4 py-2 rounded font-medium"
                        style={{ 
                            backgroundColor: data.primaryColor,
                            color: data.buttonTextColor || '#000'
                        }}
                    >
                        Primary Button
                    </button>
                </div>
            </div>
        );
    };

    const renderTablePreview = () => {
        return (
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: data.borderColor }}>
                <table className="w-full">
                    <thead style={{ backgroundColor: data.headerBackground }}>
                        <tr>
                            <th className="px-4 py-2 text-left" style={{ color: data.headerText }}>Player</th>
                            <th className="px-4 py-2 text-left" style={{ color: data.headerText }}>Team</th>
                            <th className="px-4 py-2 text-left" style={{ color: data.headerText }}>Stats</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3].map(i => (
                            <tr 
                                key={i}
                                className="hover:opacity-80 transition-opacity"
                                style={{ 
                                    backgroundColor: i % 2 === 0 ? data.evenRowColor : data.oddRowColor
                                }}
                            >
                                <td className="px-4 py-2" style={{ color: data.cellText }}>Sample Player {i}</td>
                                <td className="px-4 py-2" style={{ color: data.cellText }}>NYY</td>
                                <td className="px-4 py-2" style={{ color: data.cellText }}>0.300</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className={`${dynastyTheme.components.card.base} p-6`}>
            <div className="mb-4">
                <h4 className="font-semibold text-white">Live Preview</h4>
                <p className="text-xs text-gray-400">This is how your customization will appear</p>
            </div>
            <div className="border-2 border-gray-700 rounded-lg overflow-hidden">
                {type === 'banner' && renderBannerPreview()}
                {type === 'theme' && renderThemePreview()}
                {type === 'table' && renderTablePreview()}
            </div>
        </div>
    );
};

export default PreviewPane;