import { Type, type Static } from '@sinclair/typebox'
import type { ToolDefinition } from 'openclaw/plugin-sdk/plugin-entry'
import { loadState, saveState } from '../store/habit-store.js'
import type { Issue } from '../store/types.js'

const parameters = Type.Object({
  stateFile: Type.String({ description: 'Path to the habit state JSON file' }),
  category: Type.String({
    description: 'Category of the habit (e.g. "运动", "健康", "学业", "饮食", "睡眠")',
  }),
  description: Type.String({
    description: 'Description of the habit goal or issue to work on',
  }),
  severity: Type.Optional(
    Type.Union([Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')], {
      description: "How important/urgent this habit is. Default: 'medium'",
    }),
  ),
  user: Type.Optional(Type.String({ description: 'User identifier' })),
})

type Params = Static<typeof parameters>

function generateIssueId(category: string): string {
  const slug = category.replace(/[^a-zA-Z\u4e00-\u9fff]/g, '').slice(0, 6)
  return `${slug}-${Date.now()}`
}

export const habitSetGoalTool: ToolDefinition<typeof parameters> = {
  name: 'habit_set_goal',
  description:
    "Set a new habit goal or issue for the user to work on. This adds it to the active issues list, which will generate daily tasks going forward. Use when the user wants to start tracking a new habit or improve in a specific area.",
  parameters,
  async execute(_id: string, params: Params) {
    try {
      const state = loadState(params.stateFile, params.user)

      // Check for existing active issue in same category with same description
      const existing = state.issues.find(
        i =>
          i.status === 'active' &&
          i.category === params.category &&
          i.issue.toLowerCase() === params.description.toLowerCase(),
      )

      if (existing) {
        return {
          content: [{
            type: 'text' as const,
            text: `ℹ️ You already have this goal active:\n  [${existing.id}] ${existing.category}: ${existing.issue}\n\nNo duplicate created.`,
          }],
        }
      }

      const newIssue: Issue = {
        id: generateIssueId(params.category),
        category: params.category,
        issue: params.description,
        severity: params.severity ?? 'medium',
        status: 'active',
        notes: '',
        updatedAt: new Date().toISOString(),
      }

      const updatedState = {
        ...state,
        issues: [...state.issues, newIssue],
      }

      saveState(params.stateFile, updatedState)

      const severityLabel =
        newIssue.severity === 'high'
          ? '🔴 High priority'
          : newIssue.severity === 'medium'
          ? '🟡 Medium priority'
          : '🟢 Low priority'

      const activeCount = updatedState.issues.filter(i => i.status === 'active').length

      return {
        content: [{
          type: 'text' as const,
          text: [
            `✅ **New goal added!**`,
            ``,
            `  ID: ${newIssue.id}`,
            `  Category: ${newIssue.category}`,
            `  Goal: ${newIssue.issue}`,
            `  Priority: ${severityLabel}`,
            ``,
            `You now have ${activeCount} active habit${activeCount !== 1 ? 's' : ''}.`,
            `Daily tasks will be generated for this goal starting tomorrow (or call habit_tasks now).`,
          ].join('\n'),
        }],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: 'text' as const, text: `❌ Error setting goal: ${message}` }],
        isError: true,
      }
    }
  },
}
