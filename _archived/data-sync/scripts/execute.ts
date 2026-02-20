import { getSupabase, isSupabaseConfigured } from '../../_shared/supabase';
import axios from 'axios';

const IIKO_CLOUD_API = 'https://api-ru.iiko.services/api/1';

async function getIikoToken(): Promise<string> {
  const apiKey = process.env.IIKO_API_KEY;
  if (!apiKey) throw new Error('IIKO_API_KEY not configured in .env.local');
  const resp = await axios.post(`${IIKO_CLOUD_API}/access_token`, { apiLogin: apiKey });
  return resp.data.token;
}

export async function execute(params: any) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.local');
  const sb = getSupabase();
  const { action = 'view_logs' } = params;

  if (action === 'view_logs') {
    let query = sb.from('sync_logs').select('*');
    if (params.logsSource && params.logsSource !== 'all') query = query.eq('source', params.logsSource);
    const { data, error } = await query.order('started_at', { ascending: false }).limit(params.logsLimit || 20);
    if (error) throw new Error(`Logs error: ${error.message}`);
    return {
      rows: (data || []).map((l: any) => ({
        id: l.id, source: l.source, startedAt: l.started_at, finishedAt: l.finished_at,
        status: l.status, ordersCreated: l.orders_created, ordersUpdated: l.orders_updated, error: l.error_message || '',
      })),
    };
  }

  if (action === 'sync_orders') {
    const token = await getIikoToken();
    const orgId = process.env.IIKO_ORG_ID;
    if (!orgId) throw new Error('IIKO_ORG_ID not configured');

    const days = params.fullSyncDays || 7;
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString();
    const dateTo = new Date().toISOString();

    const logEntry = { source: 'iiko', started_at: new Date().toISOString(), status: 'running', orders_created: 0, orders_updated: 0 };
    const { data: logRow } = await sb.from('sync_logs').insert(logEntry).select().single();

    try {
      const resp = await axios.post(`${IIKO_CLOUD_API}/deliveries/by_delivery_date_and_status`, {
        organizationIds: [orgId],
        deliveryDateFrom: dateFrom.slice(0, 10),
        deliveryDateTo: dateTo.slice(0, 10),
        statuses: ['Delivered', 'Closed', 'Cancelled'],
      }, { headers: { Authorization: `Bearer ${token}` } });

      const deliveries = resp.data?.ordersByOrganizations?.[0]?.orders || [];
      let created = 0, updated = 0;

      for (const order of deliveries) {
        const externalId = order.id || order.number;
        const { data: existing } = await sb.from('orders').select('id').eq('external_id', externalId).eq('source', 'iiko').single();

        const orderData = {
          source: 'iiko', external_id: externalId, total_sum: order.sum || 0,
          opened_at: order.whenCreated, closed_at: order.whenDelivered || order.whenClosed,
          status: order.status || 'unknown', order_type: order.orderType?.name || '',
          customer_name: order.customer?.name || '', customer_phone: order.customer?.phone || '',
          delivery_address: order.deliveryPoint?.address || '', raw_payload: order,
        };

        if (existing) {
          await sb.from('orders').update(orderData).eq('id', existing.id);
          updated++;
        } else {
          await sb.from('orders').insert(orderData);
          created++;
        }
      }

      await sb.from('sync_logs').update({ finished_at: new Date().toISOString(), status: 'success', orders_created: created, orders_updated: updated }).eq('id', logRow?.id);
      return { rows: [{ status: 'success', ordersCreated: created, ordersUpdated: updated, totalProcessed: deliveries.length }] };
    } catch (err: any) {
      if (logRow?.id) await sb.from('sync_logs').update({ finished_at: new Date().toISOString(), status: 'error', error_message: err.message }).eq('id', logRow.id);
      throw err;
    }
  }

  if (action === 'sync_reference') {
    const token = await getIikoToken();
    const orgId = process.env.IIKO_ORG_ID;
    if (!orgId) throw new Error('IIKO_ORG_ID not configured');

    const [paymentResp, orderTypeResp, cancelResp] = await Promise.all([
      axios.post(`${IIKO_CLOUD_API}/payment_types`, { organizationIds: [orgId] }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: {} })),
      axios.post(`${IIKO_CLOUD_API}/order_types`, { organizationIds: [orgId] }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: {} })),
      axios.post(`${IIKO_CLOUD_API}/cancel_causes`, { organizationIds: [orgId] }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: {} })),
    ]);

    const results: string[] = [];
    const paymentTypes = paymentResp.data?.paymentTypes || [];
    if (paymentTypes.length) {
      for (const pt of paymentTypes) await sb.from('payment_types').upsert({ external_id: pt.id, name: pt.name }, { onConflict: 'external_id' });
      results.push(`${paymentTypes.length} payment types`);
    }
    const orderTypes = orderTypeResp.data?.orderTypes || [];
    if (orderTypes.length) {
      for (const ot of orderTypes) await sb.from('order_types').upsert({ external_id: ot.id, name: ot.name }, { onConflict: 'external_id' });
      results.push(`${orderTypes.length} order types`);
    }
    const cancelCauses = cancelResp.data?.cancelCauses || [];
    if (cancelCauses.length) {
      for (const cc of cancelCauses) await sb.from('cancel_causes').upsert({ external_id: cc.id, name: cc.name }, { onConflict: 'external_id' });
      results.push(`${cancelCauses.length} cancel causes`);
    }

    return { rows: [{ status: 'success', synced: results.join(', ') || 'No data returned' }] };
  }

  if (action === 'sync_customers') {
    const daysBack = params.fullSyncDays || 30;
    const dateFrom = new Date(Date.now() - daysBack * 86400000).toISOString();
    const { data: orders, error } = await sb.from('orders').select('customer_name, customer_phone, total_sum, closed_at').gte('closed_at', dateFrom).not('customer_phone', 'is', null);
    if (error) throw new Error(`Query error: ${error.message}`);

    const customerMap: Record<string, { name: string; phone: string; orders: number; spent: number; lastOrder: string }> = {};
    for (const o of (orders || [])) {
      if (!o.customer_phone) continue;
      if (!customerMap[o.customer_phone]) customerMap[o.customer_phone] = { name: o.customer_name || '', phone: o.customer_phone, orders: 0, spent: 0, lastOrder: '' };
      customerMap[o.customer_phone].orders++;
      customerMap[o.customer_phone].spent += parseFloat(o.total_sum) || 0;
      if (o.closed_at > customerMap[o.customer_phone].lastOrder) customerMap[o.customer_phone].lastOrder = o.closed_at;
    }

    let created = 0, updated = 0;
    for (const c of Object.values(customerMap)) {
      const { data: existing } = await sb.from('customers').select('id').eq('phone', c.phone).single();
      const customerData = { name: c.name, phone: c.phone, total_orders: c.orders, total_spent: c.spent, average_check: c.orders > 0 ? c.spent / c.orders : 0, last_order_at: c.lastOrder };
      if (existing) { await sb.from('customers').update(customerData).eq('id', existing.id); updated++; }
      else { await sb.from('customers').insert(customerData); created++; }
    }

    return { rows: [{ status: 'success', created, updated, totalProcessed: Object.keys(customerMap).length }] };
  }

  if (action === 'recalc_rfm') {
    // Delegate to customer-crm recalculate
    const { data: customers } = await sb.from('customers').select('id, total_orders, total_spent, last_order_at');
    const now = new Date();
    let updatedCount = 0;
    for (const c of (customers || [])) {
      const daysSinceLast = c.last_order_at ? Math.floor((now.getTime() - new Date(c.last_order_at).getTime()) / 86400000) : 999;
      const rScore = daysSinceLast <= 7 ? 5 : daysSinceLast <= 30 ? 4 : daysSinceLast <= 90 ? 3 : daysSinceLast <= 180 ? 2 : 1;
      const fScore = (c.total_orders || 0) >= 20 ? 5 : (c.total_orders || 0) >= 10 ? 4 : (c.total_orders || 0) >= 5 ? 3 : (c.total_orders || 0) >= 2 ? 2 : 1;
      const mScore = (parseFloat(c.total_spent) || 0) >= 5000 ? 5 : (parseFloat(c.total_spent) || 0) >= 2000 ? 4 : (parseFloat(c.total_spent) || 0) >= 500 ? 3 : (parseFloat(c.total_spent) || 0) >= 100 ? 2 : 1;

      let segment = 'Lost';
      if (rScore >= 4 && fScore >= 4) segment = 'Champions';
      else if (rScore >= 3 && fScore >= 3) segment = 'Loyal Customers';
      else if (rScore >= 3 && fScore >= 1) segment = 'Potential Loyalists';
      else if (rScore >= 4 && fScore <= 1) segment = 'Recent Customers';

      await sb.from('customers').update({ rfm_segment: segment, rfm_recency: rScore, rfm_frequency: fScore, rfm_monetary: mScore }).eq('id', c.id);
      updatedCount++;
    }
    return { rows: [{ status: 'success', updatedCustomers: updatedCount }] };
  }

  throw new Error(`Unknown action: ${action}`);
}
