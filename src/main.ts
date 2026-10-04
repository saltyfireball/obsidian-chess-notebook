import { Editor, Notice, Plugin, MarkdownPostProcessorContext, MarkdownRenderChild, TAbstractFile, TFile, normalizePath } from "obsidian";
import { boardBlockFor, editsCodeBlock } from "./paste-board";
import { fenceLineFor, findChessBlocks, isPlayablePgn, mapInBatches, occurrenceOf } from "./puzzle-review";
import { PuzzleReviewModal, type ReviewPuzzle } from "./puzzle-review-modal";
import { FenViewer } from "./fen-viewer";
import { FenSequenceViewer } from "./fen-sequence-viewer";
import { PgnViewer } from "./pgn-viewer";
import { StaticViewer } from "./static-viewer";
import { staticFenPosition, staticPgnPosition } from "./static-position";
import { parseShapeOptions } from "./pgn-parser";
import { GamePickerViewer } from "./game-picker";
import { splitPgnGames } from "./pgn-games";
import { ChessSettingTab } from "./settings";
import { injectSprites, removeSprites } from "./board-manager";
import { resolvePieceSet } from "./fan-pieces";
import { resolveBoardTheme } from "./board-themes";
import { parseOptions } from "./block-options";
import { closeSounds } from "./sound";
import { resolveBoardSize } from "./board-size";
import type { ChessSettings, ParsedCodeBlock, CodeBlockOptions } from "./types";
import { DEFAULT_SETTINGS, normalizeFen } from "./types";
import { BLOCK_ALIASES, aliasBlock, blockType, looksLikeFen } from "./chess-format";
import type { BlockAlias } from "./chess-format";

// The setting that turns each alias on.
const ALIAS_SETTING: Record<BlockAlias, "chessBlocks" | "pgnBlocks" | "fenBlocks"> = {
	chess: "chessBlocks",
	pgn: "pgnBlocks",
	fen: "fenBlocks",
};

interface FileBoundBlock {
	el: HTMLElement;
	source: string;
	fenceLine: string;
	sourcePath: string;
}

interface Viewer {
	destroy(): void;
}

// Ties a rendered block's viewer to Obsidian's render lifecycle, so its
// board, timers and listeners go away on re-render, note close and unload.
class ChessBlockChild extends MarkdownRenderChild {
	private viewer: Viewer | null = null;
	gone = false;

	constructor(containerEl: HTMLElement, private onGone: (child: ChessBlockChild) => void) {
		super(containerEl);
	}

	setViewer(viewer: Viewer | null): void {
		this.viewer?.destroy();
		this.viewer = this.gone ? null : viewer;
		if (this.gone) viewer?.destroy();
	}

	onunload(): void {
		this.gone = true;
		this.setViewer(null);
		this.onGone(this);
	}
}

// The rendered note el is in: its nearest preview container, or the top of
// its tree when it has none.
function renderRoot(el: HTMLElement): HTMLElement {
	const root = el.parentElement?.closest<HTMLElement>(".markdown-preview-view, .markdown-rendered");
	if (root) return root;
	let top = el;
	while (top.parentElement) top = top.parentElement;
	return top;
}

