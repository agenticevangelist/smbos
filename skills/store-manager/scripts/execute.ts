import { getWoltApiKeyClient, getWoltPosClient, getDefaultVenueId, isWoltConfigured } from '../../_shared/wolt';

export async function execute(params: any) {
  const { action = 'get_status', storeStatus, offlineUntil, hoursAction, openingHours } = params;
  const venueId = getDefaultVenueId();

  // Opening hours
  if (hoursAction === 'set_hours') {
    if (!isWoltConfigured()) throw new Error('Wolt POS not configured');
    const client = getWoltApiKeyClient();

    let availability: any[];
    try {
      availability = typeof openingHours === 'string' ? JSON.parse(openingHours) : openingHours;
    } catch { throw new Error('Invalid JSON for opening hours'); }

    const resp = await client.patch(`/venues/${venueId}/opening-times`, { availability });
    return { status: 'success', message: 'Opening hours updated', data: resp.data };
  }

  if (hoursAction === 'get_hours') {
    try {
      const client = getWoltApiKeyClient();
      const resp = await client.get(`/venues/${venueId}/opening-times`);
      return { status: 'success', openingHours: resp.data?.availability || resp.data?.periods || resp.data };
    } catch (err: any) {
      throw new Error(`Failed to get hours: ${err.message}`);
    }
  }

  // Store status
  if (action === 'set_status') {
    if (!isWoltConfigured()) throw new Error('Wolt POS not configured');
    const client = getWoltApiKeyClient();

    const body: any = { status: storeStatus || 'ONLINE' };
    if (offlineUntil && storeStatus === 'OFFLINE') body.until = offlineUntil;

    const resp = await client.patch(`/venues/${venueId}/online`, body);
    return {
      status: 'success',
      message: `Store set to ${storeStatus}${offlineUntil ? ` until ${offlineUntil}` : ''}`,
      data: resp.data,
    };
  }

  // Get status (default)
  try {
    const client = getWoltApiKeyClient();
    const resp = await client.get(`/venues/${venueId}/online`);
    return {
      status: 'success',
      venueId,
      storeStatus: resp.data?.status || resp.data?.online ? 'ONLINE' : 'OFFLINE',
      data: resp.data,
    };
  } catch (err: any) {
    throw new Error(`Failed to get status: ${err.message}`);
  }
}
