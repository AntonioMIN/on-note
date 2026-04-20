import * as vscode from "vscode";
import type { NoteName, NoteStore } from "./noteStore";

const CURRENT_NOTE_KEY = "on-note.currentNote";
const DEFAULT_NOTE = "welcome";

type WebviewInbound = { type: "ready" } | { type: "change"; content: string };

type WebviewOutbound =
	| { type: "load"; name: NoteName; content: string }
	| { type: "empty" };

export class NoteEditorView implements vscode.WebviewViewProvider {
	public static readonly viewId = "on-note.editor";

	private view?: vscode.WebviewView;
	private currentNote?: NoteName;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly store: NoteStore,
	) {
		this.currentNote = context.globalState.get<NoteName>(CURRENT_NOTE_KEY);
	}

	getCurrentNote(): NoteName | undefined {
		return this.currentNote;
	}

	async switchTo(name: NoteName): Promise<void> {
		this.currentNote = name;
		await this.context.globalState.update(CURRENT_NOTE_KEY, name);
		await vscode.commands.executeCommand(`${NoteEditorView.viewId}.focus`);
		await this.pushCurrent();
	}

	async clearCurrent(): Promise<void> {
		this.currentNote = undefined;
		await this.context.globalState.update(CURRENT_NOTE_KEY, undefined);
		this.post({ type: "empty" });
	}

	async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.context.extensionUri, "dist"),
			],
		};
		webviewView.webview.html = this.renderHtml(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((msg: WebviewInbound) => {
			if (msg.type === "ready") {
				void this.pushCurrent();
			} else if (msg.type === "change") {
				void this.handleChange(msg.content);
			}
		});

		webviewView.onDidDispose(() => {
			this.view = undefined;
		});
	}

	private async handleChange(content: string): Promise<void> {
		if (!this.currentNote) {
			return;
		}
		try {
			await this.store.write(this.currentNote, content);
		} catch (err) {
			vscode.window.showErrorMessage(
				`Failed to save note: ${(err as Error).message}`,
			);
		}
	}

	private async pushCurrent(): Promise<void> {
		if (!this.view) {
			return;
		}
		let name = this.currentNote;
		if (!name || !(await this.store.exists(name))) {
			const list = await this.store.list();
			name = list[0];
			if (!name) {
				await this.store.create(DEFAULT_NOTE);
				name = DEFAULT_NOTE;
			}
			this.currentNote = name;
			await this.context.globalState.update(CURRENT_NOTE_KEY, name);
		}
		const content = await this.store.read(name);
		this.post({ type: "load", name, content });
	}

	private post(msg: WebviewOutbound): void {
		this.view?.webview.postMessage(msg);
	}

	private renderHtml(webview: vscode.Webview): string {
		const nonce = generateNonce();
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"),
		);
		const csp = [
			"default-src 'none'",
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src ${webview.cspSource} 'nonce-${nonce}'`,
		].join("; ");

		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  html, body { height: 100%; margin: 0; padding: 0; }
  body {
    display: flex; flex-direction: column;
    background: var(--vscode-sideBar-background);
    color: var(--vscode-foreground);
    font-family: var(--vscode-font-family);
  }
  header {
    padding: 6px 10px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #editor-wrap {
    position: relative;
    flex: 1 1 auto;
    overflow: hidden;
    background: var(--vscode-editor-background);
  }
  #editor, #highlight {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 10px;
    border: 0;
    box-sizing: border-box;
    font-family: var(--vscode-editor-font-family, ui-monospace, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    line-height: 1.5;
    tab-size: 2;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  #editor {
    resize: none;
    outline: none;
    background: transparent;
    color: transparent;
    caret-color: var(--vscode-editorCursor-foreground, var(--vscode-foreground));
    z-index: 1;
    overflow: auto;
  }
  #editor::selection {
    background: var(--vscode-editor-selectionBackground);
  }
  #highlight {
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
    color: var(--vscode-editor-foreground);
  }
  #highlight code {
    display: block;
    font: inherit;
    white-space: inherit;
    word-wrap: inherit;
    overflow-wrap: inherit;
    min-height: 100%;
  }
  #empty {
    flex: 1 1 auto;
    display: flex; align-items: center; justify-content: center;
    padding: 16px; text-align: center;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
  }
  .hidden { display: none !important; }

  /* Prism tokens — Dark+ palette (default, also applied in high contrast) */
  .token.comment, .token.prolog, .token.doctype, .token.cdata { color: #6a9955; font-style: italic; }
  .token.punctuation { color: #808080; }
  .token.property, .token.tag, .token.constant, .token.symbol, .token.deleted { color: #569cd6; }
  .token.boolean, .token.number { color: #b5cea8; }
  .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: #ce9178; }
  .token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string, .token.variable { color: #d4d4d4; }
  .token.atrule, .token.attr-value, .token.keyword { color: #569cd6; }
  .token.function, .token.class-name { color: #dcdcaa; }
  .token.regex, .token.important { color: #d16969; }
  .token.important, .token.bold { font-weight: bold; }
  .token.italic { font-style: italic; }

  /* Markdown-specific */
  .token.title, .token.title .token.punctuation { color: #4ec9b0; font-weight: bold; }
  .token.list.punctuation { color: #569cd6; }
  .token.url { color: #569cd6; text-decoration: underline; }
  .token.url-reference .token.string, .token.url .token.content { color: #9cdcfe; }
  .token.blockquote.punctuation { color: #6a9955; }
  .token.hr.punctuation { color: #808080; }
  .token.code-snippet { color: #ce9178; background: rgba(255,255,255,0.04); }
  .token.table-header { color: #4ec9b0; font-weight: bold; }

  /* Light+ palette */
  body.vscode-light .token.comment,
  body.vscode-light .token.prolog,
  body.vscode-light .token.doctype,
  body.vscode-light .token.cdata { color: #008000; }
  body.vscode-light .token.punctuation { color: #555555; }
  body.vscode-light .token.property,
  body.vscode-light .token.tag,
  body.vscode-light .token.constant,
  body.vscode-light .token.symbol,
  body.vscode-light .token.deleted { color: #0000ff; }
  body.vscode-light .token.boolean,
  body.vscode-light .token.number { color: #098658; }
  body.vscode-light .token.selector,
  body.vscode-light .token.attr-name,
  body.vscode-light .token.string,
  body.vscode-light .token.char,
  body.vscode-light .token.builtin,
  body.vscode-light .token.inserted { color: #a31515; }
  body.vscode-light .token.operator,
  body.vscode-light .token.entity,
  body.vscode-light .token.variable { color: #333333; }
  body.vscode-light .token.atrule,
  body.vscode-light .token.attr-value,
  body.vscode-light .token.keyword { color: #0000ff; }
  body.vscode-light .token.function,
  body.vscode-light .token.class-name { color: #795e26; }
  body.vscode-light .token.regex,
  body.vscode-light .token.important { color: #af00db; }
  body.vscode-light .token.title,
  body.vscode-light .token.title .token.punctuation { color: #267f99; }
  body.vscode-light .token.list.punctuation { color: #0000ff; }
  body.vscode-light .token.url { color: #0000ee; }
  body.vscode-light .token.blockquote.punctuation { color: #008000; }
  body.vscode-light .token.code-snippet { color: #a31515; background: rgba(0,0,0,0.04); }
</style>
</head>
<body>
  <header id="title">No note</header>
  <div id="editor-wrap" class="hidden">
    <pre id="highlight" aria-hidden="true"><code class="language-markdown"></code></pre>
    <textarea id="editor" spellcheck="false" placeholder="# Start writing…"></textarea>
  </div>
  <div id="empty">Create a note with the + button.</div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function generateNonce(): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let out = "";
	for (let i = 0; i < 32; i++) {
		out += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return out;
}
