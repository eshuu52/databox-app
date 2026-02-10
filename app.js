// ========== CONFIG ==========
const CLIENT_ID = "704246886275-d8rt38rfesceaqjjlt5lb9736o5lht93.apps.googleusercontent.com"; // <-- your client id
const SCOPES = "https://www.googleapis.com/auth/drive.file";     // uses drive.file (app-created files)
const FOLDER_NAME = "Databox";

// ========== DOM ==========
const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const signinBtn = document.getElementById("signinBtn");
const signoutBtn = document.getElementById("signoutBtn");
const whoEl = document.getElementById("who");
const quotaText = document.getElementById("quotaText");
const fileInput = document.getElementById("fileInput");
const chooseBtn = document.getElementById("chooseBtn");
const uploadStatus = document.getElementById("uploadStatus");
const dropZone = document.getElementById("dropZone");
const imagesGrid = document.getElementById("imagesGrid");
const videosGrid = document.getElementById("videosGrid");
const documentsGrid = document.getElementById("documentsGrid");
const imagesCount = document.getElementById("imagesCount");
const videosCount = document.getElementById("videosCount");
const documentsCount = document.getElementById("documentsCount");
const tabBtns = document.querySelectorAll(".tab-btn");

let tokenClient;
let accessToken = null;
let folderId = null;
let gapiInited = false;

// ========== INIT ==========
window.onload = () => {
  // initialize gapi client library
  gapi.load("client", async () => {
    try {
      await gapi.client.init({});
      gapiInited = true;
      console.log("gapi client initialized");
    } catch (err) {
      console.warn("gapi.client.init failed", err);
    }
  });

  // init token client (GSI)
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.error("token callback error", resp);
        alert("Auth failed: " + (resp.error || JSON.stringify(resp)));
        return;
      }
      accessToken = resp.access_token;
      gapi.client.setToken({ access_token: accessToken });
      onSignedIn();
    }
  });
};

// ========== AUTH UI ==========
signinBtn.onclick = () => {
  // request token -> callback will run
  tokenClient.requestAccessToken();
};

signoutBtn.onclick = async () => {
  if (accessToken) {
    try {
      // revoke token
      await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, { method: "POST" });
    } catch (e) { /* ignore */ }
  }
  accessToken = null;
  gapi.client.setToken(null);
  folderId = null;
  // show login again
  appView.style.display = "none";
  loginView.style.display = "";
  whoEl.textContent = "";
  imagesGrid.innerHTML = "";
  videosGrid.innerHTML = "";
  documentsGrid.innerHTML = "";
  quotaText.textContent = "Quota: (signed out)";
};

// ========== SIGNED-IN FLOW ==========
async function onSignedIn() {
  loginView.style.display = "none";
  appView.style.display = "";

  // get basic userinfo
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!r.ok) throw new Error("userinfo fetch failed: " + r.status);
    const profile = await r.json();
    whoEl.textContent = profile.name || profile.email;
  } catch (err) {
    console.error("Failed to get user information.", err);
    alert("Failed to get user information. Check console. Signing out.");
    signoutBtn.click();
    return;
  }

  // ensure Databox folder and list files
  try {
    await ensureDataboxFolder();
    await refreshFileList();
    await updateQuota();
  } catch (err) {
    console.error("Error during post-signin setup:", err);
  }
}

// ========== FOLDER ========== 
async function ensureDataboxFolder() {
  if (!gapiInited) {
    // wait a bit and retry
    await new Promise(r => setTimeout(r, 400));
  }

  const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
  const res = await gapi.client.drive.files.list({ q, fields: "files(id,name)" });
  if (res.result.files && res.result.files.length) {
    folderId = res.result.files[0].id;
    return folderId;
  }
  const create = await gapi.client.drive.files.create({
    resource: { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
    fields: "id"
  });
  folderId = create.result.id;
  return folderId;
}

// ========== UPLOAD ==========
// choose + drag handlers
chooseBtn.onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFiles(Array.from(e.target.files));
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault(); dropZone.classList.remove("dragover");
  handleFiles(Array.from(e.dataTransfer.files));
});

function currentCategory() {
  return document.querySelector('input[name="fileType"]:checked').value;
}

async function handleFiles(files) {
  if (!accessToken) { alert("Please sign in first"); return; }
  if (!files.length) return;
  uploadStatus.textContent = `Uploading ${files.length} file(s)...`;

  await ensureDataboxFolder();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    uploadStatus.textContent = `Uploading ${file.name} (${i+1}/${files.length})...`;
    try {
      await uploadSingleFile(file);
    } catch (err) {
      console.error("Upload failed for", file.name, err);
      uploadStatus.textContent = `Failed to upload ${file.name}`;
    }
  }

  uploadStatus.textContent = `Upload finished. Refreshing list...`;
  await refreshFileList();
  setTimeout(()=> uploadStatus.textContent = "", 2000);
}

