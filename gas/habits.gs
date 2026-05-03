// ── HABITS MODULE (FinTrackerVault) ─────────────────────────────────────────

const HB_SHEET = 'Habits';
const HB_HDR = ['habit_uuid', 'person_uuid', 'name', 'category', 'target_frequency', 'created_at'];
const HB_COL = { UUID: 0, PERSON: 1, NAME: 2, CAT: 3, TARGET: 4, CREATED: 5 };

const HL_SHEET = 'HabitLogs';
const HL_HDR = ['log_uuid', 'habit_uuid', 'person_uuid', 'log_date', 'completed'];
const HL_COL = { UUID: 0, HABIT: 1, PERSON: 2, DAY: 3, DONE: 4 };

const HB_CACHE = CacheService.getScriptCache();
const HB_KEY = 'cache_habits';
const HL_KEY = 'cache_habit_logs';

function _habitsVaultSs() {
  return SpreadsheetApp.openById(_getSpreadsheetId('VAULT_SPREADSHEET_ID'));
}

function _habitsEnsureSheet(name, hdr) {
  const ss = _habitsVaultSs();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(hdr);
  }
  return sh;
}

function _habitsHandleGet(action, p) {
  if (action === 'getHabits') return _habits_getHabits(String(p.person_uuid || '').trim());
  if (action === 'getHabitLogs') {
    return _habits_getHabitLogs(
      String(p.habit_uuid || '').trim(),
      String(p.person_uuid || '').trim(),
      String(p.from || '').trim(),
      String(p.to || '').trim()
    );
  }
  throw new Error('Unknown habits GET action: ' + action);
}

function _habitsHandlePost(action, body) {
  if (action === 'addHabit') return _habits_addHabit(body);
  if (action === 'updateHabit') return _habits_updateHabit(body);
  if (action === 'deleteHabit') return _habits_deleteHabit(String(body.habit_uuid || body.id || ''));
  if (action === 'logHabit') return _habits_logHabit(body);
  throw new Error('Unknown habits POST action: ' + action);
}

function _hbRow(row) {
  return {
    habit_uuid: String(row[HB_COL.UUID] || ''),
    person_uuid: String(row[HB_COL.PERSON] || '').trim(),
    name: String(row[HB_COL.NAME] || '').trim(),
    category: String(row[HB_COL.CAT] || '').trim(),
    target_frequency: String(row[HB_COL.TARGET] || '').trim(),
    created_at: String(row[HB_COL.CREATED] || '').trim(),
  };
}

function _habits_getHabits(personFilter) {
  const cached = HB_CACHE.get(HB_KEY);
  const vals = cached ? JSON.parse(cached) : _habitsEnsureSheet(HB_SHEET, HB_HDR).getDataRange().getValues();
  if (!cached) HB_CACHE.put(HB_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  let rows = vals.slice(1).filter(r => r[HB_COL.UUID]).map(_hbRow);
  if (personFilter) rows = rows.filter(r => r.person_uuid === personFilter);
  return rows;
}

function _habits_addHabit(body) {
  const sh = _habitsEnsureSheet(HB_SHEET, HB_HDR);
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  sh.appendRow([
    id,
    String(body.person_uuid || '').trim(),
    String(body.name || '').trim(),
    String(body.category || '').trim(),
    String(body.target_frequency || '').trim(),
    now,
  ]);
  HB_CACHE.remove(HB_KEY);
  return id;
}

function _habits_updateHabit(body) {
  const sh = _habitsEnsureSheet(HB_SHEET, HB_HDR);
  const id = String(body.habit_uuid || body.id || '').trim();
  if (!id) throw new Error('Missing habit_uuid');
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[HB_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Habit not found');
  const prev = vals[rowIdx];
  const created = String(prev[HB_COL.CREATED] || '').trim() || new Date().toISOString();
  sh.getRange(rowIdx + 1, 1, 1, HB_HDR.length).setValues([[
    id,
    String(body.person_uuid || '').trim(),
    String(body.name || '').trim(),
    String(body.category || '').trim(),
    String(body.target_frequency || '').trim(),
    created,
  ]]);
  HB_CACHE.remove(HB_KEY);
  return true;
}

function _habits_deleteHabit(id) {
  const sh = _habitsEnsureSheet(HB_SHEET, HB_HDR);
  const vals = sh.getDataRange().getValues();
  const rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[HB_COL.UUID] || '') === id);
  if (rowIdx === -1) throw new Error('Habit not found');
  sh.deleteRow(rowIdx + 1);
  HB_CACHE.remove(HB_KEY);
  const logSh = _habitsEnsureSheet(HL_SHEET, HL_HDR);
  let logVals = logSh.getDataRange().getValues();
  for (let i = logVals.length - 1; i >= 1; i--) {
    if (String(logVals[i][HL_COL.HABIT] || '') === id) {
      logSh.deleteRow(i + 1);
      logVals = logSh.getDataRange().getValues();
    }
  }
  HB_CACHE.remove(HL_KEY);
  return true;
}

function _hlRow(row) {
  return {
    log_uuid: String(row[HL_COL.UUID] || ''),
    habit_uuid: String(row[HL_COL.HABIT] || '').trim(),
    person_uuid: String(row[HL_COL.PERSON] || '').trim(),
    log_date: String(row[HL_COL.DAY] || '').trim(),
    completed: row[HL_COL.DONE] === true || String(row[HL_COL.DONE]).toLowerCase() === 'true',
  };
}

function _habits_getHabitLogs(habitUuid, personFilter, from, to) {
  const cached = HB_CACHE.get(HL_KEY);
  const vals = cached ? JSON.parse(cached) : _habitsEnsureSheet(HL_SHEET, HL_HDR).getDataRange().getValues();
  if (!cached) HB_CACHE.put(HL_KEY, JSON.stringify(vals), 300);
  if (vals.length <= 1) return [];
  let rows = vals.slice(1).filter(r => r[HL_COL.UUID]).map(_hlRow);
  if (habitUuid) rows = rows.filter(r => r.habit_uuid === habitUuid);
  if (personFilter) rows = rows.filter(r => r.person_uuid === personFilter);
  if (from) rows = rows.filter(r => String(r.log_date) >= from);
  if (to) rows = rows.filter(r => String(r.log_date) <= to);
  rows.sort(function (a, b) { return String(b.log_date).localeCompare(String(a.log_date)); });
  return rows;
}

function _habits_logHabit(body) {
  const sh = _habitsEnsureSheet(HL_SHEET, HL_HDR);
  const habitUuid = String(body.habit_uuid || '').trim();
  const personUuid = String(body.person_uuid || '').trim();
  const day = String(body.log_date || '').trim();
  if (!habitUuid || !day) throw new Error('habit_uuid and log_date required');
  const vals = sh.getDataRange().getValues();
  const done = body.completed === true || body.completed === 'true';
  let rowIdx = vals.findIndex((r, idx) => idx > 0 && String(r[HL_COL.HABIT] || '') === habitUuid && String(r[HL_COL.DAY] || '') === day);
  if (rowIdx === -1) {
    const id = Utilities.getUuid();
    sh.appendRow([id, habitUuid, personUuid, day, done]);
  } else {
    const id = String(vals[rowIdx][HL_COL.UUID] || Utilities.getUuid());
    sh.getRange(rowIdx + 1, 1, 1, HL_HDR.length).setValues([[id, habitUuid, personUuid, day, done]]);
  }
  HB_CACHE.remove(HL_KEY);
  return true;
}
