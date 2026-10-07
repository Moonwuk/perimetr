const ratings = new Set(['0+', '6+', '12+', '16+', '18+']);
const placeholder = value => typeof value !== 'string' || !value.trim() || /\[|\]|TODO|PLACEHOLDER/i.test(value);

function publicHttps(value, origin = false) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port) return false;
    if (host === 'localhost' || host === '[::1]' || host === '[::]' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.test') || host.endsWith('.invalid') || host.endsWith('.example') || /^(example\.(com|org|net))$/.test(host)) return false;
    const ip = host.split('.').map(Number);
    if (ip.length === 4 && ip.every(Number.isInteger) && (ip[0] === 0 || ip[0] === 10 || ip[0] === 127 || ip[0] >= 224 || (ip[0] === 169 && ip[1] === 254) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) || (ip[0] === 192 && ip[1] === 168))) return false;
    if (host.startsWith('[fc') || host.startsWith('[fd') || host.startsWith('[fe80:')) return false;
    return !origin || url.origin === value;
  } catch { return false; }
}

export function publicationErrors(config) {
  const errors = [];
  if (!publicHttps(config.onlineOrigin, true)) errors.push('onlineOrigin: нужен точный публичный HTTPS origin сервера без пути.');
  if (!publicHttps(config.privacyPolicyUrl)) errors.push('privacyPolicyUrl: нужна опубликованная политика по публичному HTTPS URL.');
  if (placeholder(config.supportContact) || !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportContact) || publicHttps(config.supportContact))) errors.push('supportContact: укажите email поддержки или публичную HTTPS страницу для обращений.');
  if (placeholder(config.dataControllerName) || config.dataControllerName.length > 300) errors.push('dataControllerName: укажите ответственное лицо или наименование владельца данных.');
  if (!ratings.has(config.ageRating)) errors.push('ageRating: перенесите результат возрастной анкеты RuStore (0+, 6+, 12+, 16+ или 18+).');
  return errors;
}
