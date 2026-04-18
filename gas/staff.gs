/** Staff attendance — separate spreadsheet via STAFF_ATTENDANCE_SHEET_ID (Script Properties). */

var STAFF_TAB = 'Staff';
var STAFF_HDR = ['ID', 'Name', 'Active', 'SalaryType', 'SalaryAmount'];
var STAFF_COL = { ID: 0, NAME: 1, ACTIVE: 2, SALARY_TYPE: 3, SALARY_AMOUNT: 4 };
var ATT_COL = { ENTRY_ID: 0, DATE: 1, STAFF_ID: 2, WORKED: 3, OVERTIME: 4 };
var ATT_HDR = ['EntryID', 'Date', 'StaffID', 'Worked', 'Overtime'];

function _staff_getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('STAFF_ATTENDANCE_SHEET_ID');
  if (!id) {
    throw new Error('STAFF_ATTENDANCE_SHEET_ID not configured. Save your attendance spreadsheet ID in Staff app Settings.');
  }
  return SpreadsheetApp.openById(id);
}

function _staff_getSettings() {
  var props = PropertiesService.getScriptProperties();
  return { staffAttendanceSpreadsheetId: props.getProperty('STAFF_ATTENDANCE_SHEET_ID') || '' };
}

function _staff_saveSettings(staffAttendanceSpreadsheetId) {
  var props = PropertiesService.getScriptProperties();
  var v = String(staffAttendanceSpreadsheetId || '').trim();
  if (v) {
    props.setProperty('STAFF_ATTENDANCE_SHEET_ID', v);
  }
  return true;
}

function _staffNormalizeSalaryType(v) {
  return String(v || '').toLowerCase() === 'monthly' ? 'monthly' : 'daily';
}

function _staffNormalizeSalaryAmount(v) {
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function _staffMigrateStaffSheet(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow < 1) return;
  var a1 = String(sh.getRange(1, 1).getValue() || '');
  if (a1 !== 'ID') {
    sh.insertRowBefore(1);
    lastRow++;
  }
  sh.getRange(1, 1, 1, STAFF_HDR.length).setValues([STAFF_HDR]);
  if (lastRow <= 1) return;
  var data = sh.getRange(2, 1, lastRow, STAFF_HDR.length).getValues();
  var r;
  for (r = 0; r < data.length; r++) {
    while (data[r].length < STAFF_HDR.length) data[r].push('');
    if (!data[r][STAFF_COL.SALARY_TYPE]) data[r][STAFF_COL.SALARY_TYPE] = 'daily';
    if (data[r][STAFF_COL.SALARY_AMOUNT] === '' || data[r][STAFF_COL.SALARY_AMOUNT] === null || data[r][STAFF_COL.SALARY_AMOUNT] === undefined) {
      data[r][STAFF_COL.SALARY_AMOUNT] = 0;
    }
  }
  sh.getRange(2, 1, lastRow, STAFF_HDR.length).setValues(data);
}

function _staffEnsureStaffSheet() {
  var ss = _staff_getSpreadsheet();
  var sh = ss.getSheetByName(STAFF_TAB);
  if (!sh) {
    sh = ss.insertSheet(STAFF_TAB);
    sh.appendRow(STAFF_HDR);
    return sh;
  }
  _staffMigrateStaffSheet(sh);
  return sh;
}

function _staffHandleGet(action, p) {
  if (action === 'getSettings') return _staff_getSettings();
  if (action === 'listStaff') return _staff_listStaff();
  if (action === 'getMonths') return _staff_getMonths();
  if (action === 'getAttendance') return _staff_getAttendance(String(p.month || ''), String(p.year || ''));
  throw new Error('Unknown staff GET action: ' + action);
}

function _staffHandlePost(action, body) {
  if (action === 'saveSettings') return _staff_saveSettings(body.staffAttendanceSpreadsheetId || '');
  if (action === 'addStaff') return _staff_addStaff(body);
  if (action === 'updateStaff') return _staff_updateStaff(body);
  if (action === 'ensureMonth') return _staff_ensureMonth(body.month, body.year);
  if (action === 'setAttendance') return _staff_setAttendance(body);
  throw new Error('Unknown staff POST action: ' + action);
}

function _staff_rowActive(r2) {
  if (r2 === false || String(r2).toLowerCase() === 'false' || r2 === 0 || String(r2) === '0') return false;
  if (String(r2).toUpperCase() === 'N' || String(r2).toUpperCase() === 'NO') return false;
  return true;
}

function _staff_listStaff() {
  _staffEnsureStaffSheet();
  var sh = _staff_getSpreadsheet().getSheetByName(STAFF_TAB);
  var vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  return vals.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    return {
      id: String(r[STAFF_COL.ID]),
      name: String(r[STAFF_COL.NAME] || ''),
      active: _staff_rowActive(r[STAFF_COL.ACTIVE]),
      salaryType: _staffNormalizeSalaryType(r[STAFF_COL.SALARY_TYPE]),
      salaryAmount: _staffNormalizeSalaryAmount(r[STAFF_COL.SALARY_AMOUNT]),
    };
  });
}

function _staff_addStaff(body) {
  _staffEnsureStaffSheet();
  var name = String(body.name || '').trim();
  if (!name) throw new Error('Name is required');
  var salaryType = _staffNormalizeSalaryType(body.salaryType);
  var salaryAmount = _staffNormalizeSalaryAmount(body.salaryAmount);
  var sh = _staff_getSpreadsheet().getSheetByName(STAFF_TAB);
  var id = Utilities.getUuid();
  sh.appendRow([id, name, true, salaryType, salaryAmount]);
  return { id: id, name: name, active: true, salaryType: salaryType, salaryAmount: salaryAmount };
}

