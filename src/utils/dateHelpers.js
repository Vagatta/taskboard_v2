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

export function calculateStreak(completedDates) {
  if (!Array.isArray(completedDates) || completedDates.length === 0) return 0;

  const normalizeDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const getPreviousWorkingDay = (date) => {
    const previous = new Date(date);
    previous.setDate(previous.getDate() - 1);

    while (isWeekend(previous)) {
      previous.setDate(previous.getDate() - 1);
    }

    return previous;
  };

  const uniqueDates = [...new Set(
    completedDates
      .map((value) => normalizeDate(value))
      .filter(Boolean)
      .map((date) => toDateKey(date))
  )].sort().reverse();

  if (uniqueDates.length === 0) return 0;

  const latestActivity = normalizeDate(uniqueDates[0]);
  const today = normalizeDate(new Date());
  const referenceDate = isWeekend(today) ? getPreviousWorkingDay(today) : today;
  const previousWorkingDay = getPreviousWorkingDay(referenceDate);
  const latestActivityKey = toDateKey(latestActivity);

  if (latestActivityKey !== toDateKey(referenceDate) && latestActivityKey !== toDateKey(previousWorkingDay)) {
    return 0;
  }

  let streak = 0;
  let expectedDate = latestActivity;

  for (let i = 0; i < uniqueDates.length; i++) {
    const expectedKey = toDateKey(expectedDate);
    if (uniqueDates[i] !== expectedKey) {
      break;
    }

    streak++;
    expectedDate = getPreviousWorkingDay(expectedDate);
  }

  return streak;
}
