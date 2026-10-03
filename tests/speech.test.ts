import { describe, expect, it } from "vitest";
import { moveSpeech, squareLabel } from "../src/speech";
import { soundFor } from "../src/sound";

describe("moveSpeech", () => {
	it("names the piece and the square", () => {
		expect(moveSpeech("Nf3", "w", 12)).toBe("12. Nf3, knight to f3");
		expect(moveSpeech("Bb5", "w", 3)).toBe("3. Bb5, bishop to b5");
	});

	it("marks Black's moves with three dots", () => {
		expect(moveSpeech("e5", "b", 1)).toBe("1... e5, pawn to e5");
	});

	it("says takes for captures", () => {
		expect(moveSpeech("exd4", "b", 5)).toBe("5... exd4, pawn takes d4");
		expect(moveSpeech("Qxf7", "w", 4)).toBe("4. Qxf7, queen takes f7");
	});

	it("handles disambiguation", () => {
		expect(moveSpeech("Nbd2", "w", 6)).toBe("6. Nbd2, knight to d2");
		expect(moveSpeech("R1xe4", "b", 20)).toBe("20... R1xe4, rook takes e4");
	});

	it("reads castling", () => {
		expect(moveSpeech("O-O", "w", 5)).toBe("5. O-O, castles kingside");
		expect(moveSpeech("O-O-O+", "b", 9)).toBe("9... O-O-O+, castles queenside, check");
	});

	it("reads promotion, check and mate", () => {
		expect(moveSpeech("e8=Q", "w", 40)).toBe("40. e8=Q, pawn to e8, promotes to queen");
		expect(moveSpeech("bxa1=N+", "b", 41)).toBe("41... bxa1=N+, pawn takes a1, promotes to knight, check");
		expect(moveSpeech("Qh7#", "w", 30)).toBe("30. Qh7#, queen to h7, checkmate");
	});

	it("ignores trailing annotation marks", () => {
		expect(moveSpeech("Nf3!?", "w", 2)).toBe("2. Nf3!?, knight to f3");
		expect(moveSpeech("Qxh7+!", "w", 21)).toBe("21. Qxh7+!, queen takes h7, check");
	});

	it("falls back to the move alone when it cannot read it", () => {
		expect(moveSpeech("--", "w", 7)).toBe("7. --");
	});
});

describe("squareLabel", () => {
	it("names the piece on the square", () => {
		expect(squareLabel("e4", "wn")).toBe("e4, white knight");
		expect(squareLabel("d8", "bq")).toBe("d8, black queen");
	});

	it("says empty for an empty square", () => {
		expect(squareLabel("a3", null)).toBe("a3, empty");
	});
});

describe("soundFor", () => {
	it("plays the capture sound only for captures", () => {
		expect(soundFor("Nxe5")).toBe("capture");
		expect(soundFor("Nf3")).toBe("move");
		expect(soundFor("O-O")).toBe("move");
	});
});
