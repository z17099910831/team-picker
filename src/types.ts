export type Language = 'en' | 'zh';
export type ThemeMode = 'light' | 'dark';

export interface Participant {
  id: string;
  name: string;
  excluded?: boolean;
  lockedTeamId?: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  maxCapacity?: number;
}

export type TeamConfigMode = 'count' | 'size';

export type WheelMode = 'pick_team' | 'assign_participants';

export type FairnessRuleType = 'separate' | 'together';

export interface FairnessRule {
  id: string;
  type: FairnessRuleType;
  participantIds: [string, string];
}

export interface AssignmentRecord {
  participantId: string;
  teamId: string;
  timestamp: number;
}

export interface TeamAssignmentMap {
  [teamId: string]: Participant[];
}

export interface WheelOptions {
  spinDuration: number; // in seconds, 3 to 6
  soundEnabled: boolean;
  confettiEnabled: boolean;
  removeAfterSpin: boolean;
  autoAssignOnSpin: boolean;
}

export interface WheelSegment {
  id: string;
  label: string;
  color: string;
  subLabel?: string;
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  actionLabel?: string;
  actionType?: 'increase_teams' | 'increase_capacity' | 'deduplicate' | 'restore_sample';
}

export interface AppPersistedState {
  participants: Participant[];
  teams: Team[];
  teamConfigMode: TeamConfigMode;
  targetTeamCount: number;
  targetMembersPerTeam: number;
  wheelMode: WheelMode;
  wheelOptions: WheelOptions;
  fairnessRules: FairnessRule[];
  assignments: TeamAssignmentMap;
  assignmentHistory: AssignmentRecord[];
  removedTeamIds: string[];
  language: Language;
  theme: ThemeMode;
}
