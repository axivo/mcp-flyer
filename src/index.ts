#!/usr/bin/env node
/**
 * Flyer MCP Server Entry Point
 *
 * Main entry point for the Flyer MCP server application. Handles
 * server initialization and stdio serving.
 *
 * @module index
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { Mcp } from './server/mcp.js';

/**
 * Main entry point for the Flyer MCP Server
 *
 * Builds the MCP server wrapper and serves it over stdio for both the
 * 2025-era and the 2026-07-28 protocol revisions.
 *
 * @function main
 * @throws {Error} When server initialization fails
 */
function main(): void {
  process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
    if (error.message.includes('EPIPE') || error.code === 'EPIPE') {
      process.exit(0);
    }
    console.error('Fatal error:', error);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    if (reason instanceof Error && ((reason as NodeJS.ErrnoException).code === 'EPIPE' || reason.message.includes('EPIPE'))) {
      process.exit(0);
    }
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
  });
  const mcp = new Mcp();
  serveStdio(() => mcp.createServer());
}

try {
  main();
} catch (error) {
  console.error('Fatal error in main():', error);
  process.exit(1);
}
