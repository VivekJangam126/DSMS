// Configuration will be loaded from backend
let firebaseConfig = null;
let pinataJWT = null;
let db, auth;
let configLoaded = false;

// Fetch configuration from backend
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    firebaseConfig = config.firebase;
    pinataJWT = config.pinataJWT;
    
    // Initialize Firebase after config is loaded
    if (typeof firebase !== 'undefined' && firebaseConfig) {
      if (!firebase.apps?.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.database();
      auth = firebase.auth();
      configLoaded = true;
    }
  } catch (error) {
    console.error('Failed to load configuration:', error);
    configLoaded = false;
  }
}

// Load config when script loads
loadConfig();

const protectedPages = [
  "dashboard.html",
  "documents.html",
  "share.html",
  "settings.html",
  "logs.html",
  "notifications.html"
];
const currentPage = window.location.pathname.split("/").pop();

function showMsg(id, msg, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = "auth-message " + type;
  el.style.display = msg ? "block" : "none";
}

function showDocumentsMsg(msg, type = "success", id = "documentsMessage") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = "auth-message " + type;
  el.style.display = msg ? "block" : "none";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}

function spinnerHtml() {
  return `<span class="spinner" style="margin-right:8px;display:inline-block;width:18px;height:18px;border-radius:50%;border:2.5px solid #e9ecfa;border-top:2.5px solid #1a4be7;animation:spin 0.8s linear infinite;vertical-align:middle;"></span>`;
}

function setBtnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle("loading", loading);
}

function updateUploadStatus(message, type = "info") {
  const statusDiv = document.getElementById("uploadStatus");
  if (!statusDiv) return;
  let color = "#1a4be7";
  let icon = "";
  if (type === "success") { color = "#147b4c"; icon = "✅ "; }
  else if (type === "error") { color = "#d23333"; icon = "❌ "; }
  else if (type === "info") { color = "#8b5cf6"; icon = ""; }
  else if (type === "loading") { icon = spinnerHtml(); }
  statusDiv.innerHTML = `<span style="color:${color};font-weight:500;">${icon}${message}</span>`;
}

async function uploadToIPFS(file) {
  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${pinataJWT}`
      },
      body: formData
    });
    const json = await res.json();
    console.log("Pinata response:", json);
    if (!res.ok || !json.IpfsHash) {
      throw new Error('Pinata API Error: ' + (json.error || res.statusText));
    }
    return json.IpfsHash;
  } catch (err) {
    throw new Error("IPFS upload failed: " + err.message);
  }
}

// --- Unpin from Pinata when deleting ---
async function deleteFromPinata(ipfsCid) {
  const url = `https://api.pinata.cloud/pinning/unpin/${ipfsCid}`;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${pinataJWT}`
      }
    });
    if (!res.ok) {
      try {
        const json = await res.json();
        console.error("Pinata unpin error:", json);
      } catch (err) {}
      throw new Error('Pinata Unpin API Error: ' + res.statusText);
    }
    return true;
  } catch (err) {
    console.error("Unpin error:", err);
    return false;
  }
}

async function fetchDocuments(uid) {
  try {
    const snap = await db.ref(`documents/${uid}`).once("value");
    const docs = snap.val() || {};
    return Object.entries(docs).map(([id, doc]) => ({ id, ...doc }));
  } catch (err) { return []; }
}

async function fetchActiveShares(uid) {
  try {
    const snap = await db.ref("shares").orderByChild("userId").equalTo(uid).once("value");
    const shares = snap.val() || {};
    return Object.entries(shares).map(([id, share]) => ({ id, ...share })).filter(s => s.status === "Active");
  } catch (err) { return []; }
}

