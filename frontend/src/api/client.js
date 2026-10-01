const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001';

function getTokens() {
  return {
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  };
}

export function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem('access_token', access_token);
  if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function tryRefresh() {
  const { refresh } = getTokens();
  if (!refresh) return false;
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  setTokens({ access_token: data.access_token });
  return true;
}

/**
 * Every request goes through here. The frontend NEVER sends an owner_id —
 * the backend derives it entirely from the Authorization header.
 */
export async function apiRequest(path, { method = 'GET', body, retry = true } = {}) {
  const { access } = getTokens();
  const headers = { 'Content-Type': 'application/json' };
  if (access) headers['Authorization'] = `Bearer ${access}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiRequest(path, { method, body, retry: false });
    clearTokens();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    let message = (data && data.error) || `Request failed (${res.status})`;
    if (res.status === 405 || (res.status === 403 && path.includes('/students/mobile/'))) {
      message = 'Cannot reach the API server. Restart the backend (python3 app.py) and ensure it runs on port 5001 — macOS AirPlay often blocks port 5000.';
    }
    const err = new Error(message);
    err.field = data && data.field;
    err.status = res.status;
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
