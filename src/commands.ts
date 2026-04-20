import * as vscode from "vscode";
import type { NoteEditorView } from "./noteEditorView";
import { type NoteName, type NoteStore, validateNoteName } from "./noteStore";

export function registerCommands(
	context: vscode.ExtensionContext,
	store: NoteStore,
	view: NoteEditorView,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand("on-note.newNote", () =>
			newNote(store, view),
		),
		vscode.commands.registerCommand("on-note.openNote", () =>
			openNote(store, view),
		),
		vscode.commands.registerCommand("on-note.renameNote", () =>
			renameNote(store, view),
		),
		vscode.commands.registerCommand("on-note.deleteNote", () =>
			deleteNote(store, view),
		),
	);
}

async function pickNote(
	store: NoteStore,
	placeHolder: string,
): Promise<NoteName | undefined> {
	const notes = await store.list();
	if (notes.length === 0) {
		vscode.window.showInformationMessage("No notes yet. Create one first.");
		return undefined;
	}
	return vscode.window.showQuickPick(notes, { placeHolder });
}

async function promptName(
	existing: readonly NoteName[],
	opts: { prompt: string; value?: string },
): Promise<string | undefined> {
	return vscode.window.showInputBox({
		prompt: opts.prompt,
		value: opts.value,
		validateInput: (v) => validateNoteName(v, existing),
	});
}

async function newNote(store: NoteStore, view: NoteEditorView): Promise<void> {
	const existing = await store.list();
	const name = await promptName(existing, { prompt: "New note name" });
	if (!name) {
		return;
	}
	const trimmed = name.trim();
	await store.create(trimmed);
	await view.switchTo(trimmed);
}

async function openNote(store: NoteStore, view: NoteEditorView): Promise<void> {
	const name = await pickNote(store, "Open note");
	if (!name) {
		return;
	}
	await view.switchTo(name);
}

async function renameNote(
	store: NoteStore,
	view: NoteEditorView,
): Promise<void> {
	const notes = await store.list();
	const current = view.getCurrentNote();
	const target =
		current && notes.includes(current)
			? current
			: await pickNote(store, "Rename which note?");
	if (!target) {
		return;
	}
	const newName = await promptName(
		notes.filter((n) => n !== target),
		{ prompt: `Rename "${target}" to`, value: target },
	);
	if (!newName) {
		return;
	}
	const trimmed = newName.trim();
	await store.rename(target, trimmed);
	if (view.getCurrentNote() === target) {
		await view.switchTo(trimmed);
	}
}

async function deleteNote(
	store: NoteStore,
	view: NoteEditorView,
): Promise<void> {
	const notes = await store.list();
	const current = view.getCurrentNote();
	const target =
		current && notes.includes(current)
			? current
			: await pickNote(store, "Delete which note?");
	if (!target) {
		return;
	}
	const confirm = await vscode.window.showWarningMessage(
		`Delete note "${target}"? This cannot be undone.`,
		{ modal: true },
		"Delete",
	);
	if (confirm !== "Delete") {
		return;
	}
	await store.remove(target);
	if (view.getCurrentNote() === target) {
		const remaining = await store.list();
		if (remaining.length > 0) {
			await view.switchTo(remaining[0]);
		} else {
			await view.clearCurrent();
		}
	}
}
