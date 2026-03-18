import {
  DateTime,
  type DateTimeOptions,
} from 'luxon';
import { PlaneSoGoogleSyncError } from './errors/PlaneSoGoogleSyncError.js';

export function dateTimeFromIso(isoString: string, opts?: DateTimeOptions): DateTime<true> {
  const dateTime = DateTime.fromISO(isoString, opts);
  if (!dateTime.isValid) {
    throw new PlaneSoGoogleSyncError(`Invalid ISO date string: ${isoString}`);
  }
  return dateTime;
}
