import { getWoltMerchantClient, getWoltOAuthToken, getWoltPosClient, getWoltApiKeyClient, getDefaultVenueId, isWoltConfigured, isWoltOAuthConfigured } from '../../_shared/wolt';
import axios from 'axios';

export async function execute(params: any) {
  const venueId = getDefaultVenueId();

  // Venue tab actions
  if (params.venueAction) {
    const action = params.venueAction;

    if (action === 'venue_status') {
      if (isWoltOAuthConfigured()) {
        const token = await getWoltOAuthToken();
        const client = getWoltMerchantClient(token);
        const resp = await client.get(`/venues/${venueId}/status`);
        return { status: 'success', venue: resp.data };
      }
      const client = getWoltApiKeyClient();
      const resp = await client.get(`/venues/${venueId}/online`);
      return { status: 'success', venue: resp.data };
    }

    if (action === 'venue_summary') {
      const results: any = {};
      try {
        const client = getWoltApiKeyClient();
        results.status = (await client.get(`/venues/${venueId}/online`)).data;
        results.hours = (await client.get(`/venues/${venueId}/opening-times`)).data;
      } catch (err: any) {
        results.error = err.message;
      }
      return { status: 'success', summary: results };
    }

    if (action === 'set_online') {
      const client = getWoltApiKeyClient();
      const body: any = { status: params.online ? 'ONLINE' : 'OFFLINE' };
      if (params.until && !params.online) body.until = params.until;
      const resp = await client.patch(`/venues/${venueId}/online`, body);
      return { status: 'success', message: `Venue set to ${body.status}`, data: resp.data };
    }

    if (action === 'opening_times') {
      const client = getWoltApiKeyClient();
      const resp = await client.get(`/venues/${venueId}/opening-times`);
      return { status: 'success', openingTimes: resp.data };
    }

    if (action === 'delivery_provider') {
      const client = getWoltApiKeyClient();
      const resp = await client.get(`/venues/${venueId}/delivery-provider`);
      return { status: 'success', deliveryProvider: resp.data };
    }
  }

  // Order tab actions
  if (params.orderAction) {
    if (!params.orderId) throw new Error('Order ID is required');
    const action = params.orderAction;

    if (action === 'get_order') {
      if (!isWoltOAuthConfigured()) throw new Error('Wolt OAuth not configured for order access');
      const token = await getWoltOAuthToken();
      const client = getWoltMerchantClient(token);
      const resp = await client.get(`/orders/${params.orderId}`);
      return { status: 'success', order: resp.data };
    }

    // Order action endpoints via Merchant API
    const actionMap: Record<string, { method: string; path: string }> = {
      accept_order: { method: 'put', path: `/orders/${params.orderId}/accept` },
      reject_order: { method: 'put', path: `/orders/${params.orderId}/reject` },
      ready_order: { method: 'put', path: `/orders/${params.orderId}/ready` },
      delivered_order: { method: 'put', path: `/orders/${params.orderId}/delivered` },
    };

    const spec = actionMap[action];
    if (!spec) throw new Error(`Unknown order action: ${action}`);

    if (!isWoltOAuthConfigured()) throw new Error('Wolt OAuth not configured');
    const token = await getWoltOAuthToken();
    const client = getWoltMerchantClient(token);

    const body: any = {};
    if (action === 'reject_order' && params.rejectReason) body.reason = params.rejectReason;

    const resp = await (client as any)[spec.method](spec.path, body);
    return { status: 'success', action, orderId: params.orderId, message: `Order ${action.replace('_', ' ')} successful`, data: resp.data };
  }

  // Menu tab actions
  if (params.menuAction) {
    const action = params.menuAction;

    if (action === 'get_menu') {
      if (!isWoltConfigured()) throw new Error('Wolt POS not configured');
      const client = getWoltPosClient();
      const resp = await client.get(`/v2/venues/${venueId}/menu`);
      return { status: 'success', menu: resp.data };
    }

    if (action === 'update_menu') {
      if (!isWoltConfigured()) throw new Error('Wolt POS not configured');
      const client = getWoltPosClient();
      let items: any;
      try { items = typeof params.menuItems === 'string' ? JSON.parse(params.menuItems) : params.menuItems; } catch { throw new Error('Invalid JSON'); }
      const resp = await client.patch(`/venues/${venueId}/items`, { data: items });
      return { status: 'success', message: 'Menu updated', data: resp.data };
    }

    if (action === 'update_inventory') {
      if (!isWoltConfigured()) throw new Error('Wolt POS not configured');
      const client = getWoltPosClient();
      let items: any;
      try { items = typeof params.menuItems === 'string' ? JSON.parse(params.menuItems) : params.menuItems; } catch { throw new Error('Invalid JSON'); }
      const resp = await client.patch(`/venues/${venueId}/items/inventory`, { data: items });
      return { status: 'success', message: 'Inventory updated', data: resp.data };
    }
  }

  // Analytics tab
  if (params.analyticsDateFrom || params.analyticsDateTo) {
    if (!isWoltOAuthConfigured()) throw new Error('Wolt OAuth not configured for analytics');
    const token = await getWoltOAuthToken();
    const client = getWoltMerchantClient(token);
    const resp = await client.get(`/venues/${venueId}/analytics`, {
      params: { date_from: params.analyticsDateFrom, date_to: params.analyticsDateTo },
    });
    return { status: 'success', analytics: resp.data };
  }

  return { status: 'error', message: 'No action specified. Use one of the tabs.' };
}
