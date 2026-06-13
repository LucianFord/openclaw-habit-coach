// gateway_start hook — automatically creates/updates cron jobs on plugin startup

import type { HabitConfig, DeliveryChannel } from '../store/types.js'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const PLUGIN_ID = 'habit-coach'

// Derive SKILL.md path relative to this file's compiled location (dist/hooks/)
const SKILL_MD_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/habit-coach/SKILL.md')

function deliveryChannelsDesc(channels: DeliveryChannel[]): string {
  return channels.map(c => `{ channel: "${c.channel}", to: "${c.to}" }`).join(', ')
}

function buildTaskCronMessage(config: HabitConfig): string {
  const channels = deliveryChannelsDesc(config.deliveryChannels)
  return `☀️ Good morning, ${config.user}! It's ${config.checkinTime} — time to send today's tasks. Please:

1. Read and follow the Habit Coach skill guide at: ${SKILL_MD_PATH}
2. Call habit_tasks to get today's tasks (stateFile: ${config.stateFile}, user: ${config.user})
3. Deliver the task list to ${config.user} via these channels (try in order, stop at first success):
   ${channels}
   Use: openclaw message send --channel <channel> --to <to> --message "..."

Tone: warm and encouraging during the startup phase; match energy to their current streak.`
}

function buildReviewCronMessage(config: HabitConfig): string {
  const channels = deliveryChannelsDesc(config.deliveryChannels)
  return `🌙 It's ${config.reviewTime} — time for ${config.user}'s daily review.

1. Read and follow the Habit Coach skill guide at: ${SKILL_MD_PATH}
2. Call habit_progress to see today's progress (stateFile: ${config.stateFile}, user: ${config.user})
3. Check whether ${config.user} checked in today (review today's interaction log)
4. Based on completion, apply rewards or gentle follow-up per SKILL.md rules
5. Deliver the review message to ${config.user}:
   ${channels}
   Use: openclaw message send --channel <channel> --to <to> --message "..."

Remember: apply the reward/penalty rules from SKILL.md honestly. Be firm but caring.`
}

type CronService = {
  list: (opts?: { includeDisabled?: boolean }) => Promise<any[]>
  add: (input: any) => Promise<any>
  update: (id: string, patch: any) => Promise<any>
  remove: (id: string) => Promise<any>
}

async function ensureCron(
  cron: CronService,
  name: string,
  cronExpr: string,
  message: string,
  existingJobs: any[],
): Promise<void> {
  const existing = existingJobs.find((j: any) => j.name === name)
  const payload = {
    kind: 'agentTurn' as const,
    message,
    lightContext: true,
  }
  const jobSpec = {
    name,
    description: `Habit Coach auto-generated cron job`,
    enabled: true,
    schedule: { kind: 'cron' as const, expr: cronExpr, tz: 'Asia/Shanghai' },
    sessionTarget: 'isolated' as const,
    payload,
    delivery: { mode: 'none' as const },
  }

  if (existing) {
    const existingMsg = (existing.payload as any)?.message || (existing.payload as any)?.text
    if (existingMsg !== message) {
      await cron.update(existing.id, { payload })
      console.log(`[${PLUGIN_ID}] Updated cron: ${name}`)
    }
  } else {
    await cron.add(jobSpec)
    console.log(`[${PLUGIN_ID}] Created cron: ${name}`)
  }
}

export const gatewayStartHandler: any = async (_event: any, ctx: any) => {
  const getCron: (() => CronService | undefined) | undefined = (ctx as any).getCron
  if (!getCron) {
    console.warn(`[${PLUGIN_ID}] getCron not available, skipping cron setup`)
    return
  }
  const cron = getCron()
  if (!cron) {
    console.warn(`[${PLUGIN_ID}] getCron() returned undefined, skipping cron setup`)
    return
  }

  // Read plugin config from OpenClaw config
  const openClawConfig = (ctx.config || {}) as Record<string, unknown>
  const cfg = ((openClawConfig as any)?.plugins?.entries?.['habit-coach']?.config || {}) as Record<string, unknown>
  const stateFile = (cfg.stateFile as string) || './habit-state.json'
  const user = (cfg.user as string) || 'user'
  const checkinTime = (cfg.checkinTime as string) || '07:00'
  const reviewTime = (cfg.reviewTime as string) || '23:00'
  const deliveryChannels: DeliveryChannel[] = (cfg.deliveryChannels as DeliveryChannel[]) || []

  const habitConfig: HabitConfig = {
    stateFile,
    user,
    deliveryChannels,
    checkinTime,
    reviewTime,
    allowAgentMessages: cfg.allowAgentMessages as boolean | undefined,
  }

  const existingJobs = await cron.list({ includeDisabled: true })
  const desiredNames = new Set<string>()

  // 创建发任务 cron
  const [hour, minute] = checkinTime.split(':')
  const taskName = `Habit Coach - 发任务 (${checkinTime})`
  desiredNames.add(taskName)
  await ensureCron(cron, taskName, `${minute} ${hour} * * *`, buildTaskCronMessage(habitConfig), existingJobs)

  // 创建复盘 cron
  const [reviewHour, reviewMinute] = reviewTime.split(':')
  const reviewName = `Habit Coach - 复盘 (${reviewTime})`
  desiredNames.add(reviewName)
  await ensureCron(cron, reviewName, `${reviewMinute} ${reviewHour} * * *`, buildReviewCronMessage(habitConfig), existingJobs)

  // 清理旧配置留下的 Habit Coach cron
  for (const job of existingJobs) {
    const name = (job as any).name
    if (name?.startsWith('Habit Coach - ') && !desiredNames.has(name)) {
      await cron.remove((job as any).id)
      console.log(`[${PLUGIN_ID}] Removed stale cron: ${name}`)
    }
  }
}