async function renderDashboardSummary(user) {
  if (!user) return;
  const docs = await fetchDocuments(user.uid);
  const shares = await fetchActiveShares(user.uid);
  const docEl = document.getElementById("totalDocuments");
  if (docEl) docEl.textContent = docs.length;
  const shareEl = document.getElementById("totalShares");
  if (shareEl) shareEl.textContent = shares.length;
  const storageUsed = docs.reduce((acc, doc) => acc + (doc.size || 0), 0);
  const storageEl = document.getElementById("storageUsed");
  if (storageEl) storageEl.textContent = (storageUsed / (1024 * 1024)).toFixed(2) + " MB";
}

async function renderDocuments(user) {
  if (!user) return;
  const docs = await fetchDocuments(user.uid);
  const table = document.getElementById("documentsTable");
  if (!table) return;
  if (!docs.length) {
    table.innerHTML = `<tr><td colspan="6">No documents found.</td></tr>`;
    return;
  }
  table.innerHTML = docs.map(doc => `
    <tr>
      <td>${doc.fileName}</td>
      <td>${(doc.size/1024).toFixed(2)} KB</td>
      <td>${new Date(doc.uploadDate).toLocaleDateString()}</td>
      <td><a href="https://ipfs.io/ipfs/${doc.ipfsCid}" target="_blank">${doc.ipfsCid}</a></td>
      <td><span class="status-tag">${doc.status}</span></td>
      <td>
        <button class="doc-action" title="Share" onclick="openShareModal('${doc.id}', '${doc.fileName}')">🔗</button>
        <button class="doc-action" title="Permissions" onclick="openPermissionsModal('${doc.id}')">🔒</button>
        <button class="doc-action" title="Revoke" onclick="revokeDocument('${doc.id}')">🚫</button>
        <button class="doc-action" title="Delete" onclick="deleteDocument('${doc.id}', '${doc.ipfsCid}')">🗑️</button>
      </td>
    </tr>
  `).join("");
}

// --- Actions ---
window.openShareModal = async function(docId, fileName) {
  // Redirect to share page with pre-selected document
  window.location.href = `share.html?docId=${docId}&fileName=${encodeURIComponent(fileName)}`;
};

window.openPermissionsModal = function(docId) {
  alert("Permissions logic can be extended here for document " + docId);
};

window.revokeDocument = async function(docId) {
  const user = auth.currentUser;
  if (!user) return;
  const sharesSnap = await db.ref("shares").orderByChild("documentId").equalTo(docId).once("value");
  const shares = sharesSnap.val() || {};
  let docName = "Unknown Document";
  for (let [id, share] of Object.entries(shares)) {
    if (share.userId === user.uid && share.status === "Active") {
      docName = share.documentName || docName;
      await db.ref(`shares/${id}/status`).set("Revoked");
    }
  }
  await logActivity(user.uid, "Share Revoked", `Revoked all shares for "${docName}"`);
  renderDashboardSummary(user);
  renderDocuments(user);
};

window.deleteDocument = async function(docId, ipfsCid) {
  const user = auth.currentUser;
  if (!user) return;
  
  // Get document name before deleting
  const docSnap = await db.ref(`documents/${user.uid}/${docId}`).once("value");
  const docData = docSnap.val();
  const docName = docData?.fileName || "Unknown Document";
  
  // Unpin from Pinata first
  if (ipfsCid) {
    await deleteFromPinata(ipfsCid);
  }
  await db.ref(`documents/${user.uid}/${docId}`).remove();
  await logActivity(user.uid, "Document Deleted", `Deleted "${docName}" from IPFS storage (CID: ${ipfsCid})`);
  showDocumentsMsg("Document deleted!", "success");
  renderDashboardSummary(user);
  renderDocuments(user);
};

