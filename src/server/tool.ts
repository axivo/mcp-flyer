/**
 * MCP Tool Definitions for Flyer Integration
 *
 * @module server/tool
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { z } from 'zod';
import { Client } from './client.js';

/**
 * Reusable Zod schema for a status check
 */
const probeShape = {
  ms: z.number().describe('Time to answer in milliseconds'),
  status: z.number().nullable().describe('HTTP status, null when there was no answer')
};

/**
 * MCP tool definitions for the grocery flyers
 *
 * Each method returns an inline literal config object passed to
 * `McpServer.registerTool`. Return types are inferred so each tool's input
 * shape propagates to its handler.
 *
 * @class McpTool
 */
export class McpTool {
  /**
   * Creates MCP tool for listing the flyers of a postal code
   *
   * Sends one request to the flyer backend and returns the flyers published
   * for the area, each with its flipp.com link.
   */
  list() {
    return {
      description: 'List the grocery flyers for a postal or ZIP code',
      inputSchema: {
        code: z.string().describe('Canadian postal code (e.g. `H3H 1A9`) or US ZIP code (e.g. `10001`), the space is optional'),
        grocery: z.boolean().default(true).describe('Only grocery flyers, set `false` to include pharmacy, hardware and other flyers'),
        limit: z.number().int().positive().max(200).default(100).describe('Maximum flyers returned (max 200)'),
        locale: z.enum(Client.locales).default('en').describe('Language of flyer names and links, `fr` applies to Canada only'),
        merchant: z.string().optional().describe('Merchant names to keep, comma separated, matched as case-insensitive substrings (e.g. `IGA,Metro`)')
      },
      outputSchema: {
        code: z.string().describe('Normalized postal or ZIP code sent to the backend'),
        count: z.number().describe('Flyers returned'),
        country: z.enum(['ca', 'us']).describe('Country of the postal code'),
        flyers: z.array(z.object({
          availableFrom: z.string().describe('First day the flyer is visible on flipp.com, YYYY-MM-DD, often before `validFrom`'),
          availableTo: z.string().describe('Last day the flyer is visible on flipp.com, YYYY-MM-DD'),
          categories: z.array(z.string()).describe('Flipp categories of the flyer'),
          id: z.number().describe('Flyer id'),
          link: z.string().describe('Link of the flyer on flipp.com'),
          merchant: z.string().describe('Merchant name'),
          merchantId: z.number().describe('Flipp merchant id, stable for a chain, 0 when unknown'),
          name: z.string().describe('Flyer name'),
          updatedAt: z.string().describe('When Flipp last updated the flyer, ISO timestamp'),
          validFrom: z.string().describe('First valid day, YYYY-MM-DD'),
          validTo: z.string().describe('Last valid day, YYYY-MM-DD')
        })).describe('Flyers, sorted by merchant'),
        locale: z.enum(Client.locales).describe('Language used'),
        total: z.number().describe('Flyers matching the filters before `limit`'),
        truncated: z.boolean().describe('True when `limit` or the response size cap left flyers out')
      },
      annotations: {
        title: 'List',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Use `search` to find the items on special, this lists the flyers only',
          'Use `merchant` to narrow the list instead of asking for more than needed'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for reading one item on special in full
   *
   * Sends one request to the flyer backend and returns the item with its size,
   * unit price and regular price when the flyer gives them.
   */
  read() {
    return {
      description: 'Read an item on special in full',
      inputSchema: {
        code: z.string().describe('Canadian postal code (e.g. `H3H 1A9`) or US ZIP code (e.g. `10001`), the space is optional'),
        id: z.number().int().positive().describe('Item id, from a `search` result'),
        image: z.enum(Client.images).optional().describe('Also return a picture: `cutout` is the product alone, `page` is the flyer page around it'),
        locale: z.enum(Client.locales).default('en').describe('Language of the links, `fr` applies to Canada only')
      },
      outputSchema: {
        brand: z.string().optional().describe('Brand, when the flyer gives one'),
        description: z.string().optional().describe('Size, unit price and regular price as printed in the flyer, lines separated by new lines'),
        disclaimer: z.string().optional().describe('Conditions or limits of the offer'),
        dollarsOff: z.number().optional().describe('Amount saved, when Flipp computes it'),
        flyerId: z.number().describe('Id of the flyer the item is in'),
        flyerLink: z.string().describe('Link of the flyer on flipp.com'),
        id: z.number().describe('Item id'),
        image: z.enum(Client.images).optional().describe('Kind of picture sent with this result, when one was asked'),
        link: z.string().describe('Link of the item on flipp.com'),
        merchant: z.string().describe('Merchant name'),
        merchantId: z.number().describe('Flipp merchant id, stable for a chain, 0 when unknown'),
        name: z.string().describe('Full item name as printed in the flyer, in French and English when the flyer prints both'),
        originalPrice: z.number().nullable().describe('Regular price when the flyer gives it, otherwise null'),
        percentOff: z.number().optional().describe('Percent saved, when Flipp computes it'),
        postText: z.string().optional().describe('Text printed after the price, like `/lb $39.66/kg`'),
        preText: z.string().optional().describe('Text printed before the price, like `From`'),
        price: z.number().nullable().describe('Special price, null when the flyer gives none'),
        saleStory: z.string().optional().describe('Promotion text of the flyer'),
        unit: z.enum(['kg', 'lb']).optional().describe('Weight of `unitPrice`, `kg` in Canada and `lb` in the US'),
        unitPrice: z.number().optional().describe('Price of one `unit`, absent when the unit is not sure'),
        validFrom: z.string().describe('First valid day, YYYY-MM-DD'),
        validTo: z.string().describe('Last valid day, YYYY-MM-DD')
      },
      annotations: {
        title: 'Read',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Use after `search` on the few items worth a closer look, each call is one request to Flipp',
          'Read `description` for the pack size and the regular price before calling a price a deal',
          'Without `postText` the unit of `price` is not known, check `description` or use `image`',
          '`price` is null when the flyer gives none, see `saleStory` for offers like buy one get one',
          'Use `image` only when seeing the item helps the choice'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for searching the items on special
   *
   * Sends one request to the flyer backend and returns the items on special
   * matching the search words, each with its flipp.com link.
   */
  search() {
    return {
      description: 'Search the items on special for a postal or ZIP code',
      inputSchema: {
        code: z.string().describe('Canadian postal code (e.g. `H3H 1A9`) or US ZIP code (e.g. `10001`), the space is optional'),
        limit: z.number().int().positive().max(150).default(30).describe('Maximum items returned (max 150)'),
        locale: z.enum(Client.locales).default('en').describe('Language of the item names and links, `fr` applies to Canada only, a flyer printed in one language keeps it'),
        merchant: z.string().optional().describe('Merchant names to keep, comma separated, matched as case-insensitive substrings (e.g. `IGA,Metro`)'),
        query: z.string().min(1).describe('Words to search, in English or French (e.g. `chicken breast`, `poulet`)'),
        sort: z.enum(Client.sorts).optional().describe('Cheapest first by `price` or by `unit` price (kilogram in Canada, pound in the US), items with nothing to compare come last')
      },
      outputSchema: {
        code: z.string().describe('Normalized postal or ZIP code sent to the backend'),
        count: z.number().describe('Items returned'),
        country: z.enum(['ca', 'us']).describe('Country of the postal code'),
        items: z.array(z.object({
          id: z.number().describe('Item id'),
          link: z.string().describe('Link of the item on flipp.com'),
          merchant: z.string().describe('Merchant name'),
          merchantId: z.number().describe('Flipp merchant id, stable for a chain, 0 when unknown'),
          name: z.string().describe('Item name as printed in the flyer, in the language of `locale` when the flyer prints both'),
          originalPrice: z.number().nullable().describe('Regular price when the flyer gives it, otherwise null'),
          postText: z.string().optional().describe('Text printed after the price, like `/lb` or `+TX`'),
          preText: z.string().optional().describe('Text printed before the price, like `From`'),
          price: z.number().nullable().describe('Special price, null when the flyer gives none'),
          saleStory: z.string().optional().describe('Promotion text of the flyer'),
          unit: z.enum(['kg', 'lb']).optional().describe('Weight of `unitPrice`, `kg` in Canada and `lb` in the US'),
          unitPrice: z.number().optional().describe('Price of one `unit`, absent when the unit is not sure'),
          validTo: z.string().describe('End of the offer, ISO timestamp in UTC, `read` gives the local day, which can be one day earlier')
        })).describe('Items, best match first'),
        locale: z.enum(Client.locales).describe('Language used'),
        query: z.string().describe('Search words used'),
        total: z.number().describe('Items matching the filters before `limit`'),
        truncated: z.boolean().describe('True when `limit` or the response size cap left items out')
      },
      annotations: {
        title: 'Search',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Matches are loose, pick the relevant items and ignore other kinds of merchants like liquor stores',
          'Use `sort: "unit"` and `unitPrice` to compare, an item without it has no known unit',
          'Use `read` on the few items worth a closer look, for the pack size and the picture',
          '`validTo` is in UTC, an offer ending at 03:59 UTC ends the evening before in Montréal',
          'Use `merchant` to narrow the search instead of asking for more than needed'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for environment introspection
   *
   * Returns the HTTP status of flipp.com and of the flyer backend, the server
   * version, and the full set of available tools with their schemas,
   * annotations, and `_meta.usage` arrays. Use at session start to learn the
   * surface, the rules, and whether the services answer.
   */
  status() {
    return {
      description: 'Get the status of the flyer services and the full tool surface with usage guidance',
      outputSchema: {
        backend: z.object(probeShape).describe('Flyer backend, the source of the data'),
        site: z.object(probeShape).describe('flipp.com, the website the links open'),
        tools: z.array(z.object({
          name: z.string(),
          description: z.string(),
          inputSchema: z.unknown().optional(),
          outputSchema: z.unknown().optional(),
          annotations: z.unknown().optional(),
          usage: z.array(z.string()).optional()
        })).describe('All available tools with their schemas and usage guidance'),
        version: z.string().describe('Server version')
      },
      annotations: {
        title: 'Status',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Call once at session start to learn the tool surface and whether Flipp answers',
          'Each tool entry includes its `usage` array of natural-language hints',
          'Ask the user for the postal or ZIP code first, never guess it',
          'Tell the user that the code and any search words are sent to Flipp',
          'Always give the user the `link` of a flyer or item, so they can open the source on flipp.com',
          'Tell the user the data comes from Flipp and that the flyer on flipp.com takes precedence over it'
        ]
      }
    };
  }
}
