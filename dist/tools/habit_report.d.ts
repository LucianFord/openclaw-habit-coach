import type { ToolDefinition } from 'openclaw/plugin-sdk/plugin-entry';
declare const parameters: import("@sinclair/typebox").TObject<{
    stateFile: import("@sinclair/typebox").TString;
    period: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"weekly">, import("@sinclair/typebox").TLiteral<"monthly">]>>;
    user: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
export declare const habitReportTool: ToolDefinition<typeof parameters>;
export {};