// --- File upload logic ---
document.addEventListener("DOMContentLoaded", () => {
  const uploadModalBtn = document.getElementById("uploadModalBtn");
  const uploadModal = document.getElementById("uploadModal");
  const closeUploadModal = document.getElementById("closeUploadModal");
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("uploadFile");
  const dropZoneLabel = document.getElementById("dropZoneLabel");
  const dropZoneDesc = document.getElementById("dropZoneDesc");
  let selectedFile = null;

  if (uploadModalBtn && uploadModal && closeUploadModal) {
    uploadModalBtn.addEventListener("click", () => {
      uploadModal.classList.add("active");
      resetUploadModal();
    });
    closeUploadModal.addEventListener("click", () => {
      uploadModal.classList.remove("active");
      resetUploadModal();
    });
  }

  function resetUploadModal() {
    selectedFile = null;
    if (fileInput) fileInput.value = "";
    if (dropZoneLabel) dropZoneLabel.textContent = "Drop your file here";
    if (dropZoneDesc) dropZoneDesc.textContent = "or click to browse";
    updateUploadStatus("");
    setBtnLoading("uploadBtn", false);
    showMsg("uploadMessage", "");
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener("dragover", e => {
      e.preventDefault();
      dropZone.classList.add("hover");
    });
    dropZone.addEventListener("dragleave", e => {
      dropZone.classList.remove("hover");
    });
    dropZone.addEventListener("drop", e => {
      e.preventDefault();
      dropZone.classList.remove("hover");
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelected(fileInput.files[0]);
      }
    });
    fileInput.addEventListener("change", e => {
      if (fileInput.files.length) {
        handleFileSelected(fileInput.files[0]);
      }
    });
  }

  function handleFileSelected(file) {
    selectedFile = file;
    if (!file) {
      if (dropZoneLabel) dropZoneLabel.textContent = "Drop your file here";
      if (dropZoneDesc) dropZoneDesc.textContent = "or click to browse";
      updateUploadStatus("");
      return;
    }
    if (dropZoneLabel) dropZoneLabel.textContent = file.name;
    if (dropZoneDesc) dropZoneDesc.textContent = `${(file.size/1024).toFixed(2)} KB`;
    updateUploadStatus("File ready for upload.", "info");
  }

  const uploadForm = document.getElementById("uploadForm");
  if (uploadForm) {
    uploadForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      setBtnLoading("uploadBtn", true);
      updateUploadStatus("Uploading, please wait...", "loading");
      showMsg("uploadMessage", "");
      const file = selectedFile || (fileInput && fileInput.files[0]);
      if (!file) {
        updateUploadStatus("❌ Please select a file before uploading.", "error");
        setBtnLoading("uploadBtn", false);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        updateUploadStatus("❌ File too large (max 10MB).", "error");
        setBtnLoading("uploadBtn", false);
        return;
      }
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated.");
        const cid = await uploadToIPFS(file);
        const meta = {
          fileName: file.name,
          size: file.size,
          type: file.type,
          uploadDate: Date.now(),
          ipfsCid: cid,
          status: "Active",
          shares: 0,
          userId: user.uid
        };
        await db.ref(`documents/${user.uid}`).push(meta);
        await logActivity(user.uid, "Document Uploaded", `Uploaded "${file.name}" (${(file.size/1024).toFixed(2)} KB) to IPFS with CID: ${cid}`);
        updateUploadStatus("✅ Upload successful!", "success");
        showDocumentsMsg(`File "${file.name}" uploaded successfully!`, "success");
        setTimeout(() => {
          if (uploadModal) uploadModal.classList.remove("active");
          resetUploadModal();
          renderDashboardSummary(user);
          renderDocuments(user);
        }, 1500);
      } catch (err) {
        updateUploadStatus("❌ Upload failed. Please try again.", "error");
        setBtnLoading("uploadBtn", false);
        console.error("Upload error:", err);
      }
    });
  }
});

