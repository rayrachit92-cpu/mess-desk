import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const fallbackUrl = Platform.OS === 'android' ? 'http://10.0.2.2:5001' : 'http://127.0.0.1:5001';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || fallbackUrl;

const ACCESS_KEY = 'messdesk_access_token';
const REFRESH_KEY = 'messdesk_refresh_token';

export async function getTokens() {
  return {
    access: await SecureStore.getItemAsync(ACCESS_KEY),
    refresh: await SecureStore.getItemAsync(REFRESH_KEY),
  };
}

export async function setTokens({ access_token, refresh_token }) {
  if (access_token) await SecureStore.setItemAsync(ACCESS_KEY, access_token);
  if (refresh_token) await SecureStore.setItemAsync(REFRESH_KEY, refresh_token);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

async function tryRefresh() {
  const { refresh } = await getTokens();
  if (!refresh) return false;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  await setTokens({ access_token: data.access_token });
  return true;
}

export async function apiRequest(path, { method = 'GET', body, retry = true } = {}) {
  const { access } = await getTokens();
  const headers = { 'Content-Type': 'application/json' };
  if (access) headers.Authorization = `Bearer ${access}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach API at ${BASE_URL}. Check EXPO_PUBLIC_API_URL and backend host/port.`);
  }

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiRequest(path, { method, body, retry: false });
    await clearTokens();
    throw new Error('Session expired. Please log in again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Some successful responses may not include JSON.
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.field = data && data.field;
    throw err;
  }

  return data;
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' }),
};
