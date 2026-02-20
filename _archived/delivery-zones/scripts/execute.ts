import { getSupabase, isSupabaseConfigured } from '../../_shared/supabase';

export async function execute(params: any) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.local');
  const sb = getSupabase();

  // Reference data tab
  if (params.refType) {
    const table = params.refType === 'cancel_causes' ? 'cancel_causes' : params.refType === 'payment_types' ? 'payment_types' : 'order_types';
    const { data, error } = await sb.from(table).select('*');
    if (error) throw new Error(`Reference data error: ${error.message}`);
    return { rows: data || [] };
  }

  // Couriers tab
  if (params.courDateFrom || params.courDateTo || params.courSortBy) {
    const { data, error } = await sb.from('couriers').select('*');
    if (error) throw new Error(`Couriers error: ${error.message}`);
    return {
      rows: (data || []).map((c: any) => ({
        id: c.id, name: c.display_name || c.name, phone: c.phone || '',
        isActive: c.is_active ? 'Yes' : 'No', externalId: c.external_id || '',
      })),
    };
  }

  // Zones tab (default)
  const { data, error } = await sb.from('delivery_zones').select('*');
  if (error) throw new Error(`Zones error: ${error.message}`);
  return {
    rows: (data || []).map((z: any) => ({
      id: z.id, name: z.name, minOrderSum: z.min_order_sum || '',
      deliveryDuration: z.delivery_duration_minutes ? `${z.delivery_duration_minutes} min` : '',
      deliveryPrice: z.delivery_price || '', isActive: z.is_active ? 'Yes' : 'No',
    })),
  };
}
