// ── HEALTH MODULE (FinTrackerVault): vitals, illnesses, medications ───────

const HV_SHEET = 'HealthVitals';
const HV_HDR = ['vital_uuid', 'person_uuid', 'recorded_at', 'height_cm', 'weight_kg', 'systolic', 'diastolic', 'blood_sugar', 'notes'];
const HV_COL = { UUID: 0, PERSON: 1, AT: 2, H: 3, W: 4, SYS: 5, DIA: 6, SUGAR: 7, NOTES: 8 };

const IL_SHEET = 'Illnesses';
const IL_HDR = ['illness_uuid', 'person_uuid', 'name', 'diagnosed_on', 'status', 'notes'];
const IL_COL = { UUID: 0, PERSON: 1, NAME: 2, DX: 3, STATUS: 4, NOTES: 5 };

const MED_SHEET = 'Medications';
const MED_HDR = ['med_uuid', 'person_uuid', 'illness_uuid', 'name', 'dosage', 'frequency', 'start_date', 'end_date', 'reminder_times', 'notes'];
const MED_COL = { UUID: 0, PERSON: 1, ILL: 2, NAME: 3, DOSAGE: 4, FREQ: 5, START: 6, END: 7, REM: 8, NOTES: 9 };

const H_CACHE = CacheService.getScriptCache();
const HV_KEY = 'cache_health_vitals';
const IL_KEY = 'cache_health_illness';
const MED_KEY = 'cache_health_meds';

function _healthVaultSs() {
  return SpreadsheetApp.openById(_getSpreadsheetId('VAULT_SPREADSHEET_ID'));
}

function _healthEnsureSheet(name, hdr) {
  const ss = _healthVaultSs();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(hdr);
  }
  return sh;
}

function _healthHandleGet(action, p) {
  if (action === 'getVitals') return _health_getVitals(String(p.person_uuid || '').trim());
  if (action === 'getIllnesses') return _health_getIllnesses(String(p.person_uuid || '').trim());
  if (action === 'getMedications') return _health_getMedications(String(p.person_uuid || '').trim());
  throw new Error('Unknown health GET action: ' + action);
}

function _healthHandlePost(action, body) {
  if (action === 'addVital') return _health_addVital(body);
  if (action === 'deleteVital') return _health_deleteVital(String(body.vital_uuid || body.id || ''));
  if (action === 'addIllness') return _health_addIllness(body);
  if (action === 'updateIllness') return _health_updateIllness(body);
  if (action === 'deleteIllness') return _health_deleteIllness(String(body.illness_uuid || body.id || ''));
  if (action === 'addMedication') return _health_addMedication(body);
  if (action === 'updateMedication') return _health_updateMedication(body);
  if (action === 'deleteMedication') return _health_deleteMedication(String(body.med_uuid || body.id || ''));
  throw new Error('Unknown health POST action: ' + action);
}

function _hvRow(row) {
  return {
    vital_uuid: String(row[HV_COL.UUID] || ''),
    person_uuid: String(row[HV_COL.PERSON] || '').trim(),
    recorded_at: String(row[HV_COL.AT] || '').trim(),
    height_cm: Number(row[HV_COL.H]) || 0,
    weight_kg: Number(row[HV_COL.W]) || 0,
    systolic: Number(row[HV_COL.SYS]) || 0,
    diastolic: Number(row[HV_COL.DIA]) || 0,
    blood_sugar: Number(row[HV_COL.SUGAR]) || 0,
    notes: String(row[HV_COL.NOTES] || '').trim(),
  };
}

