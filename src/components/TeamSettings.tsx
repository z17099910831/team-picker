import React from 'react';
import {
  Plus,
  Trash2,
  Palette,
  ArrowUp,
  ArrowDown,
  Users,
} from 'lucide-react';
import { Language, Team, TeamConfigMode } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import {
  calculateDistributionPreview,
  createDefaultTeams,
  fisherYatesShuffle,
  generateId,
  TEAM_COLOR_PALETTE,
} from '../utils/assignmentAlgorithm';

interface TeamSettingsProps {
  teams: Team[];
  configMode: TeamConfigMode;
  targetTeamCount: number;
  targetMembersPerTeam: number;
  activeParticipantCount: number;
  onChangeConfigMode: (mode: TeamConfigMode) => void;
  onChangeTargetTeamCount: (count: number) => void;
  onChangeTargetMembersPerTeam: (size: number) => void;
  onChangeTeams: (teams: Team[]) => void;
  language: Language;
  disabled?: boolean;
}

export const TeamSettings: React.FC<TeamSettingsProps> = ({
  teams,
  configMode,
  targetTeamCount,
  targetMembersPerTeam,
  activeParticipantCount,
  onChangeConfigMode,
  onChangeTargetTeamCount,
  onChangeTargetMembersPerTeam,
  onChangeTeams,
  language,
  disabled = false,
}) => {
  const t = TRANSLATIONS[language];

  const handleSelectTeamCount = (count: number) => {
    const safeCount = Math.max(1, Math.min(50, count));
    onChangeTargetTeamCount(safeCount);
    onChangeTeams(createDefaultTeams(safeCount, teams));
  };

  const handleSelectMembersPerTeam = (size: number) => {
    const safeSize = Math.max(1, Math.min(100, size));
    onChangeTargetMembersPerTeam(safeSize);
    const requiredTeams = Math.max(
      1,
      Math.ceil(Math.max(1, activeParticipantCount) / safeSize)
    );
    onChangeTargetTeamCount(requiredTeams);
    onChangeTeams(createDefaultTeams(requiredTeams, teams));
  };

  const handleRenameTeam = (id: string, name: string) => {
    onChangeTeams(teams.map((team) => (team.id === id ? { ...team, name } : team)));
  };

  const handleColorChange = (id: string, color: string) => {
    onChangeTeams(teams.map((team) => (team.id === id ? { ...team, color } : team)));
  };

  const handleCapacityChange = (id: string, rawVal: string) => {
    const num = parseInt(rawVal, 10);
    onChangeTeams(
      teams.map((team) =>
        team.id === id
          ? { ...team, maxCapacity: !isNaN(num) && num > 0 ? num : undefined }
          : team
      )
    );
  };

  const handleAddTeam = () => {
    const nextIdx = teams.length + 1;
    const nextTeams = [
      ...teams,
      {
        id: generateId(`team_${nextIdx}`),
        name: `Team ${nextIdx}`,
        color: TEAM_COLOR_PALETTE[(nextIdx - 1) % TEAM_COLOR_PALETTE.length],
      },
    ];
    onChangeTeams(nextTeams);
    onChangeTargetTeamCount(nextTeams.length);
  };

  const handleDeleteTeam = (id: string) => {
    if (teams.length <= 1) return;
    const nextTeams = teams.filter((team) => team.id !== id);
    onChangeTeams(nextTeams);
    onChangeTargetTeamCount(nextTeams.length);
  };

  const handleMoveTeam = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= teams.length) return;
    const copy = [...teams];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    onChangeTeams(copy);
  };

  const handleRandomizeColors = () => {
    const shuffledColors = fisherYatesShuffle(TEAM_COLOR_PALETTE);
    onChangeTeams(
      teams.map((team, idx) => ({
        ...team,
        color: shuffledColors[idx % shuffledColors.length],
      }))
    );
  };

  const preview = calculateDistributionPreview(activeParticipantCount, teams);

  return (
    <section
      id="teams-panel"
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
          {t.teamConfigTitle}
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {teams.length} {teams.length === 1 ? 'Team' : 'Teams'}
        </span>
      </div>

      {/* Mode Switch: Mode A (Number of Teams) vs Mode B (Members Per Team) */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-4">
        <button
          type="button"
          onClick={() => onChangeConfigMode('count')}
          className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            configMode === 'count'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t.byTeamCount}
        </button>
        <button
          type="button"
          onClick={() => {
            onChangeConfigMode('size');
            handleSelectMembersPerTeam(targetMembersPerTeam);
          }}
          className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            configMode === 'size'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t.byMembersPerTeam}
        </button>
      </div>

      {/* Mode A: Number of Teams Presets + Custom Input */}
      {configMode === 'count' ? (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t.numTeamsLabel}
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[2, 3, 4, 5, 6, 8].map((num) => (
              <button
                key={num}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectTeamCount(num)}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors cursor-pointer ${
                  teams.length === num
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {num}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={50}
              disabled={disabled}
              aria-label="Custom number of teams"
              value={targetTeamCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1) {
                  handleSelectTeamCount(val);
                }
              }}
              className="w-18 px-2.5 py-1.5 text-xs font-mono font-semibold text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      ) : (
        /* Mode B: Members Per Team */
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t.membersPerTeamLabel}
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[2, 3, 4, 5, 6].map((size) => (
              <button
                key={size}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectMembersPerTeam(size)}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors cursor-pointer ${
                  targetMembersPerTeam === size
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {size} / team
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={100}
              disabled={disabled}
              aria-label="Custom members per team"
              value={targetMembersPerTeam}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1) {
                  handleSelectMembersPerTeam(val);
                }
              }}
              className="w-18 px-2.5 py-1.5 text-xs font-mono font-semibold text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      )}

      {/* Live Distribution Preview Callout */}
      <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Users className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong className="font-semibold text-slate-900 dark:text-white">
              {t.distributionPreview}:
            </strong>{' '}
            {preview.description}
          </span>
        </div>
        {preview.unassignedRemainder > 0 && (
          <span className="text-red-600 dark:text-red-400 font-semibold font-mono">
            +{preview.unassignedRemainder} overflow
          </span>
        )}
      </div>

      {/* Custom Team Names, Colors, Reordering, and Capacity */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t.customTeamsTitle}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={handleRandomizeColors}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{t.randomizeColorsBtn}</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleAddTeam}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addTeamBtn}</span>
            </button>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
          {teams.map((team, idx) => (
            <div
              key={team.id}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 text-sm"
            >
              <input
                type="color"
                value={team.color}
                disabled={disabled}
                onChange={(e) => handleColorChange(team.id, e.target.value)}
                aria-label={`${team.name} color`}
                className="w-6 h-6 rounded border-0 cursor-pointer shrink-0 bg-transparent"
              />

              <input
                type="text"
                value={team.name}
                disabled={disabled}
                onChange={(e) => handleRenameTeam(team.id, e.target.value)}
                aria-label={`Team ${idx + 1} name`}
                className="flex-1 min-w-0 px-2 py-1 text-sm font-medium text-slate-900 dark:text-white bg-transparent rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-600 focus:outline-none"
              />

              {/* Max Capacity Input */}
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={99}
                  disabled={disabled}
                  placeholder={t.maxCapacityPlaceholder}
                  value={team.maxCapacity || ''}
                  onChange={(e) => handleCapacityChange(team.id, e.target.value)}
                  aria-label={`${team.name} maximum capacity`}
                  className="w-14 px-1.5 py-1 text-xs font-mono text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Reorder Up/Down */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveTeam(idx, -1)}
                  disabled={disabled || idx === 0}
                  title="Move team up"
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveTeam(idx, 1)}
                  disabled={disabled || idx === teams.length - 1}
                  title="Move team down"
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={disabled || teams.length <= 1}
                onClick={() => handleDeleteTeam(team.id)}
                title="Delete team"
                className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
