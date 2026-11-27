// =====================================================================
// VECTOR POINT ACADEMY — v3 FRONTEND ENGINE (SINGLE-PAGE PORTAL)
// Paste your v3 Part 1 Google Apps Script /exec Web App URL on Line 5:
// =====================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwBmcwIrodzrDDjgcoe0ggU8ggFpQi04o2xMjmaWi6z99EcXNzxcKWMrbyHxokbE5YElA/exec";

let currentUser = null;
let appData = {};

const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const toastEl = document.getElementById("toast");

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3800);
}

async function callApi(action, payload = {}) {
  if (!API_URL || API_URL.includes("PASTE_YOUR_WEB_APP")) {
    throw new Error("Please paste your Google Apps Script /exec URL on Line 5 of app.js first.");
  }
  const response = await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json();
  if (!data.ok && !data.success) {
    throw new Error(data.error || "Server request failed.");
  }
  return data;
}

// SINGLE-PAGE NAVIGATION
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const targetId = btn.getAttribute("data-target");
    document.querySelectorAll(".view-section").forEach((sec) => sec.classList.add("hidden"));
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.remove("hidden");
  });
});

// IN-PORTAL STUDY MATERIAL VIEWER (NO EXTRA TABS)
function openPreviewModal(title, url) {
  if (!url || url === "#" || url.includes("undefined")) {
    showToast("No Google Drive link attached to this material yet.");
    return;
  }
  let embedUrl = url;
  if (url.includes("drive.google.com") && url.includes("/view")) {
    embedUrl = url.replace("/view", "/preview");
  }
  document.getElementById("previewTitle").textContent = title || "Study Material Preview";
  document.getElementById("previewFrame").src = embedUrl;
  document.getElementById("previewExternalBtn").href = url;
  document.getElementById("previewModal").classList.remove("hidden");
}

document.getElementById("closePreviewBtn").addEventListener("click", () => {
  document.getElementById("previewFrame").src = "";
  document.getElementById("previewModal").classList.add("hidden");
});

// AUTHENTICATION
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const btn = document.getElementById("loginBtn");
  btn.textContent = "Verifying Credentials...";
  btn.disabled = true;

  try {
    const id = document.getElementById("loginId").value.trim();
    const pin = document.getElementById("loginPin").value.trim();
    const res = await callApi("login", { id, pin });
    currentUser = res.user;
    localStorage.setItem("vpa_v3_user", JSON.stringify(currentUser));
    await loadDashboard();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  } finally {
    btn.textContent = "Sign In to Portal";
    btn.disabled = false;
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("vpa_v3_user");
  currentUser = null;
  appShell.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});

document.getElementById("syncBtn").addEventListener("click", async () => {
  showToast("Syncing live Masterfile data...");
  await loadDashboard();
  showToast("Masterfile synced.");
});

// BOOTSTRAP SAVED SESSION
window.addEventListener("DOMContentLoaded", async () => {
  const saved = localStorage.getItem("vpa_v3_user");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      await loadDashboard();
    } catch (_) {
      localStorage.removeItem("vpa_v3_user");
    }
  }
});

async function loadDashboard() {
  if (!currentUser) return;
  const res = await callApi("getDashboardData", {
    userId: currentUser.id,
    role: currentUser.role
  });
  appData = res.dashboard || res;
  if (appData.user) {
    currentUser = appData.user;
    localStorage.setItem("vpa_v3_user", JSON.stringify(currentUser));
  }

  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");

  const role = String(currentUser.role || "Student");
  document.getElementById("sidebarRole").textContent = role + " Portal";
  document.getElementById("sidebarUserName").textContent = currentUser.name || currentUser.id;
  document.getElementById("sidebarUserCohort").textContent = currentUser.cohort || currentUser.id;
  document.getElementById("welcomeText").textContent =
    `Logged in as ${currentUser.name || currentUser.id} (${currentUser.id})`;
  document.getElementById("accountBadge").textContent = `Status: ${currentUser.status || "Active"}`;

  // Role-based navigation tabs
  const navTutor = document.getElementById("navTutorBtn");
  const navAdmin = document.getElementById("navAdminBtn");
  navTutor.classList.toggle("hidden", role === "Student");
  navAdmin.classList.toggle("hidden", role !== "Admin");

  renderKPIs();
  renderTimetable();
  renderMarks();
  renderResources();
  renderFeed();
  renderMessages();
  renderTutorTools();
  renderAdminTools();
}

