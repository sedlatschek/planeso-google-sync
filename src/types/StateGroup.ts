import type { GroupEnum } from '@makeplane/plane-node-sdk';
import { z } from 'zod';

// GroupEnum is not an actual enum in the Plane SDK, so we cant use z.nativeEnum. We have to redefine it here for validation purposes.
export const stateGroupValues: GroupEnum[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'cancelled',
  'triage',
] as const;

export const stateGroupSchema = z.enum(stateGroupValues);

export type StateGroup = z.infer<typeof stateGroupSchema>;
