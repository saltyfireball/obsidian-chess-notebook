// Move and capture sounds, made as short tones with the Web Audio API: no
// audio files, no network.

export type MoveSound = "move" | "capture";

export function soundFor(san: string): MoveSound {
	return san.includes("x") ? "capture" : "move";
}

interface Tone {
	type: OscillatorType;
	freq: number;
	// Seconds after the sound starts.
	at: number;
	length: number;
	gain: number;
}

const TONES: Record<MoveSound, Tone[]> = {
	move: [{ type: "triangle", freq: 660, at: 0, length: 0.07, gain: 0.6 }],
	capture: [
		{ type: "square", freq: 330, at: 0, length: 0.06, gain: 0.35 },
		{ type: "triangle", freq: 220, at: 0.05, length: 0.1, gain: 0.7 },
	],
};

// Made on the first sound, so nothing is created while sounds are off.
let context: AudioContext | null = null;

// volume: 0 to 100.
export function playMoveSound(kind: MoveSound, volume: number): void {
	if (volume <= 0 || typeof AudioContext !== "function") return;
	if (!context) context = new AudioContext();
	const ctx = context;
	if (ctx.state === "suspended") void ctx.resume();

	const level = Math.min(volume, 100) / 100;
	const start = ctx.currentTime;
	for (const tone of TONES[kind]) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = tone.type;
		osc.frequency.value = tone.freq;
		const t0 = start + tone.at;
		gain.gain.setValueAtTime(tone.gain * level, t0);
		gain.gain.exponentialRampToValueAtTime(0.001, t0 + tone.length);
		osc.connect(gain).connect(ctx.destination);
		osc.start(t0);
		osc.stop(t0 + tone.length);
	}
}

export function closeSounds(): void {
	void context?.close();
	context = null;
}
