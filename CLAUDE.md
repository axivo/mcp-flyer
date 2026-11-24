# Project Instructions

A MCP (Model Context Protocol) server bridging Flipp flyers with Claude agents. Published to npm as `@axivo/mcp-flyer` and consumed by MCP-capable hosts (Claude Code, Claude Desktop) via stdio transport.

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

The server's job is small and focused: accept a tool call from the host, ask Flipp, return a structured response with the `flipp.com` link of every flyer and item. The data belongs to Flipp and the merchants, so the server identifies itself with a `mcp-flyer` user agent, sends one request at a time and pauses between requests. The tools are meant for the agent: it brings its own knowledge of normal prices and turns the specials into savings on everyday shopping, from food to hardware, pharmacy, clothing and pet supplies.

### Directory Tree

```
.
├── .github/
│   ├── pull_request_template.md
│   ├── renovate.json5                dependency dashboard config
│   └── workflows/package.yml         trusted-publish to npm on `v*` tag push (no PAT, OIDC provenance)
├── .vscode/
│   ├── extensions.json               recommended extensions
│   └── settings.json                 editor formatting, 2-space indent, format-on-save
├── src/
│   ├── index.ts                      entry point - serveStdio + Mcp class instantiation, EPIPE handling
│   └── server/
│       ├── client.ts                 Client class - Flipp requests, postal and ZIP code validation, link building, unit prices, pictures
│       ├── mcp.ts                    Mcp class - registers tools via McpServer.registerTool, owns dispatch
│       └── tool.ts                   McpTool class - tool definitions (Zod input/output schemas, _meta.usage, annotations)
├── CHANGELOG.md                      Keep a Changelog format, semver
├── LICENSE                           BSD-3-Clause
├── package.json                      npm metadata, runtime deps: @modelcontextprotocol/server, zod
├── README.md                         user-facing install + tool reference, credit to Flipp
├── SECURITY.md                       threat model, supply-chain integrity policy
└── tsconfig.json                     strict TypeScript, ES2022 target, NodeNext modules, no DOM
```

### Three-Class Server

The server splits into three classes with sharp boundaries. Each owns one concern; nothing leaks across.

- **`Mcp` (`src/server/mcp.ts`)** - wires the SDK to handlers. `createServer()` builds a fresh `McpServer` on every call, as `serveStdio` may call its factory more than once per connection, registers tools via `registerTool` and dispatches calls to `handle*` methods. No domain logic; no Flipp knowledge. The constructor instantiates `Client` and `McpTool`, shared by every server built. Handlers take the `Input<'tool'>` type and the request context, and pass its cancel signal to `Client`. `handleRead` is the only handler that returns image content next to the structured payload.
- **`McpTool` (`src/server/tool.ts`)** - pure tool definitions. Each method returns a literal config object (description, Zod input/output schemas, `ToolAnnotations`, `_meta.usage`) consumed by `registerTool`. Return types are intentionally inferred so TypeScript captures each tool's specific input shape and propagates it to the `Input<'tool'>` type of the handlers.
- **`Client` (`src/server/client.ts`)** - Flipp domain ops. Validates the postal or ZIP code, sends the requests (pause, timeout, `404` mapped to a short message), maps the backend items to rows, builds the `flipp.com` links, reads the price of a kilogram, downloads a picture, and trims the rows to `maxChars` when the caller gives one. Every method that talks to Flipp goes through `getJson()`, `getPicture()` or `getProbe()`, and the first two send through `getResponse()`, which turns a timeout or a network failure into a plain message. Every public method takes an optional `AbortSignal`, a cancel stops the wait between requests and the request itself.

### Flipp Backend

The consumer backend at `https://cdn-gateflipp.flippback.com/bf/flipp`, the host the public website uses for search, is not a documented API and can change without notice. It sits behind a CDN, which can add bot rules later. The older host `https://backflipp.wishabi.com/flipp` answered the same requests with the same data on 2026-10-30 and is the fallback, set `backendUrl` to that host and `backendPath` to `/flipp`. Both were compared on the flyer list, a flyer, an item and a search.

