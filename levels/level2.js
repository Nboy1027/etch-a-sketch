/**
 * Level 2 — Rush Hour
 * Three aircraft, faster pace, mixed instruction types.
 */
export const LEVEL2 = {
    name:        'Level 2 — Rush Hour',
    description: 'Three aircraft simultaneously. Instructions come faster — stay sharp.',
    duration:    420,

    waypoints: {
        TLV: { lat: 32.01, lon: 34.88, name: 'Tel Aviv' },
        HFA: { lat: 32.81, lon: 35.00, name: 'Haifa' },
        BEG: { lat: 31.23, lon: 34.78, name: 'Beer Sheva' },
        ELT: { lat: 29.56, lon: 34.95, name: 'Eilat' },
        JRS: { lat: 31.77, lon: 35.22, name: 'Jerusalem' },
        SDO: { lat: 30.87, lon: 34.80, name: 'Sde Ovad' },
        RAM: { lat: 31.90, lon: 34.83, name: 'Ramla' },
    },

    aircraft: [
        {
            callsign: 'ELY101',
            phonetic: 'El Al One Zero One',
            lat: 32.45, lon: 34.90,
            altitude: 12000, speed: 300, heading: 185,
            color: '#00ff88',
            route: ['TLV', 'RAM', 'BEG', 'SDO', 'ELT'],
        },
        {
            callsign: 'ISR202',
            phonetic: 'Israel Air Two Zero Two',
            lat: 32.70, lon: 35.15,
            altitude: 9000, speed: 260, heading: 215,
            color: '#00aaff',
            route: ['HFA', 'TLV', 'JRS'],
        },
        {
            callsign: 'ARK303',
            phonetic: 'Arkia Three Zero Three',
            lat: 31.80, lon: 35.25,
            altitude: 6000, speed: 240, heading: 270,
            color: '#ffaa00',
            route: ['JRS', 'RAM', 'TLV', 'HFA'],
        },
    ],

    events: [
        {
            time: 18,
            callsign: 'ELY101',
            instruction: { type: 'descend', value: 8000, display: '8,000 ft' },
            hint: 'El Al One Zero One, descend to eight thousand feet.',
        },
        {
            time: 45,
            callsign: 'ISR202',
            instruction: { type: 'heading', value: 180, display: 'heading 180' },
            hint: 'Israel Air Two Zero Two, turn left heading one eight zero.',
        },
        {
            time: 80,
            callsign: 'ARK303',
            instruction: { type: 'climb', value: 9000, display: '9,000 ft' },
            hint: 'Arkia Three Zero Three, climb to nine thousand feet.',
        },
        {
            time: 130,
            callsign: 'ELY101',
            instruction: { type: 'heading', value: 155, display: 'heading 155' },
            hint: 'El Al One Zero One, turn right heading one five five.',
        },
        {
            time: 170,
            callsign: 'ISR202',
            instruction: { type: 'descend', value: 5000, display: '5,000 ft' },
            hint: 'Israel Air Two Zero Two, descend to five thousand feet.',
        },
        {
            time: 210,
            callsign: 'ARK303',
            instruction: { type: 'heading', value: 320, display: 'heading 320' },
            hint: 'Arkia Three Zero Three, turn right heading three two zero.',
        },
        {
            time: 260,
            callsign: 'ELY101',
            instruction: { type: 'climb', value: 10000, display: '10,000 ft' },
            hint: 'El Al One Zero One, climb to one zero thousand feet.',
        },
        {
            time: 310,
            callsign: 'ARK303',
            instruction: { type: 'descend', value: 4000, display: '4,000 ft' },
            hint: 'Arkia Three Zero Three, descend to four thousand feet.',
        },
        {
            time: 360,
            callsign: 'ISR202',
            instruction: { type: 'climb', value: 7000, display: '7,000 ft' },
            hint: 'Israel Air Two Zero Two, climb to seven thousand feet.',
        },
    ],
};
