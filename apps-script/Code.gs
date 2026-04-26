const SHEET_NAME = 'responses';
const SUBMISSION_APPEND_SHEET_NAME = '설문지 응답 시트';
const MEMBER_SHEET_NAME = 'members';
const SETTINGS_SHEET_NAME = 'settings';
const DATA_SOURCE = 'DIRECT_SHEET';
const FORM_RESPONSE_SHEET_NAME = 'Form Responses 1';
const CURRENT_WEEK_CELL = 'B2';
const EXISTING_CAMPUS_SHEET = {
  enabled: true,
  sheetName: '벌금계산',
  currentWeekCell: 'B1',
  headerRowNumber: 2,
  dataStartRowNumber: 3,
  nameColumnLetter: 'B',
  columnNames: {
    qtCount: 'Q.T',
    bibleCount: '말씀',
    attendanceTime: '토목 출석시간',
    reason: '사유',
    lateFee: '지각비',
    fine: '벌금',
  },
  nonSubmittedValues: ['미제출', ''],
};
const FORM_COLUMNS = {
  timestamp: 1,
  weekLabel: 2,
  leaderName: 3,
  qtCount: 4,
  bibleCount: 5,
};
const MAKEUP_LATE_REASON_KEYWORD = '보강 지각';

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';

  if (action === 'dashboard') {
    return jsonOutput(buildDashboardPayload());
  }

  return jsonOutput({
    ok: true,
    message: 'Google Apps Script devotional tracker API',
  });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');

  if (payload.action === 'submit') {
    saveSubmission(payload);
    return jsonOutput({
      ok: true,
      message: '이번 주 경건 체크가 저장되었습니다.',
    });
  }

  return jsonOutput({
    ok: false,
    message: '지원하지 않는 요청입니다.',
  });
}

function saveSubmission(payload) {
  const sheet = getOrCreateSheet(SUBMISSION_APPEND_SHEET_NAME);
  const nextRow = getNextSubmissionRow_(sheet);
  const weekLabel = String(payload.weekLabel || getCurrentWeekLabel_()).trim();

  sheet
    .getRange(nextRow, 1, 1, 4)
    .setValues([[weekLabel, payload.leaderName || '', payload.qtCount || 0, payload.bibleCount || 0]]);
}

function buildDashboardPayload() {
  if (EXISTING_CAMPUS_SHEET.enabled) {
    return buildExistingCampusDashboardPayload_();
  }

  const weekLabel = getCurrentWeekLabel_();
  const members = getMemberRows_();
  const submissions = getLatestWeekSubmissions_(weekLabel);

  return {
    ok: true,
    weekLabel: weekLabel,
    lastUpdated: new Date().toISOString(),
    members: members,
    submissions: submissions,
  };
}