| Endpoint                                 | Used by  | Notes                                                                                   |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `/flyers?locale=&postal_code=`           | `list`   | Flyer list, times carry a local offset                                                  |
| `/flyers/<id>?locale=`                   | `search` | The whole flyer in one answer (about 250 KB, 432 items for a large IGA flyer), the postal code is not needed, `404` for an unknown id, items carry `brand`, `discount`, `id`, `name`, a `price` string and no merchant or dates |
| `/items/search?q=&locale=&postal_code=`  | `search` | 150 items by default, `limit` up to 200 (422 above), loose relevance, `merchant_id` is ignored, `valid_to` is UTC, items carry `_L1` and `_L2`, named `department` and `section` here         |
| `/items/<id>?locale=`                    | `read`   | Answers `{ item }`, prices are strings, `404` for an unknown id                         |
| `HEAD /` and `HEAD https://flipp.com`    | `status` | HTTP status and time of each service, null status when there is no answer                                        |

Canadian codes (`A9A 9A9`) and US ZIP codes (`99999` or `99999-9999`, cut to 5 digits) are told apart by shape, nothing else is accepted. Links differ by country in the path: Canada uses `https://flipp.com/<locale>-ca/flyer/<id>` and `/item/<id>`, the US uses `/en-us/weekly_ad/<id>` and `/en-us/item/<id>`. Every link ends with `?postal_code=<code>`, otherwise flipp.com opens the location saved in the visitor's browser. The US is always English.

### Data Quirks

