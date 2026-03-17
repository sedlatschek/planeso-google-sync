# Plane.so Google Sync

This is a simple script to sync your Google Calendar with Plane.so. It uses the Google Calendar API to fetch your events and then updates your Plane.so status accordingly.

It is meant to run locally on your machine, updating every run. You can set it up as a cron job or a scheduled task to run at regular intervals.

## Installation

```sh
npm install planeso-google-sync -g
```

## Setup

### 1. Google Calendar credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable the **Google Calendar API** for the project.
3. Create an **OAuth 2.0 Client ID** (application type: *Desktop app*) and download `credentials.json`.
4. Open the downloaded file — you will copy its contents into your config file (see below).

### 2. Plane.so API token

1. Open your Plane.so workspace and go to **Profile → API tokens**.
2. Create a new token and copy it.

### 3. Create a config file

Create a file called `planeso-google-sync.config.yml` in whatever directory you will run the command from (or pass `--config <path>` to point to it elsewhere).

```yaml
planeso:
  token: your-plane-api-token
  workspace: your-workspace-slug   # the slug, not the UUID

google:
  calendarId: primary              # or a specific calendar ID
  auth:
    client_id: "YOUR_CLIENT_ID.apps.googleusercontent.com"
    project_id: "your-project-id"
    auth_uri: "https://accounts.google.com/o/oauth2/auth"
    token_uri: "https://oauth2.googleapis.com/token"
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
    client_secret: "YOUR_CLIENT_SECRET"
    redirect_uris:
      - "http://localhost"
```

The `google.auth` block is the `installed` object from the `credentials.json` file downloaded in step 1.

### 4. First run

On the first run the tool will print an authorization URL. Open it in your browser, grant calendar read access, and paste the authorization code back into the terminal. The OAuth token is saved to `~/.config/planeso-google-sync/token.json` so subsequent runs happen silently.

## Usage

```sh
planeso-google-sync
```

By default the tool looks for `planeso-google-sync.config.yml` in the current directory. Use `--config` to specify a different path:

```sh
planeso-google-sync --config /path/to/my-config.yml
```

### Options

| Option | Default | Description |
|---|---|---|
| `--config <path>` | `planeso-google-sync.config.yml` | Path to the YAML config file |

### How it works

Each run checks whether you have any Google Calendar events happening at the current moment:

- **Event in progress** → sets your Plane.so status to *busy* and the status message to the event title(s).
- **No active event** → sets your Plane.so status to *online*.

Run it as a cron job or scheduled task to keep your status continuously in sync. For example, to update every 5 minutes with cron:

```
*/5 * * * * cd /path/to/config && planeso-google-sync
```
