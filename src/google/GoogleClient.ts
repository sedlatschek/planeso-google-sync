import {
  calendar_v3, google,
} from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import {
  isEventWithId, type EventWithId,
} from '../types/EventWithId.js';
import type { EventDto } from './EventDto.js';

const PLANE_SOURCE_TAG = 'planeso-google-sync';

export type UpsertResult = 'created' | 'updated' | 'unchanged';

export class GoogleClient {
  constructor(private readonly auth: OAuth2Client) { }

  public async getSyncedEvents(calendarId: string): Promise<EventWithId[]> {
    const calendar = google.calendar({
      version: 'v3',
      auth: this.auth,
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

  public async upsertEvent(
    calendarId: string,
    eventDto: EventDto,
    existingEvent?: EventWithId,
  ): Promise<UpsertResult> {
    const calendar = google.calendar({
      version: 'v3',
      auth: this.auth,
    });

    if (!existingEvent) {
      await calendar.events.insert({
        calendarId,
        requestBody: this.buildRequestBody(eventDto),
      });
      return 'created';
    }

    if (this.eventMatchesDto(existingEvent, eventDto)) {
      return 'unchanged';
    }

    await calendar.events.update({
      calendarId,
      eventId: existingEvent.id,
      requestBody: this.buildRequestBody(eventDto),
    });
    return 'updated';
  }

  public async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const calendar = google.calendar({
      version: 'v3',
      auth: this.auth,
    });
    await calendar.events.delete({
      calendarId,
      eventId,
    });
  }

  public async deleteEvents(calendarId: string, events: EventWithId[]): Promise<EventWithId[]> {
    const deletedEvents = await Promise.all(events.map((event) => {
      if (event.id) {
        return this.deleteEvent(calendarId, event.id).then(() => event);
      }
      return Promise.resolve(undefined);
    }));
    return deletedEvents.filter((event): event is EventWithId => event !== undefined);
  }

  private buildRequestBody(eventDto: EventDto): calendar_v3.Schema$Event {
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

  private eventMatchesDto(event: EventWithId, eventDto: EventDto): boolean {
    return (
      event.summary === eventDto.title
      && event.description === eventDto.description
      && event.start?.date === eventDto.start.toISODate()
      && event.end?.date === eventDto.end.toISODate()
    );
  }
}
