import type { ToolDefinition } from 'openclaw/plugin-sdk/plugin-entry';
declare const parameters: import("@sinclair/typebox").TObject<{
    stateFile: import("@sinclair/typebox").TString;
    category: import("@sinclair/typebox").TString;
    description: import("@sinclair/typebox").TString;
    severity: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"low">, import("@sinclair/typebox").TLiteral<"medium">, import("@sinclair/typebox").TLiteral<"high">]>>;
    user: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
export declare const habitSetGoalTool: ToolDefinition<typeof parameters>;
export {};
