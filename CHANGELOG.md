# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] — 2026-06-14

### Added

- **`habit_update_tasks`** — replace today's pending tasks from an in-conversation plan while preserving completed/skipped tasks
- **Conversation-driven task sync** — daily plans agreed with the user no longer get overwritten by later auto-generated task delivery
- **Packaging hygiene** — ignore generated reports and stale tarballs so ClawHub publishes a cleaner package

### Fixed

- `habit_tasks` now reads existing tasks with live completion stats instead of regenerating/overwriting them
- New compiled `dist/tools/habit_update_tasks.*` files are tracked so source installs include the new tool

## [0.1.0] — 2026-06-13

### Added

- **6 agent tools**: `habit_tasks`, `habit_checkin`, `habit_progress`, `habit_report`, `habit_set_goal`, `habit_get_state`
- **Dynamic task generation** — difficulty adapts to last-3-day completion rate (easy / medium / hard)
- **Streak tracking** — per-category current streak, longest ever, and last-active date
- **Reward/penalty system** — configurable daily & weekly rewards, consecutive-miss penalties, lie flag
- **Multi-category templates** — built-in tasks for exercise (运动), health (健康), academics (学业), diet (饮食), weight (体重), sleep (睡眠), plus generic fallback
- **`gateway_start` hook** — auto-registers daily task-delivery and review cron jobs
- **Persistent JSON state** — single-file, no external database required
- **OpenClaw plugin entry** (`openclaw.plugin.json`) compatible with Gateway ≥ `2026.3.24-beta.2`
- **Local demo** (`scripts/demo.mjs`) — exercises the full tool chain without OpenClaw Gateway
- **Vitest test suite** — 15 unit tests covering store operations
- **MIT license**
- **Example files** — sample plugin config and annotated state file
- **Agent skill guide** (`skills/habit-coach/SKILL.md`) — tone, tool-call order, reward/penalty delivery

[Unreleased]: https://github.com/LucianFord/openclaw-habit-coach/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/LucianFord/openclaw-habit-coach/releases/tag/v0.1.0