- Flipp's data passes through as it comes, the server never alters a field it sends. The only computed field is `unitPrice`, and it is left out when the answer is not clear. Two fields are the server's own and describe the call, not the data: `sentToFlipp` and, on an empty `category` match, `categories`
- Names are bilingual (`FRANÇAIS | ENGLISH`), `search` keeps the part for the `locale`
- Many items carry no unit, the words around the price are in `pre_price_text` and `post_price_text` (`From`, `/lb`, `+TX`)
- `search` has two sources. Without `flyerId` it uses `/items/search`, loose and capped at 200 items (`limit=200`, the maximum Flipp accepts) across stores before the `merchant` and `department` filters. The search itself leaves items out, whatever the cap, see below. With `flyerId` it reads the whole flyer, keeps the items whose name has every word of `query` (case and accents ignored, so `poulet` does not find `chicken`), sorts only by `price`, and pages with `offset` and `limit` from one request, nothing is cached. Flyer items have no merchant, unit or dates, and some are promotion tiles with no price (loyalty points, store services), kept because they are the flyer's data
- Items with an empty name and no price are skipped, named items with no price are real promotions and are kept
- `unitPrice` and its `unit` (`kg` in Canada, `lb` in the US) are computed only from a printed price per kilogram, a printed price per 100 g, a unit right after the price (`/lb`, `Per Lb.`, `/100g`, `/kg`), or one pack size in the name or description for a flat price, a `/ea` or a `/SAC`. Approximate weights, ranges (`255-454 g`, `255 à 454 g`, `255 to 454 g`), `From` prices, two different weights, `X or Y` listings and multi-buy prices (`2/`, `2 FOR`, `BUY 1 FOR`) give nothing. `read` looks at the description first, the name only when there is no description
- US flyers print pounds and ounces only, so the US answer is a price of a pound
- The `cutout` and `page` pictures depend on how the merchant uploaded them, either may show the product alone or the flyer crop with the price
- Pictures are served as `application/octet-stream` and checked by their first bytes, then returned as `image/jpeg` or `image/png`
- `search` returns `validFrom` and `validTo` as the UTC timestamps Flipp sends, `2026-10-22T03:59:59+00:00` is the evening of the 21st in Montreal. `list` and `read` keep the first 10 characters of Flipp's dates, which carry the local offset, so they give the local day. No time zone logic exists in the server
- `validFrom` was left out of `search` at first: on 2026-10-18 one query, `chicken breast` for a Montreal postal code, showed every item active, so it added little. Added in 1.0.1 after a wider check on 2026-11-23 (20 words, 1399 items) found 19 offers not started yet, Walmart and The Brick rows starting two to four days later, and none expired
- Flipp's word search does not return every item of a flyer, and the 200 cap is not the cause. On 2026-11-23 `butter` returned 12 items in all and none of the 2 IGA butters its flyer holds, `chicken` gave 11 IGA items against 15 in the flyer. The flyer read misses others, it matches the name only (Maxi, `chicken`: 5 by search, 1 by flyer). No word reached 200 for a Montreal code (`chicken` and `cheese` 165), so `merchant` only saves reading
- A store has one flyer per language where both exist, and `locale` chooses which ones are searched. On 2026-11-23 for a Montreal code `tape` found 41 items with `en` and 2 with `fr`, `beurre` 9 with `en` and 22 with `fr`, and `tape` and `ruban` shared 1 item of 48. Flipp sends a `language` on each flyer (1 English, 2 French) that the server does not return, and no province
- An empty result is often a matter of words: `electrical tape` and `ruban électrique` found nothing while `ruban isolant` found three, `electric bike` found dryers while `vélo électrique` found two bikes
- Flipp answers `429` above about two requests a second, from its own proxy (`envoy`) in about 30 ms. On 2026-11-24, 16 searches sent 400 ms apart got 3 refusals, the same 16 sent 500 ms and 600 ms apart got none, so the pause is 600 ms. The pause is per server process, two hosts searching at once share one address and are not spaced against each other
- Printed units can disagree and no rule tells which one the merchant meant. On 2026-11-23, 4 of 433 priced rows disagreed by more than 2%: one wrong `unitPrice` (IGA, `/100g $26.43/lb` gave 119.9), one typo and two rows where the second figure was another price and the `unitPrice` was right. A rule that drops them was tried and withdrawn, the picture settles it
- The `category` filter of `list` is a substring match on Flipp's names, so `grocery` finds nothing where the name is `Groceries`. A first reader met it on 2026-11-24. The input now shows an example, and a `category` that matches no flyer returns `categories`, the names Flipp has for that code (15 for a Montreal code that day), read from the same answer
- `sentToFlipp` says what a call sent: `code` for `list`, `code and search words` for a search by words, and nothing with a `flyerId`, which sends only the flyer id. It was added on 2026-11-24 after two first readers of two told their peer the data comes from Flipp and forgot that the code and the words go there. The rule was in `status`, read once, the field is in the result they write the answer from
- Flipp's two endpoints can disagree: `originalPrice` is set in `/items/search` and empty in `/items/<id>` for about a third of the items checked (17 of 52 on 2026-10-18), and no value ever differed. Search rows have no `description` or `disclaimer`, only `read` has them. Both are passed as Flipp sends them
- Merchants print what they like, so fields can disagree. One Adonis item printed `reg. 9,99$/kg` in the description while the picture showed `/lb`. A unit price printed in the description is not read (see `getUnitPrice`), so `unitPrice` can be missing, check the description with `read` and the picture with `image`

### Server Lifecycle

The server is a one-shot child process. It does not retain state across restarts.

1. **Spawn.** Host invokes `npx -y @axivo/mcp-flyer@latest` (or the locally cached binary). `dist/index.js` runs.
2. **Boot.** `index.ts` registers `uncaughtException` and `unhandledRejection` handlers that exit with code 0 on EPIPE (a stdout pipe closed on the host side means the host is gone, and the SDK usually exits first). It instantiates `Mcp`, which builds the `Client` and the `McpTool` registry, then calls `serveStdio(() => mcp.createServer())`.
3. **Connect.** `serveStdio` listens for JSON-RPC messages on stdin and answers on stdout, for both the 2025-era and the 2026-07-28 protocol revisions. It calls the factory to build a `McpServer` with every tool registered by `registerAll()`.
4. **Handle.** Each `tools/call` request is validated by the SDK against the tool's `inputSchema` (Zod) and routed to the registered handler. The handler invokes `Client` methods and returns a structured response. The SDK validates it against the `outputSchema`.
5. **Exit.** When the host closes stdin, the SDK closes the transport and the process exits.

