const VAULT_BANKING_HDR = ['ID', 'Account Holder Name', 'Bank Name', 'Account No.', 'IFSC', 'CIF', 'Username', 'Password', 'Transaction Password', 'Profile Password', 'MPIN', 'App UUID', 'Updated At'];
const VAULT_BANKING_SHEET = 'banking';
const VAULT_APPS_HDR = ['ID', 'App Name', 'Category', 'Logo', 'App Link', 'Username', 'Password', 'Two Factor Enabled', 'Notes', 'Updated At'];
const VAULT_APPS_SHEET = 'Apps';
const VAULT_SPREADSHEET_NAME = 'FinTrackerVault';
const VAULT_CACHE = CacheService.getScriptCache();
const VAULT_BANKING_CACHE_KEY = 'vault_banking_entries';
const VAULT_APPS_CACHE_KEY = 'vault_apps_entries';

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
  return _vault_getSheetByName(VAULT_BANKING_SHEET, VAULT_BANKING_HDR);
}

function _vault_getSheetByName(sheetName, headers) {
  const ss = _vault_getSpreadsheet();
  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.appendRow(headers);
    return sh;
  }
  return sh;
}

function _vaultHandleGet(action, p) {
  if (action === 'getEntries') return _vault_getEntries();
  if (action === 'getEntry') return _vault_getEntry(String(p.id || ''));
  if (action === 'getApps') return _vault_getApps();
  if (action === 'getApp') return _vault_getApp(String(p.app_uuid || p.id || ''));
  throw new Error('Unknown vault GET action: ' + action);
}

function _vaultHandlePost(action, body) {
  if (action === 'addEntry') return _vault_addEntry(body);
  if (action === 'updateEntry') return _vault_updateEntry(body);
  if (action === 'deleteEntry') return _vault_deleteEntry(String(body.id || ''));
  if (action === 'addApp') return _vault_addApp(body);
  if (action === 'updateApp') return _vault_updateApp(body);
  if (action === 'deleteApp') return _vault_deleteApp(String(body.app_uuid || body.id || ''));
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
      VAULT_CACHE.remove(VAULT_BANKING_CACHE_KEY);
      VAULT_CACHE.remove(VAULT_APPS_CACHE_KEY);
    }
    return true;
  } catch(e) {
    Logger.log('_vault_saveSettings ERROR: ' + e.message);
    throw e;
  }
}

function _vault_getEntries() {
  const cached = VAULT_CACHE.get(VAULT_BANKING_CACHE_KEY);
  const vals = cached ? JSON.parse(cached) : _vault_getSheet().getDataRange().getValues();
  if (!cached) VAULT_CACHE.put(VAULT_BANKING_CACHE_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  return vals.slice(1).filter(r => r[0]).map(_vault_rowToObj);
}

function _vault_getAppsSheet() {
  return _vault_getSheetByName(VAULT_APPS_SHEET, VAULT_APPS_HDR);
}

function _vault_getApps() {
  const cached = VAULT_CACHE.get(VAULT_APPS_CACHE_KEY);
  const vals = cached ? JSON.parse(cached) : _vault_getAppsSheet().getDataRange().getValues();
  if (!cached) VAULT_CACHE.put(VAULT_APPS_CACHE_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  return vals.slice(1).filter(r => r[0]).map(_vault_appRowToObj);
}

function _vault_getApp(appUuid) {
  const rows = _vault_getApps();
  const row = rows.find(r => r.app_uuid === appUuid);
  if (!row) throw new Error('App not found');
  return row;
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
    app_uuid: String(row[11] || ''),
    updated_at: String(row[12] || ''),
  };
}

function _vault_addEntry(body) {
  const sh = _vault_getSheet();
  const now = new Date().toISOString();
  const accountNo = String(body.account_no || '').trim();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[4] || '').trim() === accountNo && accountNo);
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
    String(body.app_uuid || ''),
    now,
  ];
  if (rowIdx >= 0) {
    sh.getRange(rowIdx + 1, 1, 1, VAULT_BANKING_HDR.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  VAULT_CACHE.remove(VAULT_BANKING_CACHE_KEY);
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
  sh.getRange(rowIdx + 1, 1, 1, VAULT_BANKING_HDR.length).setValues([[
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
    String(body.app_uuid || ''),
    now,
  ]]);
  VAULT_CACHE.remove(VAULT_BANKING_CACHE_KEY);
  return true;
}

function _vault_deleteEntry(id) {
  const sh = _vault_getSheet();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '') === id);
  if (rowIdx === -1) throw new Error('Record not found');
  sh.deleteRow(rowIdx + 1);
  VAULT_CACHE.remove(VAULT_BANKING_CACHE_KEY);
  return true;
}

function _vault_appRowToObj(row) {
  return {
    app_uuid: String(row[0] || ''),
    app_name: String(row[1] || ''),
    category: String(row[2] || ''),
    logo: String(row[3] || ''),
    app_link: String(row[4] || ''),
    username: String(row[5] || ''),
    password: String(row[6] || ''),
    two_factor_enabled: String(row[7] || '') === 'true',
    notes: String(row[8] || ''),
    updated_at: String(row[9] || ''),
  };
}

function _vault_findAppRow(sh, appUuid) {
  const vals = sh.getDataRange().getValues();
  return vals.findIndex((r, idx) => idx > 0 && String(r[0] || '') === appUuid);
}

function _vault_addApp(body) {
  const sh = _vault_getAppsSheet();
  const appName = String(body.app_name || '').trim();
  if (!appName) throw new Error('app_name is required');
  const appUuid = String(body.app_uuid || '').trim() || Utilities.getUuid();
  const vals = sh.getDataRange().getValues();
  const existingIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '') === appUuid);
  if (existingIdx >= 0) throw new Error('app_uuid already exists');
  const now = new Date().toISOString();
  sh.appendRow([
    appUuid,
    appName,
    String(body.category || ''),
    String(body.logo || ''),
    String(body.app_link || ''),
    String(body.username || ''),
    String(body.password || ''),
    String(body.two_factor_enabled === true || body.two_factor_enabled === 'true'),
    String(body.notes || ''),
    now,
  ]);
  VAULT_CACHE.remove(VAULT_APPS_CACHE_KEY);
  return appUuid;
}

function _vault_updateApp(body) {
  const sh = _vault_getAppsSheet();
  const appUuid = String(body.app_uuid || body.id || '').trim();
  if (!appUuid) throw new Error('Missing app_uuid');
  const rowIdx = _vault_findAppRow(sh, appUuid);
  if (rowIdx === -1) throw new Error('App not found');
  const appName = String(body.app_name || '').trim();
  if (!appName) throw new Error('app_name is required');
  const nextRow = [
    appUuid,
    appName,
    String(body.category || ''),
    String(body.logo || ''),
    String(body.app_link || ''),
    String(body.username || ''),
    String(body.password || ''),
    String(body.two_factor_enabled === true || body.two_factor_enabled === 'true'),
    String(body.notes || ''),
    new Date().toISOString(),
  ];
  sh.getRange(rowIdx + 1, 1, 1, VAULT_APPS_HDR.length).setValues([nextRow]);
  VAULT_CACHE.remove(VAULT_APPS_CACHE_KEY);
  return true;
}

function _vault_deleteApp(appUuid) {
  const sh = _vault_getAppsSheet();
  const rowIdx = _vault_findAppRow(sh, appUuid);
  if (rowIdx === -1) throw new Error('App not found');
  sh.deleteRow(rowIdx + 1);
  VAULT_CACHE.remove(VAULT_APPS_CACHE_KEY);
  return true;
}
