import { PIECES_SVG } from "./sprites";
import { PIECE_SETS } from "./piece-sets";

export type FanPieceKey = "wK" | "wQ" | "wR" | "wB" | "wN" | "bK" | "bQ" | "bR" | "bB" | "bN";
export type AllPieceKey = FanPieceKey | "wP" | "bP";

export type FullPieceSet = Record<AllPieceKey, string>;

// The cm-chessboard sprite pieces (Cburnett). Boards draw them natively, so
// this set needs no replacement; FAN reads its glyphs from the sprite.
export const STANDARD_PIECE_SET = "standard";

// Names saved by earlier versions, which shipped these sets as files.
const ALIASES: Record<string, string> = { cburnett: STANDARD_PIECE_SET };

const SVG_NS = "http://www.w3.org/2000/svg";

// Cache data URIs: "setName/wK" -> data URI
const uriCache = new Map<string, string>();

const CM_TO_KEY: Record<string, AllPieceKey> = {
	wk: "wK", wq: "wQ", wr: "wR", wb: "wB", wn: "wN", wp: "wP",
	bk: "bK", bq: "bQ", br: "bR", bb: "bB", bn: "bN", bp: "bP",
};

export function listPieceSets(): string[] {
	return [STANDARD_PIECE_SET, ...Object.keys(PIECE_SETS).sort()];
}

/** Maps a user-supplied name to a known set, falling back to the standard set. */
export function resolvePieceSet(name: string | null | undefined): string {
	const lower = (name ?? "").toLowerCase();
	const aliased = ALIASES[lower] ?? lower;
	return aliased in PIECE_SETS ? aliased : STANDARD_PIECE_SET;
}

/** The SVGs that replace the board's sprite pieces, or null for the standard set. */
export function getPieceSet(name: string): FullPieceSet | null {
	return PIECE_SETS[name] ?? null;
}

function standardPieceSvg(key: FanPieceKey): string | null {
	const sprite = new DOMParser().parseFromString(PIECES_SVG, "image/svg+xml");
	const piece = sprite.getElementById(key.toLowerCase());
	if (!piece) return null;
	const body = new XMLSerializer().serializeToString(piece);
	return `<svg xmlns="${SVG_NS}" viewBox="0 0 40 40">${body}</svg>`;
}

export function getPieceDataUri(setName: string, key: FanPieceKey): string | null {
	const cacheKey = `${setName}/${key}`;
	const cached = uriCache.get(cacheKey);
	if (cached) return cached;

	const svg = getPieceSet(setName)?.[key] ?? standardPieceSvg(key);
	if (!svg) return null;

	const uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
	uriCache.set(cacheKey, uri);
	return uri;
}

let pieceUidCounter = 0;

/**
 * Recursively recreate an SVG element tree using createElementNS in the
 * target document. importNode doesn't render in Electron -- this creates
 * fresh elements that are native to the live document.
 *
 * idSuffix is appended to all id attributes and url(#...) references
 * to prevent conflicts when multiple pieces share the same gradient/filter IDs.
 */
function recreateSvgElement(doc: Document, source: Element, idSuffix: string): Element {
	const el = doc.createElementNS(SVG_NS, source.localName);

	for (const attr of Array.from(source.attributes)) {
		if (attr.name.startsWith("xmlns")) continue;
		let value = attr.value;

		// Make IDs unique per piece instance
		if (attr.name === "id") {
			value = value + idSuffix;
		}
		// Rewrite url(#ref) references to match renamed IDs
		if (value.includes("url(#")) {
			value = value.replace(/url\(#([^)]+)\)/g, `url(#$1${idSuffix})`);
		}
		// Rewrite href="#ref" (e.g. in <use> or gradients)
		if ((attr.name === "href" || attr.name === "xlink:href") && value.startsWith("#")) {
			value = "#" + value.slice(1) + idSuffix;
		}

		if (attr.namespaceURI && attr.namespaceURI !== "http://www.w3.org/2000/xmlns/") {
			el.setAttributeNS(attr.namespaceURI, attr.localName, value);
		} else {
			el.setAttribute(attr.name, value);
		}
	}

	for (const child of Array.from(source.childNodes)) {
		if (child.nodeType === Node.ELEMENT_NODE) {
			el.appendChild(recreateSvgElement(doc, child as Element, idSuffix));
		} else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
			el.appendChild(doc.createTextNode(child.textContent));
		}
	}

	return el;
}

/**
 * Replace all <use> piece elements with inline SVG content from the piece set.
 * Each SVG is parsed with DOMParser and rebuilt node by node in the
 * container's document, so boards in popout windows work too.
 */
export function replacePiecesInContainer(container: HTMLElement, setName: string): void {
	const set = getPieceSet(setName);
	if (!set) return;

	const doc = container.ownerDocument;
	const useElements = container.querySelectorAll("use.piece");

	for (const useEl of Array.from(useElements)) {
		const href = useEl.getAttribute("href")
			?? useEl.getAttributeNS("http://www.w3.org/1999/xlink", "href");
		if (!href || !href.startsWith("#")) continue;
		const pieceName = href.slice(1);
		const pieceKey = CM_TO_KEY[pieceName];
		if (!pieceKey) continue;

		const svgStr = set[pieceKey];
		if (!svgStr) continue;

		const parent = useEl.parentNode;
		if (!parent) continue;

		// Parse fresh each time - no cached Documents
		const parsed = new DOMParser().parseFromString(svgStr, "image/svg+xml");
		const srcSvg = parsed.documentElement;
		const vb = srcSvg.getAttribute("viewBox") ?? "0 0 45 45";
		const parts = vb.split(/\s+/).map(Number);
		const srcSize = Math.max(parts[2] ?? 45, parts[3] ?? 45);
		const pieceScale = 40 / srcSize;

		const existingTransform = useEl.getAttribute("transform") ?? "";

		const g = doc.createElementNS(SVG_NS, "g");
		g.setAttribute("class", "piece");
		g.setAttribute("transform", `${existingTransform} scale(${pieceScale})`);

		const idSuffix = `-p${pieceUidCounter++}`;
		for (const child of Array.from(srcSvg.childNodes)) {
			if (child.nodeType === Node.ELEMENT_NODE) {
				g.appendChild(recreateSvgElement(doc, child as Element, idSuffix));
			}
		}

		parent.replaceChild(g, useEl);
	}
}
