const CONFIG = {
  accessPasswords: ["김정우", "rlawjddn"],
  apiBaseUrl: "https://script.google.com/macros/s/AKfycbwcIq_onPWz4I_GkSn6w0eT-NQ3pmjbXTrs99aHIqSe5LMiZnKpHemFudAoQs07rw-Duw/exec",
  submissionMode: "apps-script",
  googleForm: {
    actionUrl: "https://docs.google.com/forms/u/0/d/e/1FAIpQLSdxGZCEt5A35PAGdNPEqKz5npKTHN_UV5IMXmJBkROKLgsODA/formResponse",
    fields: {
      leaderName: "entry.1810509581",
      qtCount: "entry.1996785720",
      bibleCount: "entry.622711361",
    },
  },
  fallbackMembers: [
    { name: "김다윗" },
    { name: "박은혜" },
    { name: "이요한" },
    { name: "최사무엘" },
  ],
};

const state = {
  weekLabel: "",
  rows: [],
  members: [],
  isAuthenticated: false,
};

const elements = {
  authScreen: document.querySelector("#authScreen"),
  authForm: document.querySelector("#authForm"),
  passwordInput: document.querySelector("#passwordInput"),
  authMessage: document.querySelector("#authMessage"),
  loadingBar: document.querySelector("#loadingBar"),
  currentWeekLabel: document.querySelector("#currentWeekLabel"),
  lastUpdatedLabel: document.querySelector("#lastUpdatedLabel"),
  submittedCount: document.querySelector("#submittedCount"),
  pendingCount: document.querySelector("#pendingCount"),
  formPanel: document.querySelector(".form-panel"),
  ruleModal: document.querySelector("#ruleModal"),
  ruleOpenButton: document.querySelector("#ruleOpenButton"),
  ruleCloseButton: document.querySelector("#ruleCloseButton"),
  accountToggleButton: document.querySelector("#accountToggleButton"),
  accountInfo: document.querySelector("#accountInfo"),
  formWeekPill: document.querySelector("#formWeekPill"),
  leaderTableBody: document.querySelector("#leaderTableBody"),
  devotionForm: document.querySelector("#devotionForm"),
  formMessage: document.querySelector("#formMessage"),
  searchInput: document.querySelector("#searchInput"),
  refreshButton: document.querySelector("#refreshButton"),
  leaderName: document.querySelector("#leaderName"),
  qtCount: document.querySelector("#qtCount"),
  bibleCount: document.querySelector("#bibleCount"),
};

function unlockPage() {
  state.isAuthenticated = true;
  document.body.classList.remove("auth-locked");
  elements.authScreen.hidden = true;
  fetchDashboard();
}

function submitPassword(event) {
  event.preventDefault();

  const password = elements.passwordInput.value.trim();

  if (!CONFIG.accessPasswords.includes(password)) {
    elements.authMessage.textContent = "비밀번호가 맞지 않습니다.";
    elements.passwordInput.select();
    return;
  }

  elements.authMessage.textContent = "";
  unlockPage();
}

function setLoading(isLoading) {
  elements.loadingBar.hidden = !isLoading;
}

function populateCountOptions() {
  for (let count = 0; count <= 6; count += 1) {
    const qtOption = document.createElement("option");
    qtOption.value = String(count);
    qtOption.textContent = `${count}회`;
    elements.qtCount.appendChild(qtOption);

    const bibleOption = document.createElement("option");
    bibleOption.value = String(count);
    bibleOption.textContent = `${count}회`;
    elements.bibleCount.appendChild(bibleOption);
  }
}

function setMessage(message, type = "") {
  elements.formMessage.textContent = message;
  elements.formMessage.className = `form-message ${type}`.trim();
}

