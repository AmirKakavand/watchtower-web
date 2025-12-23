// watchtower.js
// Frontend JS SDK equivalent to your Android SDK logic.
// - init(apiKey, config)
// - refreshPolicy() with cache + mutex-like lock
// - checkText(text, meta) -> boolean (fail-open true)
// - checkImageJpeg(blob/ArrayBuffer/Uint8Array, meta) -> { decision, nsfwScore, reasons }
// - optional emitEvent()

/** @typedef {"ON_DEVICE_ONLY"|"CLOUD_ONLY"|"HYBRID"} ModerationMode */
/** @typedef {"ALLOW"|"FLAG"|"BLOCK"} Decision */

/**
 * @typedef {Object} WatchtowerConfig
 * @property {string} [apiBaseUrl] - e.g. "http://localhost:8080"
 * @property {boolean} [sendEvents]
 * @property {number} [policyRefreshSeconds]
 * @property {ModerationMode} [mode]
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {Object} ContentMeta
 * @property {string|null} [userId]
 * @property {string|null} [sessionId]
 * @property {string|null} [contentId]
 * @property {string|null} [locale]
 * @property {string|null} [channel]
 */

/**
 * @typedef {Object} Policy
 * @property {boolean} blockToxicity
 * @property {boolean} blockSexual
 * @property {boolean} blockNsfwImages
 * @property {number} toxicityThreshold
 * @property {number} sexualThreshold
 * @property {number} nsfwThreshold
 */

/**
 * @typedef {Object} ImageModerationResult
 * @property {Decision} decision
 * @property {number|null} [nsfwScore]
 * @property {string[]} reasons
 */

const DEFAULT_CONFIG = {
  apiBaseUrl: "http://localhost:8080",
  sendEvents: true,
  policyRefreshSeconds: 60,
  mode: "HYBRID",
  timeoutMs: 20000,
};

const DEFAULT_POLICY = {
  blockToxicity: true,
  blockSexual: true,
  blockNsfwImages: true,
  toxicityThreshold: 0.85,
  sexualThreshold: 0.85,
  nsfwThreshold: 0.85,
};

function withTimeout(ms, signal) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(new Error("timeout")), ms);

  // If caller passes a signal, abort when it aborts
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else
      signal.addEventListener("abort", () => controller.abort(signal.reason), {
        once: true,
      });
  }

  return { signal: controller.signal, cleanup: () => clearTimeout(t) };
}

async function safeApiCall(label, defaultResult, fn) {
  try {
    return await fn();
  } catch (e) {
    // Fail-open behavior like your Kotlin safeApiCall :contentReference[oaicite:1]{index=1}
    console.error(`[WatchtowerSDK] Error during ${label}:`, e?.message || e);
    return defaultResult;
  }
}

// Convert various inputs to Uint8Array for image upload
async function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    const ab = await data.arrayBuffer();
    return new Uint8Array(ab);
  }
  throw new Error(
    "Unsupported image input. Use Blob, ArrayBuffer, or Uint8Array."
  );
}

class WatchtowerClient {
  /**
   * @param {string} apiKey
   * @param {WatchtowerConfig} config
   */
  constructor(apiKey, config) {
    this.apiKey = apiKey;
    this.config = { ...DEFAULT_CONFIG, ...(config || {}) };

    /** @type {Policy} */
    this.cachedPolicy = { ...DEFAULT_POLICY };
    this.policyLastFetchMs = 0;

    // simple "mutex": serialize policy refresh
    this._policyRefreshPromise = null;
  }

