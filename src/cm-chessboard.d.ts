declare module "cm-chessboard/src/Chessboard.js" {
	export const PIECE: Record<string, string>;
	export const PIECE_TYPE: Record<string, string>;
	export const PIECES_FILE_TYPE: { svgSprite: string };
	export const COLOR: { white: string; black: string };
	export const INPUT_EVENT_TYPE: Record<string, string>;
	export const POINTER_EVENTS: Record<string, string>;
	export const BORDER_TYPE: { none: string; thin: string; frame: string };
	export const FEN: { start: string; empty: string };

	export interface ChessboardProps {
		position?: string;
		orientation?: string;
		responsive?: boolean;
		assetsUrl?: string;
		assetsCache?: boolean;
		style?: {
			cssClass?: string;
			showCoordinates?: boolean;
			borderType?: string;
			aspectRatio?: number;
			pieces?: {
				type?: string;
				file?: string;
				tileSize?: number;
			};
			animationDuration?: number;
		};
		extensions?: Array<{ class: unknown; props?: Record<string, unknown> }>;
	}

	export class Chessboard {
		constructor(context: HTMLElement, props?: ChessboardProps);
		setPosition(fen: string, animated?: boolean): Promise<void>;
		getPosition(): string;
		setPiece(square: string, piece: string | null, animated?: boolean): Promise<void>;
		getPiece(square: string): string | null;
		movePiece(from: string, to: string, animated?: boolean): Promise<void>;
		setOrientation(color: string, animated?: boolean): Promise<void>;
		getOrientation(): string;
		enableMoveInput(handler: (event: unknown) => boolean | void, color?: string): void;
		disableMoveInput(): void;
		destroy(): void;
		addMarker(type: MarkerType, square: string): void;
		removeMarkers(type?: MarkerType, square?: string): void;
		getMarkers(type?: MarkerType, square?: string): unknown[];
		addArrow(type: ArrowType, from: string, to: string): void;
		removeArrows(type?: ArrowType, from?: string, to?: string): void;
		getArrows(type?: ArrowType, from?: string, to?: string): unknown[];
		view: {
			cacheSpriteToDiv(id: string, url: string): void;
		};
	}

	export interface MarkerType {
		class: string;
		slice: string;
		position?: string;
	}

	export interface ArrowType {
		class: string;
	}
}

declare module "cm-chessboard/src/lib/Svg.js" {
	export class Svg {
		static removeElement(element: unknown): void;
		static createSvg(containerElement?: unknown): SVGElement;
		static addElement(parent: unknown, name: string, attributes?: Record<string, unknown>): SVGElement;
	}
}

declare module "cm-chessboard/src/extensions/markers/Markers.js" {
	import type { MarkerType } from "cm-chessboard/src/Chessboard.js";
	export const MARKER_TYPE: {
		frame: MarkerType;
		framePrimary: MarkerType;
		frameDanger: MarkerType;
		circle: MarkerType;
		circlePrimary: MarkerType;
		circleDanger: MarkerType;
		circleDangerFilled: MarkerType;
		square: MarkerType;
		dot: MarkerType;
		bevel: MarkerType;
	};
	export class Markers {
		constructor(chessboard: unknown, props?: Record<string, unknown>);
	}
}

declare module "cm-chessboard/src/extensions/arrows/Arrows.js" {
	import type { ArrowType } from "cm-chessboard/src/Chessboard.js";
	export const ARROW_TYPE: {
		default: ArrowType;
		success: ArrowType;
		secondary: ArrowType;
		warning: ArrowType;
		info: ArrowType;
		danger: ArrowType;
	};
	export class Arrows {
		constructor(chessboard: unknown, props?: Record<string, unknown>);
		arrowGroup: SVGGElement;
		drawArrow(arrow: { from: string; to: string; type: ArrowType }): void;
	}
}

declare module "cm-chessboard/src/model/Extension.js" {
	export const EXTENSION_POINT: {
		positionChanged: string;
		boardChanged: string;
		afterRedrawBoard: string;
	};
	export class Extension {
		constructor(chessboard: unknown);
		chessboard: {
			getPiece(square: string): string | null;
			view: { svg: SVGSVGElement };
		};
		registerExtensionPoint(name: string, callback: () => void): void;
	}
}
