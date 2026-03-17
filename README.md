# Plane.so Google Sync

This is a simple script to sync your Google Calendar with Plane.so. It uses the Google Calendar API to fetch your events and then updates your Plane.so status accordingly.

It is meant to run locally on your machine, updating every run. You can set it up as a cron job or a scheduled task to run at regular intervals.

## Installation

```sh
npm install planeso-google-sync -g
```

## Setup

### 1. Google Calendar credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/marketplace/product/google/calendar-json.googleapis.com) and create or select a project.
2. Enable the **Google Calendar API** for the project.
3. Create an **OAuth 2.0 Client ID** (application type: *Desktop app*) and download `credentials.json`.
4. Place the file at `~/.config/planeso-google-sync/credentials.json` (the default path). You can use a different location with `--credentials-path`.

### 2. Plane.so API token

1. Open your Plane.so workspace and go to **Profile → API tokens**.
2. Create a new token and copy it.

### 3. First run

On the first run the tool will print an authorization URL. Open it in your browser, grant calendar read access, and paste the authorization code back into the terminal. The token is saved to `~/.config/planeso-google-sync/token.json` so subsequent runs happen silently.

## Usage

```sh
planeso-google-sync --plane-token <your-plane-token> --workspace-id <your-workspace-slug> --calendar-id <your-calendar-id>
```

### Options

| Option | Required | Default | Description |
|---|---|---|---|
| `--plane-token <token>` | yes | — | Plane.so API token |
| `--workspace-id <slug>` | yes | — | Plane.so workspace slug (not the UUID) |
| `--calendar-id <id>` | yes | — | Google Calendar ID. Use `primary` for your main calendar |
| `--credentials-path <path>` | no | `~/.config/planeso-google-sync/credentials.json` | Path to your Google OAuth2 `credentials.json` |
| `--token-path <path>` | no | `~/.config/planeso-google-sync/token.json` | Where to store the Google OAuth2 token after first auth |

### How it works

Each run checks whether you have any Google Calendar events happening at the current moment:

- **Event in progress** → sets your Plane.so status to *busy* and the status message to the event title(s).
- **No active event** → sets your Plane.so status to *online*.

Run it as a cron job or scheduled task to keep your status continuously in sync. For example, to update every 5 minutes with cron:

```
*/5 * * * * planeso-google-sync --plane-token <token> --workspace-id <slug> --calendar-id primary
```
