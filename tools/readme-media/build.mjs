// Bundles the plugin plus the Obsidian stub into harness.js for page.html.
import esbuild from "esbuild";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

await esbuild.build({
	entryPoints: [here + "harness.ts"],
	bundle: true,
	format: "iife",
	target: "es2020",
	outfile: here + "harness.js",
	alias: { obsidian: here + "obsidian-stub.ts" },
	logLevel: "warning",
});
