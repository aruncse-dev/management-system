// ── PERSONS MODULE (FinTrackerVault / VAULT_SPREADSHEET_ID) ─────────────────

const P_SHEET = 'Persons';
const P_HDR = ['person_uuid', 'name', 'relation', 'dob', 'gender', 'notes', 'created_at', 'updated_at'];
const P_COL = {
  UUID: 0, NAME: 1, RELATION: 2, DOB: 3, GENDER: 4, NOTES: 5, CREATED: 6, UPDATED: 7,
};
const P_CACHE = CacheService.getScriptCache();
const P_CACHE_KEY = 'cache_persons';

function _personsSheet() {
  const ssId = _getSpreadsheetId('VAULT_SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  let sh = ss.getSheetByName(P_SHEET);
  if (!sh) {
    sh = ss.insertSheet(P_SHEET);
    sh.appendRow(P_HDR);
  }
  return sh;
}

function _personsHandleGet(action, p) {
  if (action === 'getEntries') return _persons_getEntries();
  if (action === 'getEntry') return _persons_getEntry(String(p.person_uuid || p.id || ''));
  throw new Error('Unknown persons GET action: ' + action);
}

function _personsHandlePost(action, body) {
  if (action === 'addEntry') return _persons_addEntry(body);
  if (action === 'updateEntry') return _persons_updateEntry(body);
  if (action === 'deleteEntry') return _persons_deleteEntry(String(body.person_uuid || body.id || ''));
  throw new Error('Unknown persons POST action: ' + action);
}

function _persons_rowToObj(row) {
  return {
    person_uuid: String(row[P_COL.UUID] || ''),
    name: String(row[P_COL.NAME] || '').trim(),
    relation: String(row[P_COL.RELATION] || '').trim(),
    dob: String(row[P_COL.DOB] || '').trim(),
    gender: String(row[P_COL.GENDER] || '').trim(),
    notes: String(row[P_COL.NOTES] || '').trim(),
    created_at: String(row[P_COL.CREATED] || '').trim(),
    updated_at: String(row[P_COL.UPDATED] || '').trim(),
  };
}

function _persons_getEntries() {
  const cached = P_CACHE.get(P_CACHE_KEY);
  const vals = cached ? JSON.parse(cached) : _personsSheet().getDataRange().getValues();
  if (!cached) P_CACHE.put(P_CACHE_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  return vals.slice(1).filter(r => r[P_COL.UUID]).map(_persons_rowToObj);
}

function _persons_getEntry(personUuid) {
  const rows = _persons_getEntries();
  const row = rows.find(r => r.person_uuid === personUuid);
  if (!row) throw new Error('Person not found');
  return row;
}

function _persons_payloadToRow(body, existingUuid) {
  const now = new Date().toISOString();
  const uuid = existingUuid || Utilities.getUuid();
  const created = String(body.created_at || '').trim() || now;
  return [
    uuid,
    String(body.name || '').trim(),
    String(body.relation || '').trim(),
    String(body.dob || '').trim(),
    String(body.gender || '').trim(),
    String(body.notes || '').trim(),
    created,
    now,
  ];
}

function _persons_addEntry(body) {
  const sh = _personsSheet();
  const id = Utilities.getUuid();
  sh.appendRow(_persons_payloadToRow(body, id));
  P_CACHE.remove(P_CACHE_KEY);
  return id;
}

function _persons_updateEntry(body) {
  const sh = _personsSheet();
  const id = String(body.person_uuid || body.id || '').trim();
  if (!id) throw new Error('Missing person_uuid');
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[P_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Person not found');
  const prev = vals[rowIdx];
  const created = String(prev[P_COL.CREATED] || '').trim() || new Date().toISOString();
  const merged = { created_at: created, name: body.name, relation: body.relation, dob: body.dob, gender: body.gender, notes: body.notes };
  const row = _persons_payloadToRow(merged, id);
  sh.getRange(rowIdx + 1, 1, 1, P_HDR.length).setValues([row]);
  P_CACHE.remove(P_CACHE_KEY);
  return true;
}

function _persons_deleteEntry(id) {
  const sh = _personsSheet();
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[P_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Person not found');
  sh.deleteRow(rowIdx + 1);
  P_CACHE.remove(P_CACHE_KEY);
  return true;
}
