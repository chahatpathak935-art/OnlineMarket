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

  // Login is two steps: password check (emails a code), then code check (issues the token).
  async function requestLoginOtp(email, password) {
    const res = await api.post('/auth/login/request', { email, password });
    return res.data;
  }

  async function verifyLoginOtp(email, otp) {
    const res = await api.post('/auth/login/verify', { email, otp });
    return startSession(res.data);
  }

  // Registration is two steps too: the account is only created once the code is verified.
  async function requestRegisterOtp(payload) {
    const res = await api.post('/auth/register/request', payload);
    return res.data;
  }

  async function verifyRegisterOtp(email, otp) {
    const res = await api.post('/auth/register/verify', { email, otp });
    return startSession(res.data);
  }

  function logout() {
    localStorage.removeItem('mandi_token');
    setUser(null);
    disconnectSocket();
  }

  return (
    <AuthContext.Provider value={{
        user,
        loading,
        requestLoginOtp,
        verifyLoginOtp,
        requestRegisterOtp,
        verifyRegisterOtp,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
