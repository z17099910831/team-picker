import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus,
  Trash2,
  RotateCcw,
  Shuffle,
  ArrowUp,
  ArrowDown,
  Lock,
  UserCheck,
  UserX,
  Plus,
  X,
  Camera,
} from 'lucide-react';
import {
  FairnessRule,
  FairnessRuleType,
  Language,
  Participant,
  Team,
} from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import {
  createSampleParticipants,
  fisherYatesShuffle,
  generateId,
} from '../utils/assignmentAlgorithm';
import {
  getDefaultPhotoForIndex,
  processUploadedPhotoFile,
} from '../utils/avatar';
import { ParticipantAvatar } from './ParticipantAvatar';

interface ParticipantEditorProps {
  participants: Participant[];
  teams: Team[];
  fairnessRules: FairnessRule[];
  onChangeParticipants: (participants: Participant[]) => void;
  onChangeFairnessRules: (rules: FairnessRule[]) => void;
  language: Language;
  disabled?: boolean;
}

export const ParticipantEditor: React.FC<ParticipantEditorProps> = ({
  participants,
  teams,
  fairnessRules,
  onChangeParticipants,
  onChangeFairnessRules,
  language,
  disabled = false,
}) => {
  const t = TRANSLATIONS[language];
  const [activeTab, setActiveTab] = useState<'list' | 'bulk' | 'fairness'>('list');
  const [newName, setNewName] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | undefined>(undefined);
  const [bulkText, setBulkText] = useState(() =>
    participants.map((p) => p.name).join('\n')
  );

  // Hidden file input for per-participant photo upload
  const rowFileInputRef = useRef<HTMLInputElement | null>(null);
  const newEntryFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingParticipantId, setUploadingParticipantId] = useState<string | null>(null);

  // Rule builder state
  const [ruleType, setRuleType] = useState<FairnessRuleType>('separate');
  const [rulePersonA, setRulePersonA] = useState<string>('');
  const [rulePersonB, setRulePersonB] = useState<string>('');

  // Keep bulkText synchronized when participants are updated externally
  useEffect(() => {
    const currentLines = bulkText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const participantNames = participants.map((p) => p.name);
    if (
      currentLines.length !== participantNames.length ||
      currentLines.some((line, i) => line !== participantNames[i])
    ) {
      setBulkText(participantNames.join('\n'));
    }
  }, [participants]);

  // Handle multiline textarea edits while preserving existing participant IDs and photos
  const handleBulkTextChange = (rawText: string) => {
    setBulkText(rawText);
    const lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const updated: Participant[] = lines.map((name, idx) => {
      const existingAtIndex = participants[idx];
      if (existingAtIndex && existingAtIndex.name === name) {
        return existingAtIndex;
      }
      if (existingAtIndex) {
        return {
          ...existingAtIndex,
          name,
          photoUrl: existingAtIndex.photoUrl || getDefaultPhotoForIndex(idx),
        };
      }
      return {
        id: generateId('p'),
        name,
        photoUrl: getDefaultPhotoForIndex(idx),
        excluded: false,
      };
    });

    onChangeParticipants(updated);
  };

  const handleAddSingleParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    const nextIdx = participants.length;
    const next: Participant[] = [
      ...participants,
      {
        id: generateId('p'),
        name: trimmed,
        photoUrl: newPhotoUrl || getDefaultPhotoForIndex(nextIdx),
        excluded: false,
      },
    ];
    onChangeParticipants(next);
    setNewName('');
    setNewPhotoUrl(undefined);
  };

  const handleNewEntryFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await processUploadedPhotoFile(file);
      setNewPhotoUrl(dataUrl);
    } catch {
      // ignore invalid image
    }
  };

  const triggerRowPhotoUpload = (participantId: string) => {
    if (disabled) return;
    setUploadingParticipantId(participantId);
    rowFileInputRef.current?.click();
  };

  const handleRowFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadingParticipantId) return;

    try {
      const dataUrl = await processUploadedPhotoFile(file);
      onChangeParticipants(
        participants.map((p) =>
          p.id === uploadingParticipantId ? { ...p, photoUrl: dataUrl } : p
        )
      );
    } catch {
      // ignore invalid image
    } finally {
      setUploadingParticipantId(null);
    }
  };

  const handleUpdateName = (id: string, name: string) => {
    onChangeParticipants(
      participants.map((p) => (p.id === id ? { ...p, name } : p))
    );
  };

  const handleToggleExcluded = (id: string) => {
    onChangeParticipants(
      participants.map((p) =>
        p.id === id ? { ...p, excluded: !p.excluded } : p
      )
    );
  };

  const handleLockTeamChange = (id: string, teamId: string) => {
    onChangeParticipants(
      participants.map((p) =>
        p.id === id ? { ...p, lockedTeamId: teamId || undefined } : p
      )
    );
  };

  const handleRemoveParticipant = (id: string) => {
    onChangeParticipants(participants.filter((p) => p.id !== id));
    onChangeFairnessRules(
      fairnessRules.filter((r) => !r.participantIds.includes(id))
    );
  };

  const handleMoveParticipant = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= participants.length) return;
    const copy = [...participants];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    onChangeParticipants(copy);
  };

  const handleDeduplicate = () => {
    const seen = new Set<string>();
    const deduped: Participant[] = [];
    for (const p of participants) {
      const key = p.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(p);
      }
    }
    onChangeParticipants(deduped);
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulePersonA || !rulePersonB || rulePersonA === rulePersonB) return;

    const alreadyExists = fairnessRules.some(
      (r) =>
        (r.participantIds[0] === rulePersonA &&
          r.participantIds[1] === rulePersonB) ||
        (r.participantIds[0] === rulePersonB &&
          r.participantIds[1] === rulePersonA)
    );
    if (alreadyExists) return;

    onChangeFairnessRules([
      ...fairnessRules,
      {
        id: generateId('rule'),
        type: ruleType,
        participantIds: [rulePersonA, rulePersonB],
      },
    ]);
    setRulePersonA('');
    setRulePersonB('');
  };

  // Detect duplicate names
  const seenNames = new Set<string>();
  let hasDuplicates = false;
  for (const p of participants) {
    const key = p.name.trim().toLowerCase();
    if (seenNames.has(key)) {
      hasDuplicates = true;
      break;
    }
    seenNames.add(key);
  }

  const activeCount = participants.filter((p) => !p.excluded).length;

  return (
    <section
      id="participants-panel"
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5"
    >
      {/* Hidden file inputs for photo uploads */}
      <input
        ref={rowFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleRowFileChange}
        className="hidden"
      />
      <input
        ref={newEntryFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleNewEntryFileChange}
        className="hidden"
      />

      {/* Header & Clean Unboxed Metadata */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
            {t.participantsTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.participantsSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
          <span>
            {t.totalCount}: <strong>{participants.length}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t.activeCount}: <strong>{activeCount}</strong>
          </span>
        </div>
      </div>

      {/* Interactive Mode Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'list'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t.listEditTab} ({participants.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bulk')}
          className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'bulk'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t.bulkEditTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fairness')}
          className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'fairness'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t.fairnessTab}
        </button>
      </div>

      {/* Quick Add Single Participant Input with Optional Photo Upload */}
      {activeTab !== 'fairness' && (
        <form onSubmit={handleAddSingleParticipant} className="flex items-center gap-2 mb-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => newEntryFileInputRef.current?.click()}
            title={
              language === 'zh'
                ? '为新成员上传头像照片'
                : 'Upload photo for new participant'
            }
            className="relative group flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 transition-colors cursor-pointer"
          >
            {newPhotoUrl ? (
              <img
                src={newPhotoUrl}
                alt="New participant preview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <Camera className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-600" />
            )}
          </button>

          <input
            type="text"
            value={newName}
            disabled={disabled}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.addParticipantPlaceholder}
            maxLength={80}
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={disabled || !newName.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t.addBtn}</span>
          </button>
        </form>
      )}

      {/* Tab 1: Interactive Individual List with Photo & Upload Button per Name */}
      {activeTab === 'list' && (
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
          {participants.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No participants in list.
            </div>
          ) : (
            participants.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 text-sm ${
                  p.excluded
                    ? 'bg-slate-50/70 dark:bg-slate-800/40 opacity-60'
                    : 'bg-white dark:bg-slate-900'
                }`}
              >
                <span className="w-4 text-xs font-mono text-slate-400 tabular-nums shrink-0">
                  {idx + 1}.
                </span>

                {/* Clickable Avatar with Camera Overlay */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => triggerRowPhotoUpload(p.id)}
                  title={
                    language === 'zh'
                      ? `更换 ${p.name} 的照片`
                      : `Upload photo for ${p.name}`
                  }
                  className="relative group rounded-full shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer"
                >
                  <ParticipantAvatar
                    name={p.name}
                    photoUrl={p.photoUrl || getDefaultPhotoForIndex(idx)}
                    size="sm"
                  />
                  <span className="absolute inset-0 rounded-full bg-slate-900/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </span>
                </button>

                <input
                  type="text"
                  value={p.name}
                  disabled={disabled}
                  onChange={(e) => handleUpdateName(p.id, e.target.value)}
                  aria-label={`Participant ${idx + 1} name`}
                  className={`flex-1 min-w-0 px-2 py-1 text-sm rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-600 focus:outline-none bg-transparent ${
                    p.excluded
                      ? 'line-through text-slate-400'
                      : 'text-slate-900 dark:text-white font-medium'
                  }`}
                />

                {/* Dedicated Upload Photo Button for Each Name */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => triggerRowPhotoUpload(p.id)}
                  title={
                    language === 'zh'
                      ? `上传 ${p.name} 的照片`
                      : `Upload photo for ${p.name}`
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  <span>{language === 'zh' ? '上传照片' : 'Photo'}</span>
                </button>

                {/* Reorder Up/Down */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveParticipant(idx, -1)}
                    disabled={disabled || idx === 0}
                    title="Move Up"
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveParticipant(idx, 1)}
                    disabled={disabled || idx === participants.length - 1}
                    title="Move Down"
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Include / Exclude toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleExcluded(p.id)}
                  disabled={disabled}
                  title={p.excluded ? t.excludedLabel : t.includeLabel}
                  className={`px-2 py-1 text-xs rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    p.excluded
                      ? 'border-slate-200 dark:border-slate-700 text-slate-500'
                      : 'border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                  }`}
                >
                  {p.excluded ? (
                    <UserX className="w-3.5 h-3.5" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleRemoveParticipant(p.id)}
                  disabled={disabled}
                  title="Remove participant"
                  className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Bulk Multiline Editor */}
      {activeTab === 'bulk' && (
        <div>
          <textarea
            value={bulkText}
            disabled={disabled}
            onChange={(e) => handleBulkTextChange(e.target.value)}
            rows={7}
            aria-label={t.participantsTitle}
            placeholder="Alex&#10;Bella&#10;Charlie..."
            className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
          />
        </div>
      )}

      {/* Tab 3: Fairness Rules & Team Locks */}
      {activeTab === 'fairness' && (
        <div className="space-y-4">
          {/* Lock Participant to Specific Team */}
          <div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.lockedTo}</span>
            </h3>
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {participants
                .filter((p) => !p.excluded)
                .map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                  >
                    <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200 truncate">
                      <ParticipantAvatar
                        name={p.name}
                        photoUrl={p.photoUrl || getDefaultPhotoForIndex(idx)}
                        size="xs"
                      />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <select
                      value={p.lockedTeamId || ''}
                      onChange={(e) => handleLockTeamChange(p.id, e.target.value)}
                      className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">{t.noLock}</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          </div>

          {/* Keep Separate / Keep Together Pair Rules */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.fairnessRulesTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
              {t.fairnessRulesDesc}
            </p>

            <form onSubmit={handleAddRule} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
              <select
                value={rulePersonA}
                onChange={(e) => setRulePersonA(e.target.value)}
                aria-label="First participant"
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="">Person A...</option>
                {participants
                  .filter((p) => !p.excluded)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>

              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as FairnessRuleType)}
                aria-label="Constraint type"
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="separate">{t.ruleSeparate}</option>
                <option value="together">{t.ruleTogether}</option>
              </select>

              <select
                value={rulePersonB}
                onChange={(e) => setRulePersonB(e.target.value)}
                aria-label="Second participant"
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="">Person B...</option>
                {participants
                  .filter((p) => !p.excluded && p.id !== rulePersonA)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>

              <button
                type="submit"
                disabled={!rulePersonA || !rulePersonB || rulePersonA === rulePersonB}
                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addRuleBtn}</span>
              </button>
            </form>

            {fairnessRules.length === 0 ? (
              <p className="text-xs text-slate-400 italic">{t.noRulesYet}</p>
            ) : (
              <ul className="space-y-1.5">
                {fairnessRules.map((rule) => {
                  const pA = participants.find((p) => p.id === rule.participantIds[0]);
                  const pB = participants.find((p) => p.id === rule.participantIds[1]);
                  if (!pA || !pB) return null;
                  return (
                    <li
                      key={rule.id}
                      className="flex items-center justify-between px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <span className="text-slate-700 dark:text-slate-200">
                        <strong>{pA.name}</strong> &amp; <strong>{pB.name}</strong> ·{' '}
                        <span
                          className={
                            rule.type === 'separate'
                              ? 'text-amber-600 dark:text-amber-400 font-medium'
                              : 'text-blue-600 dark:text-blue-400 font-medium'
                          }
                        >
                          {rule.type === 'separate' ? t.ruleSeparate : t.ruleTogether}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeFairnessRules(
                            fairnessRules.filter((r) => r.id !== rule.id)
                          )
                        }
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Duplicate warning & quick deduplicate button */}
      {hasDuplicates && (
        <div className="mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-300">
          <span>{t.duplicatesWarning}</span>
          <button
            type="button"
            onClick={handleDeduplicate}
            className="px-2.5 py-1 font-semibold bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.deduplicateBtn}
          </button>
        </div>
      )}

      {/* Footer Action Bar */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={disabled || participants.length < 2}
            onClick={() => onChangeParticipants(fisherYatesShuffle(participants))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="w-3 h-3" />
            <span>{t.shuffleOrder}</span>
          </button>

          {participants.some((p) => p.excluded) && (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onChangeParticipants(
                  participants.map((p) => ({ ...p, excluded: false }))
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t.selectAllActive}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const sample = createSampleParticipants();
              onChangeParticipants(sample);
              setBulkText(sample.map((p) => p.name).join('\n'));
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t.restoreSample}</span>
          </button>

          <button
            type="button"
            disabled={disabled || participants.length === 0}
            onClick={() => {
              onChangeParticipants([]);
              setBulkText('');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>{t.clearAll}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
