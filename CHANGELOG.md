# Changelog

All notable changes to the Flyer MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-11-24

### Added

- Field `categories` on `list`, the names Flipp has for the code, when `category` matched no flyer
- Field `sentToFlipp` on `list` and `search`, what the call sent, two first readers forgot to say it
- Field `validFrom` on `search` items found by words, the start of the offer

### Changed

- Description of `list`, `read` and `search` pointing a new reader to `status`
- Description of `search` saying it matches the words stores print, in the language of `locale`
- Description of the `category` input of `list` with an example, `grocery` matched no flyer
- Hint of `search` saying an empty result can mean the merchant uses other words
- Hint of `search` saying the `locale` follows the language of the search words
- Request pause raised from 400 to 600 milliseconds
- Server configuration documented with `@axivo/mcp-flyer@latest`

### Fixed

- A closed output pipe ends the server with code 0, the handler said it continued
- Parallel calls answered `429`, Flipp accepts about two requests a second

## [1.0.0] - 2026-11-22

### Added

- Tool `list` returning the flyers of a postal or ZIP code with validity dates and `flipp.com` links
- Tool `read` returning one item in full
- Tool `search` returning the items on special for a postal or ZIP code
- Tool `status` returning backend and `flipp.com` reachability, server version and tool usage guidance
- Parameter `category` on `list`, a filter on the flyer categories
- Parameter `department` on `search` keeps the items of the product departments given
- Parameter `flyerId` on `search` reading the items of one flyer
- Parameter `image` on `read` returning the product picture (`cutout`) or the flyer page (`page`) as image content
- Parameter `limit` on `list` and `search`
- Parameter `maxChars` on `list` and `search` cutting rows to a character limit
- Parameter `merchant` on `list` and `search` filtering by merchant name
- Parameter `offset` on `search` for reading a flyer in pages
- Parameter `query` on `search` optional with `flyerId`, keeping the items whose name has every word
- Parameter `sort` on `search` with `price` and `unit` values, cheapest first
- Fields `department` and `section` on the items of a search
- Field `flyerId` on every `search` item found by words, to find what else is on special in the same flyer
- Field `truncated` on `list` and `search` set when `limit` or `maxChars` left rows out
- Fields `unit` (`kg` in Canada, `lb` in the US) and `unitPrice` on `search` items and `read`
- Canadian postal code and US ZIP code validation with a short error for any other value
- Item name in the `locale` language when the flyer prints French and English
- Items printed twice by one merchant with the same name and price shown once
- Request pause of 400 milliseconds and request timeout of 10 seconds on every tool
