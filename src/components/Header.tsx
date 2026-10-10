import React from 'react';
import { Shuffle } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';

interface HeaderProps {
  language: Language;
  onGenerateTeams: () => void;
  isSpinning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onGenerateTeams,
  isSpinning,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 no-print">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#wheel-stage"
        className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
      >
        {t.appTitle}
      </a>

      {/* Zone 2: 4 concise single-line text navigation links */}
      <nav
        aria-label="Primary Navigation"
        className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        <a
          href="#wheel-stage"
          className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          {t.navWheel}
        </a>
        <a
          href="#participants-panel"
          className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          {t.navParticipants}
        </a>
        <a
          href="#teams-panel"
          className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          {t.navTeams}
        </a>
        <a
          href="#results-section"
          className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
        >
          {t.navResults}
        </a>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onGenerateTeams}
          disabled={isSpinning}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
        >
          <Shuffle className="w-4 h-4" />
          <span>{t.generateTeamsNow}</span>
        </button>
      </div>
    </header>
  );
};
