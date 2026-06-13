import { Type, type Static } from '@sinclair/typebox'
import type { ToolDefinition } from 'openclaw/plugin-sdk/plugin-entry'
import { loadState } from '../store/habit-store.js'
import type { DailyLogEntry } from '../store/types.js'

const parameters = Type.Object({
  stateFile: Type.String({ description: 'Path to the habit state JSON file' }),
  period: Type.Optional(
    Type.Union([Type.Literal('weekly'), Type.Literal('monthly')], {
      description: "Report period: 'weekly' (last 7 days) or 'monthly' (last 30 days). Default: weekly",
    }),
  ),
  user: Type.Optional(Type.String({ description: 'User identifier' })),
})

type Params = Static<typeof parameters>

function getDayName(dateStr: string): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[new Date(dateStr + 'T12:00:00').getDay()]!
}

function analyzePatterns(entries: DailyLogEntry[]): string[] {
  if (entries.length === 0) return []

  const insights: string[] = []

  // Best/worst days of week
  const byDay: Record<string, number[]> = {}
  for (const entry of entries) {
    const day = getDayName(entry.date)
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(entry.completionRate)
  }
  const dayAvgs = Object.entries(byDay)
    .map(([day, rates]) => ({
      day,
      avg: rates.reduce((a, b) => a + b, 0) / rates.length,
    }))
    .sort((a, b) => b.avg - a.avg)

  if (dayAvgs.length >= 2) {
    const best = dayAvgs[0]!
    const worst = dayAvgs[dayAvgs.length - 1]!
    if (best.avg > worst.avg + 0.1) {
      insights.push(`📅 Best day: ${best.day} (${Math.round(best.avg * 100)}% avg)`)
      insights.push(`📅 Toughest day: ${worst.day} (${Math.round(worst.avg * 100)}% avg)`)
    }
  }

  // Category breakdown
  const byCat: Record<string, { done: number; total: number }> = {}
  for (const entry of entries) {
    for (const task of entry.tasks) {
      if (!byCat[task.category]) byCat[task.category] = { done: 0, total: 0 }
      byCat[task.category]!.total++
      if (task.completed) byCat[task.category]!.done++
    }
  }
  const catStats = Object.entries(byCat).map(([cat, s]) => ({
    cat,
    rate: s.total > 0 ? s.done / s.total : 0,
    total: s.total,
  }))

  const strongCats = catStats.filter(c => c.rate >= 0.8 && c.total >= 3)
  const weakCats = catStats.filter(c => c.rate < 0.4 && c.total >= 3)

  for (const c of strongCats) {
    insights.push(`💪 Strong area: ${c.cat} (${Math.round(c.rate * 100)}% completion)`)
  }
  for (const c of weakCats) {
    insights.push(`⚠️ Needs focus: ${c.cat} (${Math.round(c.rate * 100)}% completion)`)
  }

  return insights
}

function generateSuggestions(entries: DailyLogEntry[]): string[] {
  const suggestions: string[] = []
  if (entries.length === 0) {
    suggestions.push('Start tracking — use habit_tasks to get your first set of tasks.')
    return suggestions
  }

  const avgRate = entries.reduce((a, e) => a + e.completionRate, 0) / entries.length

  if (avgRate < 0.4) {
    suggestions.push('Consider reducing the number of daily tasks — focus on 1-2 core habits.')
    suggestions.push('Make sure tasks are achievable — small wins build momentum.')
  } else if (avgRate < 0.7) {
    suggestions.push('You\'re making progress! Identify which days you miss and plan ahead.')
    suggestions.push('Try habit stacking — attach new habits to existing routines.')
  } else {
    suggestions.push('Excellent consistency! Consider increasing task difficulty to keep growing.')
    suggestions.push('Think about adding a new habit category to expand your growth.')
  }

  // Check for consecutive misses
  let maxConsecutiveMisses = 0
  let currentMisses = 0
  for (const entry of entries) {
    if (entry.completionRate < 0.5) {
      currentMisses++
      maxConsecutiveMisses = Math.max(maxConsecutiveMisses, currentMisses)
    } else {
      currentMisses = 0
    }
  }
  if (maxConsecutiveMisses >= 3) {
    suggestions.push(`You had a ${maxConsecutiveMisses}-day slump. Plan a recovery strategy for next time.`)
  }

  return suggestions
}

