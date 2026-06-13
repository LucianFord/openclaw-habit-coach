import type { ToolDefinition } from 'openclaw/plugin-sdk/plugin-entry';
declare const parameters: import("@sinclair/typebox").TObject<{
    stateFile: import("@sinclair/typebox").TString;
    user: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
export declare const habitProgressTool: ToolDefinition<typeof parameters>;
export {};
