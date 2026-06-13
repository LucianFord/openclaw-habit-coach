import { Type, type Static } from '@sinclair/typebox'
import type { ToolDefinition } from 'openclaw/plugin-sdk/plugin-entry'
import {
  loadState,
  saveState,
  addDailyEntry,
  updateStreak,
  getTodayEntry,
  hasDailyRewardEarned,
} from '../store/habit-store.js'
import { generateTasks } from '../store/task-generator.js'
import type { DailyLogEntry } from '../store/types.js'

const parameters = Type.Object({
  stateFile: Type.String({ description: 'Path to the habit state JSON file' }),
  taskId: Type.String({ description: 'The ID of the task to check in' }),
  completed: Type.Optional(
    Type.Boolean({ description: 'Whether the task was completed (default: true)' }),
  ),
  user: Type.Optional(Type.String({ description: 'User identifier' })),
})

type Params = Static<typeof parameters>

export const habitCheckinTool: ToolDefinition<typeof parameters> = {
  name: 'habit_checkin',
  description:
    'Mark a task as completed (or skipped). Updates daily log, streaks, and checks if a reward was earned. Call this when the user says they finished, did, or completed a task.',
  parameters,
  async execute(_id: string, params: Params) {
    try {
      const isCompleted = params.completed !== false
      let state = loadState(params.stateFile, params.user)
      const today = new Date().toISOString().split('T')[0]!

      // Ensure today's entry exists with tasks
      let todayEntry = getTodayEntry(state)
      if (!todayEntry) {
        const tasks = generateTasks(state)
        todayEntry = {
          date: today,
          tasks,
          completedCount: 0,
          totalCount: tasks.length,
          completionRate: 0,
          notes: '',
        }
        state = addDailyEntry(state, todayEntry)
      }

      // Find the task
      const taskIdx = todayEntry.tasks.findIndex(t => t.id === params.taskId)
      if (taskIdx < 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Task with ID "${params.taskId}" not found in today's tasks.\n\nAvailable task IDs:\n${todayEntry.tasks.map(t => `  • ${t.id} — ${t.title}`).join('\n')}`,
          }],
          isError: true,
        }
      }

      const task = todayEntry.tasks[taskIdx]!

      // Update the task
      const updatedTasks = [...todayEntry.tasks]
      updatedTasks[taskIdx] = {
        ...task,
        completed: isCompleted,
        skipped: !isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : undefined,
      }

      // Recalculate totals
      const completedCount = updatedTasks.filter(t => t.completed).length
      const totalCount = updatedTasks.length
      const completionRate = totalCount > 0 ? completedCount / totalCount : 0

      const updatedEntry: DailyLogEntry = {
        ...todayEntry,
        tasks: updatedTasks,
        completedCount,
        totalCount,
        completionRate,
      }

      state = addDailyEntry(state, updatedEntry)

      // Update streak for the task's category
      if (isCompleted) {
        state = updateStreak(state, task.category, true)
      }

      // Reset consecutive misses if completing tasks
      if (isCompleted && state.consecutiveMisses > 0) {
        state = { ...state, consecutiveMisses: 0 }
      }

      // Check for daily reward
      const allDone = completedCount === totalCount && totalCount > 0
      const rewardJustEarned =
        allDone &&
        !state.rewardsEarned.includes(`daily:${today}`)

      if (rewardJustEarned) {
        state = {
          ...state,
          rewardsEarned: [...state.rewardsEarned, `daily:${today}`],
        }
      }

      saveState(params.stateFile, state)

      // Find streak for this task's category/issue
      const streakInfo = state.streaks.find(s => s.habitId === task.category)

      const lines: string[] = []

      if (isCompleted) {
        lines.push(`✅ **Checked in:** ${task.title}`)
      } else {
        lines.push(`⏭️ **Skipped:** ${task.title}`)
      }

      lines.push(`📊 Progress today: ${completedCount}/${totalCount} tasks (${Math.round(completionRate * 100)}%)`)

      if (streakInfo && isCompleted) {
        lines.push(`🔥 Streak (${task.category}): ${streakInfo.currentStreak} day${streakInfo.currentStreak !== 1 ? 's' : ''}`)
        if (streakInfo.currentStreak > 1) {
          lines.push(`   Best ever: ${streakInfo.longestStreak} days`)
        }
      }

      if (rewardJustEarned) {
        lines.push('')
        lines.push(`🎉 **All tasks complete!** You've earned today's reward:`)
        lines.push(`   ✨ ${state.rewardConfig.daily}`)
      } else if (allDone) {
        lines.push('')
        lines.push(`🎉 All done for today! Great work.`)
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: 'text' as const, text: `❌ Error during check-in: ${message}` }],
        isError: true,
      }
    }
  },
}
