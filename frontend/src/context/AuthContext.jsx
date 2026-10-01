import { createContext, useContext, useEffect, useState } from 'react';
import { api, setTokens, clearTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hasToken = !!localStorage.getItem('access_token');
    if (!hasToken) {
      setLoading(false);
      return;
    }
    api.get('/profile')
      .then((data) => setOwner(data.profile))
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  async function login(email_or_mobile, password) {
    const data = await api.post('/auth/login', { email_or_mobile, password });
    setTokens(data);
    setOwner(data.owner);
    return data;
  }

  async function register(fields) {
    return api.post('/auth/register', fields);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout, clear client state regardless
    }
    clearTokens();
    setOwner(null);
  }

  return (
    <AuthContext.Provider value={{ owner, setOwner, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
