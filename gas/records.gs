const RECORDS_HDR = ['ID', 'Account Holder Name', 'Bank Name', 'Account No.', 'IFSC', 'CIF', 'Username', 'Password', 'Transaction Password', 'Profile Password', 'MPIN', 'Updated At'];
const RECORDS_SHEET = 'banking';
const RECORDS_SPREADSHEET_NAME = 'FinTrackerRecords';

function _records_getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('RECORDS_SPREADSHEET_ID');
  if (!id) throw new Error('RECORDS_SPREADSHEET_ID not configured. Save it in Records Settings.');
  const ss = SpreadsheetApp.openById(id);
  if (ss.getName() !== RECORDS_SPREADSHEET_NAME) {
    ss.rename(RECORDS_SPREADSHEET_NAME);
  }
  return ss;
}

function _records_getSheet() {
  const ss = _records_getSpreadsheet();
  let sh = ss.getSheetByName(RECORDS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(RECORDS_SHEET);
    sh.appendRow(RECORDS_HDR);
    return sh;
  }
  return sh;
}

function _recordsHandleGet(action, p) {
  if (action === 'getEntries') return _records_getEntries();
  if (action === 'getEntry') return _records_getEntry(String(p.id || ''));
  throw new Error('Unknown records GET action: ' + action);
}

function _recordsHandlePost(action, body) {
  if (action === 'addEntry') return _records_addEntry(body);
  if (action === 'updateEntry') return _records_updateEntry(body);
  if (action === 'deleteEntry') return _records_deleteEntry(String(body.id || ''));
  throw new Error('Unknown records POST action: ' + action);
}

function _records_getEntries() {
  const sh = _records_getSheet();
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  return vals.slice(1).filter(r => r[0]).map(_records_rowToObj);
}

function _records_getEntry(id) {
  const rows = _records_getEntries();
  const row = rows.find(r => r.id === id);
  if (!row) throw new Error('Record not found');
  return row;
}

function _records_rowToObj(row) {
  return {
    id: String(row[0] || ''),
    account_holder_name: String(row[1] || ''),
    bank_name: String(row[2] || ''),
    account_no: String(row[3] || ''),
    ifsc: String(row[4] || ''),
    cif: String(row[5] || ''),
    username: String(row[6] || ''),
    password: String(row[7] || ''),
    transaction_password: String(row[8] || ''),
    profile_password: String(row[9] || ''),
    mpin: String(row[10] || ''),
    updated_at: String(row[11] || ''),
  };
}

function _records_addEntry(body) {
  const sh = _records_getSheet();
  const now = new Date().toISOString();
  const accountNo = String(body.account_no || '').trim();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[3] || '').trim() === accountNo && accountNo);
  const id = rowIdx >= 0 ? String(vals[rowIdx][0] || Utilities.getUuid()) : Utilities.getUuid();
  const row = [
    id,
    String(body.account_holder_name || ''),
    String(body.bank_name || ''),
    accountNo,
    String(body.ifsc || ''),
    String(body.cif || ''),
    String(body.username || ''),
    String(body.password || ''),
    String(body.transaction_password || ''),
    String(body.profile_password || ''),
    String(body.mpin || ''),
    now,
  ];
  if (rowIdx >= 0) {
    sh.getRange(rowIdx + 1, 1, 1, RECORDS_HDR.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return id;
}

function _records_updateEntry(body) {
  const sh = _records_getSheet();
  const id = String(body.id || '');
  if (!id) throw new Error('Missing id');
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '') === id);
  if (rowIdx === -1) throw new Error('Record not found');
  const now = new Date().toISOString();
  sh.getRange(rowIdx + 1, 1, 1, RECORDS_HDR.length).setValues([[
    id,
    String(body.account_holder_name || ''),
    String(body.bank_name || ''),
    String(body.account_no || ''),
    String(body.ifsc || ''),
    String(body.cif || ''),
    String(body.username || ''),
    String(body.password || ''),
    String(body.transaction_password || ''),
    String(body.profile_password || ''),
    String(body.mpin || ''),
    now,
  ]]);
  return true;
}

function _records_deleteEntry(id) {
  const sh = _records_getSheet();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '') === id);
  if (rowIdx === -1) throw new Error('Record not found');
  sh.deleteRow(rowIdx + 1);
  return true;
}