function _health_getVitals(personFilter) {
  const cached = H_CACHE.get(HV_KEY);
  const vals = cached ? JSON.parse(cached) : _healthEnsureSheet(HV_SHEET, HV_HDR).getDataRange().getValues();
  if (!cached) H_CACHE.put(HV_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  let rows = vals.slice(1).filter(r => r[HV_COL.UUID]).map(_hvRow);
  if (personFilter) rows = rows.filter(r => r.person_uuid === personFilter);
  rows.sort(function (a, b) {
    return String(b.recorded_at).localeCompare(String(a.recorded_at));
  });
  return rows;
}

function _health_addVital(body) {
  const sh = _healthEnsureSheet(HV_SHEET, HV_HDR);
  const id = Utilities.getUuid();
  const at = String(body.recorded_at || '').trim() || new Date().toISOString();
  sh.appendRow([
    id,
    String(body.person_uuid || '').trim(),
    at,
    Number(body.height_cm) || 0,
    Number(body.weight_kg) || 0,
    Number(body.systolic) || 0,
    Number(body.diastolic) || 0,
    Number(body.blood_sugar) || 0,
    String(body.notes || '').trim(),
  ]);
  H_CACHE.remove(HV_KEY);
  return id;
}

function _health_deleteVital(id) {
  const sh = _healthEnsureSheet(HV_SHEET, HV_HDR);
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[HV_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Vital not found');
  sh.deleteRow(rowIdx + 1);
  H_CACHE.remove(HV_KEY);
  return true;
}

function _ilRow(row) {
  return {
    illness_uuid: String(row[IL_COL.UUID] || ''),
    person_uuid: String(row[IL_COL.PERSON] || '').trim(),
    name: String(row[IL_COL.NAME] || '').trim(),
    diagnosed_on: String(row[IL_COL.DX] || '').trim(),
    status: String(row[IL_COL.STATUS] || '').trim(),
    notes: String(row[IL_COL.NOTES] || '').trim(),
  };
}

function _health_getIllnesses(personFilter) {
  const cached = H_CACHE.get(IL_KEY);
  const vals = cached ? JSON.parse(cached) : _healthEnsureSheet(IL_SHEET, IL_HDR).getDataRange().getValues();
  if (!cached) H_CACHE.put(IL_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  let rows = vals.slice(1).filter(r => r[IL_COL.UUID]).map(_ilRow);
  if (personFilter) rows = rows.filter(r => r.person_uuid === personFilter);
  return rows;
}

function _health_addIllness(body) {
  const sh = _healthEnsureSheet(IL_SHEET, IL_HDR);
  const id = Utilities.getUuid();
  sh.appendRow([
    id,
    String(body.person_uuid || '').trim(),
    String(body.name || '').trim(),
    String(body.diagnosed_on || '').trim(),
    String(body.status || 'active').trim().toLowerCase(),
    String(body.notes || '').trim(),
  ]);
  H_CACHE.remove(IL_KEY);
  return id;
}

function _health_updateIllness(body) {
  const sh = _healthEnsureSheet(IL_SHEET, IL_HDR);
  const id = String(body.illness_uuid || body.id || '').trim();
  if (!id) throw new Error('Missing illness_uuid');
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[IL_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Illness not found');
  sh.getRange(rowIdx + 1, 1, 1, IL_HDR.length).setValues([[
    id,
    String(body.person_uuid || '').trim(),
    String(body.name || '').trim(),
    String(body.diagnosed_on || '').trim(),
    String(body.status || 'active').trim().toLowerCase(),
    String(body.notes || '').trim(),
  ]]);
  H_CACHE.remove(IL_KEY);
  return true;
}

function _health_deleteIllness(id) {
  const sh = _healthEnsureSheet(IL_SHEET, IL_HDR);
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[IL_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Illness not found');
  sh.deleteRow(rowIdx + 1);
  H_CACHE.remove(IL_KEY);
  return true;
}

function _medRow(row) {
  return {
    med_uuid: String(row[MED_COL.UUID] || ''),
    person_uuid: String(row[MED_COL.PERSON] || '').trim(),
    illness_uuid: String(row[MED_COL.ILL] || '').trim(),
    name: String(row[MED_COL.NAME] || '').trim(),
    dosage: String(row[MED_COL.DOSAGE] || '').trim(),
    frequency: String(row[MED_COL.FREQ] || '').trim(),
    start_date: String(row[MED_COL.START] || '').trim(),
    end_date: String(row[MED_COL.END] || '').trim(),
    reminder_times: String(row[MED_COL.REM] || '').trim(),
    notes: String(row[MED_COL.NOTES] || '').trim(),
  };
}

function _health_getMedications(personFilter) {
  const cached = H_CACHE.get(MED_KEY);
  const vals = cached ? JSON.parse(cached) : _healthEnsureSheet(MED_SHEET, MED_HDR).getDataRange().getValues();
  if (!cached) H_CACHE.put(MED_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  let rows = vals.slice(1).filter(r => r[MED_COL.UUID]).map(_medRow);
  if (personFilter) rows = rows.filter(r => r.person_uuid === personFilter);
  return rows;
}

function _health_addMedication(body) {
  const sh = _healthEnsureSheet(MED_SHEET, MED_HDR);
  const id = Utilities.getUuid();
  sh.appendRow([
    id,
    String(body.person_uuid || '').trim(),
    String(body.illness_uuid || '').trim(),
    String(body.name || '').trim(),
    String(body.dosage || '').trim(),
    String(body.frequency || '').trim(),
    String(body.start_date || '').trim(),
    String(body.end_date || '').trim(),
    String(body.reminder_times || '').trim(),
    String(body.notes || '').trim(),
  ]);
  H_CACHE.remove(MED_KEY);
  return id;
}

function _health_updateMedication(body) {
  const sh = _healthEnsureSheet(MED_SHEET, MED_HDR);
  const id = String(body.med_uuid || body.id || '').trim();
  if (!id) throw new Error('Missing med_uuid');
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[MED_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Medication not found');
  sh.getRange(rowIdx + 1, 1, 1, MED_HDR.length).setValues([[
    id,
    String(body.person_uuid || '').trim(),
    String(body.illness_uuid || '').trim(),
    String(body.name || '').trim(),
    String(body.dosage || '').trim(),
    String(body.frequency || '').trim(),
    String(body.start_date || '').trim(),
    String(body.end_date || '').trim(),
    String(body.reminder_times || '').trim(),
    String(body.notes || '').trim(),
  ]]);
  H_CACHE.remove(MED_KEY);
  return true;
}

function _health_deleteMedication(id) {
  const sh = _healthEnsureSheet(MED_SHEET, MED_HDR);
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[MED_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Medication not found');
  sh.deleteRow(rowIdx + 1);
  H_CACHE.remove(MED_KEY);
  return true;
}
