// HTML → Notion 块转换（文章模式主解析器）

export function htmlToNotionBlocks(html, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blocks = [];

    // 提取内联富文本（保留加粗、斜体、链接、行内代码）
    function extractInlineRT(el) {
        const segments = [];
        function walk(node, bold, italic) {
            if (node.nodeType === 3) {
                const t = node.textContent;
                if (!t) return;
                const anns = [];
                if (bold) anns.push(['b']);
                if (italic) anns.push(['i']);
                segments.push(anns.length ? [t, anns] : [t]);
            } else if (node.nodeName === 'BR') {
                segments.push(['\n']);
            } else if (node.nodeName === 'A') {
                const text = node.textContent || '';
                if (!text.trim()) return;
                let href = node.getAttribute('href') || '';
                if (href && !href.startsWith('http') && !href.startsWith('#') && baseUrl) {
                    try { href = new URL(href, baseUrl).href; } catch (e) {}
                }
                const anns = [];
                if (bold) anns.push(['b']);
                if (italic) anns.push(['i']);
                if (href.startsWith('http')) anns.push(['a', href]);
                segments.push(anns.length ? [text, anns] : [text]);
            } else if (node.nodeName === 'CODE') {
                const text = node.textContent || '';
                if (text) segments.push([text, [['c']]]);
            } else if (node.nodeType === 1) {
                const isBold = bold || ['STRONG', 'B'].includes(node.nodeName);
                const isItalic = italic || ['EM', 'I'].includes(node.nodeName);
                for (const child of node.childNodes) walk(child, isBold, isItalic);
            }
        }
        for (const child of el.childNodes) walk(child, false, false);
        return segments.length ? segments : [[el.textContent || '']];
    }

    // 解析图片 URL（处理相对路径）
    function resolveImgSrc(node) {
        let src = node.getAttribute('src') || '';
        if (src && !src.startsWith('http') && !src.startsWith('data:') && baseUrl) {
            try { src = new URL(src, baseUrl).href; } catch (e) {}
        }
        return src.startsWith('http') ? src : null;
    }

    function processNode(node) {
        if (node.nodeType !== 1) return;
        const tag = node.nodeName;

        switch (tag) {
            case 'H1':
                blocks.push({ type: 'header', richText: extractInlineRT(node) });
                break;
            case 'H2':
                blocks.push({ type: 'sub_header', richText: extractInlineRT(node) });
                break;
            case 'H3': case 'H4': case 'H5': case 'H6':
                blocks.push({ type: 'sub_sub_header', richText: extractInlineRT(node) });
                break;
            case 'P': {
                const imgs = node.querySelectorAll('img');
                const textContent = node.textContent.trim();
                // 纯图片段落
                if (imgs.length > 0 && !textContent) {
                    for (const img of imgs) {
                        const src = resolveImgSrc(img);
                        if (src) blocks.push({ type: 'image', url: src });
                    }
                } else if (textContent) {
                    blocks.push({ type: 'text', richText: extractInlineRT(node) });
                }
                break;
            }
            case 'UL':
                for (const li of node.children) {
                    if (li.nodeName === 'LI') {
                        blocks.push({ type: 'bulleted_list', richText: extractInlineRT(li) });
                    }
                }
                break;
            case 'OL':
                for (const li of node.children) {
                    if (li.nodeName === 'LI') {
                        blocks.push({ type: 'numbered_list', richText: extractInlineRT(li) });
                    }
                }
                break;
            case 'BLOCKQUOTE':
                // 引用块可能包含多个 <p>，逐一处理
                if (node.querySelector('p')) {
                    for (const child of node.children) {
                        if (child.nodeName === 'P') {
                            blocks.push({ type: 'quote', richText: extractInlineRT(child) });
                        }
                    }
                } else {
                    blocks.push({ type: 'quote', richText: extractInlineRT(node) });
                }
                break;
            case 'PRE': {
                const codeEl = node.querySelector('code');
                const text = (codeEl || node).textContent || '';
                const langClass = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
                blocks.push({ type: 'code', text, language: langClass || 'Plain Text' });
                break;
            }
            case 'IMG': {
                const src = resolveImgSrc(node);
                if (src) blocks.push({ type: 'image', url: src });
                break;
            }
            case 'FIGURE': {
                const img = node.querySelector('img');
                if (img) {
                    const src = resolveImgSrc(img);
                    if (src) blocks.push({ type: 'image', url: src });
                    const caption = node.querySelector('figcaption');
                    if (caption?.textContent?.trim()) {
                        blocks.push({ type: 'text', richText: [[caption.textContent.trim(), [['i']]]] });
                    }
                }
                break;
            }
            case 'HR':
                blocks.push({ type: 'divider' });
                break;
            case 'TABLE': {
                // 表格简化为文本
                const text = node.textContent.trim();
                if (text) blocks.push({ type: 'text', richText: [[text]] });
                break;
            }
            default:
                // 容器元素递归处理子节点
                for (const child of node.childNodes) {
                    if (child.nodeType === 1) {
                        processNode(child);
                    } else if (child.nodeType === 3 && child.textContent.trim()) {
                        blocks.push({ type: 'text', richText: [[child.textContent.trim()]] });
                    }
                }
        }
    }

    for (const child of doc.body.childNodes) {
        if (child.nodeType === 1) processNode(child);
    }

    // 过滤空块
    return blocks.filter(b => {
        if (['divider', 'image'].includes(b.type)) return true;
        if (b.type === 'code') return (b.text || '').trim().length > 0;
        if (b.richText) return b.richText.map(s => s[0]).join('').trim().length > 0;
        return false;
    });
}
