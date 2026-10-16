# Flyer MCP Server

[![License: BSD 3-Clause](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg?style=flat&logo=opensourceinitiative&logoColor=white)](https://github.com/axivo/mcp-flyer/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@axivo/mcp-flyer.svg?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/package/@axivo/mcp-flyer)
[![Socket](https://badge.socket.dev/npm/package/@axivo/mcp-flyer)](https://socket.dev/npm/package/@axivo/mcp-flyer)
[![Node.js](https://img.shields.io/badge/Node.js->=24.0.0-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript->=6.0.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A MCP (Model Context Protocol) server for grocery flyer deals and unit prices, powered by [Flipp](https://flipp.com).

### Features

- **Weekly Specials**: Search the items on special for a Canadian postal code or a US ZIP code
- **Unit Prices**: Price of a kilogram (Canada) or of a pound (US) read from the unit or the pack size printed in the flyer, never guessed
- **Cheapest First**: Sort a search by unit price or by price
- **Flyer Listing**: Grocery flyers published for an area, with validity dates
- **Item Detail**: Brand, size, regular price, savings and conditions of one item
- **Product Pictures**: Optional product image or flyer page, to see what the item looks like
- **Bilingual**: English and French names and links for Canada
- **Links Back to Flipp**: Every flyer and item carries its `flipp.com` link

### Data Source

All flyer data, links and pictures come from [Flipp](https://flipp.com). This project is not affiliated with, endorsed by or sponsored by Flipp. The prices and offers belong to the merchants who publish them, and `flipp.com` takes precedence when it differs from what the server returns.

The server sends one request at a time, waits between requests, and identifies itself with a `mcp-flyer` user agent. Nothing is stored: pictures are fetched on request and handed to the MCP client, and no flyer data is cached on disk. The postal or ZIP code and the search words you give are sent to Flipp.

### Prerequisites

- Network access to `backflipp.wishabi.com` (flyer data), `flipp.com` (status check) and `f.wishabi.net` (pictures)

### MCP Server Configuration

Add to `mcp.json` servers configuration:

```json
{
  "mcpServers": {
    "flyer": {
      "command": "npx",
      "args": ["-y", "@axivo/mcp-flyer"]
    }
  }
}
```

There are no environment variables.

### Prompt Examples

- "_Use the `flyer` MCP server `status` tool for usage guidelines_"
- "_Which grocery flyers are valid for H2X 1Y4?_"
- "_Which grocery flyers are valid for ZIP code 10001?_"
- "_Search for chicken breast near H2X 1Y4, cheapest per kilogram first_"
- "_Search for chicken breast near ZIP code 60601, cheapest first_"
- "_Compare ground beef at IGA and Metro in H2X 1Y4_"
- "_Compare ground beef at Kroger in 30301_"
- "_Is the picanha at Metro worth buying? Show me what it looks like_"
- "_Plan three dinners from this week's specials near 10001_"
- "_Search for eggs near 94105 and show me the cheapest dozen_"

> [!NOTE]
>
> The "use the `status` tool" instruction helps Claude pause and process the `_meta.usage` guidelines before searching.

### MCP Tools

Call `status` first at session start to get the state of the flyer services and the full tool surface. Every tool takes a Canadian postal code or a US ZIP code as `code`, and the server asks for it instead of guessing.

1. `list`
   - List the grocery flyers for a postal or ZIP code
   - Required inputs:
     - `code` (string): Canadian postal code (e.g. `H3H 1A9`) or US ZIP code (e.g. `10001`), the space is optional
   - Optional inputs:
     - `grocery` (boolean, default: true): Only grocery flyers, `false` includes pharmacy, hardware and other flyers
     - `limit` (number, default: 100): Maximum flyers returned (max 200)
     - `locale` (string: `en` or `fr`, default: `en`): Language of flyer names and links, `fr` applies to Canada only
     - `merchant` (string): Merchant names to keep, comma separated, matched as case-insensitive substrings (e.g. `IGA,Metro`)
   - Returns: `{ code, count, country, flyers, locale, total, truncated }`, each flyer with `availableFrom`, `availableTo`, `categories`, `id`, `link`, `merchant`, `name`, `updatedAt`, `validFrom`, `validTo`

2. `read`
   - Read an item on special in full
   - Required inputs:
     - `code` (string): Canadian postal code or US ZIP code
     - `id` (number): Item id, from a `search` result
   - Optional inputs:
     - `image` (string: `cutout` or `page`): Also return a picture, `cutout` is the product alone and `page` is the flyer page around it
     - `locale` (string: `en` or `fr`, default: `en`): Language of the links
   - Returns: `{ brand, description, disclaimer, dollarsOff, flyerId, flyerLink, id, image, link, merchant, name, originalPrice, percentOff, postText, preText, price, saleStory, unit, unitPrice, validFrom, validTo }`, plus the picture as image content when `image` is set

3. `search`
   - Search the items on special for a postal or ZIP code
   - Required inputs:
     - `code` (string): Canadian postal code or US ZIP code
     - `query` (string): Words to search, in English or French (e.g. `chicken breast`, `poulet`)
   - Optional inputs:
     - `limit` (number, default: 30): Maximum items returned (max 150)
     - `locale` (string: `en` or `fr`, default: `en`): Language of names and links, `fr` applies to Canada only
     - `merchant` (string): Merchant names to keep, comma separated, matched as case-insensitive substrings
     - `sort` (string: `price` or `unit`): Cheapest first by price or by unit price (kilogram in Canada, pound in the US), items with nothing to compare come last
   - Returns: `{ code, count, country, items, locale, query, total, truncated }`, each item with `id`, `link`, `merchant`, `name`, `originalPrice`, `postText`, `preText`, `price`, `saleStory`, `unit`, `unitPrice`, `validTo`

4. `status`
   - Get the status of the flyer services and the full tool surface with usage guidance
   - Returns: `{ backend, site, tools, version }`, each with its HTTP `status` (null when there was no answer) and response time in `ms`

### Limits

- Search matches are loose, a search for chicken also returns pies and hot dogs, so the agent picks the relevant items
- `unitPrice` is the price of one `unit` (`kg` in Canada, `lb` in the US), and is absent when the flyer prints no unit and no pack size, when it prints two different weights, when the price is for several packs or for several products, and the agent must not assume one
- The server has no store locations, a flyer is for a chain and not for a branch
- A flyer printed in one language keeps it, `locale` only chooses between two languages when both are printed
- Some items carry their price only in the flyer picture, `read` with `image` shows it
- The US forces English, `fr` applies to Canada only
