/// <reference lib="dom" />
import Prism from "prismjs";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-json";
import "prismjs/components/prism-css";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-go";

type WebviewOutbound =
	| { type: "load"; name: string; content: string }
	| { type: "empty" };

declare function acquireVsCodeApi(): {
	postMessage(message: unknown): void;
};

const vscode = acquireVsCodeApi();
const editor = document.getElementById("editor") as HTMLTextAreaElement;
const highlightPre = document.getElementById("highlight") as HTMLPreElement;
const highlightCode = highlightPre.querySelector("code") as HTMLElement;
const title = document.getElementById("title") as HTMLElement;
const empty = document.getElementById("empty") as HTMLElement;
const wrap = document.getElementById("editor-wrap") as HTMLElement;

let current: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function renderHighlight(value: string): void {
	const withTrailing = value.endsWith("\n") ? `${value} ` : `${value}\n`;
	highlightCode.innerHTML = Prism.highlight(
		withTrailing,
		Prism.languages.markdown,
		"markdown",
	);
}

function showEditor(name: string, content: string): void {
	current = name;
	title.textContent = name;
	editor.value = content;
	renderHighlight(content);
	wrap.classList.remove("hidden");
	empty.classList.add("hidden");
}

function showEmpty(): void {
	current = null;
	title.textContent = "No note";
	wrap.classList.add("hidden");
	empty.classList.remove("hidden");
}

editor.addEventListener("input", () => {
	renderHighlight(editor.value);
	if (current === null) {
		return;
	}
	if (saveTimer) {
		clearTimeout(saveTimer);
	}
	saveTimer = setTimeout(() => {
		vscode.postMessage({ type: "change", content: editor.value });
	}, 500);
});

editor.addEventListener("scroll", () => {
	highlightPre.scrollTop = editor.scrollTop;
	highlightPre.scrollLeft = editor.scrollLeft;
});

editor.addEventListener("keydown", (e) => {
	if (e.key === "Tab") {
		e.preventDefault();
		const s = editor.selectionStart;
		const en = editor.selectionEnd;
		editor.value = `${editor.value.slice(0, s)}  ${editor.value.slice(en)}`;
		editor.selectionStart = editor.selectionEnd = s + 2;
		editor.dispatchEvent(new Event("input"));
	}
});

window.addEventListener("message", (event: MessageEvent<WebviewOutbound>) => {
	const msg = event.data;
	if (msg.type === "load") {
		showEditor(msg.name, msg.content);
	} else if (msg.type === "empty") {
		showEmpty();
	}
});

vscode.postMessage({ type: "ready" });
