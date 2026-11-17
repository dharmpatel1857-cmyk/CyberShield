const DEFAULT_API_URL = "http://127.0.0.1:8001/api/v1";
const form = document.getElementById("settings-form");
const apiUrlInput = document.getElementById("api-url");
const apiTokenInput = document.getElementById("api-token");
const status = document.getElementById("status");
const saveButton = document.getElementById("save");

chrome.storage.local.get({
  apiUrl: DEFAULT_API_URL,
  apiToken: ""
}, ({ apiUrl, apiToken }) => {
  apiUrlInput.value = apiUrl;
  apiTokenInput.value = apiToken;
});

function localApiOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid local API address.");
  }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("For privacy, the API must use HTTP on this computer (127.0.0.1 or localhost).");
  }
  return url.origin;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveButton.disabled = true;
  status.textContent = "Requesting local API access…";

  try {
    const apiUrl = apiUrlInput.value.trim().replace(/\/+$/, "");
    const origin = localApiOrigin(apiUrl);
    const apiToken = apiTokenInput.value.trim();
    if (!apiToken) throw new Error("Paste your CyberShield session token.");

    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) throw new Error("Local API access was not granted; the extension cannot scan website URLs.");

    status.textContent = "Testing the local API and account token…";
    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: { "Authorization": `Bearer ${apiToken}` }
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error("The session token is invalid or expired. Sign in again and copy a fresh token.");
      throw new Error(`The API connection failed (${response.status}). Check the backend address and that the backend is running.`);
    }

    await chrome.storage.local.set({ apiUrl, apiToken });
    status.textContent = "Connected. Website navigations will be checked by the local backend.";
  } catch (error) {
    status.textContent = error.message || "Could not save extension settings.";
  } finally {
    saveButton.disabled = false;
  }
});