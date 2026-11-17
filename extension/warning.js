const alertCard = document.getElementById("alert");
const title = document.getElementById("title");
const summary = document.getElementById("summary");
const site = document.getElementById("site");
const risk = document.getElementById("risk");
const reason = document.getElementById("reason");
const aiRow = document.getElementById("ai-row");
const ai = document.getElementById("ai");
const error = document.getElementById("error");
const continueButton = document.getElementById("continue");

function send(action) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: "Could not contact the extension service worker." });
      } else {
        resolve(response || { ok: false, error: "The extension returned no response." });
      }
    });
  });
}

function setFailure(message) {
  alertCard.classList.add("danger");
  title.textContent = "Analysis unavailable";
  summary.textContent = "CyberShield could not complete its local backend check.";
  risk.textContent = "Unknown";
  risk.className = "risk-badge unknown";
  reason.textContent = "No scan result is available";
  error.textContent = message;
  error.hidden = false;
  continueButton.textContent = "Continue without analysis";
  continueButton.disabled = false;
}

function renderAnalysis(result, pendingUrl) {
  const parsedUrl = new URL(pendingUrl);
  const alertLevel = result.alert_level || result.risk_level || "Unknown";
  const hasAlert = result.alert === true;
  site.textContent = parsedUrl.origin;
  risk.textContent = alertLevel;
  risk.className = `risk-badge ${hasAlert ? "high" : "low"}`;
  const ruleFindings = Array.isArray(result.evidence) ? result.evidence : [];
  const aiResult = result.ai_assessment;
  reason.textContent = ruleFindings.filter((item) => !item.startsWith("No suspicious URL patterns")).slice(0, 2).join(" ") ||
    (aiResult?.status === "complete" && aiResult.likely_suspicious ? aiResult.reason : "No high-risk URL pattern matched.");

  if (aiResult?.status === "complete") {
    aiRow.hidden = false;
    ai.textContent = `${aiResult.risk_level}: ${aiResult.reason}`;
  } else {
    aiRow.hidden = false;
    ai.textContent = aiResult?.message || "Local AI assessment was not returned.";
  }

  if (hasAlert) {
    alertCard.classList.add("danger");
    title.textContent = "Security alert";
    summary.textContent = "This URL has suspicious signals. Review them before deciding whether to continue.";
  } else {
    alertCard.classList.add("caution");
    title.textContent = "Website check complete";
    summary.textContent = "No strong URL risk signal was found. This is not a guarantee that the website is safe.";
  }
  continueButton.textContent = hasAlert ? "Continue anyway" : "Continue to website";
  continueButton.disabled = false;
}

async function initialize() {
  const pendingResponse = await send("getPending");
  const pending = pendingResponse.result;
  if (!pendingResponse.ok || !pending || typeof pending.url !== "string") {
    setFailure(pendingResponse.error || "Close this tab and try again.");
    document.getElementById("block").disabled = true;
    document.getElementById("back").disabled = true;
    return;
  }

  try {
    site.textContent = new URL(pending.url).origin;
  } catch {
    setFailure("The destination URL could not be read. Close this tab and try again.");
    return;
  }

  const analysisResponse = await send("analyze");
  if (!analysisResponse.ok || !analysisResponse.result) {
    setFailure(analysisResponse.error || "The backend did not return an analysis.");
    return;
  }
  renderAnalysis(analysisResponse.result, pending.url);
}

document.getElementById("block").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  const response = await send("block");
  if (!response.ok) setFailure(response.error || "The tab could not be closed.");
});

document.getElementById("back").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  const response = await send("goBack");
  if (!response.ok) setFailure(response.error || "Could not return to the previous page.");
});

continueButton.addEventListener("click", async () => {
  continueButton.disabled = true;
  const response = await send("continue");
  if (!response.ok) {
    continueButton.disabled = false;
    error.textContent = response.error || "Could not open the destination.";
    error.hidden = false;
  }
});

void initialize();
