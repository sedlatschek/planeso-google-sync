import {
  PlaneClient,
  type Project,
} from '@makeplane/plane-node-sdk';
import type { SyncConfig } from './config.js';
import { logger } from './logger.js';
import { getGoogleAuthClient } from './google/auth.js';
import type { OAuth2Client } from 'google-auth-library';
import {
  createEvent,
  getSyncedEvents,
  updateEvent,
  deleteEvents,
  type EventDto,
} from './google/index.js';
import type { calendar_v3 } from 'googleapis';
import { dateTimeFromIso } from './utility.js';
import {
  isWorkItemWithDates,
  type WorkItemWithDates,
} from './types/WorkItemWithDates.js';
import { PlaneSoGoogleSyncError } from './errors/PlaneSoGoogleSyncError.js';

export async function sync(syncConfig: SyncConfig): Promise<void> {
  logger.info(`Syncing ${syncConfig.plane.workspace}/${syncConfig.plane.projectId} to Google Calendar ${syncConfig.google.calendarId}...`);

  logger.info('Authenticating with Plane.so API...');
  const planeClient = new PlaneClient({
    apiKey: syncConfig.plane.apiKey,
    baseUrl: syncConfig.plane.baseUrl,
  });

  logger.info('Fetching project details from Plane.so...');
  const project = await planeClient.projects.retrieve(syncConfig.plane.workspace, syncConfig.plane.projectId);
  logger.info(`> Authenticated with Plane.so API, project name: ${project.name}`);

  logger.info('Fetching work items from Plane.so...');
  const workItems = await planeClient.workItems.list(
    syncConfig.plane.workspace,
    syncConfig.plane.projectId,
  );
  logger.info(`> Fetched ${workItems.results.length} work items from Plane.so`);

  logger.info('Authenticating with Google API...');
  const auth = await getGoogleAuthClient(syncConfig.google.auth);
  logger.info('> Google authentication successful');

  logger.info('Retrieving existing events from Google Calendar...');
  const calendarEvents = await getSyncedEvents(auth, syncConfig.google.calendarId);
  logger.info(`> Retrieved ${calendarEvents.length} events from Google Calendar`);

  const workItemsWithDates = workItems.results.filter(isWorkItemWithDates);
  logger.info(`Syncing ${workItemsWithDates.length} work items with start and due dates to Google Calendar...`);
  await Promise.all(workItemsWithDates.map(workItem => syncWorkItem(calendarEvents, syncConfig, syncConfig.plane.workspace, project, workItem, auth, syncConfig.google.calendarId)));
  logger.info(`> Synced ${workItemsWithDates.length} work items to Google Calendar`);

  logger.info('Deleting events from Google Calendar that no longer have corresponding work items in Plane.so...');
  const workItemIds = new Set(workItemsWithDates.map(wi => wi.id));
  const eventsToDelete = calendarEvents.filter((event) => {
    const planeIssueId = event.extendedProperties?.private?.planeIssueId;
    return planeIssueId && !workItemIds.has(planeIssueId);
  });
  const deletedEvents = await deleteEvents(auth, syncConfig.google.calendarId, eventsToDelete);
  logger.info(`> Deleted ${deletedEvents.length} events from Google Calendar that no longer have corresponding work items in Plane.so`);

  if (deletedEvents.length !== eventsToDelete.length) {
    throw new PlaneSoGoogleSyncError(`Failed to delete some events from Google Calendar. Expected to delete ${eventsToDelete.length} but deleted ${deletedEvents.length}.`);
  }

  logger.info(`Sync completed for ${syncConfig.plane.workspace}/${syncConfig.plane.projectId}`);
}

function getEventDtoFromWorkItem(syncConfig: SyncConfig, workspace: string, project: Project, workItem: WorkItemWithDates): EventDto {
  return {
    id: workItem.id,
    title: `${syncConfig.google.prefix || ''}${workItem.name}`,
    description: `<a href="https://app.plane.so/${workspace}/browse/${project.identifier}-${workItem.sequence_id}">View in Plane.so</a>`,
    start: dateTimeFromIso(workItem.start_date),
    end: dateTimeFromIso(workItem.target_date),
  };
}

async function syncWorkItem(existingEvents: calendar_v3.Schema$Event[], syncConfig: SyncConfig, workspace: string, project: Project, workItem: WorkItemWithDates, auth: OAuth2Client, calendarId: string): Promise<void> {
  logger.info(`Syncing work item "${workItem.name}"`);

  if (!workItem.start_date || !workItem.target_date) {
    return;
  }

  const matchingEvent = existingEvents.find(event => event.extendedProperties?.private?.planeIssueId === workItem.id);
  const eventDto = getEventDtoFromWorkItem(syncConfig, workspace, project, workItem);

  if (matchingEvent && matchingEvent.id) {
    logger.info(`> Event already exists for work item "${workItem.name}", updating...`);
    await updateEvent(auth, calendarId, matchingEvent.id, eventDto);
    return;
  }

  logger.info(`> Creating event for work item "${workItem.name}"...`);
  await createEvent(auth, calendarId, eventDto);
  logger.info(`> Event created for work item "${workItem.name}"`);
};
