/* עזרי תאריכים, טקסט ו-DOM. נטען ראשון ומוגש לשאר הקבצים דרך App.util. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var HE_MONTH_MS = 86400000;

  var util = {
    uid: function () {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    },

    /* --- תאריכים: מיוצגים כ-"YYYY-MM-DD" ונקראים תמיד באזור הזמן המקומי --- */
    toISODate: function (date) {
      return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
    },

    today: function () { return util.toISODate(new Date()); },

    now: function () { return new Date().toISOString(); },

    parseDate: function (iso) {
      if (!iso) return null;
      var parts = String(iso).slice(0, 10).split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return null;
      return new Date(parts[0], parts[1] - 1, parts[2]);
    },

    /* מספר הימים השלמים מ-from ל-to. חיובי = to מאוחר יותר. */
    dayDiff: function (fromISO, toISO) {
      var a = util.parseDate(fromISO), b = util.parseDate(toISO);
      if (!a || !b) return null;
      return Math.round((b - a) / HE_MONTH_MS);
    },

    /* כמה ימים עברו מאז תאריך נתון עד היום. */
    daysSince: function (iso) { return util.dayDiff(iso, util.today()); },

    formatDate: function (iso) {
      var d = util.parseDate(iso);
      if (!d) return '';
      return String(d.getDate()).padStart(2, '0') + '/' +
        String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    },

    /* "היום" / "אתמול" / "לפני 5 ימים" / "בעוד 3 ימים" */
    relativeDays: function (iso) {
      var diff = util.daysSince(iso);
      if (diff === null) return '';
      if (diff === 0) return 'היום';
      if (diff === 1) return 'אתמול';
      if (diff === -1) return 'מחר';
      if (diff > 1) return 'לפני ' + util.days(diff);
      return 'בעוד ' + util.days(-diff);
    },

    days: function (n) { return n === 1 ? 'יום אחד' : n + ' ימים'; },

    plural: function (n, one, many) { return n === 1 ? one : n + ' ' + many; },

    escape: function (value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /* טקסט רב-שורתי בתוך HTML, עם שמירה על שבירות שורה. */
    escapeMultiline: function (value) {
      return util.escape(value).replace(/\n/g, '<br>');
    },

    sortBy: function (list, keyFn, direction) {
      var dir = direction === 'desc' ? -1 : 1;
      return list.slice().sort(function (a, b) {
        var ka = keyFn(a), kb = keyFn(b);
        if (ka === kb) return 0;
        /* ערכים ריקים תמיד בסוף, ללא קשר לכיוון המיון */
        if (ka === null || ka === undefined || ka === '') return 1;
        if (kb === null || kb === undefined || kb === '') return -1;
        return ka < kb ? -dir : dir;
      });
    },

    byId: function (list, id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },

    /* ===== תקופות של יעד שוטף =====
       תקופה מיוצגת כמפתח: יום ושבוע כ-"YYYY-MM-DD" (שבוע לפי יום ראשון שלו),
       חודש כ-"YYYY-MM". */
    periodKey: function (frequency, iso) {
      var day = iso || util.today();
      if (frequency === 'monthly') return day.slice(0, 7);
      var date = util.parseDate(day);
      if (!date) return '';
      if (frequency === 'weekly') {
        /* השבוע נפתח ביום ראשון, כמקובל בלוח השנה הישראלי. */
        date.setDate(date.getDate() - date.getDay());
      }
      return util.toISODate(date);
    },

    shiftPeriod: function (frequency, key, delta) {
      if (frequency === 'monthly') {
        var parts = key.split('-').map(Number);
        return util.toISODate(new Date(parts[0], parts[1] - 1 + delta, 1)).slice(0, 7);
      }
      var date = util.parseDate(key);
      if (!date) return key;
      date.setDate(date.getDate() + delta * (frequency === 'weekly' ? 7 : 1));
      return util.toISODate(date);
    },

    /* התקופות האחרונות, מהישנה לחדשה, כשהאחרונה היא התקופה הנוכחית. */
    recentPeriods: function (frequency, count) {
      var current = util.periodKey(frequency);
      var list = [];
      for (var i = count - 1; i >= 0; i--) list.push(util.shiftPeriod(frequency, current, -i));
      return list;
    },

    periodLabel: function (frequency, key) {
      if (frequency === 'monthly') {
        var parts = key.split('-');
        return parts[1] + '/' + parts[0];
      }
      if (frequency === 'weekly') return 'השבוע שמתחיל ב-' + util.formatDate(key);
      return util.formatDate(key);
    },

    downloadFile: function (filename, content, mime) {
      var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    },

    /* CSV עם BOM כדי שאקסל יזהה עברית ב-UTF-8 */
    toCSV: function (headers, rows) {
      var esc = function (v) {
        var s = v === null || v === undefined ? '' : String(v);
        return '"' + s.replace(/"/g, '""') + '"';
      };
      var lines = [headers.map(esc).join(',')];
      rows.forEach(function (row) { lines.push(row.map(esc).join(',')); });
      return '﻿' + lines.join('\r\n');
    }
  };

  App.util = util;
})(window.App);
