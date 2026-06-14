import type { ToolDefinition } from 'openclaw/plugin-sdk/plugin-entry';
declare const parameters: import("@sinclair/typebox").TObject<{
    stateFile: import("@sinclair/typebox").TString;
    tasks: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        title: import("@sinclair/typebox").TString;
        category: import("@sinclair/typebox").TString;
        difficulty: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"easy">, import("@sinclair/typebox").TLiteral<"medium">, import("@sinclair/typebox").TLiteral<"hard">]>>;
    }>>;
    user: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
export declare const habitUpdateTasksTool: ToolDefinition<typeof parameters>;
export {};
