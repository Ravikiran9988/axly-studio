import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// In dev, Vite proxies /api -> http://localhost:5000. In production/Docker, Nginx proxies /api -> backend.
// Can be overridden with VITE_API_URL if hosted on a separate API subdomain (e.g., https://api.axly.in/api).
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ 
  baseURL: API_BASE,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('axly_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('axly_token');
    localStorage.removeItem('axly_user');
    setUser(null);
  }, []);

  // Intercept 401 Unauthorized responses to automatically clear stale session
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [logout]);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('axly_token');
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('axly_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('axly_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const updateProfile = async (updates) => {
    const res = await api.patch('/auth/me', updates);
    setUser(res.data.user);
    localStorage.setItem('axly_user', JSON.stringify(res.data.user));
    return res.data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export { api };
