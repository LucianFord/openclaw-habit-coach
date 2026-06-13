# Habit Coach — OpenClaw Plugin

An AI accountability coach plugin for [OpenClaw](https://openclaw.dev): dynamic task scheduling, progress tracking, streaks, and a configurable reward/penalty system.

Works as a fully registered OpenClaw plugin (tools + cron hooks) and can also be exercised locally without the Gateway.

## Features

- **Dynamic task generation** — tasks adapt to recent performance (easier when struggling, harder when succeeding)
- **6 agent tools** — `habit_tasks`, `habit_checkin`, `habit_progress`, `habit_report`, `habit_set_goal`, `habit_get_state`
- **Streak tracking** — per-category streaks with longest-ever history
- **Reward/penalty system** — configurable daily & weekly rewards, consecutive-miss penalties
- **Multi-category templates** — built-in tasks for exercise (运动), health (健康), academics (学业), diet (饮食), weight (体重), sleep (睡眠) + generic fallback for any category
- **Automatic cron setup** — `gateway_start` hook registers daily task-delivery and review cron jobs
- **Persistent JSON state** — lightweight, no external database required

## Requirements

- Node.js ≥ 18
- npm ≥ 9
- OpenClaw Gateway ≥ `2026.3.24-beta.2` _(for live deployment only; not needed for local demo/testing)_

## Installation

### As an OpenClaw Plugin

```bash
# Clone into your extensions directory
git clone https://github.com/LucianFord/openclaw-habit-coach ~/.openclaw/extensions/habit-coach
cd ~/.openclaw/extensions/habit-coach
npm install && npm run build
```

Add to your `openclaw.json` (see `examples/openclaw-plugin-config.json` for a full template):

```json
{
  "plugins": {
    "allow": ["habit-coach"],
    "load": { "paths": ["~/.openclaw/extensions/habit-coach"] },
    "entries": {
      "habit-coach": {
        "enabled": true,
        "config": {
          "stateFile": "/path/to/habit-state.json",
          "user": "alice",
          "deliveryChannels": [
            { "channel": "discord", "to": "user:YOUR_DISCORD_USER_ID" }
          ],
          "checkinTime": "07:00",
          "reviewTime": "23:00"
        }
      }
    }
  }
}
```

Restart the Gateway:

```bash
openclaw gateway restart
```

### Local Development (no Gateway needed)

```bash
git clone <repo-url> && cd openclaw-habit-coach
npm install
npm run build   # compile TypeScript → dist/
npm run demo    # run the interactive demo walkthrough
npm test        # run the test suite
```

## Configuration

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `stateFile` | string | ✅ | — | Path to the habit state JSON file |
| `user` | string | ✅ | — | User identifier (name/handle) |
| `deliveryChannels` | array | ✅ | — | Ordered delivery channels (first = primary, rest = fallback) |
| `checkinTime` | string | ✅ | — | Daily task-delivery time (`HH:MM`, 24 h) |
| `reviewTime` | string | | `"23:00"` | Daily review/check-in time |
| `allowAgentMessages` | boolean | | `true` | Allow delivery via agent message tool |

### Delivery Channels

```json
"deliveryChannels": [
  { "channel": "discord",  "to": "user:YOUR_DISCORD_USER_ID" },
  { "channel": "telegram", "to": "chat:YOUR_CHAT_ID" }
]
```

The first channel is primary; subsequent entries are fallbacks tried in order.

## Quick Demo

No OpenClaw Gateway required:

```bash
npm run demo
```

The demo script (`scripts/demo.mjs`):
1. Creates a temporary state file
2. Adds two habit goals (exercise + sleep)
3. Generates today's task list
4. Simulates check-ins
5. Displays progress and a weekly report
6. Cleans up the temp file

## Tool Reference

All tools accept a `stateFile` string (required) and an optional `user` string.

### `habit_set_goal`
Add a new habit to track.

| Param | Type | Required | Notes |
|-------|------|:--------:|-------|
| `category` | string | ✅ | e.g. `"exercise"`, `"sleep"`, `"学习"` |
| `description` | string | ✅ | What you want to work on |
| `severity` | `"low"\|"medium"\|"high"` | | Default: `"medium"` |

### `habit_tasks`
Get today's dynamically generated task list. Tasks are generated fresh on the first call of each day and cached for subsequent calls.

### `habit_checkin`
Mark a task as completed or skipped.

| Param | Type | Required | Notes |
|-------|------|:--------:|-------|
| `taskId` | string | ✅ | Task ID from `habit_tasks` output |
| `completed` | boolean | | `true` = done, `false` = skipped. Default: `true` |

### `habit_progress`
View active habits, current streaks, and last 7 days of completion rates.

### `habit_report`
Generate a weekly or monthly analytical report with patterns and suggestions.

| Param | Type | Notes |
|-------|------|-------|
| `period` | `"weekly"\|"monthly"` | Default: `"weekly"` |

### `habit_get_state`
Return the full raw state as JSON — useful for debugging or seeding agent context.

## Daily Workflow

```
07:00  cron → agent calls habit_tasks → delivers task list to user
  ...  user reports activity → agent calls habit_checkin({ taskId })
23:00  cron → agent calls habit_progress → delivers daily review
Sunday 23:30 cron → agent calls habit_report(period="weekly") → delivers weekly review
```

The `gateway_start` hook automatically registers task, daily review, and weekly review cron jobs on startup.
Task and daily review times are configured via `checkinTime` and `reviewTime`; weekly review is fixed to Sunday 23:30.

## Dynamic Difficulty

The task generator adjusts difficulty based on your recent completion rate:

| Last 3 days avg | Difficulty |
|----------------|-----------|
| < 34 % | easy — build momentum |
| 34 %–80 % | medium — maintain progress |
| > 80 % | hard — push further |

## Reward & Penalty System

Rewards and penalties are configured in the state file's `rewardConfig` / `penaltyConfig` sections (see `examples/habit-state.sample.json`):

- **Daily reward** — earned when `completionRate ≥ rewardConfig.dailyThreshold` (default: 100 %)
- **Weekly reward** — earned when weekly avg ≥ `rewardConfig.weeklyThreshold` (default: 80 %)
- **Milestones** — custom metric-based achievements
- **Daily miss** — gentle reminder configured in `penaltyConfig.daily`
- **Consecutive misses** — stricter consequence after `penaltyConfig.skipConsecutive` days
- **Lie penalty** — activated via `state.lieFlag`; agent calls it out directly

## State File

The plugin manages a single JSON file. See `examples/habit-state.sample.json` for a complete annotated example.

```json
{
  "version": 1,
  "user": "alice",
  "issues":    [{ "id": "...", "category": "exercise", "status": "active" }],
  "changePlan": { "phases": [...], "currentPhase": 0 },
  "dailyLog":  [{ "date": "2026-06-13", "completionRate": 0.75 }],
  "streaks":   [{ "habitId": "exercise", "currentStreak": 5 }],
  "rewardConfig":  { "daily": "...", "weeklyThreshold": 0.8 },
  "penaltyConfig": { "skipConsecutive": 3, "skipPenalty": "..." }
}
```

## Agent Skill Guide

See [`skills/habit-coach/SKILL.md`](skills/habit-coach/SKILL.md) for the full agent interaction guide, including:

- When to call each tool
- Tone adaptation by performance tier
- Reward and penalty delivery
- Task presentation style

## Local Development

```bash
npm install          # install dependencies
npm run build        # TypeScript → dist/
npm test             # run test suite (vitest)
npm run test:watch   # watch mode
npm run demo         # end-to-end demo (builds first)
```

### Verification

After `npm run build`, confirm the plugin entry loads correctly:

```bash
node --input-type=module \
  <<< "import p from './dist/index.js'; console.log('✅ Plugin:', p.id)"
```

Expected output: `✅ Plugin: habit-coach`

Run the full demo to verify the store and tool chain end-to-end:

```bash
npm run demo
```

## Examples

| File | Description |
|------|-------------|
| `examples/openclaw-plugin-config.json` | Sample `openclaw.json` plugin config block |
| `examples/habit-state.sample.json` | Annotated sample state file with two active habits |

## License

MIT — see [LICENSE](LICENSE).
