export class SpeechController {
    constructor() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.available = !!SR;
        if (!this.available) return;

        this.rec = new SR();
        this.rec.continuous    = false;
        this.rec.lang          = 'en-US';
        this.rec.interimResults= true;
        this.rec.maxAlternatives = 3;

        this.listening = false;
        this.onInterim = null;   // cb(text)
        this.onFinal   = null;   // cb(text)

        this.rec.onresult = (ev) => {
            let interim = '', final = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
                const t = ev.results[i][0].transcript;
                ev.results[i].isFinal ? (final += t) : (interim += t);
            }
            if (interim && this.onInterim) this.onInterim(interim);
            if (final   && this.onFinal)   this.onFinal(final);
        };

        this.rec.onend = () => { this.listening = false; };

        this.rec.onerror = (e) => {
            if (e.error !== 'no-speech') console.warn('[speech]', e.error);
            this.listening = false;
        };
    }

    start() {
        if (!this.available || this.listening) return;
        try { this.rec.start(); this.listening = true; } catch (_) {}
    }

    stop() {
        if (!this.available || !this.listening) return;
        try { this.rec.stop(); } catch (_) {}
        this.listening = false;
    }

    speak(text) {
        if (!window.speechSynthesis) return;
        // Cancel any ongoing utterance so readbacks don't pile up
        window.speechSynthesis.cancel();
        const utt    = new SpeechSynthesisUtterance(text);
        utt.rate     = 1.05;
        utt.pitch    = 0.85;
        utt.volume   = 1.0;
        window.speechSynthesis.speak(utt);
    }
}
