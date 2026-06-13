#!/usr/bin/env node
/**
 * Habit Coach — demo script
 *
 * Exercises the store and task generator without requiring OpenClaw Gateway.
 * Run: npm run demo  (builds TypeScript first, then runs this file)
 */

import { createRequire } from 'module'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const distDir = join(__dirname, '../dist')

// ── Helpers ──────────────────────────────────────────────────────────────────

function section(title) {
  console.log('\n' + '─'.repeat(60))
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

function printResult(label, result) {
  const text = result?.content?.[0]?.text ?? '(no output)'
  const isError = result?.isError ?? false
  console.log(`\n[${isError ? '❌' : '✅'} ${label}]`)
  console.log(text)
}

// ── Load compiled modules ─────────────────────────────────────────────────────

const { loadState, saveState, addDailyEntry, updateStreak, getTodayEntry } =
  await import(join(distDir, 'store/habit-store.js'))
const { generateTasks } = await import(join(distDir, 'store/task-generator.js'))

// Tool execute functions (call directly without OpenClaw Gateway)
const { getTasksTool } = await import(join(distDir, 'tools/get_tasks.js'))
const { habitCheckinTool } = await import(join(distDir, 'tools/habit_checkin.js'))
const { habitProgressTool } = await import(join(distDir, 'tools/habit_progress.js'))
const { habitReportTool } = await import(join(distDir, 'tools/habit_report.js'))
const { habitSetGoalTool } = await import(join(distDir, 'tools/habit_set_goal.js'))
const { habitGetStateTool } = await import(join(distDir, 'tools/habit_get_state.js'))

// ── Setup temp state file ─────────────────────────────────────────────────────

const tmpDir = mkdtempSync(join(tmpdir(), 'habit-coach-demo-'))
const stateFile = join(tmpDir, 'demo-state.json')
const demoUser = 'demo-user'

console.log(`\n🚀 Habit Coach Demo`)
console.log(`   State file: ${stateFile}`)

// ── Step 1: Set goals ─────────────────────────────────────────────────────────

section('Step 1: Set habit goals')

let result = await habitSetGoalTool.execute('demo', {
  stateFile,
  user: demoUser,
  category: 'exercise',
  description: 'Build a consistent workout routine',
  severity: 'high',
})
printResult('habit_set_goal (exercise)', result)

result = await habitSetGoalTool.execute('demo', {
  stateFile,
  user: demoUser,
  category: 'sleep',
  description: 'Sleep by 11 pm every night',
  severity: 'medium',
})
printResult('habit_set_goal (sleep)', result)

// ── Step 2: Get today's tasks ─────────────────────────────────────────────────

section('Step 2: Get today\'s tasks')

result = await getTasksTool.execute('demo', { stateFile, user: demoUser })
printResult('habit_tasks', result)

// ── Step 3: Check in a task ───────────────────────────────────────────────────

section('Step 3: Check in tasks')

// Reload state to get the generated task IDs
const state = loadState(stateFile, demoUser)
const today = new Date().toISOString().split('T')[0]
const todayEntry = state.dailyLog.find(e => e.date === today)

if (todayEntry && todayEntry.tasks.length > 0) {
  const firstTask = todayEntry.tasks[0]
  console.log(`\n  Checking in task: "${firstTask.title}" (id: ${firstTask.id})`)

  result = await habitCheckinTool.execute('demo', {
    stateFile,
    user: demoUser,
    taskId: firstTask.id,
    completed: true,
  })
  printResult('habit_checkin', result)

  if (todayEntry.tasks.length > 1) {
    const secondTask = todayEntry.tasks[1]
    console.log(`\n  Checking in task: "${secondTask.title}" (id: ${secondTask.id})`)
    result = await habitCheckinTool.execute('demo', {
      stateFile,
      user: demoUser,
      taskId: secondTask.id,
      completed: true,
    })
    printResult('habit_checkin (2nd task)', result)
  }
} else {
  console.log('  (no tasks found for today — skipping check-in)')
}

// ── Step 4: View progress ─────────────────────────────────────────────────────

section('Step 4: View progress')

result = await habitProgressTool.execute('demo', { stateFile, user: demoUser })
printResult('habit_progress', result)

// ── Step 5: Weekly report ─────────────────────────────────────────────────────

section('Step 5: Weekly report')

result = await habitReportTool.execute('demo', {
  stateFile,
  user: demoUser,
  period: 'weekly',
})
printResult('habit_report', result)

// ── Step 6: Raw state dump ────────────────────────────────────────────────────

section('Step 6: Raw state (abbreviated)')

const rawState = loadState(stateFile, demoUser)
console.log(JSON.stringify({
  user: rawState.user,
  issues: rawState.issues.map(i => ({ id: i.id, category: i.category, status: i.status })),
  todayTasks: rawState.dailyLog.find(e => e.date === today)?.tasks.length ?? 0,
  streaks: rawState.streaks,
}, null, 2))

// ── Cleanup ───────────────────────────────────────────────────────────────────

rmSync(tmpDir, { recursive: true, force: true })
console.log(`\n✅ Demo complete. Temp state cleaned up.`)
