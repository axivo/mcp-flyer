/**
 * Flyer backend client
 *
 * @module server/client
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Country of a postal code, as used in flipp.com links
 */
type Country = 'ca' | 'us';

/**
 * A flyer as returned to the agent
 */
type FlyerRow = {
  availableFrom: string;
  availableTo: string;
  categories: string[];
  id: number;
  link: string;
  merchant: string;
  merchantId: number;
  name: string;
  updatedAt: string;
  validFrom: string;
  validTo: string;
};

/**
 * Kind of picture of an item, `cutout` is the product alone and `page` is the
 * flyer page around it
 */
type Image = (typeof Client.images)[number];

/**
 * An item on special as returned to the agent
 *
 * `preText` and `postText` are the words Flipp prints around the price, like
 * `From`, `/lb` or `+TX`. Most items have no unit at all. `unitPrice` is the
 * price of one `unit`, read from those words or from a pack size in the name,
 * and is left out when neither gives a sure answer. The rows of a flyer carry
 * `brand` and `discount` instead of the merchant, the price words and the dates.
 */
type ItemRow = {
  brand?: string;
  discount?: number;
  flyerId?: number;
  id: number;
  link: string;
  merchant?: string;
  merchantId?: number;
  name: string;
  originalPrice?: number | null;
  postText?: string;
  preText?: string;
  price: number | null;
  saleStory?: string;
  unit?: Unit;
  unitPrice?: number;
  validTo?: string;
};

/**
 * Options of a flyer listing
 */
type ListOptions = {
  code: string;
  grocery: boolean;
  limit: number;
  locale: Locale;
  maxChars?: number;
  merchant?: string;
};

/**
 * Flyers available for a postal code
 *
 * `total` counts the flyers matching the filters, `count` the ones returned.
 * `truncated` is true when `limit` or `maxChars` left some out.
 */
type ListResult = {
  code: string;
  count: number;
  country: Country;
  flyers: FlyerRow[];
  locale: Locale;
  total: number;
  truncated: boolean;
};

/**
 * Language of the flyer data and of the flipp.com links
 */
type Locale = (typeof Client.locales)[number];

/**
 * A validated and normalized postal code
 */
type Location = { code: string; country: Country };

/**
 * A picture ready to be sent as image content
 */
type Picture = {
  data: string;
  mimeType: string;
};

/**
 * Answer of a site to a status check
 *
 * `status` is the HTTP status, null when there was no answer at all.
 */
type Probe = {
  ms: number;
  status: number | null;
};

/**
 * An item detail as stored by the backend, only the fields used here
 */
type RawDetail = {
  brand?: string | null;
  current_price?: string | null;
  cutout_image_url?: string | null;
  description?: string | null;
  disclaimer_text?: string | null;
  dollars_off?: number | null;
  flyer_id?: number;
  id: number;
  image_url?: string | null;
  merchant?: string;
  merchant_id?: number;
  name?: string;
  original_price?: string | null;
  percent_off?: number | null;
  pre_price_text?: string | null;
  price_text?: string | null;
  sale_story?: string | null;
  valid_from?: string;
  valid_to?: string;
};

/**
 * A flyer as stored by the backend, only the fields used here
 */
type RawFlyer = {
  available_from?: string;
  available_to?: string;
  categories?: string[];
  id: number;
  merchant?: string;
  merchant_id?: number;
  name?: string;
  updated_at?: string;
  valid_from?: string;
  valid_to?: string;
};

/**
 * An item of a flyer as stored by the backend, only the fields used here
 */
type RawFlyerItem = {
  brand?: string | null;
  discount?: number | null;
  id: number;
  name?: string;
  price?: string | null;
};

/**
 * A search item as stored by the backend, only the fields used here
 */
type RawItem = {
  current_price?: number | null;
  flyer_id?: number;
  id: number;
  merchant_id?: number;
  merchant_name?: string;
  name?: string;
  original_price?: number | null;
  post_price_text?: string | null;
  pre_price_text?: string | null;
  sale_story?: string | null;
  valid_to?: string;
};

