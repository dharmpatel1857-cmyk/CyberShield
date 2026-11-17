# CyberShield browser extension

The Manifest V3 extension pauses top-level HTTP and HTTPS navigations and opens a CyberShield review page before the destination loads. It asks the authenticated local API to analyze the URL and presents the rule-based signals with **Go back** and **Continue anyway** actions. Optional local Ollama analysis may add an advisory; URL rules work without Ollama.

## Install and connect

1. Start the API and dashboard using the instructions in the root [README](../README.md).
2. Sign in to CyberShield and copy a session token from dashboard settings.
3. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions`; enable Developer mode, choose **Load unpacked**, and select this `extension` folder.
4. Open the CyberShield popup settings. Set the local API URL to `http://127.0.0.1:8001/api/v1`, paste your session token, and save the settings.
5. Grant the extension's optional permission to connect to the local API and verify that its connection status is available.

If extension files change, reload CyberShield from the browser extensions page. Restart the API after backend changes.

## Permissions and data handling

The extension requests HTTP and HTTPS host access so it can pause top-level website navigation. It does not scan every request, iframe, page body, or downloaded file. It sends the navigated URL to the configured loopback API. Extension scan records are stored for the signed-in user with credentials, query values, and fragments removed. The API does not fetch the destination website.

The session token is stored in the browser's extension storage. The extension only accepts an HTTP API address on `127.0.0.1` or `localhost`. Review the extension source and browser permission prompt before installing it. Users can disable or remove the extension at any time.

URL results are heuristic and can be wrong. An unavailable scan is not a safe verdict. Keep browser Safe Browsing and antivirus protections enabled; the extension is a review aid, not a replacement.