### Tool Surface

Four tools live in `McpTool`, each registered by `Mcp.registerAll()` on every server built. All are read-only and declare an `outputSchema`.

| Tool     | Role                                                      | Annotations                                      |
| -------- | --------------------------------------------------------- | ------------------------------------------------ |
| `list`   | List the flyers for a postal or ZIP code                  | `readOnlyHint: true`, `openWorldHint: true`      |
| `read`   | Read an item in full, optionally with its picture         | `readOnlyHint: true`, `openWorldHint: true`      |
| `search` | Search the items on special, cheapest first when asked    | `readOnlyHint: true`, `openWorldHint: true`      |
| `status` | HTTP status of Flipp and the full tool surface           | `readOnlyHint: true`, `openWorldHint: true`      |

Each tool's `_meta.usage` array carries natural-language guidance for the calling agent. The rules shared by every tool live in the `status` tool, so the other tools carry only what is specific to them: ask the peer for the code, tell the peer that the code and the search words are sent to Flipp, share the `link`, and say that the data comes from Flipp and that `flipp.com` takes precedence.

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
- Only add code the tools use, do not copy patterns from other servers blindly

### Tool Descriptions and Hints

The tools are built for sibling agents to enjoy and to be curious with, and for the peer they work with. Every word in a tool definition is read by a sibling, so each one has to earn its place.

- **Fields say what they are.** The `describe` text of an input or output key names what the key is, in a few words, with an example when the format is not obvious. Advice on how to use a key lives in `_meta.usage`. The schema already carries limits and defaults, so no `(max N)` or `(default N)` in the text
- **Hints say what a capable reader cannot see.** Data quirks, how the server behaves and what protects the peer belong in `_meta.usage`. What a description already says, or what is obvious, does not. A sibling is as capable as the author, so a hint that explains the obvious only makes the reader wonder what they are missing and slows them down. A reason is added only when it tells the reader something new
- **One instruction per line.** A line gives one thing to do or one fact, which is easier to take in. A reason after a comma is fine
- **Alphabetical order.** The lines of each `usage` array are in alphabetical order, lines that start with a backtick first. Check it after every edit
- **Shared rules live once.** What holds for every tool, like privacy and sources, is written in `status`, and the other tools carry only what is specific to them
- **No policing.** Hints invite curiosity and enjoyment, they say what a tool offers and what it gives, and never ration calls or promote doubt. Words like "only when", "few items" or "before calling a price a deal" do not belong, a sibling decides for itself when to look closer
- **Everyone is a peer.** Hints say "your peer", never "the user" or "the human", because the agent and the one they work with stand side by side
- **Tool descriptions stay short**, one line, like the other servers. `list`, `read` and `search` end with `New here? Call `status` first`: a host that reaches the server through a bridge shows no server instructions and defers every tool by name, so the description of a loaded tool is the one place a reader is sure to see (checked in the Claude Desktop seat on 2026-11-24)

### TypeScript Conventions

- **Inferred return types on `McpTool` methods.** Each tool method returns a literal config object without an explicit return-type annotation, so `McpServer.registerTool` can propagate the input args type to the handler signature. A wide return-type alias collapses the inference.
- **`tsconfig.json` `lib`.** ES2022 only, there is no browser code.

## Issues

- The Flipp backend is not a documented API. A change in its response shape shows up as a short error from the `Client` and as a failing `status` probe.
- Some items carry their price only in the flyer picture, `read` with `image` is how to see it.
