// Captures the README screenshots and GIFs into docs/media/ by driving the
// real plugin in headless Chromium (see README.md in this folder).
//
//   node tools/readme-media/build.mjs && node tools/readme-media/capture.mjs [scene...]

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");

const here = fileURLToPath(new URL(".", import.meta.url));
const out = join(here, "../../docs/media");
const pageUrl = pathToFileURL(join(here, "page.html")).href;
mkdirSync(out, { recursive: true });

const OPERA = `[Event "Opera Game"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]
[ECO "C41"]

1.e4 e5 2.Nf3 d6 {Philidor Defence.} 3.d4 Bg4?! {Better is 3...exd4 or 3...Nd7.}
4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6? (6...Qf6 {holds f7.}) 7.Qb3 Qe7 8.Nc3 c6
9.Bg5 b5? 10.Nxb5! cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7! Rxd7 14.Rd1 Qe6
15.Bxd7+ Nxd7 16.Qb8+!! {The queen sacrifice that finishes it.} Nxb8 17.Rd8# 1-0`;

const OPERA_FINISH = `[Event "Opera Game, the finish"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[FEN "3rkb1r/p2nqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR3R w k - 3 13"]
[SetUp "1"]

13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0`;

const ITALIAN = `[Event "Club game"]
[White "Player 1"]
[Black "Player 2"]
[ECO "C53"]

1.e4 e5 {The most popular reply.} 2.Nf3 Nc6 3.Bc4 Bc5 {The **Giuoco Piano**, the quiet game.}
(3...Nf6 {The Two Knights Defence.} 4.Ng5 $5 d5 5.exd5 Na5)
4.c3 $1 {Preparing d4.} Nf6 5.d4 exd4 6.cxd4 Bb4+ 7.Bd2 Bxd2+ 8.Nbxd2 d5! $14 *`;

const SCHOLAR = [
	"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
	"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
	"rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2",
	"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
	"r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
	"r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
	"r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
].join("\n");

const SETS = ["standard", "celtic", "fantasy", "firi", "kiwen-suwi", "rhosgfx", "shapes", "spatial"];
const SET_FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5";

// --- page helpers ---------------------------------------------------------

async function openPage(browser, { width = 900, height = 900, video = false, theme = "dark", settings } = {}) {
	const ctxOpts = { viewport: { width, height }, deviceScaleFactor: video ? 1 : 2 };
	let videoDir = null;
	if (video) {
		videoDir = mkdtempSync(join(tmpdir(), "chess-media-"));
		ctxOpts.recordVideo = { dir: videoDir, size: { width, height } };
	}
	const context = await browser.newContext(ctxOpts);
	const page = await context.newPage();
	page.on("pageerror", (e) => console.error("pageerror:", e.message));
	await page.goto(pageUrl);
	await page.evaluate(
		async ({ theme, settings }) => {
			document.body.className = "theme-" + theme;
			await window.chess.start(settings);
		},
		{ theme, settings },
	);
	return { page, context, videoDir };
}

// Adds a note body to #root and renders blocks into it. Each block is
// { md } for plain markdown-ish HTML, or { fence, source } for a chessboard.
async function note(page, blocks, { title } = {}) {
	await page.evaluate(
		({ blocks, title }) => {
			const root = document.getElementById("root");
			root.className = "markdown-preview-view";
			if (title) root.createEl("h1", { text: title });
			for (const b of blocks) {
				if (b.html) {
					const d = root.createDiv();
					d.innerHTML = b.html;
				} else {
					const el = root.createDiv({ cls: "el-pre" });
					if (b.id) el.id = b.id;
					window.chess.render(el, b.fence, b.source ?? "");
				}
			}
		},
		{ blocks, title },
	);
	await page.waitForTimeout(600);
}

async function addCursor(page) {
	await page.evaluate(() => {
		const c = document.createElement("div");
		c.id = "fake-cursor";
		c.style.cssText =
			"position:fixed;left:0;top:0;width:22px;height:22px;z-index:9999;pointer-events:none;" +
			"transition:transform 0.45s ease;transform:translate(-40px,-40px)";
		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("width", "22");
		svg.setAttribute("height", "22");
		const p = document.createElementNS(ns, "path");
		p.setAttribute("d", "M4 2l16 11-7 1.5L9.5 21z");
		p.setAttribute("fill", "#fff");
		p.setAttribute("stroke", "#000");
		p.setAttribute("stroke-width", "1.5");
		svg.appendChild(p);
		c.appendChild(svg);
		document.body.appendChild(c);
	});
}

async function moveCursor(page, x, y) {
	await page.evaluate(
		({ x, y }) => {
			document.getElementById("fake-cursor").style.transform = `translate(${x - 4}px, ${y - 2}px)`;
		},
		{ x, y },
	);
	await page.waitForTimeout(500);
}

