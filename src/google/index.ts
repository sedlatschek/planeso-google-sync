import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { calendar_v3 } from 'googleapis';
import type { DateTime } from 'luxon';

export type CalendarEvent = calendar_v3.Schema$Event;

const PLANE_SOURCE_TAG = 'planeso-google-sync';

export type EventDto = {
  id: string
  title: string
  description: string
  start: DateTime<true>
  end: DateTime<true>
};

export async function getSyncedEvents(auth: OAuth2Client, calendarId: string): Promise<CalendarEvent[]> {
  const calendar = google.calendar({
    version: 'v3',
    auth,
  });
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const response = await calendar.events.list({
      calendarId,
      privateExtendedProperty: [`planeSource=${PLANE_SOURCE_TAG}`],
      showDeleted: false,
      singleEvents: true,
      maxResults: 250,
      ...(pageToken ? { pageToken } : {}),
    });
    events.push(...(response.data.items ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}

export async function createEvent(auth: OAuth2Client, calendarId: string, eventDto: EventDto): Promise<void> {
  const calendar = google.calendar({
    version: 'v3',
    auth,
  });
  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: eventDto.title,
      description: eventDto.description,
      start: { date: eventDto.start.toISODate() },
      end: { date: eventDto.end.toISODate() },
      extendedProperties: { private: {
        planeSource: PLANE_SOURCE_TAG,
        planeIssueId: eventDto.id,
      } },
    },
  });
}

export async function updateEvent(auth: OAuth2Client, calendarId: string, eventId: string, eventDto: EventDto): Promise<void> {
  const calendar = google.calendar({
    version: 'v3',
    auth,
  });
  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: {
      summary: eventDto.title,
      description: eventDto.description,
      start: { date: eventDto.start.toISODate() },
      end: { date: eventDto.end.toISODate() },
      extendedProperties: { private: {
        planeSource: PLANE_SOURCE_TAG,
        planeIssueId: eventDto.id,
      } },
    },
  });
}

export async function deleteEvent(auth: OAuth2Client, calendarId: string, eventId: string): Promise<void> {
  const calendar = google.calendar({
    version: 'v3',
    auth,
  });
  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

export async function deleteEvents(auth: OAuth2Client, calendarId: string, events: calendar_v3.Schema$Event[]): Promise<calendar_v3.Schema$Event[]> {
  const deletedEvents = await Promise.all(events.map((event) => {
    if (event.id) {
      return deleteEvent(auth, calendarId, event.id).then(() => event);
    }
    return Promise.resolve(undefined);
  }));
  return deletedEvents.filter((event): event is calendar_v3.Schema$Event => event !== undefined);
}
