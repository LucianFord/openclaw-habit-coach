import { Type } from '@sinclair/typebox';
import { loadState } from '../store/habit-store.js';
const parameters = Type.Object({
    stateFile: Type.String({ description: 'Path to the habit state JSON file' }),
    user: Type.Optional(Type.String({ description: 'User identifier' })),
});
function formatBar(rate, width = 20) {
    const filled = Math.round(rate * width);
    return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}
export const habitProgressTool = {
    name: 'habit_progress',
    description: "View the user's current progress: active habits, streaks, recent completion rates, and issue statuses. Use this to give the user a quick summary of where they stand.",
    parameters,
    async execute(_id, params) {
        try {
            const state = loadState(params.stateFile, params.user);
            const today = new Date().toISOString().split('T')[0];
            const lines = [];
            lines.push(`📈 **Habit Progress — ${state.user}**`);
            lines.push(`Updated: ${today}`);
            lines.push('');
            // Active Issues
            const activeIssues = state.issues.filter(i => i.status === 'active');
            const improvedIssues = state.issues.filter(i => i.status === 'improved');
            const resolvedIssues = state.issues.filter(i => i.status === 'resolved');
            lines.push(`**Active Habits (${activeIssues.length}):**`);
            if (activeIssues.length === 0) {
                lines.push('  None — use habit_set_goal to add a habit');
            }
            else {
                for (const issue of activeIssues) {
                    const severityIcon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
                    lines.push(`  ${severityIcon} [${issue.category}] ${issue.issue}`);
                }
            }
            lines.push('');
            // Streaks
            const activeStreaks = state.streaks.filter(s => s.status === 'active' && s.currentStreak > 0);
            lines.push(`**Current Streaks:**`);
            if (activeStreaks.length === 0) {
                lines.push('  No active streaks yet — check in to start one!');
            }
            else {
                const sorted = [...activeStreaks].sort((a, b) => b.currentStreak - a.currentStreak);
                for (const streak of sorted) {
                    const fire = streak.currentStreak >= 7 ? '🔥🔥' : streak.currentStreak >= 3 ? '🔥' : '✨';
                    lines.push(`  ${fire} ${streak.habitId}: ${streak.currentStreak} days (best: ${streak.longestStreak})`);
                }
            }
            lines.push('');
            // Recent completion rates (last 7 days)
            const last7 = state.dailyLog
                .filter(e => e.date <= today)
                .slice(-7);
            lines.push(`**Last 7 Days:**`);
            if (last7.length === 0) {
                lines.push('  No data yet');
            }
            else {
                const totalRates = last7.map(e => e.completionRate);
                const avgRate = totalRates.reduce((a, b) => a + b, 0) / totalRates.length;
                lines.push(`  Average completion: ${Math.round(avgRate * 100)}% ${formatBar(avgRate)}`);
                lines.push('');
                for (const entry of last7) {
                    const bar = formatBar(entry.completionRate, 10);
                    const rate = Math.round(entry.completionRate * 100);
                    const dayLabel = entry.date === today ? `${entry.date} (today)` : entry.date;
                    lines.push(`  ${dayLabel}: ${entry.completedCount}/${entry.totalCount} ${bar} ${rate}%`);
                }
            }
            lines.push('');
            // Summary stats
            const totalDays = state.dailyLog.length;
            if (totalDays > 0) {
                const overallAvg = state.dailyLog.reduce((a, e) => a + e.completionRate, 0) / totalDays;
                lines.push(`**All-time:**`);
                lines.push(`  Days tracked: ${totalDays}`);
                lines.push(`  Overall completion: ${Math.round(overallAvg * 100)}%`);
                lines.push(`  Issues resolved: ${resolvedIssues.length} | Improved: ${improvedIssues.length}`);
                lines.push(`  Rewards earned: ${state.rewardsEarned.length}`);
                lines.push('');
            }
            // Penalties / Warnings
            if (state.consecutiveMisses >= state.penaltyConfig.skipConsecutive) {
                lines.push(`⚠️ **Warning:** ${state.consecutiveMisses} consecutive missed days`);
                lines.push(`   Penalty applies: ${state.penaltyConfig.skipPenalty}`);
                lines.push('');
            }
            if (state.lieFlag) {
                lines.push(`⚠️ **Lie flag is active.** Honesty matters — reset at: ${state.penaltyConfig.lieResetAt || 'not set'}`);
                lines.push('');
            }
            // Current phase
            const currentPhase = state.changePlan.phases[state.changePlan.currentPhase];
            if (currentPhase) {
                const doneGoals = currentPhase.goals.filter(g => g.done).length;
                lines.push(`**Current Phase: ${currentPhase.name}**`);
                lines.push(`  Focus: ${currentPhase.focus}`);
                lines.push(`  Goals: ${doneGoals}/${currentPhase.goals.length} complete`);
            }
            return {
                content: [{ type: 'text', text: lines.join('\n') }],
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: [{ type: 'text', text: `❌ Error loading progress: ${message}` }],
                isError: true,
            };
        }
    },
};
