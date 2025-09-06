// src/pages/league-dashboard/TeamSetup.js
import React, { useState, useEffect } from 'react';
import { Save, Upload, Palette, Type, MessageSquare, AlertCircle, CheckCircle, Camera, RotateCcw } from 'lucide-react';
import { leaguesAPI } from '../../services/apiService';
import { dynastyTheme } from '../../services/colorService';

const TeamSetup = ({ leagueId, userTeam, onTeamUpdated, user }) => {
  const [formData, setFormData] = useState({
    team_name: '',
    manager_name: '',
    team_logo_url: '',
    team_colors: {
      primary: '#eab308',
      secondary: '#1c1917'
    },
    team_motto: ''
  });
  
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Predefined color options
  const colorOptions = [
    { name: 'Dynasty Gold', primary: '#eab308', secondary: '#1c1917' },
    { name: 'Red Sox', primary: '#bd3039', secondary: '#132448' },
    { name: 'Yankees', primary: '#132448', secondary: '#c4ced4' },
    { name: 'Dodgers', primary: '#005a9c', secondary: '#ffffff' },
    { name: 'Giants', primary: '#fd5a1e', secondary: '#27251f' },
    { name: 'Cardinals', primary: '#c41e3a', secondary: '#fedb00' },
    { name: 'Athletics', primary: '#003831', secondary: '#efb21e' },
    { name: 'Brewers', primary: '#0a2351', secondary: '#b5985a' }
  ];

  // Load current team data
  useEffect(() => {
    if (userTeam) {
      setFormData({
        team_name: userTeam.team_name || '',
        manager_name: userTeam.manager_name || user?.given_name || user?.firstName || '',
        team_logo_url: userTeam.team_logo_url || '',
        team_colors: userTeam.team_colors || formData.team_colors,
        team_motto: userTeam.team_motto || ''
      });
      
      if (userTeam.team_logo_url) {
        setLogoPreview(userTeam.team_logo_url);
      }
    }
  }, [userTeam, user]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle color selection
  const handleColorSelect = (colors) => {
    setFormData(prev => ({
      ...prev,
      team_colors: colors
    }));
  };

  // Handle file selection and preview
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file (PNG, JPG, etc.)');
        return;
      }
      
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        setError('File size must be less than 2MB');
        return;
      }
      
      setLogoFile(file);
      setError('');
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Upload logo to S3 using real implementation
  const uploadLogo = async () => {
    if (!logoFile) return formData.team_logo_url;
    
    setIsUploading(true);
    try {
      const uploadResult = await leaguesAPI.uploadTeamLogo(leagueId, logoFile);
      
      if (uploadResult.success) {
        console.log('Logo uploaded successfully:', uploadResult.logo_url);
        return uploadResult.logo_url;
      } else {
        throw new Error('Failed to upload logo to S3');
      }
    } catch (err) {
      console.error('Logo upload failed:', err);
      throw new Error(`Failed to upload logo: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    
    try {
      // Upload logo if selected
      let logoUrl = formData.team_logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }
      
      // Submit team setup
      const response = await leaguesAPI.setupTeam(leagueId, {
        team_name: formData.team_name,
        manager_name: formData.manager_name,
        team_logo_url: logoUrl,
        team_colors: formData.team_colors,
        team_motto: formData.team_motto
      });
      
      if (response.success) {
        setMessage('Team setup updated successfully!');
        
        // Update local form data with the saved logo URL
        setFormData(prev => ({
          ...prev,
          team_logo_url: logoUrl
        }));
        setLogoPreview(logoUrl);
        
        onTeamUpdated(); // Refresh league data
        
        // Clear the form state after a delay
        setTimeout(() => {
          setMessage('');
          setLogoFile(null);
        }, 3000);
      } else {
        setError(response.message || 'Failed to update team setup');
      }
    } catch (err) {
      console.error('Team setup error:', err);
      setError(err.response?.data?.detail || 'Failed to update team setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white} mb-2`}>
          Team Setup
        </h2>
        <p className={dynastyTheme.classes.text.neutralLight}>
          Customize your team identity and branding
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className={`${dynastyTheme.classes.bg.error}/20 border ${dynastyTheme.classes.border.error} rounded-lg p-4 mb-6 flex items-center`}>
          <AlertCircle className={`${dynastyTheme.classes.text.error} w-5 h-5 mr-3`} />
          <span className={dynastyTheme.classes.text.white}>{error}</span>
        </div>
      )}
      
      {message && (
        <div className={`${dynastyTheme.classes.bg.success}/20 border ${dynastyTheme.classes.border.success} rounded-lg p-4 mb-6 flex items-center`}>
          <CheckCircle className={`${dynastyTheme.classes.text.success} w-5 h-5 mr-3`} />
          <span className={dynastyTheme.classes.text.white}>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Team Identity */}
          <div className={`${dynastyTheme.components.card.base} p-6`}>
            <h3 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white} mb-6 flex items-center`}>
              <Type className={`${dynastyTheme.classes.text.primary} w-5 h-5 mr-2`} />
              Team Identity
            </h3>

            {/* Team Name */}
            <div className="mb-6">
              <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white} mb-2 block`}>
                Team Name *
              </label>
              <input
                type="text"
                value={formData.team_name}
                onChange={(e) => handleInputChange('team_name', e.target.value)}
                className={`${dynastyTheme.components.input} w-full`}
                placeholder="Enter your team name"
                required
                maxLength="50"
              />
            </div>

            {/* Manager Name */}
            <div className="mb-6">
              <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white} mb-2 block`}>
                Manager Name *
              </label>
              <input
                type="text"
                value={formData.manager_name}
                onChange={(e) => handleInputChange('manager_name', e.target.value)}
                className={`${dynastyTheme.components.input} w-full`}
                placeholder="Your name as team manager"
                required
                maxLength="100"
              />
            </div>

            {/* Team Motto */}
            <div className="mb-6">
              <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white} mb-2 block`}>
                Team Motto
              </label>
              <textarea
                value={formData.team_motto}
                onChange={(e) => handleInputChange('team_motto', e.target.value)}
                className={`${dynastyTheme.components.input} w-full h-24 resize-none`}
                placeholder="e.g., Champions are made here, Dynasty starts now"
                maxLength="200"
              />
              <div className={`${dynastyTheme.classes.text.neutralLight} text-xs mt-1`}>
                {formData.team_motto?.length || 0}/200 characters
              </div>
            </div>
          </div>

          {/* Right Column - Visual Identity */}
          <div className={`${dynastyTheme.components.card.base} p-6`}>
            <h3 className={`${dynastyTheme.components.heading.h2} ${dynastyTheme.classes.text.white} mb-6 flex items-center`}>
              <Palette className={`${dynastyTheme.classes.text.primary} w-5 h-5 mr-2`} />
              Visual Identity
            </h3>

            {/* Team Logo Upload */}
            <div className="mb-6">
              <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white} mb-3 block`}>
                Team Logo
              </label>
              
              <div className="flex items-start gap-4">
                {/* Logo Preview */}
                <div className={`${dynastyTheme.classes.bg.darkLighter} border-2 border-dashed ${dynastyTheme.classes.border.neutral} rounded-lg w-24 h-24 flex items-center justify-center overflow-hidden`}>
                  {logoPreview ? (
                    <img 
                      src={logoPreview} 
                      alt="Team logo preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className={`${dynastyTheme.classes.text.neutralLight} w-8 h-8`} />
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1">
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="logo-upload"
                    className={`${dynastyTheme.utils.getComponent('button', 'secondary', 'sm')} inline-flex items-center cursor-pointer mb-2`}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </label>
                  
                  <p className={`${dynastyTheme.classes.text.neutralLight} text-xs mb-1`}>
                    PNG, JPG up to 2MB
                  </p>
                  
                  {logoFile && (
                    <div className="flex items-center gap-2">
                      <span className={`${dynastyTheme.classes.text.success} text-sm`}>
                        {logoFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(formData.team_logo_url);
                        }}
                        className={`${dynastyTheme.classes.text.error} hover:${dynastyTheme.classes.text.white}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Team Colors */}
            <div className="mb-6">
              <label className={`${dynastyTheme.components.label} ${dynastyTheme.classes.text.white} mb-3 block`}>
                Team Colors
              </label>
              
              {/* Color Presets */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {colorOptions.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleColorSelect(option)}
                    className={`flex items-center p-3 rounded-lg border transition-all ${
                      formData.team_colors.primary === option.primary
                        ? `border-yellow-400 ${dynastyTheme.classes.bg.primary}/20`
                        : `border-gray-600 ${dynastyTheme.classes.bg.darkLighter} hover:border-gray-500`
                    }`}
                  >
                    <div className="flex gap-1 mr-3">
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-600"
                        style={{ backgroundColor: option.primary }}
                      />
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-600"
                        style={{ backgroundColor: option.secondary }}
                      />
                    </div>
                    <span className={`${dynastyTheme.classes.text.white} text-sm`}>
                      {option.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom Color Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`${dynastyTheme.classes.text.neutralLight} text-sm block mb-1`}>
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.team_colors.primary}
                      onChange={(e) => handleColorSelect({
                        primary: e.target.value,
                        secondary: formData.team_colors.secondary
                      })}
                      className="w-10 h-10 rounded border border-gray-600 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.team_colors.primary}
                      onChange={(e) => handleColorSelect({
                        primary: e.target.value,
                        secondary: formData.team_colors.secondary
                      })}
                      className={`${dynastyTheme.components.input} flex-1 text-sm`}
                      placeholder="#eab308"
                    />
                  </div>
                </div>
                
                <div>
                  <label className={`${dynastyTheme.classes.text.neutralLight} text-sm block mb-1`}>
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.team_colors.secondary}
                      onChange={(e) => handleColorSelect({
                        primary: formData.team_colors.primary,
                        secondary: e.target.value
                      })}
                      className="w-10 h-10 rounded border border-gray-600 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.team_colors.secondary}
                      onChange={(e) => handleColorSelect({
                        primary: formData.team_colors.primary,
                        secondary: e.target.value
                      })}
                      className={`${dynastyTheme.components.input} flex-1 text-sm`}
                      placeholder="#1c1917"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Color Preview */}
            <div className={`${dynastyTheme.classes.bg.darkLighter} p-4 rounded-lg`}>
              <h4 className={`${dynastyTheme.classes.text.white} font-medium mb-3`}>Color Preview</h4>
              <div className="flex items-center gap-4">
                <div 
                  className="px-4 py-2 rounded-lg font-medium text-sm"
                  style={{ 
                    backgroundColor: formData.team_colors.primary,
                    color: formData.team_colors.secondary
                  }}
                >
                  {formData.team_name || 'Team Name'}
                </div>
                <div 
                  className="px-4 py-2 rounded-lg font-medium text-sm border-2"
                  style={{ 
                    backgroundColor: formData.team_colors.secondary,
                    color: formData.team_colors.primary,
                    borderColor: formData.team_colors.primary
                  }}
                >
                  Secondary Style
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center mt-8">
          <button
            type="submit"
            disabled={isSubmitting || isUploading || !formData.team_name}
            className={`${
              isSubmitting || isUploading || !formData.team_name
                ? `${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} opacity-50 cursor-not-allowed`
                : dynastyTheme.utils.getComponent('button', 'primary', 'lg')
            } flex items-center`}
            style={{ gap: dynastyTheme.tokens.spacing.sm }}
          >
            {isSubmitting || isUploading ? (
              <>
                <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${dynastyTheme.classes.text.black}`} />
                <span>{isUploading ? 'Uploading Logo...' : 'Saving Team Setup...'}</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Team Setup</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeamSetup;