# 🛡️ Watchtower JS SDK & Dashboard Documentation

Watchtower is a client-side Content Moderation SDK designed to intercept and validate user-generated content (Text and Images) before it reaches your backend. It mirrors the logic of the Watchtower Android SDK to provide a unified moderation experience across platforms.

## 🏗️ Architecture Overview

The system consists of three main layers:

1.  **Watchtower SDK (`/lib/watchtower.js`)**: A singleton client that handles API communication, policy caching, and local threshold application.
2.  **Mock Backend (`/app/api/watchtower/`)**: Next.js Route Handlers that simulate the production Go/Java moderation server.
3.  **UI Dashboard (`/app/page.tsx`)**: A modern React interface for real-time testing and monitoring.

## 🛠️ Core SDK Functionality

### 1. Fail-Open Logic

The SDK implements a "Safe API" wrapper. If the moderation server is unreachable or returns an error, the SDK defaults to `ALLOW` (for images) or `true` (for text). This ensures that technical outages do not block your users from using the app.

### 2. Policy Management

To optimize performance, the SDK does not fetch rules on every request:

- **Caching**: Policies are cached locally for a configurable duration (`policyRefreshSeconds`).
- **Mutex Locking**: A internal promise lock (`_policyRefreshPromise`) prevents "cache stampedes" where multiple simultaneous requests trigger multiple redundant policy fetches.

### 3. Image Moderation

The SDK supports `Blob`, `ArrayBuffer`, and `Uint8Array` inputs. It performs a two-step check:

- **Cloud Check**: Sends the image to the `/v1/moderate/image` endpoint.
- **Local Enforcement**: Even if the cloud returns a score, the SDK applies the locally cached `nsfwThreshold` to make the final `BLOCK` or `ALLOW` decision.

## 🚀 API Reference

### `Watchtower.init(apiKey, config)`

Initializes the client.

- **apiKey**: Your project authorization token.
- **config**:
  - `apiBaseUrl`: The root URL of your moderation server.
  - `policyRefreshSeconds`: How long to trust the cached policy (default 60s).

### `Watchtower.checkText(text, meta)`

Returns `Promise<boolean>`.

- Checks text against toxicity and sexual content filters.
- Automatically emits a `text_moderated` event to the telemetry endpoint.

### `Watchtower.checkImageJpeg(data, meta)`

Returns `Promise<ImageModerationResult>`.

- **Result**: `{ decision: "ALLOW" | "BLOCK", nsfwScore: number, reasons: string[] }`.

## 📊 Telemetry & Events

The SDK includes a "fire-and-forget" event system. Whenever a moderation decision is made, it hits the `/v1/events` endpoint with:

- Action taken (ALLOW/BLOCK).
- Metadata (User ID, Session ID, Content ID).
- Timestamp.

## 🎨 UI/UX Best Practices Implemented

- **Visual Feedback**: Distinct color-coded states (Emerald for safe, Red for blocked).
- **Loading States**: Skeleton-like loaders and spinners to indicate active scanning.
- **Real-time Preview**: Immediate JPEG rendering before the moderation binary is sent.
