import { getSupabase, isSupabaseConfigured } from '../../_shared/supabase';

export async function execute(params: any) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.local');
  const sb = getSupabase();

  // Customer detail
  if (params.customerId) {
    const { data: customer, error } = await sb.from('customers').select('*').eq('id', params.customerId).single();
    if (error) throw new Error(`Customer not found: ${error.message}`);

    const { data: orders } = await sb.from('orders').select('id, closed_at, total_sum, status, source')
      .eq('customer_phone', customer.phone).order('closed_at', { ascending: false }).limit(20);

    return {
      rows: (orders || []).map((o: any) => ({ orderId: o.id, date: o.closed_at, total: o.total_sum, status: o.status, source: o.source })),
      customer: {
        name: customer.name, phone: customer.phone, email: customer.email,
        rfmSegment: customer.rfm_segment, totalOrders: customer.total_orders,
        totalSpent: customer.total_spent, averageCheck: customer.average_check,
        walletBalance: customer.wallet_balance, firstOrderAt: customer.first_order_at,
        lastOrderAt: customer.last_order_at,
      },
    };
  }

  // RFM analytics or recalculate
  if (params.rfmAction) {
    if (params.rfmAction === 'recalculate') {
      const { data: customers, error } = await sb.from('customers').select('id, total_orders, total_spent, last_order_at');
      if (error) throw new Error(`Recalculate error: ${error.message}`);

      const now = new Date();
      let updated = 0;
      for (const c of (customers || [])) {
        const daysSinceLast = c.last_order_at ? Math.floor((now.getTime() - new Date(c.last_order_at).getTime()) / 86400000) : 999;
        const freq = c.total_orders || 0;
        const monetary = parseFloat(c.total_spent) || 0;

        const rScore = daysSinceLast <= 7 ? 5 : daysSinceLast <= 30 ? 4 : daysSinceLast <= 90 ? 3 : daysSinceLast <= 180 ? 2 : 1;
        const fScore = freq >= 20 ? 5 : freq >= 10 ? 4 : freq >= 5 ? 3 : freq >= 2 ? 2 : 1;
        const mScore = monetary >= 5000 ? 5 : monetary >= 2000 ? 4 : monetary >= 500 ? 3 : monetary >= 100 ? 2 : 1;

        let segment = 'Lost';
        if (rScore >= 4 && fScore >= 4) segment = 'Champions';
        else if (rScore >= 3 && fScore >= 3) segment = 'Loyal Customers';
        else if (rScore >= 3 && fScore >= 1) segment = 'Potential Loyalists';
        else if (rScore >= 4 && fScore <= 1) segment = 'Recent Customers';
        else if (rScore >= 3 && fScore <= 1) segment = 'Promising';
        else if (rScore === 2 && fScore >= 2) segment = 'Need Attention';
        else if (rScore === 2 && fScore <= 1) segment = 'About to Sleep';
        else if (rScore === 1 && fScore >= 3) segment = 'Cant Lose Them';
        else if (rScore === 1 && fScore >= 2) segment = 'At Risk';
        else if (rScore === 1 && fScore === 1 && monetary > 0) segment = 'Hibernating';

        await sb.from('customers').update({ rfm_segment: segment, rfm_recency: rScore, rfm_frequency: fScore, rfm_monetary: mScore }).eq('id', c.id);
        updated++;
      }

      return { rows: [{ status: 'success', updatedCustomers: updated }] };
    }

    // RFM Analytics
    const { data: customers, error } = await sb.from('customers').select('rfm_segment');
    if (error) throw new Error(`RFM error: ${error.message}`);

    const segments: Record<string, number> = {};
    for (const c of (customers || [])) {
      const seg = c.rfm_segment || 'Unclassified';
      segments[seg] = (segments[seg] || 0) + 1;
    }

    return {
      rows: Object.entries(segments).map(([segment, count]) => ({ segment, count, percentage: ((count / (customers || []).length) * 100).toFixed(1) + '%' })),
      totalCustomers: (customers || []).length,
    };
  }

  // List customers
  const { rfmSegment, search, minOrders = 0, sortBy = 'total_spent', limit = 50 } = params;
  let query = sb.from('customers').select('id, name, phone, email, rfm_segment, total_orders, total_spent, average_check, last_order_at, wallet_balance');
  if (rfmSegment && rfmSegment !== 'all') query = query.eq('rfm_segment', rfmSegment);
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  if (minOrders > 0) query = query.gte('total_orders', minOrders);

  const { data: customers, error } = await query.order(sortBy, { ascending: false }).limit(limit);
  if (error) throw new Error(`Query error: ${error.message}`);

  return {
    rows: (customers || []).map((c: any) => ({
      name: c.name || '', phone: c.phone || '', email: c.email || '',
      rfmSegment: c.rfm_segment || '', totalOrders: c.total_orders || 0,
      totalSpent: c.total_spent || '0', avgCheck: c.average_check || '0',
      lastOrder: c.last_order_at || '', wallet: c.wallet_balance || '0',
    })),
  };
}
