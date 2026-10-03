import {
	Chessboard,
	FEN,
	COLOR,
	BORDER_TYPE,
	INPUT_EVENT_TYPE,
} from "cm-chessboard/src/Chessboard.js";
import type { ArrowType } from "cm-chessboard/src/Chessboard.js";
import { Markers } from "cm-chessboard/src/extensions/markers/Markers.js";
import { Arrows } from "cm-chessboard/src/extensions/arrows/Arrows.js";
import { Svg } from "cm-chessboard/src/lib/Svg.js";
import { Extension, EXTENSION_POINT } from "cm-chessboard/src/model/Extension.js";
import { squareLabel } from "./speech";
import { PIECES_SVG, MARKERS_SVG, ARROWS_SVG } from "./sprites";
import { getPieceSet, replacePiecesInContainer } from "./fan-pieces";
import {
	LAST_MOVE_LIGHT,
	LAST_MOVE_DARK,
	HINT_FROM_LIGHT,
	HINT_FROM_DARK,
	HINT_ARROW,
	WRONG_ARROW,
	SHAPE_ARROWS,
	SHAPE_SQUARES,
	isLightSquare,
} from "./types";
import type { ChessSettings } from "./types";
import type { BoardShapes } from "./pgn-parser";

interface MoveInputEvent {
	type: string;
	squareFrom: string;
	squareTo: string;
}

const SPRITE_IDS = ["cm-chessboard-sprite", "cm-chessboard-markers", "cm-chessboard-arrows"];

// Documents holding the sprites: the main window plus any popout that has
// rendered a board. <use href="#wk"> resolves only within its own document.
const spriteDocs = new Set<Document>();
let svgPatched = false;

function injectSprite(doc: Document, id: string, svgContent: string): void {
	if (doc.getElementById(id)) {
		return;
	}
	const parser = new DOMParser();
	const parsed = parser.parseFromString(svgContent, "image/svg+xml");
	const svg = parsed.documentElement;
	const wrapper = doc.body.createDiv({ cls: "sfb-chess-sprite-cache", attr: { id, "aria-hidden": "true" } });
	wrapper.appendChild(doc.importNode(svg, true));
}

export function injectSprites(doc: Document): void {
	if (!svgPatched) {
		Svg.removeElement = (element: unknown): void => {
			const el = element as Element | null;
			if (el && el.parentNode) {
				el.parentNode.removeChild(el);
			}
		};
		svgPatched = true;
	}

	injectSprite(doc, SPRITE_IDS[0], PIECES_SVG);
	injectSprite(doc, SPRITE_IDS[1], MARKERS_SVG);
	injectSprite(doc, SPRITE_IDS[2], ARROWS_SVG);
	spriteDocs.add(doc);
}

export function removeSprites(): void {
	for (const doc of spriteDocs) {
		for (const id of SPRITE_IDS) {
			doc.getElementById(id)?.remove();
		}
	}
	spriteDocs.clear();
}

let arrowBoardCount = 0;

// The stock extension names each arrow head's <marker> after its squares
// alone. Obsidian also renders a hidden copy of every block, so the first
// marker with that id is an invisible one and the arrow shows no head. Each
// board gets its own prefix instead.
class BoardArrows extends Arrows {
	private idPrefix = `sfb-arrow-${++arrowBoardCount}-`;

	drawArrow(arrow: { from: string; to: string; type: ArrowType }): void {
		super.drawArrow(arrow);
		const group = this.arrowGroup.lastElementChild;
		const marker = group?.querySelector("marker");
		const line = group?.querySelector("line");
		if (!marker || !line) return;
		// The type is in the id too: two arrows on the same squares (a hint
		// over a PGN drawing) would otherwise share one head colour.
		marker.id = this.idPrefix + arrow.type.class + "-" + arrow.from + arrow.to;
		line.setAttribute("marker-end", `url(#${marker.id})`);
	}
}

// The stock board is one role="img" SVG, so screen readers see nothing on it.
// This makes it a group and labels each square with what stands on it, e.g.
// "e4, white knight", after every redraw and position change.
class SquareLabels extends Extension {
	constructor(chessboard: unknown) {
		super(chessboard);
		this.registerExtensionPoint(EXTENSION_POINT.afterRedrawBoard, () => this.label());
		this.registerExtensionPoint(EXTENSION_POINT.positionChanged, () => this.label());
	}

	private label(): void {
		const svg = this.chessboard.view.svg;
		if (!svg) return;
		svg.setAttribute("role", "group");
		svg.setAttribute("aria-label", "Chessboard");
		for (const layer of Array.from(svg.querySelectorAll(".pieces-layer, .markers-layer, .markers-top-layer"))) {
			layer.setAttribute("aria-hidden", "true");
		}
		for (const rect of Array.from(svg.querySelectorAll("rect[data-square]"))) {
			const square = rect.getAttribute("data-square") ?? "";
			rect.setAttribute("role", "img");
			rect.setAttribute("aria-label", squareLabel(square, this.chessboard.getPiece(square)));
		}
	}
}

export class BoardManager {
	private board: Chessboard;
	private container: HTMLElement;
	private pieceSetName: string | null = null;
	private timers = new Set<number>();
	private shapesShown = false;

