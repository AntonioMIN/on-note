import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { NoteEditorView } from "./noteEditorView";
import { NoteStore } from "./noteStore";

export async function activate(
	context: vscode.ExtensionContext,
): Promise<void> {
	const store = new NoteStore(context);
	await store.ensureDir();

	const view = new NoteEditorView(context, store);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(NoteEditorView.viewId, view),
	);

	registerCommands(context, store, view);
}

export function deactivate(): void {}
