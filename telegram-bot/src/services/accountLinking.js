/**
 * Account Linking and Session Management Service for Telegram Bot
 */

import * as axlyApi from './axlyApi.js';

// In-memory session cache: Map<telegramUserId, { user, token, expiresAt, linked }>
const sessionCache = new Map();
const SESSION_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Get active Axly session for a Telegram user ID
 * @param {number|string} telegramUserId 
 * @returns {Promise<{ isLinked: boolean, user: Object|null, token: string|null }>}
 */
export const getSession = async (telegramUserId) => {
  const key = String(telegramUserId);
  const cached = sessionCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return {
      isLinked: cached.linked,
      user: cached.user,
      token: cached.token,
    };
  }

  try {
    const res = await axlyApi.getTelegramSession(telegramUserId);
    if (res.success && res.linked) {
      const session = {
        linked: true,
        user: res.user,
        token: res.token,
        expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
      };
      sessionCache.set(key, session);
      return { isLinked: true, user: res.user, token: res.token };
    }

    // Cache unlinked state for 2 minutes to prevent hammering API
    sessionCache.set(key, {
      linked: false,
      user: null,
      token: null,
      expiresAt: Date.now() + 2 * 60 * 1000,
    });
    return { isLinked: false, user: null, token: null };
  } catch (err) {
    console.error(`Failed to fetch session for ${telegramUserId}:`, err.message);
    // If API error, fallback to expired cached if available, else false
    if (cached) {
      return { isLinked: cached.linked, user: cached.user, token: cached.token };
    }
    return { isLinked: false, user: null, token: null };
  }
};

/**
 * Verify linking code and bind account
 * @param {number|string} telegramUserId 
 * @param {string} code 
 * @param {Object} telegramProfile 
 * @returns {Promise<{ success: boolean, message: string, user?: Object, token?: string }>}
 */
export const verifyAndLink = async (telegramUserId, code, telegramProfile = {}) => {
  const key = String(telegramUserId);
  const res = await axlyApi.verifyTelegramLink(code, {
    id: telegramUserId,
    username: telegramProfile.username,
    first_name: telegramProfile.first_name,
  });

  if (res.success && res.token) {
    sessionCache.set(key, {
      linked: true,
      user: res.user,
      token: res.token,
      expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
    });
  }

  return res;
};

/**
 * Unlink Telegram user from Axly account
 * @param {number|string} telegramUserId 
 * @returns {Promise<Object>}
 */
export const unlink = async (telegramUserId) => {
  const key = String(telegramUserId);
  sessionCache.delete(key);
  return axlyApi.unlinkTelegram(telegramUserId);
};

/**
 * Clear memory cache (useful for testing)
 */
export const clearCache = () => {
  sessionCache.clear();
};