async function clickAt(page, x, y, pause = 350) {
	await moveCursor(page, x, y);
	await page.mouse.click(x, y);
	await page.waitForTimeout(pause);
}

async function center(locator) {
	const b = await locator.boundingBox();
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function clickButton(page, scope, label, pause) {
	const { x, y } = await center(page.locator(`${scope} [aria-label='${label}']`).first());
	await clickAt(page, x, y, pause);
}

async function clickSquare(page, scope, sq, pause) {
	const { x, y } = await center(page.locator(`${scope} [data-square='${sq}']`).first());
	await clickAt(page, x, y, pause);
}

async function shot(page, name, selector = "#root") {
	await page.locator(selector).screenshot({ path: join(out, name) });
	console.log("wrote", name);
}

// Ends a recorded scene and converts the cropped video to an optimised GIF.
async function finishGif({ page, context, videoDir }, name, selector = "#root", { fps = 12, width = 760 } = {}) {
	const b = await page.locator(selector).boundingBox();
	const vp = page.viewportSize();
	b.height = Math.min(b.height, vp.height - b.y);
	b.width = Math.min(b.width, vp.width - b.x);
	await context.close();
	const webm = join(videoDir, readdirSync(videoDir).find((f) => f.endsWith(".webm")));
	const crop = `crop=${Math.floor(b.width)}:${Math.floor(b.height)}:${Math.floor(b.x)}:${Math.floor(b.y)}`;
	const filters = `${crop},fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
	// The first frames are a blank page before the note renders.
	execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.8", "-i", webm, "-filter_complex", filters, "-loop", "0", join(out, name)]);
	rmSync(videoDir, { recursive: true, force: true });
	console.log("wrote", name);
}

// --- scenes ---------------------------------------------------------------

const scenes = {
	async hero(browser) {
		const { page } = await openPage(browser, { width: 900 });
		await note(page, [{ fence: 'type:pgn start_at:end', source: OPERA }]);
		await shot(page, "hero.png");
	},

	async annotations(browser) {
		const { page } = await openPage(browser, { width: 900 });
		await note(page, [{ fence: 'type:pgn title:"Italian Game" start_at:4', source: ITALIAN }]);
		await page.locator("#root .sfb-chess-nag").first().hover();
		await shot(page, "annotations.png");
	},

	async fen(browser) {
		const { page } = await openPage(browser, { width: 560 });
		await note(page, [{ fence: "type:fen", source: "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4" }]);
		await shot(page, "fen.png");
	},

	async light(browser) {
		const { page } = await openPage(browser, { width: 900, theme: "light" });
		await note(page, [{ fence: 'type:pgn start_at:10', source: OPERA }]);
		await shot(page, "light-theme.png");
	},

	async sets(browser) {
		const { page } = await openPage(browser, { width: 1100 });
		await page.evaluate(() => {
			const s = document.createElement("style");
			s.textContent =
				".set-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}" +
				".set-grid h3{margin:4px 0 6px;font-size:15px;color:var(--text-muted);font-weight:600;text-align:center}";
			document.head.appendChild(s);
		});
		await page.evaluate(
			({ sets, fen }) => {
				const root = document.getElementById("root");
				root.className = "markdown-preview-view";
				root.style.maxWidth = "1040px";
				const grid = root.createDiv({ cls: "set-grid" });
				for (const s of sets) {
					const cell = grid.createDiv();
					cell.createEl("h3", { text: s });
					window.chess.render(cell.createDiv(), `type:fen pieces:${s} center:false`, fen);
				}
			},
			{ sets: SETS, fen: SET_FEN },
		);
		await page.waitForTimeout(800);
		await shot(page, "piece-sets.png");
	},

	async fan(browser) {
		const { page } = await openPage(browser, { width: 900 });
		await note(page, [{ fence: 'type:pgn notation:fan pieces:fantasy start_at:8', source: ITALIAN }]);
		await shot(page, "fan-notation.png");
	},

	async settings(browser) {
		const { page } = await openPage(browser, { width: 820, height: 1400 });
		await page.evaluate(() => window.chess.showSettings(document.getElementById("root")));
		await page.waitForTimeout(300);
		await shot(page, "settings.png");
	},

	async sequence(browser) {
		const rec = await openPage(browser, { width: 560, height: 860, video: true });
		const { page } = rec;
		await note(page, [{ fence: 'type:fen title:"Scholar\'s mate"', source: SCHOLAR }]);
		await addCursor(page);
		await page.waitForTimeout(500);
		for (let i = 0; i < 6; i++) await clickButton(page, "#root", "Next position", 550);
		await page.waitForTimeout(900);
		await clickButton(page, "#root", "First position", 900);
		await finishGif(rec, "fen-sequence.gif", "#root", { width: 480 });
	},

	async autoplay(browser) {
		const rec = await openPage(browser, { width: 900, height: 760, video: true, settings: { autoPlaySpeed: 700 } });
		const { page } = rec;
		await note(page, [{ fence: "type:pgn start_at:start", source: OPERA }]);
		await addCursor(page);
		await clickButton(page, "#root", "Auto-play", 0);
		await page.waitForTimeout(24000);
		await finishGif(rec, "autoplay.gif", "#root", { fps: 10, width: 720 });
	},

	async puzzle(browser) {
		const rec = await openPage(browser, { width: 900, height: 760, video: true });
		const { page } = rec;
		await note(page, [{ fence: 'type:pgn mode:puzzle title:"Find Morphy\'s finish"', source: OPERA_FINISH }]);
		await addCursor(page);
		await page.waitForTimeout(700);
		// A wrong try first, then the hint, then the real line.
		await clickSquare(page, "#root", "b3", 250);
		await clickSquare(page, "#root", "b7", 1100);
		await clickButton(page, "#root", "Hint", 900);
		await clickButton(page, "#root", "Hint", 900);
		await clickSquare(page, "#root", "d1", 250);
		await clickSquare(page, "#root", "d7", 1300);
		await clickSquare(page, "#root", "h1", 250);
		await clickSquare(page, "#root", "d1", 1300);
		await clickSquare(page, "#root", "b5", 250);
		await clickSquare(page, "#root", "d7", 1300);
		await clickSquare(page, "#root", "b3", 250);
		await clickSquare(page, "#root", "b8", 1300);
		await clickSquare(page, "#root", "d1", 250);
		await clickSquare(page, "#root", "d8", 2600);
		await finishGif(rec, "puzzle.gif", "#root", { width: 720 });
	},

	async step(browser) {
		const rec = await openPage(browser, { width: 900, height: 760, video: true });
		const { page } = rec;
		await note(page, [{ fence: 'type:pgn mode:step title:"Italian Game"', source: ITALIAN }]);
		await addCursor(page);
		await page.waitForTimeout(600);
		for (let i = 0; i < 7; i++) await clickButton(page, "#root", "Next move", 650);
		// Keyboard: arrows step, F flips.
		await page.locator("#root [tabindex='0']").first().focus();
		for (let i = 0; i < 3; i++) {
			await page.keyboard.press("ArrowRight");
			await page.waitForTimeout(600);
		}
		await page.keyboard.press("f");
		await page.waitForTimeout(1500);
		await finishGif(rec, "step-mode.gif", "#root", { width: 720 });
	},

	async gamefile(browser) {
		const rec = await openPage(browser, { width: 1280, height: 1080, video: true });
		const { page } = rec;
		const start = OPERA.split("\n").slice(0, 8).join("\n") + "\n1.e4 e5 2.Nf3 d6";
		await page.evaluate((text) => window.chess.writeFile("Games/Opera Game.pgn", text), start);
		await page.evaluate(() => {
			const root = document.getElementById("root");
			root.className = "split";
			const left = root.createDiv({ cls: "pane" });
			left.createDiv({ cls: "pane-title", text: "Games/Opera Game.pgn" });
			const ed = left.createDiv({ cls: "editor", attr: { id: "editor" } });
			ed.createSpan({ attr: { id: "typed" } });
			ed.createSpan({ cls: "caret", text: "​" });
			const right = root.createDiv({ cls: "pane" });
			right.createDiv({ cls: "pane-title", text: "Opera Game.md" });
			const view = right.createDiv({ cls: "markdown-preview-view" });
			view.createEl("h1", { text: "Opera Game" });
			window.chess.render(view.createDiv(), 'type:pgn start_at:end src:"Games/Opera Game.pgn"', "");
		});
		await page.evaluate((t) => (document.getElementById("typed").textContent = t), start);
		await page.waitForTimeout(1200);
		// Type the next moves; the board follows every save.
		const more = [" 3.d4 Bg4", " 4.dxe5 Bxf3", " 5.Qxf3 dxe5", " 6.Bc4 Nf6", " 7.Qb3 Qe7"];
		let text = start;
		for (const chunk of more) {
			for (const ch of chunk) {
				text += ch;
				await page.evaluate((t) => (document.getElementById("typed").textContent = t), text);
				await page.waitForTimeout(55);
			}
			await page.evaluate((t) => window.chess.writeFile("Games/Opera Game.pgn", t), text);
			await page.waitForTimeout(800);
		}
		await page.waitForTimeout(1200);
		await finishGif(rec, "game-file.gif", "#root", { width: 900 });
	},
};

const browser = await chromium.launch();
const wanted = process.argv.slice(2);
for (const [name, run] of Object.entries(scenes)) {
	if (wanted.length && !wanted.includes(name)) continue;
	await run(browser);
}
await browser.close();
