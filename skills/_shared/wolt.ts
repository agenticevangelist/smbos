import axios, { AxiosInstance } from 'axios';

const POS_API_BASE = 'https://pos-integration-service.wolt.com';
const CONSUMER_API_BASE = 'https://consumer-api.wolt.com';

export function getWoltPosClient(): AxiosInstance {
  const username = process.env.WOLT_USERNAME;
  const password = process.env.WOLT_PASSWORD;

  if (!username || !password) {
    throw new Error('Wolt POS not configured. Set WOLT_USERNAME and WOLT_PASSWORD in .env.local');
  }

  return axios.create({
    baseURL: POS_API_BASE,
    timeout: 30000,
    auth: { username, password },
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getWoltApiKeyClient(): AxiosInstance {
  const apiKey = process.env.WOLT_API_KEY;

  if (!apiKey) {
    throw new Error('Wolt API key not configured. Set WOLT_API_KEY in .env.local');
  }

  return axios.create({
    baseURL: POS_API_BASE,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'WOLT-API-KEY': apiKey,
    },
  });
}

export function getWoltMerchantClient(accessToken: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://merchant-api.wolt.com',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getWoltOAuthToken(): Promise<string> {
  const clientId = process.env.WOLT_CLIENT_ID;
  const clientSecret = process.env.WOLT_CLIENT_SECRET;

  if (process.env.WOLT_ACCESS_TOKEN) {
    return process.env.WOLT_ACCESS_TOKEN;
  }

  if (!clientId || !clientSecret) {
    throw new Error('Wolt OAuth not configured. Set WOLT_CLIENT_ID and WOLT_CLIENT_SECRET in .env.local');
  }

  const response = await axios.post('https://authentication.wolt.com/v1/wauth2/access_token', {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  return response.data.access_token;
}

export function getDefaultVenueId(): string {
  const venueId = process.env.WOLT_VENUE_ID;
  if (!venueId) throw new Error('WOLT_VENUE_ID not configured in .env.local');
  return venueId;
}

export function getDefaultVenueSlug(): string {
  const slug = process.env.WOLT_VENUE_SLUG;
  if (!slug) throw new Error('WOLT_VENUE_SLUG not configured in .env.local');
  return slug;
}

export function isWoltConfigured(): boolean {
  return !!(process.env.WOLT_USERNAME && process.env.WOLT_PASSWORD);
}

export function isWoltOAuthConfigured(): boolean {
  return !!(process.env.WOLT_ACCESS_TOKEN || (process.env.WOLT_CLIENT_ID && process.env.WOLT_CLIENT_SECRET));
}
