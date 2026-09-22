/* הכתבה קולית בעברית לשדות טקסט, מעל Web Speech API של הדפדפן.
   הזיהוי מתבצע אצל ספק הדפדפן (Google/Apple) ודורש חיבור לאינטרנט. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  /* הדפדפן עוצר את ההאזנה בשתיקה קצרה. מחדשים אותה כל עוד המשתמש לא לחץ עצירה,
     עם תקרה שמונעת לולאה אינסופית אם המיקרופון מפסיק לעבוד. */
  var MAX_RESTARTS = 40;

  var active = null;

  var MESSAGES = {
    'not-allowed': 'הגישה למיקרופון נחסמה. אפשר אותה בהגדרות הדפדפן לאתר הזה.',
    'service-not-allowed': 'הגישה למיקרופון נחסמה. אפשר אותה בהגדרות הדפדפן לאתר הזה.',
    'audio-capture': 'לא נמצא מיקרופון במכשיר.',
    'network': 'זיהוי הדיבור דורש חיבור לאינטרנט.'
  };

  function isSupported() { return !!Recognition; }

  function finish() {
    if (!active) return;
    active.button.classList.remove('is-recording');
    active.button.setAttribute('aria-pressed', 'false');
    active.button.title = 'הכתבה קולית';
    active = null;
  }

  function stop() {
    if (!active) return;
    active.stopping = true;
    try { active.recognition.stop(); } catch (err) { /* כבר נעצר */ }
    finish();
  }

  function start(field, button) {
    if (active) {
      var wasSameField = active.field === field;
      stop();
      /* לחיצה שנייה על אותו כפתור היא עצירה, לא התחלה מחדש. */
      if (wasSameField) return;
    }

    var recognition = new Recognition();
    recognition.lang = 'he-IL';
    recognition.interimResults = true;
    recognition.continuous = true;

    /* מה שכבר הוקלד נשמר, וההכתבה מתווספת בסופו. */
    var base = field.value ? field.value.replace(/\s+$/, '') + ' ' : '';
    var settled = '';

    active = { recognition: recognition, field: field, button: button, stopping: false, restarts: 0 };

    recognition.onresult = function (event) {
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) settled += chunk;
        else interim += chunk;
      }
      field.value = base + settled + interim;
      /* שמירה אוטומטית ומאזינים אחרים מקשיבים ל-input, לא לשינוי ישיר של value. */
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };

    recognition.onerror = function (event) {
      /* שתיקה או עצירה יזומה אינן שגיאות שצריך להטריד בהן את המשתמש. */
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (active) active.stopping = true;
      finish();
      if (App.ui) App.ui.toast(MESSAGES[event.error] || 'ההכתבה נכשלה. נסה שוב.');
    };

    recognition.onend = function () {
      if (!active || active.stopping) { finish(); return; }
      if (active.restarts < MAX_RESTARTS) {
        active.restarts++;
        try { recognition.start(); return; } catch (err) { /* נופלים לסיום */ }
      }
      finish();
    };

    try {
      recognition.start();
    } catch (err) {
      finish();
      if (App.ui) App.ui.toast('לא ניתן להפעיל את המיקרופון כרגע.');
      return;
    }

    button.classList.add('is-recording');
    button.setAttribute('aria-pressed', 'true');
    button.title = 'עצירת ההכתבה';
    field.focus();
  }

  function attach(field) {
    var wrap = document.createElement('div');
    wrap.className = 'mic-wrap' + (field.tagName === 'TEXTAREA' ? ' mic-wrap--area' : '');
    field.parentNode.insertBefore(wrap, field);
    wrap.appendChild(field);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'mic-btn';
    button.title = 'הכתבה קולית';
    button.setAttribute('aria-label', 'הכתבה קולית');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML =
      '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
        '<path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/>' +
        '<path fill="currentColor" d="M17.3 11a.9.9 0 0 0-1.8 0 3.5 3.5 0 0 1-7 0 .9.9 0 0 0-1.8 0 5.3 5.3 0 0 0 4.4 5.2V19h-2a.9.9 0 0 0 0 1.8h5.8a.9.9 0 0 0 0-1.8h-2v-2.8a5.3 5.3 0 0 0 4.4-5.2z"/>' +
      '</svg>';
    button.addEventListener('click', function () { start(field, button); });
    wrap.appendChild(button);
  }

  /* מוסיף כפתור מיקרופון לכל שדה טקסט בתוך האזור שנמסר.
     שדה עם data-no-mic מדלגים עליו — למשל מזהים שמודבקים ולא מוכתבים. */
  function decorate(root) {
    if (!isSupported() || !root) return;
    var fields = root.querySelectorAll('textarea, input[type="text"], input[type="tel"]');
    Array.prototype.forEach.call(fields, function (field) {
      if (field.dataset.mic || field.hasAttribute('data-no-mic')) return;
      field.dataset.mic = 'yes';
      attach(field);
    });
  }

  App.speech = {
    isSupported: isSupported,
    decorate: decorate,
    stop: stop
  };
})(window.App);
