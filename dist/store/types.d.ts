export interface DeliveryChannel {
    channel: string;
    to: string;
    accountId?: string;
}
export interface Issue {
    id: string;
    category: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    status: 'active' | 'improved' | 'resolved';
    notes: string;
    updatedAt: string;
}
export interface PhaseGoal {
    description: string;
    target: string;
    metric?: string;
    done: boolean;
}
export interface ChangePlanPhase {
    phase: number;
    name: string;
    duration: string;
    focus: string;
    goals: PhaseGoal[];
    active: boolean;
}
export interface DailyLogEntry {
    date: string;
    tasks: TaskEntry[];
    completedCount: number;
    totalCount: number;
    completionRate: number;
    notes: string;
    mood?: string;
}
export interface TaskEntry {
    id: string;
    title: string;
    category: string;
    completed: boolean;
    completedAt?: string;
    skipped: boolean;
    difficulty: 'easy' | 'medium' | 'hard';
}
export interface StreakInfo {
    habitId: string;
    currentStreak: number;
    longestStreak: number;
    lastDate: string;
    status: 'active' | 'broken' | 'paused';
}
export interface RewardConfig {
    daily: string;
    dailyThreshold: number;
    weekly: string;
    weeklyThreshold: number;
    milestones: MilestoneReward[];
}
export interface MilestoneReward {
    id: string;
    description: string;
    metric: string;
    threshold: number;
    achieved: boolean;
    achievedAt?: string;
    reward: string;
}
export interface PenaltyConfig {
    daily: string;
    skipConsecutive: number;
    skipPenalty: string;
    liePenalty: string;
    lieResetAt: string;
}
export interface HabitConfig {
    stateFile: string;
    user: string;
    deliveryChannels: DeliveryChannel[];
    checkinTime: string;
    reviewDay: string;
    reviewTime: string;
    allowAgentMessages?: boolean;
}
export interface HabitState {
    version: number;
    user: string;
    createdAt: string;
    updatedAt: string;
    issues: Issue[];
    changePlan: {
        version: number;
        startDate: string;
        phases: ChangePlanPhase[];
        currentPhase: number;
    };
    dailyLog: DailyLogEntry[];
    streaks: StreakInfo[];
    rewardConfig: RewardConfig;
    penaltyConfig: PenaltyConfig;
    rewardsEarned: string[];
    penaltiesApplied: string[];
    lieFlag: boolean;
    consecutiveMisses: number;
}
