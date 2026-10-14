/**
 * Axly Studio API Client for Telegram Bot
 * Connects to the Express/PostgreSQL backend API
 */

const getApiBaseUrl = () => {
  const url = process.env.AXLY_API_URL || 'http://localhost:5000';
  return url.replace(/\/+$/, '');
};

const INSECURE_BOT_SECRETS = new Set([
  'axly_telegram_bot_internal_secret_key',
  'replace_with_a_secure_random_32_character_bot_secret',
  'replace_with_random_32_char_or_longer_secret',
  'changeme',
  'secret',
]);

const getBotSecret = () => {
  const secret = process.env.TELEGRAM_BOT_SECRET || '';
  if (secret.length < 32 || INSECURE_BOT_SECRETS.has(secret.toLowerCase())) {
    throw new Error('Telegram service authentication is not configured. Set TELEGRAM_BOT_SECRET to a random value of at least 32 characters.');
  }
  return secret;
};

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Robust fetch wrapper with timeout and JSON error handling
 */
const apiRequest = async (endpoint, options = {}) => {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Axly-Telegram-Bot/1.0.0',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timer);

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { success: response.ok, message: text };
    }

    if (!response.ok) {
      const error = new Error(data.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.code = data.code;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const timeoutError = new Error('Axly API request timed out. Please try again.');
      timeoutError.status = 504;
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    throw err;
  }
};

/**
 * Create short URL (Guest or Authenticated)
 * @param {string} url 
 * @param {string|null} userToken 
 * @returns {Promise<Object>}
 */
export const createShortUrl = async (url, userToken = null, customAlias = null) => {
  const headers = {};
  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`;
  }

  return apiRequest('/api/urls', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url, ...(customAlias ? { customAlias } : {}) }),
  });
};

/**
 * Fetch user's links with pagination
 * @param {string} userToken 
 * @param {{ page?: number, limit?: number, search?: string }} options 
 * @returns {Promise<Object>}
 */
export const getUserUrls = async (userToken, { page = 1, limit = 5, search = '' } = {}) => {
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) {
    queryParams.append('search', search);
  }

  return apiRequest(`/api/urls?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });
};

/**
 * Fetch overall account stats
 * @param {string} userToken 
 * @returns {Promise<Object>}
 */
export const getDashboardStats = async (userToken) => {
  return apiRequest('/api/urls/stats', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });
};

/**
 * Fetch detailed analytics for a single URL
 * @param {string} urlId 
 * @param {string} userToken 
 * @returns {Promise<Object>}
 */
export const getUrlAnalytics = async (urlId, userToken) => {
  return apiRequest(`/api/urls/${urlId}/analytics`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });
};

/**
 * Verify account linking code
 * @param {string} code 
 * @param {{ id: number|string, username?: string, first_name?: string }} telegramUser 
 * @returns {Promise<Object>}
 */
export const verifyTelegramLink = async (code, telegramUser) => {
  return apiRequest('/api/telegram/verify', {
    method: 'POST',
    body: JSON.stringify({
      code,
      telegramUserId: telegramUser.id,
      telegramUsername: telegramUser.username,
      telegramFirstName: telegramUser.first_name,
    }),
  });
};

/**
 * Retrieve active session for Telegram user from Axly API
 * @param {number|string} telegramUserId 
 * @returns {Promise<Object>}
 */
export const getTelegramSession = async (telegramUserId) => {
  return apiRequest('/api/telegram/session', {
    method: 'POST',
    headers: {
      'x-telegram-bot-secret': getBotSecret(),
    },
    body: JSON.stringify({
      telegramUserId,
    }),
  });
};

/**
 * Unlink Telegram user from Axly API
 * @param {number|string} telegramUserId 
 * @returns {Promise<Object>}
 */
export const unlinkTelegram = async (telegramUserId) => {
  return apiRequest('/api/telegram/unlink', {
    method: 'POST',
    headers: {
      'x-telegram-bot-secret': getBotSecret(),
    },
    body: JSON.stringify({
      telegramUserId,
    }),
  });
};
