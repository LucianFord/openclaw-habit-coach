import { Type } from '@sinclair/typebox';
import { loadState } from '../store/habit-store.js';
const parameters = Type.Object({
    stateFile: Type.String({ description: 'Path to the habit state JSON file' }),
    user: Type.Optional(Type.String({ description: 'User identifier' })),
});
export const habitGetStateTool = {
    name: 'habit_get_state',
    description: 'Get the full habit state as JSON. Useful for debugging, agent context loading, or when you need access to the complete raw data including all issues, logs, streaks, and configuration.',
    parameters,
    async execute(_id, params) {
        try {
            const state = loadState(params.stateFile, params.user);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(state, null, 2),
                    }],
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: [{ type: 'text', text: `❌ Error loading state: ${message}` }],
                isError: true,
            };
        }
    },
};