export const habitReportTool: ToolDefinition<typeof parameters> = {
  name: 'habit_report',
  description:
    'Generate a detailed weekly or monthly report with completion rates, streaks, best/worst days, category breakdown, pattern analysis, and actionable suggestions.',
  parameters,
  async execute(_id: string, params: Params) {
    try {
      const state = loadState(params.stateFile, params.user)
      const period = params.period ?? 'weekly'
      const days = period === 'monthly' ? 30 : 7
      const today = new Date().toISOString().split('T')[0]!

      const entries = state.dailyLog
        .filter(e => e.date <= today)
        .slice(-days)

      const lines: string[] = []
      const periodLabel = period === 'monthly' ? 'Monthly' : 'Weekly'
      lines.push(`📊 **${periodLabel} Report — ${state.user}**`)
      lines.push(`Period: last ${days} days (${days - entries.length} days without data)`)
      lines.push('')

      if (entries.length === 0) {
        lines.push('No data found for this period. Start checking in daily to generate reports!')
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
      }

      // Summary stats
      const avgRate = entries.reduce((a, e) => a + e.completionRate, 0) / entries.length
      const perfectDays = entries.filter(e => e.completionRate >= 1.0).length
      const missedDays = entries.filter(e => e.completionRate === 0).length
      const totalTasksDone = entries.reduce((a, e) => a + e.completedCount, 0)
      const totalTasksSet = entries.reduce((a, e) => a + e.totalCount, 0)

      lines.push(`**Summary:**`)
      lines.push(`  Average completion: ${Math.round(avgRate * 100)}%`)
      lines.push(`  Total tasks done: ${totalTasksDone}/${totalTasksSet}`)
      lines.push(`  Perfect days: ${perfectDays}/${entries.length}`)
      lines.push(`  Missed days: ${missedDays}/${entries.length}`)
      lines.push('')

      // Daily breakdown
      lines.push(`**Daily Breakdown:**`)
      const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date))
      for (const entry of sortedEntries) {
        const bar = '█'.repeat(Math.round(entry.completionRate * 10)) +
                    '░'.repeat(10 - Math.round(entry.completionRate * 10))
        const rate = Math.round(entry.completionRate * 100)
        const dayName = getDayName(entry.date)
        const label = entry.date === today ? ' (today)' : ''
        lines.push(`  ${entry.date} ${dayName}${label}: [${bar}] ${rate}% (${entry.completedCount}/${entry.totalCount})`)
      }
      lines.push('')

      // Streaks summary
      const activeStreaks = state.streaks.filter(s => s.currentStreak > 0)
      if (activeStreaks.length > 0) {
        lines.push(`**Current Streaks:**`)
        for (const s of activeStreaks.sort((a, b) => b.currentStreak - a.currentStreak)) {
          const icon = s.status === 'active' ? '🔥' : '💔'
          lines.push(`  ${icon} ${s.habitId}: ${s.currentStreak} days (best: ${s.longestStreak})`)
        }
        lines.push('')
      }

      // Pattern analysis
      const patterns = analyzePatterns(entries)
      if (patterns.length > 0) {
        lines.push(`**Patterns:**`)
        for (const p of patterns) {
          lines.push(`  ${p}`)
        }
        lines.push('')
      }

      // Suggestions
      const suggestions = generateSuggestions(entries)
      if (suggestions.length > 0) {
        lines.push(`**Suggestions:**`)
        for (const s of suggestions) {
          lines.push(`  → ${s}`)
        }
        lines.push('')
      }

      // Weekly reward check
      if (period === 'weekly' && avgRate >= state.rewardConfig.weeklyThreshold) {
        lines.push(`🏆 **Weekly reward earned!** (${Math.round(avgRate * 100)}% ≥ ${Math.round(state.rewardConfig.weeklyThreshold * 100)}% threshold)`)
        lines.push(`   ✨ ${state.rewardConfig.weekly}`)
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: 'text' as const, text: `❌ Error generating report: ${message}` }],
        isError: true,
      }
    }
  },
}
