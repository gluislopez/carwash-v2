// Singleton AudioContext state
let audioCtx = null;

const getAudioContext = () => {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    return audioCtx;
};

/**
 * Call this on a USER CLICK to unlock audio on iOS.
 */
export const unlockAudio = async () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
    }
    // Play silent buffer to force unlock
    if (ctx) {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        console.log("Audio unlocked/resumed");
    }
};

/**
 * Plays a pleasant "Ding" sound for new services.
 */
export const playNewServiceSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

/**
 * Plays a distinct "Alert" sound for long-running services.
 * Double beep.
 */
export const playAlertSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const beep = (startTime) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'square';
            osc.frequency.setValueAtTime(440, startTime); // A4

            gain.gain.setValueAtTime(0.05, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

            osc.start(startTime);
            osc.stop(startTime + 0.1);
        };

        const now = ctx.currentTime;
        beep(now);
        beep(now + 0.15);

    } catch (e) {
        console.error("Audio alert failed", e);
    }
};
