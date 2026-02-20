import { getSupabase, isSupabaseConfigured } from '../../_shared/supabase';

export async function execute(params: any) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.local');
  const sb = getSupabase();

  // Determine which tab is active based on which params are provided
  if (params.metric || params.tsDateFrom) return timeSeriesQuery(sb, params);
  if (params.restSortBy || params.restDateFrom) return restaurantsQuery(sb, params);
  if (params.prodSortBy || params.prodDateFrom) return productsQuery(sb, params);
  return dashboardQuery(sb, params);
}

async function dashboardQuery(sb: any, params: any) {
  const { dateFrom, dateTo, source } = params;
  let query = sb.from('orders').select('id, source, total_sum, restaurant_id, restaurants(name)');
  if (dateFrom) query = query.gte('closed_at', dateFrom);
  if (dateTo) query = query.lte('closed_at', dateTo);
  if (source && source !== 'all') query = query.eq('source', source);

  const { data: orders, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  const totalRevenue = (orders || []).reduce((sum: number, o: any) => sum + (parseFloat(o.total_sum) || 0), 0);
  const totalOrders = (orders || []).length;
  const averageCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Group by source
  const bySource: Record<string, { revenue: number; orders: number }> = {};
  for (const o of (orders || [])) {
    const src = o.source || 'unknown';
    if (!bySource[src]) bySource[src] = { revenue: 0, orders: 0 };
    bySource[src].revenue += parseFloat(o.total_sum) || 0;
    bySource[src].orders += 1;
  }

  return {
    rows: [
      { metric: 'Total Revenue', value: totalRevenue.toFixed(2) },
      { metric: 'Total Orders', value: totalOrders },
      { metric: 'Average Check', value: averageCheck.toFixed(2) },
      ...Object.entries(bySource).map(([src, stats]) => ({
        metric: `${src} Revenue`, value: stats.revenue.toFixed(2), orders: stats.orders,
      })),
    ],
    summary: { totalRevenue, totalOrders, averageCheck },
  };
}

async function timeSeriesQuery(sb: any, params: any) {
  const { tsDateFrom, tsDateTo, metric = 'revenue', granularity = 'day' } = params;
  let query = sb.from('orders').select('closed_at, total_sum');
  if (tsDateFrom) query = query.gte('closed_at', tsDateFrom);
  if (tsDateTo) query = query.lte('closed_at', tsDateTo);

  const { data: orders, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  const buckets: Record<string, { revenue: number; orders: number }> = {};
  for (const o of (orders || [])) {
    const date = new Date(o.closed_at);
    let key: string;
    if (granularity === 'month') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    else if (granularity === 'week') {
      const d = new Date(date); d.setDate(d.getDate() - d.getDay());
      key = d.toISOString().slice(0, 10);
    } else key = date.toISOString().slice(0, 10);

    if (!buckets[key]) buckets[key] = { revenue: 0, orders: 0 };
    buckets[key].revenue += parseFloat(o.total_sum) || 0;
    buckets[key].orders += 1;
  }

  return {
    rows: Object.entries(buckets).sort().map(([date, stats]) => ({
      date,
      value: metric === 'revenue' ? stats.revenue.toFixed(2) : metric === 'orders' ? stats.orders : (stats.orders > 0 ? (stats.revenue / stats.orders).toFixed(2) : '0'),
      orders: stats.orders,
      revenue: stats.revenue.toFixed(2),
    })),
    metric, granularity,
  };
}

async function restaurantsQuery(sb: any, params: any) {
  const { restDateFrom, restDateTo, restSortBy = 'revenue', restLimit = 20 } = params;
  let query = sb.from('orders').select('restaurant_id, total_sum, restaurants(name)');
  if (restDateFrom) query = query.gte('closed_at', restDateFrom);
  if (restDateTo) query = query.lte('closed_at', restDateTo);

  const { data: orders, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  const byRestaurant: Record<string, { name: string; revenue: number; orders: number }> = {};
  for (const o of (orders || [])) {
    const rid = o.restaurant_id || 'unknown';
    if (!byRestaurant[rid]) byRestaurant[rid] = { name: (o as any).restaurants?.name || rid, revenue: 0, orders: 0 };
    byRestaurant[rid].revenue += parseFloat(o.total_sum) || 0;
    byRestaurant[rid].orders += 1;
  }

  const sorted = Object.entries(byRestaurant)
    .map(([id, stats]) => ({ id, name: stats.name, revenue: stats.revenue.toFixed(2), orders: stats.orders, averageCheck: (stats.orders > 0 ? stats.revenue / stats.orders : 0).toFixed(2) }))
    .sort((a, b) => restSortBy === 'orders' ? b.orders - a.orders : parseFloat(b.revenue) - parseFloat(a.revenue))
    .slice(0, restLimit);

  return { rows: sorted, total: Object.keys(byRestaurant).length };
}

async function productsQuery(sb: any, params: any) {
  const { prodDateFrom, prodDateTo, prodSortBy = 'revenue', prodCategory, prodLimit = 50 } = params;
  let query = sb.from('order_items').select('name, sku, category, quantity, price, sum, order_id, orders!inner(closed_at)');
  if (prodDateFrom) query = query.gte('orders.closed_at', prodDateFrom);
  if (prodDateTo) query = query.lte('orders.closed_at', prodDateTo);
  if (prodCategory) query = query.ilike('category', `%${prodCategory}%`);

  const { data: items, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);

  const byProduct: Record<string, { name: string; sku: string; category: string; quantity: number; revenue: number; orderCount: Set<string> }> = {};
  for (const item of (items || [])) {
    const key = item.sku || item.name;
    if (!byProduct[key]) byProduct[key] = { name: item.name, sku: item.sku || '', category: item.category || '', quantity: 0, revenue: 0, orderCount: new Set() };
    byProduct[key].quantity += parseFloat(item.quantity) || 0;
    byProduct[key].revenue += parseFloat(item.sum) || 0;
    byProduct[key].orderCount.add(item.order_id);
  }

  const sorted = Object.values(byProduct)
    .map(p => ({ name: p.name, sku: p.sku, category: p.category, quantity: p.quantity, revenue: p.revenue.toFixed(2), orderCount: p.orderCount.size, avgPrice: (p.quantity > 0 ? p.revenue / p.quantity : 0).toFixed(2) }))
    .sort((a, b) => prodSortBy === 'quantity' ? b.quantity - a.quantity : parseFloat(b.revenue) - parseFloat(a.revenue))
    .slice(0, prodLimit);

  return { rows: sorted, total: Object.keys(byProduct).length };
}