function buildExistingCampusDashboardPayload_() {
  const legacySheet = getExistingCampusSheet_();

  if (!legacySheet) {
    return {
      ok: true,
      weekLabel: '',
      lastUpdated: new Date().toISOString(),
      members: [],
      submissions: [],
      fineSummary: buildEmptyFineSummary_(),
    };
  }

  const weekLabel = String(
    legacySheet.getRange(EXISTING_CAMPUS_SHEET.currentWeekCell).getDisplayValue()
  ).trim();
  const lastRow = legacySheet.getLastRow();
  const lastColumn = legacySheet.getLastColumn();

  if (lastRow < EXISTING_CAMPUS_SHEET.headerRowNumber || lastColumn === 0) {
    return {
      ok: true,
      weekLabel: weekLabel,
      lastUpdated: new Date().toISOString(),
      members: [],
      submissions: [],
      fineSummary: buildEmptyFineSummary_(),
    };
  }

  const headerRow = legacySheet
    .getRange(EXISTING_CAMPUS_SHEET.headerRowNumber, 1, 1, lastColumn)
    .getDisplayValues()[0];
  const nameColumnIndex = columnLetterToIndex_(EXISTING_CAMPUS_SHEET.nameColumnLetter) - 1;
  const indexes = {
    qtCount: headerRow.indexOf(EXISTING_CAMPUS_SHEET.columnNames.qtCount),
    bibleCount: headerRow.indexOf(EXISTING_CAMPUS_SHEET.columnNames.bibleCount),
    attendanceTime: headerRow.indexOf(EXISTING_CAMPUS_SHEET.columnNames.attendanceTime),
    reason: headerRow.indexOf(EXISTING_CAMPUS_SHEET.columnNames.reason),
    lateFee: headerRow.indexOf(EXISTING_CAMPUS_SHEET.columnNames.lateFee),
    fine: headerRow.indexOf(EXISTING_CAMPUS_SHEET.columnNames.fine),
  };

  if (lastRow < EXISTING_CAMPUS_SHEET.dataStartRowNumber) {
    return {
      ok: true,
      weekLabel: weekLabel,
      lastUpdated: new Date().toISOString(),
      members: [],
      submissions: [],
      fineSummary: buildEmptyFineSummary_(),
    };
  }

  const rowCount = lastRow - EXISTING_CAMPUS_SHEET.dataStartRowNumber + 1;
  const values = legacySheet
    .getRange(EXISTING_CAMPUS_SHEET.dataStartRowNumber, 1, rowCount, lastColumn)
    .getDisplayValues();
  const members = [];
  const submissions = [];
  const fineRows = [];
  const missingAttendanceNames = [];
  var totalFine = 0;

  values.forEach(function (row) {
    const name = String(row[nameColumnIndex] || '').trim();

    if (!name) {
      return;
    }

    const qtValue = indexes.qtCount >= 0 ? row[indexes.qtCount] : '';
    const bibleValue = indexes.bibleCount >= 0 ? row[indexes.bibleCount] : '';
    const attendanceTime = indexes.attendanceTime >= 0 ? String(row[indexes.attendanceTime] || '').trim() : '';
    const reason = indexes.reason >= 0 ? String(row[indexes.reason] || '').trim() : '';
    const lateFeeValue = indexes.lateFee >= 0 ? row[indexes.lateFee] : '';
    const fineValue = indexes.fine >= 0 ? row[indexes.fine] : '';
    const lateFee = parseWonValue_(lateFeeValue);
    const fine = parseWonValue_(fineValue);
    const submitted = isSubmittedValue_(qtValue) || isSubmittedValue_(bibleValue);
    const attendanceDisplay = getAttendanceDisplayText_(attendanceTime, reason);

    totalFine += fine;

    if (!attendanceTime) {
      missingAttendanceNames.push(name);
    }

    members.push({ name: name });
    submissions.push({
      name: name,
      qtCount: normalizeCountValue_(qtValue),
      bibleCount: normalizeCountValue_(bibleValue),
      submittedAt: '',
      submitted: submitted,
    });
    fineRows.push({
      name: name,
      qtCount: normalizeCountValue_(qtValue),
      bibleCount: normalizeCountValue_(bibleValue),
      attendanceTime: attendanceDisplay,
      lateFee: lateFee,
      fine: fine,
      submitted: submitted,
      isLateFeeApplied: Boolean(attendanceTime),
    });
  });

  return {
    ok: true,
    weekLabel: weekLabel,
    lastUpdated: new Date().toISOString(),
    members: members,
    submissions: submissions,
    fineSummary: {
      totalFine: totalFine,
      hasAttendanceColumn: indexes.attendanceTime >= 0,
      hasFineColumn: indexes.fine >= 0,
      isLateFeeApplied: missingAttendanceNames.length === 0,
      missingAttendanceNames: missingAttendanceNames,
      rows: fineRows,
    },
  };
}

function getAttendanceDisplayText_(attendanceTime, reason) {
  if (reason && reason.indexOf(MAKEUP_LATE_REASON_KEYWORD) !== -1) {
    return MAKEUP_LATE_REASON_KEYWORD;
  }

  return attendanceTime || reason || '-';
}

function buildEmptyFineSummary_() {
  return {
    totalFine: 0,
    hasAttendanceColumn: true,
    hasFineColumn: true,
    isLateFeeApplied: true,
    missingAttendanceNames: [],
    rows: [],
  };
}

function getMemberRows_() {
  const sheet = getOrCreateSheet(MEMBER_SHEET_NAME, ['leaderName']);
  const rows = sheet.getDataRange().getValues();

  return rows
    .slice(1)
    .filter(function (row) {
      return row[0];
    })
    .map(function (row) {
      return {
        name: row[0],
      };
    });
}

