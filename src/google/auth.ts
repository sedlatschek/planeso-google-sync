import { google } from 'googleapis';
import type {
  Credentials,
  OAuth2Client,
} from 'google-auth-library';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import readline from 'node:readline/promises';
import type { GoogleAuthConfig } from '../config.js';
import { logger } from '../logger.js';
import { PlaneSoGoogleSyncError } from '../errors/PlaneSoGoogleSyncError.js';
import { CONFIG_DIR } from '../constant.js';

const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export async function getGoogleAuthClient(googleAuthConfig: GoogleAuthConfig): Promise<OAuth2Client> {
  const {
    redirectUris,
    clientId,
    clientSecret,
  } = googleAuthConfig;

  const redirectUri = redirectUris[0];
  if (!redirectUri) {
    throw new PlaneSoGoogleSyncError('Invalid Google auth config: redirectUris is empty');
  }

  const authClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const tokenFile = googleAuthConfig.tokenFile || join(CONFIG_DIR, `${clientId}.token.json`);
  let tokenRaw: string | undefined;
  try {
    tokenRaw = await readFile(tokenFile, 'utf-8');
  }
  catch {
    logger.info(`No existing token found at ${tokenFile}, starting new OAuth2 flow`);
  }

  if (tokenRaw !== undefined) {
    authClient.setCredentials(JSON.parse(tokenRaw) as Credentials);
    return authClient;
  }

  const authUrl = authClient.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
  });

  logger.info(`\nOpen this URL in your browser to authorize:\n\n  ${authUrl}\n`);

  const readonline = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = (await readonline.question('Paste the authorization code here: ')).trim();
  readonline.close();

  const { tokens } = await authClient.getToken(code);
  authClient.setCredentials(tokens);

  await mkdir(dirname(tokenFile), { recursive: true });
  await writeFile(tokenFile, JSON.stringify(tokens, null, 2), 'utf-8');
  logger.info(`\nToken saved to ${tokenFile}`);

  return authClient;
}
