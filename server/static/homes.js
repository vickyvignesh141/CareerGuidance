// ==========================
// Elements
// ==========================
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginId = document.getElementById('loginId');
const loginPassword = document.getElementById('loginPassword');
const registerId = document.getElementById('registerId');
const registerPassword = document.getElementById('registerPassword');
const registerName = document.getElementById('registerName');
const toast = document.getElementById('toast');

const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.querySelector(".sidebar");

// ==========================
// Regex Validation
// ==========================
const idRegex = /^MAA\d{6}$/i;
const dobRegex = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
const passwordRegex = /^.{6,}$/; // Minimum 6 characters

// ==========================
// Sidebar Toggle
// ==========================
menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// ==========================
// Toast Notification
// ==========================
function showToast(msg, ok = true, time = 2500) {
  toast.style.display = 'block';
  toast.style.background = ok ? '#16a34a' : '#ef4444';
  toast.textContent = msg;
  setTimeout(() => (toast.style.display = 'none'), time);
}

// ==========================
// Toggle Forms (Login / Register)
// ==========================
btnLogin.addEventListener('click', () => {
  loginForm.classList.add('active');
  registerForm.classList.remove('active');
  btnLogin.classList.add('active');
  btnRegister.classList.remove('active');
});

btnRegister.addEventListener('click', () => {
  registerForm.classList.add('active');
  loginForm.classList.remove('active');
  btnRegister.classList.add('active');
  btnLogin.classList.remove('active');
});

// ==========================
// Login Form Submit
// ==========================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = loginId.value.trim();
  const pass = loginPassword.value.trim();

  if (!idRegex.test(id) || !dobRegex.test(pass)) {
    return showToast('Invalid credentials', false);
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: id, dob: pass })
    });

    const data = await res.json();

    if (data.success) {
      showToast("Login successful!");
      localStorage.setItem('maatram_current_user', JSON.stringify(data.user));
      setTimeout(() => window.location.href = "career.html", 1500);
    } else {
      showToast(data.message || "Invalid credentials", false);
    }
  } catch (err) {
    console.error(err);
    showToast("Server error during login", false);
  }
});

// ==========================
// Register Form Submit
// ==========================
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = registerId.value.trim();
  const name = registerName.value.trim();
  const pass = registerPassword.value.trim();

  if (!idRegex.test(id)) {
    return showToast('Invalid ID format', false);
  }
  if (name.length < 2) {
    return showToast('Name too short', false);
  }
  if (!passwordRegex.test(pass)) {
    return showToast('Password must be at least 6 characters', false);
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: id, name: name, password: pass })
    });

    const data = await res.json();

    if (data.success) {
      showToast("Registration successful!");
      setTimeout(() => {
        btnLogin.click(); // Switch to login form
        loginId.value = id;
        loginPassword.value = '';
      }, 1500);
    } else {
      showToast(data.message || "Registration failed", false);
    }
  } catch (err) {
    console.error(err);
    showToast("Server error during registration", false);
  }
});
