/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Moon,
  Sun,
  RotateCcw,
  Shuffle,
  Disc,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  AppPersistedState,
  AssignmentRecord,
  FairnessRule,
  Language,
  Participant,
  Team,
  TeamAssignmentMap,
  TeamConfigMode,
  ThemeMode,
  ValidationIssue,
  WheelMode,
  WheelOptions,
  WheelSegment,
} from './types';
import { TRANSLATIONS } from './utils/i18n';
import {
  createDefaultTeams,
  createSampleParticipants,
  generateBalancedTeams,
  pickBalancedTeamForParticipant,
  TEAM_COLOR_PALETTE,
  validateConfiguration,
} from './utils/assignmentAlgorithm';
import { runSystemDiagnostics } from './utils/wheelMath';
import { triggerConfetti } from './utils/sound';
import { Header } from './components/Header';
import { SpinningWheel } from './components/SpinningWheel';
import { ParticipantEditor } from './components/ParticipantEditor';
import { TeamSettings } from './components/TeamSettings';
import { TeamResults } from './components/TeamResults';
import { ResultModal } from './components/ResultModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';

const STORAGE_KEY = 'team_picker_wheel_state_v1';

const DEFAULT_WHEEL_OPTIONS: WheelOptions = {
  spinDuration: 4,
  soundEnabled: true,
  confettiEnabled: true,
  removeAfterSpin: false,
  autoAssignOnSpin: false,
};

