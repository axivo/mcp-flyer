/**
 * Flyer MCP Server implementation
 *
 * @module server/mcp
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Client } from './client.js';
import { McpTool } from './tool.js';

/**
 * Flyer MCP Server implementation bridging grocery flyers with Model Context Protocol
 *
 * Provides flyer access through MCP tools, managing request routing
 * and response formatting.
 *
 * @class Mcp
 */
export class Mcp {
  private client: Client;
  private server: McpServer;
  private tool: McpTool;

  /**
   * Creates a new Mcp instance with tool setup
   *
   * Initializes the flyer client, MCP server, and registers every
   * tool with the underlying McpServer registry.
   */
  constructor() {
    this.client = new Client();
    this.server = new McpServer(
      { name: 'flyer', version: this.client.getVersion() },
      { capabilities: { tools: {} } }
    );
    this.tool = new McpTool();
    this.registerAll();
  }

  /**
   * Returns all tool definitions in a wire-friendly shape for the status tool
   *
   * Iterates every registered tool, converts each Zod input/output schema to
   * JSON Schema for portability, and lifts `_meta.usage` to a top-level `usage`
   * field for ergonomic consumption.
   *
   * @private
   * @returns {object[]} Array of tool definitions
   */
  private getToolDefinitions(): Record<string, unknown>[] {
    const entries: { name: string; config: Record<string, unknown> }[] = [
      { name: 'list', config: this.tool.list() },
      { name: 'read', config: this.tool.read() },
      { name: 'search', config: this.tool.search() },
      { name: 'status', config: this.tool.status() }
    ];
    return entries.map(({ name, config }) => {
      const definition: Record<string, unknown> = {
        name,
        description: config.description ?? ''
      };
      if (config.inputSchema && Object.keys(config.inputSchema as Record<string, unknown>).length > 0) {
        definition.inputSchema = z.toJSONSchema(z.object(config.inputSchema as z.ZodRawShape), { io: 'input' });
      }
      if (config.outputSchema && Object.keys(config.outputSchema as Record<string, unknown>).length > 0) {
        definition.outputSchema = z.toJSONSchema(z.object(config.outputSchema as z.ZodRawShape));
      }
      if (config.annotations) {
        definition.annotations = config.annotations;
      }
      const meta = config._meta as { usage?: string[] } | undefined;
      if (meta?.usage) {
        definition.usage = meta.usage;
      }
      return definition;
    });
  }

  /**
   * Handles list tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleList(args: Parameters<Client['list']>[0]) {
    const result = await this.client.list(args);
    return this.structured(result);
  }

  /**
   * Handles read tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleRead(args: Parameters<Client['read']>[0]) {
    const { picture, ...item } = await this.client.read(args);
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
   * @returns {Promise<any>} Tool execution response
   */
  private async handleSearch(args: Parameters<Client['search']>[0]) {
    const result = await this.client.search(args);
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
   * @returns {Promise<any>} Tool execution response
   */
  private async handleStatus() {
    const status = await this.client.getStatus();
    const tools = this.getToolDefinitions();
    return this.structured({ ...status, tools });
  }

  /**
   * Registers every tool with the McpServer registry
   *
   * Each call wires a tool definition from `McpTool` to its handler.
   * The SDK validates incoming arguments against the tool's `inputSchema`
   * and (when present) the tool's response against its `outputSchema`.
   *
   * @private
   */
  private registerAll(): void {
    this.server.registerTool('list', this.tool.list(), this.handleList.bind(this));
    this.server.registerTool('read', this.tool.read(), this.handleRead.bind(this));
    this.server.registerTool('search', this.tool.search(), this.handleSearch.bind(this));
    this.server.registerTool('status', this.tool.status(), this.handleStatus.bind(this));
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
   * Connects the MCP server to stdio transport with error handling
   *
   * @param {StdioServerTransport} transport - Stdio transport for MCP communication
   * @returns {Promise<void>}
   */
  async connect(transport: StdioServerTransport): Promise<void> {
    transport.onerror = () => { };
    await this.server.connect(transport);
  }
}
