const DEFAULT_API_URL = "http://127.0.0.1:8001/api/v1";
const pendingKey = (tabId) => `pending:${tabId}`;
const bypassKey = (tabId) => `bypass:${tabId}`;

function isWebUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

async function getPending(tabId) {
  const result = await chrome.storage.session.get(pendingKey(tabId));
  return result[pendingKey(tabId)] || null;
}

async function gateNavigation(details) {
  if (details.frameId !== 0 || !isWebUrl(details.url)) return;

  const bypassResult = await chrome.storage.session.get(bypassKey(details.tabId));
  const bypass = bypassResult[bypassKey(details.tabId)];
  if (bypass && bypass.url === details.url && bypass.expiresAt > Date.now()) {
    await chrome.storage.session.remove(bypassKey(details.tabId));
    return;
  }
  if (bypass) await chrome.storage.session.remove(bypassKey(details.tabId));

  const { protectionEnabled = true } = await chrome.storage.local.get({ protectionEnabled: true });
  if (!protectionEnabled) return;

  const existing = await getPending(details.tabId);
  if (existing?.url === details.url) return;

  let previousUrl = null;
  try {
    const tab = await chrome.tabs.get(details.tabId);
    if (isWebUrl(tab.url) && tab.url !== details.url) previousUrl = tab.url;
  } catch {
    previousUrl = null;
  }
  await chrome.storage.session.set({
    [pendingKey(details.tabId)]: { url: details.url, previousUrl, analysis: null }
  });
  await chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL("warning.html") });
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  gateNavigation(details).catch((error) => console.error("Could not pause website navigation:", error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove([pendingKey(tabId), bypassKey(tabId)])
    .catch((error) => console.error("Could not clear closed-tab navigation data:", error));
});

async function analyzePendingNavigation(tabId) {
  const pending = await getPending(tabId);
  if (!pending || !isWebUrl(pending.url)) throw new Error("The website destination is unavailable.");
  if (pending.analysis) return pending.analysis;

  const { apiUrl = DEFAULT_API_URL, apiToken = "" } = await chrome.storage.local.get({
    apiUrl: DEFAULT_API_URL,
    apiToken: ""
  });
  if (!apiToken) throw new Error("Connect your CyberShield account in extension settings to analyze websites.");

  let endpoint;
  try {
    endpoint = new URL(apiUrl);
  } catch {
    throw new Error("The local API address in extension settings is invalid.");
  }
  if (!["127.0.0.1", "localhost"].includes(endpoint.hostname) || endpoint.protocol !== "http:") {
    throw new Error("The extension only sends browsing URLs to an HTTP API on this computer.");
  }
  const permitted = await chrome.permissions.contains({ origins: [`${endpoint.origin}/*`] });
  if (!permitted) throw new Error("Grant local API access in extension settings before scanning websites.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch(`${apiUrl.replace(/\/+$/, "")}/extension/analyze`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: pending.url }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The local analysis took too long. Check that Ollama is running, then try again.");
    }
    throw new Error("CyberShield API is unavailable. Start the backend and try again.");
  } finally {
    clearTimeout(timeout);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`CyberShield API returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(typeof result.detail === "string" ? result.detail : `CyberShield API request failed (${response.status}).`);
  }
  const latest = await getPending(tabId);
  if (!latest || latest.url !== pending.url) throw new Error("The destination changed during analysis. Review the new destination.");
  latest.analysis = result;
  await chrome.storage.session.set({ [pendingKey(tabId)]: latest });
  return result;
}

async function continueTo(tabId, key) {
  const pending = await getPending(tabId);
  if (!pending || !isWebUrl(pending[key])) throw new Error("The requested destination is unavailable.");
  await chrome.storage.session.set({
    [bypassKey(tabId)]: { url: pending[key], expiresAt: Date.now() + 15000 }
  });
  await chrome.storage.session.remove(pendingKey(tabId));
  await chrome.tabs.update(tabId, { url: pending[key] });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  if (!tabId || sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(""))) return;

  const action = message && message.action;
  let operation;
  if (action === "getPending") {
    operation = getPending(tabId);
  } else if (action === "analyze") {
    operation = analyzePendingNavigation(tabId);
  } else if (action === "continue") {
    operation = continueTo(tabId, "url").then(() => ({ ok: true }));
  } else if (action === "goBack") {
    operation = getPending(tabId).then(async (pending) => {
      if (pending && isWebUrl(pending.previousUrl)) {
        await continueTo(tabId, "previousUrl");
      } else {
        await chrome.storage.session.remove(pendingKey(tabId));
        await chrome.tabs.remove(tabId);
      }
      return { ok: true };
    });
  } else if (action === "block") {
    operation = chrome.storage.session.remove(pendingKey(tabId))
      .then(() => chrome.tabs.remove(tabId))
      .then(() => ({ ok: true }));
  } else {
    return;
  }

  operation.then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "CyberShield could not complete the request." }));
  return true;
});
