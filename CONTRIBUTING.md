# Contributing to openclaw-habit-coach

Thank you for considering a contribution! This is a demo/reusable plugin for OpenClaw, and all improvements are welcome.

## Getting Started

```bash
git clone <repo-url>
cd openclaw-habit-coach
npm install
npm run build   # TypeScript → dist/
npm test        # run the test suite
npm run demo    # end-to-end smoke test
```

## Development Workflow

1. **Create a branch** — `git checkout -b feat/my-change`
2. **Make changes** in `src/`
3. **Build** — `npm run build`
4. **Test** — `npm test` (all 15 tests must pass)
5. **Demo** — `npm run demo` (should complete without errors)
6. **Commit** with a clear message following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add new habit category`
   - `fix: correct streak calculation`
   - `docs: improve tool reference`
7. **Open a pull request** with a description of the change and why.

## Project Layout

```
src/
  index.ts                  # plugin entry point
  store/
    types.ts                # shared TypeScript types
    habit-store.ts          # state persistence (load/save/update)
    task-generator.ts       # dynamic task generation
    __tests__/              # vitest tests
  tools/
    get_tasks.ts            # habit_tasks tool
    habit_checkin.ts        # habit_checkin tool
    habit_progress.ts       # habit_progress tool
    habit_report.ts         # habit_report tool
    habit_set_goal.ts       # habit_set_goal tool
    habit_get_state.ts      # habit_get_state tool
  hooks/
    gateway_start.ts        # gateway_start hook (registers cron jobs)
examples/                   # sample config and state files
scripts/
  demo.mjs                  # local demo (no Gateway required)
skills/
  habit-coach/SKILL.md      # agent interaction guide
```

## Adding Tests

Tests live in `src/store/__tests__/` and use [vitest](https://vitest.dev/).

```bash
npm run test:watch   # continuous watch mode
```

## Code Style

- TypeScript strict mode is enabled.
- No external runtime dependencies beyond `@sinclair/typebox`.
- Keep tool implementations stateless — all state goes through the JSON state file.

## Reporting Issues

Please open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behaviour
- Node.js version (`node --version`) and OS

## License

By contributing, you agree your contributions will be licensed under the [MIT License](LICENSE).
