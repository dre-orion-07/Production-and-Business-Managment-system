/**
 * @fileoverview BakeFlow ERP — auth.js
 * Authentication state management for the frontend.
 * Thin wrapper over the /api/auth/* endpoints.
 * Token lives in an HttpOnly cookie — this module just tracks whether the
 * user is currently authenticated by calling /api/auth/me on boot.
 */

import api from './api.js';

/** @type {{ id: string, email: string, bakeryName: string } | null} */
let _currentUser = null;

/**
 * Checks whether the current session is valid by hitting /api/auth/me.
 * Call this once at boot. Returns true if logged in, false otherwise.
 * @returns {Promise<boolean>}
 */
export async function checkSession() {
  const token = localStorage.getItem('bakeflow_token');
  if (!token) {
    _currentUser = null;
    return false;
  }

  try {
    api.setAuthToken(token);
    const data = await api.get('/auth/me');
    _currentUser = data.user;
    return true;
  } catch (err) {
    if (err.status === 401) {
      localStorage.removeItem('bakeflow_token');
      api.setAuthToken(null);
      _currentUser = null;
      return false;
    }
    throw err;
  }
}

/**
 * Logs in with email + password. Returns the user object on success.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>}
 */
export async function login(email, password) {
  const data   = await api.post('/auth/login', { email, password });
  if (data.token) {
    localStorage.setItem('bakeflow_token', data.token);
    api.setAuthToken(data.token);
  }
  _currentUser  = data.user;
  return _currentUser;
}

/**
 * Signs up a new account.
 * @param {string} email
 * @param {string} password
 * @param {string} [bakeryName]
 * @returns {Promise<object>}
 */
export async function signup(email, password, bakeryName) {
  const data   = await api.post('/auth/signup', { email, password, bakeryName });
  if (data.token) {
    localStorage.setItem('bakeflow_token', data.token);
    api.setAuthToken(data.token);
  }
  _currentUser  = data.user;
  return _currentUser;
}

/**
 * Logs out and clears the current user.
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await api.post('/auth/logout', {});
  } catch { /* ignore — server might be unreachable */ }
  localStorage.removeItem('bakeflow_token');
  api.setAuthToken(null);
  _currentUser = null;
}

/**
 * Returns the currently authenticated user, or null.
 * @returns {{ id: string, email: string, bakeryName: string } | null}
 */
export function getCurrentUser() {
  return _currentUser;
}

/**
 * Returns true if the user has an active session.
 * @returns {boolean}
 */
export function isLoggedIn() {
  return _currentUser !== null;
}

const auth = { checkSession, login, signup, logout, getCurrentUser, isLoggedIn };
export default auth;
