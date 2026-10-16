# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.x     | ✅        |

## Reporting a Vulnerability

To report a security vulnerability, please use [GitHub's private vulnerability reporting](https://github.com/axivo/mcp-flyer/security/advisories/new).

Do not open a public issue for security vulnerabilities. You can expect an initial response within 48 hours and a resolution or status update within 7 days.

## Scope and Security Considerations

This package is a read-only MCP server that queries the public [Flipp](https://flipp.com) flyer backend over HTTPS. It needs no credentials, no API key, no browser and no special system permission. It does not execute commands, does not read or write files, and does not accept scripts or URLs from tool inputs.

The following threat vectors are in scope:

- Arbitrary code execution through MCP tool inputs
- Requests sent to hosts other than the Flipp backend, `flipp.com` and the Flipp picture host
- Prompt injection through flyer content returned to the MCP client
- Disclosure of the user's postal or ZIP code beyond the single request that needs it
- Supply chain compromise of published npm artifacts

### Data Sent to Flipp

Each `list`, `search` and `read` call sends the postal or ZIP code and, for `search`, the search words to `backflipp.wishabi.com`. The `status` tool sends two `HEAD` requests, one to the backend and one to `flipp.com`, with no user data. Requests carry a `mcp-flyer` user agent with the server version, are sent one at a time, and wait at least 400 milliseconds between them. The server asks the agent to tell the user that the code is sent to Flipp.

### Prompt Injection Through Flyer Content

Item names, descriptions, disclaimers and promotion texts are written by merchants and relayed unchanged to the MCP client. A malicious or compromised flyer could contain text that looks like an instruction to the agent. The server never acts on that text, it only returns it as data, so the risk sits with the MCP client and the agent. The tools are read-only, so such text cannot cause a write or a purchase through this server.

### Pictures

The `read` tool fetches one picture on request, from a URL given by the Flipp backend, and returns it to the MCP client as image content. The picture is held in memory only, never written to disk, and is accepted only when it is a JPEG or a PNG. The picture host is restricted to `wishabi.net`, so a flyer cannot point the server at another host.

### Transport Authentication

The MCP server communicates over stdio transport, it is spawned as a child process by the MCP client, not a listening socket. There is no authentication layer between the client and server. Whoever controls the MCP client configuration controls the server entirely, which here means the ability to query public flyers. Security depends on restricting write access to `mcp.json` and trusting the MCP client (e.g., Claude Desktop, Claude Code) to enforce tool call boundaries.

## Supply Chain Integrity

All releases are published to npm using [trusted publishing](https://docs.npmjs.com/generating-provenance-statements) with npm provenance attestation enabled. Each published version is cryptographically linked to a specific GitHub Actions workflow run and commit.

To verify the integrity of an installed version, run:

```bash
npm audit signatures @axivo/mcp-flyer
```
