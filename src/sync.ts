import type { OAuth2Client } from 'google-auth-library';
import type { Config } from './types.js';
import { getCurrentEvents } from './google.js';
import { updateMemberStatus } from './plane.js';

export async function sync(auth: OAuth2Client, config: Config): Promise<void> {
  console.log('Fetching current Google Calendar events...');
  const events = await getCurrentEvents(auth, config.calendarId);

  if (events.length > 0) {
    const titles = events.map(e => e.summary ?? '(untitled)').join(', ');
    console.log(`Active events: ${titles}`);
    await updateMemberStatus(config.planeToken, config.workspaceSlug, 'busy', titles);
    console.log('Plane.so status → busy');
  }
  else {
    console.log('No active events.');
    await updateMemberStatus(config.planeToken, config.workspaceSlug, 'online');
    console.log('Plane.so status → online');
  }
}
