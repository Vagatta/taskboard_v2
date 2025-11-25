export function parseDateInput(value, { endOfDay = false } = {}) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

export function formatRelativeTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = date.getTime() - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

  const units = [
    { max: 60, divisor: 1, unit: 'second' },
    { max: 3600, divisor: 60, unit: 'minute' },
    { max: 86400, divisor: 3600, unit: 'hour' },
    { max: 604800, divisor: 86400, unit: 'day' },
    { max: 2629800, divisor: 604800, unit: 'week' },
    { max: 31557600, divisor: 2629800, unit: 'month' }
  ];

  for (const { max, divisor, unit } of units) {
    if (absSeconds < max) {
      const value = Math.round(diffSeconds / divisor);
      return formatter.format(value, unit);
    }
  }

  const years = Math.round(diffSeconds / 31557600);
  return formatter.format(years, 'year');
}

export function humanizeEventType(eventType) {
  if (!eventType) {
    return '';
  }

  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
