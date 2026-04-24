// Markdown 风格前缀 → Notion 块类型解析

import { stripRichTextPrefix, splitRichTextByLines } from './rich-text.js';

export function parseLineToNotionBlock(text, richText) {
    let m;
    m = text.match(/^(### )(.+)/);  if (m) return { notionType: 'sub_sub_header', richText: stripRichTextPrefix(richText, m[1].length) };
    m = text.match(/^(## )(.+)/);   if (m) return { notionType: 'sub_header',     richText: stripRichTextPrefix(richText, m[1].length) };
    m = text.match(/^(# )(.+)/);    if (m) return { notionType: 'header',          richText: stripRichTextPrefix(richText, m[1].length) };
    m = text.match(/^([-*•] )(.+)/);if (m) return { notionType: 'bulleted_list',   richText: stripRichTextPrefix(richText, m[1].length) };
    m = text.match(/^(\d+[.)]\s+)(.+)/); if (m) return { notionType: 'text', richText };
    m = text.match(/^(> )(.+)/);    if (m) return { notionType: 'quote',           richText: stripRichTextPrefix(richText, m[1].length) };
    return { notionType: 'text', richText };
}

// 将一个 text block 展开为一到多个 Notion 块（处理换行 + markdown）
export function parseTextBlockToNotionBlocks(block) {
    const text = block.plainText || '';
    const lines = text.split('\n');
    if (lines.length <= 1) {
        return [parseLineToNotionBlock(text.trim(), block.richText || [[text]])];
    }
    // 多行时：按行切分，同时保留每行的 richText 格式标注
    const richTextLines = splitRichTextByLines(block.richText || [[text]]);
    return lines
        .map((l, i) => ({ text: l.trim(), rt: richTextLines[i] || [[l.trim()]] }))
        .filter(({ text }) => text)
        .map(({ text, rt }) => parseLineToNotionBlock(text, rt));
}
