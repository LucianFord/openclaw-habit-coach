import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type {
  HabitState,
  Issue,
  DailyLogEntry,
  StreakInfo,
  PhaseGoal,
  TaskEntry,
  ChangePlanPhase,
  RewardConfig,
  PenaltyConfig,
} from './types.js'

// ---------------------------------------------------------------------------
// Legacy schema shape (what changelog-state.json may contain)
// ---------------------------------------------------------------------------
interface LegacyRewardPenalty {
  rewards?: {
    daily?: string
    weekly?: string
    [key: string]: unknown
  }
  penalties?: {
    daily?: string
    skipConsecutive?: number
    skipPenalty?: string
    liePenalty?: string
    [key: string]: unknown
  }
}

interface LegacyState {
  currentIssues?: unknown[]
  issues?: unknown[]
  changePlan?: {
    version?: number
    startDate?: string
    currentPhase?: number
    phases?: Array<{
      phase?: number
      name?: string
      duration?: string
      focus?: string
      active?: boolean
      goals?: Array<string | PhaseGoal>
    }>
  }
  dailyLog?: Array<{
    date?: string
    tasks?: Array<string | TaskEntry>
    completedCount?: number
    totalCount?: number
    completionRate?: number
    notes?: string
    mood?: string
  }>
  rewardPenalty?: LegacyRewardPenalty
  rewardConfig?: Partial<RewardConfig>
  penaltyConfig?: Partial<PenaltyConfig>
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function normalizeGoals(raw: Array<string | PhaseGoal>): PhaseGoal[] {
  return raw.map(g => {
    if (typeof g === 'string') {
      return { description: g, target: g, done: false } satisfies PhaseGoal
    }
    return { ...g, done: g.done ?? false }
  })
}

function normalizeTask(raw: string | TaskEntry, index: number): TaskEntry {
  if (typeof raw === 'string') {
    return {
      id: `task-${index}`,
      title: raw,
      category: 'general',
      completed: false,
      skipped: false,
      difficulty: 'medium',
    }
  }
  return raw
}

function normalizeLegacy(raw: LegacyState, defaults: HabitState): HabitState {
  // 1. issues: prefer raw.issues, fall back to raw.currentIssues
  const issues: Issue[] =
    Array.isArray(raw.issues) && raw.issues.length > 0
      ? (raw.issues as Issue[])
      : Array.isArray(raw.currentIssues)
        ? (raw.currentIssues as Issue[])
        : defaults.issues

  // 2. changePlan — normalise goal strings → PhaseGoal objects
  const rawPlan = raw.changePlan
  const changePlan: HabitState['changePlan'] = rawPlan
    ? {
        version: rawPlan.version ?? defaults.changePlan.version,
        startDate: rawPlan.startDate ?? defaults.changePlan.startDate,
        currentPhase: rawPlan.currentPhase ?? defaults.changePlan.currentPhase,
        phases: Array.isArray(rawPlan.phases)
          ? rawPlan.phases.map((p): ChangePlanPhase => ({
              phase: p.phase ?? 0,
              name: p.name ?? '',
              duration: p.duration ?? '',
              focus: p.focus ?? '',
              active: p.active ?? false,
              goals: Array.isArray(p.goals) ? normalizeGoals(p.goals) : [],
            }))
          : defaults.changePlan.phases,
      }
    : defaults.changePlan

  // 3. dailyLog — normalise task strings → TaskEntry objects
  const dailyLog: DailyLogEntry[] = Array.isArray(raw.dailyLog)
    ? raw.dailyLog.map((entry): DailyLogEntry => ({
        date: entry.date ?? '',
        tasks: Array.isArray(entry.tasks)
          ? entry.tasks.map((t, i) => normalizeTask(t, i))
          : [],
        completedCount: entry.completedCount ?? 0,
        totalCount: entry.totalCount ?? 0,
        completionRate: entry.completionRate ?? 0,
        notes: entry.notes ?? '',
        mood: entry.mood,
      }))
    : defaults.dailyLog

  // 4. rewardConfig / penaltyConfig — also absorb legacy rewardPenalty block
  let rewardConfig: RewardConfig = defaults.rewardConfig
  let penaltyConfig: PenaltyConfig = defaults.penaltyConfig

  if (raw.rewardPenalty) {
    const rp = raw.rewardPenalty
    rewardConfig = {
      ...defaults.rewardConfig,
      daily: rp.rewards?.daily ?? defaults.rewardConfig.daily,
      weekly: rp.rewards?.weekly ?? defaults.rewardConfig.weekly,
    }
    penaltyConfig = {
      ...defaults.penaltyConfig,
      daily: rp.penalties?.daily ?? defaults.penaltyConfig.daily,
      skipConsecutive:
        typeof rp.penalties?.skipConsecutive === 'number'
          ? rp.penalties.skipConsecutive
          : defaults.penaltyConfig.skipConsecutive,
      skipPenalty: rp.penalties?.skipPenalty ?? defaults.penaltyConfig.skipPenalty,
      liePenalty: rp.penalties?.liePenalty ?? defaults.penaltyConfig.liePenalty,
    }
  } else {
    // Merge partial rewardConfig / penaltyConfig from the file if present
    if (raw.rewardConfig) {
      rewardConfig = { ...defaults.rewardConfig, ...raw.rewardConfig }
    }
    if (raw.penaltyConfig) {
      penaltyConfig = { ...defaults.penaltyConfig, ...raw.penaltyConfig }
    }
  }

  // 5. Assemble final state — spread all remaining top-level fields first, then
  //    overwrite with the normalized values so plugins never see legacy keys.
  const {
    currentIssues: _ci,
    rewardPenalty: _rp,
    issues: _i,
    changePlan: _cp,
    dailyLog: _dl,
    rewardConfig: _rc,
    penaltyConfig: _pc,
    ...rest
  } = raw

  return {
    ...defaults,
    ...(rest as Partial<HabitState>),
    issues,
    changePlan,
    dailyLog,
    rewardConfig,
    penaltyConfig,
    streaks: Array.isArray(raw.streaks) ? (raw.streaks as StreakInfo[]) : defaults.streaks,
    rewardsEarned: Array.isArray(raw.rewardsEarned)
      ? (raw.rewardsEarned as string[])
      : defaults.rewardsEarned,
    penaltiesApplied: Array.isArray(raw.penaltiesApplied)
      ? (raw.penaltiesApplied as string[])
      : defaults.penaltiesApplied,
    lieFlag: typeof raw.lieFlag === 'boolean' ? raw.lieFlag : defaults.lieFlag,
    consecutiveMisses:
      typeof raw.consecutiveMisses === 'number'
        ? raw.consecutiveMisses
        : defaults.consecutiveMisses,
  }
}

function defaultState(user: string): HabitState {
  return {
    version: 1,
    user,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issues: [],
    changePlan: {
      version: 1,
      startDate: new Date().toISOString().split('T')[0]!,
      phases: [],
      currentPhase: 0,
    },
    dailyLog: [],
    streaks: [],
    rewardConfig: {
      daily: 'Agent praises you warmly and gives you free chat time',
      dailyThreshold: 1.0,
      weekly: 'Agent gives you a special treat of your choosing',
      weeklyThreshold: 0.8,
      milestones: [],
    },
    penaltyConfig: {
      daily: 'Agent gives you a gentle reminder of your commitment',
      skipConsecutive: 3,
      skipPenalty: 'Agent gives you a firm but caring reminder',
      liePenalty: 'Agent calls you out clearly and resets trust',
      lieResetAt: '',
    },
    rewardsEarned: [],
    penaltiesApplied: [],
    lieFlag: false,
    consecutiveMisses: 0,
  }
}

export function loadState(stateFile: string, user = 'user'): HabitState {
  if (!existsSync(stateFile)) {
    return defaultState(user)
  }
  try {
    const raw = JSON.parse(readFileSync(stateFile, 'utf-8')) as LegacyState
    const base = defaultState((raw.user as string | undefined) ?? user)
    return normalizeLegacy(raw, base)
  } catch {
    return defaultState(user)
  }
}

export function saveState(stateFile: string, state: HabitState): void {
  const updated: HabitState = { ...state, updatedAt: new Date().toISOString() }
  writeFileSync(stateFile, JSON.stringify(updated, null, 2), 'utf-8')
}

export function addDailyEntry(state: HabitState, entry: DailyLogEntry): HabitState {
  const dailyLog = [...state.dailyLog]
  const idx = dailyLog.findIndex(e => e.date === entry.date)
  if (idx >= 0) {
    dailyLog[idx] = entry
  } else {
    dailyLog.push(entry)
  }
  return { ...state, dailyLog }
}

export function updateIssue(
  state: HabitState,
  issueId: string,
  updates: Partial<Issue>,
): HabitState {
  const issues = state.issues.map(issue =>
    issue.id === issueId
      ? { ...issue, ...updates, updatedAt: new Date().toISOString() }
      : issue,
  )
  return { ...state, issues }
}

export function updateStreak(
  state: HabitState,
  habitId: string,
  completed: boolean,
): HabitState {
  const today = new Date().toISOString().split('T')[0]!
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]!