function renderKPIs() {
  const sessions = appData.sessions || [];
  const marks = appData.marks || [];
  const attendance = appData.attendance || [];
  const resources = appData.resources || [];

  document.getElementById("kpiSessions").textContent = sessions.length;
  document.getElementById("kpiAttendance").textContent = attendance.length;
  document.getElementById("kpiResources").textContent = resources.length;

  const validMarks = marks.filter(m => !isNaN(parseFloat(m.percentage)));
  if (validMarks.length) {
    const avg = validMarks.reduce((sum, m) => sum + parseFloat(m.percentage), 0) / validMarks.length;
    document.getElementById("kpiAvg").textContent = Math.round(avg) + "%";
  } else {
    document.getElementById("kpiAvg").textContent = "0%";
  }
}


function renderTimetable() {
  const tbody = document.getElementById("sessionsTableBody");
  const sessions = appData.sessions || [];
  if (!sessions.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">No scheduled classes found in Master_Timetable or Sessions yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = sessions.map((s) => {
    const link = s.meetingLink || "";
    const hasLink = link && link.startsWith("http");
    const code = s.groupCode || s.cohortCode || "General";
    const slot = s.timeSlot || s.timeslot || "";
    return `
      <tr>
        <td><strong>${s.day || s.date || "Weekly"}</strong><br><small class="muted">${slot}</small></td>
        <td><span class="badge">${code}</span></td>
        <td>${s.grade || ""} ${s.subject || ""}<br><small class="muted">${s.topic || s.curriculum || ""}</small></td>
        <td>${s.tutorName || s.tutorId || "Pending Tutor"}</td>
        <td>
          ${hasLink
            ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="btn-primary btn-sm">Join Class</a>`
            : `<span class="muted">Link Pending</span>`}
          ${currentUser.role === "Student"
            ? `<button type="button" class="btn-secondary btn-sm" onclick="logCheckIn('${s.sessionCode || code}', '${code}', '${s.tutorId || ""}', '${s.subject || ""}')">Check In</button>`
            : ""}
        </td>
      </tr>`;
  }).join("");
}


async function logCheckIn(sessionCode, groupCode, tutorId, topic) {
  try {
    await callApi("checkIn", {
      studentId: currentUser.id,
      studentName: currentUser.name,
      sessionCode,
      groupCode,
      tutorId,
      topic
    });
    showToast("Attendance check-in logged to Session_Attendance!");
    await loadDashboard();
  } catch (err) {
    showToast(err.message);
  }
}

function renderMarks() {
  const tbody = document.getElementById("marksTableBody");
  const marks = appData.marks || [];
  if (!marks.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No assessment marks recorded yet.</td></tr>`;
  } else {
    tbody.innerHTML = marks.map((m) => `
      <tr>
        <td>${m.date || "-"}</td>
        <td>${m.studentName || m.studentId || "-"}</td>
        <td><strong>${m.subject || ""}</strong> — ${m.title || ""}</td>
        <td>${m.markObtained ?? "-"}/${m.totalMark ?? "-"}</td>
        <td>${m.percentage ?? 0}%</td>
        <td><span class="badge">Level ${m.capsLevel || "-"}</span></td>
      </tr>
    `).join("");
  }

  const assignedBody = document.getElementById("assignedTableBody");
  const assigned = appData.assignedAssessments || [];
  if (!assigned.length) {
    assignedBody.innerHTML = `<tr><td colspan="4" class="muted">No assigned assessments yet.</td></tr>`;
  } else {
    assignedBody.innerHTML = assigned.map((a) => `
      <tr>
        <td>${a.dueDate || "-"}</td>
        <td><span class="badge">${a.groupCode || "-"}</span></td>
        <td><strong>${a.type || ""}</strong>: ${a.title || ""}</td>
        <td>${a.instructions || "-"}</td>
      </tr>
    `).join("");
  }
}

function renderResources() {
  const grid = document.getElementById("resourcesGrid");
  const resources = appData.resources || [];
  if (!resources.length) {
    grid.innerHTML = `<p class="muted">No study materials uploaded yet.</p>`;
    return;
  }
  grid.innerHTML = resources.map((r) => `
    <div class="item-card">
      <span class="badge">${r.grade || ""} • ${r.subject || ""} (${r.curriculum || "CAPS"})</span>
      <h4>${r.resourceType || "Study Resource"}</h4>
      <p class="muted" style="margin:6px 0 12px;">Uploaded by ${r.tutorId || "VPA Staff"}</p>
      <button type="button" class="btn-primary btn-sm" onclick="openPreviewModal('${(r.resourceType || "Study File").replace(/'/g, "")}', '${r.resourceLink || ""}')">
        Preview Inside Portal
      </button>
    </div>
  `).join("");
}