/**
 * Options of an item read
 */
type ReadOptions = {
  code: string;
  id: number;
  image?: Image;
  locale: Locale;
};

/**
 * An item on special in full
 *
 * `description` carries the size, the unit price and the regular price when
 * the flyer gives them. `preText` and `postText` are the words printed around
 * the price, like `From` or `/lb $39.66/kg`. `picture` is set only when an
 * image was asked for, and is sent as image content, not as structured data.
 */
type ReadResult = {
  brand?: string;
  description?: string;
  disclaimer?: string;
  dollarsOff?: number;
  flyerId: number;
  flyerLink: string;
  id: number;
  image?: Image;
  link: string;
  merchant: string;
  merchantId: number;
  name: string;
  originalPrice: number | null;
  percentOff?: number;
  picture?: Picture;
  postText?: string;
  preText?: string;
  price: number | null;
  saleStory?: string;
  unit?: Unit;
  unitPrice?: number;
  validFrom: string;
  validTo: string;
};

/**
 * Options of an item search
 */
type SearchOptions = {
  code: string;
  flyerId?: number;
  limit: number;
  locale: Locale;
  maxChars?: number;
  merchant?: string;
  offset: number;
  query?: string;
  sort?: Sort;
};

/**
 * Items on special matching a search
 *
 * `total` counts the items matching the filters, `count` the ones returned.
 * `truncated` is true when more items follow the ones returned, `offset` is the
 * number of items skipped.
 */
type SearchResult = {
  code: string;
  count: number;
  country: Country;
  items: ItemRow[];
  locale: Locale;
  offset: number;
  query?: string;
  total: number;
  truncated: boolean;
};

/**
 * Order of the items of a search, cheapest first by price or by unit price
 */
type Sort = (typeof Client.sorts)[number];

/**
 * Reachability of the flyer services
 */
type StatusResult = {
  backend: Probe;
  site: Probe;
  version: string;
};

/**
 * Weight a unit price is for, kilograms in Canada and pounds in the US
 */
type Unit = 'kg' | 'lb';

/**
 * Price of a unit of weight, in kilograms for Canada and in pounds for the US
 */
type UnitPrice = {
  unit?: Unit;
  unitPrice?: number;
};

/**
 * Flyer backend client
 *
 * Makes small, on-demand requests to the consumer backend that serves
 * flipp.com. Requests are spaced by a minimum delay and nothing is stored:
 * no cache, no files, only the last request time kept in memory. Every flyer
 * is returned with its flipp.com link, so the user can open the source.
 *
 * @class Client
 */
export class Client {
  private lastRequest: number;
  private version: string;
  private static readonly backendUrl = 'https://backflipp.wishabi.com';
  private static readonly doubts = {
    approximate: /approx/i,
    count: /\d\s*-?\s*(ct|count|pk|pack|pcs|pieces|bars?|un|unit[ée]s?)\b/i,
    printed: /\d\s*\$?\s*\/\s*(lb|kg|100\s*g)\b/i,
    range: /\d\s*(?:-|à|to)\s*\d+(?:[.,]\d+)?\s*(kg|g|lbs?|oz)\b/i,
    several: /\b(or|ou)\b/i
  };
  private static readonly imageHost = 'wishabi.net';
  static readonly images = ['cutout', 'page'] as const;
  private static readonly kilogramsPerPound = 0.45359237;
  static readonly locales = ['en', 'fr'] as const;
  private static readonly packPattern = /(?:(\d+)\s*[x\u00d7]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|lbs?|(?<!fl\.?\s*)oz)\b/gi;
  private static readonly poundsPerKilogram = 2.20462;
  private static readonly requestDelayMs = 400;
  private static readonly requestTimeoutMs = 10000;
  private static readonly searchLimit = 200;
  private static readonly siteUrl = 'https://flipp.com';
  static readonly sorts = ['price', 'unit'] as const;

