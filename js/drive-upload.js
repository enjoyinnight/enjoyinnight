/* ============================================================
   drive-upload.js
   Handles all Google Drive integration for the Admin panel:
     1. Loading the Google Identity Services (OAuth2) + Picker
        + gapi client libraries
     2. Signing the admin in with their Google account
     3. Uploading a chosen image file directly to a specified
        Google Drive folder via the Drive REST API
     4. Making the uploaded file public ("anyone with the link")
        and returning a directly-embeddable image URL
   ============================================================ */

/* --------------------------------------------------------------
   SETUP — fill these in after following the instructions in
   README-google-drive-setup.md. Without real values, the upload
   button will show a friendly message instead of failing silently.
-------------------------------------------------------------- */
const DRIVE_CONFIG = {
  CLIENT_ID: "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  API_KEY: "YOUR_GOOGLE_API_KEY",
  APP_ID: "YOUR_GOOGLE_CLOUD_PROJECT_NUMBER",   // used by the Picker
  FOLDER_ID: "YOUR_DRIVE_FOLDER_ID",            // destination folder for uploads
  SCOPE: "https://www.googleapis.com/auth/drive.file"
};

let gisTokenClient = null;
let driveAccessToken = null;
let gapiReady = false;

/** Returns true once Client ID / API key have been filled in for real */
function isDriveConfigured() {
  return !DRIVE_CONFIG.CLIENT_ID.startsWith("YOUR_") && !DRIVE_CONFIG.API_KEY.startsWith("YOUR_");
}

/** Dynamically load an external script once */
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Loads gapi (for Drive REST calls + Picker) and Google Identity Services (for OAuth2) */
async function loadDriveLibraries() {
  await Promise.all([
    loadScriptOnce("https://apis.google.com/js/api.js"),
    loadScriptOnce("https://accounts.google.com/gsi/client")
  ]);
  await new Promise(resolve => gapi.load("client:picker", resolve));
  await gapi.client.init({ apiKey: DRIVE_CONFIG.API_KEY });
  gapiReady = true;
}

/**
 * Triggers the Google OAuth2 sign-in popup (Google Identity Services
 * "token client" flow — the modern replacement for gapi.auth2).
 * Resolves once we have an access token usable for Drive API calls.
 */
function signInToGoogle() {
  return new Promise((resolve, reject) => {
    if (!gisTokenClient) {
      gisTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: DRIVE_CONFIG.CLIENT_ID,
        scope: DRIVE_CONFIG.SCOPE,
        callback: (tokenResponse) => {
          if (tokenResponse.error) return reject(tokenResponse);
          driveAccessToken = tokenResponse.access_token;
          resolve(driveAccessToken);
        }
      });
    }
    gisTokenClient.requestAccessToken({ prompt: driveAccessToken ? "" : "consent" });
  });
}

/**
 * Uploads a File object (from an <input type="file">) to the configured
 * Google Drive folder, makes it publicly viewable, and returns
 * { fileId, imageUrl } where imageUrl can be used directly in <img src>.
 */
async function uploadImageToDrive(file, onProgress) {
  if (!isDriveConfigured()) {
    throw new Error("DRIVE_NOT_CONFIGURED");
  }
  if (!gapiReady) await loadDriveLibraries();
  if (!driveAccessToken) await signInToGoogle();

  const metadata = {
    name: `bazar_${Date.now()}_${file.name}`,
    parents: [DRIVE_CONFIG.FOLDER_ID]
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  // Step 1: multipart upload
  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${driveAccessToken}` },
      body: form
    }
  );
  if (!uploadRes.ok) throw new Error("Drive upload failed: " + (await uploadRes.text()));
  const { id: fileId } = await uploadRes.json();

  // Step 2: make the file publicly readable ("anyone with the link")
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${driveAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ role: "reader", type: "anyone" })
  });

  // Direct, embeddable image URL (works in <img src="...">)
  const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  return { fileId, imageUrl };
}

/**
 * Opens the Google Picker UI so the admin can pick an *existing* Drive
 * file instead of uploading a new one. Returns { fileId, imageUrl }.
 */
async function pickImageFromDrive() {
  if (!isDriveConfigured()) throw new Error("DRIVE_NOT_CONFIGURED");
  if (!gapiReady) await loadDriveLibraries();
  if (!driveAccessToken) await signInToGoogle();

  return new Promise((resolve, reject) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
      .setParent(DRIVE_CONFIG.FOLDER_ID);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(driveAccessToken)
      .setDeveloperKey(DRIVE_CONFIG.API_KEY)
      .setAppId(DRIVE_CONFIG.APP_ID)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({ fileId: doc.id, imageUrl: `https://drive.google.com/uc?export=view&id=${doc.id}` });
        } else if (data.action === google.picker.Action.CANCEL) {
          reject(new Error("cancelled"));
        }
      })
      .build();
    picker.setVisible(true);
  });
}
