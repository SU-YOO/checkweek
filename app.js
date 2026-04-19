const CONFIG = {
  accessPasswords: ["김정우", "rlawjddn", "jungwoo", "kimjungwoo", "jesus"],
  enableRulePopup: true,
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
  fineSummary: null,
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
  tabButtons: document.querySelectorAll("[data-view-target]"),
  viewPanels: document.querySelectorAll("[data-view]"),
  fineTotalLabel: document.querySelector("#fineTotalLabel"),
  totalFineAmount: document.querySelector("#totalFineAmount"),
  fineSearchInput: document.querySelector("#fineSearchInput"),
  fineAccessHint: document.querySelector("#fineAccessHint"),
  shareFineImageButton: document.querySelector("#shareFineImageButton"),
  fineWarning: document.querySelector("#fineWarning"),
  fineTableBody: document.querySelector("#fineTableBody"),
  leaderName: document.querySelector("#leaderName"),
  qtCount: document.querySelector("#qtCount"),
  bibleCount: document.querySelector("#bibleCount"),
};

const emptyFineSummary = {
  totalFine: 0,
  hasAttendanceColumn: true,
  hasFineColumn: true,
  isLateFeeApplied: true,
  missingAttendanceNames: [],
  rows: [],
};

const FINE_ADMIN_KEYWORD = "파수꾼";
let isSharingFineImage = false;

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

function setActiveView(viewName, updateHash = true) {
  const normalizedViewName = viewName === "fine" ? "fine" : "check";

  document.body.classList.toggle("fine-view", normalizedViewName === "fine");
  document.body.classList.toggle("check-view", normalizedViewName === "check");

  elements.viewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.view !== normalizedViewName;
  });

  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.viewTarget === normalizedViewName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (updateHash) {
    const hash = normalizedViewName === "fine" ? "#fine" : "#check";
    window.history.replaceState(null, "", hash);
  }
}

