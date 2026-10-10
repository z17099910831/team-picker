import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Printer,
  Shuffle,
  Users,
  RotateCcw,
} from 'lucide-react';
import {
  Language,
  Participant,
  Team,
  TeamAssignmentMap,
} from '../types';
import { TRANSLATIONS } from '../utils/i18n';

interface TeamResultsProps {
  teams: Team[];
  assignments: TeamAssignmentMap;
  participants: Participant[];
  onShuffleAgain: () => void;
  onResetAssignments: () => void;
  onMoveParticipantBetweenTeams: (
    participantId: string,
    targetTeamId: string
  ) => void;
  language: Language;
  isSpinning: boolean;
}

export const TeamResults: React.FC<TeamResultsProps> = ({
  teams,
  assignments,
  participants,
  onShuffleAgain,
  onResetAssignments,
  onMoveParticipantBetweenTeams,
  language,
  isSpinning,
}) => {
  const t = TRANSLATIONS[language];
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null);

  const activeParticipants = participants.filter((p) => !p.excluded);
  const excludedParticipants = participants.filter((p) => p.excluded);

  const assignedIds = new Set<string>();
  teams.forEach((team) => {
    (assignments[team.id] || []).forEach((p) => assignedIds.add(p.id));
  });

  const unassignedParticipants = activeParticipants.filter(
    (p) => !assignedIds.has(p.id)
  );
  const totalAssignedCount = assignedIds.size;

  const formatPlainTextExport = (): string => {
    return teams
      .map((team) => {
        const members = assignments[team.id] || [];
        const header = `${team.name} (${members.length} ${
          members.length === 1 ? t.memberUnit : t.membersUnit
        })`;
        const lines =
          members.length > 0
            ? members.map((m) => `- ${m.name}`).join('\n')
            : '- (None)';
        return `${header}\n${lines}`;
      })
      .join('\n\n');
  };

  const handleCopyAll = async () => {
    const text = formatPlainTextExport();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Fallback copy via textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const handleCopySingleTeam = async (team: Team) => {
    const members = assignments[team.id] || [];
    const text = `${team.name} (${members.length} ${
      members.length === 1 ? t.memberUnit : t.membersUnit
    })\n${members.map((m) => `- ${m.name}`).join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTeamId(team.id);
      setTimeout(() => setCopiedTeamId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleDownloadFile = (format: 'txt' | 'csv') => {
    let content = '';
    let mimeType = 'text/plain;charset=utf-8';
    let filename = `team-results.${format}`;

    if (format === 'txt') {
      content = formatPlainTextExport();
    } else {
      mimeType = 'text/csv;charset=utf-8';
      const rows = [['Team Number', 'Team Name', 'Member Number', 'Participant Name']];
      teams.forEach((team, tIdx) => {
        const members = assignments[team.id] || [];
        if (members.length === 0) {
          rows.push([
            String(tIdx + 1),
            `"${team.name.replace(/"/g, '""')}"`,
            '',
            '',
          ]);
        } else {
          members.forEach((m, mIdx) => {
            rows.push([
              String(tIdx + 1),
              `"${team.name.replace(/"/g, '""')}"`,
              String(mIdx + 1),
              `"${m.name.replace(/"/g, '""')}"`,
            ]);
          });
        }
      });
      content = rows.map((r) => r.join(',')).join('\n');
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section id="results-section" className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
      {/* Section Header & Export Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display">
            {t.resultsTitle}
          </h2>
          {/* Unboxed clean metadata */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            <span>{t.resultsSubtitle}</span>
            <span aria-hidden="true">·</span>
            <span>
              Assigned: <strong>{totalAssignedCount}</strong> / {activeParticipants.length}
            </span>
          </div>
        </div>

        {/* Export & Shuffle Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            disabled={isSpinning || activeParticipants.length === 0}
            onClick={onShuffleAgain}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>{t.shuffleAgain}</span>
          </button>

          <button
            type="button"
            disabled={totalAssignedCount === 0}
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">{t.copiedToast}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t.copyAllResults}</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={totalAssignedCount === 0}
            onClick={() => handleDownloadFile('csv')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.downloadCSV}</span>
          </button>

          <button
            type="button"
            disabled={totalAssignedCount === 0}
            onClick={() => handleDownloadFile('txt')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.downloadTXT}</span>
          </button>

          <button
            type="button"
            disabled={totalAssignedCount === 0}
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.printResults}</span>
          </button>

          {totalAssignedCount > 0 && (
            <button
              type="button"
              disabled={isSpinning}
              onClick={onResetAssignments}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.resetAssignmentsBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State Banner when no assignments exist */}
      {totalAssignedCount === 0 && (
        <div className="mb-6 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <Users className="w-8 h-8 text-blue-600 mx-auto mb-2 opacity-80" />
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
            {t.noAssignmentsYet}
          </p>
        </div>
      )}

      {/* Team Cards Grid — All-around hairline border, NO thick left accent border */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {teams.map((team) => {
          const members = assignments[team.id] || [];
          const isCopied = copiedTeamId === team.id;

          return (
            <div
              key={team.id}
              className="flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 transition-all"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-xs shrink-0 border border-black/10"
                      style={{ backgroundColor: team.color }}
                    />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white font-display truncate">
                      {team.name}
                    </h3>
                  </div>
                  {/* Unboxed quiet metadata */}
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>
                      {members.length}{' '}
                      {members.length === 1 ? t.memberUnit : t.membersUnit}
                    </span>
                    {team.maxCapacity && team.maxCapacity > 0 && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>Max {team.maxCapacity}</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopySingleTeam(team)}
                  disabled={members.length === 0}
                  title={t.copyTeam}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 rounded transition-colors no-print cursor-pointer"
                >
                  {isCopied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Member List */}
              {members.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  No members assigned
                </div>
              ) : (
                <ol className="space-y-1.5 flex-1">
                  {members.map((member, mIdx) => (
                    <li
                      key={member.id}
                      className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 text-sm text-slate-800 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-slate-400 tabular-nums w-5 shrink-0">
                          {mIdx + 1}.
                        </span>
                        <span className="font-medium truncate">
                          {member.name}
                        </span>
                      </span>

                      {/* Quick manual move dropdown on hover/focus */}
                      <select
                        value={team.id}
                        aria-label={`Move ${member.name} to another team`}
                        onChange={(e) =>
                          onMoveParticipantBetweenTeams(
                            member.id,
                            e.target.value
                          )
                        }
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-600 dark:text-slate-300 transition-opacity no-print cursor-pointer"
                      >
                        {teams.map((targetTeam) => (
                          <option key={targetTeam.id} value={targetTeam.id}>
                            → {targetTeam.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned or Excluded Pools (if any) */}
      {(unassignedParticipants.length > 0 || excludedParticipants.length > 0) && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
          {unassignedParticipants.length > 0 && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.unassignedPool} ({unassignedParticipants.length})
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {unassignedParticipants.map((p) => p.name).join(' · ')}
              </p>
            </div>
          )}

          {excludedParticipants.length > 0 && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.excludedPool} ({excludedParticipants.length})
                </h3>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                {excludedParticipants.map((p) => p.name).join(' · ')}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
