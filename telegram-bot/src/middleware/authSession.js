/**
 * User Session and Conversation State Middleware
 */

import { getSession } from '../services/accountLinking.js';

// In-memory conversation state: Map<userId, { state: string, data?: any, expiresAt: number }>
const userStates = new Map();
// In-memory user preferences: Map<userId, { autoQr?: boolean }>
const userPreferences = new Map();

const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const authSessionMiddleware = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) {
    ctx.auth = { isLinked: false, user: null, token: null };
    ctx.state = null;
    return next();
  }

  // 1. Resolve authentication session
  ctx.auth = await getSession(userId);

  // 2. Resolve conversation state
  const stateEntry = userStates.get(userId);
  if (stateEntry) {
    if (stateEntry.expiresAt <= Date.now()) {
      userStates.delete(userId);
      ctx.userState = null;
    } else {
      ctx.userState = stateEntry.state;
      ctx.userStateData = stateEntry.data;
    }
  } else {
    ctx.userState = null;
  }

  // 3. User preferences
  if (!userPreferences.has(userId)) {
    userPreferences.set(userId, { autoQr: false });
  }
  ctx.preferences = userPreferences.get(userId);

  return next();
};

/**
 * Set user active state
 * @param {number|string} userId 
 * @param {string} state 
 * @param {any} data 
 */
export const setUserState = (userId, state, data = null) => {
  userStates.set(userId, {
    state,
    data,
    expiresAt: Date.now() + STATE_TTL_MS,
  });
};

/**
 * Clear user active state
 * @param {number|string} userId 
 */
export const clearUserState = (userId) => {
  userStates.delete(userId);
};

/**
 * Toggle preference
 * @param {number|string} userId 
 * @param {string} key 
 */
export const toggleUserPreference = (userId, key) => {
  const current = userPreferences.get(userId) || {};
  current[key] = !current[key];
  userPreferences.set(userId, current);
  return current;
};

/**
 * Clear all states (for testing)
 */
export const clearAllStates = () => {
  userStates.clear();
  userPreferences.clear();
};
