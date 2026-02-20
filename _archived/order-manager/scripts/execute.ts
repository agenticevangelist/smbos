import { getSupabase, isSupabaseConfigured } from '../../_shared/supabase';
import fs from 'fs';
import path from 'path';

export async function execute(params: any) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.local');
  const sb = getSupabase();

  // Order detail
  if (params.orderId) {
    const { data: order, error } = await sb.from('orders').select('*, restaurants(name), order_items(*)').eq('id', params.orderId).single();
    if (error) throw new Error(`Order not found: ${error.message}`);
    return {
      rows: (order.order_items || []).map((item: any) => ({
        name: item.name, sku: item.sku || '', category: item.category || '',
        quantity: item.quantity, price: item.price, sum: item.sum,
      })),
      order: {
        id: order.id, source: order.source, restaurant: order.restaurants?.name,
        openedAt: order.opened_at, closedAt: order.closed_at, totalSum: order.total_sum,
        status: order.status, customerName: order.customer_name, customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address, orderType: order.order_type,
      },
    };
  }

  // Export CSV
  if (params.exportDateFrom || params.exportDateTo) {
    let query = sb.from('orders').select('*, restaurants(name)');
    if (params.exportDateFrom) query = query.gte('closed_at', params.exportDateFrom);
    if (params.exportDateTo) query = query.lte('closed_at', params.exportDateTo);
    if (params.exportSource && params.exportSource !== 'all') query = query.eq('source', params.exportSource);

    const { data: orders, error } = await query.order('closed_at', { ascending: false });
    if (error) throw new Error(`Export error: ${error.message}`);

    const csvHeader = 'Order ID,Source,Restaurant,Date,Total,Status,Customer,Phone,Order Type\n';
    const csvRows = (orders || []).map((o: any) => [
      o.id, o.source, o.restaurants?.name || '', o.closed_at, o.total_sum, o.status || '',
      o.customer_name || '', o.customer_phone || '', o.order_type || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

    const outputDir = path.join(process.cwd(), 'skills', 'order-manager', 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const csvPath = path.join(outputDir, `orders_export_${Date.now()}.csv`);
    fs.writeFileSync(csvPath, csvHeader + csvRows);

    return { rows: [{ status: 'success', file: csvPath, totalOrders: (orders || []).length }] };
  }

  // List orders
  const { dateFrom, dateTo, source, status, search, sortBy = 'closed_at', limit = 50 } = params;
  let query = sb.from('orders').select('id, source, total_sum, closed_at, status, order_type, customer_name, customer_phone, restaurant_id, restaurants(name)');
  if (dateFrom) query = query.gte('closed_at', dateFrom);
  if (dateTo) query = query.lte('closed_at', dateTo);
  if (source && source !== 'all') query = query.eq('source', source);
  if (status && status !== 'all') query = query.eq('status', status);
  if (search) query = query.or(`customer_name.ilike.%${search}%,external_id.ilike.%${search}%`);

  const { data: orders, error, count } = await query.order(sortBy, { ascending: false }).limit(limit);
  if (error) throw new Error(`Query error: ${error.message}`);

  return {
    rows: (orders || []).map((o: any) => ({
      orderId: o.id, source: o.source, restaurant: o.restaurants?.name || '',
      date: o.closed_at, total: o.total_sum, status: o.status || '',
      customer: o.customer_name || '', orderType: o.order_type || '',
    })),
    total: count || (orders || []).length,
  };
}
