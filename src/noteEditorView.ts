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
		await this.pushCurrent();
	}

	async clearCurrent(): Promise<void> {
		this.currentNote = undefined;
		await this.context.globalState.update(CURRENT_NOTE_KEY, undefined);
		this.post({ type: "empty" });
	}

	async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
		this.view = webviewView;
		webviewView.webview.options = { enableScripts: true };
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
		const csp = [
			"default-src 'none'",
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src 'nonce-${nonce}'`,
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
  #editor {
    flex: 1 1 auto;
    width: 100%;
    box-sizing: border-box;
    resize: none;
    border: 0;
    outline: none;
    padding: 10px;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, ui-monospace, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    line-height: 1.5;
    tab-size: 2;
  }
  #editor:disabled { opacity: 0.6; }
  #empty {
    flex: 1 1 auto;
    display: flex; align-items: center; justify-content: center;
    padding: 16px; text-align: center;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
  }
  .hidden { display: none !important; }
</style>
</head>
<body>
  <header id="title">No note</header>
  <textarea id="editor" class="hidden" spellcheck="false" placeholder="# Start writing…"></textarea>
  <div id="empty">Create a note with the + button.</div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('editor');
    const title = document.getElementById('title');
    const empty = document.getElementById('empty');

    let current = null;
    let saveTimer = null;

    function showEditor(name, content) {
      current = name;
      title.textContent = name;
      editor.value = content;
      editor.classList.remove('hidden');
      empty.classList.add('hidden');
    }

    function showEmpty() {
      current = null;
      title.textContent = 'No note';
      editor.classList.add('hidden');
      empty.classList.remove('hidden');
    }

    editor.addEventListener('input', () => {
      if (current === null) return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        vscode.postMessage({ type: 'change', content: editor.value });
      }, 500);
    });

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = editor.selectionStart;
        const en = editor.selectionEnd;
        editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(en);
        editor.selectionStart = editor.selectionEnd = s + 2;
        editor.dispatchEvent(new Event('input'));
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'load') showEditor(msg.name, msg.content);
      else if (msg.type === 'empty') showEmpty();
    });

    vscode.postMessage({ type: 'ready' });
  </script>
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