function renderFeed() {
  const list = document.getElementById("feedList");
  const feed = appData.announcements || [];
  if (!feed.length) {
    list.innerHTML = `<p class="muted">No announcements posted yet.</p>`;
    return;
  }
  list.innerHTML = feed.map((f) => `
    <div class="card">
      <span class="badge">${f.targetId || "ALL"} • ${f.timestamp || ""}</span>
      <h3>${f.subject || "Academy Notice"}</h3>
      <p>${f.message || ""}</p>
      <small class="muted">Posted by: ${f.senderId || "VPA Admin"}</small>
    </div>
  `).join("");
}

function renderMessages() {
  const select = document.getElementById("msgRecipient");
  const list = document.getElementById("messagesList");
  const recipients = appData.recipients || [];
  const allMsgs = appData.messages || [];
  const myId = String(currentUser.id || "").trim().toUpperCase();

  // Preserve currently selected chat partner across refreshes
  const previousPartner = select.value;

  if (recipients.length) {
    select.innerHTML = recipients
      .filter((r) => String(r.id || "").toUpperCase() !== myId)
      .map((r) => `<option value="${r.id}">${r.id} — ${r.name} (${r.role})</option>`)
      .join("");
  } else {
    select.innerHTML = `<option value="ALL">ALL — Academy Support</option>`;
  }

  if (previousPartner && [...select.options].some((o) => o.value === previousPartner)) {
    select.value = previousPartner;
  }

  // Re-render conversation whenever the user picks a different person
  select.onchange = () => renderMessages();

  const partnerId = String(select.value || "").trim().toUpperCase();

  // Filter saved 1-on-1 conversation between currentUser and partnerId (or ALL broadcast)
  const thread = allMsgs.filter((m) => {
    const sId = String(m.senderId || "").trim().toUpperCase();
    const rId = String(m.recipientId || "").trim().toUpperCase();
    if (partnerId === "ALL") return rId === "ALL";
    return (sId === myId && rId === partnerId) || (sId === partnerId && rId === myId);
  });

  if (!thread.length) {
    list.innerHTML = `<p class="muted">No saved messages with ${select.options[select.selectedIndex]?.text || partnerId} yet. Type below to start chatting!</p>`;
    return;
  }

  list.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px; max-height:420px; overflow-y:auto; padding:12px; background:#f1f5f9; border-radius:12px;">
      ${thread.map((m) => {
        const isMine = String(m.senderId || "").trim().toUpperCase() === myId;
        const align = isMine ? "flex-end" : "flex-start";
        const bubbleBg = isMine ? "#2563eb" : "#ffffff";
        const textColor = isMine ? "#ffffff" : "#0f172a";
        const metaColor = isMine ? "rgba(255,255,255,0.8)" : "#64748b";
        const replyTarget = isMine ? m.recipientId : m.senderId;

        return `
          <div style="align-self:${align}; max-width:75%; background:${bubbleBg}; color:${textColor}; padding:10px 14px; border-radius:14px; box-shadow:0 1px 2px rgba(0,0,0,0.08);">
            <div style="font-size:11px; color:${metaColor}; margin-bottom:4px; display:flex; justify-content:space-between; gap:12px;">
              <strong>${isMine ? "You" : (m.senderName || m.senderId)}</strong>
              <span>${m.timestamp || ""}</span>
            </div>
            <div style="font-size:14px; line-height:1.4; white-space:pre-wrap;">${m.message || ""}</div>
            ${!isMine ? `<button type="button" onclick="selectChatPartner('${replyTarget}')" style="margin-top:6px; font-size:11px; background:none; border:none; color:#2563eb; cursor:pointer; padding:0; font-weight:600;">↩ Reply to ${m.senderName || m.senderId}</button>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function selectChatPartner(userId) {
  const select = document.getElementById("msgRecipient");
  if (!select) return;
  const target = String(userId || "").trim();
  if ([...select.options].some((o) => o.value === target)) {
    select.value = target;
    renderMessages();
  }
  const input = document.getElementById("msgText");
  if (input) input.focus();
}

document.getElementById("messageForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const select = document.getElementById("msgRecipient");
  const recipientId = select.value;
  const recipientLabel = select.options[select.selectedIndex]?.text || recipientId;
  const recipientName = recipientLabel.includes("—") ? recipientLabel.split("—")[1].trim() : recipientId;
  const message = document.getElementById("msgText").value.trim();

  try {
    await callApi("sendMessage", {
      senderId: currentUser.id,
      senderName: currentUser.name,
      recipientId,
      recipientName,
      message
    });
    document.getElementById("msgText").value = "";
    showToast("Message sent to Direct_Messages and emailed!");
    await loadDashboard();
  } catch (err) {
    showToast(err.message);
  }
});

// TUTOR WORKSPACE RENDERING
function renderTutorTools() {
  if (currentUser.role === "Student") return;

  // 1. Open cohorts waiting for a tutor (Col L = Pending Tutor, or Col O = Leave / Paused)
  const openList = document.getElementById("openCohortsList");
  const openCohorts = appData.openCohorts || [];
  if (!openCohorts.length) {
    openList.innerHTML = `<p class="muted">No open cohorts waiting for a tutor right now.</p>`;
  } else {
    openList.innerHTML = openCohorts.map((c) => {
      const code = c.groupCode || c.cohortCode || "";
      const claimType = c.claimType || c.groupStatus || "Permanent Cohort (New / Unassigned)";
      const isTemp = claimType.toLowerCase().includes("temporary") || claimType.toLowerCase().includes("leave") || claimType.toLowerCase().includes("paused");
      const badgeStyle = isTemp ? "background:#fef3c7;color:#b45309;" : "background:#d1fae5;color:#047857;";
      return `
        <div class="item-card" id="cohort-card-${code}">
          <span class="badge" style="${badgeStyle}">${claimType}</span>
          <h4 style="margin:6px 0;">${code}</h4>
          <p class="muted" style="margin:6px 0 12px;">
            <strong>Enrolled:</strong> ${c.enrolled || 0} / ${c.maxCap || 10} students • <strong>Slot:</strong> ${c.timetableSlot || c.slot || "See Master Timetable"}
          </p>
          <button type="button" class="btn-primary btn-sm" onclick="claimOpenCohort('${code}', this)">
            Claim Class (${currentUser.id})
          </button>
        </div>
      `;
    }).join("");
  }

  // 2. Populate Group dropdown for setting Microsoft Teams / Zoom / Meet link
  const linkSelect = document.getElementById("linkCohortSelect");
  const sessions = appData.sessions || [];
  const uniqueGroups = [...new Set(sessions.map((s) => s.groupCode || s.cohortCode).filter(Boolean))];
  linkSelect.innerHTML = uniqueGroups.length
    ? uniqueGroups.map((g) => `<option value="${g}">${g}</option>`).join("")
    : `<option value="">No assigned groups yet</option>`;

  // 3. Populate Student dropdown for recording marks
  const studentSelect = document.getElementById("markStudentSelect");
  const students = appData.students || [];
  studentSelect.innerHTML = students.length
    ? students.map((s) => `<option value="${s.id}">${s.id} — ${s.name} (${s.cohort || ""})</option>`).join("")
    : `<option value="">No students available</option>`;

  // 4. Tutor Directory Search (Live typing + Search button)
  renderTutorDirectory(students);
  const tutorSearchEl = document.getElementById("tutorSearchInput");
  if (tutorSearchEl) {
    tutorSearchEl.oninput = () => filterTutorDirectory();
  }
}

function filterTutorDirectory() {
  const input = document.getElementById("tutorSearchInput");
  const students = appData.students || [];
  const q = (input ? input.value : "").trim().toLowerCase();
  const filtered = students.filter((s) =>
    [s.id, s.name, s.grade, s.subject, s.cohort].some((v) => String(v || "").toLowerCase().includes(q))
  );
  renderTutorDirectory(filtered);
}

function renderTutorDirectory(list) {
  const tbody = document.getElementById("tutorDirectoryBody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No matching students found.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((s) => `
    <tr>
      <td><strong>${s.id}</strong></td>
      <td>${s.name}</td>
      <td>${s.grade || ""} (${s.curriculum || "CAPS"})</td>
      <td>${s.subject || ""}</td>
      <td><span class="badge">${s.cohort || "-"}</span></td>
      <td>${s.status || "Active"}</td>
    </tr>
  `).join("");
}

async function claimOpenCohort(groupCode, btnEl) {
  if (!groupCode || groupCode === "undefined") {
    showToast("Missing Cohort Code.");
    return;
  }
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = "Claiming...";
  }
  try {
    await callApi("claimCohort", {
      groupCode,
      cohortCode: groupCode,
      tutorId: currentUser.id,
      tutorName: currentUser.name
    });
    showToast(`Class ${groupCode} claimed by ${currentUser.id}! Please save your Microsoft Teams/Zoom/Meet link below.`);
    await loadDashboard();
  } catch (err) {
    showToast(err.message);
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = `Claim Class (${currentUser.id})`;
    }
  }
}

document.getElementById("meetingLinkForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const groupCode = document.getElementById("linkCohortSelect").value;
  const meetingLink = document.getElementById("meetingUrlInput").value.trim();
  if (!groupCode) return showToast("Select a group code first.");

  try {
    await callApi("updateMeetingLink", {
      groupCode,
      meetingLink,
      tutorId: currentUser.id,
      tutorName: currentUser.name
    });
    document.getElementById("meetingUrlInput").value = "";
    showToast("Classroom link saved & students notified via email!");
    await loadDashboard();
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById("studyMaterialForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await callApi("addStudyMaterial", {
      tutorId: currentUser.id,
      grade: document.getElementById("matGrade").value.trim(),
      subject: document.getElementById("matSubject").value.trim(),
      curriculum: document.getElementById("matCurriculum").value.trim(),
      resourceType: document.getElementById("matType").value.trim(),
      resourceLink: document.getElementById("matLink").value.trim()
    });
    e.target.reset();
    showToast("Study material published to Study_Materials!");
    await loadDashboard();
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById("markForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const sel = document.getElementById("markStudentSelect");
  const studentId = sel.value;
  const label = sel.options[sel.selectedIndex]?.text || studentId;
  const studentName = label.includes("—") ? label.split("—")[1].split("(")[0].trim() : studentId;

  try {
    await callApi("addMark", {
      tutorId: currentUser.id,
      tutorName: currentUser.name,
      studentId,
      studentName,
      subject: document.getElementById("markSubject").value.trim(),
      assessmentFormat: document.getElementById("markFormat").value.trim(),
      assessmentTitle: document.getElementById("markTitle").value.trim(),
      markObtained: Number(document.getElementById("markObtained").value),
      totalMark: Number(document.getElementById("markTotal").value)
    });
    e.target.reset();
    showToast("Mark saved to Academic_Progress_Log!");
    await loadDashboard();
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById("announcementForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await callApi("addAnnouncement", {
      senderId: currentUser.id,
      audienceType: "Cohort/All",
      targetId: document.getElementById("annTarget").value.trim(),
      subject: document.getElementById("annSubject").value.trim(),
      message: document.getElementById("annMessage").value.trim()
    });
    e.target.reset();
    showToast("Announcement posted to Announcements tab!");
    await loadDashboard();
  } catch (err) {
    showToast(err.message);
  }
});

// EXECUTIVE FINANCE & ADMIN RENDERING
function renderAdminTools() {
  if (currentUser.role !== "Admin") return;

  const fin = appData.finance || {};
  document.getElementById("finCollected").textContent = "R " + Number(fin.collected || 0).toLocaleString();
  document.getElementById("finOutstanding").textContent = "R " + Number(fin.outstanding || 0).toLocaleString();
  document.getElementById("finOutflow").textContent = "R " + Number((fin.payroll || 0) + (fin.expenses || 0)).toLocaleString();
  document.getElementById("finProfit").textContent = "R " + Number(fin.netProfit || 0).toLocaleString();

  // Billing Ledger Table
  const billingBody = document.getElementById("billingTableBody");
  const ledger = appData.billingLedger || [];
  if (!ledger.length) {
    billingBody.innerHTML = `<tr><td colspan="7" class="muted">No invoices found in Billing_Ledger.</td></tr>`;
  } else {
    billingBody.innerHTML = ledger.map((b) => `
      <tr>
        <td><strong>${b.invoiceId || "-"}</strong></td>
        <td>${b.billingMonth || "-"}</td>
        <td>${b.studentName || b.studentId || "-"}</td>
        <td>R ${b.amountDue || 0} / R ${b.amountPaid || 0}</td>
        <td>R ${b.balance || 0}</td>
        <td><span class="badge">${b.paymentStatus || "Pending"}</span></td>
        <td>
          ${b.paymentStatus !== "Paid"
            ? `<button type="button" class="btn-primary btn-sm" onclick="markInvoicePaid('${b.invoiceId}', ${b.amountDue || 600})">Mark Paid</button>`
            : `<span class="muted">Settled</span>`}
        </td>
      </tr>
    `).join("");
  }

  // Combined Student & Tutor Directory Search
  const combined = [
    ...(appData.tutors || []).map((t) => ({ ...t, roleLabel: "Tutor" })),
    ...(appData.students || []).map((s) => ({ ...s, roleLabel: "Student" }))
  ];
  renderAdminDirectory(combined);
  attachSmartDirectorySearch({
    inputSelector: '#adminSearchInput, input[placeholder*="Search by Student ID"]',
    dataset: combined,
    renderFn: renderAdminDirectory
  });

}

function renderAdminDirectory(list) {
  const tbody = document.getElementById("adminDirectoryBody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No matching records found.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((item) => `
    <tr>
      <td><span class="badge">${item.roleLabel}</span> <strong>${item.id}</strong></td>
      <td>${item.name}</td>
      <td>${item.grade ? item.grade + " • " : ""}${item.subject || "-"}</td>
      <td>${item.cohort || "-"}</td>
      <td>${item.packageType || item.email || "-"}</td>
      <td>${item.status || "Active"}</td>
    </tr>
  `).join("");
}

async function markInvoicePaid(invoiceId, amountDue) {
  try {
    await callApi("markInvoicePaid", { invoiceId, amountPaid: amountDue });
    showToast(`Invoice ${invoiceId} marked Paid in Billing_Ledger!`);
    await loadDashboard();
  } catch (err) {
    showToast(err.message);
  }
}

function filterAdminDirectory() {
  const input = document.getElementById("adminSearchInput");
  const q = (input ? input.value : "").trim().toLowerCase();
  const combined = [
    ...(appData.tutors || []).map((t) => ({ ...t, roleLabel: "Tutor" })),
    ...(appData.students || []).map((s) => ({ ...s, roleLabel: "Student" }))
  ];
  if (!q) {
    renderAdminDirectory(combined);
    return;
  }
  const exactId = combined.filter((item) => String(item.id || "").trim().toLowerCase() === q);
  if (exactId.length) {
    renderAdminDirectory(exactId);
    return;
  }
  const partial = combined.filter((item) =>
    [item.id, item.name, item.grade, item.subject, item.cohort, item.packageType, item.email]
      .some((v) => String(v || "").toLowerCase().includes(q))
  );
  renderAdminDirectory(partial.length ? [partial[0]] : []);
}

// LIVE BACKGROUND AUTO-SYNC (Refreshes every 20 seconds when not typing)
setInterval(async () => {
  if (!currentUser) return;
  const activeTag = document.activeElement ? document.activeElement.tagName : "";
  if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
  try {
    await loadDashboard();
  } catch (_) {
    // Silent retry on next cycle
  }
}, 20000);

// =====================================================================
// UNIVERSAL DIRECTORY AUTOCOMPLETE & SINGLE-PERSON SEARCH (ALL ROLES)
// =====================================================================
function attachSmartDirectorySearch({ inputSelector, buttonSelector, dataset, renderFn }) {
  const input = document.querySelector(inputSelector);
  if (!input) return;

  // Locate the Search button right next to the input if no explicit selector is passed
  const searchBtn = buttonSelector
    ? document.querySelector(buttonSelector)
    : input.parentElement?.querySelector("button");

  // Create or reuse a floating autocomplete suggestions box under the input
  input.parentElement.style.position = "relative";
  let sugBox = input.parentElement.querySelector(".vpa-search-suggestions");
  if (!sugBox) {
    sugBox = document.createElement("div");
    sugBox.className = "vpa-search-suggestions";
    Object.assign(sugBox.style, {
      position: "absolute",
      top: "100%",
      left: "0",
      right: searchBtn ? "95px" : "0",
      background: "#ffffff",
      border: "1px solid #cbd5e1",
      borderRadius: "8px",
      boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
      zIndex: "9999",
      maxHeight: "220px",
      overflowY: "auto",
      display: "none",
      marginTop: "4px"
    });
    input.parentElement.appendChild(sugBox);
  }

  const executeExactSearch = () => {
    sugBox.style.display = "none";
    const q = input.value.trim().toLowerCase();
    if (!q) {
      renderFn(dataset);
      return;
    }
    // Prioritize exact ID match first; otherwise show closest single/matching record
    const exactIdMatch = dataset.filter(
      (item) => String(item.id || "").trim().toLowerCase() === q
    );
    if (exactIdMatch.length) {
      renderFn(exactIdMatch);
      return;
    }
    const partialMatches = dataset.filter((item) =>
      [item.id, item.name, item.email, item.cohort, item.subject]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
    renderFn(partialMatches.length ? [partialMatches[0]] : []);
  };

  // Show live suggestions while typing
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      sugBox.style.display = "none";
      renderFn(dataset);
      return;
    }

    const matches = dataset
      .filter((item) =>
        [item.id, item.name, item.roleLabel]
          .some((v) => String(v || "").toLowerCase().includes(q))
      )
      .slice(0, 8);

    if (!matches.length) {
      sugBox.innerHTML = `<div style="padding:10px 12px;color:#64748b;font-size:13px;">No matching ID or name</div>`;
      sugBox.style.display = "block";
      return;
    }

    sugBox.innerHTML = matches
      .map(
        (m) => `
        <div class="vpa-sug-item" data-id="${m.id || ""}" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;font-size:13px;">
          <span><strong>${m.id || "-"}</strong> — ${m.name || "Unknown"}</span>
          <span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">${m.roleLabel || ""}</span>
        </div>`
      )
      .join("");
    sugBox.style.display = "block";

    sugBox.querySelectorAll(".vpa-sug-item").forEach((rowEl) => {
      rowEl.onmousedown = (ev) => {
        ev.preventDefault();
        input.value = rowEl.getAttribute("data-id") || "";
        executeExactSearch();
      };
    });
  };

  // Wire up the Search button click & Enter key
  if (searchBtn) {
    searchBtn.type = "button";
    searchBtn.style.cursor = "pointer";
    searchBtn.onclick = (e) => {
      e.preventDefault();
      executeExactSearch();
    };
  }

  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeExactSearch();
    }
  };

  document.addEventListener("click", (e) => {
    if (!input.parentElement.contains(e.target)) {
      sugBox.style.display = "none";
    }
  });
}

// =====================================================================
// AUTO-BIND ALL DIRECTORY SEARCH BARS (ADMIN, TUTOR & STUDENT VIEWS)
// =====================================================================
function initAllPortalDirectorySearches() {
  const combined = [
    ...(appData.tutors || []).map((t) => ({ ...t, roleLabel: "Tutor" })),
    ...(appData.students || []).map((s) => ({ ...s, roleLabel: "Student" }))
  ];
  if (!combined.length) return;

  // Find every search box on the page whose placeholder mentions ID, Student, or Tutor
  document.querySelectorAll('input[placeholder*="ID"], input[placeholder*="Search"], input[type="search"]').forEach((inputEl) => {
    if (inputEl.dataset.vpaSearchBound === "1") return;
    inputEl.dataset.vpaSearchBound = "1";

    // Find the closest table <tbody> right below this search bar
    const card = inputEl.closest(".card") || inputEl.parentElement?.parentElement;
    const tbody = card ? card.querySelector("tbody") : null;
    if (!tbody) return;

    const renderMatchedRows = (rows) => {
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">No matching student or tutor found.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows
        .map(
          (item) => `
          <tr>
            <td><strong>${item.roleLabel || item.role || "-"}</strong><br><span class="muted">${item.id || "-"}</span></td>
            <td>${item.name || "-"}</td>
            <td>${item.grade || "-"} ${item.subject ? "• " + item.subject : ""}</td>
            <td>${item.cohort || "-"}</td>
            <td>${item.packageType || item.email || "-"}</td>
            <td><span class="badge">${item.status || "Active"}</span></td>
          </tr>`
        )
        .join("");
    };

    if (!inputEl.id) inputEl.id = "vpaDirInput_" + Math.random().toString(36).slice(2, 7);
    attachSmartDirectorySearch({
      inputSelector: "#" + inputEl.id,
      dataset: combined,
      renderFn: renderMatchedRows
    });
  });
}

// Re-check whenever dashboard data loads or refreshes
setInterval(initAllPortalDirectorySearches, 1500);
