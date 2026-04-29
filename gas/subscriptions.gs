// ── SUBSCRIPTIONS MODULE ─────────────────────────────────────────────────────
//
// Spreadsheet : FinanceTrackerAssets
// Sheet       : Subscriptions
// Columns     : ID | Name | Category | Amount | Currency | Billing Cycle | Start Date | End Date | AutoPay | Status | Payment Method | App UUID | Notes | Updated At

const SUB_SHEET = 'Subscriptions';
const SUB_HDR = ['ID', 'Name', 'Category', 'Amount', 'Currency', 'Billing Cycle', 'Start Date', 'End Date', 'AutoPay', 'Status', 'Payment Method', 'App UUID', 'Notes', 'Updated At'];
const SUB_COL = {
  ID: 0,
  NAME: 1,
  CATEGORY: 2,
  AMOUNT: 3,
  CURRENCY: 4,
  CYCLE: 5,
  START_DATE: 6,
  END_DATE: 7,
  AUTOPAY: 8,
  STATUS: 9,
  PAYMENT: 10,
  APP_UUID: 11,
  NOTES: 12,
  UPDATED: 13,
};
const SUB_CACHE = CacheService.getScriptCache();
const SUB_CACHE_KEY = 'subscriptions_entries';

function _subscriptionsHandleGet(action) {
  if (action === 'getEntries') return _subscriptions_getEntries();
  throw new Error('Unknown subscriptions GET action: ' + action);
}

function _subscriptionsHandlePost(action, body) {
  if (action === 'addEntry') return _subscriptions_addEntry(body);
  if (action === 'updateEntry') return _subscriptions_updateEntry(body);
  if (action === 'deleteEntry') return _subscriptions_deleteEntry(String(body.id || ''));
  throw new Error('Unknown subscriptions POST action: ' + action);
}

function _subscriptionsSheet() {
  const ss = SpreadsheetApp.openById(_getSpreadsheetId('ASSETS_SHEET_ID'));
  let sh = ss.getSheetByName(SUB_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SUB_SHEET);
    sh.appendRow(SUB_HDR);
  }
  _subscriptionsEnsureHeader(sh);
  return sh;
}

function _subscriptionsEnsureHeader(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(SUB_HDR);
    return;
  }
  try {
    const firstRow = sh.getRange(1, 1, 1, SUB_HDR.length).getValues()[0];
    const isHeader = SUB_HDR.every((col, i) => String(firstRow[i] || '').trim() === col);
    if (!isHeader) Logger.log('_subscriptionsEnsureHeader: header mismatch, preserving data');
  } catch (e) {
    Logger.log('_subscriptionsEnsureHeader ERROR: ' + e.message);
  }
}

function _subscriptions_getEntries() {
  const cached = SUB_CACHE.get(SUB_CACHE_KEY);
  const vals = cached ? JSON.parse(cached) : _subscriptionsSheet().getDataRange().getValues();
  if (!cached) SUB_CACHE.put(SUB_CACHE_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  return vals.slice(1).filter(r => r[0]).map(_subscriptions_rowToObj);
}

function _subscriptions_rowToObj(row) {
  return {
    id: String(row[SUB_COL.ID] || '').trim(),
    name: String(row[SUB_COL.NAME] || '').trim(),
    category: String(row[SUB_COL.CATEGORY] || '').trim(),
    amount: Number(row[SUB_COL.AMOUNT]) || 0,
    currency: String(row[SUB_COL.CURRENCY] || '').trim() || 'INR',
    billing_cycle: String(row[SUB_COL.CYCLE] || '').trim() || 'monthly',
    start_date: _fmtDate(row[SUB_COL.START_DATE]),
    end_date: _fmtDate(row[SUB_COL.END_DATE]),
    autopay: String(row[SUB_COL.AUTOPAY] || '').trim().toLowerCase() === 'true',
    status: String(row[SUB_COL.STATUS] || '').trim() || 'active',
    payment_method: String(row[SUB_COL.PAYMENT] || '').trim(),
    app_uuid: String(row[SUB_COL.APP_UUID] || '').trim(),
    notes: String(row[SUB_COL.NOTES] || '').trim(),
    updated_at: String(row[SUB_COL.UPDATED] || '').trim(),
  };
}

function _subscriptionsToDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function _subscriptionsFmtDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _subscriptionsComputeEndDate(startDate, billingCycle) {
  const cycle = String(billingCycle || '').trim().toLowerCase();
  const result = new Date(startDate.getTime());
  if (cycle === 'yearly') {
    result.setFullYear(result.getFullYear() + 1);
  } else {
    result.setMonth(result.getMonth() + 1);
  }
  return result;
}

function _subscriptions_validateAppUuid(appUuid) {
  const normalized = String(appUuid || '').trim();
  if (!normalized) return;
  const apps = _vault_getApps();
  const exists = apps.some(app => String(app.app_uuid || '').trim() === normalized);
  if (!exists) throw new Error('Invalid app_uuid: linked app not found in Vault Apps');
}

function _subscriptions_payloadToRow(body, existingId) {
  const appUuid = String(body.app_uuid || '').trim();
  _subscriptions_validateAppUuid(appUuid);
  const startDate = _subscriptionsToDate(body.start_date);
  if (!startDate) throw new Error('start_date is required (yyyy-mm-dd)');
  const endDate = _subscriptionsComputeEndDate(startDate, body.billing_cycle);
  return [
    existingId || Utilities.getUuid(),
    String(body.name || '').trim(),
    String(body.category || '').trim(),
    Number(body.amount) || 0,
    String(body.currency || '').trim() || 'INR',
    String(body.billing_cycle || '').trim() || 'monthly',
    _subscriptionsFmtDate(startDate),
    _subscriptionsFmtDate(endDate),
    String(body.autopay === true || body.autopay === 'true'),
    String(body.status || '').trim() || 'active',
    String(body.payment_method || '').trim(),
    appUuid,
    String(body.notes || '').trim(),
    new Date().toISOString(),
  ];
}

function _subscriptions_addEntry(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new Error('name is required');
  const sh = _subscriptionsSheet();
  const id = Utilities.getUuid();
  sh.appendRow(_subscriptions_payloadToRow(body, id));
  SUB_CACHE.remove(SUB_CACHE_KEY);
  return id;
}

function _subscriptions_updateEntry(body) {
  const id = String(body.id || '').trim();
  if (!id) throw new Error('Missing id');
  const name = String(body.name || '').trim();
  if (!name) throw new Error('name is required');
  const sh = _subscriptionsSheet();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '').trim() === id);
  if (rowIdx === -1) throw new Error('Subscription not found');
  sh.getRange(rowIdx + 1, 1, 1, SUB_HDR.length).setValues([_subscriptions_payloadToRow(body, id)]);
  SUB_CACHE.remove(SUB_CACHE_KEY);
  return true;
}

function _subscriptions_deleteEntry(id) {
  const targetId = String(id || '').trim();
  if (!targetId) throw new Error('Missing id');
  const sh = _subscriptionsSheet();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[0] || '').trim() === targetId);
  if (rowIdx === -1) throw new Error('Subscription not found');
  sh.deleteRow(rowIdx + 1);
  SUB_CACHE.remove(SUB_CACHE_KEY);
  return true;
}
