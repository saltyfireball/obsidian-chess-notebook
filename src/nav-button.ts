// The icon button every viewer's controls are built from: an 18px filled SVG
// path with its label for screen readers.
export function createNavButton(
	parent: HTMLElement,
	label: string,
	iconPath: string,
	handler: () => void,
	cls = "sfb-chess-btn",
): HTMLButtonElement {
	const btn = parent.createEl("button", { cls, attr: { "aria-label": label } });
	const svg = createSvg("svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("width", "18");
	svg.setAttribute("height", "18");
	const path = createSvg("path");
	path.setAttribute("fill", "currentColor");
	path.setAttribute("d", iconPath);
	svg.appendChild(path);
	btn.appendChild(svg);
	btn.addEventListener("click", handler);
	return btn;
}
