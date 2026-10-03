import { Notice } from "obsidian";

export const ICON_COPY = "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z";
export const ICON_FEN = "M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z";

// Copies text, then says what was copied and flashes the button that did it.
// schedule is the viewer's own timer, so a closed note leaves nothing behind.
export function copyWithFeedback(
	btn: Element | null,
	text: string,
	what: string,
	schedule: (fn: () => void, ms: number) => void,
): void {
	void navigator.clipboard.writeText(text).then(() => {
		new Notice(`${what} copied`);
		if (!btn) return;
		btn.addClass("sfb-chess-btn-copied");
		schedule(() => btn.removeClass("sfb-chess-btn-copied"), 1500);
	});
}
