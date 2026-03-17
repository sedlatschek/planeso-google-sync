import os from 'node:os';
import path from 'node:path';

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'planeso-google-sync');
export const DEFAULT_TOKEN_PATH = path.join(CONFIG_DIR, 'token.json');

export const PLANE_API_BASE = 'https://api.plane.so/api/v1';

export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
