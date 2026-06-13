import type { HabitState, Issue, DailyLogEntry } from './types.js';
export declare function loadState(stateFile: string, user?: string): HabitState;
export declare function saveState(stateFile: string, state: HabitState): void;
export declare function addDailyEntry(state: HabitState, entry: DailyLogEntry): HabitState;
export declare function updateIssue(state: HabitState, issueId: string, updates: Partial<Issue>): HabitState;
export declare function updateStreak(state: HabitState, habitId: string, completed: boolean): HabitState;
export declare function getTodayEntry(state: HabitState): DailyLogEntry | undefined;
export declare function hasDailyRewardEarned(state: HabitState): boolean;
