/* שכבת הנתונים: קריאה וכתיבה ל-localStorage, CRUD, ונגזרות מחושבות. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;

  var STORAGE_KEY = 'cadets-management';
  var SCHEMA_VERSION = 1;

  /* ספי ההתרעה מהאפיון. מרוכזים כאן כדי שיהיה מקום אחד לשנות בו. */
  var THRESHOLDS = {
    dueSoonDays: 7,      /* משימה "מתקרבת" */
    staleTaskDays: 14,   /* משימה "תקועה" — פתוחה וללא עדכון */
    contactDays: 14      /* "לא נפגשנו מזמן" — לשני סוגי הצוערים */
  };

  var CADET_TYPES = [
    { value: 'personal', label: 'אישי' },
    { value: 'officer', label: 'קצינותי' }
  ];

  var TASK_STATUSES = [
    { value: 'open', label: 'פתוחה' },
    { value: 'in_progress', label: 'בעבודה' },
    { value: 'review', label: 'ממתינה לבדיקה' },
    { value: 'done', label: 'הושלמה' },
    { value: 'cancelled', label: 'בוטלה' }
  ];
  var CLOSED_STATUSES = ['done', 'cancelled'];

  var PRIORITIES = [
    { value: 'high', label: 'גבוהה' },
    { value: 'medium', label: 'בינונית' },
    { value: 'low', label: 'נמוכה' }
  ];
  var PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  var SENTIMENTS = [
    { value: 'good', label: 'טובה' },
    { value: 'ok', label: 'סבירה' },
    { value: 'concern', label: 'מדאיגה' }
  ];

  var TONES = [
    { value: 'positive', label: 'חיובי' },
    { value: 'neutral', label: 'ניטרלי' },
    { value: 'negative', label: 'שלילי' }
  ];

  var GOAL_STATUSES = [
    { value: 'active', label: 'פעיל' },
    { value: 'achieved', label: 'הושג' },
    { value: 'cancelled', label: 'בוטל' }
  ];

  function blankData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      cadets: [],
      tasks: [],
      meetings: [],
      groupMeetings: [],
      notes: [],
      goals: [],
      categories: ['מקצועי', 'אישי', 'מנהלתי'],
      settings: { typeFilter: 'all' }
    };
  }

  var data = blankData();
  var listeners = [];
  var storageAvailable = true;

  /* משלים שדות חסרים כדי שקובץ ישן או חלקי לא יפיל את המערכת. */
  function normalize(raw) {
    var base = blankData();
    if (!raw || typeof raw !== 'object') return base;
    ['cadets', 'tasks', 'meetings', 'groupMeetings', 'notes', 'goals'].forEach(function (key) {
      if (Array.isArray(raw[key])) base[key] = raw[key];
    });
    if (Array.isArray(raw.categories) && raw.categories.length) base.categories = raw.categories;
    if (raw.settings && typeof raw.settings === 'object') {
      base.settings = Object.assign(base.settings, raw.settings);
    }
    base.groupMeetings.forEach(function (meeting) {
      if (!Array.isArray(meeting.entries)) meeting.entries = [];
    });
    return base;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      data = normalize(raw ? JSON.parse(raw) : null);
    } catch (err) {
      /* דפדפן שחוסם אחסון, או קובץ פגום — עובדים בזיכרון ומזהירים במסך ההגדרות. */
      storageAvailable = false;
      data = blankData();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      storageAvailable = true;
    } catch (err) {
      storageAvailable = false;
    }
  }

  function emit() {
    persist();
    listeners.forEach(function (fn) { fn(); });
  }

  /* ===== גישה לנתונים ===== */

  var store = {
    THRESHOLDS: THRESHOLDS,
    CADET_TYPES: CADET_TYPES,
    TASK_STATUSES: TASK_STATUSES,
    CLOSED_STATUSES: CLOSED_STATUSES,
    PRIORITIES: PRIORITIES,
    SENTIMENTS: SENTIMENTS,
    TONES: TONES,
    GOAL_STATUSES: GOAL_STATUSES,

    init: load,
    /* קריאה מחדש מהאחסון — לסנכרון כשלשונית אחרת של המערכת שמרה נתונים. */
    reload: function () {
      load();
      listeners.forEach(function (fn) { fn(); });
    },
    STORAGE_KEY: STORAGE_KEY,
    subscribe: function (fn) { listeners.push(fn); },
    isStorageAvailable: function () { return storageAvailable; },

    all: function () { return data; },
    categories: function () { return data.categories.slice(); },
    setCategories: function (list) { data.categories = list; emit(); },

    getSetting: function (key) { return data.settings[key]; },
    setSetting: function (key, value) { data.settings[key] = value; emit(); },

    /* ===== תוויות ===== */
    label: function (collection, value) {
      var list = { type: CADET_TYPES, status: TASK_STATUSES, priority: PRIORITIES,
                   sentiment: SENTIMENTS, tone: TONES, goalStatus: GOAL_STATUSES }[collection] || [];
      var found = util.byId(list.map(function (o) { return { id: o.value, label: o.label }; }), value);
      return found ? found.label : '';
    },

    /* ===== צוערים ===== */
    cadets: function (options) {
      var opts = options || {};
      return data.cadets.filter(function (cadet) {
        if (opts.type && opts.type !== 'all' && cadet.type !== opts.type) return false;
        if (opts.activeOnly && cadet.active === false) return false;
        return true;
      }).sort(function (a, b) { return a.name.localeCompare(b.name, 'he'); });
    },
    cadet: function (id) { return util.byId(data.cadets, id); },
    cadetName: function (id) {
      var cadet = store.cadet(id);
      return cadet ? cadet.name : 'צוער שנמחק';
    },
    saveCadet: function (cadet) {
      var existing = cadet.id ? store.cadet(cadet.id) : null;
      if (existing) {
        Object.assign(existing, cadet);
      } else {
        cadet.id = util.uid();
        cadet.createdAt = util.now();
        if (cadet.active === undefined) cadet.active = true;
        data.cadets.push(cadet);
      }
      emit();
      return cadet.id;
    },
    deleteCadet: function (id) {
      data.cadets = data.cadets.filter(function (c) { return c.id !== id; });
      data.tasks = data.tasks.filter(function (t) { return t.cadetId !== id; });
      data.meetings = data.meetings.filter(function (m) { return m.cadetId !== id; });
      data.notes = data.notes.filter(function (n) { return n.cadetId !== id; });
      data.goals = data.goals.filter(function (g) { return g.cadetId !== id; });
      data.groupMeetings.forEach(function (meeting) {
        meeting.entries = meeting.entries.filter(function (e) { return e.cadetId !== id; });
      });
      emit();
    },

    /* ===== משימות ===== */
    tasks: function (filters) {
      var f = filters || {};
      return data.tasks.filter(function (task) {
        var cadet = store.cadet(task.cadetId);
        if (f.type && f.type !== 'all' && (!cadet || cadet.type !== f.type)) return false;
        if (f.cadetId && task.cadetId !== f.cadetId) return false;
        if (f.status && task.status !== f.status) return false;
        if (f.openOnly && CLOSED_STATUSES.indexOf(task.status) !== -1) return false;
        if (f.priority && task.priority !== f.priority) return false;
        if (f.category && task.category !== f.category) return false;
        if (f.from && task.dueDate && task.dueDate < f.from) return false;
        if (f.to && task.dueDate && task.dueDate > f.to) return false;
        return true;
      });
    },
    task: function (id) { return util.byId(data.tasks, id); },
    /* הטלה לכמה צוערים יוצרת מופע נפרד לכל אחד, מקושרים ב-groupId משותף. */
    createTasks: function (draft, cadetIds) {
      var groupId = cadetIds.length > 1 ? util.uid() : null;
      var stamp = util.now();
      cadetIds.forEach(function (cadetId) {
        data.tasks.push({
          id: util.uid(),
          groupId: groupId,
          cadetId: cadetId,
          title: draft.title,
          description: draft.description || '',
          priority: draft.priority || 'medium',
          category: draft.category || '',
          dueDate: draft.dueDate || '',
          status: draft.status || 'open',
          createdAt: stamp,
          updatedAt: stamp
        });
      });
      emit();
      return groupId;
    },
    updateTask: function (id, changes) {
      var task = store.task(id);
      if (!task) return;
      Object.assign(task, changes);
      task.updatedAt = util.now();
      emit();
    },
    deleteTask: function (id) {
      data.tasks = data.tasks.filter(function (t) { return t.id !== id; });
      emit();
    },

    /* ===== פגישות אישיות ===== */
    meetings: function (filters) {
      var f = filters || {};
      return util.sortBy(data.meetings.filter(function (meeting) {
        var cadet = store.cadet(meeting.cadetId);
        if (f.type && f.type !== 'all' && (!cadet || cadet.type !== f.type)) return false;
        if (f.cadetId && meeting.cadetId !== f.cadetId) return false;
        if (f.sentiment && meeting.sentiment !== f.sentiment) return false;
        return true;
      }), function (m) { return m.date; }, 'desc');
    },
    meeting: function (id) { return util.byId(data.meetings, id); },
    saveMeeting: function (meeting) {
      var existing = meeting.id ? store.meeting(meeting.id) : null;
      if (existing) {
        Object.assign(existing, meeting);
      } else {
        meeting.id = util.uid();
        meeting.createdAt = util.now();
        data.meetings.push(meeting);
      }
      emit();
      return meeting.id;
    },
    deleteMeeting: function (id) {
      data.meetings = data.meetings.filter(function (m) { return m.id !== id; });
      emit();
    },

    /* ===== מפגשי קצינות ===== */
    groupMeetings: function () {
      return util.sortBy(data.groupMeetings, function (m) { return m.date; }, 'desc');
    },
    groupMeeting: function (id) { return util.byId(data.groupMeetings, id); },
    saveGroupMeeting: function (meeting) {
      var existing = meeting.id ? store.groupMeeting(meeting.id) : null;
      if (existing) {
        Object.assign(existing, meeting);
      } else {
        meeting.id = util.uid();
        meeting.createdAt = util.now();
        data.groupMeetings.push(meeting);
      }
      emit();
      return meeting.id;
    },
    deleteGroupMeeting: function (id) {
      data.groupMeetings = data.groupMeetings.filter(function (m) { return m.id !== id; });
      emit();
    },
    /* רישומי ההצגה של צוער מסוים, כאילו היו פגישות אישיות. נעדרים אינם נכללים. */
    presentationsFor: function (cadetId) {
      var result = [];
      data.groupMeetings.forEach(function (meeting) {
        meeting.entries.forEach(function (entry) {
          if (entry.cadetId === cadetId && !entry.absent) {
            result.push(Object.assign({}, entry, {
              groupMeetingId: meeting.id,
              date: meeting.date
            }));
          }
        });
      });
      return util.sortBy(result, function (e) { return e.date; }, 'desc');
    },

    /* ===== הערות שוטפות ===== */
    notes: function (cadetId) {
      return util.sortBy(data.notes.filter(function (n) {
        return !cadetId || n.cadetId === cadetId;
      }), function (n) { return n.date; }, 'desc');
    },
    note: function (id) { return util.byId(data.notes, id); },
    saveNote: function (note) {
      var existing = note.id ? store.note(note.id) : null;
      if (existing) {
        Object.assign(existing, note);
      } else {
        note.id = util.uid();
        note.createdAt = util.now();
        data.notes.push(note);
      }
      emit();
      return note.id;
    },
    deleteNote: function (id) {
      data.notes = data.notes.filter(function (n) { return n.id !== id; });
      emit();
    },

    /* ===== יעדים אישיים ===== */
    goals: function (cadetId) {
      return util.sortBy(data.goals.filter(function (g) {
        return !cadetId || g.cadetId === cadetId;
      }), function (g) { return g.targetDate; });
    },
    goal: function (id) { return util.byId(data.goals, id); },
    saveGoal: function (goal) {
      var existing = goal.id ? store.goal(goal.id) : null;
      if (existing) {
        Object.assign(existing, goal);
        existing.updatedAt = util.now();
      } else {
        goal.id = util.uid();
        goal.createdAt = util.now();
        goal.updatedAt = goal.createdAt;
        data.goals.push(goal);
      }
      emit();
      return goal.id;
    },
    deleteGoal: function (id) {
      data.goals = data.goals.filter(function (g) { return g.id !== id; });
      emit();
    },

    /* ===== נגזרות ===== */

    isOpen: function (task) { return CLOSED_STATUSES.indexOf(task.status) === -1; },

    /* משימה משויכת לקבוצה אחת בלבד — הדחופה מבין אלו שהיא עונה עליהן. */
    attentionBucket: function (task) {
      if (!store.isOpen(task)) return null;
      var today = util.today();
      if (task.dueDate && task.dueDate < today) return 'overdue';
      if (task.dueDate) {
        var daysLeft = util.dayDiff(today, task.dueDate);
        if (daysLeft !== null && daysLeft <= THRESHOLDS.dueSoonDays) return 'soon';
      }
      var idleDays = util.daysSince((task.updatedAt || task.createdAt || '').slice(0, 10));
      if (idleDays !== null && idleDays >= THRESHOLDS.staleTaskDays) return 'stale';
      return null;
    },

    /* משימות הדורשות טיפול, מקובצות ומסודרות לפי דחיפות. */
    attentionGroups: function (type) {
      var groups = { overdue: [], soon: [], stale: [] };
      store.tasks({ type: type, openOnly: true }).forEach(function (task) {
        var bucket = store.attentionBucket(task);
        if (bucket) groups[bucket].push(task);
      });
      groups.overdue = util.sortBy(groups.overdue, function (t) { return t.dueDate; });
      groups.soon = util.sortBy(groups.soon, function (t) { return t.dueDate; });
      groups.stale = util.sortBy(groups.stale, function (t) { return t.updatedAt; });
      return groups;
    },

    /* התיעוד האישי האחרון של צוער: פגישה אישית, או המפגש האחרון שבו הציג בפועל. */
    lastContact: function (cadet) {
      if (!cadet) return null;
      var record = null;
      if (cadet.type === 'officer') {
        record = store.presentationsFor(cadet.id)[0] || null;
        if (record) record = { date: record.date, sentiment: record.sentiment, kind: 'presentation' };
      } else {
        var meetings = store.meetings({ cadetId: cadet.id });
        if (meetings.length) {
          record = { date: meetings[0].date, sentiment: meetings[0].sentiment, kind: 'meeting' };
        }
      }
      if (!record) return null;
      record.daysAgo = util.daysSince(record.date);
      record.isStale = record.daysAgo !== null && record.daysAgo >= THRESHOLDS.contactDays;
      return record;
    },

    /* שורת התקציר של צוער במסך הבית. */
    cadetSummary: function (cadet) {
      var open = store.tasks({ cadetId: cadet.id, openOnly: true });
      var today = util.today();
      return {
        openTasks: open.length,
        overdueTasks: open.filter(function (t) {
          return t.dueDate && t.dueDate < today;
        }).length,
        activeGoals: store.goals(cadet.id).filter(function (g) { return g.status === 'active'; }).length,
        lastContact: store.lastContact(cadet)
      };
    },

    /* אירועי הצוער ברצף כרונולוגי אחד, לציר הזמן שבכרטיס. */
    timeline: function (cadetId) {
      var events = [];
      var cadet = store.cadet(cadetId);
      if (!cadet) return events;

      store.tasks({ cadetId: cadetId }).forEach(function (task) {
        events.push({
          date: (task.createdAt || '').slice(0, 10),
          kind: 'task',
          title: 'משימה הוטלה: ' + task.title,
          detail: task.dueDate ? 'יעד: ' + util.formatDate(task.dueDate) : '',
          status: task.status
        });
      });
      store.meetings({ cadetId: cadetId }).forEach(function (meeting) {
        events.push({
          date: meeting.date,
          kind: 'meeting',
          title: 'פגישה אישית',
          detail: meeting.topics || meeting.freeText || '',
          sentiment: meeting.sentiment
        });
      });
      store.presentationsFor(cadetId).forEach(function (entry) {
        events.push({
          date: entry.date,
          kind: 'presentation',
          title: 'הצגה במפגש קצינות',
          detail: entry.presented || entry.freeText || '',
          sentiment: entry.sentiment
        });
      });
      store.notes(cadetId).forEach(function (note) {
        events.push({
          date: note.date,
          kind: 'note',
          title: 'הערה שוטפת',
          detail: note.text,
          tone: note.tone
        });
      });
      store.goals(cadetId).forEach(function (goal) {
        events.push({
          date: (goal.createdAt || '').slice(0, 10),
          kind: 'goal',
          title: 'יעד אישי נקבע: ' + goal.title,
          detail: goal.targetDate ? 'יעד: ' + util.formatDate(goal.targetDate) : ''
        });
      });

      return util.sortBy(events, function (e) { return e.date; }, 'desc');
    },

    /* ===== גיבוי ===== */
    exportJSON: function () { return JSON.stringify(data, null, 2); },
    importJSON: function (text) {
      var parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('הקובץ אינו קובץ גיבוי תקין');
      if (!Array.isArray(parsed.cadets)) throw new Error('הקובץ אינו קובץ גיבוי של מערכת ניהול הצוערים');
      data = normalize(parsed);
      emit();
    },
    replaceAll: function () { data = blankData(); emit(); }
  };

  store.PRIORITY_ORDER = PRIORITY_ORDER;
  App.store = store;
})(window.App);
