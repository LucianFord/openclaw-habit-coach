import { Type, type Static } from '@sinclair/typebox'
import type { ToolDefinition } from 'openclaw/plugin-sdk/plugin-entry'
import { loadState } from '../store/habit-store.js'

const parameters = Type.Object({
  stateFile: Type.String({ description: 'Path to the habit state JSON file' }),
  user: Type.Optional(Type.String({ description: 'User identifier' })),
})

type Params = Static<typeof parameters>

export const habitGetStateTool: ToolDefinition<typeof parameters> = {
  name: 'habit_get_state',
  description:
    'Get the full habit state as JSON. Useful for debugging, agent context loading, or when you need access to the complete raw data including all issues, logs, streaks, and configuration.',
  parameters,
  async execute(_id: string, params: Params) {
    try {
      const state = loadState(params.stateFile, params.user)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(state, null, 2),
        }],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: 'text' as const, text: `❌ Error loading state: ${message}` }],
        isError: true,
      }
    }
  },
}
