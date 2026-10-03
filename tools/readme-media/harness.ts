// Runs the real plugin in a browser page: installs Obsidian's DOM helpers,
// loads ChessPlugin against the stub app, and exposes window.chess so the
// capture script can render code blocks, edit vault files and show settings.

import { App, Component, type MarkdownPostProcessorContext } from "./obsidian-stub";
import ChessPlugin from "../../src/main";

interface ElOpts {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string | number | boolean>;
	title?: string;
	type?: string;
	value?: string;
	href?: string;
	prepend?: boolean;
	parent?: HTMLElement;
}

function applyOpts(el: HTMLElement, o?: ElOpts | string): void {
	if (!o) return;
	if (typeof o === "string") {
		el.className = o;
		return;
	}
	if (o.cls) el.classList.add(...(Array.isArray(o.cls) ? o.cls : o.cls.split(" ")).filter(Boolean));
	if (o.text !== undefined) el.textContent = o.text;
	if (o.title) el.title = o.title;
	if (o.type) el.setAttribute("type", o.type);
	if (o.value !== undefined) (el as HTMLInputElement).value = o.value;
	if (o.href) el.setAttribute("href", o.href);
	for (const [k, v] of Object.entries(o.attr ?? {})) el.setAttribute(k, String(v));
}

function installDomHelpers(): void {
	const N = Node.prototype as unknown as Record<string, unknown>;
	const E = Element.prototype as unknown as Record<string, unknown>;
	const create = function (this: HTMLElement, tag: string, o?: ElOpts | string, cb?: (el: HTMLElement) => void) {
		const el = this.ownerDocument.createElement(tag);
		applyOpts(el, o);
		if (typeof o === "object" && o?.prepend) this.prepend(el);
		else this.appendChild(el);
		cb?.(el);
		return el;
	};
	N.createEl = create;
	N.createDiv = function (this: HTMLElement, o?: ElOpts | string, cb?: (el: HTMLElement) => void) {
		return create.call(this, "div", o, cb);
	};
	N.createSpan = function (this: HTMLElement, o?: ElOpts | string, cb?: (el: HTMLElement) => void) {
		return create.call(this, "span", o, cb);
	};
	(window as unknown as Record<string, unknown>).createSvg = function (tag: string, o?: ElOpts | string) {
		const el = document.createElementNS("http://www.w3.org/2000/svg", tag) as unknown as HTMLElement;
		applyOpts(el, o);
		return el;
	};
	N.instanceOf = function (this: Node, type: new () => unknown) {
		return this instanceof type;
	};
	N.empty = function (this: Node) {
		while (this.firstChild) this.removeChild(this.firstChild);
	};
	N.setText = function (this: Node, t: string) {
		this.textContent = t;
	};
	N.appendText = function (this: Node, t: string) {
		this.appendChild(document.createTextNode(t));
	};
	Object.defineProperty(Node.prototype, "doc", {
		get(this: Node) {
			return this.ownerDocument ?? document;
		},
	});
	Object.defineProperty(Node.prototype, "win", {
		get(this: Node) {
			return (this.ownerDocument ?? document).defaultView ?? window;
		},
	});
	E.addClass = function (this: Element, ...c: string[]) {
		this.classList.add(...c);
	};
	E.removeClass = function (this: Element, ...c: string[]) {
		this.classList.remove(...c);
	};
	E.toggleClass = function (this: Element, c: string, v?: boolean) {
		this.classList.toggle(c, v);
	};
	E.hasClass = function (this: Element, c: string) {
		return this.classList.contains(c);
	};
	E.find = function (this: Element, s: string) {
		return this.querySelector(s);
	};
	E.findAll = function (this: Element, s: string) {
		return Array.from(this.querySelectorAll(s));
	};
	E.setAttr = function (this: Element, k: string, v: string) {
		this.setAttribute(k, v);
	};
	const W = window as unknown as Record<string, unknown>;
	W.activeDocument = document;
	W.activeWindow = window;
}

installDomHelpers();

const app = new App();
const plugin = new ChessPlugin(app as never, { id: "chess-notebook" } as never);
const note = new Component();
note.load();

async function start(settings?: Record<string, unknown>): Promise<void> {
	if (settings) await plugin.saveData(settings);
	plugin.load();
	// onload is async (loadSettings); give it a tick to finish.
	await new Promise((r) => setTimeout(r, 0));
}

// Renders one chessboard block into `el`, the way Obsidian's reading view does.
function render(el: HTMLElement, fenceLine: string, source: string, sourcePath = "Notes/Chess.md"): void {
	const proc = (plugin as unknown as { processors: Map<string, Function> }).processors.get("chessboard")!;
	const text = "```chessboard " + fenceLine + "\n" + source + "\n```";
	const ctx: MarkdownPostProcessorContext = {
		sourcePath,
		addChild: (c) => note.addChild(c),
		getSectionInfo: () => ({ text, lineStart: 0, lineEnd: text.split("\n").length - 1 }),
	};
	el.addClass("block-language-chessboard");
	proc(source, el, ctx);
}

function writeFile(path: string, content: string): void {
	app.vault.write(path, content);
}

function showSettings(el: HTMLElement): void {
	const tab = (plugin as unknown as { settingTab: { containerEl: HTMLElement; display(): void } }).settingTab;
	el.appendChild(tab.containerEl);
	tab.display();
}

(window as unknown as Record<string, unknown>).chess = { start, render, writeFile, showSettings };
