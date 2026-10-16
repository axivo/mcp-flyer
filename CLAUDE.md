# Project Instructions

A MCP (Model Context Protocol) server bridging Flipp grocery flyers with Claude agents. Published to npm as `@axivo/mcp-flyer` and consumed by MCP-capable hosts (Claude Code, Claude Desktop) via stdio transport.

## Collaborator

- **Name:** Floren Munteanu
- **Work:** Engineering

### Personal Preferences

I'm a site reliability engineer specialized in:

- Advanced GitHub actions based on JS code
- Helm charts
- IaC for Kubernetes clusters
- Next.js/Nextra static websites

## Architecture

A small TypeScript server that translates MCP tool calls into requests to the public Flipp flyer backend. There is no daemon, no listening socket, no HTTP server - the host (e.g., Claude Desktop) spawns the server as a child process, communicates over stdio, and tears it down when the host exits. The server holds no credentials and no state, nothing is written to disk, and every call is one request or two (the second one for a picture).

The server's job is small and focused: accept a tool call from the host, ask Flipp, return a structured response with the `flipp.com` link of every flyer and item. The data belongs to Flipp and the merchants, so the server identifies itself with a `mcp-flyer` user agent, sends one request at a time and pauses between requests. The tools are meant for the agent: it brings its own knowledge of normal prices and turns the specials into cheap, low-waste cooking.

### Directory Tree

```
.
├── package.json                          npm metadata, runtime deps: @modelcontextprotocol/sdk, zod
├── tsconfig.json                         strict TypeScript, ES2022 target, NodeNext modules, no DOM
├── CHANGELOG.md                          Keep a Changelog format, semver
├── README.md                             user-facing install + tool reference, credit to Flipp
├── SECURITY.md                           threat model, supply-chain integrity policy
├── LICENSE                               BSD-3-Clause
├── .github/
│   ├── workflows/package.yml             trusted-publish to npm on `v*` tag push (no PAT, OIDC provenance)
│   ├── renovate.json5                    dependency dashboard config
│   └── pull_request_template.md
├── .vscode/
│   ├── settings.json                     editor formatting, 2-space indent, format-on-save
│   └── extensions.json                   recommended extensions
└── src/
    ├── index.ts                          entry point - stdio transport + Mcp class instantiation, EPIPE handling
    └── server/
        ├── mcp.ts                        Mcp class - registers tools via McpServer.registerTool, owns dispatch
        ├── tool.ts                       McpTool class - tool definitions (Zod input/output schemas, _meta.usage, annotations)
        └── client.ts                     Client class - Flipp requests, postal and ZIP code validation, link building, unit prices, pictures
```

### Three-Class Server

The server splits into three classes with sharp boundaries. Each owns one concern; nothing leaks across.

- **`Mcp` (`src/server/mcp.ts`)** - wires the SDK to handlers. Owns the `McpServer` instance, registers tools via `registerTool`, dispatches calls to `handle*` methods. No domain logic; no Flipp knowledge. The constructor instantiates `Client` and `McpTool`, then calls `registerAll()` once. `handleRead` is the only handler that returns image content next to the structured payload.
- **`McpTool` (`src/server/tool.ts`)** - pure tool definitions. Each method returns a literal config object (description, Zod input/output schemas, `ToolAnnotations`, `_meta.usage`) consumed by `registerTool`. Return types are intentionally inferred so TypeScript captures each tool's specific input shape and propagates it to handler signatures.
- **`Client` (`src/server/client.ts`)** - Flipp domain ops. Validates the postal or ZIP code, sends the requests (pause, timeout, `404` mapped to a short message), maps the backend items to rows, builds the `flipp.com` links, reads the price of a kilogram, downloads a picture, and caps the response size. Every method that talks to Flipp goes through `getJson()` or `getPicture()`.

### Flipp Backend

The consumer backend at `https://backflipp.wishabi.com/flipp`, discovered from the public website, is not a documented API and can change without notice.

| Endpoint                                 | Used by  | Notes                                                                                   |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `/flyers?locale=&postal_code=`           | `list`   | Flyer list, times carry a local offset                                                  |
| `/items/search?q=&locale=&postal_code=`  | `search` | At most 150 items, loose relevance, `merchant_id` is ignored, `valid_to` is UTC         |
| `/items/<id>?locale=`                    | `read`   | Answers `{ item }`, prices are strings, `404` for an unknown id                         |
| `HEAD /` and `HEAD https://flipp.com`    | `status` | HTTP status and time of each service, null status when there is no answer                                        |

Canadian codes (`A9A 9A9`) and US ZIP codes (`99999`) are told apart by shape, nothing else is accepted. Links differ by country: Canada uses `https://flipp.com/<locale>-ca/flyer/<id>` and `/item/<id>`, the US uses `/en-us/weekly_ad/<id>?postal_code=<zip>` and `/en-us/item/<id>?postal_code=<zip>`. The US is always English.

### Data Quirks

