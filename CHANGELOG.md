# Changelog

All notable changes to the Flyer MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tool `list` returning the grocery flyers of a Canadian postal code or a US ZIP code, with validity dates and `flipp.com` links
- Tool `read` returning one item in full, with an optional `image` parameter returning the product picture (`cutout`) or the flyer page (`page`) as image content
- Tool `search` returning the items on special, with `merchant`, `limit` and `sort` parameters
- Tool `status` returning the HTTP status and response time of the flyer backend and of `flipp.com`, the server version and the full tool surface with usage guidance
- Fields `perKg` (Canada) and `perLb` (US) on `search` items and on `read`, the unit price read from the printed unit or pack size, left out when neither is sure, when the text has two different weights or when the price is for several packs
- Parameter `sort` on `search` with `price` and `unit` values, cheapest first
- Name in the language of `locale` when the flyer prints French and English, and removal of items printed twice by one merchant with the same name and price
- Canadian postal code and US ZIP code validation, with a short error for any other value
- Request pause of 400 milliseconds, request timeout of 10 seconds and response size cap on every tool
