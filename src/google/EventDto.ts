import type { DateTime } from 'luxon';

export type EventDto = {
  id: string
  title: string
  description: string
  start: DateTime<true>
  end: DateTime<true>
};