  /**
   * Creates a new Client instance
   */
  constructor() {
    this.lastRequest = 0;
    this.version = this.getVersion();
  }

  /**
   * Gets the items of a flyer
   *
   * Sends one request for the whole flyer, then keeps the items whose name has
   * every word of the query, ignoring case and accents. Without a query every
   * item is kept. Prices come as numbers, a missing price is null.
   *
   * @private
   * @param {number} flyerId - Flyer id
   * @param {string | undefined} query - Words the item name must have
   * @param {Location} location - Validated postal code and its country
   * @param {Locale} locale - Language wanted
   * @returns {Promise<ItemRow[]>} Items of the flyer, in the order Flipp sends them
   * @throws {Error} When the flyer does not exist or the request fails
   */
  private async getFlyerItems(
    flyerId: number,
    query: string | undefined,
    location: Location,
    locale: Locale
  ): Promise<ItemRow[]> {
    const data = await this.getJson<{ items?: RawFlyerItem[] }>(
      `/flipp/flyers/${flyerId}`,
      { locale },
      'Flyer not found'
    );
    const words = this.getWords(query ?? '');
    return (data.items ?? [])
      .filter((item) => (item.name ?? '').trim() !== '')
      .filter((item) => {
        const plain = this.getWords(item.name ?? '').join(' ');
        return words.every((word) => plain.includes(word));
      })
      .map((item): ItemRow => ({
        brand: item.brand?.trim() || undefined,
        discount: item.discount ?? undefined,
        id: item.id,
        link: this.getItemLink(item.id, location, locale),
        name: this.getName((item.name ?? '').trim(), locale),
        price: this.getPrice(item.price)
      }));
  }

  /**
   * Builds the flipp.com link of a flyer
   *
   * Canadian flyers open at `/<locale>-ca/flyer/<id>`, US flyers at
   * `/en-us/weekly_ad/<id>`.
   *
   * @private
   * @param {number} id - Flyer id
   * @param {Location} location - Validated postal code and its country
   * @param {Locale} locale - Language of the link
   * @returns {string} Absolute flipp.com link
   */
  private getFlyerLink(id: number, location: Location, locale: Locale): string {
    if (location.country === 'us') {
      return this.getLink(`/en-us/weekly_ad/${id}`, location);
    }
    return this.getLink(`/${locale}-ca/flyer/${id}`, location);
  }

  /**
   * Builds the headers sent with every request
   *
   * The User-Agent says what this is and where the data is linked back to.
   *
   * @private
   * @returns {Record<string, string>} Request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      'Accept': 'application/json',
      'User-Agent': `mcp-flyer/${this.version} (personal use, links back to flipp.com)`
    };
  }

  /**
   * Builds the flipp.com link of an item
   *
   * Canadian items open at `/<locale>-ca/item/<id>`, US items at
   * `/en-us/item/<id>`.
   *
   * @private
   * @param {number} id - Item id
   * @param {Location} location - Validated postal code and its country
   * @param {Locale} locale - Language of the link
   * @returns {string} Absolute flipp.com link
   */
  private getItemLink(id: number, location: Location, locale: Locale): string {
    if (location.country === 'us') {
      return this.getLink(`/en-us/item/${id}`, location);
    }
    return this.getLink(`/${locale}-ca/item/${id}`, location);
  }

