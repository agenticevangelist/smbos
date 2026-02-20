import { getSupabase, isSupabaseConfigured } from '../../_shared/supabase';

export async function execute(params: any) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.local');
  const sb = getSupabase();

  // Transactions tab
  if (params.txType || params.txDateFrom || params.txCustomerId) {
    let query = sb.from('loyalty_transactions').select('*');
    if (params.txType && params.txType !== 'all') query = query.eq('transaction_type', params.txType);
    if (params.txDateFrom) query = query.gte('created_at', params.txDateFrom);
    if (params.txDateTo) query = query.lte('created_at', params.txDateTo);
    if (params.txCustomerId) query = query.eq('customer_id', params.txCustomerId);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(params.txLimit || 100);
    if (error) throw new Error(`Transaction query error: ${error.message}`);

    return {
      rows: (data || []).map((t: any) => ({
        id: t.id, type: t.transaction_type, amount: t.amount, balance: t.balance_after,
        customerId: t.customer_id, programId: t.program_id, date: t.created_at, description: t.description || '',
      })),
    };
  }

  // Analytics tab
  if (params.analyticsDateFrom || params.analyticsDateTo || params.programId) {
    let query = sb.from('loyalty_transactions').select('transaction_type, amount, program_id');
    if (params.analyticsDateFrom) query = query.gte('created_at', params.analyticsDateFrom);
    if (params.analyticsDateTo) query = query.lte('created_at', params.analyticsDateTo);
    if (params.programId) query = query.eq('program_id', params.programId);

    const { data: txns, error } = await query;
    if (error) throw new Error(`Analytics error: ${error.message}`);

    let totalEarned = 0, totalRedeemed = 0, totalTopup = 0;
    for (const t of (txns || [])) {
      const amt = parseFloat(t.amount) || 0;
      if (t.transaction_type === 'earn') totalEarned += amt;
      else if (t.transaction_type === 'redeem') totalRedeemed += amt;
      else if (t.transaction_type === 'topup') totalTopup += amt;
    }

    return {
      rows: [
        { metric: 'Total Earned', value: totalEarned.toFixed(2) },
        { metric: 'Total Redeemed', value: totalRedeemed.toFixed(2) },
        { metric: 'Total Top-up', value: totalTopup.toFixed(2) },
        { metric: 'Redemption Rate', value: totalEarned > 0 ? ((totalRedeemed / totalEarned) * 100).toFixed(1) + '%' : '0%' },
        { metric: 'Total Transactions', value: (txns || []).length },
      ],
    };
  }

  // Programs tab (default)
  let query = sb.from('loyalty_programs').select('*');
  if (params.isActive === 'true') query = query.eq('is_active', true);
  else if (params.isActive === 'false') query = query.eq('is_active', false);

  const { data: programs, error } = await query;
  if (error) throw new Error(`Programs error: ${error.message}`);

  return {
    rows: (programs || []).map((p: any) => ({
      id: p.id, name: p.name, type: p.type || '', isActive: p.is_active ? 'Yes' : 'No',
      pointsRate: p.points_rate || '', createdAt: p.created_at,
    })),
  };
}
