# Confirmed publishing channel: 今日の頑張り (2026-10-19)

The user transferred the OAuth Secrets to **this repository** and requested end-to-end setup. On 2026-10-19, a live refresh and YouTube lookup **succeeded**: channel title `今日の頑張り`, ID `UCka8SDf1XsNGVccbyLTj8cA`. It was independently matched with historically uploaded video `xeoGIqyAY8I` from the prior Ganbaru repository. The safe result is recorded in [ops/youtube-channel-verification.json](../ops/youtube-channel-verification.json). The uploader **does not require** the optional `YOUTUBE_CHANNEL_ID` repository variable: it derives the expected channel ID from authenticated ownership of historical uploads. If the variable exists and disagrees, verification fails closed.

## Current destination

- **Source and publisher:** `nomuonji/animation-factory` with this repository's `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` GitHub Actions Secrets. The old `nomuonji/ganbaru` publishing workflow is superseded; its secrets must not be copied back.
- **Channel identity:** Live `channels.list(mine=true)`, historical ownership match and optional explicit ID match before upload; the target is always `今日の頑張り`.
- **Channel check:** [Verify Today's Ganbaru YouTube destination](https://github.com/nomuonji/animation-factory/actions/workflows/verify-ganbaru-channel.yml). It checks auth without uploading and writes an auditable, nonsecret result.
- **General standard/footage-first productions:** [Animation Factory to Ganbaru (reviewed private video)](https://github.com/nomuonji/animation-factory/actions/workflows/youtube-ganbaru-private.yml). Select a real `productions/<name>` source, format and YouTube audience. Review the actual finished content and rights before ticking confirmation. The selected production is then validated and rendered on GitHub Actions before upload as **private only**.
- **Market Shorts experiments:** [Market Shorts YouTube channel (manual private-only)](https://github.com/nomuonji/animation-factory/actions/workflows/market-shorts-youtube-private.yml). Uses the same historically verified channel, plus an existing approved preview artifact.
- **Automatic publishing:** Disabled. No cron, public or unlisted video posting is enabled. The Ganbaru morning/night/summary schedules remain inactive.

Do not rerun an upload after an uncertain response without checking YouTube Studio; the action records `upload_unknown` to prevent casual duplicate posting. GitHub workflow logs and public repo files must never contain OAuth tokens or upload session URLs. The account and old channel are confirmed, but **no new video has been uploaded as part of the connection-only verification**.

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
