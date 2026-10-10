import React from 'react';
import { Sparkles, Check, X, Trash2 } from 'lucide-react';
import {
  Language,
  Participant,
  Team,
  TeamAssignmentMap,
  WheelMode,
  WheelSegment,
} from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { getDefaultPhotoForIndex } from '../utils/avatar';
import { ParticipantAvatar } from './ParticipantAvatar';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  wheelMode: WheelMode;
  winnerSegment: WheelSegment | null;
  selectedParticipant: Participant | null;
  teams: Team[];
  assignments: TeamAssignmentMap;
  recommendedTeam: Team | null;
  onAssignParticipantToTeam: (participantId: string, teamId: string) => void;
  onRemoveTeamFromWheel: (teamId: string) => void;
  language: Language;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  onClose,
  wheelMode,
  winnerSegment,
  selectedParticipant,
  teams,
  assignments,
  recommendedTeam,
  onAssignParticipantToTeam,
  onRemoveTeamFromWheel,
  language,
}) => {
  if (!isOpen || !winnerSegment) return null;

  const t = TRANSLATIONS[language];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spin-result-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center">
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {wheelMode === 'assign_participants' && selectedParticipant ? (
          <div className="flex justify-center mb-3">
            <ParticipantAvatar
              name={selectedParticipant.name}
              photoUrl={
                selectedParticipant.photoUrl ||
                winnerSegment.photoUrl ||
                getDefaultPhotoForIndex(0)
              }
              size="xl"
              className="ring-4 ring-blue-600/20 shadow-md"
            />
          </div>
        ) : (
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
        )}

        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
          {wheelMode === 'pick_team'
            ? t.selectedTeamResult
            : t.selectedParticipantResult}
        </p>

        <h3
          id="spin-result-title"
          className="text-3xl font-bold text-slate-900 dark:text-white font-display mb-4 flex items-center justify-center gap-2.5"
        >
          <span
            className="w-4 h-4 rounded-sm shrink-0 border border-black/10"
            style={{ backgroundColor: winnerSegment.color }}
          />
          <span>{winnerSegment.label}</span>
        </h3>

        {wheelMode === 'pick_team' ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-6">
            <button
              type="button"
              onClick={() => {
                onRemoveTeamFromWheel(winnerSegment.id);
                onClose();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.removeTeamFromWheel}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{t.keepInWheel}</span>
            </button>
          </div>
        ) : (
          selectedParticipant && (
            <div className="mt-4 text-left">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2.5 text-center">
                {t.assignToTeamPrompt}
              </p>

              {/* Recommended Balanced Auto-Assign CTA */}
              {recommendedTeam && (
                <button
                  type="button"
                  onClick={() => {
                    onAssignParticipantToTeam(
                      selectedParticipant.id,
                      recommendedTeam.id
                    );
                    onClose();
                  }}
                  className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {t.autoAssignBalanced} → {recommendedTeam.name}
                  </span>
                </button>
              )}

              {/* Manual Team Selection Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {teams.map((team) => {
                  const currentCount = (assignments[team.id] || []).length;
                  const maxCap =
                    team.maxCapacity && team.maxCapacity > 0
                      ? team.maxCapacity
                      : null;
                  const isFull = maxCap !== null && currentCount >= maxCap;

                  return (
                    <button
                      key={team.id}
                      type="button"
                      disabled={isFull}
                      onClick={() => {
                        onAssignParticipantToTeam(
                          selectedParticipant.id,
                          team.id
                        );
                        onClose();
                      }}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="truncate text-slate-800 dark:text-slate-200">
                          {team.name}
                        </span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        {currentCount}
                        {maxCap ? `/${maxCap}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
