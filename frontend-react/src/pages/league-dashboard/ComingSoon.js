// src/pages/league-dashboard/ComingSoon.js
import React from 'react';
import { FileText } from 'lucide-react';
import { dynastyTheme } from '../../services/colorService';

const ComingSoon = ({ title }) => {
  return (
    <div className={`${dynastyTheme.components.card.base} p-8 text-center`}>
      <h2 className={`${dynastyTheme.components.heading.h2} mb-4`}>{title}</h2>
      <div className={`py-12 ${dynastyTheme.classes.text.neutralLight}`}>
        <FileText className={`w-16 h-16 mx-auto mb-4 ${dynastyTheme.classes.text.neutralLight}`} />
        <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
        <p>This feature is under development and will be available soon.</p>
      </div>
    </div>
  );
};

export default ComingSoon;