function getLatestWeekSubmissions_(weekLabel) {
  if (DATA_SOURCE === 'GOOGLE_FORM') {
    return getLatestWeekSubmissionsFromForm_(weekLabel);
  }

  const sheet = getOrCreateSheet(SHEET_NAME, [
    'timestamp',
    'weekLabel',
    'leaderName',
    'qtCount',
    'bibleCount',
  ]);
  const rows = sheet.getDataRange().getValues();
  const latestByName = {};

  rows.slice(1).forEach(function (row) {
    if (!row[0] || row[1] !== weekLabel || !row[2]) {
      return;
    }

    latestByName[row[2]] = {
      name: row[2],
      qtCount: row[3],
      bibleCount: row[4],
      submittedAt: row[0] instanceof Date ? row[0].toISOString() : row[0],
      submitted: true,
    };
  });

  return Object.keys(latestByName).map(function (key) {
    return latestByName[key];
  });
}

function getLatestWeekSubmissionsFromForm_(weekLabel) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(FORM_RESPONSE_SHEET_NAME);

  if (!sheet) {
    return [];
  }

  const rows = sheet.getDataRange().getValues();
  const latestByName = {};

  rows.slice(1).forEach(function (row) {
    const name = row[FORM_COLUMNS.leaderName - 1];
    const rowWeekLabel = row[FORM_COLUMNS.weekLabel - 1];

    if (!name || rowWeekLabel !== weekLabel) {
      return;
    }

    latestByName[name] = {
      name: name,
      qtCount: row[FORM_COLUMNS.qtCount - 1] || 0,
      bibleCount: row[FORM_COLUMNS.bibleCount - 1] || 0,
      submittedAt:
        row[FORM_COLUMNS.timestamp - 1] instanceof Date
          ? row[FORM_COLUMNS.timestamp - 1].toISOString()
          : row[FORM_COLUMNS.timestamp - 1],
      submitted: true,
    };
  });

  return Object.keys(latestByName).map(function (key) {
    return latestByName[key];
  });
}

function getCurrentWeekLabel_() {
  if (EXISTING_CAMPUS_SHEET.enabled) {
    const legacySheet = getExistingCampusSheet_();

    if (!legacySheet) {
      return '';
    }

    return String(legacySheet.getRange(EXISTING_CAMPUS_SHEET.currentWeekCell).getDisplayValue()).trim();
  }

  const sheet = getOrCreateSheet(SETTINGS_SHEET_NAME, ['key', 'value']);
  const configuredWeekLabel = String(sheet.getRange(CURRENT_WEEK_CELL).getDisplayValue()).trim();

  if (configuredWeekLabel) {
    return configuredWeekLabel;
  }

  return '';
}

function getOrCreateSheet(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (headers && sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function getExistingCampusSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(EXISTING_CAMPUS_SHEET.sheetName);
}

function isSubmittedValue_(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return false;
  }

  return EXISTING_CAMPUS_SHEET.nonSubmittedValues.indexOf(normalized) === -1;
}

function normalizeCountValue_(value) {
  const normalized = String(value || '').trim();

  if (!normalized || EXISTING_CAMPUS_SHEET.nonSubmittedValues.indexOf(normalized) >= 0) {
    return '-';
  }

  return normalized;
}

function parseWonValue_(value) {
  if (typeof value === 'number') {
    return value;
  }

  const normalized = String(value || '').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

function columnLetterToIndex_(columnLetter) {
  var result = 0;
  var normalized = String(columnLetter || '').trim().toUpperCase();

  for (var i = 0; i < normalized.length; i += 1) {
    result = result * 26 + (normalized.charCodeAt(i) - 64);
  }

  return result;
}

function getNextSubmissionRow_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow === 0) {
    return 1;
  }

  const values = sheet.getRange(1, 1, lastRow, 4).getDisplayValues();

  for (var rowIndex = values.length - 1; rowIndex >= 0; rowIndex -= 1) {
    var hasData = values[rowIndex].some(function (cell) {
      return String(cell || '').trim() !== '';
    });

    if (hasData) {
      return rowIndex + 2;
    }
  }

  return 1;
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}