// --- Auth Page Handlers ---
document.addEventListener("DOMContentLoaded", () => {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const logoutBtn = document.getElementById("logoutBtn");

  // Tab switching
  if (loginTab && registerTab && loginForm && registerForm) {
    loginTab.addEventListener("click", () => {
      loginTab.classList.add("active");
      registerTab.classList.remove("active");
      loginForm.style.display = "block";
      registerForm.style.display = "none";
      showMsg("loginMessage", "");
      showMsg("registerMessage", "");
    });

    registerTab.addEventListener("click", () => {
      registerTab.classList.add("active");
      loginTab.classList.remove("active");
      registerForm.style.display = "block";
      loginForm.style.display = "none";
      showMsg("loginMessage", "");
      showMsg("registerMessage", "");
    });
  }

  // Login form submission
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setBtnLoading("loginBtn", true);
      showMsg("loginMessage", "");
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      
      if (!email || !password) {
        showMsg("loginMessage", "Please enter both email and password.", "error");
        setBtnLoading("loginBtn", false);
        return;
      }
      
      try {
        await auth.signInWithEmailAndPassword(email, password);
        showMsg("loginMessage", "Login successful! Redirecting...", "success");
      } catch (err) {
        let errorMsg = "Login failed. Please try again.";
        if (err.code === "auth/user-not-found") {
          errorMsg = "No account found with this email. Please register first.";
        } else if (err.code === "auth/wrong-password") {
          errorMsg = "Incorrect password. Please try again.";
        } else if (err.code === "auth/invalid-email") {
          errorMsg = "Invalid email address format.";
        } else if (err.code === "auth/user-disabled") {
          errorMsg = "This account has been disabled.";
        } else if (err.code === "auth/too-many-requests") {
          errorMsg = "Too many failed attempts. Please try again later.";
        }
        showMsg("loginMessage", errorMsg, "error");
        setBtnLoading("loginBtn", false);
      }
    });
  }

  // Register form submission
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setBtnLoading("registerBtn", true);
      showMsg("registerMessage", "");
      const fullName = document.getElementById("registerFullName").value.trim();
      const email = document.getElementById("registerEmail").value.trim();
      const password = document.getElementById("registerPassword").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (!fullName) {
        showMsg("registerMessage", "Please enter your full name.", "error");
        setBtnLoading("registerBtn", false);
        return;
      }

      if (!email || !password || !confirmPassword) {
        showMsg("registerMessage", "Please fill in all fields.", "error");
        setBtnLoading("registerBtn", false);
        return;
      }

      if (password.length < 8) {
        showMsg("registerMessage", "Password must be at least 8 characters long.", "error");
        setBtnLoading("registerBtn", false);
        return;
      }

      if (password !== confirmPassword) {
        showMsg("registerMessage", "Passwords do not match.", "error");
        setBtnLoading("registerBtn", false);
        return;
      }

      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: fullName });
        await db.ref(`users/${userCredential.user.uid}`).set({
          fullName,
          email,
          createdAt: Date.now()
        });
        showMsg("registerMessage", "Account created successfully! Redirecting...", "success");
      } catch (err) {
        let errorMsg = "Registration failed. Please try again.";
        if (err.code === "auth/email-already-in-use") {
          errorMsg = "This email is already registered. Please login instead.";
        } else if (err.code === "auth/invalid-email") {
          errorMsg = "Invalid email address format.";
        } else if (err.code === "auth/weak-password") {
          errorMsg = "Password is too weak. Please use a stronger password.";
        } else if (err.code === "auth/operation-not-allowed") {
          errorMsg = "Email/password authentication is not enabled.";
        }
        showMsg("registerMessage", errorMsg, "error");
        setBtnLoading("registerBtn", false);
      }
    });
  }

  // Logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await auth.signOut();
        window.location.replace("auth.html");
      } catch (err) {
        console.error("Logout error:", err);
      }
    });
  }

  // MetaMask login buttons (placeholder functionality)
  const loginMetaMaskBtn = document.getElementById("loginMetaMaskBtn");
  const registerMetaMaskBtn = document.getElementById("registerMetaMaskBtn");
  
  if (loginMetaMaskBtn) {
    loginMetaMaskBtn.addEventListener("click", () => {
      alert("MetaMask Web3 login is not yet implemented. Please use email/password login.");
    });
  }
  
  if (registerMetaMaskBtn) {
    registerMetaMaskBtn.addEventListener("click", () => {
      alert("MetaMask Web3 login is not yet implemented. Please use email/password registration.");
    });
  }

  // Update username display - wait for config to load
  const waitForAuth = setInterval(() => {
    if (auth) {
      clearInterval(waitForAuth);
      auth.onAuthStateChanged(user => {
        const mainUserName = document.getElementById("mainUserName");
        if (mainUserName && user) {
          mainUserName.textContent = user.displayName || user.email || "User";
        }
      });
    }
  }, 100);
});

