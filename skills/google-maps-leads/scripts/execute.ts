import { NextRequest, NextResponse } from 'next/server';

export async function execute(params: any) {
  const { query, location, maxResults = 100 } = params;

  if (!query || !location) {
    throw new Error('Query and location are required');
  }

  const serpApiKey = process.env.SERPAPI_KEY;

  if (!serpApiKey || serpApiKey === 'your_serpapi_key_here') {
    throw new Error('SerpApi key not configured. Get one from https://serpapi.com/manage-api-key and add to .env.local');
  }

  const allResults: any[] = [];
  const seenIds = new Set<string>();
  let start = 0;
  const resultsPerPage = 20;

  console.log(`[Modular Skill] Starting search for "${query}" in "${location}"`);

  while (allResults.length < maxResults) {
    const serpApiUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query + ' ' + location)}&type=search&start=${start}&api_key=${serpApiKey}`;

    const response = await fetch(serpApiUrl);
    const data = await response.json();

    if (data.error) {
      throw new Error(`SerpApi error: ${data.error}`);
    }

    const localResults = data.local_results || [];

    if (localResults.length === 0) {
      break;
    }

    for (const place of localResults) {
      const id = place.place_id || `serp-${start + allResults.length}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      allResults.push({
        id,
        name: place.title || '',
        address: place.address || '',
        rating: place.rating || 0,
        reviewCount: place.reviews || 0,
        website: place.website || '',
        hasInstagram: (place.website || '').includes('instagram.com'),
        phone: place.phone || '',
        category: place.type || 'Business',
        googleMapsUrl: place.link || '',
        latitude: place.gps_coordinates?.latitude,
        longitude: place.gps_coordinates?.longitude,
        hours: place.hours || '',
        serviceOptions: place.service_options || {},
      });

      if (allResults.length >= maxResults) break;
    }

    if (localResults.length < resultsPerPage) {
      break;
    }

    start += resultsPerPage;

    if (allResults.length < maxResults) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return {
    leads: allResults.slice(0, maxResults),
    total: allResults.length
  };
}
