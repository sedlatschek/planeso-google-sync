export type Config = {
  planeToken: string
  workspaceSlug: string
  calendarId: string
  credentialsPath: string
  tokenPath: string
};

export type PlaneAvailability = 'online' | 'busy';
