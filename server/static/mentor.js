// =======================================================
// Mentor Dashboard JS - Full Updated Version
// =======================================================

// -------------------------
// Helper Utilities
// -------------------------
const safeGet = (id) => document.getElementById(id) || document.querySelector(`#${id}`) || null;
const setHTML = (el, html) => { if (!el) return; el.innerHTML = html; el.style.display = 'block'; };
const hideEl = (el) => { if (!el) return; el.style.display = 'none'; };
const showEl = (el) => { if (!el) return; el.style.display = 'block'; };

const safeFetchJson = async (url, body = {}) => {
  try {
    const res = await fetch(url, body && Object.keys(body).length ? {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    } : {});
    return await res.json();
  } catch (err) {
    console.error("Fetch error:", url, err);
    throw err;
  }
};

// =======================================================
// SIDEBAR TOGGLE
// =======================================================
const sidebar = safeGet("sidebar");
const sidebarToggleBtn = safeGet("sidebarToggle");

if (sidebarToggleBtn && sidebar) {
  sidebarToggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("active");
    document.body.classList.toggle("sidebar-open");
  });
}

function closeSidebar() {
  if (sidebar) sidebar.classList.remove("active");
  document.body.classList.remove("sidebar-open");
}

// =======================================================
// PROFILE FORM SECTION (WhatsApp Auto-Fill)
// =======================================================
const waCheckbox = safeGet("waCheckbox");
const phoneInput = safeGet("phone");
const whatsappInput = safeGet("whatsapp");

if (waCheckbox && phoneInput && whatsappInput) {
  waCheckbox.addEventListener("change", () => {
    if (waCheckbox.checked) {
      whatsappInput.value = phoneInput.value;
      whatsappInput.readOnly = true;
    } else {
      whatsappInput.value = "";
      whatsappInput.readOnly = false;
    }
  });

  phoneInput.addEventListener("input", () => {
    if (waCheckbox.checked) whatsappInput.value = phoneInput.value;
  });
}

const submitProfileBtn = safeGet("submitProfile");
if (submitProfileBtn) {
  submitProfileBtn.addEventListener("click", () => {
    const fields = [
      "program", "batch", "college", "company",
      "department", "linkedin", "phone",
      "whatsapp", "address"
    ];

    for (let id of fields) {
      const el = safeGet(id);
      if (!el || !el.value.trim()) {
        alert("Please fill all fields!");
        return;
      }
    }

    fields.forEach(id => localStorage.setItem(id, safeGet(id).value.trim()));
    alert("Profile completed successfully!");
    closeSidebar();
  });
}

// =======================================================
// LOAD USER INFO IN HEADER
// =======================================================
async function loadUserInfo() {
  try {
    const res = await fetch('/get-user');
    const user = await res.json();

    if (safeGet("userName")) safeGet("userName").innerText = user.name || "";
    if (safeGet("userMaatramId")) safeGet("userMaatramId").innerText = user.username || "";
    if (safeGet("userPhone")) safeGet("userPhone").innerText = user.phno || "";
  } catch (err) {
    console.warn("User info not available:", err);
  }
}

window.onload = loadUserInfo;

// =======================================================
// LOGIN HANDLING
// =======================================================
const loginForm = safeGet("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = safeGet("username")?.value.trim();
    const dob = safeGet("dob")?.value.trim();
    const user_type = document.querySelector('input[name="user_type"]:checked')?.value;

    if (!username || !dob || !user_type) {
      alert("Please fill all fields and choose a user type!");
      return;
    }

    try {
      const data = await safeFetchJson("/login", { username, dob, user_type });
      alert(data.message || "Login response received");

      if (data.success) {
        localStorage.setItem("name", data.user?.name || "");
        localStorage.setItem("maatramId", data.user?.username || "");
        localStorage.setItem("phone", data.user?.phone || "");
        window.location.href = data.redirect || "/mentor";
      }
    } catch (err) {
      alert("Login failed. Check console.");
      console.error(err);
    }
  });
}

// =======================================================
// CAREER PREDICTION (Optional for Mentor)
// =======================================================
const predictBtn = safeGet("predictBtn");
const cgpaInput = safeGet("cgpa");
const skillsInput = safeGet("skills");
const certInput = safeGet("certificates");
const resultBox = safeGet("result");

if (predictBtn) {
  predictBtn.addEventListener("click", async () => {
    const cgpa = cgpaInput?.value.trim();
    const skills = skillsInput?.value.trim();
    const certificates = certInput?.value.trim();

    if (!cgpa || !skills || !certificates) {
      alert("Please fill all fields!");
      return;
    }

    setHTML(resultBox, "<em>Predicting...</em>");

    try {
      const data = await safeFetchJson("/predict", { cgpa, skills, certificates });
      setHTML(resultBox, `Recommended Career: <b>${data.recommended_career || 'N/A'}</b>`);
    } catch (err) {
      setHTML(resultBox, "<p style='color:red'>Prediction failed</p>");
      console.error(err);
    }
  });
}

// =======================================================
// STUDENT SEARCH + DISPLAY
// =======================================================
let allStudents = [];

async function loadStudents() {
  try {
    const res = await fetch("/get-students");
    const data = await res.json();
    if (data.success) {
      allStudents = data.students || [];
      displayStudents(allStudents);
    }
  } catch (err) {
    console.error("Error loading students:", err);
    const container = safeGet("studentsList");
    if (container) container.innerHTML = "<p style='color:red'>Failed to load students</p>";
  }
}

function displayStudents(list) {
  const container = safeGet("studentsList");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = "<p>No matching students found.</p>";
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="student-item" onclick="openStudent('${s.id}')">
      <strong>${s.name || 'N/A'}</strong><br>
      <small>ID: ${s.id || '-'} | Phone: ${s.phone || '-'}</small>
    </div>
  `).join("");
}

// Search functionality
const searchInput = safeGet("studentSearch");
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase();
    const filtered = allStudents.filter(s =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.id || "").toLowerCase().includes(q) ||
      (s.phone || "").includes(q)
    );
    displayStudents(filtered);
  });
}

// =======================================================
// OPEN STUDENT MINI PANEL (Inline on Mentor Dashboard)
// =======================================================
window.openStudent = async function(studentId) {
  try {
    const res = await fetch(`/get-student/${studentId}`);
    const data = await res.json();
    const student = data.student || data;

    if (!student || !student.id) {
      alert("Student details not found!");
      return;
    }

    const panel = safeGet("studentPanel");
    const overlay = safeGet("overlay");

    if (!panel || !overlay) return;

    panel.innerHTML = `
      <span class="close-panel">&times;</span>
      <h3>${student.name || "N/A"}</h3>
      <p><strong>ID:</strong> ${student.id || '-'}</p>
      <p><strong>Phone:</strong> ${student.phone || '-'}</p>
      <hr>
      <h4>Certificates / Skills:</h4>
      <ul>${(student.certificates || []).map(c => `<li>${c}</li>`).join('')}</ul>
      <button id="viewGraphBtn" class="btn">View Progress Graph</button>
    `;

    panel.classList.add("open");
    overlay.style.display = "block";

    panel.querySelector(".close-panel").addEventListener("click", () => {
      panel.classList.remove("open");
      overlay.style.display = "none";
    });

    overlay.addEventListener("click", () => {
      panel.classList.remove("open");
      overlay.style.display = "none";
    });

  } catch (err) {
    console.error("Error fetching student:", err);
    alert("Failed to load student details.");
  }
};

// =======================================================
// INITIALIZATION
// =======================================================
loadStudents();