function openRuleModal() {
  elements.ruleModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeRuleModal() {
  elements.ruleModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function toggleAccountInfo() {
  const isHidden = elements.accountInfo.hidden;
  elements.accountInfo.hidden = !isHidden;
  elements.accountToggleButton.setAttribute("aria-expanded", String(isHidden));
}

async function copyAccountInfo() {
  const text = elements.accountInfo.textContent?.trim() || "";

  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setMessage("벌금 계좌가 복사되었습니다.", "success");
  } catch (error) {
    console.error(error);
    setMessage("클립보드 복사에 실패했습니다. 길게 눌러 복사해 주세요.", "error");
  }
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeRows(payload = {}) {
  const members = payload.members?.length ? payload.members : CONFIG.fallbackMembers;
  const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
  const map = new Map(
    submissions.map((row) => [
      row.name?.trim(),
      {
        ...row,
        submitted: Boolean(row.submitted),
      },
    ]),
  );

  return members.map((member) => {
    const matched = map.get(member.name.trim());
    return {
      name: member.name,
      submitted: matched?.submitted ?? false,
      qtCount: matched?.qtCount ?? "-",
      bibleCount: matched?.bibleCount ?? "-",
      submittedAt: matched?.submittedAt ?? "",
    };
  });
}

function updateSummary(rows) {
  const submittedCount = rows.filter((row) => row.submitted).length;
  elements.submittedCount.textContent = String(submittedCount);
  elements.pendingCount.textContent = String(rows.length - submittedCount);
}

function fillLeaderName(name) {
  elements.leaderName.value = name;
  elements.formPanel.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  window.setTimeout(() => {
    elements.leaderName.focus();
    elements.leaderName.setSelectionRange(name.length, name.length);
  }, 250);
  setMessage(`${name} 이름이 자동 입력되었습니다.`);
}

function isKnownLeader(name) {
  return state.rows.some((row) => row.name === name);
}

function renderTable(rows) {
  if (!rows.length) {
    elements.leaderTableBody.innerHTML =
      '<tr><td colspan="4" class="empty-state">표시할 리더 목록이 없습니다.</td></tr>';
    updateSummary([]);
    return;
  }

  const keyword = elements.searchInput.value.trim().toLowerCase();
  const exactMatchName = rows.find((row) => row.name.toLowerCase() === keyword)?.name ?? "";
  const filteredRows = rows.filter((row) => {
    if (!keyword) {
      return true;
    }

    return row.name.toLowerCase().includes(keyword);
  });
  const sortedRows = [...filteredRows].sort((left, right) => {
    if (left.submitted !== right.submitted) {
      return left.submitted ? 1 : -1;
    }

    return left.name.localeCompare(right.name, "ko");
  });

  if (!sortedRows.length) {
    elements.leaderTableBody.innerHTML =
      '<tr><td colspan="4" class="empty-state">검색 결과가 없습니다.</td></tr>';
    updateSummary(rows);
    return;
  }

  elements.leaderTableBody.innerHTML = sortedRows
    .map(
      (row) => {
        const canRevealCounts = Boolean(exactMatchName) && row.name === exactMatchName;

        return `
        <tr>
          <td>
            ${
              row.submitted
                ? row.name
                : `<button class="name-pick-button" type="button" data-leader-name="${row.name}">${row.name}</button>`
            }
          </td>
          <td>
            <span class="status-badge ${row.submitted ? "done" : "pending"}">
              ${row.submitted ? "입력 완료" : "미입력"}
            </span>
          </td>
          <td>${canRevealCounts ? row.qtCount : "-"}</td>
          <td>${canRevealCounts ? row.bibleCount : "-"}</td>
        </tr>
      `;
      },
    )
    .join("");

  updateSummary(rows);
}

async function fetchDashboard() {
  if (!state.isAuthenticated) {
    return;
  }

  const fallbackWeek = "스프레드시트에서 주차 설정 필요";

  if (!CONFIG.apiBaseUrl || CONFIG.apiBaseUrl.includes("YOUR_APPS_SCRIPT")) {
    state.weekLabel = fallbackWeek;
    state.rows = normalizeRows({});
    renderMeta();
    renderTable(state.rows);
    setMessage("Apps Script URL을 연결하면 실제 스프레드시트 데이터가 표시됩니다.");
    return;
  }

  try {
    setLoading(true);
    elements.refreshButton.disabled = true;
    const response = await fetch(`${CONFIG.apiBaseUrl}?action=dashboard`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("대시보드 응답을 불러오지 못했습니다.");
    }

    const payload = await response.json();
    state.weekLabel = payload.weekLabel || fallbackWeek;
    state.rows = normalizeRows(payload);
    renderMeta(payload.lastUpdated);
    renderTable(state.rows);
  } catch (error) {
    console.error(error);
    state.weekLabel = fallbackWeek;
    state.rows = normalizeRows({});
    renderMeta();
    renderTable(state.rows);
    setMessage("실시간 데이터를 가져오지 못해 예시 데이터로 표시 중입니다.", "error");
  } finally {
    elements.refreshButton.disabled = false;
    setLoading(false);
  }
}

function renderMeta(lastUpdated = "") {
  const week = state.weekLabel || "주차 미설정";
  elements.currentWeekLabel.textContent = week;
  elements.formWeekPill.textContent = week;
  elements.lastUpdatedLabel.textContent = lastUpdated ? formatDateTime(lastUpdated) : "방금 전";
}

function isGoogleFormConfigured() {
  const placeholderFieldValues = new Set([
    "entry.1111111111",
    "entry.2222222222",
    "entry.3333333333",
  ]);

  return (
    CONFIG.googleForm.actionUrl &&
    !CONFIG.googleForm.actionUrl.includes("YOUR_FORM_ID") &&
    Object.values(CONFIG.googleForm.fields).every(
      (value) => value.startsWith("entry.") && !placeholderFieldValues.has(value),
    )
  );
}

async function submitToGoogleForm(payload) {
  if (!isGoogleFormConfigured()) {
    throw new Error("Google Form 설정이 완료되지 않았습니다.");
  }

  const body = new URLSearchParams();
  body.set(CONFIG.googleForm.fields.leaderName, payload.leaderName);
  body.set(CONFIG.googleForm.fields.qtCount, String(payload.qtCount));
  body.set(CONFIG.googleForm.fields.bibleCount, String(payload.bibleCount));

  await fetch(CONFIG.googleForm.actionUrl, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: body.toString(),
  });
}

async function submitToAppsScript(payload) {
  if (!CONFIG.apiBaseUrl || CONFIG.apiBaseUrl.includes("YOUR_APPS_SCRIPT")) {
    throw new Error("Apps Script URL이 설정되지 않았습니다.");
  }

  const response = await fetch(CONFIG.apiBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "submit",
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error("제출 요청이 실패했습니다.");
  }

  return response.json();
}

async function submitForm(event) {
  event.preventDefault();

  const formData = new FormData(elements.devotionForm);
  const payload = {
    leaderName: formData.get("leaderName")?.toString().trim(),
    qtCount: Number(formData.get("qtCount")),
    bibleCount: Number(formData.get("bibleCount")),
    weekLabel: state.weekLabel || "",
  };

  if (!payload.leaderName) {
    setMessage("이름을 입력해 주세요.", "error");
    return;
  }

  if (!isKnownLeader(payload.leaderName)) {
    setMessage("명단에 없는 이름은 제출할 수 없습니다. 이름을 다시 확인해 주세요.", "error");
    return;
  }

  if (!payload.weekLabel || payload.weekLabel === "스프레드시트에서 주차 설정 필요") {
    setMessage("스프레드시트에 이번 주차를 먼저 설정해 주세요.", "error");
    return;
  }

  try {
    setMessage("제출 중입니다...");
    let successMessage = "제출이 완료되었습니다.";

    if (CONFIG.submissionMode === "google-form") {
      await submitToGoogleForm(payload);
      successMessage = "구글 설문지로 제출되었습니다.";
    } else {
      const result = await submitToAppsScript(payload);
      successMessage = result.message || successMessage;
    }

    setMessage(successMessage, "success");
    elements.devotionForm.reset();
    elements.searchInput.value = payload.leaderName;
    await fetchDashboard();
  } catch (error) {
    console.error(error);
    setMessage("제출 중 문제가 생겼습니다. Form/App Script 설정과 권한을 확인해 주세요.", "error");
  }
}

function bindEvents() {
  elements.authForm.addEventListener("submit", submitPassword);
  elements.devotionForm.addEventListener("submit", submitForm);
  elements.searchInput.addEventListener("input", () => renderTable(state.rows));
  elements.refreshButton.addEventListener("click", fetchDashboard);
  elements.ruleOpenButton.addEventListener("click", openRuleModal);
  elements.ruleCloseButton.addEventListener("click", closeRuleModal);
  elements.accountToggleButton.addEventListener("click", toggleAccountInfo);
  elements.accountInfo.addEventListener("click", copyAccountInfo);
  elements.ruleModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeRule === "true") {
      closeRuleModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.ruleModal.hidden) {
      closeRuleModal();
    }
  });
  elements.leaderTableBody.addEventListener("click", (event) => {
    const button = event.target.closest(".name-pick-button");

    if (!button) {
      return;
    }

    fillLeaderName(button.dataset.leaderName || "");
  });
}

function init() {
  populateCountOptions();
  renderMeta();
  bindEvents();
  elements.passwordInput.focus();
}

init();
