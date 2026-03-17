import { readFile } from 'fs/promises';
import { z } from 'zod';
import jsYaml from 'js-yaml';
import { DEFAULT_TOKEN_PATH } from './constant.js';

const authSchema = z.object({
  client_id: z.string().min(1, 'Google OAuth2 client ID is required'),
  project_id: z.string().min(1, 'Google OAuth2 project ID is required'),
  auth_uri: z.string().min(1, 'Google OAuth2 auth URI is required'),
  token_uri: z.string().min(1, 'Google OAuth2 token URI is required'),
  auth_provider_x509_cert_url: z.string().min(1, 'Google OAuth2 auth provider x509 cert URL is required'),
  client_secret: z.string().min(1, 'Google OAuth2 client secret is required'),
  redirect_uris: z.array(z.string()).min(1, 'Google OAuth2 redirect URIs are required'),
  tokenPath: z.string().optional().default(DEFAULT_TOKEN_PATH),
});

export type GoogleAuthConfig = z.infer<typeof authSchema>;

export const configSchema = z.object({
  planeso: z.object({
    token: z.string().min(1, 'Plane.so API token is required'),
    workspace: z.string().min(1, 'Plane.so workspace slug is required'),
  }),
  google: z.object({
    calendarId: z.string().min(1, 'Google Calendar ID is required'),
    auth: authSchema,
  }),
});

export type Config = z.infer<typeof configSchema>;

export async function getConfig(configFile: string): Promise<Config> {
  const content = await readFile(configFile, 'utf8');
  const yaml = jsYaml.load(content);
  return configSchema.parse(yaml);
}
