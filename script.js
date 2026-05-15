const API_BASE = localStorage.getItem("apiBase")
  || (["127.0.0.1", "localhost"].includes(location.hostname)
    ? "http://127.0.0.1:5000"
    : "https://lifexp-backend.onrender.com");
const categories = [
  "coding",
  "fitness",
  "study",
  "health",
  "career",
  "creativity",
  "mindfulness",
  "finance",
  "communication",
  "household"
];

const storage = {
  get token() {
    return localStorage.getItem("token");
  },
  get userId() {
    return localStorage.getItem("userId");
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  },
  setSession(token, user) {
    const safeUser = sanitizeUser(user);
    localStorage.setItem("token", token);
    localStorage.setItem("userId", safeUser._id);
    localStorage.setItem("user", JSON.stringify(safeUser));
  },
  updateUser(user) {
    const safeUser = sanitizeUser(user);
    localStorage.setItem("user", JSON.stringify(safeUser));
    if (safeUser && safeUser._id) localStorage.setItem("userId", safeUser._id);
  },
  clear() {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("user");
    localStorage.removeItem("currentChallenge");
    localStorage.removeItem("challengePageCurrent");
  }
};

function sanitizeUser(user = {}) {
  const { password, __v, ...safeUser } = user;
  return safeUser;
}

function setMessage(id, text, type = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`.trim();
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function getAdminSecret() {
  return localStorage.getItem("adminSecret") || "";
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Upload a proof photo before completing."));
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("Proof photo must be JPG, PNG, or WEBP."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.76));
      };
      img.onerror = () => reject(new Error("Could not read proof photo."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read proof photo."));
    reader.readAsDataURL(file);
  });
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (storage.token) {
    headers.Authorization = `Bearer ${storage.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed");
  }

  return data;
}

function setupMobileNav() {
  const shell = document.querySelector(".app-shell");
  const sidebar = document.querySelector(".sidebar");
  if (!shell || !sidebar || document.querySelector(".mobile-nav-toggle")) return;

  const toggle = document.createElement("button");
  toggle.className = "mobile-nav-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Toggle navigation");
  toggle.textContent = "Menu";
  document.body.prepend(toggle);

  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);

  function closeNav() {
    document.body.classList.remove("sidebar-open");
  }

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });
  overlay.addEventListener("click", closeNav);
  sidebar.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
}

function requireAuth() {
  const isAuthPage = location.pathname.endsWith("index.html") || location.pathname.endsWith("/");
  if (!isAuthPage && !storage.token) {
    location.href = "index.html";
  }
}

function logout() {
  storage.clear();
  location.href = "index.html";
}

function bindLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

function initAuthPage() {
  const form = document.getElementById("authForm");
  const signupBtn = document.getElementById("signupBtn");
  if (!form) return;

  if (storage.token) {
    location.href = "dashboard.html";
    return;
  }

  async function login(username, password) {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    storage.setSession(data.token, data.user);
    location.href = "dashboard.html";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value.trim();

    try {
      setMessage("authMessage", "Logging in...");
      await login(username, password);
    } catch (error) {
      setMessage("authMessage", error.message, "error");
    }
  });

  signupBtn.addEventListener("click", async () => {
    const username = form.username.value.trim();
    const password = form.password.value.trim();

    if (!username || !password) {
      setMessage("authMessage", "Enter username and password first.", "error");
      return;
    }

    try {
      setMessage("authMessage", "Creating account...");
      await apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      await login(username, password);
    } catch (error) {
      setMessage("authMessage", error.message, "error");
    }
  });
}

function getInitialCategory() {
  const params = new URLSearchParams(location.search);
  const category = params.get("category");
  return categories.includes(category) ? category : "coding";
}

