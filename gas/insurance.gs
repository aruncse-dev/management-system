// ── INSURANCE MODULE ─────────────────────────────────────────────────────────
//
// Spreadsheet : FinTrackerVault
// Sheet       : Insurance
// Columns     : ID | Policy Type | Plan Name | Insurer | App ID | Policy Number | Policy Owner | Premium Amount | Premium Mode | Payment Method | Issue Date | Maturity Date | Sum Assured | Cash Value | Nominee Name | Notes | Updated At

const I_SHEET = 'Insurance';
const I_HDR = ['ID', 'Policy Type', 'Plan Name', 'Insurer', 'App ID', 'Policy Number', 'Policy Owner', 'Premium Amount', 'Premium Mode', 'Payment Method', 'Issue Date', 'Maturity Date', 'Sum Assured', 'Cash Value', 'Nominee Name', 'Notes', 'Updated At'];
const I_COL = {
  ID: 0, TYPE: 1, PLAN: 2, INSURER: 3, APP: 4, POL_NO: 5, OWNER: 6, PREMIUM: 7, MODE: 8, PAYMENT: 9,
  ISSUE: 10, MATURITY: 11, SUM: 12, CASH: 13, NOMINEE: 14, NOTES: 15, UPDATED: 16,
};

function _ensureInsuranceHeader(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(I_HDR);
    return;
  }
  try {
    const firstRow = sh.getRange(1, 1, 1, I_HDR.length).getValues()[0];
    const isHeader = I_HDR.every((col, i) => String(firstRow[i] || '').trim() === col);
    if (!isHeader) Logger.log('_ensureInsuranceHeader: header mismatch, preserving data');
  } catch(e) {
    Logger.log('_ensureInsuranceHeader ERROR: ' + e.message);
  }
}

function _insuranceSheet() {
  const ssId = _getSpreadsheetId('VAULT_SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  let sh = ss.getSheetByName(I_SHEET);
  if (!sh) {
    sh = ss.insertSheet(I_SHEET);
    sh.appendRow(I_HDR);
  }
  _ensureInsuranceHeader(sh);
  return sh;
}

function _insuranceHandleGet(action) {
  if (action === 'getEntries') return _insurance_getEntries();
  throw new Error('Unknown insurance GET action: ' + action);
}

function _insuranceHandlePost(action, body) {
  if (action === 'addEntry') return _insurance_addEntry(body);
  if (action === 'updateEntry') return _insurance_updateEntry(body);
  if (action === 'deleteEntry') return _insurance_deleteEntry(String(body.id || ''));
  throw new Error('Unknown insurance POST action: ' + action);
}

function _insurance_rowToObj(row) {
  return {
    id: String(row[I_COL.ID] || ''),
    policy_type: String(row[I_COL.TYPE] || '').trim().toLowerCase(),
    plan_name: String(row[I_COL.PLAN] || '').trim(),
    insurer: String(row[I_COL.INSURER] || '').trim(),
    app_uuid: String(row[I_COL.APP] || '').trim(),
    policy_number: String(row[I_COL.POL_NO] || '').trim(),
    policy_owner: String(row[I_COL.OWNER] || '').trim(),
    premium_amount: Number(row[I_COL.PREMIUM]) || 0,
    premium_mode: String(row[I_COL.MODE] || '').trim(),
    payment_method: String(row[I_COL.PAYMENT] || '').trim(),
    issue_date: _fmtDate(row[I_COL.ISSUE]),
    maturity_date: _fmtDate(row[I_COL.MATURITY]),
    sum_assured: Number(row[I_COL.SUM]) || 0,
    cash_value: Number(row[I_COL.CASH]) || 0,
    nominee_name: String(row[I_COL.NOMINEE] || '').trim(),
    notes: String(row[I_COL.NOTES] || '').trim(),
    updated_at: String(row[I_COL.UPDATED] || '').trim(),
  };
}

function _insurance_getEntries() {
  const sh = _insuranceSheet();
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  return vals.slice(1).filter(r => r[0]).map(_insurance_rowToObj);
}

function _insurance_payloadToRow(body, existingId) {
  const now = new Date().toISOString();
  return [
    existingId || Utilities.getUuid(),
    String(body.policy_type || '').trim().toLowerCase() || 'life',
    String(body.plan_name || '').trim(),
    String(body.insurer || '').trim(),
    String(body.app_uuid || '').trim(),
    String(body.policy_number || '').trim(),
    String(body.policy_owner || '').trim(),
    Number(body.premium_amount) || 0,
    String(body.premium_mode || '').trim(),
    String(body.payment_method || '').trim(),
    String(body.issue_date || '').trim(),
    String(body.maturity_date || '').trim(),
    Number(body.sum_assured) || 0,
    Number(body.cash_value) || 0,
    String(body.nominee_name || '').trim(),
    String(body.notes || '').trim(),
    now,
  ];
}

function _insurance_addEntry(body) {
  const sh = _insuranceSheet();
  const id = Utilities.getUuid();
  sh.appendRow(_insurance_payloadToRow(body, id));
  return id;
}

function _insurance_updateEntry(body) {
  const sh = _insuranceSheet();
  const id = String(body.id || '').trim();
  if (!id) throw new Error('Missing id');
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '') === id);
  if (rowIdx === -1) throw new Error('Insurance policy not found');
  sh.getRange(rowIdx + 1, 1, 1, I_HDR.length).setValues([_insurance_payloadToRow(body, id)]);
  return true;
}

function _insurance_deleteEntry(id) {
  const sh = _insuranceSheet();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '') === id);
  if (rowIdx === -1) throw new Error('Insurance policy not found');
  sh.deleteRow(rowIdx + 1);
  return true;
}
