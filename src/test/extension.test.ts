import * as assert from "node:assert";
import { validateNoteName } from "../noteStore";

suite("validateNoteName", () => {
	test("accepts normal names", () => {
		assert.strictEqual(validateNoteName("my note"), undefined);
		assert.strictEqual(validateNoteName("todo-2026"), undefined);
	});

	test("rejects empty and whitespace", () => {
		assert.ok(validateNoteName(""));
		assert.ok(validateNoteName("   "));
	});

	test("rejects path separators and reserved chars", () => {
		assert.ok(validateNoteName("foo/bar"));
		assert.ok(validateNoteName("foo\\bar"));
		assert.ok(validateNoteName("a:b"));
		assert.ok(validateNoteName("a*b"));
		assert.ok(validateNoteName('a"b'));
		assert.ok(validateNoteName("a\u0000b"));
	});

	test("rejects . and ..", () => {
		assert.ok(validateNoteName("."));
		assert.ok(validateNoteName(".."));
	});

	test("rejects duplicates", () => {
		assert.ok(validateNoteName("note", ["note"]));
		assert.strictEqual(validateNoteName("note", ["other"]), undefined);
	});
});
