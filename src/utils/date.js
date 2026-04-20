const startOfUtcDay = (input = new Date()) => {
  const date = new Date(input);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const endOfUtcDay = (input = new Date()) => {
  const start = startOfUtcDay(input);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
};

const toUtcDayString = (input = new Date()) => startOfUtcDay(input).toISOString().slice(0, 10);

const isSameUtcDay = (a, b) => toUtcDayString(a) === toUtcDayString(b);

const getRecentUtcDays = (count = 7) => {
  const days = [];
  const today = startOfUtcDay();

  for (let index = count - 1; index >= 0; index -= 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - index);
    days.push(toUtcDayString(day));
  }

  return days;
};

export { endOfUtcDay, getRecentUtcDays, isSameUtcDay, startOfUtcDay, toUtcDayString };