// --- Logging Functions ---
async function logActivity(userId, action, details) {
  if (!userId || !db) return;
  try {
    await db.ref(`logs/${userId}`).push({
      action,
      details,
      timestamp: Date.now(),
      date: new Date().toISOString()
    });
  } catch (err) {
    console.error("Logging error:", err);
  }
}

async function renderLogs(user) {
  if (!user) return;
  const logsContainer = document.getElementById("accessTimeline");
  if (!logsContainer) return;
  
  try {
    const logsSnap = await db.ref(`logs/${user.uid}`).orderByChild("timestamp").limitToLast(50).once("value");
    const logs = logsSnap.val() || {};
    const logsArray = Object.entries(logs).map(([id, log]) => ({ id, ...log })).reverse();
    
    if (logsArray.length === 0) {
      logsContainer.innerHTML = '<p style="color: #6b7280;">No activity logs yet.</p>';
      return;
    }
    
    logsContainer.innerHTML = logsArray.map(log => {
      const logType = log.action.toLowerCase().includes('upload') ? 'upload' : 
                      log.action.toLowerCase().includes('share') ? 'share' :
                      log.action.toLowerCase().includes('delete') ? 'delete' :
                      log.action.toLowerCase().includes('revoke') ? 'revoke' : 'access';
      return `
        <div class="log-entry">
          <div class="log-header">
            <div>
              <span class="log-action">${log.action}</span>
              <span class="log-type ${logType}">${logType.toUpperCase()}</span>
            </div>
            <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
          </div>
          <div class="log-details">${log.details}</div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error rendering logs:", err);
    logsContainer.innerHTML = '<p style="color: #d23333;">Error loading logs.</p>';
  }
}

// --- Share Page Functions ---
let allUsers = [];

async function loadAllUsers() {
  try {
    const usersSnap = await db.ref("users").once("value");
    const users = usersSnap.val() || {};
    allUsers = Object.entries(users).map(([uid, user]) => ({ uid, ...user }));
  } catch (err) {
    console.error("Error loading users:", err);
  }
}

function filterUsers(searchTerm) {
  const search = searchTerm.toLowerCase();
  return allUsers.filter(user => 
    (user.fullName && user.fullName.toLowerCase().includes(search)) ||
    (user.email && user.email.toLowerCase().includes(search))
  );
}

window.clearUserSelection = function() {
  document.getElementById("receiverEmail").value = "";
  document.getElementById("receiverSearch").value = "";
  document.getElementById("selectedUser").style.display = "none";
  document.getElementById("userDropdown").style.display = "none";
};

async function populateDocumentDropdown(user) {
  if (!user) return;
  const selectDocument = document.getElementById("selectDocument");
  if (!selectDocument) return;
  
  const docs = await fetchDocuments(user.uid);
  selectDocument.innerHTML = '<option value="" disabled selected>Choose a document</option>';
  
  if (docs.length === 0) {
    selectDocument.innerHTML += '<option disabled>No documents available</option>';
    return;
  }
  
  docs.forEach(doc => {
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = doc.fileName;
    option.dataset.fileName = doc.fileName;
    selectDocument.appendChild(option);
  });
  
  // Check for pre-selected document from URL
  const urlParams = new URLSearchParams(window.location.search);
  const preSelectedDocId = urlParams.get('docId');
  if (preSelectedDocId) {
    selectDocument.value = preSelectedDocId;
  }
}

async function validateRecipientEmail(email) {
  try {
    const usersSnap = await db.ref("users").orderByChild("email").equalTo(email).once("value");
    return usersSnap.exists();
  } catch (err) {
    console.error("Error validating recipient:", err);
    return false;
  }
}

async function renderActiveShares(user) {
  if (!user) return;
  const sharesTable = document.getElementById("sharesTable");
  if (!sharesTable) return;
  
  try {
    const allDocs = await fetchDocuments(user.uid);
    const docsMap = {};
    allDocs.forEach(doc => { docsMap[doc.id] = doc.fileName; });
    
    const sharesSnap = await db.ref("shares").orderByChild("userId").equalTo(user.uid).once("value");
    const shares = sharesSnap.val() || {};
    const activeShares = Object.entries(shares)
      .map(([id, share]) => ({ id, ...share }))
      .filter(s => s.status === "Active");
    
    if (activeShares.length === 0) {
      sharesTable.innerHTML = '<tr><td colspan="6">No active shares</td></tr>';
      return;
    }
    
    sharesTable.innerHTML = activeShares.map(share => {
      const docName = docsMap[share.documentId] || "Unknown Document";
      const expiryText = share.expiryDays === 0 ? "Never" : 
                        share.expiryDate ? new Date(share.expiryDate).toLocaleDateString() : "N/A";
      return `
        <tr>
          <td>${docName}</td>
          <td>${share.receiverEmail || "N/A"}</td>
          <td>${share.permission || "View-only"}</td>
          <td>${expiryText}</td>
          <td><span class="status-tag">${share.status}</span></td>
          <td>
            <button class="doc-action" title="Revoke" onclick="revokeShare('${share.id}')">🚫</button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Error rendering shares:", err);
    sharesTable.innerHTML = '<tr><td colspan="6">Error loading shares</td></tr>';
  }
}

window.revokeShare = async function(shareId) {
  const user = auth.currentUser;
  if (!user) return;
  
  if (!confirm("Are you sure you want to revoke this share?")) return;
  
  try {
    const shareSnap = await db.ref(`shares/${shareId}`).once("value");
    const shareData = shareSnap.val();
    await db.ref(`shares/${shareId}/status`).set("Revoked");
    await logActivity(user.uid, "Share Revoked", `Revoked share for "${shareData?.documentName || 'Unknown'}" with ${shareData?.receiverEmail || 'unknown user'}`);
    showMsg("shareMessage", "Share revoked successfully!", "success");
    await renderActiveShares(user);
  } catch (err) {
    showMsg("shareMessage", "Failed to revoke share. Please try again.", "error");
    console.error("Revoke error:", err);
  }
};

// Share form submission handler and user dropdown
document.addEventListener("DOMContentLoaded", () => {
  const shareForm = document.getElementById("shareForm");
  const receiverSearch = document.getElementById("receiverSearch");
  const userDropdown = document.getElementById("userDropdown");
  const receiverEmail = document.getElementById("receiverEmail");
  const selectedUser = document.getElementById("selectedUser");
  const selectedUserText = document.getElementById("selectedUserText");
  
  if (receiverSearch && userDropdown) {
    // Load users when focusing on search
    receiverSearch.addEventListener("focus", async () => {
      if (allUsers.length === 0) await loadAllUsers();
      if (allUsers.length > 0) {
        userDropdown.innerHTML = allUsers.slice(0, 10).map(user => `
          <div class="user-dropdown-item" data-email="${user.email}">
            <div class="user-name">${user.fullName || 'Unknown'}</div>
            <div class="user-email">${user.email}</div>
          </div>
        `).join("");
        userDropdown.style.display = "block";
      }
    });
    
    // Filter users on input
    receiverSearch.addEventListener("input", (e) => {
      const searchTerm = e.target.value.trim();
      if (searchTerm.length === 0) {
        userDropdown.innerHTML = allUsers.slice(0, 10).map(user => `
          <div class="user-dropdown-item" data-email="${user.email}">
            <div class="user-name">${user.fullName || 'Unknown'}</div>
            <div class="user-email">${user.email}</div>
          </div>
        `).join("");
      } else {
        const filtered = filterUsers(searchTerm).slice(0, 10);
        if (filtered.length > 0) {
          userDropdown.innerHTML = filtered.map(user => `
            <div class="user-dropdown-item" data-email="${user.email}">
              <div class="user-name">${user.fullName || 'Unknown'}</div>
              <div class="user-email">${user.email}</div>
            </div>
          `).join("");
        } else {
          userDropdown.innerHTML = '<div style="padding: 10px; color: #6b7280;">No users found</div>';
        }
      }
      userDropdown.style.display = "block";
    });
    
    // Select user from dropdown
    userDropdown.addEventListener("click", (e) => {
      const item = e.target.closest(".user-dropdown-item");
      if (item) {
        const email = item.dataset.email;
        const name = item.querySelector(".user-name").textContent;
        receiverEmail.value = email;
        receiverSearch.value = "";
        selectedUserText.textContent = `${name} (${email})`;
        selectedUser.style.display = "block";
        userDropdown.style.display = "none";
      }
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!receiverSearch.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.style.display = "none";
      }
    });
  }
  
  if (shareForm) {
    shareForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) {
        showMsg("shareMessage", "You must be logged in to share documents.", "error");
        return;
      }
      
      const selectDocument = document.getElementById("selectDocument");
      const receiverEmailValue = document.getElementById("receiverEmail").value.trim();
      const expiryDays = parseInt(document.getElementById("expiryTime").value);
      const permission = document.getElementById("permissionSelect").value;
      const documentId = selectDocument.value;
      const documentName = selectDocument.options[selectDocument.selectedIndex]?.dataset?.fileName || "Unknown";
      
      if (!documentId || !receiverEmailValue || !permission || expiryDays === undefined) {
        showMsg("shareMessage", "Please fill in all fields.", "error");
        return;
      }
      
      if (receiverEmailValue === user.email) {
        showMsg("shareMessage", "You cannot share a document with yourself.", "error");
        return;
      }
      
      try {
        const shareId = "share_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        const shareData = {
          documentId,
          documentName,
          userId: user.uid,
          receiverEmail: receiverEmailValue,
          permission,
          expiryDays,
          expiryDate: expiryDays > 0 ? Date.now() + (expiryDays * 24 * 60 * 60 * 1000) : null,
          status: "Active",
          link: `${window.location.origin}/view.html?share=${shareId}`,
          createdAt: Date.now()
        };
        
        await db.ref(`shares/${shareId}`).set(shareData);
        await logActivity(user.uid, "Document Shared", `Shared "${documentName}" with ${receiverEmailValue} (${permission} permission, expires: ${expiryDays === 0 ? 'Never' : expiryDays + ' days'})`);
        showMsg("shareMessage", "Document shared successfully!", "success");
        
        shareForm.reset();
        clearUserSelection();
        await renderActiveShares(user);
      } catch (err) {
        showMsg("shareMessage", "Failed to share document. Please try again.", "error");
        console.error("Share error:", err);
      }
    });
  }
});

// Only render after login - wait for config to load first
const waitForAuthInit = setInterval(() => {
  if (auth) {
    clearInterval(waitForAuthInit);
    auth.onAuthStateChanged(user => {
      if (!user && protectedPages.includes(currentPage)) {
        window.location.replace("auth.html");
        return;
      }
      if (user && currentPage === "auth.html") {
        window.location.replace("dashboard.html");
        return;
      }
      if (user && (currentPage === "dashboard.html" || currentPage === "documents.html")) {
        renderDashboardSummary(user);
        renderDocuments(user);
      }
      if (user && currentPage === "share.html") {
        populateDocumentDropdown(user);
        renderActiveShares(user);
      }
      if (user && currentPage === "logs.html") {
        renderLogs(user);
      }
    });
  }
}, 100);