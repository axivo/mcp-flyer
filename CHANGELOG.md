# Changelog

All notable changes to the Flyer MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-18

### Added

- Tool `list` returning the grocery flyers of a postal or ZIP code with validity dates and `flipp.com` links
- Tool `read` returning one item in full
- Tool `search` returning the items on special for a postal or ZIP code
- Tool `status` returning backend and `flipp.com` reachability, server version and tool usage guidance
- Parameter `image` on `read` returning the product picture (`cutout`) or the flyer page (`page`) as image content
- Parameter `merchant` on `list` and `search` filtering by merchant name
- Parameter `limit` on `list` and `search`
- Parameter `maxChars` on `list` and `search` cutting rows to a character limit
- Field `truncated` on `list` and `search` set when `limit` or `maxChars` left rows out
- Parameter `sort` on `search` with `price` and `unit` values, cheapest first
- Parameter `flyerId` on `search` reading the items of one flyer
- Parameter `offset` on `search` for reading a flyer in pages
- Parameter `query` on `search` optional with `flyerId`, keeping the items whose name has every word
- Fields `unit` (`kg` in Canada, `lb` in the US) and `unitPrice` on `search` items and `read`
- Field `flyerId` on every `search` item found by words, to find what else is on special in the same flyer
- Unit price read from the printed unit or the pack size, left out when not sure
- Weight ranges like `255 à 454 g` and `255 to 454 g` give no unit price
- Search by words asking Flipp for 200 items, the most it accepts, instead of 150
- Item name in the `locale` language when the flyer prints French and English
- Removal of items printed twice by one merchant with the same name and price
- Canadian postal code and US ZIP code validation with a short error for any other value
- Request pause of 400 milliseconds and request timeout of 10 seconds on every tool
