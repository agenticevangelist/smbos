---
name: restaurant-scraper
description: Scrape restaurant data from Wolt, Bolt, Glovo, and Yandex Food delivery platforms. Extract names, ratings, phones, addresses, and delivery info for restaurants in Georgian cities.
---

# Restaurant Scraper

Scrapes restaurant data from major food delivery platforms operating in Georgia.

## Supported Platforms
- **Wolt** — 10 Georgian cities, phone enrichment from HTML pages
- **Bolt Food** — 10 Georgian cities, rating conversion (0-5 → 0-10)
- **Glovo** — 3 cities (Tbilisi, Batumi, Kutaisi), percentage ratings
- **Yandex Food** — 3 cities, cuisine tracking

## Usage
Select a platform, choose a city (or all), and run the scraper.

## Data Fields
name, city, rating, phone, address, deliveryTime, deliveryPrice, coordinates, imageUrl, slug, tags