function updateUserUI() {
  const user = storage.user;
  const categoryXP = user.categoryXP || {};

  const usernameDisplay = document.getElementById("usernameDisplay");
  const shortUserId = document.getElementById("shortUserId");
  const friendPageUserId = document.getElementById("friendPageUserId");

  if (usernameDisplay) usernameDisplay.textContent = user.username || "Player";
  if (shortUserId) shortUserId.textContent = storage.userId ? storage.userId.slice(-6) : "...";
  if (friendPageUserId) friendPageUserId.textContent = storage.userId || "...";

  const fields = {
    xpDisplay: user.xp ?? 0,
    levelDisplay: user.level ?? 1,
    streakDisplay: user.streak ?? 0,
    codingXp: `${categoryXP.coding ?? 0} XP`,
    fitnessXp: `${categoryXP.fitness ?? 0} XP`,
    studyXp: `${categoryXP.study ?? 0} XP`
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

function renderChallenge(challenge) {
  const empty = document.getElementById("challengeEmpty");
  const card = document.getElementById("challengeCard");
  const title = document.getElementById("challengeTitle");
  const meta = document.getElementById("challengeMeta");
  const difficulty = document.getElementById("difficultyBadge");
  const completeBtn = document.getElementById("completeChallengeBtn");
  const timer = document.getElementById("attemptTimer");

  if (!challenge || !challenge._id) {
    empty?.classList.remove("hidden");
    card?.classList.add("hidden");
    if (difficulty) difficulty.textContent = "Ready";
    if (completeBtn) completeBtn.disabled = true;
    if (timer) timer.textContent = "";
    return;
  }

  empty?.classList.add("hidden");
  card?.classList.remove("hidden");
  title.textContent = challenge.title || "Untitled challenge";
  meta.textContent = `${challenge.category || "general"} • ${challenge.difficulty || "any"} • ${challenge.xp || 0} XP`;
  difficulty.textContent = challenge.difficulty || "Challenge";
  const description = document.getElementById("challengeDescription");
  if (description) {
    const minutes = challenge.estimatedMinutes ? ` • ${challenge.estimatedMinutes} min` : "";
    description.textContent = `${challenge.description || ""}${minutes}`;
  }
  completeBtn.disabled = false;
}

function unpackChallengeResponse(data) {
  if (data?.challenge) {
    return {
      challenge: data.challenge,
      attempt: data.attempt || null
    };
  }

  return {
    challenge: data,
    attempt: null
  };
}

function updateAttemptTimer(attempt) {
  const timer = document.getElementById("attemptTimer");
  const completeBtn = document.getElementById("completeChallengeBtn");
  if (!timer || !completeBtn || !attempt?.earliestCompleteAt) return;

  const remaining = Math.ceil((new Date(attempt.earliestCompleteAt) - new Date()) / 1000);

  if (remaining > 0) {
    timer.textContent = `Server check: ${remaining}s left before completion is allowed.`;
    completeBtn.disabled = true;
  } else {
    timer.textContent = "Server check passed. You can complete this challenge now.";
    completeBtn.disabled = false;
  }
}

function initDashboard() {
  const getBtn = document.getElementById("getChallengeBtn");
  if (!getBtn) return;

  let selectedCategory = getInitialCategory();
  let currentChallenge = null;
  const categoryLabel = document.getElementById("categoryLabel");

  function setCategory(category) {
    selectedCategory = category;
    if (categoryLabel) {
      categoryLabel.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    }
    document.querySelectorAll(".category-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.category === category);
    });
    currentChallenge = null;
    localStorage.removeItem("currentChallenge");
    renderChallenge(null);
    setMessage("dashboardMessage", "");
  }

  document.querySelectorAll(".category-tab").forEach((tab) => {
    tab.addEventListener("click", () => setCategory(tab.dataset.category));
  });

  getBtn.addEventListener("click", async () => {
    try {
      setMessage("dashboardMessage", "Loading challenge...");
      currentChallenge = await apiRequest("/api/challenge/get", {
        method: "POST",
        body: JSON.stringify({ category: selectedCategory })
      });

      if (!currentChallenge) {
        renderChallenge(null);
        setMessage("dashboardMessage", "No challenge found for this category.", "error");
        return;
      }

      localStorage.setItem("currentChallenge", JSON.stringify(currentChallenge));
      renderChallenge(currentChallenge);
      setMessage("dashboardMessage", "Challenge ready.", "success-text");
    } catch (error) {
      setMessage("dashboardMessage", error.message, "error");
    }
  });

  document.getElementById("completeChallengeBtn").addEventListener("click", async () => {
    if (!currentChallenge?._id) return;

    try {
      setMessage("dashboardMessage", "Completing challenge...");
      const data = await apiRequest("/api/challenge/complete", {
        method: "POST",
        body: JSON.stringify({
          userId: storage.userId,
          challengeId: currentChallenge._id
        })
      });
      storage.updateUser(data.user);
      updateUserUI();
      currentChallenge = null;
      localStorage.removeItem("currentChallenge");
      renderChallenge(null);
      setMessage("dashboardMessage", data.message || "Challenge completed.", "success-text");
    } catch (error) {
      setMessage("dashboardMessage", error.message, "error");
    }
  });

  try {
    currentChallenge = JSON.parse(localStorage.getItem("currentChallenge") || "null");
  } catch {
    currentChallenge = null;
  }

  setCategory(selectedCategory);
  renderChallenge(currentChallenge);
  updateUserUI();
}

function initChallengePage() {
  const getBtn = document.getElementById("getPageChallengeBtn");
  if (!getBtn) return;

  let mode = "static";
  let currentChallenge = null;
  let currentAttempt = null;
  let timerId = null;
  const difficultySelect = document.getElementById("challengeDifficulty");
  const modeLabel = document.getElementById("challengeModeLabel");
  const pageTitle = document.getElementById("challengePageTitle");
  const selectAllCategories = document.getElementById("selectAllCategories");
  const categoryInputs = [...document.querySelectorAll('input[name="challengeCategory"]')];
  const proofPhoto = document.getElementById("proofPhoto");
  const proofPhotoName = document.getElementById("proofPhotoName");

  function selectedCategories() {
    return [...document.querySelectorAll('input[name="challengeCategory"]:checked')]
      .map((input) => input.value);
  }

  function startTimer(attempt) {
    if (timerId) clearInterval(timerId);
    updateAttemptTimer(attempt);
    timerId = setInterval(() => updateAttemptTimer(attempt), 1000);
  }

  function setMode(nextMode) {
    mode = nextMode;
    document.querySelectorAll(".mode-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
    modeLabel.textContent = mode === "rapid" ? "Rapid Mode" : "Static Mode";
    pageTitle.textContent = mode === "rapid" ? "Dynamic Timed Challenge" : "Random Stored Challenge";
    currentChallenge = null;
    currentAttempt = null;
    localStorage.removeItem("challengePageCurrent");
    renderChallenge(null);
    setMessage("challengeMessage", "");
    if (timerId) clearInterval(timerId);
  }

  document.querySelectorAll(".mode-btn").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  function syncSelectAllState() {
    if (!selectAllCategories) return;
    const checkedCount = categoryInputs.filter((input) => input.checked).length;
    selectAllCategories.checked = checkedCount === categoryInputs.length;
    selectAllCategories.indeterminate = checkedCount > 0 && checkedCount < categoryInputs.length;
  }

  selectAllCategories?.addEventListener("change", () => {
    categoryInputs.forEach((input) => {
      input.checked = selectAllCategories.checked;
    });
    syncSelectAllState();
  });

  categoryInputs.forEach((input) => {
    input.addEventListener("change", syncSelectAllState);
  });

  proofPhoto?.addEventListener("change", () => {
    const file = proofPhoto.files?.[0];
    proofPhotoName.textContent = file ? file.name : "JPG, PNG, or WEBP. Camera opens on supported phones.";
  });

  getBtn.addEventListener("click", async () => {
    const chosenCategories = selectedCategories();
    const difficulty = difficultySelect.value;
    const body = { categories: chosenCategories };
    if (difficulty) body.difficulty = difficulty;

    if (!chosenCategories.length) {
      setMessage("challengeMessage", "Select at least one category.", "error");
      return;
    }

    try {
      setMessage("challengeMessage", "Finding challenge...");
      const data = await apiRequest(mode === "rapid" ? "/api/challenge/rapid" : "/api/challenge/get", {
        method: "POST",
        body: JSON.stringify(body)
      });
      const unpacked = unpackChallengeResponse(data);
      currentChallenge = unpacked.challenge;
      currentAttempt = unpacked.attempt;

      localStorage.setItem("challengePageCurrent", JSON.stringify({ challenge: currentChallenge, attempt: currentAttempt }));
      renderChallenge(currentChallenge);
      startTimer(currentAttempt);
      setMessage("challengeMessage", mode === "rapid" ? "Rapid challenge created." : "Stored challenge loaded.", "success-text");
    } catch (error) {
      renderChallenge(null);
      setMessage("challengeMessage", error.message, "error");
    }
  });

  document.getElementById("completeChallengeBtn").addEventListener("click", async () => {
    if (!currentChallenge?._id || !currentAttempt?._id) return;

    try {
      setMessage("challengeMessage", "Submitting completion...");
      const proofImageDataUrl = await imageFileToDataUrl(proofPhoto?.files?.[0]);
      const data = await apiRequest("/api/challenge/complete", {
        method: "POST",
        body: JSON.stringify({
          attemptId: currentAttempt._id,
          proofNote: document.getElementById("proofNote")?.value.trim() || "",
          proofImageDataUrl
        })
      });
      storage.updateUser(data.user);
      updateUserUI();
      currentChallenge = null;
      currentAttempt = null;
      localStorage.removeItem("challengePageCurrent");
      document.getElementById("proofNote").value = "";
      if (proofPhoto) proofPhoto.value = "";
      if (proofPhotoName) proofPhotoName.textContent = "JPG, PNG, or WEBP. Camera opens on supported phones.";
      renderChallenge(null);
      if (timerId) clearInterval(timerId);
      setMessage("challengeMessage", data.message || "Proof submitted.", "success-text");
    } catch (error) {
      setMessage("challengeMessage", error.message, "error");
    }
  });

  try {
    const saved = JSON.parse(localStorage.getItem("challengePageCurrent") || "null");
    if (saved?.challenge) {
      currentChallenge = saved.challenge;
      currentAttempt = saved.attempt || null;
    } else {
      currentChallenge = saved;
    }
  } catch {
    currentChallenge = null;
  }

  renderChallenge(currentChallenge);
  if (currentAttempt) startTimer(currentAttempt);
  syncSelectAllState();
  updateUserUI();
}

async function loadLeaderboard() {
  const list = document.getElementById("leaderboardList");
  if (!list) return;

  try {
    setMessage("leaderboardMessage", "Loading leaderboard...");
    const users = await apiRequest("/api/leaderboard", { method: "GET" });
    list.innerHTML = "";

    if (!users.length) {
      setMessage("leaderboardMessage", "No players found yet.");
      return;
    }

    users.forEach((user, index) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row";
      row.innerHTML = `
        <strong>#${index + 1}</strong>
        <span>${user.username || "Player"}</span>
        <strong>${user.xp ?? 0}</strong>
      `;
      list.appendChild(row);
    });

    setMessage("leaderboardMessage", "");
  } catch (error) {
    setMessage("leaderboardMessage", error.message, "error");
  }
}

function initLeaderboard() {
  if (!document.getElementById("leaderboardList")) return;
  document.getElementById("refreshLeaderboardBtn")?.addEventListener("click", loadLeaderboard);
  loadLeaderboard();
}

function initFriends() {
  const sendForm = document.getElementById("sendFriendForm");
  const requestList = document.getElementById("requestList");
  if (!sendForm || !requestList) return;

  updateUserUI();

  async function loadFriends() {
    try {
      setMessage("friendsMessage", "Loading friend requests...");
      const data = await apiRequest(`/api/friend/${storage.userId}`, { method: "GET" });
      requestList.innerHTML = "";

      if (!data.friendRequests.length) {
        requestList.innerHTML = `<div class="simple-row"><span>No pending requests</span></div>`;
      } else {
        data.friendRequests.forEach((request) => {
          const row = document.createElement("div");
          row.className = "simple-row";
          row.innerHTML = `
            <div>
              <strong>${request.username}</strong>
              <small>Level ${request.level ?? 1} • ${request.xp ?? 0} XP</small>
            </div>
            <button class="btn success compact-btn" data-request-id="${request._id}">Accept</button>
          `;
          requestList.appendChild(row);
        });
      }

      setMessage("friendsMessage", data.friends.length ? `${data.friends.length} friends connected.` : "");
    } catch (error) {
      setMessage("friendsMessage", error.message, "error");
    }
  }

  sendForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("sendFriendUsername").value.trim();

    try {
      setMessage("friendsMessage", "Sending request...");
      const data = await apiRequest("/api/friend/send", {
        method: "POST",
        body: JSON.stringify({ userId: storage.userId, username })
      });
      sendForm.reset();
      setMessage("friendsMessage", data.message || "Request sent.", "success-text");
    } catch (error) {
      setMessage("friendsMessage", error.message, "error");
    }
  });

  requestList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-request-id]");
    if (!button) return;

    try {
      setMessage("friendsMessage", "Accepting request...");
      const data = await apiRequest("/api/friend/accept", {
        method: "POST",
        body: JSON.stringify({ userId: storage.userId, requestId: button.dataset.requestId })
      });
      setMessage("friendsMessage", data.message || "Friend added.", "success-text");
      await loadFriends();
    } catch (error) {
      setMessage("friendsMessage", error.message, "error");
    }
  });

  document.getElementById("refreshFriendsBtn")?.addEventListener("click", loadFriends);
  loadFriends();
}

