import { google } from 'googleapis';
import type {
  Credentials,
  OAuth2Client,
} from 'google-auth-library';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { GOOGLE_SCOPES } from './constant.js';

type GoogleCredentials = {
  installed?: {
    client_id: string
    client_secret: string
    redirect_uris: string[]
  }
  web?: {
    client_id: string
    client_secret: string
    redirect_uris: string[]
  }
};

export async function getAuthClient(credentialsPath: string, tokenPath: string): Promise<OAuth2Client> {
  let raw: string;

  try {
    raw = await fs.readFile(credentialsPath, 'utf-8');
  }
  catch {
    throw new Error(
      `Google credentials not found at ${credentialsPath}.\n`
      + `Download credentials.json from the Google Cloud Console and place it there.`,
    );
  }

  const parsed = JSON.parse(raw) as GoogleCredentials;
  const cred = parsed.installed ?? parsed.web;
  if (!cred) throw new Error('Invalid credentials.json: missing "installed" or "web" key');

  const redirectUri = cred.redirect_uris[0];
  if (!redirectUri) throw new Error('Invalid credentials.json: redirect_uris is empty');

  const auth = new google.auth.OAuth2(cred.client_id, cred.client_secret, redirectUri);

  try {
    const tokenRaw = await fs.readFile(tokenPath, 'utf-8');
    auth.setCredentials(JSON.parse(tokenRaw) as Credentials);
    return auth;
  }
  catch {
    // No saved token yet — start OAuth2 flow below
  }

  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
  });

  console.log(`\nOpen this URL in your browser to authorize:\n\n  ${authUrl}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = (await rl.question('Paste the authorization code here: ')).trim();
  rl.close();

  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);

  await fs.mkdir(path.dirname(tokenPath), { recursive: true });
  await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log(`\nToken saved to ${tokenPath}`);

  return auth;
}
