const STORAGE_KEY = "cc-shop-finanzsystem-local-v1";
const app = document.getElementById("app");

const defaultState = {
  user: null,
  users: [
    {
      id: crypto.randomUUID(),
      email: "admin@ccshop.local",
      password: "123456",
      role: "admin",
      createdAt: new Date().toISOString(),
    },
  ],
  transactions: [
    {
      id: crypto.randomUUID(),
      type: "directDeposit",
      title: "Direkteinzahlung",
      amount: 81799,
      category: "Einzahlung",
      note: "Demo-Daten",
      createdAt: new Date().toISOString(),
      releaseAt: null,
      createdBy: "admin@ccshop.local",
    },
    {
      id: crypto.randomUUID(),
      type: "debt",
      title: "Offene Schuld",
      amount: -12000000,
      category: "Schulden",
      note: "Demo-Daten",
      createdAt: new Date().toISOString(),
      releaseAt: null,
      createdBy: "admin@ccshop.local",
    },
    {
      id: crypto.randomUUID(),
      type: "cost",
      title: "Ausgaben für Aufträge",
      amount: -5015,
      category: "Kosten",
      note: "Einzelne Rechnungen",
      createdAt: new Date().toISOString(),
      releaseAt: null,
      createdBy: "admin@ccshop.local",
    },
  ],
  ui: {
    authMode: "login",
    filter: "all",
    selectedType: "incomeHeld",
    editId: null,
  },
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : structuredClone(defaultState.users),
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : structuredClone(defaultState.transactions),
      ui: { ...structuredClone(defaultState.ui), ...(parsed.ui || {}) },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMoney(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getReleasedTransactions() {
  const now = new Date();
  return state.transactions.map((tx) => {
    if (tx.type === "incomeHeld" && tx.releaseAt && new Date(tx.releaseAt) <= now) {
      return {
        ...tx,
        type: "directDeposit",
        category: "Freigegeben",
        releaseAt: null,
      };
    }
    return tx;
  });
}

function syncReleasedTransactions() {
  const next = getReleasedTransactions();
  const changed = JSON.stringify(next) !== JSON.stringify(state.transactions);
  if (changed) {
    state.transactions = next;
    saveState();
  }
}

function getStats() {
  syncReleasedTransactions();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const held = state.transactions
    .filter((t) => t.type === "incomeHeld" && t.releaseAt && new Date(t.releaseAt) > now)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const available = state.transactions.reduce((sum, t) => {
    if (t.type === "incomeHeld" && t.releaseAt && new Date(t.releaseAt) > now) return sum;
    if (t.type === "debt") return sum;
    return sum + Number(t.amount);
  }, 0);

  const allTimeIncome = state.transactions
    .filter((t) => Number(t.amount) > 0 && t.type !== "debtPayment")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const debts = Math.abs(
    state.transactions
      .filter((t) => t.type === "debt" || t.type === "debtPayment")
      .reduce((sum, t) => sum + Number(t.amount), 0)
  );

  const totalCosts = Math.abs(
    state.transactions
      .filter((t) => t.type === "cost")
      .reduce((sum, t) => sum + Number(t.amount), 0)
  );

  const monthlyIncome = state.transactions
    .filter((t) => Number(t.amount) > 0 && new Date(t.createdAt) >= monthStart)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const yearlyIncome = state.transactions
    .filter((t) => Number(t.amount) > 0 && new Date(t.createdAt) >= yearStart)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return { held, available, allTimeIncome, debts, totalCosts, monthlyIncome, yearlyIncome };
}

function getFilterLabel(type) {
  const map = {
    incomeHeld: "Zurückgehalten",
    directDeposit: "Einzahlung",
    expense: "Auszahlung",
    debt: "Schulden",
    debtPayment: "Schuldenzahlung",
    cost: "Kosten",
  };
  return map[type] || type;
}

function getFilteredTransactions() {
  const list = [...state.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (state.ui.filter === "all") return list;
  return list.filter((tx) => tx.type === state.ui.filter);
}

function login(email, password) {
  const user = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) return { success: false, message: "Login fehlgeschlagen." };
  state.user = { id: user.id, email: user.email, role: user.role };
  saveState();
  return { success: true };
}

function register(email, password) {
  if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, message: "Benutzer existiert bereits." };
  }
  state.users.push({
    id: crypto.randomUUID(),
    email,
    password,
    role: "user",
    createdAt: new Date().toISOString(),
  });
  saveState();
  return { success: true, message: "Registrierung erfolgreich. Jetzt einloggen." };
}

