import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const adminToken = localStorage.getItem('adminToken');
  
  // Use admin token for admin endpoints, user token for user endpoints
  if (config.url?.includes('/admin/') && adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  } else if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear both user and admin tokens on 401
      localStorage.removeItem('token');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('expiresAt');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUsername');
      
      if (!window.location.pathname.includes('/admin')) {
        window.location.href = '/';
      } else {
        window.location.href = '/admin';
      }
    }
    return Promise.reject(error);
  }
);

// User APIs
export const verifyCode = (code) => api.post('/verify-code', { code });
export const generateEmail = () => api.post('/email/generate');
export const getEmails = () => api.get('/emails');
export const getMessages = () => api.get('/messages');
export const getMessage = (id) => api.get(`/messages/${id}`);
export const deleteMessage = (id) => api.delete(`/messages/${id}`);

// Admin APIs
export const adminLogin = (username, password) => 
  api.post('/admin/login', { username, password });
export const generateCode = (expiryHours = 12) => 
  api.post('/admin/generate-code', { expiry_hours: expiryHours });
export const getCodes = () => api.get('/admin/codes');
export const revokeCode = (id) => api.delete(`/admin/codes/${id}`);
export const getStats = () => api.get('/admin/stats');

// Mock email (for testing)
export const sendMockEmail = (toEmail, fromEmail, subject, body) =>
  api.post('/mock-email', { to_email: toEmail, from_email: fromEmail, subject, body });

export default api;
