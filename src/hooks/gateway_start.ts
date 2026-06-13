// gateway_start hook — 插件启动时自动创建/更新 cron job

import type { HabitConfig, DeliveryChannel } from '../store/types.js'

const PLUGIN_ID = 'habit-coach'

function deliveryChannelsDesc(channels: DeliveryChannel[]): string {
  return channels.map(c => `{ channel: "${c.channel}", to: "${c.to}" }`).join(', ')
}

function buildTaskCronMessage(config: HabitConfig): string {
  const channels = deliveryChannelsDesc(config.deliveryChannels)
  return `☀️ 早安！${config.checkinTime} 到发任务时间了，请执行以下步骤：

1. 读取并遵循 /home/greylee/Projects/openclaw-habit-coach/skills/habit-coach/SKILL.md 中的 Habit Coach 技能指南
2. 调用 habit_tasks 工具获取今日任务（stateFile: ${config.stateFile}, user: ${config.user}）
3. 把生成的任务清单按以下规则投递给哥哥：
   a. 投递渠道（按顺序尝试，第一个成功即停）：${channels}
   b. 使用 exec + openclaw message send 投递（不要用 sessions_send）
   c. 格式：openclaw message send --channel <channel> --to <to> --message "消息内容"

语气按 SKILL.md 规则：首次启动期温暖鼓励，任务具体可执行`
}

function buildDailyReviewCronMessage(config: HabitConfig): string {
  const channels = deliveryChannelsDesc(config.deliveryChannels)
  return `🌙 哥哥，${config.reviewTime} 到每日复盘时间了。请执行以下步骤：

1. 读取并遵循 /home/greylee/Projects/openclaw-habit-coach/skills/habit-coach/SKILL.md
2. 调用 habit_progress 查看今日进度（stateFile: ${config.stateFile}, user: ${config.user}）
3. 检查哥哥今天有没有打卡（查看今天的交互记录）
4. 根据完成情况，按 SKILL.md 规则给予奖励或温和追问
5. 如果今天是大作业截止日附近，额外提醒一下
6. 复盘消息投递给哥哥：
   a. 投递渠道（按顺序尝试，第一个成功即停）：${channels}
   b. 使用 exec + openclaw message send 投递（不要用 sessions_send）

注意：这是每日复盘，不是凌晨临时抽查。语气可以管着他，但不要羞辱。`
}

function buildWeeklyReviewCronMessage(config: HabitConfig): string {
  const channels = deliveryChannelsDesc(config.deliveryChannels)
  return `🌙 哥哥，周日 ${config.weeklyReviewTime} 到每周复盘时间了。请执行以下步骤：

1. 读取并遵循 /home/greylee/Projects/openclaw-habit-coach/skills/habit-coach/SKILL.md
2. 调用 habit_report({ period: "weekly", stateFile: ${JSON.stringify(config.stateFile)}, user: ${JSON.stringify(config.user)} }) 查看近 7 天趋势
3. 检查哥哥这周有没有连续缺卡/低完成率，按 SKILL.md 规则温和追问
4. 如果本周完成率高，按 rewardConfig 给奖励；如果低，给下周一个更小、更具体的调整方案
5. 复盘消息投递给哥哥：
   a. 投递渠道（按顺序尝试，第一个成功即停）：${channels}
   b. 使用 exec + openclaw message send 投递（不要用 sessions_send）

注意：这是每周复盘，不是凌晨临时抽查。语气可以管着他，但不要羞辱。`
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
  const stateFile = (cfg.stateFile as string) || '/home/greylee/.openclaw/workspace/memory/habit-state.json'
  const user = (cfg.user as string) || 'Luc'
  const checkinTime = (cfg.checkinTime as string) || '07:00'
  const reviewTime = (cfg.reviewTime as string) || '23:00'
  const weeklyReviewTime = (cfg.weeklyReviewTime as string) || '23:30'
  const deliveryChannels: DeliveryChannel[] = (cfg.deliveryChannels as DeliveryChannel[]) || []

  const habitConfig: HabitConfig = {
    stateFile,
    user,
    deliveryChannels,
    checkinTime,
    reviewTime,
    weeklyReviewTime,
    allowAgentMessages: cfg.allowAgentMessages as boolean | undefined,
  }

  const existingJobs = await cron.list({ includeDisabled: true })
  const desiredNames = new Set<string>()

  // 创建发任务 cron
  const [hour, minute] = checkinTime.split(':')
  const taskName = `Habit Coach - 发任务 (${checkinTime})`
  desiredNames.add(taskName)
  await ensureCron(cron, taskName, `${minute} ${hour} * * *`, buildTaskCronMessage(habitConfig), existingJobs)

  // 创建每日复盘 cron
  const [reviewHour, reviewMinute] = reviewTime.split(':')
  const reviewName = `Habit Coach - 复盘 (${reviewTime})`
  desiredNames.add(reviewName)
  await ensureCron(cron, reviewName, `${reviewMinute} ${reviewHour} * * *`, buildDailyReviewCronMessage(habitConfig), existingJobs)

  // 创建每周复盘 cron（周日，时间可配置）
  const [weeklyReviewHour, weeklyReviewMinute] = weeklyReviewTime.split(':')
  const weeklyReviewName = `Habit Coach - 周复盘 (Sunday ${weeklyReviewTime})`
  desiredNames.add(weeklyReviewName)
  await ensureCron(cron, weeklyReviewName, `${weeklyReviewMinute} ${weeklyReviewHour} * * 0`, buildWeeklyReviewCronMessage(habitConfig), existingJobs)

  // 清理旧配置留下的 Habit Coach cron
  for (const job of existingJobs) {
    const name = (job as any).name
    if (name?.startsWith('Habit Coach - ') && !desiredNames.has(name)) {
      await cron.remove((job as any).id)
      console.log(`[${PLUGIN_ID}] Removed stale cron: ${name}`)
    }
  }
}
