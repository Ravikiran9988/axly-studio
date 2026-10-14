/**
 * Inline Keyboards for Axly Studio Telegram Bot
 */

const FRONTEND_URL = process.env.AXLY_FRONTEND_URL || 'https://url.axly.in';

/**
 * Main Welcome Menu Keyboard
 */
export const getMainMenuKeyboard = () => {
  return {
    inline_keyboard: [
      [
        { text: '⚡ Shorten Link', callback_data: 'action:prompt_shorten' },
        { text: '📱 Generate QR', callback_data: 'action:prompt_qr' },
      ],
      [
        { text: '📂 My Links', callback_data: 'action:mylinks:1' },
        { text: '📊 Analytics', callback_data: 'action:stats' },
      ],
      [
        { text: '👤 Account', callback_data: 'action:account' },
        { text: '⚙️ Settings', callback_data: 'action:settings' },
      ],
      [
        { text: '🌐 Website', url: FRONTEND_URL },
        { text: '❓ Help', callback_data: 'action:help' },
      ],
    ],
  };
};

/**
 * Actions keyboard for a specific short link
 */
export const getLinkActionsKeyboard = (shortCode, shortUrl) => {
  const buttons = [
    [
      { text: '📱 Generate QR Code', callback_data: `action:qr:${shortCode}` },
      { text: '📊 Click Stats', callback_data: `action:stats:${shortCode}` },
    ],
  ];

  if (shortUrl) {
    buttons.push([
      { text: '🌐 Open Short Link', url: shortUrl },
    ]);
  }

  return { inline_keyboard: buttons };
};

/**
 * Pagination keyboard for /mylinks
 */
export const getPaginationKeyboard = (page, totalPages) => {
  const row = [];

  if (page > 1) {
    row.push({ text: '◀ Prev', callback_data: `action:mylinks:${page - 1}` });
  }

  row.push({ text: `Page ${page}/${totalPages}`, callback_data: 'action:noop' });

  if (page < totalPages) {
    row.push({ text: 'Next ▶', callback_data: `action:mylinks:${page + 1}` });
  }

  return {
    inline_keyboard: [
      row,
      [
        { text: '⚡ Shorten Another Link', callback_data: 'action:prompt_shorten' },
        { text: '📊 Analytics', callback_data: 'action:stats' },
      ],
    ],
  };
};

/**
 * Account Menu Keyboard
 */
export const getAccountKeyboard = (isLinked = false) => {
  if (isLinked) {
    return {
      inline_keyboard: [
        [
          { text: '🌐 Open Web Dashboard', url: `${FRONTEND_URL}/app` },
        ],
        [
          { text: '❌ Unlink Account', callback_data: 'action:unlink_confirm' },
        ],
      ],
    };
  }

  return {
    inline_keyboard: [
      [
        { text: '🔗 Get Code on Website', url: `${FRONTEND_URL}/settings` },
      ],
      [
        { text: '🔄 Check Connection', callback_data: 'action:account' },
        { text: '❓ How to Connect', callback_data: 'action:help' },
      ],
    ],
  };
};

/**
 * Confirmation keyboard for unlinking
 */
export const getUnlinkConfirmKeyboard = () => {
  return {
    inline_keyboard: [
      [
        { text: '⚠️ Yes, Unlink My Account', callback_data: 'action:unlink_do' },
        { text: 'Cancel', callback_data: 'action:account' },
      ],
    ],
  };
};

/**
 * Settings menu keyboard
 */
export const getSettingsKeyboard = (preferences = {}) => {
  const autoQrText = preferences.autoQr ? '✅ Auto QR on Shorten: ON' : '⬜ Auto QR on Shorten: OFF';
  return {
    inline_keyboard: [
      [
        { text: autoQrText, callback_data: 'action:toggle_auto_qr' },
      ],
      [
        { text: '◀ Back to Main Menu', callback_data: 'action:menu' },
      ],
    ],
  };
};

/**
 * Simple Cancel keyboard for active prompts
 */
export const getCancelKeyboard = () => {
  return {
    inline_keyboard: [
      [{ text: '❌ Cancel', callback_data: 'action:cancel' }],
    ],
  };
};
