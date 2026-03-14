import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Compartment } from "@codemirror/state";

/**
 * MiaoYan editor syntax highlighting — colors from xcassets + MarkdownRuleHighlighter.swift
 *
 * Color mapping (NotesTextProcessor → Theme → xcassets):
 *   titleColor  — headings                — light #7A3DAD, dark #A178FF
 *   linkColor   — link text, images       — light #05A699, dark #61FFC9
 *   listColor   — list markers, blockquote — light #826B29, dark #C4C7C4
 *   htmlColor   — bold/italic/strike/code — light #F28A21, dark #FFC985
 *   syntaxColor — md punctuation          — same as fontColor
 *   fontColor   — normal text             — light #262626, dark #E8E8EB
 */

const miaoyanLightHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: "#7A3DAD", fontWeight: "700", fontSize: "1.5em" },
  { tag: tags.heading2, color: "#7A3DAD", fontWeight: "600", fontSize: "1.3em" },
  { tag: tags.heading3, color: "#7A3DAD", fontWeight: "600", fontSize: "1.15em" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: "#7A3DAD", fontWeight: "600" },

  { tag: tags.emphasis, color: "#F28A21" },
  { tag: tags.strong, color: "#F28A21", fontWeight: "bold" },
  { tag: tags.strikethrough, color: "#F28A21", textDecoration: "line-through" },

  { tag: tags.link, color: "#05A699", textDecoration: "underline" },
  { tag: tags.url, color: "#05A699" },

  { tag: tags.monospace, color: "#F28A21" },
  { tag: tags.content, color: "#262626" },

  { tag: tags.list, color: "#826B29" },
  { tag: tags.quote, color: "#826B29" },

  { tag: tags.processingInstruction, color: "#262626" },
  { tag: tags.meta, color: "#262626" },
  { tag: tags.labelName, color: "#826B29" },
  { tag: tags.comment, color: "#826B29" },

  { tag: tags.angleBracket, color: "#F28A21" },
  { tag: tags.tagName, color: "#F28A21" },
  { tag: tags.attributeName, color: "#F28A21" },
  { tag: tags.attributeValue, color: "#05A699" },
]);

const miaoyanDarkHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: "#A178FF", fontWeight: "700", fontSize: "1.5em" },
  { tag: tags.heading2, color: "#A178FF", fontWeight: "600", fontSize: "1.3em" },
  { tag: tags.heading3, color: "#A178FF", fontWeight: "600", fontSize: "1.15em" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: "#A178FF", fontWeight: "600" },

  { tag: tags.emphasis, color: "#FFC985" },
  { tag: tags.strong, color: "#FFC985", fontWeight: "bold" },
  { tag: tags.strikethrough, color: "#FFC985", textDecoration: "line-through" },

  { tag: tags.link, color: "#61FFC9", textDecoration: "underline" },
  { tag: tags.url, color: "#61FFC9" },

  { tag: tags.monospace, color: "#FFC985" },
  { tag: tags.content, color: "#E8E8EB" },

  { tag: tags.list, color: "#C4C7C4" },
  { tag: tags.quote, color: "#C4C7C4" },

  { tag: tags.processingInstruction, color: "#E8E8EB" },
  { tag: tags.meta, color: "#E8E8EB" },
  { tag: tags.labelName, color: "#C4C7C4" },
  { tag: tags.comment, color: "#C4C7C4" },

  { tag: tags.angleBracket, color: "#FFC985" },
  { tag: tags.tagName, color: "#FFC985" },
  { tag: tags.attributeName, color: "#FFC985" },
  { tag: tags.attributeValue, color: "#61FFC9" },
]);

const miaoyanEditorTheme = EditorView.theme({
  "&": { fontSize: "var(--editor-font-size, 16px)", lineHeight: "1.5", letterSpacing: "0.5px" },
  ".cm-content": {
    fontFamily: "var(--editor-font-family, 'TsangerJinKai02-W04', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', Arial, sans-serif)",
    padding: "24px 40px",
    caretColor: "var(--color-text-1)",
  },
  ".cm-line": { padding: "0" },
  ".cm-cursor": { borderLeftColor: "var(--color-text-1)", borderLeftWidth: "1px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    background: "var(--color-selection-bg) !important",
  },
  ".cm-activeLine": { background: "transparent" },
  ".cm-gutters": { display: "none" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
});

export function getMiaoYanLightExtensions() {
  return [miaoyanEditorTheme, syntaxHighlighting(miaoyanLightHighlight)];
}

export function getMiaoYanDarkExtensions() {
  return [miaoyanEditorTheme, syntaxHighlighting(miaoyanDarkHighlight)];
}

/** Compartment for dynamic light/dark theme switching */
export const themeCompartment = new Compartment();

function getHighlightExtension(dark: boolean) {
  return syntaxHighlighting(dark ? miaoyanDarkHighlight : miaoyanLightHighlight);
}

/** Initial extensions including compartment — call once at EditorState.create */
export function getMiaoYanExtensions(dark: boolean) {
  return [miaoyanEditorTheme, themeCompartment.of(getHighlightExtension(dark))];
}

/** Reconfigure highlight theme on existing EditorView */
export function reconfigureTheme(view: EditorView, dark: boolean) {
  view.dispatch({ effects: themeCompartment.reconfigure(getHighlightExtension(dark)) });
}
