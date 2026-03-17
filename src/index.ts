#!/usr/bin/env node
import { Command } from 'commander';
import { getAuthClient } from './auth.js';
import { sync } from './sync.js';
import { getConfig } from './config.js';

type CommandOptions = { config: string };

const program = new Command();

program
  .name('planeso-google-sync')
  .description('Sync your Google Calendar status with Plane.so')
  .option('--config <path>', 'Path to config YAML file', 'planeso-google-sync.config.yml')
  .action(async (opts: CommandOptions) => {
    const config = await getConfig(opts.config);
    try {
      const auth = await getAuthClient(config.google.auth);
      await sync(auth, config);
    }
    catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

await program.parseAsync();
