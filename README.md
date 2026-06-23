# Plane.so Google Sync

This is a simple script to sync your Plane.so work items with Google Calendar. It uses the work items' due dates (and optionally start dates) to create and maintain all-day events in your Google Calendar.

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
4. Open the downloaded file and copy its contents into your config file (see below).

### 2. Plane.so API token

1. Open your Plane.so workspace and go to **Profile → API tokens**.
2. Create a new token and copy it.

### 3. Find your Plane.so project ID

You need the UUID of the specific project you want to sync. You can find it in the project's URL or settings inside Plane.so.

### 4. Create a config file

Create a file called `planeso-google-sync.config.yml` in whatever directory you will run the command from (or pass `--config <path>` to point to it elsewhere).

```yaml
sync:
  - plane:
      apiKey: your-plane-api-token
      workspace: your-workspace-slug   # the slug, not the UUID
      projectId: your-project-uuid

    google:
      calendarId: primary              # or a specific calendar ID
      auth:
        clientId: "YOUR_CLIENT_ID.apps.googleusercontent.com"
        projectId: "your-project-id"
        authUri: "https://accounts.google.com/o/oauth2/auth"
        tokenUri: "https://oauth2.googleapis.com/token"
        authProviderX509CertUrl: "https://www.googleapis.com/oauth2/v1/certs"
        clientSecret: "YOUR_CLIENT_SECRET"
        redirectUris:
          - "http://localhost:8080"
```

The `google.auth` block is the `installed` object from the `credentials.json` file downloaded in step 1 (note the keys are camelCase here, not snake_case as they appear in the downloaded file).

The `redirectUris` entry must match one of the redirect URIs configured in the Google Cloud Console. For a Desktop app, `http://localhost:PORT` is recommended — the tool starts a local webserver on that port to capture the OAuth callback automatically.

### 5. First run

On the first run the tool will open your browser and ask you to grant calendar access. After you approve, the browser redirects to `localhost` and the tool captures the authorization code automatically. The OAuth token is saved to `~/.config/planeso-google-sync/<clientId>.token.json` so subsequent runs happen silently.

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

Each run fetches all work items in the configured Plane.so project and syncs those that have a **due date** to Google Calendar as all-day events:

- **New item** (no matching calendar event yet) → creates a new all-day event.
- **Changed item** (title or dates differ) → updates the existing event.
- **Removed/date-cleared item** (event exists but item no longer qualifies) → deletes the orphaned event.

If a work item also has a **start date**, the calendar event spans from start date to due date. Otherwise it is a single-day event on the due date.

Events are tagged with a private extended property so the tool only touches what it created and never interferes with your other calendar entries.

Each event description includes a link back to the work item in Plane.so.

Run it as a cron job or scheduled task to keep your calendar continuously in sync. For example, to update every 15 minutes with cron:

```
*/15 * * * * cd /path/to/config && planeso-google-sync
```

## Full config reference

```yaml
sync:                                  # list of sync configs; you can have multiple
  - plane:
      apiKey: your-plane-api-token     # required
      workspace: your-workspace-slug   # required
      projectId: your-project-uuid     # required
      baseUrl: https://api.plane.so    # optional; set for self-hosted Plane instances

    google:
      calendarId: primary              # required
      syncDescriptions: false          # optional; copy work item description into the event
      singleDayPrefix: ""              # optional; prepended to the title for single-day events
      multiDayPrefix: ""               # optional; prepended to the title for multi-day events
      stateSuffixes:                   # optional; appended to the title based on work item state
        completed: " ✓"
        cancelled: " ✗"
      auth:
        clientId: "..."                # required
        projectId: "..."               # required
        authUri: "..."                 # required
        tokenUri: "..."                # required
        authProviderX509CertUrl: "..." # required
        clientSecret: "..."            # required
        redirectUris:                  # required; first entry is used
          - "http://localhost:8080"
        localPort: 8080                # optional; override the port the local callback server listens on
        tokenFile: ""                  # optional; override where the OAuth token is stored

    sync:
      states:                          # optional; set a state group to false to exclude those items
        backlog: true
        unstarted: true
        started: true
        completed: true
        cancelled: true
        triage: true
```
