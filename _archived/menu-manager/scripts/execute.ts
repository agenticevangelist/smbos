import { getWoltPosClient, getDefaultVenueId, getDefaultVenueSlug, isWoltConfigured } from '../../_shared/wolt';
import axios from 'axios';

function getText(field: any, fallback = ''): string {
  if (!field) return fallback;
  if (typeof field === 'string') return field;
  if (Array.isArray(field)) return field[0]?.value || fallback;
  return field.value || fallback;
}

function centsToGel(cents: number): string {
  return (cents / 100).toFixed(2);
}

interface MenuItem {
  category: string;
  name: string;
  price: string;
  available: string;
  isAvailable: boolean;
  sku: string;
  externalId: string;
  options: string;
  description: string;
  imageUrl: string;
}

async function fetchMenuPublic(slug: string): Promise<any> {
  const resp = await axios.get(`https://consumer-api.wolt.com/v4/venues/slug/${slug}/menu/data`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    timeout: 15000,
  });
  return resp.data;
}

async function fetchMenuPOS(venueId: string): Promise<any> {
  const client = getWoltPosClient();
  const resp = await client.get(`/v2/venues/${venueId}/menu`);

  // POS API may return async response with S3 URL
  if (resp.data?.status === 'PENDING' || resp.data?.url) {
    let attempts = 0;
    while (attempts < 10) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const pollResp = await axios.get(resp.data.url, { timeout: 10000 });
        if (pollResp.data) return pollResp.data;
      } catch { /* retry */ }
      attempts++;
    }
  }

  return resp.data;
}

function parseMenu(data: any, search?: string): MenuItem[] {
  const items: MenuItem[] = [];
  const categories = data?.categories || data?.menu?.categories || [];

  for (const cat of categories) {
    const catName = getText(cat.name, 'Uncategorized');
    const catItems = cat.items || cat.products || [];

    for (const item of catItems) {
      const name = getText(item.name);
      const sku = item.sku || '';
      const externalId = item.external_id || item.id || '';

      // Search filter
      if (search) {
        const s = search.toLowerCase();
        if (!name.toLowerCase().includes(s) && !sku.toLowerCase().includes(s) && !catName.toLowerCase().includes(s) && !externalId.toLowerCase().includes(s)) {
          continue;
        }
      }

      const price = item.price || item.baseprice || 0;
      const isAvailable = item.enabled !== false && item.is_available !== false;

      const optionGroups = item.option_groups || item.option_bindings || [];
      const optCount = Array.isArray(optionGroups) ? optionGroups.length : 0;

      items.push({
        category: catName,
        name,
        price: centsToGel(price),
        available: isAvailable ? 'Yes' : 'No',
        isAvailable,
        sku,
        externalId,
        options: optCount > 0 ? `${optCount} groups` : '',
        description: getText(item.description, ''),
        imageUrl: item.image_url || '',
      });
    }
  }

  return items;
}

export async function execute(params: any) {
  const { venueSlug, menuSearch, editItems, inventoryItems } = params;

  // Edit items
  if (editItems) {
    if (!isWoltConfigured()) throw new Error('Wolt POS not configured. Set WOLT_USERNAME and WOLT_PASSWORD in .env.local');
    const client = getWoltPosClient();
    const venueId = getDefaultVenueId();

    let items: any[];
    try {
      items = typeof editItems === 'string' ? JSON.parse(editItems) : editItems;
    } catch { throw new Error('Invalid JSON for edit items'); }

    if (!Array.isArray(items) || items.length === 0) throw new Error('Provide at least one item to update');

    // Validate each item has identifier
    for (const item of items) {
      if (!item.sku && !item.external_id && !item.gtin) throw new Error('Each item must have sku, external_id, or gtin');
      // Convert discounted_price validation
      if (item.discounted_price != null && item.price != null && item.discounted_price >= item.price) {
        delete item.discounted_price; // Remove invalid discount
      }
    }

    const resp = await client.patch(`/venues/${venueId}/items`, { data: items });
    return {
      rows: [{ status: 'success', updatedCount: items.length, message: `Updated ${items.length} items` }],
      response: resp.data,
    };
  }

  // Update inventory
  if (inventoryItems) {
    if (!isWoltConfigured()) throw new Error('Wolt POS not configured. Set WOLT_USERNAME and WOLT_PASSWORD in .env.local');
    const client = getWoltPosClient();
    const venueId = getDefaultVenueId();

    let items: any[];
    try {
      items = typeof inventoryItems === 'string' ? JSON.parse(inventoryItems) : inventoryItems;
    } catch { throw new Error('Invalid JSON for inventory items'); }

    const resp = await client.patch(`/venues/${venueId}/items/inventory`, { data: items });
    return {
      rows: [{ status: 'success', updatedCount: items.length, message: `Updated inventory for ${items.length} items` }],
      response: resp.data,
    };
  }

  // View menu (default)
  const slug = venueSlug || process.env.WOLT_VENUE_SLUG;
  const venueId = process.env.WOLT_VENUE_ID;

  let menuData: any;

  // Try POS API first if configured
  if (isWoltConfigured() && venueId) {
    try {
      menuData = await fetchMenuPOS(venueId);
      menuData._source = 'pos';
    } catch {
      // Fall back to public API
    }
  }

  // Fall back to public API
  if (!menuData && slug) {
    menuData = await fetchMenuPublic(slug);
    menuData._source = 'public';
  }

  if (!menuData) throw new Error('Could not fetch menu. Provide venueSlug or configure WOLT_VENUE_SLUG');

  const items = parseMenu(menuData, menuSearch);

  return {
    rows: items,
    total: items.length,
    source: menuData._source,
    categories: [...new Set(items.map(i => i.category))].length,
  };
}
