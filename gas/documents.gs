// ── DOCUMENTS MODULE (FinTrackerVault) ──────────────────────────────────────

const D_SHEET = 'Documents';
const D_HDR = ['doc_uuid', 'person_uuid', 'doc_type', 'doc_number', 'drive_url', 'expiry', 'notes', 'created_at'];
const D_COL = {
  UUID: 0, PERSON: 1, TYPE: 2, NUMBER: 3, URL: 4, EXPIRY: 5, NOTES: 6, CREATED: 7,
};
const D_CACHE = CacheService.getScriptCache();
const D_CACHE_KEY = 'cache_documents';

function _documentsSheet() {
  const ssId = _getSpreadsheetId('VAULT_SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  let sh = ss.getSheetByName(D_SHEET);
  if (!sh) {
    sh = ss.insertSheet(D_SHEET);
    sh.appendRow(D_HDR);
  }
  return sh;
}

function _documentsHandleGet(action, p) {
  if (action === 'getEntries') return _documents_getEntries(String(p.person_uuid || '').trim());
  if (action === 'getEntry') return _documents_getEntry(String(p.doc_uuid || p.id || ''));
  throw new Error('Unknown documents GET action: ' + action);
}

function _documentsHandlePost(action, body) {
  if (action === 'addEntry') return _documents_addEntry(body);
  if (action === 'updateEntry') return _documents_updateEntry(body);
  if (action === 'deleteEntry') return _documents_deleteEntry(String(body.doc_uuid || body.id || ''));
  throw new Error('Unknown documents POST action: ' + action);
}

function _documents_rowToObj(row) {
  return {
    doc_uuid: String(row[D_COL.UUID] || ''),
    person_uuid: String(row[D_COL.PERSON] || '').trim(),
    doc_type: String(row[D_COL.TYPE] || '').trim(),
    doc_number: String(row[D_COL.NUMBER] || '').trim(),
    drive_url: String(row[D_COL.URL] || '').trim(),
    expiry: String(row[D_COL.EXPIRY] || '').trim(),
    notes: String(row[D_COL.NOTES] || '').trim(),
    created_at: String(row[D_COL.CREATED] || '').trim(),
  };
}

function _documents_getEntries(personUuidFilter) {
  const cached = D_CACHE.get(D_CACHE_KEY);
  const vals = cached ? JSON.parse(cached) : _documentsSheet().getDataRange().getValues();
  if (!cached) D_CACHE.put(D_CACHE_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  let rows = vals.slice(1).filter(r => r[D_COL.UUID]).map(_documents_rowToObj);
  if (personUuidFilter) rows = rows.filter(r => r.person_uuid === personUuidFilter);
  return rows;
}

function _documents_getEntry(docUuid) {
  const rows = _documents_getEntries('');
  const row = rows.find(r => r.doc_uuid === docUuid);
  if (!row) throw new Error('Document not found');
  return row;
}

function _documents_payloadToRow(body, existingUuid) {
  const now = new Date().toISOString();
  return [
    existingUuid || Utilities.getUuid(),
    String(body.person_uuid || '').trim(),
    String(body.doc_type || '').trim(),
    String(body.doc_number || '').trim(),
    String(body.drive_url || '').trim(),
    String(body.expiry || '').trim(),
    String(body.notes || '').trim(),
    now,
  ];
}

function _documents_addEntry(body) {
  const sh = _documentsSheet();
  const id = Utilities.getUuid();
  sh.appendRow(_documents_payloadToRow(body, id));
  D_CACHE.remove(D_CACHE_KEY);
  return id;
}

function _documents_updateEntry(body) {
  const sh = _documentsSheet();
  const id = String(body.doc_uuid || body.id || '').trim();
  if (!id) throw new Error('Missing doc_uuid');
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[D_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Document not found');
  sh.getRange(rowIdx + 1, 1, 1, D_HDR.length).setValues([_documents_payloadToRow(body, id)]);
  D_CACHE.remove(D_CACHE_KEY);
  return true;
}

function _documents_deleteEntry(id) {
  const sh = _documentsSheet();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[D_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Document not found');
  sh.deleteRow(rowIdx + 1);
  D_CACHE.remove(D_CACHE_KEY);
  return true;
}
