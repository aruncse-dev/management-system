const VAULT_HDR = ['ID', 'Account Holder Name', 'Bank Name', 'Account No.', 'IFSC', 'CIF', 'Username', 'Password', 'Transaction Password', 'Profile Password', 'MPIN', 'Updated At'];
const VAULT_SHEET = 'banking';
const VAULT_SPREADSHEET_NAME = 'FinTrackerVault';

function _vault_getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('VAULT_SPREADSHEET_ID');
  if (!id) throw new Error('VAULT_SPREADSHEET_ID not configured. Save it in Vault Settings.');
  const ss = SpreadsheetApp.openById(id);
  if (ss.getName() !== VAULT_SPREADSHEET_NAME) {
    ss.rename(VAULT_SPREADSHEET_NAME);
  }
  return ss;
}

function _vault_getSheet() {
  const ss = _vault_getSpreadsheet();
  let sh = ss.getSheetByName(VAULT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(VAULT_SHEET);
    sh.appendRow(VAULT_HDR);
    return sh;
  }
  return sh;
}

function _vaultHandleGet(action, p) {
  if (action === 'getEntries') return _vault_getEntries();
  if (action === 'getEntry') return _vault_getEntry(String(p.id || ''));
  throw new Error('Unknown vault GET action: ' + action);
}

function _vaultHandlePost(action, body) {
  if (action === 'addEntry') return _vault_addEntry(body);
  if (action === 'updateEntry') return _vault_updateEntry(body);
  if (action === 'deleteEntry') return _vault_deleteEntry(String(body.id || ''));
  throw new Error('Unknown vault POST action: ' + action);
}

function _vault_getSettings() {
  try {
    const props = PropertiesService.getScriptProperties();
    return {
      vaultSpreadsheetId: props.getProperty('VAULT_SPREADSHEET_ID') || '',
    };
  } catch(e) {
    Logger.log('_vault_getSettings ERROR: ' + e.message);
    throw e;
  }
}

function _vault_saveSettings(vaultSpreadsheetId) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (vaultSpreadsheetId) {
      props.setProperty('VAULT_SPREADSHEET_ID', String(vaultSpreadsheetId));
    }
    return true;
  } catch(e) {
    Logger.log('_vault_saveSettings ERROR: ' + e.message);
    throw e;
  }
}

function _vault_getEntries() {
  const sh = _vault_getSheet();
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  return vals.slice(1).filter(r => r[0]).map(_vault_rowToObj);
}

function _vault_getEntry(id) {
  const rows = _vault_getEntries();
  const row = rows.find(r => r.id === id);
  if (!row) throw new Error('Record not found');
  return row;
}

function _vault_rowToObj(row) {
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

function _vault_addEntry(body) {
  const sh = _vault_getSheet();
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
    sh.getRange(rowIdx + 1, 1, 1, VAULT_HDR.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return id;
}

function _vault_updateEntry(body) {
  const sh = _vault_getSheet();
  const id = String(body.id || '');
  if (!id) throw new Error('Missing id');
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '') === id);
  if (rowIdx === -1) throw new Error('Record not found');
  const now = new Date().toISOString();
  sh.getRange(rowIdx + 1, 1, 1, VAULT_HDR.length).setValues([[
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

function _vault_deleteEntry(id) {
  const sh = _vault_getSheet();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '') === id);
  if (rowIdx === -1) throw new Error('Record not found');
  sh.deleteRow(rowIdx + 1);
  return true;
}
