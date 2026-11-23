# Flyer MCP Server

[![License: BSD 3-Clause](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg?style=flat&logo=opensourceinitiative&logoColor=white)](https://github.com/axivo/mcp-flyer/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@axivo/mcp-flyer.svg?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/package/@axivo/mcp-flyer)
[![Socket](https://badge.socket.dev/npm/package/@axivo/mcp-flyer)](https://socket.dev/npm/package/@axivo/mcp-flyer)
[![Node.js](https://img.shields.io/badge/Node.js->=24.0.0-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript->=6.0.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A MCP (Model Context Protocol) server for flyer deals and unit prices, powered by [Flipp](https://flipp.com).

> [!NOTE]
>
> This project is not affiliated with, endorsed by, or sponsored by Flipp Corporation. "Flipp" is a trademark of Flipp Corporation. All rights belong to their respective owners.

### Features

- **Weekly Specials**: Search the items on special for a Canadian postal code or a US ZIP code
- **Unit Prices**: Price of a kilogram (Canada) or of a pound (US) read from the unit or the pack size printed in the flyer, left out when not sure
- **Cheapest First**: Sort a search by unit price or by price
- **Flyer Listing**: Flyers published for an area, grocery or not (seasonal events included), with validity dates
- **Whole Flyer**: Every item of one flyer, in pages, or only the ones whose name has the words given
- **Item Detail**: Brand, size, regular price, savings and conditions of one item
- **Product Pictures**: Optional product image or flyer page, to see what the item looks like
- **Bilingual**: English and French names and links for Canada
- **Links Back to Flipp**: Every flyer and item carries its `flipp.com` link

### Data Source

All flyer data, links and pictures come from [Flipp](https://flipp.com). The prices and offers belong to the merchants who publish them, and `flipp.com` takes precedence when it differs from what the server returns.

The server sends one request at a time, waits between requests, and identifies itself with a `mcp-flyer` user agent. Nothing is stored: pictures are fetched on request and handed to the MCP client, and no flyer data is cached on disk. The postal or ZIP code and the search words you give are sent to Flipp.

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
- "_Which Walmart event flyers are valid for H2X 1Y4?_"
- "_Search for chicken breast near H2X 1Y4, cheapest per kilogram first_"
- "_Search for chicken breast near ZIP code 60601, cheapest first_"
- "_Search for electrical tape near H2X 1Y4, cheapest first_"
- "_Compare ground beef at IGA and Metro in H2X 1Y4_"
- "_Compare ground beef at Kroger in 30301_"
- "_What else is on special in the IGA flyer for H2X 1Y4? I need pantry items for a pasta dinner_"
- "_Is the picanha at Metro worth buying? Show me what it looks like_"
- "_Plan three dinners from this week's specials near 10001_"
- "_Search for eggs near 94105 and show me the cheapest dozen_"

> [!NOTE]
>
> The "use the `status` tool" instruction helps Claude pause and process the `_meta.usage` guidelines before searching.

### MCP Tools

Call `status` first at session start to get the state of the flyer services and the full tool surface. Every tool takes a Canadian postal code or a US ZIP code as `code`.

1. `list`
   - List the flyers for a postal or ZIP code
   - Required inputs:
     - `code` (string): Canadian postal code (e.g. `H3H 1A9`) or US ZIP code (e.g. `10001`)
   - Optional inputs:
     - `category` (string): Flyer categories to keep, comma separated
     - `limit` (number, default: 100): Maximum flyers returned
     - `locale` (string: `en` or `fr`, default: `en`): Language of flyer names and links
     - `maxChars` (number): Maximum characters of the returned flyers
     - `merchant` (string): Merchant names to keep
   - Returns: `{ code, count, country, flyers, locale, total, truncated }`

2. `read`
   - Read an item on special in full
   - Required inputs:
     - `code` (string): Canadian postal code or US ZIP code
     - `id` (number): Item id
   - Optional inputs:
     - `image` (string: `cutout` or `page`): Picture to return
     - `locale` (string: `en` or `fr`, default: `en`): Language of the links
   - Returns: `{ brand, description, disclaimer, dollarsOff, flyerId, flyerLink, id, image, link, merchant, merchantId, name, originalPrice, percentOff, postText, preText, price, saleStory, unit, unitPrice, validFrom, validTo }`

3. `search`
   - Search the items on special in every flyer for a postal or ZIP code, or inside one flyer
   - Required inputs:
     - `code` (string): Canadian postal code or US ZIP code
   - Optional inputs (`query` or `flyerId` required):
     - `department` (string): Product departments to keep, comma separated
     - `flyerId` (number): Flyer id to search inside
     - `limit` (number, default: 30): Maximum items returned
     - `locale` (string: `en` or `fr`, default: `en`): Language of the item names and links
     - `maxChars` (number): Maximum characters of the returned items
     - `merchant` (string): Merchant names to keep
     - `offset` (number, default: 0): Items to skip
     - `query` (string): Words to search (e.g. `chicken breast`, `electrical tape`)
     - `sort` (string: `price` or `unit`): Cheapest first by price or by unit price
   - Returns: `{ code, count, country, items, locale, offset, query, total, truncated }`

4. `status`
   - Get the flyer services status and the full tool surface with usage guidance
   - Returns: `{ backend, site, tools, version }`

### Limits

- A flyer is published in French or English, as chosen by the merchant, and is not translated
- A ZIP code always returns flyers in English, French applies to postal codes only
- The `unitPrice` is given only when the flyer prints a unit or one pack size, otherwise it is left out
- The MCP erver has no store locations, a flyer is for a chain and not for a branch
