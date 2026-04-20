import * as vscode from "vscode";

const NOTES_DIR = "notes";
const EXT = ".md";
const INVALID_NAME = /[\\/:*?"<>|]/;

function hasControlChar(s: string): boolean {
	for (let i = 0; i < s.length; i++) {
		if (s.charCodeAt(i) < 32) {
			return true;
		}
	}
	return false;
}

export type NoteName = string;

export class NoteStore {
	constructor(private readonly context: vscode.ExtensionContext) {}

	private get dir(): vscode.Uri {
		return vscode.Uri.joinPath(this.context.globalStorageUri, NOTES_DIR);
	}

	private fileUri(name: NoteName): vscode.Uri {
		return vscode.Uri.joinPath(this.dir, name + EXT);
	}

	async ensureDir(): Promise<void> {
		await vscode.workspace.fs.createDirectory(this.dir);
	}

	async list(): Promise<NoteName[]> {
		try {
			const entries = await vscode.workspace.fs.readDirectory(this.dir);
			return entries
				.filter(
					([name, type]) => type === vscode.FileType.File && name.endsWith(EXT),
				)
				.map(([name]) => name.slice(0, -EXT.length))
				.sort((a, b) => a.localeCompare(b));
		} catch {
			return [];
		}
	}

	async read(name: NoteName): Promise<string> {
		const bytes = await vscode.workspace.fs.readFile(this.fileUri(name));
		return new TextDecoder().decode(bytes);
	}

	async write(name: NoteName, content: string): Promise<void> {
		const bytes = new TextEncoder().encode(content);
		await vscode.workspace.fs.writeFile(this.fileUri(name), bytes);
	}

	async exists(name: NoteName): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(this.fileUri(name));
			return true;
		} catch {
			return false;
		}
	}

	async create(name: NoteName): Promise<void> {
		if (await this.exists(name)) {
			throw new Error(`Note "${name}" already exists`);
		}
		await this.write(name, "");
	}

	async rename(oldName: NoteName, newName: NoteName): Promise<void> {
		if (oldName === newName) {
			return;
		}
		if (await this.exists(newName)) {
			throw new Error(`Note "${newName}" already exists`);
		}
		await vscode.workspace.fs.rename(
			this.fileUri(oldName),
			this.fileUri(newName),
		);
	}

	async remove(name: NoteName): Promise<void> {
		await vscode.workspace.fs.delete(this.fileUri(name));
	}
}

export function validateNoteName(
	name: string,
	existing: readonly NoteName[] = [],
): string | undefined {
	const trimmed = name.trim();
	if (!trimmed) {
		return "Name cannot be empty";
	}
	if (INVALID_NAME.test(trimmed) || hasControlChar(trimmed)) {
		return 'Name cannot contain \\ / : * ? " < > | or control characters';
	}
	if (trimmed === "." || trimmed === "..") {
		return "Invalid name";
	}
	if (existing.includes(trimmed)) {
		return `A note named "${trimmed}" already exists`;
	}
	return undefined;
}
