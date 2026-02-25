// All supported OpenClaw channels with their config fields
export const CHANNEL_DEFS: Record<string, {
  label: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'select' | 'toggle' | 'number' | 'textarea';
    placeholder?: string;
    helperText?: string;
    required?: boolean;
    options?: Array<{ value: string; text: string }>;
    defaultValue?: any;
  }>;
  pairingRequired?: boolean;
  pairingHint?: string;
}> = {
  whatsapp: {
    label: 'WhatsApp',
    description: 'WhatsApp via Baileys Web multi-device. Requires QR pairing.',
    pairingRequired: true,
    pairingHint: 'Run `openclaw channels login --channel whatsapp` to scan QR code.',
    fields: [
      { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: [
        { value: 'pairing', text: 'Pairing (approve each user)' },
        { value: 'allowlist', text: 'Allowlist only' },
        { value: 'open', text: 'Open (anyone can DM)' },
        { value: 'disabled', text: 'Disabled' },
      ], defaultValue: 'pairing' },
      { key: 'allowFrom', label: 'Allowed Numbers', type: 'textarea', placeholder: '+15551234567\n+15559876543', helperText: 'One phone number per line.' },
      { key: 'sendReadReceipts', label: 'Send Read Receipts', type: 'toggle', defaultValue: true },
      { key: 'textChunkLimit', label: 'Text Chunk Limit', type: 'number', defaultValue: 4000 },
      { key: 'mediaMaxMb', label: 'Max Media Size (MB)', type: 'number', defaultValue: 50 },
    ],
  },
  telegram: {
    label: 'Telegram',
    description: 'Telegram Bot API via grammY. Requires a bot token from @BotFather.',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', required: true, placeholder: '123456:ABC-DEF...', helperText: 'Get from @BotFather on Telegram.' },
      { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: [
        { value: 'pairing', text: 'Pairing' },
        { value: 'allowlist', text: 'Allowlist' },
        { value: 'open', text: 'Open' },
        { value: 'disabled', text: 'Disabled' },
      ], defaultValue: 'pairing' },
      { key: 'allowFrom', label: 'Allowed User IDs', type: 'textarea', placeholder: '123456789\n987654321', helperText: 'Telegram numeric user IDs, one per line.' },
      { key: 'historyLimit', label: 'History Limit', type: 'number', defaultValue: 50 },
      { key: 'replyToMode', label: 'Reply Mode', type: 'select', options: [
        { value: 'off', text: 'Off' },
        { value: 'first', text: 'First message' },
        { value: 'all', text: 'All messages' },
      ], defaultValue: 'first' },
    ],
  },
  discord: {
    label: 'Discord',
    description: 'Discord Bot via official API. Requires a bot token from Discord Developer Portal.',
    fields: [
      { key: 'token', label: 'Bot Token', type: 'password', required: true, placeholder: 'Bot token from Discord Developer Portal' },
      { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: [
        { value: 'pairing', text: 'Pairing' },
        { value: 'allowlist', text: 'Allowlist' },
        { value: 'open', text: 'Open' },
        { value: 'disabled', text: 'Disabled' },
      ], defaultValue: 'pairing' },
      { key: 'allowFrom', label: 'Allowed User IDs', type: 'textarea', placeholder: 'Discord user IDs, one per line', helperText: 'Discord numeric user IDs.' },
    ],
  },
  slack: {
    label: 'Slack',
    description: 'Slack via Bolt SDK. Requires bot token and app-level token.',
    fields: [
      { key: 'botToken', label: 'Bot Token (xoxb-)', type: 'password', required: true, placeholder: 'xoxb-...' },
      { key: 'appToken', label: 'App Token (xapp-)', type: 'password', required: true, placeholder: 'xapp-...' },
      { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: [
        { value: 'pairing', text: 'Pairing' },
        { value: 'allowlist', text: 'Allowlist' },
        { value: 'open', text: 'Open' },
        { value: 'disabled', text: 'Disabled' },
      ], defaultValue: 'pairing' },
    ],
  },
  signal: {
    label: 'Signal',
    description: 'Signal via signal-cli HTTP daemon. Requires signal-cli installed and registered.',
    fields: [
      { key: 'account', label: 'Account (phone number)', type: 'text', required: true, placeholder: '+15551234567' },
      { key: 'cliPath', label: 'signal-cli Path', type: 'text', placeholder: '/usr/local/bin/signal-cli', helperText: 'Path to signal-cli binary. Leave empty for default.' },
      { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: [
        { value: 'pairing', text: 'Pairing' },
        { value: 'allowlist', text: 'Allowlist' },
        { value: 'open', text: 'Open' },
        { value: 'disabled', text: 'Disabled' },
      ], defaultValue: 'pairing' },
      { key: 'allowFrom', label: 'Allowed Numbers', type: 'textarea', placeholder: '+15551234567', helperText: 'One phone number per line.' },
    ],
  },
  imessage: {
    label: 'iMessage',
    description: 'iMessage via BlueBubbles REST API.',
    fields: [
      { key: 'serverUrl', label: 'BlueBubbles Server URL', type: 'text', placeholder: 'http://localhost:1234', helperText: 'URL of your BlueBubbles server.' },
      { key: 'password', label: 'Server Password', type: 'password', helperText: 'BlueBubbles server password.' },
      { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: [
        { value: 'pairing', text: 'Pairing' },
        { value: 'allowlist', text: 'Allowlist' },
        { value: 'open', text: 'Open' },
        { value: 'disabled', text: 'Disabled' },
      ], defaultValue: 'pairing' },
      { key: 'allowFrom', label: 'Allowed Numbers/Emails', type: 'textarea', placeholder: '+15551234567\nuser@icloud.com', helperText: 'One per line.' },
    ],
  },
  irc: {
    label: 'IRC',
    description: 'IRC channel integration.',
    fields: [
      { key: 'server', label: 'Server', type: 'text', required: true, placeholder: 'irc.libera.chat' },
      { key: 'port', label: 'Port', type: 'number', defaultValue: 6697 },
      { key: 'nick', label: 'Nickname', type: 'text', required: true, placeholder: 'openclaw-bot' },
      { key: 'channels', label: 'Channels', type: 'textarea', placeholder: '#general\n#random', helperText: 'One channel per line.' },
      { key: 'useTls', label: 'Use TLS', type: 'toggle', defaultValue: true },
    ],
  },
  googlechat: {
    label: 'Google Chat',
    description: 'Google Chat via Workspace API.',
    fields: [
      { key: 'serviceAccountKey', label: 'Service Account Key (JSON)', type: 'textarea', required: true, helperText: 'Paste the service account JSON key.' },
      { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: [
        { value: 'pairing', text: 'Pairing' },
        { value: 'open', text: 'Open' },
        { value: 'disabled', text: 'Disabled' },
      ], defaultValue: 'open' },
    ],
  },
};
