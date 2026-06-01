/**
 * Level 1 — Introduction
 *
 * Two aircraft, five instructions, 5-minute session.
 * Designed for beginners: plenty of time between events.
 *
 * ─────────────────────────────────────────────────────────────────
 * Level format reference:
 *
 *   name        string   Displayed in the level selector
 *   description string   Shown in the log at start
 *   duration    number   Seconds until session ends
 *
 *   waypoints   object   { ID: { lat, lon, name } }
 *
 *   aircraft[]  array    Each plane:
 *     callsign  string   e.g. "ELY101"
 *     phonetic  string   How the pilot says the callsign: "El Al One Zero One"
 *     lat/lon   number   Starting position (decimal degrees)
 *     altitude  number   Starting altitude in feet
 *     speed     number   Airspeed in knots
 *     heading   number   Initial heading (degrees true, 0 = north)
 *     color     string   CSS colour for this aircraft
 *     route     string[] Waypoint IDs to follow in order
 *
 *   events[]    array    Timed instruction prompts:
 *     time        number   Seconds into simulation when this fires
 *     callsign    string   Which aircraft to instruct
 *     instruction object   Expected ATC command:
 *       type     'climb'|'descend'|'heading'|'direct'|'speed'|'contact'|'land'|'takeoff'
 *       value    number   Expected altitude (ft), heading (°), or speed (kt)
 *       display  string   Human-readable value label
 *     hint        string   Suggested phraseology shown to the controller
 * ─────────────────────────────────────────────────────────────────
 */
export const LEVEL1 = {
    name:        'Level 1 — Introduction',
    description: 'Two aircraft in Israeli airspace. Follow the prompts and issue each clearance.',
    duration:    300,

    waypoints: {
        TLV: { lat: 32.01, lon: 34.88, name: 'Tel Aviv' },
        HFA: { lat: 32.81, lon: 35.00, name: 'Haifa' },
        BEG: { lat: 31.23, lon: 34.78, name: 'Beer Sheva' },
        ELT: { lat: 29.56, lon: 34.95, name: 'Eilat' },
        JRS: { lat: 31.77, lon: 35.22, name: 'Jerusalem' },
        SDO: { lat: 30.87, lon: 34.80, name: 'Sde Ovad' },
    },

    aircraft: [
        {
            callsign: 'ELY101',
            phonetic: 'El Al One Zero One',
            lat: 32.45, lon: 34.90,
            altitude: 10000, speed: 280, heading: 190,
            color: '#00ff88',
            route: ['TLV', 'BEG', 'SDO', 'ELT'],
        },
        {
            callsign: 'ISR202',
            phonetic: 'Israel Air Two Zero Two',
            lat: 32.75, lon: 35.10,
            altitude: 8000, speed: 250, heading: 220,
            color: '#00aaff',
            route: ['HFA', 'TLV', 'JRS'],
        },
    ],

    events: [
        {
            time: 25,
            callsign: 'ELY101',
            instruction: { type: 'descend', value: 6000, display: '6,000 ft' },
            hint: 'El Al One Zero One, descend to six thousand feet.',
        },
        {
            time: 70,
            callsign: 'ISR202',
            instruction: { type: 'heading', value: 200, display: 'heading 200' },
            hint: 'Israel Air Two Zero Two, turn left heading two zero zero.',
        },
        {
            time: 120,
            callsign: 'ELY101',
            instruction: { type: 'climb', value: 9000, display: '9,000 ft' },
            hint: 'El Al One Zero One, climb to nine thousand feet.',
        },
        {
            time: 180,
            callsign: 'ISR202',
            instruction: { type: 'descend', value: 5000, display: '5,000 ft' },
            hint: 'Israel Air Two Zero Two, descend to five thousand feet.',
        },
        {
            time: 240,
            callsign: 'ELY101',
            instruction: { type: 'heading', value: 160, display: 'heading 160' },
            hint: 'El Al One Zero One, turn right heading one six zero.',
        },
    ],
};
