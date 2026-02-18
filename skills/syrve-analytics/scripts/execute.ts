import axios from 'axios';

function getSyrveConfig() {
  const apiUrl = process.env.SYRVE_API_URL;
  const apiKey = process.env.SYRVE_API_KEY;
  if (!apiUrl) throw new Error('SYRVE_API_URL not configured in .env.local');
  return { apiUrl, apiKey };
}

function getDateRange(dateFrom?: string, dateTo?: string, days = 30) {
  const to = dateTo ? new Date(dateTo) : new Date();
  const from = dateFrom ? new Date(dateFrom) : new Date(to.getTime() - days * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

async function syrveRequest(path: string, params: Record<string, any> = {}) {
  const { apiUrl, apiKey } = getSyrveConfig();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const resp = await axios.get(`${apiUrl}${path}`, { params, headers, timeout: 30000 });
  return resp.data;
}

export async function execute(params: any) {
  // Health check / aggregator comparison
  if (params.compAction) {
    if (params.compAction === 'health') {
      try {
        const data = await syrveRequest('/api/health');
        return { rows: [{ status: 'connected', restaurants: data.restaurants || 0, message: 'Syrve connection OK' }] };
      } catch (err: any) {
        return { rows: [{ status: 'disconnected', error: err.message }] };
      }
    }

    // Aggregator comparison
    try {
      const data = await syrveRequest('/api/syrve/aggregator-comparison');
      const aggregators = data.aggregators || data.comparison || data;
      if (Array.isArray(aggregators)) {
        return {
          rows: aggregators.map((a: any) => ({
            aggregator: a.name || a.aggregator || a.source,
            revenue: a.revenue?.toFixed(2) || '0',
            orders: a.orders || 0,
            averageCheck: a.average_check?.toFixed(2) || '0',
            share: a.share ? `${(a.share * 100).toFixed(1)}%` : '',
          })),
        };
      }
      return { rows: [{ data: JSON.stringify(data) }] };
    } catch (err: any) {
      throw new Error(`Aggregator comparison error: ${err.message}`);
    }
  }

  // Peak hours
  if (params.peakDateFrom || params.peakDateTo || params.peakDays) {
    const range = getDateRange(params.peakDateFrom, params.peakDateTo, params.peakDays || 30);
    try {
      const data = await syrveRequest('/api/syrve/peak-hours', { date_from: range.from, date_to: range.to });
      const hours = data.hours || data.distribution || data;
      if (Array.isArray(hours)) {
        return {
          rows: hours.map((h: any) => ({
            hour: `${String(h.hour).padStart(2, '0')}:00`,
            orders: h.count || h.orders || 0,
            revenue: h.revenue?.toFixed(2) || '0',
            percentage: h.percentage ? `${h.percentage.toFixed(1)}%` : '',
          })),
        };
      }
      return { rows: [{ data: JSON.stringify(data) }] };
    } catch (err: any) {
      throw new Error(`Peak hours error: ${err.message}`);
    }
  }

  // Products ranking
  if (params.prodSortBy || params.prodDateFrom || params.prodDays) {
    const range = getDateRange(params.prodDateFrom, params.prodDateTo, params.prodDays || 30);
    try {
      const data = await syrveRequest('/api/syrve/products-ranking', {
        date_from: range.from, date_to: range.to,
        sort_by: params.prodSortBy || 'revenue', limit: params.prodLimit || 20,
      });
      const products = data.products || data.ranking || data;
      if (Array.isArray(products)) {
        return {
          rows: products.map((p: any, idx: number) => ({
            rank: idx + 1,
            name: p.name || p.product_name,
            portions: p.portions || p.quantity || 0,
            revenue: p.revenue?.toFixed(2) || '0',
            orders: p.orders || p.order_count || 0,
            abcCategory: p.abc_category || p.abc || '',
            averagePrice: p.average_price?.toFixed(2) || '0',
          })),
        };
      }
      return { rows: [{ data: JSON.stringify(data) }] };
    } catch (err: any) {
      throw new Error(`Products ranking error: ${err.message}`);
    }
  }

  // Delivery analytics (default)
  const range = getDateRange(params.deliveryDateFrom, params.deliveryDateTo, params.deliveryDays || 30);
  try {
    const data = await syrveRequest('/api/syrve/delivery-analytics', { date_from: range.from, date_to: range.to });
    if (typeof data === 'object' && !Array.isArray(data)) {
      // Convert flat object to rows
      const rows = Object.entries(data).map(([key, value]) => ({
        metric: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: typeof value === 'number' ? value.toFixed(2) : String(value),
      }));
      return { rows };
    }
    return { rows: Array.isArray(data) ? data : [data] };
  } catch (err: any) {
    throw new Error(`Delivery analytics error: ${err.message}`);
  }
}
