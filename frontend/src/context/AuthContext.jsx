import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api.js';
import { connectSocket, disconnectSocket } from '../socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('mandi_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        connectSocket(token);
      })
      .catch(() => {
        localStorage.removeItem('mandi_token');
      })
      .finally(() => setLoading(false));
  }, []);

  function startSession(data) {
    localStorage.setItem('mandi_token', data.token);
    setUser(data.user);
    connectSocket(data.token);
    return data.user;
  }

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    return startSession(res.data);
  }

  async function register(payload) {
    const res = await api.post('/auth/register', payload);
    return startSession(res.data);
  }

  function logout() {
    localStorage.removeItem('mandi_token');
    setUser(null);
    disconnectSocket();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
