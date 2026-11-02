/**
 * PRIMPAII'S WAY — Google Sheets bridge
 * 1) Open Extensions > Apps Script from your spreadsheet.
 * 2) Replace the editor content with this file.
 * 3) Save, Deploy > New deployment > Web app.
 *    Execute as: Me. Who has access: Anyone.
 * 4) Copy the Web app URL ending in /exec into the website Settings.
 *
 * The script creates/uses a sheet named "Primpaii Orders".
 * POST adds or updates a row by Order ID. GET ?callback=... returns rows as JSONP
 * so the website can import sheet data without a browser CORS preflight.
 */
const TAB_NAME = 'Primpaii Orders';
const HEADERS = ['Order ID','Tanggal Order','Aplikasi','Plan','User / Akun','Durasi','Nama Customer','Nama FH','Pemasukan','Pengeluaran','Diskon','Profit','Total Bersih','Status','Catatan','Updated At'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB_NAME);
  if (!sh) sh = ss.insertSheet(TAB_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}
function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const o = payload.order || {};
    if (!o.id) throw new Error('Missing order ID');
    const sh = getSheet_();
    const values = [o.id,o.date,o.app,o.plan,o.account,[o.duration,o.unit].join(' '),o.customer,o.fh,
      Number(o.income)||0,Number(o.expense)||0,Number(o.discount)||0,
      (Number(o.income)||0)-(Number(o.expense)||0)-(Number(o.discount)||0),
      (Number(o.income)||0)-(Number(o.expense)||0)-(Number(o.discount)||0),
      o.status,o.notes,o.updatedAt || new Date().toISOString()];
    const last = sh.getLastRow();
    let row = -1;
    if (last > 1) {
      const ids = sh.getRange(2,1,last-1,1).getValues().flat();
      const idx = ids.indexOf(o.id);
      if (idx >= 0) row = idx + 2;
    }
    if (row > 0) sh.getRange(row,1,1,values.length).setValues([values]);
    else sh.appendRow(values);
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet(e) {
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  const rows = values.length > 1 ? values.slice(1).map(r => ({
    id:String(r[0]),date:toIso_(r[1]),app:String(r[2]),plan:String(r[3]),account:String(r[4]),
    duration:parseInt(String(r[5]).split(' ')[0],10)||0,unit:unitFrom_(String(r[5])),
    customer:String(r[6]),fh:String(r[7]),income:Number(r[8])||0,expense:Number(r[9])||0,
    discount:Number(r[10])||0,status:String(r[13]||'active'),notes:String(r[14]||'')
  })) : [];
  const data = JSON.stringify({ok:true,orders:rows});
  const callback = (e.parameter && e.parameter.callback || '').replace(/[^\w.$]/g,'');
  if (callback) return ContentService.createTextOutput(callback+'('+data+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(data).setMimeType(ContentService.MimeType.JSON);
}
function toIso_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const s=String(v||''); return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:s;
}
function unitFrom_(s) {
  const u=s.toLowerCase(); if(u.includes('minggu')||u.includes('weeks'))return 'weeks';
  if(u.includes('bulan')||u.includes('months'))return 'months'; if(u.includes('tahun')||u.includes('years'))return 'years'; return 'days';
}
