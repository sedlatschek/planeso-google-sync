#!/usr/bin/env node

if (process.platform === 'win32') {
  const { execSync } = await import('node:child_process');
  try {
    execSync('chcp 65001', { stdio: 'pipe' });
  }
  catch (cause) {
    throw new Error('Could not set code page', { cause });
  }
}

import { Command } from 'commander';
import { sync } from './sync.js';
import { getConfig } from './config.js';
import { logger } from './logger.js';

type CommandOptions = { config: string };

const program = new Command();

program
  .name('planeso-google-sync')
  .description('Sync your Plane.so work items to Google Calendar')
  .option('--config <path>', 'Path to config YAML file', 'planeso-google-sync.config.yml')
  .action(async (opts: CommandOptions) => {
    logger.info('planeso-google-sync starting...');

    const config = await getConfig(opts.config);
    try {
      await Promise.all(config.sync.map(syncConfig => sync(syncConfig)));
    }
    catch (error) {
      logger.error(error);
      process.exit(1);
    }
  });

await program.parseAsync();
