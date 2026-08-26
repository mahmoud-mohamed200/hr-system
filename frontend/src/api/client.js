import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
const API_BASE_URL = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle global errors and format Pydantic validation errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      // If detail is an array (Pydantic validation 422 error), flatten to human-readable string
      if (Array.isArray(error.response.data?.detail)) {
        error.response.data.detail = error.response.data.detail
          .map((item) => item.msg || JSON.stringify(item))
          .join(', ');
      }
    }
    return Promise.reject(error);
  }
);

export default client;
export { API_BASE_URL, BACKEND_URL };
