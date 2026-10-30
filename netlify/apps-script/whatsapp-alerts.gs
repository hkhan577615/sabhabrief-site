/* Sabha Brief: WhatsApp alerts sign-ups into the Google Sheet "Sabha Brief – WhatsApp alerts".
   Set up once: open the Sheet, Extensions > Apps Script, paste this file, save, then
   Deploy > New deployment > type Web app > Execute as: Me > Who has access: Anyone > Deploy,
   and copy the Web app URL (it ends in /exec) into SHEET_URL in index.html.
   The home page posts {whatsapp, page, bot-field} here; numbers already in the sheet are skipped. */
function doPost(e) {
  var p = (e && e.parameter) || {};
  var num = String(p.whatsapp || '').trim();
  if (p['bot-field'] || !/^\+?[0-9 ()\-]{9,18}$/.test(num)) return ContentService.createTextOutput('ignored');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var key = num.replace(/[^0-9]/g, '');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var have = sheet.getRange(1, 2, Math.max(sheet.getLastRow(), 1), 1).getValues();
    for (var i = 0; i < have.length; i++) {
      if (String(have[i][0]).replace(/[^0-9]/g, '') === key) return ContentService.createTextOutput('exists');
    }
    var when = Utilities.formatDate(new Date(), 'Asia/Colombo', 'yyyy-MM-dd HH:mm');
    sheet.appendRow([when, "'" + num, String(p.page || 'home').slice(0, 40)]);
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput('ok');
}
