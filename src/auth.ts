import { google } from 'googleapis';
import type {
  Credentials,
  OAuth2Client,
} from 'google-auth-library';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { GOOGLE_SCOPES } from './constant.js';
import type { GoogleAuthConfig } from './config.js';

export async function getAuthClient({
  redirect_uris, client_id, client_secret, tokenPath,
}: GoogleAuthConfig): Promise<OAuth2Client> {
  const redirectUri = redirect_uris[0];
  if (!redirectUri) throw new Error('Invalid Google auth config: redirect_uris is empty');

  const authClient = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  if ((await fs.stat(tokenPath)).isFile()) {
    const tokenRaw = await fs.readFile(tokenPath, 'utf-8');
    authClient.setCredentials(JSON.parse(tokenRaw) as Credentials);
    return authClient;
  }

  const authUrl = authClient.generateAuthUrl({
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

  const { tokens } = await authClient.getToken(code);
  authClient.setCredentials(tokens);

  await fs.mkdir(path.dirname(tokenPath), { recursive: true });
  await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log(`\nToken saved to ${tokenPath}`);

  return authClient;
}
