import {
  PlaneClient,
  type Project,
} from '@makeplane/plane-node-sdk';
import type { SyncConfig } from './config.js';
import { logger } from './logger.js';
import { getGoogleAuthClient } from './google/auth.js';
import { dateTimeFromIso } from './utility.js';
import {
  isWorkItemWithDate,
  type WorkItemWithDateAndState,
} from './types/WorkItemWithDate.js';
import { PlaneSoGoogleSyncError } from './errors/PlaneSoGoogleSyncError.js';
import type { EventWithId } from './types/EventWithId.js';
import { GoogleClient } from './google/GoogleClient.js';
import type { EventDto } from './google/EventDto.js';
import {
  stateGroupValues,
  type StateGroup,
} from './types/StateGroup.js';

type StateGroupMap = Map<string, StateGroup>;

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

  logger.info('Fetching states from Plane.so...');
  const stateGroups = await getStateGroupMap(syncConfig, planeClient);
  logger.info(`> Fetched ${stateGroups.size} states from Plane.so`);

  logger.info('Authenticating with Google API...');
  const {
    authClient,
    tokenFile,
  } = await getGoogleAuthClient(syncConfig.google.auth);
  const googleClient = new GoogleClient(authClient, tokenFile);
  logger.info('> Google authentication successful');

  logger.info('Retrieving existing events from Google Calendar...');
  const calendarEvents = await googleClient.getSyncedEvents(syncConfig.google.calendarId);
  logger.info(`> Retrieved ${calendarEvents.length} events from Google Calendar`);

  const workItemsWithDates = workItems.results.filter(isWorkItemWithDate);
  logger.info(`Syncing ${workItemsWithDates.length} work items with due dates to Google Calendar...`);
  await Promise.all(workItemsWithDates.map(workItem => syncWorkItem(calendarEvents, syncConfig, syncConfig.plane.workspace, project, workItem, googleClient, stateGroups)));
  logger.info(`> Synced ${workItemsWithDates.length} work items to Google Calendar`);

  logger.info('Deleting events from Google Calendar that no longer have corresponding work items in Plane.so...');
  const workItemIds = new Set(workItemsWithDates.map(wi => wi.id));
  const eventsToDelete = calendarEvents.filter((event) => {
    const planeIssueId = event.extendedProperties?.private?.planeIssueId;
    return planeIssueId && !workItemIds.has(planeIssueId);
  });
  const deletedEvents = await googleClient.deleteEvents(syncConfig.google.calendarId, eventsToDelete);
  logger.info(`> Deleted ${deletedEvents.length} events from Google Calendar that no longer have corresponding work items in Plane.so`);

  if (deletedEvents.length !== eventsToDelete.length) {
    throw new PlaneSoGoogleSyncError(`Failed to delete some events from Google Calendar. Expected to delete ${eventsToDelete.length} but deleted ${deletedEvents.length}.`);
  }

  logger.info(`Sync completed for ${syncConfig.plane.workspace}/${project.name}`);
}

async function getStateGroupMap(syncConfig: SyncConfig, planeClient: PlaneClient): Promise<Map<string, StateGroup>> {
  const statesResponse = await planeClient.states.list(syncConfig.plane.workspace, syncConfig.plane.projectId);

  const stateGroupById = new Map(statesResponse.results.map((state) => {
    const stateGroup = stateGroupValues.find(group => state.group === group);
    if (!stateGroup) {
      throw new PlaneSoGoogleSyncError(`No state found for group "${state.group}" in Plane.so project ${syncConfig.plane.projectId}`);
    }
    return [
      state.id,
      stateGroup,
    ];
  }));

  return stateGroupById;
}

function getPrefix(syncConfig: SyncConfig, workItem: WorkItemWithDateAndState): string {
  const isDueDateOnly = !workItem.start_date;
  return isDueDateOnly
    ? (syncConfig.google.singleDayPrefix ?? syncConfig.google.multiDayPrefix ?? '')
    : (syncConfig.google.multiDayPrefix ?? '');
}

function getSuffix(syncConfig: SyncConfig, workItem: WorkItemWithDateAndState, stateGroups: StateGroupMap): string {
  const stateGroup = stateGroups.get(workItem.state);
  return stateGroup ? syncConfig.google.stateSuffixes?.[stateGroup] ?? '' : '';
}

function getEventDtoFromWorkItem(syncConfig: SyncConfig, workspace: string, project: Project, workItem: WorkItemWithDateAndState, stateGroups: StateGroupMap): EventDto {
  const prefix = getPrefix(syncConfig, workItem);
  const suffix = getSuffix(syncConfig, workItem, stateGroups);

  const viewLink = `<a href="https://app.plane.so/${workspace}/browse/${project.identifier}-${workItem.sequence_id}">View in Plane.so</a>`;
  const description = syncConfig.google.syncDescriptions && workItem.description_html
    ? `${viewLink}<br>${workItem.description_html}`
    : viewLink;

  return {
    id: workItem.id,
    title: `${prefix}${workItem.name}${suffix}`,
    description,
    start: dateTimeFromIso(workItem.start_date ?? workItem.target_date),
    end: dateTimeFromIso(workItem.target_date),
  };
}

async function syncWorkItem(existingEvents: EventWithId[], syncConfig: SyncConfig, workspace: string, project: Project, workItem: WorkItemWithDateAndState, googleClient: GoogleClient, stateGroups: StateGroupMap): Promise<void> {
  logger.info(`Syncing work item "${workItem.name}"`);

  const matchingEvent = existingEvents.find(event => event.extendedProperties?.private?.planeIssueId === workItem.id);
  const eventDto = getEventDtoFromWorkItem(syncConfig, workspace, project, workItem, stateGroups);
  const result = await googleClient.upsertEvent(syncConfig.google.calendarId, eventDto, matchingEvent);

  if (result === 'created') logger.info(`> Created event for work item "${workItem.name}"`);
  else if (result === 'updated') logger.info(`> Updated event for work item "${workItem.name}"`);
  else logger.info(`> Event for work item "${workItem.name}" is already up to date, skipping`);
}
