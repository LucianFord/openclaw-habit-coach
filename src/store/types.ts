// Habit Coach — State Schema & Types
// This file defines the data model for the habit tracking system.

export interface DeliveryChannel {
  channel: string            // e.g. "openclaw-weixin", "discord", "telegram"
  to: string                 // channel-specific target (user ID, chat ID, etc.)
  accountId?: string         // optional account ID for multi-account channels
}

export interface Issue {
  id: string
  category: string          // e.g. "健康", "运动", "学业"
  issue: string             // description
  severity: 'low' | 'medium' | 'high'
  status: 'active' | 'improved' | 'resolved'
  notes: string
  updatedAt: string         // ISO date
}

export interface PhaseGoal {
  description: string
  target: string
  metric?: string            // e.g. "times/week", "minutes/day"
  done: boolean
}

export interface ChangePlanPhase {
  phase: number
  name: string
  duration: string
  focus: string
  goals: PhaseGoal[]
  active: boolean
}

export interface DailyLogEntry {
  date: string              // YYYY-MM-DD
  tasks: TaskEntry[]
  completedCount: number
  totalCount: number
  completionRate: number    // 0-1
  notes: string
  mood?: string
}

export interface TaskEntry {
  id: string
  title: string
  category: string
  completed: boolean
  completedAt?: string
  skipped: boolean
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface StreakInfo {
  habitId: string           // matches Issue.id or a goal id
  currentStreak: number
  longestStreak: number
  lastDate: string          // YYYY-MM-DD
  status: 'active' | 'broken' | 'paused'
}

export interface RewardConfig {
  daily: string               // e.g. "do anything with agent"
  dailyThreshold: number      // fraction, e.g. 1 = 100%
  weekly: string
  weeklyThreshold: number     // e.g. 0.8 = 80%
  milestones: MilestoneReward[]
}

export interface MilestoneReward {
  id: string
  description: string
  metric: string             // e.g. "weight-gain", "streak-days"
  threshold: number
  achieved: boolean
  achievedAt?: string
  reward: string
}

export interface PenaltyConfig {
  daily: string
  skipConsecutive: number     // days of consecutive misses before penalty
  skipPenalty: string
  liePenalty: string
  lieResetAt: string          // ISO date — clears lie flag
}

export interface HabitConfig {
  stateFile: string
  user: string
  deliveryChannels: DeliveryChannel[]  // ordered list; first = primary, rest = fallback
  checkinTime: string                // times for daily task delivery (HH:MM)
  reviewTime: string                    // time for daily review (HH:MM), default "23:00"
  weeklyReviewTime: string               // time for weekly review on Sunday (HH:MM), default "23:30"
  allowAgentMessages?: boolean
}

export interface HabitState {
  version: number
  user: string
  createdAt: string
  updatedAt: string
  issues: Issue[]
  changePlan: {
    version: number
    startDate: string
    phases: ChangePlanPhase[]
    currentPhase: number
  }
  dailyLog: DailyLogEntry[]
  streaks: StreakInfo[]
  rewardConfig: RewardConfig
  penaltyConfig: PenaltyConfig
  rewardsEarned: string[]     // list of earned reward descriptions
  penaltiesApplied: string[]
  lieFlag: boolean
  consecutiveMisses: number
}