function logout() {
  state.user = null;
  saveState();
  render();
}

function addTransaction(payload) {
  const amountInput = Number(payload.amount);
  if (!payload.title || !amountInput) {
    return { success: false, message: "Bitte Titel und Betrag eingeben." };
  }

  let amount = amountInput;
  if (["expense", "cost", "debt", "debtPayment"].includes(payload.type)) {
    amount = -Math.abs(amountInput);
  } else {
    amount = Math.abs(amountInput);
  }

  const releaseAt = payload.type === "incomeHeld"
    ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  state.transactions.unshift({
    id: crypto.randomUUID(),
    type: payload.type,
    title: payload.title,
    amount,
    category: payload.category || getFilterLabel(payload.type),
    note: payload.note || "",
    createdAt: new Date().toISOString(),
    releaseAt,
    createdBy: state.user?.email || "local",
  });
  saveState();
  return { success: true, message: "Transaktion gespeichert." };
}

function updateTransaction(id, payload) {
  const tx = state.transactions.find((item) => item.id === id);
  if (!tx) return { success: false, message: "Transaktion nicht gefunden." };
  const amountInput = Number(payload.amount);
  if (!payload.title || !amountInput) {
    return { success: false, message: "Bitte Titel und Betrag eingeben." };
  }
  tx.title = payload.title;
  tx.category = payload.category || tx.category;
  tx.note = payload.note || "";
  tx.amount = tx.amount < 0 ? -Math.abs(amountInput) : Math.abs(amountInput);
  saveState();
  return { success: true, message: "Transaktion aktualisiert." };
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter((tx) => tx.id !== id);
  saveState();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cc-shop-finanzsystem-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = {
        ...structuredClone(defaultState),
        ...parsed,
        ui: { ...structuredClone(defaultState.ui), ...(parsed.ui || {}) },
      };
      saveState();
      render();
      alert("Import erfolgreich.");
    } catch {
      alert("Import fehlgeschlagen. Datei ist ungültig.");
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm("Wirklich alle lokal gespeicherten Daten löschen?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultState);
  render();
}

function renderLogin(message = "") {
  const mode = state.ui.authMode;
  app.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="brand-wrap" style="margin-bottom:16px;">
          <div class="brand-icon">₵</div>
          <div>
            <h1 class="title" style="font-size:26px;">CC-Shop Finanzsystem</h1>
            <div class="subtitle">Lokale HTML/CSS/JS Version</div>
          </div>
        </div>
        <p class="muted">${mode === "login" ? "Einloggen" : "Registrieren"}</p>
        <form id="authForm" class="form-grid">
          <input class="input" id="email" type="email" placeholder="E-Mail" required>
          <input class="input" id="password" type="password" placeholder="Passwort" required>
          <button class="btn btn-indigo" type="submit">${mode === "login" ? "Login" : "Registrieren"}</button>
        </form>
        ${message ? `<div class="info-message">${escapeHtml(message)}</div>` : ""}
        <button id="toggleAuthMode" class="btn btn-dark login-switch">
          ${mode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Login"}
        </button>
        <div class="info-message" style="margin-top:16px;">
          Demo-Login: <strong>admin@ccshop.local</strong> / <strong>123456</strong>
        </div>
      </div>
    </div>
  `;

  document.getElementById("toggleAuthMode").addEventListener("click", () => {
    state.ui.authMode = mode === "login" ? "register" : "login";
    saveState();
    renderLogin();
  });

  document.getElementById("authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    const result = mode === "login" ? login(email, password) : register(email, password);
    if (!result.success) {
      renderLogin(result.message);
      return;
    }

    if (mode === "register") {
      state.ui.authMode = "login";
      saveState();
      renderLogin(result.message);
      return;
    }

    render();
  });
}

function renderEditModal(tx) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="card modal">
      <div class="modal-head">
        <h3 style="margin:0;">Transaktion bearbeiten</h3>
        <button class="btn btn-dark btn-small" id="closeModal">Schließen</button>
      </div>
      <form id="editForm" class="form-grid">
        <input class="input" id="editTitle" value="${escapeHtml(tx.title)}" placeholder="Titel" required>
        <input class="input" id="editAmount" type="number" value="${Math.abs(Number(tx.amount))}" placeholder="Betrag" required>
        <input class="input" id="editCategory" value="${escapeHtml(tx.category || "")}" placeholder="Kategorie">
        <textarea class="textarea" id="editNote" placeholder="Notiz">${escapeHtml(tx.note || "")}</textarea>
        <div class="modal-actions">
          <button type="button" class="btn btn-dark" id="deleteBtn">Löschen</button>
          <button type="submit" class="btn btn-indigo">Speichern</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("closeModal").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  document.getElementById("deleteBtn").addEventListener("click", () => {
    if (!confirm("Transaktion wirklich löschen?")) return;
    deleteTransaction(tx.id);
    modal.remove();
    render();
  });

  document.getElementById("editForm").addEventListener("submit", (e) => {
    e.preventDefault();
    updateTransaction(tx.id, {
      title: document.getElementById("editTitle").value.trim(),
      amount: document.getElementById("editAmount").value,
      category: document.getElementById("editCategory").value.trim(),
      note: document.getElementById("editNote").value.trim(),
    });
    modal.remove();
    render();
  });
}

function renderDashboard(message = "") {
  const stats = getStats();
  const transactions = getFilteredTransactions();

  app.innerHTML = `
    <div class="page">
      <div class="card header-card">
        <div class="brand-wrap">
          <div class="brand-icon">₵</div>
          <div>
            <h1 class="title">CC-Shop Finanzsystem</h1>
            <div class="subtitle">Business ID: 13 • Eingeloggt als ${escapeHtml(state.user.email)}</div>
          </div>
        </div>
        <div class="top-actions">
          <div class="badge-live">System online • Lokal gespeichert</div>
          <button class="btn btn-dark btn-small" id="exportBtn">Export</button>
          <label class="btn btn-dark btn-small" for="importInput" style="display:inline-flex;align-items:center;">Import</label>
          <input id="importInput" type="file" accept="application/json" style="display:none;">
          <button class="btn btn-dark btn-small" id="resetBtn">Reset</button>
          <button class="btn btn-dark btn-small" id="logoutBtn">Logout</button>
        </div>
      </div>

      <div class="card warning-card">
        <strong>Wichtig:</strong> Einnahmen werden 2 Tage nach Kauf freigegeben. Schuldenzahlungen ändern nur Schulden, nicht das Guthaben.
      </div>

      <div class="stats-grid">
        <div class="card stat-card">
          <div class="stat-icon">⏱</div>
          <div class="stat-label">Zurückgehaltene Beträge</div>
          <h2 class="stat-value">${formatMoney(stats.held)}</h2>
          <div class="stat-sub">Werden in 2 Tagen freigegeben</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">💚</div>
          <div class="stat-label">Verfügbares Guthaben</div>
          <h2 class="stat-value">${formatMoney(stats.available)}</h2>
          <div class="stat-sub">Sofort verfügbar</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">📈</div>
          <div class="stat-label">All-time Einnahmen</div>
          <h2 class="stat-value">${formatMoney(stats.allTimeIncome)}</h2>
          <div class="stat-sub">Gesamteinnahmen seit Beginn</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">🧾</div>
          <div class="stat-label">Verbleibende Schulden</div>
          <h2 class="stat-value">${formatMoney(stats.debts)}</h2>
          <div class="stat-sub">Noch zurückzuzahlen</div>
        </div>
      </div>

      <div class="action-grid">
        <button class="btn btn-indigo quick-type" data-type="incomeHeld">Einnahme hinzufügen</button>
        <button class="btn btn-green quick-type" data-type="directDeposit">Direkt einzahlen</button>
        <button class="btn btn-pink quick-type" data-type="expense">Auszahlen</button>
        <button class="btn btn-purple quick-type" data-type="debtPayment">Schulden zahlen</button>
        <button class="btn btn-orange quick-type" data-type="cost">Kosten hinzufügen</button>
      </div>

      <div class="mini-grid">
        <div class="card stat-card">
          <div class="stat-icon">🛒</div>
          <div class="stat-label">Ausgaben für Aufträge</div>
          <h2 class="stat-value">${formatMoney(stats.totalCosts)}</h2>
          <div class="stat-sub">Einzelne Rechnungen</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">📅</div>
          <div class="stat-label">Monatliche Einnahmen</div>
          <h2 class="stat-value">${formatMoney(stats.monthlyIncome)}</h2>
          <div class="stat-sub">Vom 01. des Monats bis heute</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon">📘</div>
          <div class="stat-label">Jährliche Einnahmen</div>
          <h2 class="stat-value">${formatMoney(stats.yearlyIncome)}</h2>
          <div class="stat-sub">Vom 01.01. bis heute</div>
        </div>
      </div>

      <div class="layout-grid">
        <div class="card panel-card">
          <h3 style="margin-top:0;">Neue Buchung</h3>
          <form id="transactionForm" class="form-grid">
            <select class="select" id="type">
              <option value="incomeHeld" ${state.ui.selectedType === "incomeHeld" ? "selected" : ""}>Einnahme hinzufügen</option>
              <option value="directDeposit" ${state.ui.selectedType === "directDeposit" ? "selected" : ""}>Direkt einzahlen</option>
              <option value="expense" ${state.ui.selectedType === "expense" ? "selected" : ""}>Auszahlen</option>
              <option value="debt" ${state.ui.selectedType === "debt" ? "selected" : ""}>Schulden hinzufügen</option>
              <option value="debtPayment" ${state.ui.selectedType === "debtPayment" ? "selected" : ""}>Schulden zahlen</option>
              <option value="cost" ${state.ui.selectedType === "cost" ? "selected" : ""}>Kosten hinzufügen</option>
            </select>
            <input class="input" id="title" placeholder="Titel" required>
            <input class="input" id="amount" type="number" placeholder="Betrag" required>
            <input class="input" id="category" placeholder="Kategorie">
            <textarea class="textarea" id="note" placeholder="Notiz"></textarea>
            <button class="btn btn-indigo" type="submit">Speichern</button>
          </form>
          ${message ? `<div class="info-message">${escapeHtml(message)}</div>` : ""}
        </div>

        <div class="card panel-card">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
            <h3 style="margin:0;">Alle Transaktionen</h3>
            <div class="muted">${transactions.length} Einträge</div>
          </div>
          <div class="filters-row">
            ${[
              ["all", "Alle"],
              ["incomeHeld", "Zurückgehalten"],
              ["directDeposit", "Einzahlungen"],
              ["expense", "Auszahlungen"],
              ["debt", "Schulden"],
              ["cost", "Kosten"],
            ].map(([key, label]) => `
              <button class="filter-chip ${state.ui.filter === key ? "active" : ""}" data-filter="${key}">${label}</button>
            `).join("")}
          </div>
          <div class="tx-list">
            ${transactions.length ? transactions.map((tx) => `
              <div class="tx-item">
                <div class="tx-left">
                  <div class="tx-title">${escapeHtml(tx.title)}</div>
                  <div class="tx-meta">${formatDate(tx.createdAt)} • ${escapeHtml(tx.createdBy || "local")}</div>
                  ${tx.note ? `<div class="tx-note">${escapeHtml(tx.note)}</div>` : ""}
                  ${tx.releaseAt ? `<div class="tx-note">Freigabe: ${formatDate(tx.releaseAt)}</div>` : ""}
                </div>
                <div class="tx-right">
                  <span class="type-badge b-${tx.type}">${escapeHtml(getFilterLabel(tx.type))}</span>
                  <div class="${Number(tx.amount) >= 0 ? "amount-pos" : "amount-neg"}">${Number(tx.amount) >= 0 ? "+" : ""}${formatMoney(tx.amount)}</div>
                  <button class="btn btn-outline btn-small edit-btn" data-id="${tx.id}">Bearbeiten</button>
                </div>
              </div>
            `).join("") : `<div class="empty-state">Keine Transaktionen für diesen Filter vorhanden.</div>`}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("resetBtn").addEventListener("click", resetAllData);
  document.getElementById("importInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
  });

  document.querySelectorAll(".quick-type").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.ui.selectedType = btn.dataset.type;
      saveState();
      document.getElementById("type").value = btn.dataset.type;
      document.getElementById("title").focus();
    });
  });

  document.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.ui.filter = btn.dataset.filter;
      saveState();
      renderDashboard();
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tx = state.transactions.find((item) => item.id === btn.dataset.id);
      if (tx) renderEditModal(tx);
    });
  });

  document.getElementById("transactionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      type: document.getElementById("type").value,
      title: document.getElementById("title").value.trim(),
      amount: document.getElementById("amount").value,
      category: document.getElementById("category").value.trim(),
      note: document.getElementById("note").value.trim(),
    };
    state.ui.selectedType = payload.type;
    const result = addTransaction(payload);
    renderDashboard(result.message);
  });
}

function render() {
  if (!state.user) {
    renderLogin();
    return;
  }
  renderDashboard();
}

render();