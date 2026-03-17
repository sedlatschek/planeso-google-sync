#!/usr/bin/env node
import { Command } from 'commander';
import {
  DEFAULT_CREDENTIALS_PATH,
  DEFAULT_TOKEN_PATH,
} from './constant.js';
import { getAuthClient } from './auth.js';
import { sync } from './sync.js';
import type { Config } from './types.js';

type CommandOptions = {
  planeToken: string
  workspaceId: string
  calendarId: string
  credentialsPath: string
  tokenPath: string
};

const program = new Command();

program
  .name('planeso-google-sync')
  .description('Sync your Google Calendar status with Plane.so')
  .requiredOption('--plane-token <token>', 'Plane.so API token')
  .requiredOption('--workspace-id <slug>', 'Plane.so workspace slug')
  .requiredOption('--calendar-id <id>', 'Google Calendar ID (e.g. primary)')
  .option('--credentials-path <path>', 'Path to Google OAuth2 credentials.json', DEFAULT_CREDENTIALS_PATH)
  .option('--token-path <path>', 'Path to store the Google OAuth2 token', DEFAULT_TOKEN_PATH)
  .action(async (opts: CommandOptions) => {
    const config: Config = {
      planeToken: opts.planeToken,
      workspaceSlug: opts.workspaceId,
      calendarId: opts.calendarId,
      credentialsPath: opts.credentialsPath,
      tokenPath: opts.tokenPath,
    };

    try {
      const auth = await getAuthClient(config.credentialsPath, config.tokenPath);
      await sync(auth, config);
    }
    catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

await program.parseAsync();