  const streaks = [...state.streaks]
  const idx = streaks.findIndex(s => s.habitId === habitId)

  if (idx < 0) {
    const newEntry: StreakInfo = {
      habitId,
      currentStreak: completed ? 1 : 0,
      longestStreak: completed ? 1 : 0,
      lastDate: today,
      status: completed ? 'active' : 'broken',
    }
    streaks.push(newEntry)
    return { ...state, streaks }
  }

  const existing = streaks[idx]!

  if (completed) {
    let newCurrent: number
    if (existing.lastDate === today) {
      // Already updated today — no change
      newCurrent = existing.currentStreak
    } else if (existing.lastDate === yesterdayStr) {
      // Continuing streak
      newCurrent = existing.currentStreak + 1
    } else {
      // Gap — restart streak
      newCurrent = 1
    }
    streaks[idx] = {
      ...existing,
      currentStreak: newCurrent,
      longestStreak: Math.max(existing.longestStreak, newCurrent),
      lastDate: today,
      status: 'active',
    }
  } else {
    streaks[idx] = {
      ...existing,
      currentStreak: 0,
      lastDate: today,
      status: 'broken',
    }
  }

  return { ...state, streaks }
}

export function getTodayEntry(state: HabitState): DailyLogEntry | undefined {
  const today = new Date().toISOString().split('T')[0]!
  return state.dailyLog.find(e => e.date === today)
}

export function hasDailyRewardEarned(state: HabitState): boolean {
  const entry = getTodayEntry(state)
  if (!entry || entry.totalCount === 0) return false
  return entry.completionRate >= state.rewardConfig.dailyThreshold
}
