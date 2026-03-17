import { PLANE_API_BASE } from './constant.js';
import type { PlaneAvailability } from './types.js';

type StatusBody = {
  availability: PlaneAvailability
  status_message?: string
};

export async function updateMemberStatus(
  token: string,
  workspaceSlug: string,
  availability: PlaneAvailability,
  statusMessage?: string,
): Promise<void> {
  const url = `${PLANE_API_BASE}/workspaces/${workspaceSlug}/members/me/`;

  const body: StatusBody = { availability };
  if (statusMessage !== undefined) {
    body.status_message = statusMessage;
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': token,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Plane.so API error (${url}: ${response.status}): ${text}`);
  }
}
