// src/pages/LandingPage.js
import React, { useState } from 'react';
import { Crown, Trophy, Users, BarChart3 } from 'lucide-react';
import { dynastyTheme } from '../services/colorService';
import AuthModal from '../components/AuthModal';

const LandingPage = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState('signin');

  const features = [
    {
      icon: <Crown className={`w-12 h-12 ${dynastyTheme.classes.text.primary}`} />,
      title: "Dynasty Management",
      description: "Build and manage your dynasty team for long-term success"
    },
    {
      icon: <Trophy className={`w-12 h-12 ${dynastyTheme.classes.text.primary}`} />,
      title: "Competitive Leagues",
      description: "Join leagues with friends or compete against other managers"
    },
    {
      icon: <Users className={`w-12 h-12 ${dynastyTheme.classes.text.primary}`} />,
      title: "Real MLB Players",
      description: "Draft and trade real MLB players with live statistics"
    },
    {
      icon: <BarChart3 className={`w-12 h-12 ${dynastyTheme.classes.text.primary}`} />,
      title: "Advanced Analytics",
      description: "Deep statistics and analytics to optimize your team"
    }
  ];

  const openAuthModal = (tab = 'signin') => {
    setAuthTab(tab);
    setShowAuthModal(true);
  };

  return (
    <div className={dynastyTheme.components.page}>
      {/* Header */}
      <header className={`${dynastyTheme.components.card.base} border-b ${dynastyTheme.classes.border.light}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Crown className={`w-8 h-8 ${dynastyTheme.classes.text.primary}`} />
              <h1 className={`text-2xl font-bold ${dynastyTheme.classes.text.white}`}>Dynasty Dugout</h1>
            </div>
            <div className="space-x-4">
              <button
                onClick={() => openAuthModal('signin')}
                className={dynastyTheme.utils.getComponent('button', 'secondary', 'md')}
              >
                Sign In
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className={dynastyTheme.utils.getComponent('button', 'primary', 'md')}
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
          <h2 className={`text-5xl md:text-6xl font-bold ${dynastyTheme.classes.text.white} mb-6`}>
            Build Your
            <span className={`${dynastyTheme.classes.text.primary}`}> Dynasty</span>
          </h2>
          <p className={`text-xl ${dynastyTheme.classes.text.neutralLight} mb-10 max-w-2xl mx-auto`}>
            The ultimate fantasy baseball platform for serious managers. 
            Draft real MLB players, build championship teams, and compete in dynamic leagues.
          </p>
          <button
            onClick={() => openAuthModal('signup')}
            className={`${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} ${dynastyTheme.classes.shadow.primary} px-8 py-4 text-lg font-bold transform hover:scale-105 shadow-lg`}
          >
            Start Your Dynasty
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section className={`py-20 px-4 sm:px-6 lg:px-8 ${dynastyTheme.classes.bg.darkLighter}`}>
        <div className="max-w-6xl mx-auto">
          <h3 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white} text-center mb-12`}>
            Why Choose Dynasty Dugout?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`${dynastyTheme.components.card.base} p-6 text-center hover:border-yellow-400/50 ${dynastyTheme.classes.transition}`}
              >
                <div className="mb-4">{feature.icon}</div>
                <h4 className={`text-xl font-semibold ${dynastyTheme.classes.text.white} mb-3`}>
                  {feature.title}
                </h4>
                <p className={dynastyTheme.classes.text.neutralLight}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className={`${dynastyTheme.components.heading.h1} ${dynastyTheme.classes.text.white} mb-6`}>
            Ready to Dominate?
          </h3>
          <p className={`text-lg ${dynastyTheme.classes.text.neutralLight} mb-8`}>
            Join thousands of managers building championship dynasties.
          </p>
          <button
            onClick={() => openAuthModal('signup')}
            className={`${dynastyTheme.utils.getComponent('button', 'primary', 'lg')} px-8 py-4 text-lg font-bold`}
          >
            Create Account
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`${dynastyTheme.classes.bg.darkLighter} border-t ${dynastyTheme.classes.border.neutral} py-8 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Crown className={`w-6 h-6 ${dynastyTheme.classes.text.primary}`} />
            <span className={`text-lg font-semibold ${dynastyTheme.classes.text.white}`}>Dynasty Dugout</span>
          </div>
          <p className={dynastyTheme.classes.text.neutralLight}>
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