import { Notice } from "obsidian";
import { copyText, type CopyDeps } from "./copy-feedback";

export const ICON_COPY = "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z";
export const ICON_FEN = "M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z";

// Copies text to the system clipboard with a Notice either way.
// The viewer passes its timer and whether it is still open.
export function copyWithFeedback(
	btn: HTMLElement | null,
	text: string,
	what: string,
	viewer: Pick<CopyDeps, "schedule" | "alive">,
): void {
	void copyText(btn, text, what, {
		write: (t) => navigator.clipboard.writeText(t),
		notify: (message) => new Notice(message),
		...viewer,
	});
}
