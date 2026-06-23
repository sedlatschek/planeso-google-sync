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
import http from 'node:http';
import { exec } from 'node:child_process';
import {
  dirname,
  join,
} from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { GoogleAuthConfig } from '../config.js';
import { logger } from '../logger.js';
import { PlaneSoGoogleSyncError } from '../errors/PlaneSoGoogleSyncError.js';
import { CONFIG_DIR } from '../constant.js';

const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function openBrowser(url: string): void {
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) logger.debug(`Could not open browser automatically: ${err.message}`);
  });
}

function waitForLocalCallback(redirectUri: string, localPort?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(redirectUri);
    const port = localPort ?? parseInt(url.port || '80', 10);
    const callbackPath = url.pathname;

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url ?? '/', `http://localhost:${port}`);
      if (reqUrl.pathname !== callbackPath) {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Authorization failed.</h2><p>You can close this tab.</p></body></html>');
        server.close();
        reject(new PlaneSoGoogleSyncError(`Google OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Authorization successful!</h2><p>You can close this tab.</p></body></html>');
      server.close();
      resolve(code);
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      logger.debug(`Listening for OAuth callback on port ${port}`);
    });
  });
}

function isLocalhostRedirectUri(uri: string): boolean {
  try {
    const { hostname } = new URL(uri);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  }
  catch {
    return false;
  }
}

export async function getGoogleAuthClient(googleAuthConfig: GoogleAuthConfig): Promise<{
  authClient: OAuth2Client
  tokenFile: string
}> {
  const {
    redirectUris,
    clientId,
    clientSecret,
    localPort,
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
    authClient.on('tokens', async (tokens) => {
      const existing = JSON.parse(await readFile(tokenFile, 'utf-8').catch(() => '{}')) as Credentials;
      await writeFile(tokenFile, JSON.stringify({
        ...existing,
        ...tokens,
      }, null, 2), 'utf-8');
    });
    return {
      authClient,
      tokenFile,
    };
  }

  const authUrl = authClient.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
  });

  let code: string;

  if (isLocalhostRedirectUri(redirectUri)) {
    const callbackPromise = waitForLocalCallback(redirectUri, localPort);
    logger.info(`\nOpening browser for Google authorization...\n\n  ${authUrl}\n`);
    logger.info('If the browser does not open, paste the URL above manually.');
    openBrowser(authUrl);
    code = await callbackPromise;
  }
  else {
    logger.info(`\nOpen this URL in your browser to authorize:\n\n  ${authUrl}\n`);
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    code = (await readline.question('Paste the authorization code here: ')).trim();
    readline.close();
  }

  const { tokens } = await authClient.getToken(code);
  authClient.setCredentials(tokens);

  await mkdir(dirname(tokenFile), { recursive: true });
  await writeFile(tokenFile, JSON.stringify(tokens, null, 2), 'utf-8');
  logger.info(`\nToken saved to ${tokenFile}`);

  return {
    authClient,
    tokenFile,
  };
}
