import { Editor, Notice, Plugin, MarkdownPostProcessorContext, MarkdownRenderChild, TAbstractFile, TFile, normalizePath } from "obsidian";
import { boardBlockFor, insideCodeBlock } from "./paste-board";
import { FenViewer } from "./fen-viewer";
import { FenSequenceViewer } from "./fen-sequence-viewer";
import { PgnViewer } from "./pgn-viewer";
import { ChessSettingTab } from "./settings";
import { injectSprites, removeSprites } from "./board-manager";
import { resolvePieceSet } from "./fan-pieces";
import { parseBoardSize, resolveBoardSize } from "./board-size";
import type { ChessSettings, ParsedCodeBlock, CodeBlockOptions } from "./types";
import { DEFAULT_SETTINGS, normalizeFen } from "./types";
import { BLOCK_ALIASES, aliasType, looksLikeFen } from "./chess-format";
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

export default class ChessPlugin extends Plugin {
	settings!: ChessSettings;
	private fileCache = new Map<string, { mtime: number; content: string }>();
	private fileBoundBlocks = new Map<string, FileBoundBlock[]>();
	private blockChildren = new Map<HTMLElement, ChessBlockChild>();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ChessSettingTab(this.app, this));
		this.addPasteCommand();
		injectSprites(document);

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
			if (this.settings[ALIAS_SETTING[alias]]) this.registerBlockProcessor(alias, alias);
		}
	}

	private registerBlockProcessor(language: string, alias: BlockAlias | null): void {
		const handler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const child = new ChessBlockChild(el, (gone) => this.forgetBlock(gone));
			this.blockChildren.set(el, child);
			ctx.addChild(child);
			let fenceLine = this.extractFenceLine(el, ctx, language);
			// An alias block is a chessboard block with its type: implied.
			if (alias && !/type:(fen|pgn)/i.test(fenceLine)) {
				const type = aliasType(alias, source, this.parseOptions(fenceLine).src);
				fenceLine = `type:${type} ${fenceLine}`.trim();
			}
			void this.processCodeBlock(source, el, fenceLine, ctx.sourcePath);
		};
		try {
			this.registerMarkdownCodeBlockProcessor(language, handler);
		} catch (e: unknown) {
			// Another processor already owns this name; leave it to that one.
			console.warn(`chess-notebook: could not register ${language} code blocks`, e);
		}
	}

	onunload(): void {
		for (const child of Array.from(this.blockChildren.values())) {
			child.unload();
		}
		removeSprites();
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
				const cursor = editor.getCursor("from");
				if (insideCodeBlock(editor.getValue().split("\n"), cursor.line)) {
					new Notice("Place the caret outside the code block first.");
					return;
				}
				let text: string;
				try {
					text = await navigator.clipboard.readText();
				} catch {
					new Notice("Could not read the clipboard.");
					return;
				}
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

	private extractFenceLine(el: HTMLElement, ctx: MarkdownPostProcessorContext, language: string): string {
		try {
			const info = ctx.getSectionInfo(el);
			if (!info || !info.text) {
				return "";
			}
			const lines = info.text.split("\n");
			const fenceLineText = lines[info.lineStart] ?? "";
			const match = new RegExp("^`{3,}\\s*" + language + "\\s*(.*)", "i").exec(fenceLineText);
			return match ? match[1].trim() : "";
		} catch {
			return "";
		}
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

			const child = this.blockChildren.get(el);
			if (!child || child.gone) return;
			this.clearBlock(el);

			if (parsed.options.center) {
				el.addClass("sfb-chess-center-wrapper");
			}
			// The board width, read by the stylesheet. Set every render, so
			// removing size: from a block puts it back to the default.
			el.setCssProps({ "--sfb-board-size": `${resolveBoardSize(parsed.options.size, this.settings.boardSize)}px` });

			if (parsed.type === "fen") {
				const fens = content
					.split("\n")
					.map((l) => l.trim())
					.filter((l) => l.length > 0 && looksLikeFen(l))
					.map((l) => normalizeFen(l));

				if (fens.length > 1) {
					child.setViewer(new FenSequenceViewer(el, fens, parsed.options, this.settings));
				} else {
					child.setViewer(new FenViewer(el, fens[0] ?? normalizeFen(content.trim()), parsed.options, this.settings));
				}
			} else {
				child.setViewer(new PgnViewer(el, content, parsed.options, this.settings));
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Unknown error rendering chessboard";
			this.clearBlock(el);
			el.createDiv({ cls: "sfb-chess-error", text: "Chessboard error: " + msg });
		}
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

	private parseOptions(line: string): CodeBlockOptions {
		const opts: CodeBlockOptions = {
			center: true,
			mode: "normal",
			startAt: "start",
			flipped: false,
			color: null,
			notation: "san",
			pieces: null,
			size: null,
			title: null,
			white: null,
			black: null,
			event: null,
			site: null,
			date: null,
			round: null,
			eco: null,
			result: null,
			src: null,
		};

		const srcMatch = /src:(?:"([^"]+)"|(\S+))/i.exec(line);
		if (srcMatch) {
			opts.src = srcMatch[1] ?? srcMatch[2];
		}

		const boolMatch = /center:(true|false)/i.exec(line);
		if (boolMatch && boolMatch[1].toLowerCase() === "false") {
			opts.center = false;
		}

		const flippedMatch = /flipped:(true|false)/i.exec(line);
		if (flippedMatch && flippedMatch[1].toLowerCase() === "true") {
			opts.flipped = true;
		}

		const modeMatch = /mode:(normal|puzzle|step|drill)/i.exec(line);
		if (modeMatch) {
			const modeVal = modeMatch[1].toLowerCase();
			if (modeVal === "puzzle" || modeVal === "step" || modeVal === "drill") {
				opts.mode = modeVal;
			}
		}

		const colorMatch = /color:(white|black)/i.exec(line);
		if (colorMatch) {
			opts.color = colorMatch[1].toLowerCase() === "black" ? "b" : "w";
		}

		const notationMatch = /notation:(san|fan)/i.exec(line);
		if (notationMatch && notationMatch[1].toLowerCase() === "fan") {
			opts.notation = "fan";
		}

		const piecesMatch = /pieces:([\w-]+)/i.exec(line);
		if (piecesMatch) {
			opts.pieces = piecesMatch[1].toLowerCase();
		}

		const sizeMatch = /\bsize:(\w+)/i.exec(line);
		if (sizeMatch) {
			opts.size = parseBoardSize(sizeMatch[1]);
		}

		const startAtMatch = /start_at:(\w+)/i.exec(line);
		if (startAtMatch) {
			const val = startAtMatch[1].toLowerCase();
			if (val === "end") {
				opts.startAt = "end";
			} else if (val !== "start") {
				const num = parseInt(val);
				if (!isNaN(num) && num >= 0) {
					opts.startAt = num;
				}
			}
		}

		const quotedPattern = /(\w+):"([^"]*)"/g;
		let match: RegExpExecArray | null = quotedPattern.exec(line);
		while (match !== null) {
			const key = match[1].toLowerCase();
			const value = match[2];
			if (key === "title") opts.title = value;
			else if (key === "white") opts.white = value;
			else if (key === "black") opts.black = value;
			else if (key === "event") opts.event = value;
			else if (key === "site") opts.site = value;
			else if (key === "date") opts.date = value;
			else if (key === "round") opts.round = value;
			else if (key === "eco") opts.eco = value;
			else if (key === "result") opts.result = value;
			match = quotedPattern.exec(line);
		}

		return opts;
	}

	private parseCodeBlock(source: string, fenceLine: string): ParsedCodeBlock | null {
		const fenceOpts = this.parseOptions(fenceLine);
		const fenceLower = fenceLine.toLowerCase();

		const lines = source.split("\n");
		const firstLine = lines[0].trim().toLowerCase();

		if (fenceLower.includes("type:fen") || firstLine.includes("type:fen")) {
			const contentLines = firstLine.includes("type:fen") ? lines.slice(1) : lines;
			const firstLineOpts = firstLine.includes("type:fen") ? this.parseOptions(firstLine) : null;
			return {
				type: "fen",
				content: contentLines.join("\n"),
				options: this.mergeOptions(fenceOpts, firstLineOpts),
			};
		}

		if (fenceLower.includes("type:pgn") || firstLine.includes("type:pgn")) {
			const contentLines = firstLine.includes("type:pgn") ? lines.slice(1) : lines;
			const firstLineOpts = firstLine.includes("type:pgn") ? this.parseOptions(firstLine) : null;
			return {
				type: "pgn",
				content: contentLines.join("\n"),
				options: this.mergeOptions(fenceOpts, firstLineOpts),
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
			color: inline.color ?? fence.color,
			notation: inline.notation !== "san" ? inline.notation : fence.notation,
			pieces: inline.pieces ?? fence.pieces,
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
		};
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<ChessSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
		// Earlier versions read sets from the plugin folder; unknown names fall back.
		this.settings.fanPieceSet = resolvePieceSet(this.settings.fanPieceSet);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
