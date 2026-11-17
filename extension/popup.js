const status = document.getElementById("status");
const connection = document.getElementById("connection");
const toggle = document.getElementById("toggle");

function render(enabled) {
  status.textContent = enabled ? "Protection is on" : "Protection is off";
  toggle.textContent = enabled ? "Turn protection off" : "Turn protection on";
  toggle.disabled = false;
}

chrome.storage.local.get({
  protectionEnabled: true,
  apiUrl: "http://127.0.0.1:8001/api/v1",
  apiToken: ""
}, ({ protectionEnabled, apiUrl, apiToken }) => {
  render(protectionEnabled);
  if (!apiToken) {
    connection.textContent = "Connect an account to scan websites.";
    return;
  }
  fetch(`${apiUrl.replace(/\/+$/, "")}/health`)
    .then((response) => {
      connection.textContent = response.ok ? "Local CyberShield backend is reachable." : "Backend health check failed.";
    })
    .catch(() => {
      connection.textContent = "Local backend is unavailable. Website checks will show an error.";
    });
});

toggle.addEventListener("click", async () => {
  toggle.disabled = true;
  try {
    const { protectionEnabled = true } = await chrome.storage.local.get({ protectionEnabled: true });
    const next = !protectionEnabled;
    await chrome.storage.local.set({ protectionEnabled: next });
    render(next);
  } catch {
    status.textContent = "Could not update protection.";
    toggle.disabled = false;
  }
});

document.getElementById("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