function _staff_updateStaff(body) {
  _staffEnsureStaffSheet();
  var id = String(body.id || '').trim();
  if (!id) throw new Error('id is required');
  var name = String(body.name || '').trim();
  if (!name) throw new Error('Name is required');
  var salaryType = _staffNormalizeSalaryType(body.salaryType);
  var salaryAmount = _staffNormalizeSalaryAmount(body.salaryAmount);
  var active = body.active === undefined ? true : _staff_rowActive(body.active);
  var sh = _staff_getSpreadsheet().getSheetByName(STAFF_TAB);
  var vals = sh.getDataRange().getValues();
  var i;
  for (i = 1; i < vals.length; i++) {
    if (String(vals[i][STAFF_COL.ID]) === id) {
      sh.getRange(i + 1, 1, 1, STAFF_HDR.length).setValues([[id, name, active, salaryType, salaryAmount]]);
      return { id: id, name: name, active: active, salaryType: salaryType, salaryAmount: salaryAmount };
    }
  }
  throw new Error('Staff not found');
}

function _staff_getMonths() {
  var ss = _staff_getSpreadsheet();
  return ss
    .getSheets()
    .map(function (sh) {
      return sh.getName();
    })
    .filter(function (n) {
      return M_RX.test(n);
    })
    .map(function (n) {
      var m = n.match(M_RX);
      return { month: m[1], year: m[2] };
    })
    .sort(function (a, b) {
      var yd = parseInt(b.year, 10) - parseInt(a.year, 10);
      return yd !== 0 ? yd : MNS.indexOf(b.month) - MNS.indexOf(a.month);
    });
}

function _staff_ensureMonth(month, year) {
  var ss = _staff_getSpreadsheet();
  var tab = _name(month, year);
  var sh = ss.getSheetByName(tab);
  if (!sh) {
    sh = ss.insertSheet(tab);
    sh.appendRow(ATT_HDR);
    return true;
  }
  var first = sh.getRange(1, 1, 1, ATT_HDR.length).getValues()[0];
  if (String(first[0]) !== 'EntryID') {
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, ATT_HDR.length).setValues([ATT_HDR]);
  }
  return true;
}

function _staff_fmtDate(cell) {
  if (Object.prototype.toString.call(cell) === '[object Date]' && !isNaN(cell)) {
    var d = cell;
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  }
  return String(cell || '').trim();
}

function _staff_bool(v) {
  return (
    v === true ||
    String(v).toLowerCase() === 'true' ||
    v === 1 ||
    String(v) === '1' ||
    String(v).toUpperCase() === 'Y' ||
    String(v).toUpperCase() === 'YES'
  );
}

function _staff_getAttendance(month, year) {
  var tab = _name(month, year);
  var ss = _staff_getSpreadsheet();
  var sh = ss.getSheetByName(tab);
  if (!sh) return [];
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  return vals
    .slice(1)
    .filter(function (r) {
      return r[ATT_COL.DATE] && r[ATT_COL.STAFF_ID];
    })
    .map(function (r) {
      return {
        entryId: String(r[ATT_COL.ENTRY_ID] || ''),
        date: _staff_fmtDate(r[ATT_COL.DATE]),
        staffId: String(r[ATT_COL.STAFF_ID] || ''),
        worked: _staff_bool(r[ATT_COL.WORKED]),
        overtime: _staff_bool(r[ATT_COL.OVERTIME]),
      };
    });
}

function _staff_setAttendance(body) {
  var month = String(body.month || '');
  var year = String(body.year || '');
  var dateStr = String(body.date || '').trim();
  var staffId = String(body.staffId || '').trim();
  if (!month || !year || !dateStr || !staffId) {
    throw new Error('month, year, date, and staffId are required');
  }
  var worked = _staff_bool(body.worked);
  var overtime = _staff_bool(body.overtime);
  if (overtime && !worked) throw new Error('Overtime requires worked');

  _staff_ensureMonth(month, year);
  var tab = _name(month, year);
  var sh = _staff_getSpreadsheet().getSheetByName(tab);
  var vals = sh.getDataRange().getValues();
  var i;
  for (i = 1; i < vals.length; i++) {
    var d = _staff_fmtDate(vals[i][ATT_COL.DATE]);
    var sid = String(vals[i][ATT_COL.STAFF_ID] || '');
    if (d === dateStr && sid === staffId) {
      if (!worked && !overtime) {
        sh.deleteRow(i + 1);
        return { entryId: '', date: dateStr, staffId: staffId, worked: false, overtime: false };
      }
      var entryId = String(vals[i][ATT_COL.ENTRY_ID] || Utilities.getUuid());
      sh.getRange(i + 1, 1, 1, ATT_HDR.length).setValues([[entryId, dateStr, staffId, worked, overtime]]);
      return { entryId: entryId, date: dateStr, staffId: staffId, worked: worked, overtime: overtime };
    }
  }
  if (!worked && !overtime) {
    return { entryId: '', date: dateStr, staffId: staffId, worked: false, overtime: false };
  }
  var newId = Utilities.getUuid();
  sh.appendRow([newId, dateStr, staffId, worked, overtime]);
  return { entryId: newId, date: dateStr, staffId: staffId, worked: worked, overtime: overtime };
}
