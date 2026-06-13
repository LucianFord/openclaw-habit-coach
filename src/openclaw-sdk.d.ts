// Ambient type stubs for the openclaw plugin SDK.
// openclaw is an optional peer dependency — these types enable local compilation.

declare module 'openclaw/plugin-sdk/plugin-entry' {
  import type { TSchema, Static } from '@sinclair/typebox'

  export interface ToolContent {
    type: 'text'
    text: string
  }

  export interface ToolResult {
    content: ToolContent[]
    isError?: boolean
  }

  export interface ToolDefinition<P extends TSchema = TSchema> {
    name: string
    description: string
    parameters: P
    execute(id: string, params: Static<P>): Promise<ToolResult>
  }

  export interface HookContext {
    userMessage?: string
    assistantMessage?: string
    config?: Record<string, unknown>
    callTool?(name: string, params: Record<string, unknown>): Promise<unknown>
  }

  export type HookHandler = (context: HookContext) => Promise<void>

  export interface PluginAPI {
    registerTool<P extends TSchema>(tool: ToolDefinition<P>): void
    registerHook(name: string, handler: HookHandler): void
    on(event: string, handler: HookHandler): void
  }

  export interface PluginEntry {
    id: string
    name: string
    description?: string
    register(api: PluginAPI): void
  }

  export function definePluginEntry(entry: PluginEntry): PluginEntry
}
