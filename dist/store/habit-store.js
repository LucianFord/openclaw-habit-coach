import { readFileSync, writeFileSync, existsSync } from 'node:fs';
// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------
function normalizeGoals(raw) {
    return raw.map(g => {
        if (typeof g === 'string') {
            return { description: g, target: g, done: false };
        }
        return { ...g, done: g.done ?? false };
    });
}
function normalizeTask(raw, index) {
    if (typeof raw === 'string') {
        return {
            id: `task-${index}`,
            title: raw,
            category: 'general',
            completed: false,
            skipped: false,
            difficulty: 'medium',
        };
    }
    return raw;
}
function normalizeLegacy(raw, defaults) {
    // 1. issues: prefer raw.issues, fall back to raw.currentIssues
    const issues = Array.isArray(raw.issues) && raw.issues.length > 0
        ? raw.issues
        : Array.isArray(raw.currentIssues)
            ? raw.currentIssues
            : defaults.issues;
    // 2. changePlan — normalise goal strings → PhaseGoal objects
    const rawPlan = raw.changePlan;
    const changePlan = rawPlan
        ? {
            version: rawPlan.version ?? defaults.changePlan.version,
            startDate: rawPlan.startDate ?? defaults.changePlan.startDate,
            currentPhase: rawPlan.currentPhase ?? defaults.changePlan.currentPhase,
            phases: Array.isArray(rawPlan.phases)
                ? rawPlan.phases.map((p) => ({
                    phase: p.phase ?? 0,
                    name: p.name ?? '',
                    duration: p.duration ?? '',
                    focus: p.focus ?? '',
                    active: p.active ?? false,
                    goals: Array.isArray(p.goals) ? normalizeGoals(p.goals) : [],
                }))
                : defaults.changePlan.phases,
        }
        : defaults.changePlan;
    // 3. dailyLog — normalise task strings → TaskEntry objects
    const dailyLog = Array.isArray(raw.dailyLog)
        ? raw.dailyLog.map((entry) => ({
            date: entry.date ?? '',
            tasks: Array.isArray(entry.tasks)
                ? entry.tasks.map((t, i) => normalizeTask(t, i))
                : [],
            completedCount: entry.completedCount ?? 0,
            totalCount: entry.totalCount ?? 0,
            completionRate: entry.completionRate ?? 0,
            notes: entry.notes ?? '',
            mood: entry.mood,
        }))
        : defaults.dailyLog;
    // 4. rewardConfig / penaltyConfig — also absorb legacy rewardPenalty block
    let rewardConfig = defaults.rewardConfig;
    let penaltyConfig = defaults.penaltyConfig;
    if (raw.rewardPenalty) {
        const rp = raw.rewardPenalty;
        rewardConfig = {
            ...defaults.rewardConfig,
            daily: rp.rewards?.daily ?? defaults.rewardConfig.daily,
            weekly: rp.rewards?.weekly ?? defaults.rewardConfig.weekly,
        };
        penaltyConfig = {
            ...defaults.penaltyConfig,
            daily: rp.penalties?.daily ?? defaults.penaltyConfig.daily,
            skipConsecutive: typeof rp.penalties?.skipConsecutive === 'number'
                ? rp.penalties.skipConsecutive
                : defaults.penaltyConfig.skipConsecutive,
            skipPenalty: rp.penalties?.skipPenalty ?? defaults.penaltyConfig.skipPenalty,
            liePenalty: rp.penalties?.liePenalty ?? defaults.penaltyConfig.liePenalty,
        };
    }
    else {
        // Merge partial rewardConfig / penaltyConfig from the file if present
        if (raw.rewardConfig) {
            rewardConfig = { ...defaults.rewardConfig, ...raw.rewardConfig };
        }
        if (raw.penaltyConfig) {
            penaltyConfig = { ...defaults.penaltyConfig, ...raw.penaltyConfig };
        }
    }
    // 5. Assemble final state — spread all remaining top-level fields first, then
    //    overwrite with the normalized values so plugins never see legacy keys.
    const { currentIssues: _ci, rewardPenalty: _rp, issues: _i, changePlan: _cp, dailyLog: _dl, rewardConfig: _rc, penaltyConfig: _pc, ...rest } = raw;
    return {
        ...defaults,
        ...rest,
        issues,
        changePlan,
        dailyLog,
        rewardConfig,
        penaltyConfig,
        streaks: Array.isArray(raw.streaks) ? raw.streaks : defaults.streaks,
        rewardsEarned: Array.isArray(raw.rewardsEarned)
            ? raw.rewardsEarned
            : defaults.rewardsEarned,
        penaltiesApplied: Array.isArray(raw.penaltiesApplied)
            ? raw.penaltiesApplied
            : defaults.penaltiesApplied,
        lieFlag: typeof raw.lieFlag === 'boolean' ? raw.lieFlag : defaults.lieFlag,
        consecutiveMisses: typeof raw.consecutiveMisses === 'number'
            ? raw.consecutiveMisses
            : defaults.consecutiveMisses,
    };
}
function defaultState(user) {
    return {
        version: 1,
        user,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        issues: [],
        changePlan: {
            version: 1,
            startDate: new Date().toISOString().split('T')[0],
            phases: [],
            currentPhase: 0,
        },
        dailyLog: [],
        streaks: [],
        rewardConfig: {
            daily: 'Agent praises you warmly and gives you free chat time',
            dailyThreshold: 1.0,
            weekly: 'Agent gives you a special treat of your choosing',
            weeklyThreshold: 0.8,
            milestones: [],
        },
        penaltyConfig: {
            daily: 'Agent gives you a gentle reminder of your commitment',
            skipConsecutive: 3,
            skipPenalty: 'Agent gives you a firm but caring reminder',
            liePenalty: 'Agent calls you out clearly and resets trust',
            lieResetAt: '',
        },
        rewardsEarned: [],
        penaltiesApplied: [],
        lieFlag: false,
        consecutiveMisses: 0,
    };
}
export function loadState(stateFile, user = 'user') {
    if (!existsSync(stateFile)) {
        return defaultState(user);
    }
    try {
        const raw = JSON.parse(readFileSync(stateFile, 'utf-8'));
        const base = defaultState(raw.user ?? user);
        return normalizeLegacy(raw, base);
    }
    catch {
        return defaultState(user);
    }
}
export function saveState(stateFile, state) {
    const updated = { ...state, updatedAt: new Date().toISOString() };
    writeFileSync(stateFile, JSON.stringify(updated, null, 2), 'utf-8');
}
export function addDailyEntry(state, entry) {
    const dailyLog = [...state.dailyLog];
    const idx = dailyLog.findIndex(e => e.date === entry.date);
    if (idx >= 0) {
        dailyLog[idx] = entry;
    }
    else {
        dailyLog.push(entry);
    }
    return { ...state, dailyLog };
}
export function updateIssue(state, issueId, updates) {
    const issues = state.issues.map(issue => issue.id === issueId
        ? { ...issue, ...updates, updatedAt: new Date().toISOString() }
        : issue);
    return { ...state, issues };
}
export function updateStreak(state, habitId, completed) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const streaks = [...state.streaks];
    const idx = streaks.findIndex(s => s.habitId === habitId);
    if (idx < 0) {
        const newEntry = {
            habitId,
            currentStreak: completed ? 1 : 0,
            longestStreak: completed ? 1 : 0,
            lastDate: today,
            status: completed ? 'active' : 'broken',
        };
        streaks.push(newEntry);
        return { ...state, streaks };
    }
    const existing = streaks[idx];
    if (completed) {
        let newCurrent;
        if (existing.lastDate === today) {
            // Already updated today — no change
            newCurrent = existing.currentStreak;
        }
        else if (existing.lastDate === yesterdayStr) {
            // Continuing streak
            newCurrent = existing.currentStreak + 1;
        }
        else {
            // Gap — restart streak
            newCurrent = 1;
        }
        streaks[idx] = {
            ...existing,
            currentStreak: newCurrent,
            longestStreak: Math.max(existing.longestStreak, newCurrent),
            lastDate: today,
            status: 'active',
        };
    }
    else {
        streaks[idx] = {
            ...existing,
            currentStreak: 0,
            lastDate: today,
            status: 'broken',
        };
    }
    return { ...state, streaks };
}
export function getTodayEntry(state) {
    const today = new Date().toISOString().split('T')[0];
    return state.dailyLog.find(e => e.date === today);
}
export function hasDailyRewardEarned(state) {
    const entry = getTodayEntry(state);
    if (!entry || entry.totalCount === 0)
        return false;
    return entry.completionRate >= state.rewardConfig.dailyThreshold;
}
