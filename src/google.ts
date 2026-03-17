import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { calendar_v3 } from 'googleapis';

export type CalendarEvent = calendar_v3.Schema$Event;

export async function getCurrentEvents(auth: OAuth2Client, calendarId: string): Promise<CalendarEvent[]> {
  const calendar = google.calendar({
    version: 'v3',
    auth,
  });

  const now = new Date();
  // Fetch a wide window to capture long-running events that started before now
  const timeMin = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 60 * 1000).toISOString();

  const response = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = response.data.items ?? [];
  const nowMs = now.getTime();

  return events.filter((event) => {
    const start = event.start?.dateTime ?? event.start?.date;
    const end = event.end?.dateTime ?? event.end?.date;
    if (!start || !end) return false;
    return new Date(start).getTime() <= nowMs && new Date(end).getTime() >= nowMs;
  });
}