function loadInitialState(): AppPersistedState {
  const defaultParticipants = createSampleParticipants();
  const defaultTeams = createDefaultTeams(3);
  const initialRandom = generateBalancedTeams(defaultParticipants, defaultTeams, []);

  const fallback: AppPersistedState = {
    participants: defaultParticipants,
    teams: defaultTeams,
    teamConfigMode: 'count',
    targetTeamCount: 3,
    targetMembersPerTeam: 4,
    wheelMode: 'pick_team',
    wheelOptions: DEFAULT_WHEEL_OPTIONS,
    fairnessRules: [],
    assignments: initialRandom.assignments,
    assignmentHistory: [],
    removedTeamIds: [],
    language: 'en',
    theme: 'light',
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AppPersistedState>;
    return {
      participants: Array.isArray(parsed.participants)
        ? parsed.participants
        : fallback.participants,
      teams:
        Array.isArray(parsed.teams) && parsed.teams.length > 0
          ? parsed.teams
          : fallback.teams,
      teamConfigMode: parsed.teamConfigMode || fallback.teamConfigMode,
      targetTeamCount: parsed.targetTeamCount || fallback.targetTeamCount,
      targetMembersPerTeam:
        parsed.targetMembersPerTeam || fallback.targetMembersPerTeam,
      wheelMode: parsed.wheelMode || fallback.wheelMode,
      wheelOptions: { ...DEFAULT_WHEEL_OPTIONS, ...(parsed.wheelOptions || {}) },
      fairnessRules: Array.isArray(parsed.fairnessRules)
        ? parsed.fairnessRules
        : [],
      assignments: parsed.assignments || fallback.assignments,
      assignmentHistory: Array.isArray(parsed.assignmentHistory)
        ? parsed.assignmentHistory
        : [],
      removedTeamIds: Array.isArray(parsed.removedTeamIds)
        ? parsed.removedTeamIds
        : [],
      language: parsed.language === 'zh' ? 'zh' : 'en',
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return fallback;
  }
}

export default function App() {
  const initialState = useMemo(() => loadInitialState(), []);

  const [participants, setParticipants] = useState<Participant[]>(
    initialState.participants
  );
  const [teams, setTeams] = useState<Team[]>(initialState.teams);
  const [teamConfigMode, setTeamConfigMode] = useState<TeamConfigMode>(
    initialState.teamConfigMode
  );
  const [targetTeamCount, setTargetTeamCount] = useState<number>(
    initialState.targetTeamCount
  );
  const [targetMembersPerTeam, setTargetMembersPerTeam] = useState<number>(
    initialState.targetMembersPerTeam
  );
  const [wheelMode, setWheelMode] = useState<WheelMode>(initialState.wheelMode);
  const [wheelOptions, setWheelOptions] = useState<WheelOptions>(
    initialState.wheelOptions
  );
  const [fairnessRules, setFairnessRules] = useState<FairnessRule[]>(
    initialState.fairnessRules
  );
  const [assignments, setAssignments] = useState<TeamAssignmentMap>(
    initialState.assignments
  );
  const [assignmentHistory, setAssignmentHistory] = useState<
    AssignmentRecord[]
  >(initialState.assignmentHistory);
  const [removedTeamIds, setRemovedTeamIds] = useState<string[]>(
    initialState.removedTeamIds
  );
  const [language, setLanguage] = useState<Language>(initialState.language);
  const [theme, setTheme] = useState<ThemeMode>(initialState.theme);

  // Runtime UI state
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWinner, setLastWinner] = useState<WheelSegment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [diagnosticsBanner, setDiagnosticsBanner] = useState<string | null>(
    null
  );

  const t = TRANSLATIONS[language];

  // Apply Dark Mode class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Save state to localStorage
  useEffect(() => {
    try {
      const stateToSave: AppPersistedState = {
        participants,
        teams,
        teamConfigMode,
        targetTeamCount,
        targetMembersPerTeam,
        wheelMode,
        wheelOptions,
        fairnessRules,
        assignments,
        assignmentHistory,
        removedTeamIds,
        language,
        theme,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Ignore storage quota or private browsing errors gracefully
    }
  }, [
    participants,
    teams,
    teamConfigMode,
    targetTeamCount,
    targetMembersPerTeam,
    wheelMode,
    wheelOptions,
    fairnessRules,
    assignments,
    assignmentHistory,
    removedTeamIds,
    language,
    theme,
  ]);

  // Ensure assignments dictionary always has keys for current teams and cleans up deleted participants
  useEffect(() => {
    const validParticipantMap = new Map<string, Participant>();
    participants.forEach((p) => {
      if (!p.excluded && p.name.trim().length > 0) {
        validParticipantMap.set(p.id, p);
      }
    });

    setAssignments((prev) => {
      const next: TeamAssignmentMap = {};
      teams.forEach((team) => {
        const existingList = prev[team.id] || [];
        next[team.id] = existingList
          .filter((member) => validParticipantMap.has(member.id))
          .map((member) => validParticipantMap.get(member.id)!);
      });
      return next;
    });
  }, [participants, teams]);

  // Recalculate team count automatically if user is in "Members Per Team" mode
  useEffect(() => {
    if (teamConfigMode === 'size') {
      const activeCount = participants.filter(
        (p) => !p.excluded && p.name.trim().length > 0
      ).length;
      const neededTeams = Math.max(
        1,
        Math.ceil(Math.max(1, activeCount) / Math.max(1, targetMembersPerTeam))
      );
      if (neededTeams !== teams.length) {
        setTargetTeamCount(neededTeams);
        setTeams((prev) => createDefaultTeams(neededTeams, prev));
      }
    }
  }, [participants, teamConfigMode, targetMembersPerTeam, teams.length]);

  const activeParticipants = useMemo(
    () => participants.filter((p) => !p.excluded && p.name.trim().length > 0),
    [participants]
  );

  const assignedParticipantIds = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((team) => {
      (assignments[team.id] || []).forEach((p) => set.add(p.id));
    });
    return set;
  }, [teams, assignments]);

  const unassignedParticipants = useMemo(
    () => activeParticipants.filter((p) => !assignedParticipantIds.has(p.id)),
    [activeParticipants, assignedParticipantIds]
  );

  // Build segments for the SpinningWheel based on current WheelMode
  const wheelSegments: WheelSegment[] = useMemo(() => {
    if (wheelMode === 'pick_team') {
      const visibleTeams = teams.filter((t) => !removedTeamIds.includes(t.id));
      return visibleTeams.map((team) => ({
        id: team.id,
        label: team.name,
        color: team.color,
      }));
    } else {
      // Mode 2: Assign Participants one by one
      return unassignedParticipants.map((p, idx) => ({
        id: p.id,
        label: p.name,
        color: TEAM_COLOR_PALETTE[idx % TEAM_COLOR_PALETTE.length],
      }));
    }
  }, [wheelMode, teams, removedTeamIds, unassignedParticipants]);

  const validationIssues = useMemo(
    () => validateConfiguration(participants, teams, fairnessRules),
    [participants, teams, fairnessRules]
  );

  const hasBlockingErrors = validationIssues.some((i) => i.type === 'error');

  // Action: Fix validation issue automatically
  const handleFixValidationIssue = (issue: ValidationIssue) => {
    if (issue.actionType === 'restore_sample') {
      setParticipants(createSampleParticipants());
    } else if (issue.actionType === 'increase_teams') {
      const nextTeams = createDefaultTeams(2, teams);
      setTeams(nextTeams);
      setTargetTeamCount(2);
    } else if (issue.actionType === 'increase_capacity') {
      setTeams(teams.map((t) => ({ ...t, maxCapacity: undefined })));
    } else if (issue.actionType === 'deduplicate') {
      const seen = new Set<string>();
      setParticipants(
        participants.filter((p) => {
          const k = p.name.trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
      );
    }
  };

  // Action: Immediate Automatic Balanced Team Generation
  const handleGenerateBalancedTeamsNow = () => {
    if (isSpinning || hasBlockingErrors) return;

    const result = generateBalancedTeams(participants, teams, fairnessRules);
    setAssignments(result.assignments);
    setAssignmentHistory([]);
    if (wheelOptions.confettiEnabled) {
      triggerConfetti();
    }

    // Smooth scroll to results on mobile
    const resultsEl = document.getElementById('results-section');
    if (resultsEl && window.innerWidth < 1024) {
      resultsEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Action: Handle Wheel Spin Completion
  const handleSpinComplete = (winner: WheelSegment) => {
    setIsSpinning(false);
    setLastWinner(winner);

    if (wheelOptions.confettiEnabled) {
      triggerConfetti();
    }

    if (wheelMode === 'pick_team') {
      if (wheelOptions.removeAfterSpin) {
        setRemovedTeamIds((prev) =>
          prev.includes(winner.id) ? prev : [...prev, winner.id]
        );
      } else {
        setModalOpen(true);
      }
    } else {
      // Mode 2: Participant spun
      const spunParticipant = activeParticipants.find(
        (p) => p.id === winner.id
      );
      if (!spunParticipant) return;

      if (wheelOptions.autoAssignOnSpin) {
        const bestTeam = pickBalancedTeamForParticipant(
          spunParticipant,
          teams,
          assignments,
          fairnessRules
        );
        if (bestTeam) {
          handleAssignSingleParticipantToTeam(spunParticipant.id, bestTeam.id);
        } else {
          setModalOpen(true);
        }
      } else {
        setModalOpen(true);
      }
    }
  };

  const handleAssignSingleParticipantToTeam = (
    participantId: string,
    teamId: string
  ) => {
    const participant = activeParticipants.find((p) => p.id === participantId);
    if (!participant) return;

    setAssignments((prev) => {
      const cleaned: TeamAssignmentMap = {};
      teams.forEach((t) => {
        cleaned[t.id] = (prev[t.id] || []).filter(
          (m) => m.id !== participantId
        );
      });
      cleaned[teamId] = [...(cleaned[teamId] || []), participant];
      return cleaned;
    });

    setAssignmentHistory((prev) => [
      ...prev,
      { participantId, teamId, timestamp: Date.now() },
    ]);
  };

  const handleUndoLastSpinAssignment = () => {
    if (assignmentHistory.length === 0) return;
    const lastRecord = assignmentHistory[assignmentHistory.length - 1];
    setAssignments((prev) => {
      const next: TeamAssignmentMap = { ...prev };
      next[lastRecord.teamId] = (next[lastRecord.teamId] || []).filter(
        (p) => p.id !== lastRecord.participantId
      );
      return next;
    });
    setAssignmentHistory((prev) => prev.slice(0, -1));
  };

  const handleResetAssignmentsOnly = () => {
    const empty: TeamAssignmentMap = {};
    teams.forEach((t) => {
      empty[t.id] = [];
    });
    setAssignments(empty);
    setAssignmentHistory([]);
    setLastWinner(null);
  };

  const handleConfirmFactoryReset = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    const sample = createSampleParticipants();
    const defaultTeams = createDefaultTeams(3);
    const fresh = generateBalancedTeams(sample, defaultTeams, []);

    setParticipants(sample);
    setTeams(defaultTeams);
    setTeamConfigMode('count');
    setTargetTeamCount(3);
    setTargetMembersPerTeam(4);
    setWheelMode('pick_team');
    setWheelOptions(DEFAULT_WHEEL_OPTIONS);
    setFairnessRules([]);
    setAssignments(fresh.assignments);
    setAssignmentHistory([]);
    setRemovedTeamIds([]);
    setLastWinner(null);
    setConfirmResetOpen(false);
  };

  const selectedParticipantForModal = useMemo(() => {
    if (wheelMode !== 'assign_participants' || !lastWinner) return null;
    return activeParticipants.find((p) => p.id === lastWinner.id) || null;
  }, [wheelMode, lastWinner, activeParticipants]);

  const recommendedTeamForModal = useMemo(() => {
    if (!selectedParticipantForModal) return null;
    return pickBalancedTeamForParticipant(
      selectedParticipantForModal,
      teams,
      assignments,
      fairnessRules
    );
  }, [selectedParticipantForModal, teams, assignments, fairnessRules]);

  const handleRunDiagnostics = () => {
    const diag = runSystemDiagnostics();
    if (diag.passed) {
      setDiagnosticsBanner(t.diagnosticsPassed);
      setTimeout(() => setDiagnosticsBanner(null), 5000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar following the strict 3-Zone Top Bar Contract */}
      <Header
        language={language}
        onGenerateTeams={handleGenerateBalancedTeamsNow}
        isSpinning={isSpinning}
      />

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Workspace Toolbar: Subtitle + Language, Theme, and Reset Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200 dark:border-slate-800 no-print">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
              {t.appTitle}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {t.appSubtitle}
            </p>
          </div>

          {/* Utility Controls: Language Selector, Theme Toggle, Factory Reset */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
              aria-label="Toggle language between English and Simplified Chinese"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'en' ? '中文 / EN' : 'EN / 中文'}</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label="Toggle color theme"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRunDiagnostics}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.runDiagnostics}</span>
            </button>

            <button
              type="button"
              disabled={isSpinning}
              onClick={() => setConfirmResetOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.clearSavedDataBtn}</span>
            </button>
          </div>
        </div>

        {/* Diagnostics Verification Banner */}
        {diagnosticsBanner && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 no-print">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{diagnosticsBanner}</span>
          </div>
        )}

        {/* Validation Alerts */}
        {validationIssues.length > 0 && (
          <div className="mb-6 space-y-2 no-print" role="alert">
            {validationIssues.map((issue, idx) => (
              <div
                key={idx}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-xs ${
                  issue.type === 'error'
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/80 text-red-800 dark:text-red-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{issue.message}</span>
                </div>
                {issue.actionLabel && (
                  <button
                    type="button"
                    onClick={() => handleFixValidationIssue(issue)}
                    className="px-2.5 py-1 font-semibold bg-white dark:bg-slate-900 rounded border border-current/20 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {issue.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Two-Column Desktop Layout (Wheel Stage Left, Configuration Panels Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start no-print">
          {/* Left Column: Interactive Spinning Wheel Stage (7 cols on large screens) */}
          <div
            id="wheel-stage"
            className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center"
          >
            {/* Wheel Mode Selector: Mode 1 (Pick a Team) vs Mode 2 (Assign Participants) */}
            <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => {
                  setWheelMode('pick_team');
                  setLastWinner(null);
                }}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  wheelMode === 'pick_team'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Disc className="w-4 h-4" />
                <span>{t.modePickTeam}</span>
              </button>

              <button
                type="button"
                disabled={isSpinning}
                onClick={() => {
                  setWheelMode('assign_participants');
                  // If all participants are already assigned, clear assignments so the user can spin-to-assign fresh
                  if (unassignedParticipants.length === 0) {
                    handleResetAssignmentsOnly();
                  }
                  setLastWinner(null);
                }}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  wheelMode === 'assign_participants'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {t.modeAssignParticipants} ({unassignedParticipants.length})
                </span>
              </button>
            </div>

            {/* Mode Description & Behavior Checkboxes */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 px-1 mb-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {wheelMode === 'pick_team'
                  ? t.modePickTeamDesc
                  : t.modeAssignDesc}
              </span>

              {wheelMode === 'pick_team' ? (
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={wheelOptions.removeAfterSpin}
                    onChange={(e) =>
                      setWheelOptions((prev) => ({
                        ...prev,
                        removeAfterSpin: e.target.checked,
                      }))
                    }
                    className="rounded accent-blue-600"
                  />
                  <span>{t.removeAfterSpin}</span>
                </label>
              ) : (
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={wheelOptions.autoAssignOnSpin}
                    onChange={(e) =>
                      setWheelOptions((prev) => ({
                        ...prev,
                        autoAssignOnSpin: e.target.checked,
                      }))
                    }
                    className="rounded accent-blue-600"
                  />
                  <span>{t.autoAssignAfterSpin}</span>
                </label>
              )}
            </div>

            {/* Assignment Progress Bar in Mode 2 */}
            {wheelMode === 'assign_participants' &&
              activeParticipants.length > 0 && (
                <div className="w-full max-w-md mb-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1 font-mono tabular-nums">
                    <span>Assignment Progress</span>
                    <span>
                      {assignedParticipantIds.size} / {activeParticipants.length}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          (assignedParticipantIds.size /
                            Math.max(1, activeParticipants.length)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

            {/* Interactive Canvas Spinning Wheel */}
            <SpinningWheel
              segments={wheelSegments}
              isSpinning={isSpinning}
              onSpinStart={() => setIsSpinning(true)}
              onSpinComplete={handleSpinComplete}
              options={wheelOptions}
              onUpdateOptions={(partial) =>
                setWheelOptions((prev) => ({ ...prev, ...partial }))
              }
              language={language}
              lastWinner={lastWinner}
              canUndo={
                wheelMode === 'assign_participants' &&
                assignmentHistory.length > 0
              }
              onUndo={handleUndoLastSpinAssignment}
              hasRemovedTeams={
                wheelMode === 'pick_team' && removedTeamIds.length > 0
              }
              onRestoreRemovedTeams={() => setRemovedTeamIds([])}
            />

            {/* Primary Instant Generate Teams CTA below Wheel */}
            <div className="w-full max-w-md mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={isSpinning || hasBlockingErrors}
                onClick={handleGenerateBalancedTeamsNow}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                <span>{t.generateTeamsNow}</span>
              </button>

              {assignedParticipantIds.size > 0 && (
                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={handleResetAssignmentsOnly}
                  className="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.resetAssignmentsBtn}
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Participant Management & Team Configuration Panels (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <ParticipantEditor
              participants={participants}
              teams={teams}
              fairnessRules={fairnessRules}
              onChangeParticipants={setParticipants}
              onChangeFairnessRules={setFairnessRules}
              language={language}
              disabled={isSpinning}
            />

            <TeamSettings
              teams={teams}
              configMode={teamConfigMode}
              targetTeamCount={targetTeamCount}
              targetMembersPerTeam={targetMembersPerTeam}
              activeParticipantCount={activeParticipants.length}
              onChangeConfigMode={setTeamConfigMode}
              onChangeTargetTeamCount={setTargetTeamCount}
              onChangeTargetMembersPerTeam={setTargetMembersPerTeam}
              onChangeTeams={setTeams}
              language={language}
              disabled={isSpinning}
            />
          </div>
        </div>

        {/* Full-Width Results & Export Section Below Main Content */}
        <TeamResults
          teams={teams}
          assignments={assignments}
          participants={participants}
          onShuffleAgain={handleGenerateBalancedTeamsNow}
          onResetAssignments={handleResetAssignmentsOnly}
          onMoveParticipantBetweenTeams={handleAssignSingleParticipantToTeam}
          language={language}
          isSpinning={isSpinning}
        />
      </main>

      {/* Quiet Footer */}
      <footer className="mt-12 py-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400 no-print">
        <div className="max-w-[1360px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {t.appTitle} · Client-side Fisher–Yates Random Team Generator
          </span>
          <span>Data stored locally in your browser</span>
        </div>
      </footer>

      {/* Spin Result / Interactive Participant Assignment Modal */}
      <ResultModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        wheelMode={wheelMode}
        winnerSegment={lastWinner}
        selectedParticipant={selectedParticipantForModal}
        teams={teams}
        assignments={assignments}
        recommendedTeam={recommendedTeamForModal}
        onAssignParticipantToTeam={handleAssignSingleParticipantToTeam}
        onRemoveTeamFromWheel={(teamId) =>
          setRemovedTeamIds((prev) =>
            prev.includes(teamId) ? prev : [...prev, teamId]
          )
        }
        language={language}
      />

      {/* Factory Reset Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmResetOpen}
        onConfirm={handleConfirmFactoryReset}
        onCancel={() => setConfirmResetOpen(false)}
        language={language}
      />
    </div>
  );
}
