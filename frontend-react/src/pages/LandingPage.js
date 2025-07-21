// src/pages/LandingPage.js
import React, { useState } from 'react';
import { Crown, Trophy, Users, BarChart3 } from 'lucide-react';
import AuthModal from '../components/AuthModal';

const LandingPage = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState('signin');

  const features = [
    {
      icon: <Crown className="w-12 h-12 dynasty-text-primary" />,
      title: "Dynasty Management",
      description: "Build and manage your dynasty team for long-term success"
    },
    {
      icon: <Trophy className="w-12 h-12 dynasty-text-primary" />,
      title: "Competitive Leagues",
      description: "Join leagues with friends or compete against other managers"
    },
    {
      icon: <Users className="w-12 h-12 dynasty-text-primary" />,
      title: "Real MLB Players",
      description: "Draft and trade real MLB players with live statistics"
    },
    {
      icon: <BarChart3 className="w-12 h-12 dynasty-text-primary" />,
      title: "Advanced Analytics",
      description: "Deep statistics and analytics to optimize your team"
    }
  ];

  const openAuthModal = (tab = 'signin') => {
    setAuthTab(tab);
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen dynasty-bg-primary">
      {/* Header */}
      <header className="dynasty-bg-secondary dynasty-border-bottom">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Crown className="w-8 h-8 dynasty-text-primary" />
              <h1 className="text-2xl font-bold text-white">Dynasty Dugout</h1>
            </div>
            <div className="space-x-4">
              <button
                onClick={() => openAuthModal('signin')}
                className="dynasty-button-secondary"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="dynasty-button"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Build Your
            <span className="dynasty-text-primary"> Dynasty</span>
          </h2>
          <p className="text-xl dynasty-text-secondary mb-10 max-w-2xl mx-auto">
            The ultimate fantasy baseball platform for serious managers. 
            Draft real MLB players, build championship teams, and compete in dynamic leagues.
          </p>
          <button
            onClick={() => openAuthModal('signup')}
            className="dynasty-button dynasty-glow px-8 py-4 text-lg font-bold transform hover:scale-105 shadow-lg"
          >
            Start Your Dynasty
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 dynasty-bg-secondary">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-white text-center mb-12">
            Why Choose Dynasty Dugout?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="dynasty-card"
              >
                <div className="mb-4">{feature.icon}</div>
                <h4 className="text-xl font-semibold text-white mb-3">
                  {feature.title}
                </h4>
                <p className="dynasty-text-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-white mb-6">
            Ready to Dominate?
          </h3>
          <p className="text-lg dynasty-text-secondary mb-8">
            Join thousands of managers building championship dynasties.
          </p>
          <button
            onClick={() => openAuthModal('signup')}
            className="dynasty-button px-8 py-4 text-lg font-bold"
          >
            Create Account
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="dynasty-bg-secondary dynasty-border-bottom py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Crown className="w-6 h-6 dynasty-text-primary" />
            <span className="text-lg font-semibold text-white">Dynasty Dugout</span>
          </div>
          <p className="dynasty-text-muted">
            © 2024 Dynasty Dugout. Build your championship legacy.
          </p>
        </div>
      </footer>

      {/* Authentication Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialTab={authTab}
        />
      )}
    </div>
  );
};

export default LandingPage;