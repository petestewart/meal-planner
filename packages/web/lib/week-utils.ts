/**
 * Week Utility Functions for ISO Week Format
 *
 * The backend uses ISO week format: "YYYY-Www" (e.g., "2026-W01")
 * - Week 1 is the week containing the first Thursday of the year
 * - Weeks start on Monday
 */

import {
  format,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  parseISO,
} from 'date-fns';

/**
 * Get the current ISO week string
 * @returns ISO week string like "2026-W01"
 */
export function getCurrentWeek(): string {
  const now = new Date();
  const year = getISOWeekYear(now);
  const week = getISOWeek(now);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Parse an ISO week string into a Date object (first day of that week - Monday)
 * @param isoWeek - ISO week string like "2026-W01"
 * @returns Date object for the Monday of that week
 */
export function parseISOWeek(isoWeek: string): Date {
  // Parse format: "2026-W01"
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid ISO week format: ${isoWeek}. Expected format: YYYY-Www`);
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Get January 4th of the year (always in week 1 per ISO 8601)
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = startOfISOWeek(jan4);

  // Add the required number of weeks
  return addWeeks(startOfWeek1, week - 1);
}

/**
 * Get an array of 7 Date objects for each day of the specified ISO week
 * @param isoWeek - ISO week string like "2026-W01"
 * @returns Array of 7 Date objects (Monday through Sunday)
 */
export function getWeekDates(isoWeek: string): Date[] {
  const weekStart = parseISOWeek(isoWeek);
  const weekEnd = endOfISOWeek(weekStart);

  return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

/**
 * Format an ISO week for display
 * @param isoWeek - ISO week string like "2026-W01"
 * @returns Formatted string like "Jan 5-11, 2026"
 */
export function formatWeekDisplay(isoWeek: string): string {
  const dates = getWeekDates(isoWeek);
  const start = dates[0];
  const end = dates[6];

  const startMonth = format(start, 'MMM');
  const endMonth = format(end, 'MMM');
  const startDay = format(start, 'd');
  const endDay = format(end, 'd');
  const year = format(end, 'yyyy');

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  } else {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }
}

/**
 * Get the previous week's ISO week string
 * @param isoWeek - Current ISO week string
 * @returns Previous week's ISO week string
 */
export function getPreviousWeek(isoWeek: string): string {
  const currentDate = parseISOWeek(isoWeek);
  const previousWeekDate = subWeeks(currentDate, 1);
  const year = getISOWeekYear(previousWeekDate);
  const week = getISOWeek(previousWeekDate);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Get the next week's ISO week string
 * @param isoWeek - Current ISO week string
 * @returns Next week's ISO week string
 */
export function getNextWeek(isoWeek: string): string {
  const currentDate = parseISOWeek(isoWeek);
  const nextWeekDate = addWeeks(currentDate, 1);
  const year = getISOWeekYear(nextWeekDate);
  const week = getISOWeek(nextWeekDate);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Check if the given ISO week is the current week
 * @param isoWeek - ISO week string to check
 * @returns true if it's the current week
 */
export function isCurrentWeek(isoWeek: string): boolean {
  return isoWeek === getCurrentWeek();
}

/**
 * Get the day name for a date
 * @param date - Date object
 * @returns Day name like "Mon", "Tue", etc.
 */
export function getDayName(date: Date): string {
  return format(date, 'EEE');
}

/**
 * Get the day number (1-7, Monday = 1) for a date
 * @param date - Date object
 * @returns Day number 1-7
 */
export function getDayOfWeek(date: Date): number {
  const day = date.getDay();
  // Convert Sunday = 0 to Sunday = 7, and shift others
  return day === 0 ? 7 : day;
}

/**
 * Format a date for display in the calendar grid
 * @param date - Date object
 * @returns Formatted string like "5" (just the day number)
 */
export function formatDayNumber(date: Date): string {
  return format(date, 'd');
}

/**
 * Check if a date is today
 * @param date - Date object to check
 * @returns true if the date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