function getViewFromHash() {
  return window.location.hash === "#fine" ? "fine" : "check";
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

function formatPeriodDate(date) {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}(${weekdays[date.getDay()]})`;
}

function parseWeekEndDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  const parsedDate = new Date(text);

  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate;
  }

  const fullDateMatch = text.match(/(\d{2,4})\D+(\d{1,2})\D+(\d{1,2})/);

  if (fullDateMatch) {
    const year = Number(fullDateMatch[1].length === 2 ? `20${fullDateMatch[1]}` : fullDateMatch[1]);
    return new Date(year, Number(fullDateMatch[2]) - 1, Number(fullDateMatch[3]));
  }

  const koreanDateMatch = text.match(/(\d{1,2})\s*월\D*(\d{1,2})\s*일/);

  if (koreanDateMatch) {
    return new Date(new Date().getFullYear(), Number(koreanDateMatch[1]) - 1, Number(koreanDateMatch[2]));
  }

  return null;
}

function getCurrentSevenDayPeriod(referenceValue = new Date()) {
  const endDate = parseWeekEndDate(referenceValue) || new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  const startLabel = formatPeriodDate(startDate);
  const endLabel = formatPeriodDate(endDate);

  return {
    plain: `${startLabel} ~ ${endLabel}`,
    html: `${startLabel}<br />~ ${endLabel}`,
  };
}

function getCurrentSevenDayPeriodLabel(referenceValue = new Date()) {
  return getCurrentSevenDayPeriod(referenceValue).plain;
}

function formatWon(value) {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeFineSummary(summary = emptyFineSummary) {
  const safeSummary = summary || emptyFineSummary;

  return {
    ...emptyFineSummary,
    ...safeSummary,
    rows: Array.isArray(safeSummary.rows)
      ? safeSummary.rows.map((row) => ({
          ...row,
          submitted: row.submitted !== false,
        }))
      : [],
    missingAttendanceNames: Array.isArray(safeSummary.missingAttendanceNames)
      ? safeSummary.missingAttendanceNames
      : [],
  };
}

function getFineAttendanceText(row) {
  const attendanceText = String(row.attendanceTime ?? "").trim();

  if (row.isLateFeeApplied || (attendanceText && attendanceText !== "-")) {
    return attendanceText;
  }

  return "지각비 미적용";
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

function moveToSubmitForName(name) {
  setActiveView("check");
  window.setTimeout(() => {
    fillLeaderName(name);
  }, 0);
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

function renderFineSummary(summary = emptyFineSummary) {
  const fineSummary = normalizeFineSummary(summary);
  const keyword = elements.fineSearchInput.value.trim();
  const isAdminView = keyword === FINE_ADMIN_KEYWORD;
  const exactMatchRow = fineSummary.rows.find((row) => row.name === keyword);
  const visibleRows = isAdminView ? fineSummary.rows : exactMatchRow ? [exactMatchRow] : [];
  const visibleTotal = isAdminView
    ? fineSummary.totalFine
    : exactMatchRow
      ? exactMatchRow.fine
      : 0;
  const visibleAmountText =
    keyword && !isAdminView && exactMatchRow && !exactMatchRow.submitted
      ? "경건체크 미입력"
      : keyword
        ? formatWon(visibleTotal)
        : "검색 후 확인";

  elements.fineTotalLabel.textContent = isAdminView ? "전체 벌금" : "확인 금액";
  if (keyword && !isAdminView && exactMatchRow && !exactMatchRow.submitted) {
    elements.totalFineAmount.innerHTML = `
      <button class="missing-submit-button" type="button" data-leader-name="${escapeHtml(exactMatchRow.name)}">
        ${visibleAmountText}
      </button>
    `;
  } else {
    elements.totalFineAmount.textContent = visibleAmountText;
  }
  elements.shareFineImageButton.hidden = !isAdminView || !fineSummary.rows.length;

  if (!keyword) {
    elements.fineAccessHint.hidden = false;
    elements.fineAccessHint.textContent = "본인 이름을 정확히 입력하면 개인 벌금만 표시됩니다.";
  } else if (isAdminView) {
    elements.fineAccessHint.hidden = false;
    elements.fineAccessHint.textContent = "관리자 전체 보기입니다.";
  } else if (exactMatchRow) {
    elements.fineAccessHint.hidden = false;
    elements.fineAccessHint.textContent = `${keyword}님의 벌금 내역입니다.`;
  } else {
    elements.fineAccessHint.hidden = false;
    elements.fineAccessHint.textContent = "일치하는 이름이 없습니다. 풀네임을 다시 확인해 주세요.";
  }

  if (!fineSummary.hasFineColumn) {
    elements.fineWarning.hidden = false;
    elements.fineWarning.textContent = "벌금계산 시트에서 벌금 열을 찾지 못했습니다.";
  } else if (!fineSummary.hasAttendanceColumn) {
    elements.fineWarning.hidden = false;
    elements.fineWarning.textContent = "벌금계산 시트에서 토목 출석시간 열을 찾지 못했습니다.";
  } else if (!keyword) {
    elements.fineWarning.hidden = true;
    elements.fineWarning.textContent = "";
  } else if (isAdminView && !fineSummary.isLateFeeApplied) {
    const names = fineSummary.missingAttendanceNames.slice(0, 6).join(", ");
    const suffix = fineSummary.missingAttendanceNames.length > 6 ? " 외" : "";
    elements.fineWarning.hidden = false;
    elements.fineWarning.textContent = `토목 출석시간이 비어 있어 지각비 적용이 안되어있습니다: ${names}${suffix}`;
  } else if (!isAdminView && exactMatchRow && !exactMatchRow.isLateFeeApplied) {
    elements.fineWarning.hidden = false;
    elements.fineWarning.textContent = "토목 출석시간이 비어 있어 지각비 적용이 안되어있습니다.";
  } else {
    elements.fineWarning.hidden = true;
    elements.fineWarning.textContent = "";
  }

  if (!keyword) {
    elements.fineTableBody.innerHTML =
      '<tr><td colspan="4" class="empty-state">이름을 검색하면 벌금 내역이 표시됩니다.</td></tr>';
    return;
  }

  if (!visibleRows.length) {
    elements.fineTableBody.innerHTML =
      '<tr><td colspan="4" class="empty-state">표시할 벌금 데이터가 없습니다.</td></tr>';
    return;
  }

  elements.fineTableBody.innerHTML = visibleRows
    .map(
      (row) => {
        const attendanceText = getFineAttendanceText(row);

        return `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>
            ${
              row.isLateFeeApplied || attendanceText !== "지각비 미적용"
                ? escapeHtml(attendanceText)
                : '<span class="status-badge pending">지각비 미적용</span>'
            }
          </td>
          <td>${formatWon(row.lateFee)}</td>
          <td>
            ${
              row.submitted
                ? `<strong>${formatWon(row.fine)}</strong>`
                : isAdminView
                  ? '<span class="status-badge pending">경건체크 미입력</span>'
                  : `<button class="missing-submit-button table-missing-submit-button" type="button" data-leader-name="${escapeHtml(row.name)}">경건체크 미입력</button>`
            }
          </td>
        </tr>
      `;
      },
    )
    .join("");
}

async function shareFineImage() {
  const fineSummary = normalizeFineSummary(state.fineSummary);

  if (
    isSharingFineImage ||
    elements.fineSearchInput.value.trim() !== FINE_ADMIN_KEYWORD ||
    !fineSummary.rows.length
  ) {
    return;
  }

  isSharingFineImage = true;
  elements.shareFineImageButton.disabled = true;

  const rowHeight = 64;
  const headerHeight = 146;
  const footerHeight = 46;
  const width = 1040;
  const height = headerHeight + rowHeight * fineSummary.rows.length + footerHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#2b241d";
  context.font = "900 36px SUIT, sans-serif";
  context.fillText("이번 주 벌금 내역", 34, 54);
  context.font = "800 21px SUIT, sans-serif";
  context.fillStyle = "#5f5246";
  context.fillText(getCurrentSevenDayPeriodLabel(state.weekLabel), 34, 91);
  context.fillStyle = "#7f4520";
  context.font = "900 29px SUIT, sans-serif";
  context.textAlign = "right";
  context.fillText(`전체 벌금 ${formatWon(fineSummary.totalFine)}`, width - 34, 60);
  context.textAlign = "left";

  const columns = [
    { label: "이름", x: 34 },
    { label: "Q.T", x: 190 },
    { label: "말씀", x: 270 },
    { label: "토목 출석시간", x: 365 },
    { label: "지각비", x: 590 },
    { label: "총 벌금", x: 745 },
  ];

  context.fillStyle = "#7f4520";
  context.fillRect(22, 116, width - 44, rowHeight);
  context.fillStyle = "#fffaf2";
  context.font = "900 23px SUIT, sans-serif";
  columns.forEach((column) => context.fillText(column.label, column.x, 154));

  fineSummary.rows.forEach((row, index) => {
    const y = 116 + rowHeight * (index + 1);
    context.fillStyle = index % 2 === 0 ? "#ffffff" : "#f4eadb";
    context.fillRect(22, y, width - 44, rowHeight);
    context.strokeStyle = "#dfcfbb";
    context.beginPath();
    context.moveTo(22, y + rowHeight);
    context.lineTo(width - 22, y + rowHeight);
    context.stroke();
    context.fillStyle = row.submitted ? "#2b241d" : "#8f3a2f";
    context.font = "900 23px SUIT, sans-serif";
    context.fillText(row.name, columns[0].x, y + 40);
    context.fillText(row.qtCount ?? "-", columns[1].x, y + 40);
    context.fillText(row.bibleCount ?? "-", columns[2].x, y + 40);
    context.fillText(getFineAttendanceText(row), columns[3].x, y + 40);
    context.fillText(formatWon(row.lateFee), columns[4].x, y + 40);
    context.fillText(row.submitted ? formatWon(row.fine) : "경건체크 미입력", columns[5].x, y + 40);
  });

  context.fillStyle = "#5f5246";
  context.font = "800 17px SUIT, sans-serif";
  context.fillText("목자 경건 체크", 34, height - 19);

  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

    if (!blob) {
      return;
    }

    const file = new File([blob], "fine-summary.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "이번 주 벌금 내역",
      });
      return;
    }

    const imageUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "fine-summary.png";
    link.click();
    URL.revokeObjectURL(imageUrl);
  } finally {
    isSharingFineImage = false;
    elements.shareFineImageButton.disabled = false;
  }
}

async function fetchDashboard() {
  if (!state.isAuthenticated) {
    return;
  }

  const fallbackWeek = "스프레드시트에서 주차 설정 필요";

  if (!CONFIG.apiBaseUrl || CONFIG.apiBaseUrl.includes("YOUR_APPS_SCRIPT")) {
    state.weekLabel = fallbackWeek;
    state.rows = normalizeRows({});
    state.fineSummary = emptyFineSummary;
    renderMeta();
    renderTable(state.rows);
    renderFineSummary(state.fineSummary);
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
    state.fineSummary = payload.fineSummary || emptyFineSummary;
    renderMeta(payload.lastUpdated);
    renderTable(state.rows);
    renderFineSummary(state.fineSummary);
  } catch (error) {
    console.error(error);
    state.weekLabel = fallbackWeek;
    state.rows = normalizeRows({});
    state.fineSummary = emptyFineSummary;
    renderMeta();
    renderTable(state.rows);
    renderFineSummary(state.fineSummary);
    setMessage("실시간 데이터를 가져오지 못해 예시 데이터로 표시 중입니다.", "error");
  } finally {
    elements.refreshButton.disabled = false;
    setLoading(false);
  }
}

function renderMeta(lastUpdated = "") {
  const displayWeek = getCurrentSevenDayPeriod(state.weekLabel);
  elements.currentWeekLabel.innerHTML = displayWeek.html;
  elements.formWeekPill.textContent = displayWeek.plain;
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
  elements.fineSearchInput.addEventListener("input", () => renderFineSummary(state.fineSummary));
  elements.totalFineAmount.addEventListener("click", (event) => {
    const button = event.target.closest(".missing-submit-button");

    if (!button) {
      return;
    }

    moveToSubmitForName(button.dataset.leaderName || "");
  });
  elements.fineTableBody.addEventListener("click", (event) => {
    const button = event.target.closest(".missing-submit-button");

    if (!button) {
      return;
    }

    moveToSubmitForName(button.dataset.leaderName || "");
  });
  elements.shareFineImageButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shareFineImage().catch((error) => {
      console.error(error);
    });
  });
  elements.refreshButton.addEventListener("click", fetchDashboard);
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTarget);
    });
  });
  window.addEventListener("hashchange", () => {
    setActiveView(getViewFromHash(), false);
  });
  if (CONFIG.enableRulePopup) {
    elements.ruleOpenButton.addEventListener("click", openRuleModal);
  }
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
  elements.ruleOpenButton.hidden = !CONFIG.enableRulePopup;
  setActiveView(getViewFromHash(), false);
  populateCountOptions();
  renderMeta();
  renderFineSummary();
  bindEvents();
  elements.passwordInput.focus();
}

init();
