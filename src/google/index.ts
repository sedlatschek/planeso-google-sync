import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { calendar_v3 } from 'googleapis';
import type { DateTime } from 'luxon';
import {
  isEventWithId,
  type EventWithId,
} from '../types/EventWithId.js';

const PLANE_SOURCE_TAG = 'planeso-google-sync';

export type EventDto = {
  id: string
  title: string
  description: string
  start: DateTime<true>
  end: DateTime<true>
};

export async function getSyncedEvents(auth: OAuth2Client, calendarId: string): Promise<EventWithId[]> {
  const calendar = google.calendar({
    version: 'v3',
    auth,
  });
  const events: EventWithId[] = [];
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
    events.push(...(response.data.items?.filter(isEventWithId) ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}

function buildRequestBody(eventDto: EventDto): calendar_v3.Schema$Event {
  return {
    summary: eventDto.title,
    description: eventDto.description,
    start: { date: eventDto.start.toISODate() },
    end: { date: eventDto.end.toISODate() },
    extendedProperties: { private: {
      planeSource: PLANE_SOURCE_TAG,
      planeIssueId: eventDto.id,
    } },
  };
}

function eventMatchesDto(event: EventWithId, eventDto: EventDto): boolean {
  return (
    event.summary === eventDto.title
    && event.description === eventDto.description
    && event.start?.date === eventDto.start.toISODate()
    && event.end?.date === eventDto.end.toISODate()
  );
}

export type UpsertResult = 'created' | 'updated' | 'unchanged';

export async function upsertEvent(
  auth: OAuth2Client,
  calendarId: string,
  eventDto: EventDto,
  existingEvent?: EventWithId,
): Promise<UpsertResult> {
  const calendar = google.calendar({
    version: 'v3',
    auth,
  });

  if (!existingEvent) {
    await calendar.events.insert({
      calendarId,
      requestBody: buildRequestBody(eventDto),
    });
    return 'created';
  }

  if (eventMatchesDto(existingEvent, eventDto)) {
    return 'unchanged';
  }

  await calendar.events.update({
    calendarId,
    eventId: existingEvent.id,
    requestBody: buildRequestBody(eventDto),
  });
  return 'updated';
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

export async function deleteEvents(auth: OAuth2Client, calendarId: string, events: EventWithId[]): Promise<EventWithId[]> {
  const deletedEvents = await Promise.all(events.map((event) => {
    if (event.id) {
      return deleteEvent(auth, calendarId, event.id).then(() => event);
    }
    return Promise.resolve(undefined);
  }));
  return deletedEvents.filter((event): event is EventWithId => event !== undefined);
}
