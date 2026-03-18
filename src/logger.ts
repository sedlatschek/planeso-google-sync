import pino from 'pino';

export const logger = pino({
  name: 'planeso-google-sync',
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: { target: 'pino-pretty' },
});
