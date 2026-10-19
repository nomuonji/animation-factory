# Animation Factory — YouTube destination: 今日の頑張り

## Canonical destination (2026-10-19)

The user has explicitly selected their previously operated **「今日の頑張り」** YouTube channel for Animation Factory. The binding is tracked in [publishing/destinations.json](../publishing/destinations.json). The publisher is **nomuonji/ganbaru**, *not* Social Video Publisher or Kirinuki Generator.

This design reuses Ganbaru's existing GitHub Actions OAuth secrets **in place**; no API tokens are copied from one repository to another. Ganbaru's historical channel is identified by matching YouTube `channels.list(mine=true)` with video IDs in its historical `data/video-status.json`. Merely matching the channel name is NOT sufficient.

**Use** [Ganbaru Actions](https://github.com/nomuonji/ganbaru/actions/workflows/animation-factory-channel.yml):
- `mode=verify`: checks the existing OAuth refresh token and ownership of the historical channel; uploads nothing. The same verification runs on main when this publishing workflow is initially merged.
- `mode=upload_private`: opt-in for one reviewed real `productions/<name>/footage-first.json` or `production.json` tracked in Animation Factory main. It checks the OAuth identity, checks source rights through the relevant existing validator, re-renders in the Ganbaru job, and uploads as **private**. No public posting, timer, or indefinite retry is enabled.
- The old Ganbaru morning/night/summary schedules remain disabled; the history is preserved.

If verification fails, inspect the Ganbaru repository secrets `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` and `YOUTUBE_REFRESH_TOKEN` via the repository settings. Do not paste secrets in chat or copy the refresh token into `animation-factory`. Renew the YouTube OAuth consent *for the historical channel* if necessary. Never use Kirinuki's watched-source IDs.

The older direct Animation Factory private uploader below is retained for compatibility but **not selected as the publishing destination**.

---

# Animation Factory: reuse an OWNED YouTube channel

The Kirinuki Generator's `YOUTUBE_CHANNEL_ID` settings refer to **source channels watched for clipping** (including third-party channels). They are NOT authenticated publishing destinations. Its Google Drive OAuth token is scoped to Drive, not YouTube uploading. Never copy those source IDs or reuse its Drive refresh token as a YouTube publishing credential.

## Channel connection (one-time)

1. In YouTube Studio, switch to an **existing channel you control and no longer use**. Confirm that it is not an active publishing destination for another workflow. Read its actual channel ID in Studio Settings > Channel > Advanced settings.
2. In the Google Cloud project you intend to own the upload integration, enable **YouTube Data API v3**. Use a user-authorized OAuth 2.0 client, not a service account. Request at least `https://www.googleapis.com/auth/youtube.upload` and `https://www.googleapis.com/auth/youtube.readonly`; add `https://www.googleapis.com/auth/yt-analytics.readonly` only when analytics is enabled. Choose the intended YouTube channel explicitly in the account consent flow. Request offline access and obtain a refresh token by an approved OAuth flow. If the OAuth consent screen is in Testing, verify token expiry rules before relying on unattended renewal.
3. In [this repository's Actions secrets](https://github.com/nomuonji/animation-factory/settings/secrets/actions), configure **secrets** `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`. Do not put credential values in issues, PRs, artifacts, docs or chat.
4. In [Actions variables](https://github.com/nomuonji/animation-factory/settings/variables/actions), configure **variable** `YOUTUBE_CHANNEL_ID` with the **owned destination ID**, not a Kirinuki source ID.
5. Run **Actions → Market Shorts YouTube channel (manual private-only) → Run workflow**, mode `verify_channel`. It refreshes OAuth and asks YouTube `channels.list(mine=true)`; it returns `channel_verified` only when the authenticated account actually owns the configured destination ID. It will never upload a video in this mode.

## Optional, reviewed private test upload

The current workflow deliberately supports **Market Shorts preview artifacts only**. It does NOT automatically publish arbitrary Animation Factory productions, the Footage-first smoke fixture, English YouTube videos or Kirinuki clips. To test an actually reviewed **real** Market Shorts production:

1. Finish editorial / rights checks and render with the existing **Market Shorts preview (no publishing)** action on `main`. Synthetic fixtures must not be uploaded.
2. In the YouTube channel workflow select `private_upload`, provide the successful Market Shorts **preview run ID**, the exact `market-short-<12 hex>` production folder, the reviewed `made_for_kids` declaration, and tick the explicit review confirmation.
3. The workflow downloads that exact artifact, checks the source run and source SHA, validates review/rights flags, rechecks channel ownership and calls the existing private-only resumable uploader. It refuses public or unlisted visibility.
4. Check YouTube Studio for the private video and the redacted GitHub Actions receipt. The receipt artifact intentionally strips the sensitive upload session URL.

**Retry rule:** A network failure can occur after YouTube received the video. The workflow therefore has no retry or schedule. Before rerunning, check YouTube Studio and reconcile any `upload_unknown` outcome manually. The receipt artifact is a diagnostic, not a durable external idempotency lock.

No automatic public Shorts scheduling, monitoring, cross-run durable upload-intent ledger or Analytics collection is enabled by this workflow. Those are separate capabilities, not consequences of connecting a channel.

## OAuth and API references

- https://developers.google.com/youtube/v3/guides/authentication
- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/videos/insert

**Critical:** Google Drive credentials in `nomuonji/kirinuki-generator` cannot be copied via GitHub Actions secret reads, and sharing a token from another OAuth client is not a supported setup shortcut.
