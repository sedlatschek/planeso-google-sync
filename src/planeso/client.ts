import { PlaneClient } from '@makeplane/plane-node-sdk';
import type { PlaneConfig } from '../config.js';

let client: PlaneClient | undefined;

export function getPlaneClient({
  apiKey,
  baseUrl,
}: PlaneConfig): PlaneClient {
  if (!client) {
    client = new PlaneClient({
      apiKey,
      baseUrl,
    });
  }
  return client;
}
