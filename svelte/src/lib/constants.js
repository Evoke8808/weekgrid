export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export const STORE_KEY = 'weekgrid:v1'; // same key as the plain-JS app, so the data format stays compatible
export const SCORE = { done: 1, partial: 0.5, missed: 0 };

export const DAY_COLORS = { mon: '#8fa8e8', tue: '#b3a4e0', wed: '#86cfb0', thu: '#dcc08a', fri: '#d99aa0', sat: '#8fc4d6', sun: '#d6a3c4' };
export const PALETTE = Object.values(DAY_COLORS);
export const VIEWS = [
  { id: 'today', label: 'Today', ink: '#86cfb0' },
  { id: 'week', label: 'Week', ink: '#8fa8e8' },
  { id: 'timetable', label: 'Timetable', ink: '#dcc08a' },
  { id: 'settings', label: 'Settings', ink: '#d6a3c4' }
];
