// gateway_start hook — automatically creates/updates cron jobs on plugin startup
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const PLUGIN_ID = 'habit-coach';
// Derive SKILL.md path relative to this file's compiled location (dist/hooks/)
const SKILL_MD_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/habit-coach/SKILL.md');
function deliveryChannelsDesc(channels) {
    return channels.map(c => `{ channel: "${c.channel}", to: "${c.to}" }`).join(', ');
}
function buildTaskCronMessage(config) {
    const channels = deliveryChannelsDesc(config.deliveryChannels);
    return `☀️ Good morning, ${config.user}! It's ${config.checkinTime} — time to send today's tasks. Please:

1. Read and follow the Habit Coach skill guide at: ${SKILL_MD_PATH}
2. Call habit_tasks to get today's tasks (stateFile: ${config.stateFile}, user: ${config.user})
3. Deliver the task list to ${config.user} via these channels (try in order, stop at first success):
   ${channels}
   Use: openclaw message send --channel <channel> --to <to> --message "..."

Tone: warm and encouraging during the startup phase; match energy to their current streak.`;
}
function buildReviewCronMessage(config) {
    const channels = deliveryChannelsDesc(config.deliveryChannels);
    return `🌙 It's ${config.reviewTime} — time for ${config.user}'s daily review.

1. Read and follow the Habit Coach skill guide at: ${SKILL_MD_PATH}
2. Call habit_progress to see today's progress (stateFile: ${config.stateFile}, user: ${config.user})
3. Check whether ${config.user} checked in today (review today's interaction log)
4. Based on completion, apply rewards or gentle follow-up per SKILL.md rules
5. Deliver the review message to ${config.user}:
   ${channels}
   Use: openclaw message send --channel <channel> --to <to> --message "..."

Remember: apply the reward/penalty rules from SKILL.md honestly. Be firm but caring.`;
}
async function ensureCron(cron, name, cronExpr, message, existingJobs) {
    const existing = existingJobs.find((j) => j.name === name);
    const payload = {
        kind: 'agentTurn',
        message,
        lightContext: true,
    };
    const jobSpec = {
        name,
        description: `Habit Coach auto-generated cron job`,
        enabled: true,
        schedule: { kind: 'cron', expr: cronExpr, tz: 'Asia/Shanghai' },
        sessionTarget: 'isolated',
        payload,
        delivery: { mode: 'none' },
    };
    if (existing) {
        const existingMsg = existing.payload?.message || existing.payload?.text;
        if (existingMsg !== message) {
            await cron.update(existing.id, { payload });
            console.log(`[${PLUGIN_ID}] Updated cron: ${name}`);
        }
    }
    else {
        await cron.add(jobSpec);
        console.log(`[${PLUGIN_ID}] Created cron: ${name}`);
    }
}
export const gatewayStartHandler = async (_event, ctx) => {
    const getCron = ctx.getCron;
    if (!getCron) {
        console.warn(`[${PLUGIN_ID}] getCron not available, skipping cron setup`);
        return;
    }
    const cron = getCron();
    if (!cron) {
        console.warn(`[${PLUGIN_ID}] getCron() returned undefined, skipping cron setup`);
        return;
    }
    // Read plugin config from OpenClaw config
    const openClawConfig = (ctx.config || {});
    const cfg = (openClawConfig?.plugins?.entries?.['habit-coach']?.config || {});
    const stateFile = cfg.stateFile || './habit-state.json';
    const user = cfg.user || 'user';
    const checkinTime = cfg.checkinTime || '07:00';
    const reviewTime = cfg.reviewTime || '23:00';
    const deliveryChannels = cfg.deliveryChannels || [];
    const habitConfig = {
        stateFile,
        user,
        deliveryChannels,
        checkinTime,
        reviewTime,
        allowAgentMessages: cfg.allowAgentMessages,
    };
    const existingJobs = await cron.list({ includeDisabled: true });
    const desiredNames = new Set();
    // 创建发任务 cron
    const [hour, minute] = checkinTime.split(':');
    const taskName = `Habit Coach - 发任务 (${checkinTime})`;
    desiredNames.add(taskName);
    await ensureCron(cron, taskName, `${minute} ${hour} * * *`, buildTaskCronMessage(habitConfig), existingJobs);
    // 创建复盘 cron
    const [reviewHour, reviewMinute] = reviewTime.split(':');
    const reviewName = `Habit Coach - 复盘 (${reviewTime})`;
    desiredNames.add(reviewName);
    await ensureCron(cron, reviewName, `${reviewMinute} ${reviewHour} * * *`, buildReviewCronMessage(habitConfig), existingJobs);
    // 清理旧配置留下的 Habit Coach cron
    for (const job of existingJobs) {
        const name = job.name;
        if (name?.startsWith('Habit Coach - ') && !desiredNames.has(name)) {
            await cron.remove(job.id);
            console.log(`[${PLUGIN_ID}] Removed stale cron: ${name}`);
        }
    }
};