  _headers(extra = {}) {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      ...extra,
    };
  }

  async refreshPolicy() {
    // serialize refresh calls so you don't stampede the server
    if (this._policyRefreshPromise) return this._policyRefreshPromise;

    this._policyRefreshPromise = safeApiCall(
      "refreshPolicy",
      this.cachedPolicy,
      async () => {
        const url = `${this.config.apiBaseUrl}/v1/policy`;

        const { signal, cleanup } = withTimeout(this.config.timeoutMs);
        try {
          const res = await fetch(url, {
            method: "GET",
            headers: this._headers(),
            signal,
          });

          if (!res.ok) return this.cachedPolicy;

          const json = await res.json();

          const policy = {
            blockToxicity: json?.blockToxicity ?? true,
            blockSexual: json?.blockSexual ?? true,
            blockNsfwImages: json?.blockNsfwImages ?? true,
            toxicityThreshold: Number(json?.toxicityThreshold ?? 0.85),
            sexualThreshold: Number(json?.sexualThreshold ?? 0.85),
            nsfwThreshold: Number(json?.nsfwThreshold ?? 0.85),
          };

          this.cachedPolicy = policy;
          this.policyLastFetchMs = Date.now();
          return policy;
        } finally {
          cleanup();
        }
      }
    );

    try {
      return await this._policyRefreshPromise;
    } finally {
      this._policyRefreshPromise = null;
    }
  }

  async _getPolicyMaybeRefresh() {
    const ageMs = Date.now() - this.policyLastFetchMs;
    if (ageMs > this.config.policyRefreshSeconds * 1000) {
      return this.refreshPolicy();
    }
    return this.cachedPolicy;
  }

  /**
   * Kotlin version returns boolean isTextPermitted (fail-open true). :contentReference[oaicite:2]{index=2}
   * @param {string} text
   * @param {ContentMeta} meta
   * @returns {Promise<boolean>}
   */
  async checkText(text, meta = {}) {
    return safeApiCall("checkText", true, async () => {
      // keep policy refreshed like Kotlin version
      await this._getPolicyMaybeRefresh();

      const url = `${this.config.apiBaseUrl}/checkText`;
      const body = JSON.stringify({ text, meta });

      const { signal, cleanup } = withTimeout(this.config.timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: this._headers({ "Content-Type": "application/json" }),
          body,
          signal,
        });

        if (!res.ok) return true; // fail-open

        const json = await res.json();
        const isTextPermitted = json?.isTextPermitted ?? true;

        if (this.config.sendEvents) {
          // fire-and-forget like Kotlin emitEvent (but we won't block return)
          this.emitEvent(
            "text_moderated",
            isTextPermitted ? "ALLOW" : "BLOCK",
            meta,
            {
              isTextPermitted: String(isTextPermitted),
            }
          ).catch(() => {});
        }

        return isTextPermitted;
      } finally {
        cleanup();
      }
    });
  }

  /**
   * @param {Blob|ArrayBuffer|Uint8Array} jpeg
   * @param {ContentMeta} meta
   * @returns {Promise<ImageModerationResult>}
   */
  async checkImageJpeg(jpeg, meta = {}) {
    return safeApiCall(
      "checkImageJpeg",
      { decision: "ALLOW", nsfwScore: null, reasons: ["sdk_network_error"] },
      async () => {
        const policy = await this._getPolicyMaybeRefresh();

        const url = `${this.config.apiBaseUrl}/v1/moderate/image`;
        const bytes = await toUint8Array(jpeg);

        const { signal, cleanup } = withTimeout(this.config.timeoutMs);
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: this._headers({ "Content-Type": "image/jpeg" }),
            body: bytes,
            signal,
          });

          if (!res.ok) {
            return {
              decision: "ALLOW",
              nsfwScore: null,
              reasons: ["cloud_unavailable"],
            };
          }

          const json = await res.json();
          const nsfwScore =
            typeof json?.nsfwScore === "number" ? json.nsfwScore : null;
          const reasons = Array.isArray(json?.reasons) ? json.reasons : [];
          const decision = json?.decision || "ALLOW";

          /** @type {ImageModerationResult} */
          const result = { decision, nsfwScore, reasons };

          if (this.config.sendEvents) {
            this.emitEvent("image_moderated", decision, meta, {
              nsfwScore: nsfwScore == null ? null : String(nsfwScore),
            }).catch(() => {});
          }

          // Apply policy thresholds locally like Kotlin applyPolicyToImageResult :contentReference[oaicite:3]{index=3}
          return this._applyPolicyToImageResult(result, policy);
        } finally {
          cleanup();
        }
      }
    );
  }

  _applyPolicyToImageResult(result, policy) {
    if (
      policy.blockNsfwImages &&
      typeof result.nsfwScore === "number" &&
      result.nsfwScore >= policy.nsfwThreshold
    ) {
      return {
        ...result,
        decision: "BLOCK",
        reasons: [...(result.reasons || []), "policy_nsfw"],
      };
    }
    return result;
  }

  async emitEvent(type, decision, meta = {}, extra = {}) {
    const url = `${this.config.apiBaseUrl}/v1/events`;
    const payload = {
      type,
      decision,
      meta,
      extra,
      ts: Date.now(),
    };

    // Fire-and-forget semantics: if it fails, we don't care (like Kotlin runCatching) :contentReference[oaicite:4]{index=4}
    await safeApiCall("emitEvent", null, async () => {
      const { signal, cleanup } = withTimeout(
        Math.min(this.config.timeoutMs, 5000)
      );
      try {
        await fetch(url, {
          method: "POST",
          headers: this._headers({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
          signal,
        });
      } finally {
        cleanup();
      }
      return null;
    });
  }
}

export const Watchtower = (() => {
  let client = null;

  return {
    /**
     * @param {string} apiKey
     * @param {WatchtowerConfig} [config]
     */
    init(apiKey, config) {
      client = new WatchtowerClient(apiKey, config);
    },

    _requireClient() {
      if (!client)
        throw new Error(
          "Watchtower not initialized. Call Watchtower.init(apiKey, config) first."
        );
      return client;
    },

    /** @returns {Promise<Policy>} */
    refreshPolicy() {
      return this._requireClient().refreshPolicy();
    },

    /** @returns {Promise<boolean>} */
    checkText(text, meta = {}) {
      return this._requireClient().checkText(text, meta);
    },

    /** @returns {Promise<ImageModerationResult>} */
    checkImageJpeg(jpeg, meta = {}) {
      return this._requireClient().checkImageJpeg(jpeg, meta);
    },
  };
})();
