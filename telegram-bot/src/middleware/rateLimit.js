/**
 * Rate Limiting and Anti-Abuse Middleware for Axly Telegram Bot
 */

const userRequests = new Map(); // Map<userId, { count: number, resetAt: number }>
const processedUpdates = new Set(); // Set<update_id> (LRU/TTL bounded)

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 25; // 25 requests/min per user
const MAX_PROCESSED_UPDATES_SIZE = 5000;

// Periodic cleanup of rate limit map
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of userRequests.entries()) {
    if (data.resetAt <= now) {
      userRequests.delete(userId);
    }
  }
}, 30 * 1000).unref();

/**
 * Telegraf middleware: Checks per-user rate limit and dedupes update_ids
 */
export const rateLimitMiddleware = async (ctx, next) => {
  // 1. Deduplicate telegram update_id
  if (ctx.update?.update_id) {
    const updateId = ctx.update.update_id;
    if (processedUpdates.has(updateId)) {
      console.warn(`[WARN] Discarding duplicate update_id: ${updateId}`);
      return;
    }

    processedUpdates.add(updateId);
    if (processedUpdates.size > MAX_PROCESSED_UPDATES_SIZE) {
      // Clear oldest half
      const toDelete = Array.from(processedUpdates).slice(0, 1000);
      toDelete.forEach(id => processedUpdates.delete(id));
    }
  }

  const userId = ctx.from?.id;
  if (!userId) return next();

  const now = Date.now();
  let userData = userRequests.get(userId);

  if (!userData || userData.resetAt <= now) {
    userData = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    userRequests.set(userId, userData);
    return next();
  }

  userData.count += 1;

  if (userData.count > MAX_REQUESTS_PER_MINUTE) {
    const remainingSeconds = Math.ceil((userData.resetAt - now) / 1000);
    // Only warn the user on the first exceeded message to prevent flood
    if (userData.count === MAX_REQUESTS_PER_MINUTE + 1) {
      return ctx.reply(
        `⏳ <b>Slow down!</b> You've sent too many requests. Please wait ${remainingSeconds}s before trying again.`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
    return; // Drop excessive messages
  }

  return next();
};

/**
 * Clear rate limit store (for testing)
 */
export const clearRateLimits = () => {
  userRequests.clear();
  processedUpdates.clear();
};
