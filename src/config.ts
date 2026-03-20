import { readFile } from 'fs/promises';
import { z } from 'zod';
import jsYaml from 'js-yaml';

const googleAuthConfigSchema = z.object({
  clientId: z.string().min(1, 'Google OAuth2 client ID is required'),
  projectId: z.string().min(1, 'Google OAuth2 project ID is required'),
  authUri: z.string().min(1, 'Google OAuth2 auth URI is required'),
  tokenUri: z.string().min(1, 'Google OAuth2 token URI is required'),
  authProviderX509CertUrl: z.string().min(1, 'Google OAuth2 auth provider x509 cert URL is required'),
  clientSecret: z.string().min(1, 'Google OAuth2 client secret is required'),
  redirectUris: z.array(z.string()).min(1, 'Google OAuth2 redirect URIs are required'),
  tokenFile: z.string().optional(),
});

export type GoogleAuthConfig = z.infer<typeof googleAuthConfigSchema>;

const planeConfigSchema = z.object({
  baseUrl: z.string().url('Plane.so API base URL must be a valid URL').default('https://api.plane.so'),
  apiKey: z.string().min(1, 'Plane API token is required'),
  workspace: z.string().min(1, 'Plane workspace slug is required'),
  projectId: z.string().min(1, 'Plane project ID is required'),
});

export type PlaneConfig = z.infer<typeof planeConfigSchema>;

const syncConfigSchema = z.object({
  google: z.object({
    calendarId: z.string().min(1, 'Google Calendar ID is required'),
    singleDayPrefix: z.string().optional(),
    multiDayPrefix: z.string().optional(),
    auth: googleAuthConfigSchema,
  }),
  plane: planeConfigSchema,
});

export type SyncConfig = z.infer<typeof syncConfigSchema>;

export const configSchema = z.object({ sync: z.array(syncConfigSchema).min(1, 'At least one sync configuration is required') });

export type Config = z.infer<typeof configSchema>;

export async function getConfig(configFile: string): Promise<Config> {
  const content = await readFile(configFile, 'utf8');
  const yaml = jsYaml.load(content);
  return configSchema.parse(yaml);
}
