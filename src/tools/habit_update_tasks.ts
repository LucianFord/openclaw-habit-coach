import { Type, type Static } from '@sinclair/typebox'
import type { ToolDefinition } from 'openclaw/plugin-sdk/plugin-entry'
import { loadState, saveState } from '../store/habit-store.js'
import type { TaskEntry } from '../store/types.js'

const parameters = Type.Object({
  stateFile: Type.String({ description: 'Path to the habit state JSON file' }),
  tasks: Type.Array(
    Type.Object({
      title: Type.String({ description: 'Task title' }),
      category: Type.String({ description: 'Task category, e.g. 学业, 运动, 健康, 社交' }),
      difficulty: Type.Optional(
        Type.Union([Type.Literal('easy'), Type.Literal('medium'), Type.Literal('hard')], {
          description: 'Difficulty level. Default: medium',
        }),
      ),
    }),
    { description: 'Complete list of tasks for today — replaces all existing tasks' },
  ),
  user: Type.Optional(Type.String({ description: 'User identifier' })),
})

type Params = Static<typeof parameters>

function generateId(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index}`
}

export const habitUpdateTasksTool: ToolDefinition<typeof parameters> = {
  name: 'habit_update_tasks',
  description:
    "Replace today's task list with a new set of tasks. Use this when the user's plan changes during the day — e.g. after a conversation where you and the user agree on specific tasks. This OVERWRITES all pending tasks for today. Completed tasks are preserved.",
  parameters,
  async execute(_id: string, params: Params) {
    try {
      const state = loadState(params.stateFile, params.user)
      const today = new Date().toISOString().split('T')[0]!

      // Find today's entry
      const dailyLog = [...state.dailyLog]
      const idx = dailyLog.findIndex(e => e.date === today)

      // Preserve already completed/skipped tasks
      const existingEntry = dailyLog[idx]
      const preservedTasks = existingEntry?.tasks.filter(
        t => t.completed || t.skipped,
      ) ?? []

      // Build new task entries
      const newTasks: TaskEntry[] = params.tasks.map((t, i) => ({
        id: generateId(t.category, i),
        title: t.title,
        category: t.category,
        completed: false,
        skipped: false,
        difficulty: t.difficulty ?? 'medium',
      }))

      // Merge: preserved (done/skipped) + new (pending)
      const allTasks = [...preservedTasks, ...newTasks]
      const completedCount = allTasks.filter(t => t.completed).length

      const newEntry = {
        date: today,
        tasks: allTasks,
        completedCount,
        totalCount: allTasks.length,
        completionRate: allTasks.length > 0 ? completedCount / allTasks.length : 0,
        notes: existingEntry?.notes ?? '',
      }

      if (idx >= 0) {
        dailyLog[idx] = newEntry
      } else {
        dailyLog.push(newEntry)
      }

      const updatedState = { ...state, dailyLog }
      saveState(params.stateFile, updatedState)

      const lines: string[] = [
        `✅ **Today's tasks updated!** (${today})`,
        '',
        `**New tasks:**`,
      ]
      for (const task of newTasks) {
        const diffIcon = task.difficulty === 'easy' ? '🟢' : task.difficulty === 'medium' ? '🟡' : '🔴'
        lines.push(`  ${diffIcon} ${task.title}`)
      }
      if (preservedTasks.length > 0) {
        lines.push('')
        lines.push(`**Preserved (${preservedTasks.length}):**`)
        for (const task of preservedTasks) {
          lines.push(`  ${task.completed ? '✅' : '⏭️'} ${task.title}`)
        }
      }
      lines.push('')
      lines.push(`**Total:** ${allTasks.length} tasks (${completedCount} done)`)

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: 'text' as const, text: `❌ Error updating tasks: ${message}` }],
        isError: true,
      }
    }
  },
}
