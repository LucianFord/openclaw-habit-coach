import { Type } from '@sinclair/typebox';
import { loadState, saveState, addDailyEntry } from '../store/habit-store.js';
import { generateTasks } from '../store/task-generator.js';
const parameters = Type.Object({
    stateFile: Type.String({ description: 'Path to the habit state JSON file' }),
    user: Type.Optional(Type.String({ description: 'User identifier' })),
});
export const getTasksTool = {
    name: 'habit_tasks',
    description: "Get today's dynamically generated tasks for the user. Tasks adapt to recent performance — easier if struggling, harder if succeeding. Call this at the start of each day or when the user asks what they need to do.",
    parameters,
    async execute(_id, params) {
        try {
            const state = loadState(params.stateFile, params.user);
            const today = new Date().toISOString().split('T')[0];
            // Check if we already have tasks for today
            let todayEntry = state.dailyLog.find(e => e.date === today);
            let tasks = todayEntry?.tasks ?? [];
            if (tasks.length === 0) {
                // No tasks at all — generate from template
                tasks = generateTasks(state);
                const newEntry = {
                    date: today,
                    tasks,
                    completedCount: 0,
                    totalCount: tasks.length,
                    completionRate: 0,
                    notes: '',
                };
                const updatedState = addDailyEntry(state, newEntry);
                saveState(params.stateFile, updatedState);
                todayEntry = newEntry;
            }
            else {
                // Tasks already exist (either from cron or from habit_update_tasks).
                // Compute live completion stats instead of relying on stale counts.
                const doneCount = tasks.filter(t => t.completed).length;
                const total = tasks.length;
                todayEntry = {
                    ...todayEntry,
                    completedCount: doneCount,
                    totalCount: total,
                    completionRate: total > 0 ? doneCount / total : 0,
                };
            }
            // Format output
            const lines = [
                `📋 **Today's Habit Tasks** (${today})`,
                `User: ${state.user}`,
                '',
            ];
            const pendingTasks = tasks.filter(t => !t.completed && !t.skipped);
            const doneTasks = tasks.filter(t => t.completed);
            const skippedTasks = tasks.filter(t => t.skipped);
            if (pendingTasks.length > 0) {
                lines.push('**Pending:**');
                for (const task of pendingTasks) {
                    const diffIcon = task.difficulty === 'easy' ? '🟢' : task.difficulty === 'medium' ? '🟡' : '🔴';
                    lines.push(`  ${diffIcon} [${task.id}] ${task.title}`);
                }
                lines.push('');
            }
            if (doneTasks.length > 0) {
                lines.push(`**Done (${doneTasks.length}/${tasks.length}):**`);
                for (const task of doneTasks) {
                    lines.push(`  ✅ ${task.title}`);
                }
                lines.push('');
            }
            if (skippedTasks.length > 0) {
                lines.push('**Skipped:**');
                for (const task of skippedTasks) {
                    lines.push(`  ⏭️ ${task.title}`);
                }
                lines.push('');
            }
            const completionRate = tasks.length > 0
                ? Math.round((doneTasks.length / tasks.length) * 100)
                : 0;
            lines.push(`**Progress:** ${doneTasks.length}/${tasks.length} (${completionRate}%)`);
            if (doneTasks.length === tasks.length && tasks.length > 0) {
                lines.push('');
                lines.push(`🎉 All tasks complete! You've earned today's reward: ${state.rewardConfig.daily}`);
            }
            return {
                content: [{ type: 'text', text: lines.join('\n') }],
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: [{ type: 'text', text: `❌ Error loading tasks: ${message}` }],
                isError: true,
            };
        }
    },
};
