/**
 * @fileoverview BakeFlow ERP — api.js
 * Thin fetch wrapper for all API calls to the Express backend.
 * - Automatically sends credentials (HttpOnly cookie)
 * - Parses JSON responses
 * - Throws on HTTP errors (message from server or default)
 * - Dispatches 'bakeflow:api-error' and 'bakeflow:auth-required' custom events
 */

/** Base URL for the Express API — dynamically matches frontend host (e.g., localhost or 127.0.0.1) */
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_BASE = isLocalDev
  ? `http://${window.location.hostname}:3001/api`
  : 'https://production-and-business-managment-system.onrender.com/api';

let authToken = null;

/**
 * Sets the authorization token for subsequent API requests.
 * @param {string|null} token
 */
export function setAuthToken(token) {
  authToken = token;
}

/**
 * Core fetch wrapper.
 * @param {string} path     - e.g. '/ingredients'
 * @param {RequestInit} [options]
 * @returns {Promise<any>}  - parsed JSON body
 * @throws {Error} on non-2xx or network failure
 */
async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && path !== '/auth/me' && path !== '/auth/login') {
    // Session expired or not logged in during general app usage
    window.dispatchEvent(new CustomEvent('bakeflow:auth-required'));
    const err = new Error('Authentication required. Please log in.');
    err.status = 401;
    throw err;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error || `Request failed: ${response.status} ${response.statusText}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    window.dispatchEvent(new CustomEvent('bakeflow:api-error', { detail: { message, status: response.status } }));
    throw err;
  }

  return data;
}

/**
 * GET request.
 * @param {string} path
 * @param {Record<string,string>} [params] - query string params
 * @returns {Promise<any>}
 */
export function get(path, params) {
  const url = params
    ? `${path}?${new URLSearchParams(params).toString()}`
    : path;
  return request(url, { method: 'GET' });
}

/**
 * POST request.
 * @param {string} path
 * @param {any} body
 * @returns {Promise<any>}
 */
export function post(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}

/**
 * PUT request.
 * @param {string} path
 * @param {any} body
 * @returns {Promise<any>}
 */
export function put(path, body) {
  return request(path, { method: 'PUT', body: JSON.stringify(body) });
}

/**
 * PATCH request.
 * @param {string} path
 * @param {any} body
 * @returns {Promise<any>}
 */
export function patch(path, body) {
  return request(path, { method: 'PATCH', body: JSON.stringify(body) });
}

/**
 * DELETE request.
 * @param {string} path
 * @returns {Promise<any>}
 */
export function del(path) {
  return request(path, { method: 'DELETE' });
}

const api = { get, post, put, patch, del, setAuthToken };
export default api;
