import { EditorView, keymap } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";

/**
 * Markdown auto-formatting extension — mirrors MiaoYan's TextFormatter behavior:
 * - List continuation (-, *, +, >) with Enter
 * - Numbered list auto-increment (1. 2. 3.)
 * - Todo checkbox continuation (- [ ])
 * - Empty list item clears prefix on Enter
 * - Tab/Shift-Tab indent for list items
 */

// Patterns matching original MiaoYan's TextFormatter regex
const UNORDERED_RE = /^(\s*)([-*+>])\s/;
const ORDERED_RE = /^(\s*)(\d+)\.\s/;
const TODO_RE = /^(\s*)- \[([ x])\]\s/;

function handleEnter(view: EditorView): boolean {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const text = line.text;

  // Todo: - [ ] or - [x]
  const todoMatch = text.match(TODO_RE);
  if (todoMatch) {
    const [, indent] = todoMatch;
    // Empty todo item — clear it
    if (text.trim() === `- [${todoMatch[2]}]`) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
      });
      return true;
    }
    const newLine = `\n${indent}- [ ] `;
    view.dispatch({
      changes: { from, to: from, insert: newLine },
      selection: EditorSelection.cursor(from + newLine.length),
    });
    return true;
  }

  // Ordered list: 1. 2. 3.
  const orderedMatch = text.match(ORDERED_RE);
  if (orderedMatch) {
    const [, indent, numStr] = orderedMatch;
    // Empty numbered item — clear it
    if (text.trim() === `${numStr}.`) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
      });
      return true;
    }
    const next = parseInt(numStr, 10) + 1;
    const newLine = `\n${indent}${next}. `;
    view.dispatch({
      changes: { from, to: from, insert: newLine },
      selection: EditorSelection.cursor(from + newLine.length),
    });
    return true;
  }

  // Unordered list: - * + >
  const unorderedMatch = text.match(UNORDERED_RE);
  if (unorderedMatch) {
    const [, indent, marker] = unorderedMatch;
    // Empty list item — clear it
    if (text.trim() === marker) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
      });
      return true;
    }
    const newLine = `\n${indent}${marker} `;
    view.dispatch({
      changes: { from, to: from, insert: newLine },
      selection: EditorSelection.cursor(from + newLine.length),
    });
    return true;
  }

  return false;
}

function handleTab(view: EditorView): boolean {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const text = line.text;

  // Only indent if line is a list item
  if (UNORDERED_RE.test(text) || ORDERED_RE.test(text) || TODO_RE.test(text)) {
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: "  " },
      selection: EditorSelection.cursor(from + 2),
    });
    return true;
  }
  return false;
}

function handleShiftTab(view: EditorView): boolean {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const text = line.text;

  if (text.startsWith("  ") && (UNORDERED_RE.test(text) || ORDERED_RE.test(text) || TODO_RE.test(text))) {
    const removeCount = text.startsWith("   ") ? 3 : 2;
    // Clamp: don't remove more than available leading spaces
    const spaces = text.match(/^( +)/)?.[1].length ?? 0;
    const remove = Math.min(removeCount, spaces);
    if (remove > 0) {
      view.dispatch({
        changes: { from: line.from, to: line.from + remove, insert: "" },
        selection: EditorSelection.cursor(Math.max(from - remove, line.from)),
      });
      return true;
    }
  }
  return false;
}

export const markdownAutoFormat = keymap.of([
  { key: "Enter", run: handleEnter },
  { key: "Tab", run: handleTab },
  { key: "Shift-Tab", run: handleShiftTab },
]);
