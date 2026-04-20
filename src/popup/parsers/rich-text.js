// Notion richText 数组操作工具

// 从 richText 开头去掉 prefixLen 个字符（用于剥离 "# "、"- " 等 markdown 前缀）
export function stripRichTextPrefix(richText, prefixLen) {
    if (!richText || !richText.length) return richText;
    const result = richText.map(s => [...s]);
    if (result[0] && typeof result[0][0] === 'string') {
        result[0][0] = result[0][0].slice(prefixLen);
        if (!result[0][0] && result.length > 1) result.shift();
    }
    return result.filter(s => s[0]);
}

// 按换行符将 richText 切分为多行，每行保留原有格式标注
export function splitRichTextByLines(richText) {
    const lines = [];
    let current = [];
    for (const seg of (richText || [])) {
        const text = seg[0] || '';
        const anns = seg[1] || null;
        const parts = text.split('\n');
        for (let i = 0; i < parts.length; i++) {
            if (parts[i]) current.push(anns ? [parts[i], anns] : [parts[i]]);
            if (i < parts.length - 1) { lines.push(current); current = []; }
        }
    }
    if (current.length) lines.push(current);
    return lines;
}