async function uploadSingleFile(file) {
  const metadata = { name: file.name, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,createdTime,size";
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
    body: form
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Upload failed: " + res.status + " " + text);
  }
  return res.json();
}

// ========== LIST / UI ==========
async function refreshFileList() {
  if (!folderId) return;
  const res = await gapi.client.drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,size,createdTime,webViewLink,webContentLink)"
  });

  const files = (res.result.files || []);
  // categorize
  const cat = { images: [], videos: [], documents: [] };
  for (const f of files) {
    if (f.mimeType && f.mimeType.startsWith("image/")) cat.images.push(f);
    else if (f.mimeType && f.mimeType.startsWith("video/")) cat.videos.push(f);
    else cat.documents.push(f);
  }
  renderSection(imagesGrid, cat.images, "images");
  renderSection(videosGrid, cat.videos, "videos");
  renderSection(documentsGrid, cat.documents, "documents");

  imagesCount.textContent = cat.images.length;
  videosCount.textContent = cat.videos.length;
  documentsCount.textContent = cat.documents.length;
}

function renderSection(container, files, type) {
  container.innerHTML = "";
  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "file-card";
    empty.innerHTML = `<div class="file-icon">${type==='images'?'🖼️':type==='videos'?'🎬':'📄'}</div>
                       <div><div class="file-name">No files</div><div class="file-meta muted">Upload files to see them</div></div>`;
    container.appendChild(empty);
    return;
  }

  for (const f of files) {
    const d = document.createElement("div");
    d.className = "file-card";
    d.innerHTML = `
      <div class="file-icon">${type==='images'?'🖼️':type==='videos'?'🎬':'📄'}</div>
      <div style="flex:1">
        <div class="file-name">${escapeHtml(f.name)}</div>
        <div class="file-meta">${f.size ? formatBytes(Number(f.size)) + " • " : ""}${f.createdTime ? new Date(f.createdTime).toLocaleDateString() : ""}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="action-btn" onclick="openFile('${f.id}','${f.webViewLink||""}')">Open</button>
        <button class="action-btn" onclick="downloadFile('${f.id}','${escapeJs(f.name)}','${f.webContentLink||""}')">Download</button>
        <button class="action-btn" onclick="deleteFile('${f.id}','${escapeJs(f.name)}')">Delete</button>
      </div>
    `;
    container.appendChild(d);
  }
}

function escapeHtml(s){ return (s||"").replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }
function escapeJs(s){ return (s||"").replaceAll("'", "\\'").replaceAll('"','\\"') }

// open file (open Drive preview)
function openFile(id, webViewLink) {
  if (webViewLink) window.open(webViewLink, "_blank");
  else window.open(`https://drive.google.com/file/d/${id}/view`, "_blank");
}

// download file
async function downloadFile(fileId, fileName, webContentLink) {
  if (!fileId) { alert("No file id"); return; }
  try {
    if (webContentLink) {
      // direct download
      const r = await fetch(webContentLink);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      return;
    }
    // fallback: fetch via Drive API
    const r = await gapi.client.drive.files.get({ fileId, alt: "media" });
    // gapi returns body as string; create blob
    const blob = new Blob([r.body]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("download error", err);
    alert("Download failed; try opening in Drive");
  }
}

// delete file
async function deleteFile(fileId, name) {
  if (!confirm(`Delete "${name}"? This will remove it from Google Drive.`)) return;
  try {
    await gapi.client.drive.files.delete({ fileId });
    await refreshFileList();
    alert("Deleted");
  } catch (err) {
    console.error("delete failed", err);
    alert("Delete failed. Check console.");
  }
}

// ========== QUOTA ==========
async function updateQuota() {
  try {
    const about = await gapi.client.drive.about.get({ fields: "storageQuota" });
    const q = about.result.storageQuota || {};
    const used = Number(q.usage || 0);
    const limit = q.limit ? Number(q.limit) : null;
    quotaText.textContent = limit ? `Used ${formatBytes(used)} / ${formatBytes(limit)}` : `Used ${formatBytes(used)}`;
  } catch (err) {
    quotaText.textContent = "Quota: (failed to read)";
  }
}

// ========== UTIL ==========
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024, sizes = ["B","KB","MB","GB","TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// tab switching
tabBtns.forEach(btn => btn.addEventListener("click", () => {
  tabBtns.forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  const t = btn.dataset.tab;
  imagesGrid.style.display = t==="images" ? "" : "none";
  videosGrid.style.display = t==="videos" ? "" : "none";
  documentsGrid.style.display = t==="documents" ? "" : "none";
}));

// End of script.js
