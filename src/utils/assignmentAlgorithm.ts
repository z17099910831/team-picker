import {
  FairnessRule,
  Participant,
  Team,
  TeamAssignmentMap,
  ValidationIssue,
} from '../types';
import { getDefaultPhotoForIndex } from './avatar';

export const TEAM_COLOR_PALETTE = [
  '#2563EB', // Blue 600
  '#059669', // Emerald 600
  '#D97706', // Amber 600
  '#DC2626', // Red 600
  '#7C3AED', // Violet 600
  '#0891B2', // Cyan 600
  '#DB2777', // Pink 600
  '#4F46E5', // Indigo 600
  '#EA580C', // Orange 600
  '#0D9488', // Teal 600
  '#65A30D', // Lime 600
  '#9333EA', // Purple 600
];

export const SAMPLE_PARTICIPANT_NAMES = [
  'Alex',
  'Bella',
  'Charlie',
  'David',
  'Emma',
  'Frank',
  'Grace',
  'Henry',
  'Isabella',
  'Jack',
  'Kevin',
  'Lily',
];

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

export function createSampleParticipants(): Participant[] {
  return SAMPLE_PARTICIPANT_NAMES.map((name, index) => ({
    id: `p_sample_${index}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    photoUrl: getDefaultPhotoForIndex(index),
    excluded: false,
  }));
}

export function createDefaultTeams(count: number, existingTeams: Team[] = []): Team[] {
  const safeCount = Math.max(1, Math.min(50, Math.floor(count || 1)));
  const result: Team[] = [];

  for (let i = 0; i < safeCount; i++) {
    if (existingTeams[i]) {
      result.push(existingTeams[i]);
    } else {
      result.push({
        id: generateId(`team_${i + 1}`),
        name: `Team ${i + 1}`,
        color: TEAM_COLOR_PALETTE[i % TEAM_COLOR_PALETTE.length],
      });
    }
  }
  return result;
}

/**
 * Genuine Fisher-Yates uniform shuffle.
 * Returns a new array without mutating the input.
 */
export function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Calculates how participants will be distributed across teams.
 * Returns an array of team sizes (e.g. [4, 3, 3] for 10 participants across 3 teams).
 */
export function calculateDistributionPreview(
  activeParticipantCount: number,
  teams: Team[]
): { sizes: number[]; unassignedRemainder: number; description: string } {
  const numTeams = teams.length;
  if (numTeams === 0 || activeParticipantCount === 0) {
    return {
      sizes: teams.map(() => 0),
      unassignedRemainder: activeParticipantCount,
      description: '0 participants assigned',
    };
  }

  const capacities = teams.map((t) =>
    t.maxCapacity && t.maxCapacity > 0 ? t.maxCapacity : Infinity
  );
  const sizes = teams.map(() => 0);
  let remaining = activeParticipantCount;

  // Distribute one by one to the smallest team with remaining capacity
  while (remaining > 0) {
    let minSize = Infinity;
    let candidateIdx = -1;

    for (let i = 0; i < numTeams; i++) {
      if (sizes[i] < capacities[i] && sizes[i] < minSize) {
        minSize = sizes[i];
        candidateIdx = i;
      }
    }

    if (candidateIdx === -1) {
      // All teams hit max capacity
      break;
    }

    sizes[candidateIdx]++;
    remaining--;
  }

  // Group sizes for human-readable summary
  const sizeCounts: Record<number, number> = {};
  sizes.forEach((s) => {
    if (s > 0) {
      sizeCounts[s] = (sizeCounts[s] || 0) + 1;
    }
  });

  const parts = Object.entries(sizeCounts)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([size, count]) => `${count} ${count === 1 ? 'team' : 'teams'} of ${size}`);

  const emptyCount = sizes.filter((s) => s === 0).length;
  if (emptyCount > 0) {
    parts.push(`${emptyCount} empty ${emptyCount === 1 ? 'team' : 'teams'}`);
  }

  return {
    sizes,
    unassignedRemainder: remaining,
    description: parts.join(' · ') || 'No active teams',
  };
}

/**
 * Validates participants, teams, capacities, and fairness rules.
 */
export function validateConfiguration(
  participants: Participant[],
  teams: Team[],
  fairnessRules: FairnessRule[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const activeParticipants = participants.filter((p) => !p.excluded && p.name.trim().length > 0);

  if (activeParticipants.length === 0) {
    issues.push({
      type: 'error',
      message: 'Please add at least one active participant before generating teams.',
      actionLabel: 'Restore Sample Data',
      actionType: 'restore_sample',
    });
    return issues;
  }

  if (teams.length === 0) {
    issues.push({
      type: 'error',
      message: 'At least 1 team is required.',
      actionLabel: 'Add Teams',
      actionType: 'increase_teams',
    });
    return issues;
  }

  if (activeParticipants.length === 1) {
    issues.push({
      type: 'warning',
      message: 'Only 1 active participant is in the list. Add more participants for balanced teams.',
    });
  }

  if (teams.length > activeParticipants.length) {
    issues.push({
      type: 'warning',
      message: `There are more teams (${teams.length}) than active participants (${activeParticipants.length}). Some teams will remain empty.`,
    });
  }

  // Check duplicate names
  const seenNames = new Set<string>();
  let duplicateCount = 0;
  for (const p of activeParticipants) {
    const normalized = p.name.trim().toLowerCase();
    if (seenNames.has(normalized)) {
      duplicateCount++;
    } else {
      seenNames.add(normalized);
    }
  }

  if (duplicateCount > 0) {
    issues.push({
      type: 'warning',
      message: `${duplicateCount} duplicate name(s) found. Each entry is preserved as a separate person with a unique internal ID.`,
      actionLabel: 'Remove Duplicates',
      actionType: 'deduplicate',
    });
  }

  // Check total capacity
  const totalCapacity = teams.reduce(
    (sum, t) => sum + (t.maxCapacity && t.maxCapacity > 0 ? t.maxCapacity : Infinity),
    0
  );

  if (totalCapacity < activeParticipants.length) {
    issues.push({
      type: 'error',
      message: `Total team capacity (${totalCapacity}) is less than active participants (${activeParticipants.length}).`,
      actionLabel: 'Clear Capacity Limits',
      actionType: 'increase_capacity',
    });
  }

  // Check locked participants exceeding a specific team's capacity
  const lockedCounts: Record<string, number> = {};
  for (const p of activeParticipants) {
    if (p.lockedTeamId && teams.some((t) => t.id === p.lockedTeamId)) {
      lockedCounts[p.lockedTeamId] = (lockedCounts[p.lockedTeamId] || 0) + 1;
    }
  }

  for (const t of teams) {
    if (t.maxCapacity && t.maxCapacity > 0 && (lockedCounts[t.id] || 0) > t.maxCapacity) {
      issues.push({
        type: 'error',
        message: `"${t.name}" has ${lockedCounts[t.id]} locked members, exceeding its max capacity of ${t.maxCapacity}.`,
        actionLabel: 'Clear Capacity Limits',
        actionType: 'increase_capacity',
      });
    }
  }

  // Check contradictory fairness rules
  for (const rule of fairnessRules) {
    const [idA, idB] = rule.participantIds;
    const pA = activeParticipants.find((p) => p.id === idA);
    const pB = activeParticipants.find((p) => p.id === idB);
    if (!pA || !pB) continue;

    if (
      rule.type === 'separate' &&
      pA.lockedTeamId &&
      pB.lockedTeamId &&
      pA.lockedTeamId === pB.lockedTeamId
    ) {
      issues.push({
        type: 'error',
        message: `Conflict: ${pA.name} and ${pB.name} are locked to the same team, but have a "Keep Separate" rule.`,
      });
    }

    if (
      rule.type === 'together' &&
      pA.lockedTeamId &&
      pB.lockedTeamId &&
      pA.lockedTeamId !== pB.lockedTeamId
    ) {
      issues.push({
        type: 'error',
        message: `Conflict: ${pA.name} and ${pB.name} are locked to different teams, but have a "Keep Together" rule.`,
      });
    }

    if (rule.type === 'separate' && teams.length < 2) {
      issues.push({
        type: 'error',
        message: `Cannot keep ${pA.name} and ${pB.name} separate when there is only 1 team.`,
      });
    }
  }

  return issues;
}

/**
 * Generates a balanced random team assignment using Fisher-Yates shuffling.
 * Randomizes both the participant order and which teams receive any extra remainder members.
 * Respects locked teams, max capacities, and pair fairness constraints.
 */
export function generateBalancedTeams(
  participants: Participant[],
  teams: Team[],
  fairnessRules: FairnessRule[] = []
): { assignments: TeamAssignmentMap; unassigned: Participant[]; conflictWarning?: string } {
  const assignments: TeamAssignmentMap = {};
  teams.forEach((t) => {
    assignments[t.id] = [];
  });

  if (teams.length === 0) {
    return { assignments, unassigned: [...participants] };
  }

  const activeParticipants = participants.filter((p) => !p.excluded && p.name.trim().length > 0);
  const validTeamIds = new Set(teams.map((t) => t.id));
  const capacityMap: Record<string, number> = {};
  teams.forEach((t) => {
    capacityMap[t.id] = t.maxCapacity && t.maxCapacity > 0 ? t.maxCapacity : Infinity;
  });

  const assignedIds = new Set<string>();
  const unassigned: Participant[] = [];
  let conflictWarning: string | undefined;

  // Helper to check if placing participant p into teamId violates a 'separate' rule
  const hasSeparateConflict = (participantId: string, teamId: string): boolean => {
    const currentTeamMembers = assignments[teamId] || [];
    for (const rule of fairnessRules) {
      if (rule.type !== 'separate') continue;
      const [a, b] = rule.participantIds;
      if (a === participantId && currentTeamMembers.some((m) => m.id === b)) return true;
      if (b === participantId && currentTeamMembers.some((m) => m.id === a)) return true;
    }
    return false;
  };

  // Step 1: Place locked participants first
  const shuffledActive = fisherYatesShuffle(activeParticipants);
  for (const p of shuffledActive) {
    if (p.lockedTeamId && validTeamIds.has(p.lockedTeamId)) {
      const targetTeamId = p.lockedTeamId;
      if (assignments[targetTeamId].length < capacityMap[targetTeamId]) {
        assignments[targetTeamId].push(p);
        assignedIds.add(p.id);
      }
    }
  }

  // Step 2: Handle 'together' rules where one partner is already assigned or both are unassigned
  const togetherRules = fairnessRules.filter((r) => r.type === 'together');
  for (const rule of togetherRules) {
    const [idA, idB] = rule.participantIds;
    const pA = activeParticipants.find((p) => p.id === idA);
    const pB = activeParticipants.find((p) => p.id === idB);
    if (!pA || !pB) continue;

    const aAssigned = assignedIds.has(pA.id);
    const bAssigned = assignedIds.has(pB.id);

    if (aAssigned && !bAssigned) {
      const teamOfA = teams.find((t) => assignments[t.id].some((m) => m.id === pA.id));
      if (teamOfA && assignments[teamOfA.id].length < capacityMap[teamOfA.id]) {
        assignments[teamOfA.id].push(pB);
        assignedIds.add(pB.id);
      }
    } else if (!aAssigned && bAssigned) {
      const teamOfB = teams.find((t) => assignments[t.id].some((m) => m.id === pB.id));
      if (teamOfB && assignments[teamOfB.id].length < capacityMap[teamOfB.id]) {
        assignments[teamOfB.id].push(pA);
        assignedIds.add(pA.id);
      }
    } else if (!aAssigned && !bAssigned) {
      // Find a team with room for 2 and minimal current size
      const shuffledTeams = fisherYatesShuffle(teams);
      shuffledTeams.sort((a, b) => assignments[a.id].length - assignments[b.id].length);
      const bestTeam = shuffledTeams.find(
        (t) =>
          assignments[t.id].length + 2 <= capacityMap[t.id] &&
          !hasSeparateConflict(pA.id, t.id) &&
          !hasSeparateConflict(pB.id, t.id)
      );
      if (bestTeam) {
        assignments[bestTeam.id].push(pA, pB);
        assignedIds.add(pA.id);
        assignedIds.add(pB.id);
      } else {
        conflictWarning = 'Some pair constraints could not be satisfied due to team size limits.';
      }
    }
  }

  // Step 3: Distribute remaining unlocked participants evenly
  // Crucial requirement: Randomize both participant order and team order so extra members
  // are not always given to Team 1.
  const remainingParticipants = fisherYatesShuffle(
    activeParticipants.filter((p) => !assignedIds.has(p.id))
  );

  for (const participant of remainingParticipants) {
    // Shuffle teams first so ties in member count are broken completely randomly
    const candidateTeams = fisherYatesShuffle(teams).filter(
      (t) => assignments[t.id].length < capacityMap[t.id]
    );

    if (candidateTeams.length === 0) {
      unassigned.push(participant);
      continue;
    }

    // Sort by current team size ascending (stable sort preserves random tie-breaking)
    candidateTeams.sort((a, b) => assignments[a.id].length - assignments[b.id].length);

    // Prefer the smallest team that also has no 'separate' conflict
    const conflictFreeTeam = candidateTeams.find(
      (t) => !hasSeparateConflict(participant.id, t.id)
    );

    if (conflictFreeTeam) {
      assignments[conflictFreeTeam.id].push(participant);
      assignedIds.add(participant.id);
    } else {
      // Fallback to smallest available team if constraint is impossible
      assignments[candidateTeams[0].id].push(participant);
      assignedIds.add(participant.id);
      conflictWarning = 'A "Keep Separate" constraint conflicted with balanced team capacities.';
    }
  }

  return { assignments, unassigned, conflictWarning };
}

/**
 * Picks the single best balanced team for an individual participant during interactive Wheel Mode 2.
 */
export function pickBalancedTeamForParticipant(
  participant: Participant,
  teams: Team[],
  currentAssignments: TeamAssignmentMap,
  fairnessRules: FairnessRule[] = []
): Team | null {
  if (teams.length === 0) return null;

  // Respect lock if applicable
  if (participant.lockedTeamId) {
    const lockedTeam = teams.find((t) => t.id === participant.lockedTeamId);
    if (lockedTeam) {
      const currentCount = (currentAssignments[lockedTeam.id] || []).length;
      const maxCap = lockedTeam.maxCapacity && lockedTeam.maxCapacity > 0 ? lockedTeam.maxCapacity : Infinity;
      if (currentCount < maxCap) return lockedTeam;
    }
  }

  // Check if partner in 'together' rule is already in a team
  for (const rule of fairnessRules) {
    if (rule.type === 'together') {
      const [idA, idB] = rule.participantIds;
      const partnerId = idA === participant.id ? idB : idB === participant.id ? idA : null;
      if (partnerId) {
        const partnerTeam = teams.find((t) =>
          (currentAssignments[t.id] || []).some((m) => m.id === partnerId)
        );
        if (partnerTeam) {
          const maxCap =
            partnerTeam.maxCapacity && partnerTeam.maxCapacity > 0
              ? partnerTeam.maxCapacity
              : Infinity;
          if ((currentAssignments[partnerTeam.id] || []).length < maxCap) {
            return partnerTeam;
          }
        }
      }
    }
  }

  // Filter teams that still have capacity
  const availableTeams = fisherYatesShuffle(teams).filter((t) => {
    const maxCap = t.maxCapacity && t.maxCapacity > 0 ? t.maxCapacity : Infinity;
    return (currentAssignments[t.id] || []).length < maxCap;
  });

  if (availableTeams.length === 0) return null;

  // Sort by smallest current team size (random tie-breaking preserved)
  availableTeams.sort(
    (a, b) => (currentAssignments[a.id] || []).length - (currentAssignments[b.id] || []).length
  );

  // Avoid 'separate' conflicts if possible
  const noConflict = availableTeams.find((t) => {
    const members = currentAssignments[t.id] || [];
    return !fairnessRules.some(
      (r) =>
        r.type === 'separate' &&
        r.participantIds.includes(participant.id) &&
        members.some((m) => r.participantIds.includes(m.id))
    );
  });

  return noConflict || availableTeams[0];
}
