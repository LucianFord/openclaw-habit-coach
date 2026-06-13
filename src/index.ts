import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry'
import { getTasksTool } from './tools/get_tasks.js'
import { habitCheckinTool } from './tools/habit_checkin.js'
import { habitProgressTool } from './tools/habit_progress.js'
import { habitReportTool } from './tools/habit_report.js'
import { habitSetGoalTool } from './tools/habit_set_goal.js'
import { habitGetStateTool } from './tools/habit_get_state.js'
import { gatewayStartHandler } from './hooks/gateway_start.js'

export default definePluginEntry({
  id: 'habit-coach',
  name: 'Habit Coach',
  description: 'AI accountability coach — dynamic task scheduling, progress tracking, streaks, and reward/penalty system',
  register(api) {
    api.registerTool(getTasksTool)
    api.registerTool(habitCheckinTool)
    api.registerTool(habitProgressTool)
    api.registerTool(habitReportTool)
    api.registerTool(habitSetGoalTool)
    api.registerTool(habitGetStateTool)

    api.on('gateway_start', gatewayStartHandler)
  },
})