- Names are bilingual (`FRANÇAIS | ENGLISH`), `search` keeps the part for the `locale`
- Many items carry no unit, the words around the price are in `pre_price_text` and `post_price_text` (`From`, `/lb`, `+TX`)
- Items with an empty name and no price are skipped, named items with no price are real promotions and are kept
- `perKg` (Canada) and `perLb` (US) are computed only from a printed price per kilogram, a printed price per 100 g, a unit right after the price (`/lb`, `Per Lb.`, `/100g`, `/kg`), or one pack size in the name or description for a flat price, a `/ea` or a `/SAC`. Approximate weights, `From` prices, two different weights and multi-buy prices (`2/`, `2 FOR`, `BUY 1 FOR`) give nothing
- US flyers print pounds and ounces only, so the US answer is a price of a pound
- The `cutout` picture is the product alone for most merchants, but some merchants upload a flyer-style picture for it
- Pictures are served as `application/octet-stream` and checked by their first bytes, then returned as `image/jpeg` or `image/png`

### Server Lifecycle

The server is a one-shot child process. It does not retain state across restarts.

1. **Spawn.** Host invokes `npx @axivo/mcp-flyer` (or the locally cached binary). `dist/index.js` runs.
2. **Boot.** `index.ts` registers `uncaughtException` and `unhandledRejection` handlers that swallow EPIPE specifically (so a stdout pipe closing on the host side doesn't crash the server). It instantiates `Mcp`, which builds the underlying `McpServer`, the `Client`, and the `McpTool` registry, then calls `registerAll()` to wire each tool to its handler.
3. **Connect.** A `StdioServerTransport` is constructed and passed to `Mcp.connect()`, which delegates to `McpServer.connect()`. The server starts listening for JSON-RPC messages on stdin.
4. **Handle.** Each `tools/call` request is validated by the SDK against the tool's `inputSchema` (Zod) and routed to the registered handler. The handler invokes `Client` methods and returns a structured response. The SDK validates it against the `outputSchema`.
5. **Exit.** When the host closes stdin, the SDK closes the transport and the process exits.

### Tool Surface

Four tools live in `McpTool`, each registered once in `Mcp.registerAll()`. All are read-only and declare an `outputSchema`.

| Tool     | Role                                                      | Annotations                                      |
| -------- | --------------------------------------------------------- | ------------------------------------------------ |
| `list`   | List the grocery flyers for a postal or ZIP code          | `readOnlyHint: true`, `openWorldHint: true`      |
| `read`   | Read an item in full, optionally with its picture         | `readOnlyHint: true`, `openWorldHint: true`      |
| `search` | Search the items on special, cheapest first when asked    | `readOnlyHint: true`, `openWorldHint: true`      |
| `status` | HTTP status of Flipp and the full tool surface           | `readOnlyHint: true`, `openWorldHint: true`      |

Each tool's `_meta.usage` array carries natural-language guidance for the calling agent. The rules shared by every tool live in the `status` tool, so the other tools carry only what is specific to them: ask the user for the code and never guess it, tell the user that the code and the search words are sent to Flipp, always give the `link`, and say that the data comes from Flipp and that `flipp.com` takes precedence.

### Build and Publish

- **Build:** `npm run build` runs `tsc` against `tsconfig.json`. Outputs `dist/index.js` (the binary) and `dist/server/*.{js,d.ts}`. No bundler, no minifier.
- **Clean:** `npm run clean` deletes `dist/`.
- **Publish:** A `v*` tag pushed to `main` triggers `.github/workflows/package.yml`, which runs `npm ci`, `npm run build`, and `npm publish` under the `id-token: write` permission. npm trusted publishing produces a provenance attestation. No personal access token is involved. The first publish waits until Flipp has been informed and has replied.
- **Verify:** Users can run `npm audit signatures @axivo/mcp-flyer`.

### Configuration

There are no environment variables and no configuration file. The server runs out of the box.

## Coding Standards

- JSDoc module-level docblock on every file, `@param`/`@returns` on all methods
- No empty lines inside functions
- Braces on every `if`, `for` and `while`
- TypeScript strict mode, ES2022 target, NodeNext modules
- Alphabetical ordering for imports
- Top-of-file types in alphabetical order, none exported
- Class fields alphabetical, instance fields before static ones
- Class members in this order: constructor, private methods alphabetical, public methods alphabetical
- Values are read through `getX()` methods, and private statics are `private static readonly` in camelCase, no `SCREAMING_CASE` constants
- No `any` type unless documented why no narrower type works
- No non-null assertion operator (`!`)
- No em-dash characters in source
- Values that can grow, like the locales, come from a `static readonly` list and the type is derived from it
- Tool definitions in `McpTool` return inline literal config objects passed straight to `registerTool`, with inferred types
- Tool descriptions stay short, one line like the other servers
- Only add code the tools use, do not copy patterns from other servers blindly

### TypeScript Conventions

- **Inferred return types on `McpTool` methods.** Each tool method returns a literal config object without an explicit return-type annotation, so `McpServer.registerTool` can propagate the input args type to the handler signature. A wide return-type alias collapses the inference.
- **`tsconfig.json` `lib`.** ES2022 only, there is no browser code.

## Issues

- The Flipp backend is not a documented API. A change in its response shape shows up as a short error from the `Client` and as a failing `status` probe.
- Some items carry their price only in the flyer picture, `read` with `image` is how to see it.