  /**
   * Fetches JSON from the flyer backend
   *
   * Waits for the minimum delay since the previous request, then sends one
   * GET.
   *
   * @private
   * @param {string} path - Backend path, starting with a slash
   * @param {Record<string, string>} params - Query parameters
   * @param {string} missing - Error message when the backend answers 404
   * @returns {Promise<T>} Parsed JSON body
   * @throws {Error} When the request fails or the backend answers with an error status
   */
  private async getJson<T>(path: string, params: Record<string, string>, missing: string): Promise<T> {
    await this.pause();
    const url = `${Client.backendUrl}${path}?${new URLSearchParams(params).toString()}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(Client.requestTimeoutMs)
    });
    if (response.status === 404) {
      throw new Error(missing);
    }
    if (!response.ok) {
      throw new Error(`Flyer backend answered ${response.status}`);
    }
    return await response.json() as T;
  }

  /**
   * Builds a flipp.com link for a location
   *
   * The postal code travels in the link, otherwise flipp.com opens the
   * location saved in the visitor's browser and can show another area.
   *
   * @private
   * @param {string} path - Path on flipp.com, starting with a slash
   * @param {Location} location - Validated postal code and its country
   * @returns {string} Absolute flipp.com link
   */
  private getLink(path: string, location: Location): string {
    const query = new URLSearchParams({ postal_code: location.code });
    return `${Client.siteUrl}${path}?${query.toString()}`;
  }

  /**
   * Validates and normalizes a postal code
   *
   * Accepts a Canadian postal code (`H3H 1A9`, `h3h1a9`, `H3H-1A9`) or a US
   * ZIP code (`10001`, `10001-1234`). The backend also answers 5 digit codes
   * from other countries with US flyers, so anything else is rejected.
   *
   * @private
   * @param {string} input - Postal or ZIP code as typed by the user
   * @returns {Location} Normalized code without space, and its country
   * @throws {Error} When the code is not a Canadian postal code or a US ZIP code
   */
  private getLocation(input: string): Location {
    const value = input.replaceAll(' ', '').replaceAll('-', '').toUpperCase();
    const shape = this.getShape(value);
    if (shape === 'A9A9A9') {
      return { code: value, country: 'ca' };
    }
    if (shape === '99999' || shape === '999999999') {
      return { code: value.slice(0, 5), country: 'us' };
    }
    throw new Error('Invalid code, expected a Canadian postal code or a US ZIP code');
  }

  /**
   * Splits a comma separated merchant filter into lowercase names
   *
   * @private
   * @param {string} [filter] - Merchant names, comma separated
   * @returns {string[]} Names to match, empty when there is no filter
   */
  private getMerchants(filter?: string): string[] {
    return (filter ?? '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
  }

  /**
   * Picks the language of a name the flyer prints in French and English
   *
   * Flyers print both as `FRANCAIS | ENGLISH`. The French part is kept for `fr`,
   * the last part otherwise. A name with no bar is returned as it is.
   *
   * @private
   * @param {string} name - Name as printed
   * @param {Locale} locale - Language wanted
   * @returns {string} Name in one language
   */
  private getName(name: string, locale: Locale): string {
    const parts = name.split(/\s*\|\s*/).filter((part) => part !== '');
    return (locale === 'fr' ? parts[0] : parts.at(-1)) ?? name;
  }

  /**
   * Reads the weights of a text in kilograms
   *
   * Takes every weight printed in the text (`900 g`, `5 lb`, `12 oz`), a count
   * before it (`2 x 2.58 kg`, written with `x` or the multiplication sign)
   * multiplies the weight.
   *
   * @private
   * @param {string} text - Name, description and words printed after the price
   * @returns {number[]} Weight of each pack found, in kilograms
   */
  private getPacks(text: string): number[] {
    const weights: Record<string, number> = {
      g: 0.001,
      kg: 1,
      lb: Client.kilogramsPerPound,
      lbs: Client.kilogramsPerPound,
      oz: 0.0283495
    };
    return [...text.matchAll(Client.packPattern)].map((pack) => {
      const count = Number(pack[1] ?? 1);
      const amount = Number(pack[2].replace(',', '.'));
      return count * amount * (weights[pack[3].toLowerCase()] ?? 0);
    });
  }

  /**
   * Downloads a picture and encodes it for image content
   *
   * Sends one GET after the minimum delay. The address must be on the Flipp
   * picture host, and only JPEG and PNG are accepted.
   *
   * @private
   * @param {string} url - Picture address
   * @returns {Promise<Picture>} Base64 data and media type
   * @throws {Error} When the host is not the picture host, the download fails or the file is not a JPEG or a PNG
   */
  private async getPicture(url: string): Promise<Picture> {
    const address = new URL(url.replace('http://', 'https://'));
    if (address.hostname !== Client.imageHost && !address.hostname.endsWith(`.${Client.imageHost}`)) {
      throw new Error('Image is not on the Flipp picture host');
    }
    await this.pause();
    const response = await fetch(address, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(Client.requestTimeoutMs)
    });
    if (!response.ok) {
      throw new Error(`Image host answered ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      return { data: bytes.toString('base64'), mimeType: 'image/jpeg' };
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      return { data: bytes.toString('base64'), mimeType: 'image/png' };
    }
    throw new Error('Image is not a JPEG or a PNG');
  }

  /**
   * Converts a price sent as text to a number
   *
   * The item detail sends prices as strings, an empty string means no price.
   *
   * @private
   * @param {string | null} [value] - Price as sent by the backend
   * @returns {number | null} Price, or null when there is none
   */
  private getPrice(value?: string | null): number | null {
    const price = Number(value);
    return value && Number.isFinite(price) ? price : null;
  }

  /**
   * Checks whether a site answers
   *
   * Sends one HEAD request after the minimum delay. The status is null on a
   * timeout or a connection error.
   *
   * @private
   * @param {string} url - Address to check
   * @returns {Promise<Probe>} Answer time and HTTP status
   */
  private async getProbe(url: string): Promise<Probe> {
    await this.pause();
    const start = Date.now();
    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
        method: 'HEAD',
        signal: AbortSignal.timeout(Client.requestTimeoutMs)
      });
      return { ms: Date.now() - start, status: response.status };
    } catch {
      return { ms: Date.now() - start, status: null };
    }
  }

  /**
   * Gets the items matching a search
   *
   * Sends one request. Items keep the order of the backend, best match first.
   * Items without a name are skipped, the backend sends them with no price
   * either. The rest are filtered by merchant name when given, and an item
   * printed twice with the same name and price by one merchant is kept once.
   *
   * @private
   * @param {string} query - Words to search
   * @param {string | undefined} merchant - Merchant names to keep, comma separated
   * @param {Location} location - Validated postal code and its country
   * @param {Locale} locale - Language wanted
   * @returns {Promise<ItemRow[]>} Items found
   * @throws {Error} When the request fails
   */
  private async getQueryItems(
    query: string,
    merchant: string | undefined,
    location: Location,
    locale: Locale
  ): Promise<ItemRow[]> {
    const data = await this.getJson<{ items?: RawItem[] }>(
      '/flipp/items/search',
      { limit: String(Client.searchLimit), locale, postal_code: location.code, q: query },
      'No flyers found for this code'
    );
    const merchants = this.getMerchants(merchant);
    const rows = (data.items ?? [])
      .filter((item) => (item.name ?? '').trim() !== '')
      .filter((item) => {
        const merchantName = (item.merchant_name ?? '').toLowerCase();
        return merchants.length === 0 || merchants.some((name) => merchantName.includes(name));
      })
      .map((item): ItemRow => {
        const name = (item.name ?? '').trim();
        const postText = item.post_price_text?.trim() || undefined;
        const preText = item.pre_price_text?.trim() || undefined;
        const price = item.current_price ?? null;
        return {
          flyerId: item.flyer_id,
          id: item.id,
          link: this.getItemLink(item.id, location, locale),
          merchant: (item.merchant_name ?? '').trim(),
          merchantId: item.merchant_id ?? 0,
          name: this.getName(name, locale),
          originalPrice: item.original_price ?? null,
          ...this.getUnitPrice(price, preText, postText, name, location.country),
          postText,
          preText,
          price,
          saleStory: item.sale_story?.trim() || undefined,
          validTo: item.valid_to ?? ''
        };
      });
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = [row.merchantId, row.name, row.price, row.postText].join('|');
      return seen.has(key) ? false : Boolean(seen.add(key));
    });
  }

  /**
   * Describes the shape of a code, one character per character of the input
   *
   * A letter becomes `A`, a digit becomes `9` and anything else becomes `?`,
   * so `H2R1R5` has the shape `A9A9A9` and `10001` has the shape `99999`.
   *
   * @private
   * @param {string} value - Code to describe
   * @returns {string} Shape of the code
   */
  private getShape(value: string): string {
    return [...value].map((char) => {
      if (char >= 'A' && char <= 'Z') {
        return 'A';
      }
      if (char >= '0' && char <= '9') {
        return '9';
      }
      return '?';
    }).join('');
  }

  /**
   * Works out the price of a kilogram or of a pound from what the flyer prints
   *
   * Reads, in this order, a printed price per kilogram, a printed price per
   * 100 g, a unit right after the price (`/lb`, `/100g`, `/kg`), and a pack size
   * in the text when the price is for the whole pack or for each bag and the text
   * gives one weight only. Anything else, like two different weights, an
   * approximate weight, a price per piece or a price for several
   * packs (`2/`, `2 FOR`), for several products (`X or Y`) or a unit price printed
   * in the text that this function does not read, gives no answer. The answer is in pounds for the US and
   * in kilograms for Canada.
   *
   * @private
   * @param {number | null} price - Special price
   * @param {string | undefined} preText - Text printed before the price
   * @param {string | undefined} postText - Text printed after the price
   * @param {string} text - Name and description as printed, where a pack size can be
   * @param {Country} country - Country of the postal code
   * @returns {UnitPrice} Unit and price of one unit, empty when not sure
   */
  private getUnitPrice(
    price: number | null,
    preText: string | undefined,
    postText: string | undefined,
    text: string,
    country: Country
  ): UnitPrice {
    if (price === null || price <= 0) {
      return {};
    }
    const post = postText ?? '';
    const perKilo = post.match(/(\d+[.,]\d+)\s*\$?\s*\/?\s*kg\b/i);
    const per100g = post.match(/(\d+[.,]\d+)\s*\$?\s*\/\s*100\s*g\b/i);
    const packs = this.getPacks(`${text} ${post}`);
    const kilos = packs[0] ?? 0;
    const close = packs.every((pack) => pack < kilos * 1.1 && pack > kilos / 1.1);
    const bundled = /^from$|^buy\b|\d\s*(\/|for\b)/i.test(preText ?? '');
    const otherUnit = /\/(?!\s*(ea|each|sac|bag)\b)/i.test(post);
    const doubted = Object.values(Client.doubts).some((doubt) => doubt.test(text));
    let value: number | undefined;
    if (perKilo) {
      value = Number(perKilo[1].replace(',', '.'));
    } else if (per100g) {
      value = Number(per100g[1].replace(',', '.')) * 10;
    } else if (/^(?:\/|per\s+)?\s*lb\b/i.test(post)) {
      value = price * Client.poundsPerKilogram;
    } else if (/^\/\s*100\s*g\b/i.test(post)) {
      value = price * 10;
    } else if (/^\/\s*kg\b/i.test(post)) {
      value = price;
    } else if (kilos > 0 && close && !bundled && !otherUnit && !doubted) {
      value = price / kilos;
    }
    if (value === undefined) {
      return {};
    }
    if (country === 'us') {
      return { unit: 'lb', unitPrice: Math.round(value * Client.kilogramsPerPound * 100) / 100 };
    }
    return { unit: 'kg', unitPrice: Math.round(value * 100) / 100 };
  }

  /**
   * Splits a text into lowercase words without accents
   *
   * @private
   * @param {string} text - Text to split
   * @returns {string[]} Words of the text
   */
  private getWords(text: string): string[] {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/\s+/).filter(Boolean);
  }

  /**
   * Waits for the minimum delay since the previous request
   *
   * @private
   * @returns {Promise<void>}
   */
  private async pause(): Promise<void> {
    const wait = this.lastRequest + Client.requestDelayMs - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastRequest = Date.now();
  }

  /**
   * Drops rows from the end until the serialized rows fit a character limit
   *
   * Does nothing when no limit is given.
   *
   * @private
   * @param {unknown[]} rows - Rows to cut in place, at least one row is kept
   * @param {number} [maxChars] - Maximum characters of the serialized rows
   */
  private trim(rows: unknown[], maxChars?: number): void {
    if (maxChars === undefined) {
      return;
    }
    while (rows.length > 1 && JSON.stringify(rows).length > maxChars) {
      rows.pop();
    }
  }

  /**
   * Checks the flyer services
   *
   * Sends one HEAD request to the backend the data comes from and one to the
   * website the links open.
   *
   * @returns {Promise<StatusResult>} Reachability of both and the server version
   */
  async getStatus(): Promise<StatusResult> {
    const backend = await this.getProbe(Client.backendUrl);
    const site = await this.getProbe(Client.siteUrl);
    return { backend, site, version: this.version };
  }

  /**
   * Gets package version
   *
   * @returns {string} Package version
   */
  getVersion(): string {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      throw new Error(`Failed to read package.json version: ${error}`);
    }
  }

  /**
   * Lists the flyers available for a postal code
   *
   * Sends one request. Flyers are filtered to grocery flyers by default, then
   * by merchant name when given, and cut to `limit` and to `maxChars` when given.
   *
   * @param {ListOptions} options - Listing options
   * @returns {Promise<ListResult>} Flyers found
   * @throws {Error} When the postal code is invalid or the request fails
   */
  async list(options: ListOptions): Promise<ListResult> {
    const location = this.getLocation(options.code);
    const locale: Locale = location.country === 'us' ? 'en' : options.locale;
    const data = await this.getJson<{ flyers?: RawFlyer[] }>(
      '/flipp/flyers',
      { locale, postal_code: location.code },
      'No flyers found for this code'
    );
    const merchants = this.getMerchants(options.merchant);
    const matches = (data.flyers ?? [])
      .filter((flyer) => !options.grocery || (flyer.categories ?? []).includes('Groceries'))
      .filter((flyer) => {
        const merchantName = (flyer.merchant ?? '').toLowerCase();
        return merchants.length === 0 || merchants.some((name) => merchantName.includes(name));
      })
      .map((flyer): FlyerRow => ({
        availableFrom: (flyer.available_from ?? '').slice(0, 10),
        availableTo: (flyer.available_to ?? '').slice(0, 10),
        categories: flyer.categories ?? [],
        id: flyer.id,
        link: this.getFlyerLink(flyer.id, location, locale),
        merchant: (flyer.merchant ?? '').trim(),
        merchantId: flyer.merchant_id ?? 0,
        name: flyer.name ?? '',
        updatedAt: flyer.updated_at ?? '',
        validFrom: (flyer.valid_from ?? '').slice(0, 10),
        validTo: (flyer.valid_to ?? '').slice(0, 10)
      }))
      .sort((a, b) => a.merchant.localeCompare(b.merchant) || a.validFrom.localeCompare(b.validFrom) || a.id - b.id);
    const flyers = matches.slice(0, options.limit);
    this.trim(flyers, options.maxChars);
    return {
      code: location.code,
      count: flyers.length,
      country: location.country,
      flyers,
      locale,
      total: matches.length,
      truncated: flyers.length < matches.length
    };
  }

  /**
   * Reads one item on special in full
   *
   * Sends one request, and a second one for the picture when `image` is set.
   * Prices come as numbers, texts are trimmed and left out when empty, and the
   * dates are the local days of the offer.
   *
   * @param {ReadOptions} options - Read options
   * @returns {Promise<ReadResult>} Item found
   * @throws {Error} When the postal code is invalid, the item does not exist or the request fails
   */
  async read(options: ReadOptions): Promise<ReadResult> {
    const location = this.getLocation(options.code);
    const locale: Locale = location.country === 'us' ? 'en' : options.locale;
    const data = await this.getJson<{ item: RawDetail }>(
      `/flipp/items/${options.id}`,
      { locale },
      'Item not found'
    );
    const item = data.item;
    const flyerId = item.flyer_id ?? 0;
    const url = options.image === 'page' ? item.image_url : item.cutout_image_url;
    if (options.image && !url) {
      throw new Error('No image for this item');
    }
    const picture = options.image && url ? await this.getPicture(url) : undefined;
    const description = item.description?.trim() || undefined;
    const postText = item.price_text?.trim() || undefined;
    const preText = item.pre_price_text?.trim() || undefined;
    const price = this.getPrice(item.current_price);
    return {
      brand: item.brand?.trim() || undefined,
      description,
      disclaimer: item.disclaimer_text?.trim() || undefined,
      dollarsOff: item.dollars_off ?? undefined,
      flyerId,
      flyerLink: this.getFlyerLink(flyerId, location, locale),
      id: item.id,
      image: picture ? options.image : undefined,
      link: this.getItemLink(item.id, location, locale),
      merchant: (item.merchant ?? '').trim(),
      merchantId: item.merchant_id ?? 0,
      name: (item.name ?? '').trim(),
      originalPrice: this.getPrice(item.original_price),
      percentOff: item.percent_off ?? undefined,
      ...this.getUnitPrice(price, preText, postText, description ?? item.name ?? '', location.country),
      picture,
      postText,
      preText,
      price,
      saleStory: item.sale_story?.trim() || undefined,
      validFrom: (item.valid_from ?? '').slice(0, 10),
      validTo: (item.valid_to ?? '').slice(0, 10)
    };
  }

  /**
   * Searches the items on special for a postal code
   *
   * Sends one request. With a `flyerId` the items come from that flyer, in the
   * order Flipp sends them, every one of them when there is no query. Otherwise they
   * come from the search of the backend, best match first. `sort` asks for the
   * cheapest first, with the items that have nothing to compare left at the end.
   * The result skips `offset` items, then is cut to `limit` and to `maxChars`
   * when given.
   *
   * @param {SearchOptions} options - Search options
   * @returns {Promise<SearchResult>} Items found
   * @throws {Error} When there is no query and no flyer, a unit sort asks for a flyer, the postal code is invalid or the request fails
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    if (options.flyerId === undefined && !options.query) {
      throw new Error('Give a `query` to search by words, a `flyerId` to see a flyer, or both');
    }
    if (options.flyerId !== undefined && options.sort === 'unit') {
      throw new Error('The items of a flyer have no unit price, sort by price instead');
    }
    const location = this.getLocation(options.code);
    const locale: Locale = location.country === 'us' ? 'en' : options.locale;
    const matches = options.flyerId === undefined
      ? await this.getQueryItems(options.query ?? '', options.merchant, location, locale)
      : await this.getFlyerItems(options.flyerId, options.query, location, locale);
    if (options.sort) {
      const key = options.sort === 'unit' ? 'unitPrice' : 'price';
      matches.sort((a, b) => (a[key] ?? Infinity) - (b[key] ?? Infinity));
    }
    const items = matches.slice(options.offset, options.offset + options.limit);
    this.trim(items, options.maxChars);
    return {
      code: location.code,
      count: items.length,
      country: location.country,
      items,
      locale,
      offset: options.offset,
      query: options.query,
      total: matches.length,
      truncated: options.offset + items.length < matches.length
    };
  }
}
