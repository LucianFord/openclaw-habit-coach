const CATEGORY_TEMPLATES = {
    '运动': {
        easy: [
            'Do 10 push-ups and 10 squats',
            'Walk for 15 minutes',
            'Do a 10-minute stretching routine',
            'Do 15 jumping jacks and 15 sit-ups',
        ],
        medium: [
            'Do 20 push-ups, 20 squats, and 20 lunges',
            'Go for a 30-minute brisk walk or light jog',
            'Complete a 25-minute home workout (HIIT or bodyweight)',
        ],
        hard: [
            'Complete a 45-minute workout session',
            'Run 5km or do 50 push-ups + 50 squats + 50 sit-ups',
            'Full gym session: 30 min cardio + 30 min weights',
        ],
    },
    '健康': {
        easy: [
            'Drink 6 glasses of water today',
            'Sleep by 11:30pm tonight',
            'Take your daily vitamins',
        ],
        medium: [
            'Drink 8 glasses of water and take vitamins',
            'Sleep by 11pm and wake up at 7am',
            'Log your sleep and water intake today',
        ],
        hard: [
            'Full health routine: 8 glasses water + vitamins + 8h sleep',
            'No screens 1 hour before bed, lights out by 10:30pm',
        ],
    },
    '学业': {
        easy: [
            'Study or review notes for 20 minutes',
            'Read one chapter or one article',
            "Review yesterday's material for 15 minutes",
        ],
        medium: [
            'Study for 45 minutes with no phone or distractions',
            'Complete one assignment or practice problem set',
            'Read for 30 minutes and write a brief summary',
        ],
        hard: [
            'Study for 90 minutes: 2 focused Pomodoro blocks',
            'Complete all due assignments and review key concepts',
            'Deep work: 2 × 45-min focused study sessions with notes',
        ],
    },
    '饮食': {
        easy: [
            'Eat a healthy breakfast before 9am',
            'Skip late-night snacks after 9pm',
            'Eat at least one serving of vegetables today',
        ],
        medium: [
            'Eat 3 balanced meals with vegetables at each',
            'Track your food intake for the full day',
            'No fast food, junk food, or sugary drinks today',
        ],
        hard: [
            'Follow meal plan strictly all day — no deviations',
            'Meal prep healthy food for the next two days',
            'Hit all macros: protein, carbs, veggies at every meal',
        ],
    },
    '体重': {
        easy: [
            'Weigh yourself after waking and log the number',
            'Eat one fewer serving of refined carbs today',
            'Take an extra 10-minute walk after a meal',
        ],
        medium: [
            'Track all meals and stay within daily calorie target',
            'Complete a 30-minute fat-burning cardio session',
            'Avoid all sugary drinks and processed snacks today',
        ],
        hard: [
            'Follow full diet + exercise plan today without exceptions',
            '45-minute cardio session + strict macro tracking',
            'Zero processed food today + complete planned workout',
        ],
    },
    '睡眠': {
        easy: [
            'Be in bed with lights off by 11:30pm',
            'Avoid screens 30 minutes before bedtime',
            'Set a consistent wake-up alarm for tomorrow',
        ],
        medium: [
            'Sleep by 11pm and wake up at 7am without snoozing',
            'No caffeine after 3pm and in bed by 10:30pm',
            'Track sleep duration and quality in your log',
        ],
        hard: [
            'Full sleep hygiene: no screens 1h before bed, blackout curtains, lights out by 10pm',
            'Perfect sleep schedule: in bed at 10pm, up at 6:30am — no exceptions',
        ],
    },
};
function getTasksForCategory(category, difficulty, issueDescription) {
    const templates = CATEGORY_TEMPLATES[category];
    if (templates) {
        return templates[difficulty];
    }
    // Generic fallback using issue description
    const desc = issueDescription.length > 60
        ? issueDescription.slice(0, 57) + '...'
        : issueDescription;
    return {
        easy: [
            `Small step toward "${desc}" — spend 15 minutes on it`,
            `Do a quick check-in on your goal: ${desc}`,
        ],
        medium: [
            `Work on "${desc}" for 30 focused minutes`,
            `Make meaningful progress on: ${desc}`,
        ],
        hard: [
            `Fully tackle "${desc}" — dedicated session today`,
            `Complete a major step toward: ${desc}`,
        ],
    }[difficulty];
}
function getRecentCategoryCompletionRate(dailyLog, category, days = 3) {
    const recent = dailyLog.slice(-days);
    if (recent.length === 0)
        return -1; // no data → signal first-run
    let total = 0;
    let completed = 0;
    for (const entry of recent) {
        for (const task of entry.tasks) {
            if (task.category === category) {
                total++;
                if (task.completed)
                    completed++;
            }
        }
    }
    if (total === 0)
        return -1; // no category data → signal first-run
    return completed / total;
}
function determineDifficulty(completionRate) {
    if (completionRate < 0)
        return 'easy'; // No history → start easy
    if (completionRate < 0.34)
        return 'easy'; // Struggling → make it easier
    if (completionRate > 0.80)
        return 'hard'; // Succeeding → push harder
    return 'medium';
}
function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
export function generateTasks(state) {
    const tasks = [];
    const usedTitles = new Set();
    const activeIssues = state.issues.filter(i => i.status === 'active');
    const currentPhase = state.changePlan.phases[state.changePlan.currentPhase];
    // --- Tasks from active issues (1 task per issue, up to 5 total) ---
    for (const issue of activeIssues) {
        if (tasks.length >= 5)
            break;
        const rate = getRecentCategoryCompletionRate(state.dailyLog, issue.category);
        const difficulty = determineDifficulty(rate);
        const candidates = getTasksForCategory(issue.category, difficulty, issue.issue);
        let added = 0;
        // Shuffle candidates so we don't always pick the first one
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        for (const title of shuffled) {
            if (added >= 1)
                break;
            if (!usedTitles.has(title)) {
                usedTitles.add(title);
                tasks.push({
                    id: generateId(issue.category),
                    title,
                    category: issue.category,
                    completed: false,
                    skipped: false,
                    difficulty,
                });
                added++;
            }
        }
    }
    // --- Tasks from current phase goals (one task per unmet goal, up to 5 total) ---
    if (currentPhase) {
        for (const goal of currentPhase.goals) {
            if (!goal.done && tasks.length < 5) {
                const title = `[${currentPhase.name}] ${goal.target}`;
                if (!usedTitles.has(title)) {
                    usedTitles.add(title);
                    tasks.push({
                        id: generateId('goal'),
                        title,
                        category: currentPhase.focus,
                        completed: false,
                        skipped: false,
                        difficulty: 'medium',
                    });
                }
            }
        }
    }
    // --- Streak maintenance task for active streaks ≥ 5 days ---
    const highStreaks = state.streaks.filter(s => s.status === 'active' && s.currentStreak >= 5);
    for (const streak of highStreaks) {
        const matchingIssue = state.issues.find(i => i.id === streak.habitId);
        if (matchingIssue && tasks.length < 5) {
            const title = `🔥 Keep your ${streak.currentStreak}-day streak alive — ${matchingIssue.category}`;
            if (!usedTitles.has(title)) {
                usedTitles.add(title);
                tasks.push({
                    id: generateId('streak'),
                    title,
                    category: matchingIssue.category,
                    completed: false,
                    skipped: false,
                    difficulty: 'easy',
                });
            }
        }
    }
    // --- Fallback: if no tasks generated (no active issues, no phase), prompt goal-setting ---
    if (tasks.length === 0) {
        const fallbacks = [
            'Set a new habit goal using habit_set_goal',
            'Reflect on your progress and identify one habit to improve',
            'Write down three things you want to work on this week',
        ];
        tasks.push({
            id: generateId('default'),
            title: pickOne(fallbacks),
            category: 'general',
            completed: false,
            skipped: false,
            difficulty: 'easy',
        });
    }
    return tasks;
}