export default class ChessPlugin extends Plugin {
	settings!: ChessSettings;
	private fileCache = new Map<string, { mtime: number; content: string }>();
	private fileBoundBlocks = new Map<string, FileBoundBlock[]>();
	private blockChildren = new Map<HTMLElement, ChessBlockChild>();
	// The note, language and source of each block rendered without section
	// info (PDF export), so it can find its place among the same blocks.
	private sectionlessBlocks = new WeakMap<HTMLElement, string>();
	// The code block languages rendered since load: chessboard plus the aliases turned on.
	private blockLanguages: string[] = ["chessboard"];
	private scanning = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ChessSettingTab(this.app, this));
		this.addPasteCommand();
		injectSprites(document);

		this.addCommand({
			id: "review-vault-puzzles",
			name: "Review puzzles from the vault",
			callback: () => void this.reviewVaultPuzzles(),
		});

		// Lets .pgn / .fen files open in Obsidian's editor, so a src: block can be
		// edited side by side with the board it renders.
		try {
			this.registerExtensions(["pgn", "fen"], "markdown");
		} catch (e: unknown) {
			console.warn("chess-notebook: could not claim .pgn/.fen extensions", e);
		}

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile) {
					this.onFileModified(file.path);
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
				this.onFileRenamed(oldPath, file.path);
			}),
		);

		this.registerEvent(
			this.app.vault.on("delete", (file: TAbstractFile) => {
				this.fileCache.delete(file.path);
				this.onFileModified(file.path);
			}),
		);

		this.registerBlockProcessor("chessboard", null);
		// Obsidian reads processors at load, so a changed alias setting needs a reload.
		for (const alias of BLOCK_ALIASES) {
			if (this.settings[ALIAS_SETTING[alias]]) {
				this.registerBlockProcessor(alias, alias);
				this.blockLanguages.push(alias);
			}
		}
	}

	private registerBlockProcessor(language: string, alias: BlockAlias | null): void {
		const handler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const child = new ChessBlockChild(el, (gone) => this.forgetBlock(gone));
			this.blockChildren.set(el, child);
			ctx.addChild(child);
			const render = (fenceLine: string) => {
				// An alias block is a chessboard block with its type: implied.
				const block = alias ? aliasBlock(alias, fenceLine, source) : { fenceLine, source };
				void this.processCodeBlock(block.source, el, block.fenceLine, ctx.sourcePath);
			};
			const fenceLine = this.extractFenceLine(el, ctx, language);
			if (fenceLine !== null) {
				render(fenceLine);
				return;
			}
			// Export to PDF renders without section info: find the block's
			// options in the note instead, or every option would be lost.
			// Blocks with the same source are told apart by their place in
			// the rendered document, so each gets its own options.
			this.sectionlessBlocks.set(el, ctx.sourcePath + "\n" + language + "\n" + source.trim());
			void this.readNote(ctx.sourcePath).then((text) => {
				// The block may have been unloaded or rendered again while the
				// note was read.
				if (child.gone || this.blockChildren.get(el) !== child) return;
				render(text === null ? "" : fenceLineFor(text, language, source, this.sectionlessOccurrence(el, language)));
			});
		};
		try {
			this.registerMarkdownCodeBlockProcessor(language, handler);
		} catch (e: unknown) {
			// Obsidian throws when another plugin loaded first and owns this name;
			// leave its blocks to it.
			console.warn(`chess-notebook: could not register ${language} code blocks`, e);
		}
	}

	onunload(): void {
		for (const child of Array.from(this.blockChildren.values())) {
			child.unload();
		}
		removeSprites();
		closeSounds();
		this.fileCache.clear();
		this.fileBoundBlocks.clear();
		this.blockChildren.clear();
	}

	// Inserts a new chessboard block for the FEN or PGN on the clipboard at the
	// cursor. Selected text is replaced, as a paste would; no block is edited.
	private addPasteCommand(): void {
		this.addCommand({
			id: "paste-as-board",
			name: "Paste a chess position or game as a board",
			editorCallback: async (editor: Editor) => {
				const editsBlock = () =>
					editsCodeBlock(editor.getValue().split("\n"), editor.getCursor("from"), editor.getCursor("to"));
				const refuse = () => new Notice("Place the caret outside the code block first.");
				if (editsBlock()) {
					refuse();
					return;
				}
				let text: string;
				try {
					text = await navigator.clipboard.readText();
				} catch {
					new Notice("Could not read the clipboard.");
					return;
				}
				// The note or the selection may have changed while the clipboard was read.
				if (editsBlock()) {
					refuse();
					return;
				}
				const cursor = editor.getCursor("from");
				const block = boardBlockFor(text, editor.getLine(cursor.line).slice(0, cursor.ch).trim().length > 0);
				if (!block) {
					new Notice("The clipboard holds no chess position or game.");
					return;
				}
				editor.replaceSelection(block);
			},
		});
	}

	private forgetBlock(child: ChessBlockChild): void {
		const el = child.containerEl;
		// A newer render of the same element owns it now.
		if (this.blockChildren.get(el) !== child) return;
		this.blockChildren.delete(el);
		for (const [path, blocks] of this.fileBoundBlocks) {
			const rest = blocks.filter((b) => b.el !== el);
			if (rest.length === 0) this.fileBoundBlocks.delete(path);
			else this.fileBoundBlocks.set(path, rest);
		}
	}

	// The block's options from its section, or null when the render has no
	// section info.
	private extractFenceLine(el: HTMLElement, ctx: MarkdownPostProcessorContext, language: string): string | null {
		try {
			const info = ctx.getSectionInfo(el);
			if (!info || !info.text) {
				return null;
			}
			const lines = info.text.split("\n");
			const fenceLineText = lines[info.lineStart] ?? "";
			const match = new RegExp("^`{3,}\\s*" + language + "\\s*(.*)", "i").exec(fenceLineText);
			return match ? match[1].trim() : "";
		} catch {
			return "";
		}
	}

	private async readNote(path: string): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;
		try {
			return await this.app.vault.cachedRead(file);
		} catch {
			return null;
		}
	}

	// Which of the blocks with el's note, language and source el is, in the
	// order they appear in the rendered document around it (the export's
	// page). Counted once the note is read, when the blocks before it are in
	// place; a block replaced or removed is no longer in the document.
	private sectionlessOccurrence(el: HTMLElement, language: string): number {
		const root = renderRoot(el);
		const blocks = Array.from(root.querySelectorAll<HTMLElement>(`.block-language-${language}`)).filter(
			(block) => renderRoot(block) === root,
		);
		return occurrenceOf(blocks, el, (block) => this.sectionlessBlocks.get(block));
	}

	private async processCodeBlock(
		source: string,
		el: HTMLElement,
		fenceLine: string,
		sourcePath: string,
	): Promise<void> {
		try {
			const parsed = this.parseCodeBlock(source, fenceLine);
			if (!parsed) {
				this.clearBlock(el);
				el.createDiv({ cls: "sfb-chess-error", text: "Invalid chessboard block. Use type:fen or type:pgn." });
				return;
			}

			// Checked before src: binds the block to its file, so an unloaded
			// block would leave a binding nothing removes.
			const child = this.blockChildren.get(el);
			if (!child || child.gone) return;

			let content = parsed.content;
			const src = parsed.options.src;

			if (src) {
				const resolvedPath = this.resolveSrcPath(src, sourcePath);
				this.registerFileBoundBlock(resolvedPath, el, source, fenceLine, sourcePath);

				try {
					content = await this.readChessFile(resolvedPath);
				} catch (e: unknown) {
					this.clearBlock(el);
					const msg = e instanceof Error ? e.message : "Could not read file";
					el.createDiv({
						cls: "sfb-chess-error",
						text: `Chess file not found: ${resolvedPath} (${msg})`,
					});
					return;
				}
			}

			// The block may have been unloaded or rendered again while the file was read.
			if (child.gone || this.blockChildren.get(el) !== child) return;
			this.clearBlock(el);

			if (parsed.options.center) {
				el.addClass("sfb-chess-center-wrapper");
			}
			// The board width, read by the stylesheet. Set every render, so
			// removing size: from a block puts it back to the default.
			el.setCssProps({ "--sfb-board-size": `${resolveBoardSize(parsed.options.size, this.settings.boardSize)}px` });

			if (parsed.options.diagram) {
				child.setViewer(this.createStaticViewer(el, parsed.type, content, parsed.options));
			} else if (parsed.type === "fen") {
				const fens = this.parseFens(content);

				if (fens.length > 1) {
					child.setViewer(new FenSequenceViewer(el, fens, parsed.options, this.settings));
				} else {
					child.setViewer(new FenViewer(el, fens[0] ?? normalizeFen(content.trim()), parsed.options, this.settings));
				}
			} else {
				const games = splitPgnGames(content);
				if (games.length > 1) {
					child.setViewer(new GamePickerViewer(el, games, parsed.options, this.settings));
				} else {
					child.setViewer(new PgnViewer(el, content, parsed.options, this.settings));
				}
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Unknown error rendering chessboard";
			this.clearBlock(el);
			el.createDiv({ cls: "sfb-chess-error", text: "Chessboard error: " + msg });
		}
	}

	private createStaticViewer(
		el: HTMLElement,
		type: "fen" | "pgn",
		content: string,
		options: CodeBlockOptions,
	): StaticViewer {
		if (type === "pgn") {
			const { fen, shapes } = staticPgnPosition(content, options.startAt);
			return new StaticViewer(el, fen, shapes, options, this.settings);
		}
		const fens = this.parseFens(content);
		const fen = fens.length > 0 ? staticFenPosition(fens, options.startAt) : normalizeFen(content.trim());
		return new StaticViewer(el, fen, parseShapeOptions(options.arrows, options.squares), options, this.settings);
	}

	private parseFens(content: string): string[] {
		return content
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && looksLikeFen(l))
			.map((l) => normalizeFen(l));
	}

	// Destroys the block's current viewer before its DOM is replaced.
	private clearBlock(el: HTMLElement): void {
		this.blockChildren.get(el)?.setViewer(null);
		el.empty();
	}

	private resolveSrcPath(src: string, sourcePath: string): string {
		const linkpathDest = this.app.metadataCache.getFirstLinkpathDest(src, sourcePath);
		if (linkpathDest) {
			return linkpathDest.path;
		}
		return normalizePath(src);
	}

	private async readChessFile(path: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			throw new Error("file does not exist");
		}

		const cached = this.fileCache.get(path);
		if (cached && cached.mtime === file.stat.mtime) {
			return cached.content;
		}

		const content = await this.app.vault.cachedRead(file);
		this.fileCache.set(path, { mtime: file.stat.mtime, content });
		return content;
	}

	private registerFileBoundBlock(
		path: string,
		el: HTMLElement,
		source: string,
		fenceLine: string,
		sourcePath: string,
	): void {
		let blocks = this.fileBoundBlocks.get(path);
		if (!blocks) {
			blocks = [];
			this.fileBoundBlocks.set(path, blocks);
		}
		const existing = blocks.findIndex((b) => b.el === el);
		if (existing >= 0) {
			blocks.splice(existing, 1);
		}
		blocks.push({ el, source, fenceLine, sourcePath });
	}

	private onFileModified(path: string): void {
		this.fileCache.delete(path);
		const blocks = this.fileBoundBlocks.get(path);
		if (!blocks) return;
		const live = blocks.filter((b) => b.el.isConnected);
		if (live.length === 0) {
			this.fileBoundBlocks.delete(path);
			return;
		}
		this.fileBoundBlocks.set(path, live);
		for (const block of live) {
			void this.processCodeBlock(block.source, block.el, block.fenceLine, block.sourcePath);
		}
	}

	private onFileRenamed(oldPath: string, newPath: string): void {
		const cached = this.fileCache.get(oldPath);
		if (cached) {
			this.fileCache.delete(oldPath);
			this.fileCache.set(newPath, cached);
		}
		const blocks = this.fileBoundBlocks.get(oldPath);
		if (!blocks) return;
		this.fileBoundBlocks.delete(oldPath);
		for (const block of blocks) {
			if (!block.el.isConnected) continue;
			void this.processCodeBlock(block.source, block.el, block.fenceLine, block.sourcePath);
		}
	}

	// Gathers every mode:puzzle block in the vault and serves them in a modal.
	private async reviewVaultPuzzles(): Promise<void> {
		// A second run while the first still scans would only scan twice.
		if (this.scanning) return;
		this.scanning = true;
		let puzzles: ReviewPuzzle[];
		try {
			puzzles = await this.collectPuzzles();
		} finally {
			this.scanning = false;
		}
		if (puzzles.length === 0) {
			new Notice("No mode:puzzle chessboard blocks found in the vault.");
			return;
		}
		new PuzzleReviewModal(this.app, puzzles, this.settings, (puzzle) => {
			const file = this.app.vault.getAbstractFileByPath(puzzle.path);
			if (file instanceof TFile) {
				void this.app.workspace.getLeaf(false).openFile(file, { eState: { line: puzzle.line } });
			}
		}).open();
	}

	// Reads the notes a few at a time, with a progress notice, and keeps the
	// PGN blocks whose options (parsed the same way a rendered block's are) say
	// mode:puzzle and whose PGN has moves. A src: block reads its file.
	private async collectPuzzles(): Promise<ReviewPuzzle[]> {
		const files = this.app.vault.getMarkdownFiles();
		const languages = this.blockLanguages;
		const mentions = new RegExp(languages.join("|"), "i");
		const notice = new Notice(`Scanning ${files.length} notes for puzzles...`, 0);
		try {
			const perFile = await mapInBatches(
				files,
				20,
				async (file): Promise<ReviewPuzzle[]> => {
					const text = await this.app.vault.cachedRead(file);
					if (!mentions.test(text)) return [];
					const found: ReviewPuzzle[] = [];
					for (const block of findChessBlocks(text, languages)) {
						const alias = block.language === "chessboard" ? null : (block.language as BlockAlias);
						// Read it the way the renderer does, so the scan matches what renders.
						const read = alias ? aliasBlock(alias, block.fenceLine, block.source) : block;
						const parsed = this.parseCodeBlock(read.source, read.fenceLine);
						if (!parsed || parsed.type !== "pgn" || parsed.options.mode !== "puzzle") continue;
						let pgn = parsed.content;
						if (parsed.options.src) {
							try {
								pgn = await this.readChessFile(this.resolveSrcPath(parsed.options.src, file.path));
							} catch {
								continue;
							}
						}
						if (!isPlayablePgn(pgn)) continue;
						found.push({ path: file.path, line: block.line, pgn, options: parsed.options });
					}
					return found;
				},
				(done) => notice.setMessage(`Scanning notes for puzzles... ${done} of ${files.length}`),
			);
			return perFile.flat();
		} finally {
			notice.hide();
		}
	}

	private parseCodeBlock(source: string, fenceLine: string): ParsedCodeBlock | null {
		const fenceOpts = parseOptions(fenceLine);

		const lines = source.split("\n");
		const header = lines[0].trim();

		// A type: inside a quoted value (a title, a src: path) does not count.
		// Options are read from the header as written, so a src: path or a
		// title keeps its case.
		const typed = blockType(fenceLine, header);
		if (typed) {
			return {
				type: typed.type,
				content: (typed.inHeader ? lines.slice(1) : lines).join("\n"),
				options: this.mergeOptions(fenceOpts, typed.inHeader ? parseOptions(header) : null),
			};
		}

		const trimmed = source.trim();

		if (looksLikeFen(trimmed)) {
			return { type: "fen", content: trimmed, options: fenceOpts };
		}

		const allLines = trimmed.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
		if (allLines.length > 1 && allLines.every((l) => looksLikeFen(l))) {
			return { type: "fen", content: trimmed, options: fenceOpts };
		}

		if (trimmed.startsWith("[") || /^\d+\./.test(trimmed)) {
			return { type: "pgn", content: trimmed, options: fenceOpts };
		}

		return null;
	}

	private mergeOptions(fence: CodeBlockOptions, inline: CodeBlockOptions | null): CodeBlockOptions {
		if (!inline) {
			return fence;
		}
		return {
			center: fence.center || inline.center,
			mode: inline.mode !== "normal" ? inline.mode : fence.mode,
			startAt: inline.startAt !== "start" ? inline.startAt : fence.startAt,
			flipped: inline.flipped || fence.flipped,
			diagram: inline.diagram || fence.diagram,
			explore: inline.explore && fence.explore,
			color: inline.color ?? fence.color,
			notation: inline.notation !== "san" ? inline.notation : fence.notation,
			pieces: inline.pieces ?? fence.pieces,
			arrows: inline.arrows ?? fence.arrows,
			squares: inline.squares ?? fence.squares,
			board: inline.board ?? fence.board,
			size: inline.size ?? fence.size,
			title: inline.title ?? fence.title,
			white: inline.white ?? fence.white,
			black: inline.black ?? fence.black,
			event: inline.event ?? fence.event,
			site: inline.site ?? fence.site,
			date: inline.date ?? fence.date,
			round: inline.round ?? fence.round,
			eco: inline.eco ?? fence.eco,
			result: inline.result ?? fence.result,
			src: inline.src ?? fence.src,
			game: inline.game ?? fence.game,
		};
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<ChessSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
		// Earlier versions read sets from the plugin folder; unknown names fall back.
		this.settings.fanPieceSet = resolvePieceSet(this.settings.fanPieceSet);
		// Earlier versions kept the board's CSS class here, which was always green.
		this.settings.boardTheme = resolveBoardTheme(null, this.settings.boardTheme);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
