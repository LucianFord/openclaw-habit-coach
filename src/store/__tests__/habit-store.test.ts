import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  loadState,
  saveState,
  addDailyEntry,
  updateStreak,
  getTodayEntry,
  hasDailyRewardEarned,
} from '../habit-store.js'
import { generateTasks } from '../task-generator.js'
import type { HabitState, Issue, DailyLogEntry } from '../types.js'

// ── Setup ─────────────────────────────────────────────────────────────────────

let tmpDir: string
let stateFile: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'habit-coach-test-'))
  stateFile = join(tmpDir, 'state.json')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

// ── loadState ─────────────────────────────────────────────────────────────────

describe('loadState', () => {
  it('returns a default state when file does not exist', () => {
    const state = loadState(stateFile, 'alice')
    expect(state.user).toBe('alice')
    expect(state.version).toBe(1)
    expect(state.issues).toEqual([])
    expect(state.dailyLog).toEqual([])
    expect(state.streaks).toEqual([])
    expect(state.lieFlag).toBe(false)
    expect(state.consecutiveMisses).toBe(0)
  })

  it('round-trips via saveState', () => {
    const state = loadState(stateFile, 'bob')
    const modified: HabitState = { ...state, user: 'bob-modified' }
    saveState(stateFile, modified)
    const loaded = loadState(stateFile, 'bob')
    expect(loaded.user).toBe('bob-modified')
  })

  it('handles a missing file gracefully (returns default)', () => {
    const state = loadState('/does/not/exist.json', 'carol')
    expect(state.user).toBe('carol')
    expect(state.issues).toEqual([])
  })
})

// ── addDailyEntry ─────────────────────────────────────────────────────────────

describe('addDailyEntry', () => {
  it('appends a new daily entry', () => {
    const state = loadState(stateFile, 'alice')
    const entry: DailyLogEntry = {
      date: '2026-06-13',
      tasks: [],
      completedCount: 0,
      totalCount: 0,
      completionRate: 0,
      notes: '',
    }
    const updated = addDailyEntry(state, entry)
    expect(updated.dailyLog).toHaveLength(1)
    expect(updated.dailyLog[0]!.date).toBe('2026-06-13')
  })

  it('replaces an existing entry for the same date', () => {
    let state = loadState(stateFile, 'alice')
    const entry1: DailyLogEntry = {
      date: '2026-06-13',
      tasks: [],
      completedCount: 0,
      totalCount: 2,
      completionRate: 0,
      notes: 'first',
    }
    state = addDailyEntry(state, entry1)
    const entry2: DailyLogEntry = { ...entry1, completedCount: 1, notes: 'second' }
    state = addDailyEntry(state, entry2)
    expect(state.dailyLog).toHaveLength(1)
    expect(state.dailyLog[0]!.notes).toBe('second')
    expect(state.dailyLog[0]!.completedCount).toBe(1)
  })
})

// ── updateStreak ──────────────────────────────────────────────────────────────

describe('updateStreak', () => {
  it('creates a new streak entry on first check-in', () => {
    const state = loadState(stateFile, 'alice')
    const updated = updateStreak(state, 'exercise', true)
    expect(updated.streaks).toHaveLength(1)
    expect(updated.streaks[0]!.habitId).toBe('exercise')
    expect(updated.streaks[0]!.currentStreak).toBe(1)
    expect(updated.streaks[0]!.status).toBe('active')
  })

  it('resets streak to 0 on a miss', () => {
    const state = loadState(stateFile, 'alice')
    const afterHit = updateStreak(state, 'exercise', true)
    const afterMiss = updateStreak(afterHit, 'exercise', false)
    expect(afterMiss.streaks[0]!.currentStreak).toBe(0)
    expect(afterMiss.streaks[0]!.status).toBe('broken')
    // longestStreak should still be preserved
    expect(afterMiss.streaks[0]!.longestStreak).toBe(1)
  })

  it('does not double-increment if called twice on the same day', () => {
    let state = loadState(stateFile, 'alice')
    state = updateStreak(state, 'exercise', true)
    state = updateStreak(state, 'exercise', true)
    expect(state.streaks[0]!.currentStreak).toBe(1)
  })
})

// ── generateTasks ─────────────────────────────────────────────────────────────

describe('generateTasks', () => {
  it('returns a fallback task when no active issues exist', () => {
    const state = loadState(stateFile, 'alice')
    const tasks = generateTasks(state)
    expect(tasks.length).toBeGreaterThanOrEqual(1)
    expect(tasks[0]!.category).toBe('general')
  })

  it('generates one task per active issue (up to 5)', () => {
    let state = loadState(stateFile, 'alice')
    const issues: Issue[] = [
      { id: 'ex-1', category: '运动', issue: 'work out', severity: 'high', status: 'active', notes: '', updatedAt: '' },
      { id: 'sl-1', category: '睡眠', issue: 'sleep early', severity: 'medium', status: 'active', notes: '', updatedAt: '' },
    ]
    state = { ...state, issues }
    const tasks = generateTasks(state)
    // At least one task per active issue
    const categories = tasks.map(t => t.category)
    expect(categories).toContain('运动')
    expect(categories).toContain('睡眠')
    expect(tasks.length).toBeGreaterThanOrEqual(2)
  })

  it('assigns easy difficulty when there is no history', () => {
    let state = loadState(stateFile, 'alice')
    state = {
      ...state,
      issues: [
        { id: 'ex-1', category: '运动', issue: 'workout', severity: 'medium', status: 'active', notes: '', updatedAt: '' },
      ],
    }
    const tasks = generateTasks(state)
    const exerciseTasks = tasks.filter(t => t.category === '运动')
    expect(exerciseTasks.length).toBeGreaterThan(0)
    expect(exerciseTasks[0]!.difficulty).toBe('easy')
  })

  it('ignores resolved/improved issues', () => {
    let state = loadState(stateFile, 'alice')
    state = {
      ...state,
      issues: [
        { id: 'ex-1', category: '运动', issue: 'workout', severity: 'high', status: 'resolved', notes: '', updatedAt: '' },
      ],
    }
    const tasks = generateTasks(state)
    // Only the general fallback task
    expect(tasks[0]!.category).toBe('general')
  })
})

// ── hasDailyRewardEarned ──────────────────────────────────────────────────────

describe('hasDailyRewardEarned', () => {
  it('returns false with no log entry', () => {
    const state = loadState(stateFile, 'alice')
    expect(hasDailyRewardEarned(state)).toBe(false)
  })

  it('returns true when today\'s completionRate meets the threshold', () => {
    let state = loadState(stateFile, 'alice')
    const today = new Date().toISOString().split('T')[0]!
    const entry: DailyLogEntry = {
      date: today,
      tasks: [],
      completedCount: 3,
      totalCount: 3,
      completionRate: 1.0,
      notes: '',
    }
    state = addDailyEntry(state, entry)
    expect(hasDailyRewardEarned(state)).toBe(true)
  })

  it('returns false when completionRate is below threshold', () => {
    let state = loadState(stateFile, 'alice')
    const today = new Date().toISOString().split('T')[0]!
    const entry: DailyLogEntry = {
      date: today,
      tasks: [],
      completedCount: 1,
      totalCount: 3,
      completionRate: 0.33,
      notes: '',
    }
    state = addDailyEntry(state, entry)
    expect(hasDailyRewardEarned(state)).toBe(false)
  })
})
