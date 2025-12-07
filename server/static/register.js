// ================================
// register.js
// Handles login/register form, validation, toast messages, and redirects
// ================================

// === Elements ===
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const toast = document.getElementById('toast');

const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');

// Login form inputs
const loginUsername = document.getElementById('username');
const loginDob = document.getElementById('dob');

// Register form inputs
const regRole = document.getElementById('role');
const regName = document.getElementById('name');
const regGender = document.getElementById('gender');
const regId = document.getElementById('maatramId');
const regEmail = document.getElementById('email');
const regPassword = document.getElementById('password');
const regConfirmPassword = document.getElementById('confirmPassword');

// Regex for validation
const idRegex = /^MAA\d{6}$/i;
const dobRegex = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

// === Toast Function ===
function showToast(msg, ok = true, time = 2500) {
  toast.style.display = 'block';
  toast.style.background = ok ? '#16a34a' : '#ef4444';
  toast.textContent = msg;
  setTimeout(() => (toast.style.display = 'none'), time);
}

// === Toggle Forms ===
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

// === Login Form Submit ===
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = loginUsername.value.trim();
  const dob = loginDob.value.trim();
  const userTypeInput = document.querySelector('input[name="user_type"]:checked');
  const user_type = userTypeInput ? userTypeInput.value : null;

  if (!username || !dob || !user_type) {
    return showToast("Please fill all fields and select user type!", false);
  }

  if (!idRegex.test(username) || !dobRegex.test(dob)) {
    return showToast("Invalid username or DOB format", false);
  }

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, dob, user_type })
    });

    const data = await response.json();

    if (data.success) {
      showToast("Login successful!");
      localStorage.setItem('maatram_current_user', JSON.stringify(data.user));

      setTimeout(() => {
        // Redirect based on user type
        switch (data.user.type) {
          case "mentor":
            window.location.href = "/mentor";
            break;
          case "student":
            window.location.href = "/carpre";
            break;
          case "admin":
            window.location.href = "/admin";
            break;
          default:
            window.location.href = "/";
        }
      }, 1200);

    } else {
      showToast(data.message || "Invalid username or DOB", false);
    }
  } catch (err) {
    console.error(err);
    showToast("Server error during login", false);
  }
});

// === Register Form Submit ===
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const role = regRole.value;
  const name = regName.value.trim();
  const gender = regGender.value;
  const username = regId.value.trim();
  const email = regEmail.value.trim();
  const password = regPassword.value.trim();
  const confirmPassword = regConfirmPassword.value.trim();

  if (!role || !name || !gender || !username || !email || !password || !confirmPassword) {
    return showToast("Please fill in all fields.", false);
  }

  if (!idRegex.test(username)) {
    return showToast("Maatram ID format invalid (Eg: MAA000000)", false);
  }

  if (password !== confirmPassword) {
    return showToast("Passwords do not match.", false);
  }

  try {
    const response = await fetch("/register-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, name, username, dob: password }) // sending DOB as placeholder
    });

    const data = await response.json();

    if (data.success) {
      showToast("Registration successful!");
      setTimeout(() => btnLogin.click(), 1500); // switch to login form
    } else {
      showToast(data.message || "Registration failed", false);
    }
  } catch (err) {
    console.error(err);
    showToast("Server error during registration", false);
  }
});
