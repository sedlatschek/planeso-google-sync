import {
  calendar_v3,
  google,
} from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { GaxiosError } from 'gaxios';
import PQueue from 'p-queue';
import { rm } from 'node:fs/promises';
import {
  isEventWithId,
  type EventWithId,
} from '../types/EventWithId.js';
import type { EventDto } from './EventDto.js';
import { PlaneSoGoogleSyncError } from '../errors/PlaneSoGoogleSyncError.js';

const PLANE_SOURCE_TAG = 'planeso-google-sync';

export type UpsertResult = 'created' | 'updated' | 'unchanged';

export class GoogleClient {
  private readonly queue = new PQueue({
    intervalCap: 3,
    interval: 1000,
  });

  constructor(
    private readonly auth: OAuth2Client,
    private readonly tokenFilePath?: string,
  ) { }

  private async handleApiError(error: unknown): Promise<never> {
    if (
      error instanceof GaxiosError
      && (error.message.includes('invalid_grant') || error.response?.data?.error === 'invalid_grant')
    ) {
      if (this.tokenFilePath) {
        await rm(this.tokenFilePath, { force: true });
        throw new PlaneSoGoogleSyncError(
          `Google OAuth refresh token is invalid or expired. The token file at "${this.tokenFilePath}" has been deleted. Re-run the application to re-authenticate.`,
        );
      }
      throw new PlaneSoGoogleSyncError(
        'Google OAuth refresh token is invalid or expired. Delete your token file and re-run the application to re-authenticate.',
      );
    }
    throw error;
  }

  public async getSyncedEvents(calendarId: string): Promise<EventWithId[]> {
    const calendar = google.calendar({
      version: 'v3',
      auth: this.auth,
    });
    const events: EventWithId[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const response = await this.queue.add(() => calendar.events.list({
          calendarId,
          privateExtendedProperty: [`planeSource=${PLANE_SOURCE_TAG}`],
          showDeleted: false,
          singleEvents: true,
          maxResults: 250,
          ...(pageToken ? { pageToken } : {}),
        }));
        events.push(...(response?.data.items?.filter(isEventWithId) ?? []));
        pageToken = response?.data.nextPageToken ?? undefined;
      } while (pageToken);
    }
    catch (error) {
      await this.handleApiError(error);
    }

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
      await this.queue.add(() => calendar.events.insert({
        calendarId,
        requestBody: this.buildRequestBody(eventDto),
      }));
      return 'created';
    }

    if (this.eventMatchesDto(existingEvent, eventDto)) {
      return 'unchanged';
    }

    await this.queue.add(() => calendar.events.patch({
      calendarId,
      eventId: existingEvent.id,
      sendUpdates: 'all',
      requestBody: this.buildRequestBody(eventDto, existingEvent.attendees ?? []),
    }));
    return 'updated';
  }

  public async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const calendar = google.calendar({
      version: 'v3',
      auth: this.auth,
    });
    await this.queue.add(() => calendar.events.delete({
      calendarId,
      eventId,
    }));
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

  private buildRequestBody(eventDto: EventDto, attendees: calendar_v3.Schema$EventAttendee[] = []): calendar_v3.Schema$Event {
    return {
      summary: eventDto.title,
      description: eventDto.description,
      start: { date: eventDto.start.toISODate() },
      end: { date: eventDto.end.plus({ days: 1 }).toISODate() },
      extendedProperties: { private: {
        planeSource: PLANE_SOURCE_TAG,
        planeIssueId: eventDto.id,
      } },
      ...(attendees.length > 0 ? { attendees } : {}),
    };
  }

  private eventMatchesDto(event: EventWithId, eventDto: EventDto): boolean {
    return (
      event.summary === eventDto.title
      && event.description === eventDto.description
      && event.start?.date === eventDto.start.toISODate()
      && event.end?.date === eventDto.end.plus({ days: 1 }).toISODate()
    );
  }
}