	constructor(
		container: HTMLElement,
		fen: string,
		settings: ChessSettings,
		pieceSetName?: string,
	) {
		this.container = container;
		// The standard set is the sprite the board already draws.
		this.pieceSetName = pieceSetName && getPieceSet(pieceSetName) ? pieceSetName : null;
		injectSprites(container.doc);

		this.board = new Chessboard(container, {
			position: fen || FEN.start,
			orientation: COLOR.white,
			responsive: true,
			assetsCache: true,
			assetsUrl: "",
			style: {
				cssClass: settings.boardTheme,
				showCoordinates: settings.showCoordinates,
				borderType: BORDER_TYPE.none,
				aspectRatio: 1,
				animationDuration: settings.animationDuration,
			},
			extensions: [
				{
					class: Markers,
					props: { autoMarkers: null },
				},
				{
					class: BoardArrows,
					props: {},
				},
				{
					class: SquareLabels,
					props: {},
				},
			],
		});

		this.replacePieces();
		// Catch late redraws from resize observer on initial load
		if (this.pieceSetName) {
			this.later(() => {
				if (this.container.querySelectorAll("use.piece").length > 0) {
					this.replacePieces();
				}
			}, 300);
		}
	}

	private later(fn: () => void, ms: number): void {
		const id = window.setTimeout(() => {
			this.timers.delete(id);
			fn();
		}, ms);
		this.timers.add(id);
	}

	private replacePieces(): void {
		if (!this.pieceSetName) return;
		replacePiecesInContainer(this.container, this.pieceSetName);
	}

	setPosition(fen: string, animated: boolean = true): Promise<void> {
		const p = this.board.setPosition(fen, animated);
		if (this.pieceSetName) {
			void p.then(() => this.replacePieces());
		}
		return p;
	}

	highlightLastMove(from: string, to: string): void {
		this.board.removeMarkers(LAST_MOVE_LIGHT);
		this.board.removeMarkers(LAST_MOVE_DARK);

		const fromType = isLightSquare(from) ? LAST_MOVE_LIGHT : LAST_MOVE_DARK;
		const toType = isLightSquare(to) ? LAST_MOVE_LIGHT : LAST_MOVE_DARK;

		this.board.addMarker(fromType, from);
		this.board.addMarker(toType, to);
	}

	// Replaces the drawings from the previous position's comment with these.
	// Each remove redraws the board, so a game without drawings skips them.
	showShapes(shapes: BoardShapes): void {
		if (this.shapesShown) {
			for (const type of Object.values(SHAPE_ARROWS)) this.board.removeArrows(type);
			for (const type of Object.values(SHAPE_SQUARES)) this.board.removeMarkers(type);
		}
		this.shapesShown = shapes.arrows.length > 0 || shapes.squares.length > 0;
		for (const arrow of shapes.arrows) {
			this.board.addArrow(SHAPE_ARROWS[arrow.color], arrow.from, arrow.to);
		}
		for (const square of shapes.squares) {
			this.board.addMarker(SHAPE_SQUARES[square.color], square.square);
		}
	}

	clearHighlights(): void {
		this.board.removeMarkers(LAST_MOVE_LIGHT);
		this.board.removeMarkers(LAST_MOVE_DARK);
	}

	flip(): void {
		const current = this.board.getOrientation();
		const next = current === COLOR.white ? COLOR.black : COLOR.white;
		void this.board.setOrientation(next, true).then(() => this.replacePieces());
	}

	getOrientation(): string {
		return this.board.getOrientation();
	}

	enablePuzzleInput(
		canPickUp: (square: string) => boolean,
		isLegal: (from: string, to: string) => boolean,
		onMoveFinished: (from: string, to: string) => void,
	): void {
		try { this.board.disableMoveInput(); } catch { /* not enabled */ }
		this.board.enableMoveInput((event: MoveInputEvent) => {
			if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
				return canPickUp(event.squareFrom);
			}
			if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
				return isLegal(event.squareFrom, event.squareTo);
			}
			if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
				onMoveFinished(event.squareFrom, event.squareTo);
			}
			return undefined;
		});
	}

	disablePuzzleInput(): void {
		try { this.board.disableMoveInput(); } catch { /* ignore */ }
	}

	flashWrong(): void {
		this.container.addClass("sfb-chess-wrong-flash");
		this.later(() => {
			this.container.removeClass("sfb-chess-wrong-flash");
		}, 400);
	}

	clearHintMarkers(): void {
		this.board.removeMarkers(HINT_FROM_LIGHT);
		this.board.removeMarkers(HINT_FROM_DARK);
		this.board.removeArrows(HINT_ARROW);
	}

	addHintFromMarker(square: string): void {
		const type = isLightSquare(square) ? HINT_FROM_LIGHT : HINT_FROM_DARK;
		this.board.addMarker(type, square);
	}

	addHintArrow(from: string, to: string): void {
		this.board.addArrow(HINT_ARROW, from, to);
	}

	showWrongArrow(from: string, to: string): void {
		this.board.addArrow(WRONG_ARROW, from, to);
	}

	clearWrongArrow(): void {
		this.board.removeArrows(WRONG_ARROW);
	}

	destroy(): void {
		for (const id of this.timers) window.clearTimeout(id);
		this.timers.clear();
		this.board.destroy();
	}
}
