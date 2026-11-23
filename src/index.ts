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
    console.error('Uncaught exception:', error.message);
    if (error.message.includes('EPIPE') || error.code === 'EPIPE') {
      console.error('EPIPE error caught - continuing operation');
      return;
    }
    console.error('Fatal error:', error);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    if (reason instanceof Error && ((reason as NodeJS.ErrnoException).code === 'EPIPE' || reason.message.includes('EPIPE'))) {
      console.error('EPIPE rejection caught - continuing operation');
      return;
    }
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