async function adminRequest(path, options = {}) {
  return apiRequest(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "x-admin-secret": getAdminSecret()
    }
  });
}

function initAdminPage() {
  const secretForm = document.getElementById("adminSecretForm");
  const statsBox = document.getElementById("adminStats");
  const usersBox = document.getElementById("adminUsers");
  const attemptsBox = document.getElementById("adminAttempts");
  const challengesBox = document.getElementById("adminChallenges");
  const challengeForm = document.getElementById("adminChallengeForm");
  const geminiForm = document.getElementById("geminiChallengeForm");

  if (!secretForm || !statsBox || !usersBox || !attemptsBox || !challengesBox || !challengeForm || !geminiForm) return;

  const secretInput = document.getElementById("adminSecret");
  secretInput.value = getAdminSecret();
  const adminState = {
    usersSearch: "",
    challengesSearch: "",
    attemptsSearch: "",
    attemptsStatus: ""
  };

  const debounce = (fn, wait = 350) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), wait);
    };
  };

  const queryString = (params) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const text = search.toString();
    return text ? `?${text}` : "";
  };

  function bindAdminTabs() {
    document.querySelectorAll(".admin-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach((item) => item.classList.toggle("active", item === tab));
        document.querySelectorAll(".admin-module").forEach((panel) => {
          panel.classList.toggle("active", panel.dataset.adminPanel === tab.dataset.adminTab);
        });
      });
    });
  }

  async function loadAdmin() {
    if (!getAdminSecret()) {
      setMessage("adminMessage", "Enter admin secret to unlock the panel.", "error");
      return;
    }

    try {
      setMessage("adminMessage", "Loading admin data...");
      const [stats, users, attempts, challenges] = await Promise.all([
        adminRequest("/api/admin/stats", { method: "GET" }),
        adminRequest(`/api/admin/users${queryString({ search: adminState.usersSearch })}`, { method: "GET" }),
        adminRequest(`/api/admin/attempts${queryString({ search: adminState.attemptsSearch, status: adminState.attemptsStatus })}`, { method: "GET" }),
        adminRequest(`/api/admin/challenges${queryString({ search: adminState.challengesSearch })}`, { method: "GET" })
      ]);

      statsBox.innerHTML = `
        <div class="stat-chip"><strong>${stats.users}</strong><span>Users</span></div>
        <div class="stat-chip"><strong>${stats.challenges}</strong><span>Challenges</span></div>
        <div class="stat-chip"><strong>${stats.completedAttempts}</strong><span>Completed</span></div>
        <div class="stat-chip"><strong>${stats.totalXP}</strong><span>Total XP</span></div>
      `;

      usersBox.innerHTML = users.map((user) => `
        <div class="simple-row">
          <div>
            <strong>${escapeHTML(user.username)}</strong>
            <small>${user.xp ?? 0} XP • Level ${user.level ?? 1} • ${escapeHTML(user.role || "user")}</small>
          </div>
          <div class="inline-actions">
            <button class="btn secondary compact-btn" data-user-edit="${user._id}" data-current-xp="${user.xp ?? 0}">+50 XP</button>
            <button class="btn danger compact-btn" data-user-delete="${user._id}">Delete</button>
          </div>
        </div>
      `).join("") || `<div class="simple-row"><span>No users found</span></div>`;

      attemptsBox.innerHTML = attempts.map((attempt) => `
        <div class="simple-row">
          <div>
            <strong>${escapeHTML(attempt.challenge?.title || "Unknown challenge")}</strong>
            <small>${escapeHTML(attempt.user?.username || "Unknown user")} • ${escapeHTML(attempt.status)} • ${attempt.xp ?? 0} XP</small>
            <small>${escapeHTML(attempt.proofFeedback || "No proof feedback yet")}</small>
            ${attempt.proofImageDataUrl ? `<img class="proof-thumb" src="${attempt.proofImageDataUrl}" alt="Proof photo">` : ""}
          </div>
          <div class="inline-actions">
            ${attempt.status === "pending_review" ? `
              <button class="btn success compact-btn" data-attempt-approve="${attempt._id}">Approve</button>
              <button class="btn danger compact-btn" data-attempt-reject="${attempt._id}">Reject</button>
            ` : ""}
          </div>
        </div>
      `).join("") || `<div class="simple-row"><span>No attempts yet</span></div>`;

      challengesBox.innerHTML = challenges.slice(0, 120).map((challenge) => `
        <div class="simple-row">
          <div>
            <strong>${escapeHTML(challenge.title)}</strong>
            <small>${escapeHTML(challenge.category)} • ${escapeHTML(challenge.difficulty)} • ${challenge.xp ?? 0} XP • ${escapeHTML(challenge.source || "custom")}</small>
          </div>
          <button class="btn danger compact-btn" data-challenge-delete="${challenge._id}">Delete</button>
        </div>
      `).join("") || `<div class="simple-row"><span>No challenges found</span></div>`;

      setMessage("adminMessage", "Admin data loaded.", "success-text");
    } catch (error) {
      setMessage("adminMessage", error.message, "error");
    }
  }

  secretForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    localStorage.setItem("adminSecret", secretInput.value.trim());
    await loadAdmin();
  });

  const debouncedLoadAdmin = debounce(loadAdmin);
  document.getElementById("adminUserSearch")?.addEventListener("input", (event) => {
    adminState.usersSearch = event.target.value.trim();
    debouncedLoadAdmin();
  });
  document.getElementById("adminChallengeSearch")?.addEventListener("input", (event) => {
    adminState.challengesSearch = event.target.value.trim();
    debouncedLoadAdmin();
  });
  document.getElementById("adminAttemptSearch")?.addEventListener("input", (event) => {
    adminState.attemptsSearch = event.target.value.trim();
    debouncedLoadAdmin();
  });
  document.getElementById("adminAttemptStatus")?.addEventListener("change", (event) => {
    adminState.attemptsStatus = event.target.value;
    loadAdmin();
  });

  challengeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const xp = Number(document.getElementById("adminChallengeXp").value);
      await adminRequest("/api/admin/challenges", {
        method: "POST",
        body: JSON.stringify({
          title: document.getElementById("adminChallengeTitle").value.trim(),
          description: document.getElementById("adminChallengeDescription").value.trim(),
          category: document.getElementById("adminChallengeCategory").value,
          difficulty: document.getElementById("adminChallengeDifficulty").value,
          xp,
          estimatedMinutes: xp >= 90 ? 45 : xp >= 50 ? 25 : 10
        })
      });
      challengeForm.reset();
      document.getElementById("adminChallengeXp").value = 25;
      setMessage("adminMessage", "Challenge added.", "success-text");
      await loadAdmin();
    } catch (error) {
      setMessage("adminMessage", error.message, "error");
    }
  });

  usersBox.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest("[data-user-delete]");
    const editBtn = event.target.closest("[data-user-edit]");

    try {
      if (deleteBtn) {
        if (!confirm("Delete this user and their attempts?")) return;
        await adminRequest(`/api/admin/users/${deleteBtn.dataset.userDelete}`, { method: "DELETE" });
        setMessage("adminMessage", "User deleted.", "success-text");
        await loadAdmin();
      }

      if (editBtn) {
        const userId = editBtn.dataset.userEdit;
        const userRow = [...usersBox.querySelectorAll("[data-user-edit]")]
          .find((button) => button.dataset.userEdit === userId);
        await adminRequest(`/api/admin/users/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({ xp: Number(userRow?.dataset.currentXp || 0) + 50 })
        });
        setMessage("adminMessage", "User updated.", "success-text");
        await loadAdmin();
      }
    } catch (error) {
      setMessage("adminMessage", error.message, "error");
    }
  });

  challengesBox.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest("[data-challenge-delete]");
    if (!deleteBtn) return;

    try {
      if (!confirm("Delete this challenge?")) return;
      await adminRequest(`/api/admin/challenges/${deleteBtn.dataset.challengeDelete}`, { method: "DELETE" });
      setMessage("adminMessage", "Challenge deleted.", "success-text");
      await loadAdmin();
    } catch (error) {
      setMessage("adminMessage", error.message, "error");
    }
  });

  attemptsBox.addEventListener("click", async (event) => {
    const approveBtn = event.target.closest("[data-attempt-approve]");
    const rejectBtn = event.target.closest("[data-attempt-reject]");

    try {
      if (approveBtn) {
        await adminRequest(`/api/admin/attempts/${approveBtn.dataset.attemptApprove}/approve`, {
          method: "POST",
          body: JSON.stringify({ feedback: "Approved from admin panel." })
        });
        setMessage("adminMessage", "Attempt approved and XP awarded.", "success-text");
        await loadAdmin();
      }

      if (rejectBtn) {
        await adminRequest(`/api/admin/attempts/${rejectBtn.dataset.attemptReject}/reject`, {
          method: "POST",
          body: JSON.stringify({ feedback: "Rejected from admin panel." })
        });
        setMessage("adminMessage", "Attempt rejected.", "success-text");
        await loadAdmin();
      }
    } catch (error) {
      setMessage("adminMessage", error.message, "error");
    }
  });

  geminiForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ideasBox = document.getElementById("geminiIdeas");

    try {
      setMessage("adminMessage", "Asking Gemini for challenge ideas...");
      const data = await adminRequest("/api/admin/challenges/generate", {
        method: "POST",
        body: JSON.stringify({
          category: document.getElementById("geminiCategory").value,
          difficulty: document.getElementById("geminiDifficulty").value,
          count: 5
        })
      });

      ideasBox.innerHTML = data.ideas.map((idea) => `
        <div class="simple-row">
          <div>
            <strong>${escapeHTML(idea.title)}</strong>
            <small>${escapeHTML(idea.description || "")}</small>
            <small>${idea.estimatedMinutes || 10} min</small>
          </div>
          <button class="btn success compact-btn"
            data-gemini-add="${escapeHTML(idea.title)}"
            data-gemini-description="${escapeHTML(idea.description || "")}">
            Use
          </button>
        </div>
      `).join("") || `<div class="simple-row"><span>No ideas returned</span></div>`;
      setMessage("adminMessage", "Gemini ideas loaded.", "success-text");
    } catch (error) {
      setMessage("adminMessage", error.message, "error");
    }
  });

  document.getElementById("geminiIdeas")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-gemini-add]");
    if (!button) return;
    document.getElementById("adminChallengeTitle").value = button.dataset.geminiAdd;
    document.getElementById("adminChallengeDescription").value = button.dataset.geminiDescription;
    document.getElementById("adminChallengeCategory").value = document.getElementById("geminiCategory").value;
    document.getElementById("adminChallengeDifficulty").value = document.getElementById("geminiDifficulty").value;
    document.querySelector('[data-admin-tab="challenges"]')?.click();
  });

  document.getElementById("refreshAdminBtn")?.addEventListener("click", loadAdmin);
  bindAdminTabs();
  if (getAdminSecret()) loadAdmin();
}

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  setupMobileNav();
  bindLogout();
  initAuthPage();
  initDashboard();
  initChallengePage();
  initLeaderboard();
  initFriends();
  initAdminPage();
});
