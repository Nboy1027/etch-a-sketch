/* שכבת הנתונים: קריאה וכתיבה ל-localStorage, CRUD, ונגזרות מחושבות. */
window.App = window.App || {};

(function (App) {
  'use strict';

  var util = App.util;

  var STORAGE_KEY = 'cadets-management';
  /* הגדרות ששייכות למכשיר ולא לנתונים: שם המכשיר ומזהה ה-OAuth.
     הן נשמרות בנפרד ואינן חלק מהגיבוי — אחרת ייבוא מהנייד היה הופך את
     המחשב ל"iPhone" בכל גיבוי הבא. */
  var DEVICE_KEY = 'cadets-management-device';
  var SCHEMA_VERSION = 1;

  /* ספי ההתרעה מהאפיון. מרוכזים כאן כדי שיהיה מקום אחד לשנות בו. */
  var THRESHOLDS = {
    dueSoonDays: 7,      /* משימה "מתקרבת" */
    staleTaskDays: 14,   /* משימה "תקועה" — פתוחה וללא עדכון */
    contactDays: 14      /* "לא נפגשנו מזמן" — לשני סוגי הצוערים */
  };

  /* צוער יכול להחזיק בשני התפקידים בו-זמנית: גם חניך אישי וגם חניך קצינותי. */
  var CADET_ROLES = [
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

  /* ערכי רוח צה"ל, בסדר שבו הם מופיעים במסמך. הערה חיובית מזדהה עם ערך;
     הערה שלילית מתנגשת איתו. */
  var IDF_VALUES = [
    'הגנת המדינה, אזרחיה ותושביה',
    'אהבת המולדת ונאמנות למדינה',
    'כבוד האדם',
    'ממלכתיות',
    'טוהר הנשק',
    'דבקות במשימה וחתירה לניצחון',
    'אחריות',
    'מקצועיות',
    'משמעת',
    'אמינות',
    'רעות',
    'דוגמה אישית',
    'שליחות'
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

  /* יעד חד-פעמי נמדד בהשגה; יעד שוטף נמדד בהתמדה, ולכן אין לו "הושג". */
  var GOAL_KINDS = [
    { value: 'once', label: 'חד-פעמי' },
    { value: 'recurring', label: 'שוטף' }
  ];
  var RECURRING_STATUSES = [
    { value: 'active', label: 'פעיל' },
    { value: 'cancelled', label: 'הופסק' }
  ];
  var FREQUENCIES = [
    { value: 'daily', label: 'יומי' },
    { value: 'weekly', label: 'שבועי' },
    { value: 'monthly', label: 'חודשי' }
  ];
  var MARK_STATUSES = [
    { value: 'done', label: 'התקיים' },
    { value: 'missed', label: 'לא התקיים' }
  ];
  /* כמה תקופות אחורה מוצג רצף ההתמדה, לפי התדירות. */
  var STREAK_LENGTH = { daily: 10, weekly: 8, monthly: 6 };

  function blankData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      tracks: [],
      cadets: [],
      tasks: [],
      meetings: [],
      groupMeetings: [],
      trackMeetings: [],
      notes: [],
      goals: [],
      categories: ['מקצועי', 'אישי', 'מנהלתי'],
      settings: { typeFilter: 'all' }
    };
  }

  var data = blankData();
  var deviceSettings = { deviceName: '', driveClientId: '' };
  var listeners = [];
  var storageAvailable = true;
  var migrated = false;

  /* משלים שדות חסרים כדי שקובץ ישן או חלקי לא יפיל את המערכת. */
  function normalize(raw) {
    var base = blankData();
    if (!raw || typeof raw !== 'object') return base;
    ['tracks', 'cadets', 'tasks', 'meetings', 'groupMeetings', 'trackMeetings',
      'notes', 'goals'].forEach(function (key) {
      if (Array.isArray(raw[key])) base[key] = raw[key];
    });
    if (Array.isArray(raw.categories) && raw.categories.length) base.categories = raw.categories;
    if (raw.settings && typeof raw.settings === 'object') {
      base.settings = Object.assign(base.settings, raw.settings);
    }
    base.groupMeetings.forEach(function (meeting) {
      if (!Array.isArray(meeting.entries)) meeting.entries = [];
    });
    base.trackMeetings.forEach(function (meeting) {
      if (!Array.isArray(meeting.entries)) meeting.entries = [];
    });
    base.goals.forEach(function (goal) {
      if (!goal.kind) goal.kind = 'once';
      if (!goal.marks || typeof goal.marks !== 'object') goal.marks = {};
    });
    /* גיבויים מהגרסה הראשונה שמרו סוג יחיד ב-type. ממירים אותו לרשימת תפקידים. */
    migrated = false;
    base.cadets.forEach(function (cadet) {
      if (cadet.type === undefined && Array.isArray(cadet.roles) && cadet.roles.length) return;
      if (!Array.isArray(cadet.roles) || !cadet.roles.length) {
        cadet.roles = [cadet.type === 'officer' ? 'officer' : 'personal'];
      }
      delete cadet.type;
      migrated = true;
    });
    return base;
  }

  function loadDevice() {
    try {
      var raw = localStorage.getItem(DEVICE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') deviceSettings = Object.assign(deviceSettings, parsed);
    } catch (err) {
      /* אחסון חסום — נשארים עם ברירות המחדל */
    }
  }

  function persistDevice() {
    try {
      localStorage.setItem(DEVICE_KEY, JSON.stringify(deviceSettings));
    } catch (err) {
      storageAvailable = false;
    }
  }

  function load() {
    loadDevice();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      data = normalize(raw ? JSON.parse(raw) : null);
    } catch (err) {
      /* דפדפן שחוסם אחסון, או קובץ פגום — עובדים בזיכרון ומזהירים במסך ההגדרות. */
      storageAvailable = false;
      data = blankData();
    }
    /* כותבים את הצורה החדשה חזרה מיד, כך שגיבוי שייוצא אחר כך כבר יהיה מומר. */
    if (migrated) {
      migrated = false;
      persist();
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
    CADET_ROLES: CADET_ROLES,
    TASK_STATUSES: TASK_STATUSES,
    CLOSED_STATUSES: CLOSED_STATUSES,
    PRIORITIES: PRIORITIES,
    SENTIMENTS: SENTIMENTS,
    TONES: TONES,
    GOAL_STATUSES: GOAL_STATUSES,
    GOAL_KINDS: GOAL_KINDS,
    RECURRING_STATUSES: RECURRING_STATUSES,
    FREQUENCIES: FREQUENCIES,
    MARK_STATUSES: MARK_STATUSES,
    IDF_VALUES: IDF_VALUES,
    /* רשימת הערכים לבחירה בטופס, עם אפשרות לא לבחור כלל. */
    valueOptions: function () {
      return [{ value: '', label: 'ללא ערך' }].concat(IDF_VALUES.map(function (name) {
        return { value: name, label: name };
      }));
    },

    init: load,
    /* קריאה מחדש מהאחסון — לסנכרון כשלשונית אחרת של המערכת שמרה נתונים. */
    reload: function () {
      load();
      listeners.forEach(function (fn) { fn(); });
    },
    STORAGE_KEY: STORAGE_KEY,
    DEVICE_KEY: DEVICE_KEY,
    subscribe: function (fn) { listeners.push(fn); },
    isStorageAvailable: function () { return storageAvailable; },

    all: function () { return data; },
    categories: function () { return data.categories.slice(); },
    setCategories: function (list) { data.categories = list; emit(); },

    getSetting: function (key) { return data.settings[key]; },
    setSetting: function (key, value) { data.settings[key] = value; emit(); },

    /* הגדרות מכשיר — מחוץ לגיבוי, ולכן שורדות ייבוא. */
    getDevice: function (key) { return deviceSettings[key] || ''; },
    setDevice: function (key, value) {
      deviceSettings[key] = value;
      persistDevice();
    },

    /* ===== תוויות ===== */
    label: function (collection, value) {
      var list = { role: CADET_ROLES, status: TASK_STATUSES, priority: PRIORITIES,
                   sentiment: SENTIMENTS, tone: TONES, goalStatus: GOAL_STATUSES,
                   goalKind: GOAL_KINDS, frequency: FREQUENCIES,
                   mark: MARK_STATUSES }[collection] || [];
      var found = util.byId(list.map(function (o) { return { id: o.value, label: o.label }; }), value);
      return found ? found.label : '';
    },

    /* ===== קצינויות =====
       קצינות היא צוות בעולם הקצינות — סיורים, מחשוב ואמצעים וכדומה.
       הפגישות, המשימות והיעדים שלה מוגדרים לקבוצה כולה. */
    tracks: function (options) {
      var opts = options || {};
      return data.tracks.filter(function (track) {
        if (opts.activeOnly && track.active === false) return false;
        return true;
      }).sort(function (a, b) { return a.name.localeCompare(b.name, 'he'); });
    },
    track: function (id) { return util.byId(data.tracks, id); },
    trackName: function (id) {
      var track = store.track(id);
      return track ? track.name : 'קצינות שנמחקה';
    },
    saveTrack: function (track) {
      var existing = track.id ? store.track(track.id) : null;
      if (existing) {
        Object.assign(existing, track);
      } else {
        track.id = util.uid();
        track.createdAt = util.now();
        if (track.active === undefined) track.active = true;
        data.tracks.push(track);
      }
      emit();
      return track.id;
    },
    /* מחיקת קצינות אינה מוחקת את הצוערים שבה — רק משחררת אותם ממנה. */
    deleteTrack: function (id) {
      data.tracks = data.tracks.filter(function (t) { return t.id !== id; });
      data.cadets.forEach(function (cadet) {
        if (cadet.trackId === id) cadet.trackId = '';
      });
      data.tasks = data.tasks.filter(function (t) { return t.trackId !== id; });
      data.goals = data.goals.filter(function (g) { return g.trackId !== id; });
      data.trackMeetings = data.trackMeetings.filter(function (m) { return m.trackId !== id; });
      emit();
    },
    trackMembers: function (trackId, options) {
      var opts = options || {};
      return store.cadets({ activeOnly: opts.activeOnly }).filter(function (cadet) {
        return cadet.trackId === trackId && store.hasRole(cadet, 'officer');
      });
    },

    /* ===== צוערים ===== */
    hasRole: function (cadet, role) {
      return !!cadet && (cadet.roles || []).indexOf(role) !== -1;
    },
    rolesLabel: function (cadet) {
      return (cadet.roles || []).map(function (role) {
        return store.label('role', role);
      }).join(' + ');
    },
    cadets: function (options) {
      var opts = options || {};
      return data.cadets.filter(function (cadet) {
        if (opts.type && opts.type !== 'all' && !store.hasRole(cadet, opts.type)) return false;
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
      data.tasks = data.tasks.filter(function (t) { return t.trackId || t.cadetId !== id; });
      data.meetings = data.meetings.filter(function (m) { return m.cadetId !== id; });
      data.notes = data.notes.filter(function (n) { return n.cadetId !== id; });
      data.goals = data.goals.filter(function (g) { return g.trackId || g.cadetId !== id; });
      data.trackMeetings.forEach(function (meeting) {
        meeting.entries = meeting.entries.filter(function (e) { return e.cadetId !== id; });
      });
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
        /* משימת קצינות שייכת לעולם הקצינות, ולכן נכללת בסינון "קצינותיים". */
        if (f.type && f.type !== 'all') {
          if (task.trackId ? f.type !== 'officer' : !store.hasRole(cadet, f.type)) return false;
        }
        if (f.trackId && task.trackId !== f.trackId) return false;
        if (f.trackOnly && !task.trackId) return false;
        if (f.cadetOnly && task.trackId) return false;
        /* משימת קצינות היא גם משימה של כל חבר בה. */
        if (f.cadetId && task.cadetId !== f.cadetId &&
            !(task.trackId && f.includeTrack && store.cadet(f.cadetId) &&
              store.cadet(f.cadetId).trackId === task.trackId)) return false;
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
    /* משימת קצינות היא משימה אחת עם סטטוס משותף לכל הקבוצה. */
    createTrackTask: function (draft, trackId) {
      var stamp = util.now();
      data.tasks.push({
        id: util.uid(),
        trackId: trackId,
        cadetId: '',
        title: draft.title,
        description: draft.description || '',
        priority: draft.priority || 'medium',
        category: draft.category || '',
        dueDate: draft.dueDate || '',
        status: draft.status || 'open',
        createdAt: stamp,
        updatedAt: stamp
      });
      emit();
    },

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
        if (f.type && f.type !== 'all' && !store.hasRole(cadet, f.type)) return false;
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

    /* ===== פ"ע קצינות =====
       פגישה עם קצינות אחת: תוכן משותף לקבוצה, ובתוכו שורה אישית לכל חבר. */
    trackMeetings: function (trackId) {
      return util.sortBy(data.trackMeetings.filter(function (meeting) {
        return !trackId || meeting.trackId === trackId;
      }), function (m) { return m.date; }, 'desc');
    },
    trackMeeting: function (id) { return util.byId(data.trackMeetings, id); },
    saveTrackMeeting: function (meeting) {
      var existing = meeting.id ? store.trackMeeting(meeting.id) : null;
      if (existing) {
        Object.assign(existing, meeting);
      } else {
        meeting.id = util.uid();
        meeting.createdAt = util.now();
        data.trackMeetings.push(meeting);
      }
      emit();
      return meeting.id;
    },
    deleteTrackMeeting: function (id) {
      data.trackMeetings = data.trackMeetings.filter(function (m) { return m.id !== id; });
      emit();
    },
    /* השורות האישיות שנכתבו על צוער מסוים בפ"ע, לאורך הזמן. */
    trackNotesFor: function (cadetId) {
      var result = [];
      data.trackMeetings.forEach(function (meeting) {
        meeting.entries.forEach(function (entry) {
          if (entry.cadetId !== cadetId || entry.absent) return;
          if (!entry.text && !entry.sentiment) return;
          result.push(Object.assign({}, entry, {
            trackMeetingId: meeting.id,
            trackId: meeting.trackId,
            date: meeting.date
          }));
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
    goals: function (cadetId, options) {
      var opts = options || {};
      return util.sortBy(data.goals.filter(function (goal) {
        if (cadetId && (goal.cadetId !== cadetId || goal.trackId)) return false;
        if (opts.trackId && goal.trackId !== opts.trackId) return false;
        if (opts.trackOnly && !goal.trackId) return false;
        if (opts.cadetOnly && goal.trackId) return false;
        if (opts.kind && goal.kind !== opts.kind) return false;
        if (opts.type && opts.type !== 'all') {
          if (goal.trackId ? opts.type !== 'officer'
            : !store.hasRole(store.cadet(goal.cadetId), opts.type)) return false;
        }
        if (opts.activeOnly && goal.status !== 'active') return false;
        return true;
      }), function (goal) { return goal.targetDate; });
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
        if (!goal.marks) goal.marks = {};
        data.goals.push(goal);
      }
      emit();
      return goal.id;
    },
    deleteGoal: function (id) {
      data.goals = data.goals.filter(function (g) { return g.id !== id; });
      emit();
    },

    /* סימון תקופה של יעד שוטף. status ריק מוחק את הסימון. */
    markGoal: function (goalId, periodKey, status, note) {
      var goal = store.goal(goalId);
      if (!goal) return;
      if (!goal.marks) goal.marks = {};
      if (!status) {
        delete goal.marks[periodKey];
      } else {
        goal.marks[periodKey] = { status: status, note: note || '', at: util.now() };
      }
      goal.updatedAt = util.now();
      emit();
    },

    currentPeriod: function (goal) {
      return util.periodKey(goal.frequency || 'weekly');
    },

    /* רצף ההתמדה: התקופות האחרונות עם הסימון של כל אחת.
       תקופה שלא סומנה נשארת ריקה ואינה נחשבת ככישלון. */
    goalStreak: function (goal) {
      var frequency = goal.frequency || 'weekly';
      var length = STREAK_LENGTH[frequency] || 8;
      var current = util.periodKey(frequency);
      var marks = goal.marks || {};
      var periods = util.recentPeriods(frequency, length).map(function (key) {
        var mark = marks[key];
        return {
          key: key,
          status: mark ? mark.status : '',
          note: mark ? mark.note : '',
          isCurrent: key === current
        };
      });
      var done = periods.filter(function (p) { return p.status === 'done'; }).length;
      var missed = periods.filter(function (p) { return p.status === 'missed'; }).length;
      return {
        frequency: frequency,
        periods: periods,
        done: done,
        missed: missed,
        marked: done + missed,
        rate: done + missed ? Math.round((done / (done + missed)) * 100) : null,
        currentPeriod: current,
        currentMark: marks[current] || null
      };
    },

    /* יעדים שוטפים פעילים שהתקופה הנוכחית שלהם עדיין לא סומנה. */
    goalsAwaitingMark: function (type) {
      return store.goals(null, { kind: 'recurring', activeOnly: true, type: type })
        .filter(function (goal) {
          return !(goal.marks || {})[store.currentPeriod(goal)];
        });
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

    /* התיעוד האחרון של צוער, רשומה לכל תפקיד שהוא מחזיק בו: פגישה אישית
       לתפקיד האישי, והמפגש האחרון שבו הציג בפועל לתפקיד הקצינותי.
       צוער כפול מקבל שתי רשומות, כדי שפער באחד הערוצים לא ייחבא מאחורי השני. */
    contacts: function (cadet) {
      if (!cadet) return [];
      return (cadet.roles || []).map(function (role) {
        var record = { role: role, date: null, sentiment: '' };
        var source;
        if (role === 'officer') {
          /* בעולם הקצינות נחשבים שני סוגי המפגשים — ההצגה במפגש הגדול
             והשורה האישית בפ"ע. הקובע הוא המאוחר מביניהם. */
          var officerRecords = store.presentationsFor(cadet.id).map(function (r) {
            return Object.assign({}, r, { source: 'presentation' });
          }).concat(store.trackNotesFor(cadet.id).map(function (r) {
            return Object.assign({}, r, { source: 'trackMeeting' });
          }));
          source = util.sortBy(officerRecords, function (r) { return r.date; }, 'desc')[0];
        } else {
          source = store.meetings({ cadetId: cadet.id })[0];
        }
        if (source) {
          record.date = source.date;
          record.sentiment = source.sentiment;
          /* שני סוגי מפגש מזינים את התפקיד הקצינותי, ולכן נשמר איזה מהם קבע. */
          record.source = source.source || 'meeting';
        }
        record.daysAgo = record.date ? util.daysSince(record.date) : null;
        /* צוער שמעולם לא תועד נחשב חורג — הוא בדיוק מי שנוטים לשכוח. */
        record.isStale = record.daysAgo === null || record.daysAgo >= THRESHOLDS.contactDays;
        return record;
      });
    },

    /* הפער הגדול ביותר מבין ערוצי התיעוד של הצוער, למיון לפי דחיפות. */
    longestGap: function (cadet) {
      var gaps = store.contacts(cadet).map(function (record) {
        return record.daysAgo === null ? Infinity : record.daysAgo;
      });
      return gaps.length ? Math.max.apply(null, gaps) : Infinity;
    },

    /* שורת התקציר של צוער במסך הבית. */
    cadetSummary: function (cadet) {
      var open = store.tasks({ cadetId: cadet.id, openOnly: true, includeTrack: true });
      var today = util.today();
      return {
        openTasks: open.length,
        overdueTasks: open.filter(function (t) {
          return t.dueDate && t.dueDate < today;
        }).length,
        activeGoals: store.goals(cadet.id).filter(function (g) { return g.status === 'active'; }).length,
        contacts: store.contacts(cadet)
      };
    },

    trackSummary: function (track) {
      var open = store.tasks({ trackId: track.id, openOnly: true });
      var today = util.today();
      var meetings = store.trackMeetings(track.id);
      var last = meetings[0] || null;
      var daysAgo = last ? util.daysSince(last.date) : null;
      return {
        members: store.trackMembers(track.id, { activeOnly: true }).length,
        openTasks: open.length,
        overdueTasks: open.filter(function (t) { return t.dueDate && t.dueDate < today; }).length,
        activeGoals: store.goals(null, { trackId: track.id, activeOnly: true }).length,
        lastMeeting: last ? { date: last.date, sentiment: last.sentiment } : null,
        daysAgo: daysAgo,
        isStale: daysAgo === null || daysAgo >= THRESHOLDS.contactDays
      };
    },

    /* אירועי הצוער ברצף כרונולוגי אחד, לציר הזמן שבכרטיס. */
    timeline: function (cadetId) {
      var events = [];
      var cadet = store.cadet(cadetId);
      if (!cadet) return events;

      store.tasks({ cadetId: cadetId, includeTrack: true }).forEach(function (task) {
        events.push({
          date: (task.createdAt || '').slice(0, 10),
          kind: 'task',
          title: (task.trackId ? 'משימת קצינות: ' : 'משימה הוטלה: ') + task.title,
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
      store.trackNotesFor(cadetId).forEach(function (entry) {
        events.push({
          date: entry.date,
          kind: 'trackMeeting',
          title: 'פ"ע ' + store.trackName(entry.trackId),
          detail: entry.text || '',
          sentiment: entry.sentiment
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
          title: note.value
            ? (note.tone === 'negative' ? 'הערה · מתנגש עם ' : 'הערה · מזדהה עם ') + note.value
            : 'הערה שוטפת',
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
