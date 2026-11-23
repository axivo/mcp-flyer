/**
 * Flyer MCP Server implementation
 *
 * @module server/mcp
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { McpServer, type RegisteredTool, type ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { Client } from './client.js';
import { McpTool } from './tool.js';

/**
 * Input of a tool, inferred from its Zod input schema
 */
type Input<K extends ToolName> = z.output<ReturnType<McpTool[K]>['inputSchema']>;

/**
 * Names of the tools that take input
 */
type ToolName = Exclude<keyof McpTool, 'getInstructions' | 'status'>;

/**
 * Flyer MCP Server implementation bridging flyers with Model Context Protocol
 *
 * Provides flyer access through MCP tools, managing request routing
 * and response formatting. `createServer()` builds a fresh `McpServer` on
 * every call, as `serveStdio` may call its factory more than once per
 * connection.
 *
 * @class Mcp
 */
export class Mcp {
  private client: Client;
  private tool: McpTool;

  /**
   * Creates a new Mcp instance
   *
   * Initializes the flyer client and the tool definitions, both shared by
   * every server built with `createServer()`.
   */
  constructor() {
    this.client = new Client();
    this.tool = new McpTool();
  }

  /**
   * Returns the registered tools in a wire-friendly shape for the status tool
   *
   * Reads the handles returned by `registerTool`, so `status` always shows
   * what is registered. Schemas are converted through the Standard Schema
   * JSON interface, the same path the SDK uses for `tools/list`, and
   * `_meta.usage` is lifted to a top-level `usage` field.
   *
   * @private
   * @param {Record<string, RegisteredTool>} tools - Registered tools by name
   * @returns {object[]} Array of tool definitions
   */
  private getToolDefinitions(tools: Record<string, RegisteredTool>): Record<string, unknown>[] {
    return Object.entries(tools).map(([name, tool]) => {
      const definition: Record<string, unknown> = { name, title: tool.title, description: tool.description };
      if (tool.inputSchema) {
        definition.inputSchema = tool.inputSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
      }
      if (tool.outputSchema) {
        definition.outputSchema = tool.outputSchema['~standard'].jsonSchema.output({ target: 'draft-2020-12' });
      }
      if (tool.annotations) {
        definition.annotations = tool.annotations;
      }
      if (Array.isArray(tool._meta?.usage)) {
        definition.usage = tool._meta.usage;
      }
      return definition;
    });
  }

  /**
   * Handles list tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @param {ServerContext} ctx - Request context
   * @returns {Promise<object>} Tool response with text and structured content
   */
  private async handleList(args: Input<'list'>, ctx: ServerContext) {
    const result = await this.client.list(args, ctx.mcpReq.signal);
    return this.structured(result);
  }

  /**
   * Handles read tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @param {ServerContext} ctx - Request context
   * @returns {Promise<object>} Tool response with text and structured content
   */
  private async handleRead(args: Input<'read'>, ctx: ServerContext) {
    const { picture, ...item } = await this.client.read(args, ctx.mcpReq.signal);
    if (!picture) {
      return this.structured(item);
    }
    return {
      content: [
        { type: 'image' as const, data: picture.data, mimeType: picture.mimeType },
        { type: 'text' as const, text: JSON.stringify(item) }
      ],
      structuredContent: item
    };
  }

  /**
   * Handles search tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @param {ServerContext} ctx - Request context
   * @returns {Promise<object>} Tool response with text and structured content
   */
  private async handleSearch(args: Input<'search'>, ctx: ServerContext) {
    const result = await this.client.search(args, ctx.mcpReq.signal);
    return this.structured(result);
  }

  /**
   * Handles status tool requests
   *
   * Returns the HTTP status of the flyer services and the full tool surface
   * in one payload. Designed for session-start orientation: the calling
   * instance learns what tools exist (with usage guidance) and whether Flipp
   * answers.
   *
   * @private
   * @param {Record<string, RegisteredTool>} tools - Registered tools by name
   * @param {ServerContext} ctx - Request context
   * @returns {Promise<object>} Tool response with text and structured content
   */
  private async handleStatus(tools: Record<string, RegisteredTool>, ctx: ServerContext) {
    const status = await this.client.getStatus(ctx.mcpReq.signal);
    return this.structured({ ...status, tools: this.getToolDefinitions(tools) });
  }

  /**
   * Registers every tool with a McpServer registry
   *
   * Each call wires a tool definition from `McpTool` to its handler and
   * keeps the returned handle, which the `status` tool reads. The SDK
   * validates incoming arguments against the tool's `inputSchema` and
   * (when present) the tool's response against its `outputSchema`.
   *
   * @private
   * @param {McpServer} server - Server to register the tools on
   */
  private registerAll(server: McpServer): void {
    const tools: Record<string, RegisteredTool> = {};
    tools.list = server.registerTool('list', this.tool.list(), this.handleList.bind(this));
    tools.read = server.registerTool('read', this.tool.read(), this.handleRead.bind(this));
    tools.search = server.registerTool('search', this.tool.search(), this.handleSearch.bind(this));
    tools.status = server.registerTool('status', this.tool.status(), (ctx: ServerContext) => this.handleStatus(tools, ctx));
  }

  /**
   * Builds an output payload for tool responses with structured content
   *
   * @private
   * @param {object} output - Structured output payload
   * @returns {object} CallToolResult with both text content and structuredContent
   */
  private structured<T extends Record<string, unknown>>(output: T): { content: { type: 'text'; text: string }[]; structuredContent: T } {
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output
    };
  }

  /**
   * Builds a fresh McpServer with every tool registered
   *
   * The server carries `instructions`, a short text the host shows the agent
   * when the session starts, before any tool is called. The SDK takes one
   * string, so the lines are joined into a Markdown list.
   *
   * @returns {McpServer} Server ready to serve one connection
   */
  createServer(): McpServer {
    const instructions = this.tool.getInstructions().map((line) => `- ${line}`).join('\n');
    const server = new McpServer({ name: 'flyer', version: this.client.getVersion() }, { capabilities: { tools: {} }, instructions });
    this.registerAll(server);
    return server;
  }
}
