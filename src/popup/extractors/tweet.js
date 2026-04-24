// X/Twitter 推文线程内容提取
// 注意：executeScript 的 func 是序列化后在目标页面上下文执行，不能引用外部模块函数。

export async function extractXThread(tabId) {
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            function getPlainText(el) {
                return (el?.textContent || '').replace(/\s+/g, ' ').trim();
            }

            function extractRichText(el) {
                const segments = [];
                function walk(node, bold, italic) {
                    if (node.nodeType === 3) {
                        const t = node.textContent || '';
                        if (!t) return;
                        const anns = [];
                        if (bold) anns.push(['b']);
                        if (italic) anns.push(['i']);
                        segments.push(anns.length ? [t, anns] : [t]);
                    } else if (node.nodeName === 'BR') {
                        segments.push(['\n']);
                    } else if (node.nodeName === 'A') {
                        const text = (node.textContent || '').trim();
                        const href = node.href || '';
                        if (!text) return;
                        const anns = [];
                        if (bold) anns.push(['b']);
                        if (italic) anns.push(['i']);
                        if (href.startsWith('http')) anns.push(['a', href]);
                        segments.push(anns.length ? [text, anns] : [text]);
                    } else if (node.nodeName === 'IMG') {
                        const alt = node.getAttribute('alt') || '';
                        if (alt) segments.push([alt]);
                    } else if (node.nodeType === 1) {
                        const isBold = bold || ['STRONG', 'B'].includes(node.nodeName) ||
                            parseInt(getComputedStyle(node).fontWeight || '400') >= 700;
                        const isItalic = italic || ['EM', 'I'].includes(node.nodeName) ||
                            getComputedStyle(node).fontStyle === 'italic';
                        for (const child of node.childNodes) walk(child, isBold, isItalic);
                    }
                }
                for (const child of el.childNodes) walk(child, false, false);
                return segments;
            }

            // 找包含所有 span[data-text="true"] 的最近祖先容器
            function findTextContainer(article) {
                const allSpans = article.querySelectorAll('span[data-text="true"]');
                if (!allSpans.length) return null;
                const total = allSpans.length;
                let candidate = allSpans[0].parentElement;
                while (candidate && candidate !== article) {
                    if (candidate.querySelectorAll('span[data-text="true"]').length === total) return candidate;
                    candidate = candidate.parentElement;
                }
                return allSpans[0].parentElement;
            }

            // 解析 X Article（原生长文）：twitterArticleReadView 结构
            function extractTwitterArticleBlocks(article) {
                const blocks = [];
                const seenImgSrcs = new Set();

                function pushImage(img) {
                    if (!img) return;
                    const src = (img.src || '').replace(/([?&]name=)\w+/, '$1large');
                    if (src.startsWith('http') && !seenImgSrcs.has(src)) {
                        seenImgSrcs.add(src);
                        blocks.push({ type: 'image', url: src });
                    }
                }

                // 标题由外层作为 Notion 页面标题，这里不再重复
                const longform = article.querySelector('[data-testid="longformRichTextComponent"]');
                const root = longform?.firstElementChild;
                if (!root) return blocks;

                for (const child of Array.from(root.children)) {
                    const tag = child.tagName;
                    if (tag === 'SECTION') {
                        child.querySelectorAll('[data-testid="tweetPhoto"] img').forEach(pushImage);
                        const directImg = child.querySelector(':scope > img');
                        if (directImg) pushImage(directImg);
                    } else if (tag === 'BLOCKQUOTE') {
                        const rt = extractRichText(child);
                        const pt = getPlainText(child);
                        if (pt) blocks.push({ type: 'quote', richText: rt.length ? rt : [[pt]], plainText: pt });
                    } else if (tag === 'UL' || tag === 'OL') {
                        const listType = tag === 'OL' ? 'numbered_list' : 'bulleted_list';
                        for (const li of Array.from(child.querySelectorAll(':scope > li'))) {
                            const rt = extractRichText(li);
                            const pt = getPlainText(li);
                            if (pt) blocks.push({ type: listType, richText: rt.length ? rt : [[pt]], plainText: pt });
                        }
                    } else if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
                        const level = tag === 'H1' ? 'header' : tag === 'H2' ? 'sub_header' : 'sub_sub_header';
                        const rt = extractRichText(child);
                        const pt = getPlainText(child);
                        if (pt) blocks.push({ type: level, richText: rt.length ? rt : [[pt]], plainText: pt });
                    } else {
                        const rt = extractRichText(child);
                        const pt = getPlainText(child);
                        if (pt) blocks.push({ type: 'text', richText: rt.length ? rt : [[pt]], plainText: pt });
                        child.querySelectorAll('[data-testid="tweetPhoto"] img').forEach(pushImage);
                    }
                }
                return blocks;
            }

            // 将一条推文解析为有序 blocks（text / image / video）
            function extractTweetBlocks(article) {
                // 优先识别 X Article 原生长文
                if (article.querySelector('[data-testid="twitterArticleReadView"]')) {
                    return extractTwitterArticleBlocks(article);
                }

                const blocks = [];
                const seenImgSrcs = new Set();

                function addImage(img) {
                    if (!img) return;
                    let src = (img.src || '').replace(/([?&]name=)\w+/, '$1large');
                    if (src.startsWith('http') && !seenImgSrcs.has(src)) {
                        seenImgSrcs.add(src);
                        blocks.push({ type: 'image', url: src });
                    }
                }
                function addImagesFromEl(el) {
                    if (el.getAttribute('data-testid') === 'tweetPhoto') {
                        addImage(el.querySelector('img'));
                    } else {
                        el.querySelectorAll('[data-testid="tweetPhoto"] img').forEach(addImage);
                    }
                }

                const textContainer = findTextContainer(article) ||
                    article.querySelector('[data-testid="tweetText"]');

                // 长文推文：tweetText 内没有 span[data-text="true"]，直接按 \n\n 段落切分
                const isLongPost = textContainer &&
                    textContainer.getAttribute('data-testid') === 'tweetText' &&
                    textContainer.querySelectorAll('span[data-text="true"]').length === 0;

                if (isLongPost) {
                    const raw = textContainer.textContent || '';
                    const paragraphs = raw.split(/\n{2,}/).map(s => s.replace(/[ \t]+\n/g, '\n').trim()).filter(Boolean);
                    for (const p of paragraphs) {
                        blocks.push({ type: 'text', richText: [[p]], plainText: p });
                    }

                    // 仍然扫描文本容器后的兄弟节点（图片/代码块）
                    let sibling = textContainer.nextElementSibling;
                    while (sibling) {
                        addImagesFromEl(sibling);
                        const sibCodeBlock = sibling.querySelector('[data-testid="markdown-code-block"]') ||
                            (sibling.getAttribute && sibling.getAttribute('data-testid') === 'markdown-code-block' ? sibling : null);
                        if (sibCodeBlock) {
                            const codeEl = sibCodeBlock.querySelector('pre code') || sibCodeBlock.querySelector('pre');
                            if (codeEl) {
                                const codeText = codeEl.textContent || '';
                                const langMatch = ((sibCodeBlock.querySelector('code') || {}).className || '').match(/language-(\w+)/);
                                const lang = langMatch ? langMatch[1] : '';
                                blocks.push({ type: 'code', text: codeText, language: lang === 'text' ? 'Plain Text' : (lang || 'Plain Text') });
                            }
                        }
                        sibling = sibling.nextElementSibling;
                    }

                    if (article.querySelector('[data-testid="videoPlayer"], [data-testid="videoComponent"]')) {
                        blocks.push({ type: 'video' });
                    }
                    return blocks;
                }

                if (textContainer) {
                    // 遍历文本容器的直接子节点，按 DOM 顺序生成 text/image blocks
                    for (const child of textContainer.childNodes) {
                        if (child.nodeType === 3) {
                            const pt = (child.textContent || '').trim();
                            if (pt) blocks.push({ type: 'text', richText: [[pt]], plainText: pt });
                        } else if (child.nodeType === 1) {
                            // 检测代码块（Twitter 的 markdown-code-block）
                            const codeBlockEl = child.querySelector('[data-testid="markdown-code-block"]') ||
                                (child.getAttribute && child.getAttribute('data-testid') === 'markdown-code-block' ? child : null);
                            if (codeBlockEl) {
                                const codeEl = codeBlockEl.querySelector('pre code') || codeBlockEl.querySelector('pre');
                                if (codeEl) {
                                    const codeText = codeEl.textContent || '';
                                    const langMatch = ((codeBlockEl.querySelector('code') || {}).className || '').match(/language-(\w+)/);
                                    const lang = langMatch ? langMatch[1] : '';
                                    blocks.push({ type: 'code', text: codeText, language: lang === 'text' ? 'Plain Text' : (lang || 'Plain Text') });
                                }
                            } else {
                                const hasText = !!child.querySelector('span[data-text="true"]');
                                const hasPhoto = child.getAttribute('data-testid') === 'tweetPhoto' ||
                                    !!child.querySelector('[data-testid="tweetPhoto"]');

                                if (hasText) {
                                    const pt = getPlainText(child);
                                    const rt = extractRichText(child);
                                    if (pt.trim()) blocks.push({ type: 'text', richText: rt.length ? rt : [[pt]], plainText: pt });
                                }
                                if (hasPhoto) addImagesFromEl(child);
                                // 既无 data-text 也无 tweetPhoto 也无代码块 → UI 元素，跳过
                            }
                        }
                    }

                    // 文本容器之后的兄弟节点中也可能有图片或代码块（X 常见布局）
                    let sibling = textContainer.nextElementSibling;
                    while (sibling) {
                        addImagesFromEl(sibling);
                        const sibCodeBlock = sibling.querySelector('[data-testid="markdown-code-block"]') ||
                            (sibling.getAttribute && sibling.getAttribute('data-testid') === 'markdown-code-block' ? sibling : null);
                        if (sibCodeBlock) {
                            const codeEl = sibCodeBlock.querySelector('pre code') || sibCodeBlock.querySelector('pre');
                            if (codeEl) {
                                const codeText = codeEl.textContent || '';
                                const langMatch = ((sibCodeBlock.querySelector('code') || {}).className || '').match(/language-(\w+)/);
                                const lang = langMatch ? langMatch[1] : '';
                                blocks.push({ type: 'code', text: codeText, language: lang === 'text' ? 'Plain Text' : (lang || 'Plain Text') });
                            }
                        }
                        sibling = sibling.nextElementSibling;
                    }
                } else {
                    addImagesFromEl(article);
                    // 无 textContainer 时，扫描整个 article 中的代码块
                    article.querySelectorAll('[data-testid="markdown-code-block"]').forEach(codeBlockEl => {
                        const codeEl = codeBlockEl.querySelector('pre code') || codeBlockEl.querySelector('pre');
                        if (codeEl) {
                            const codeText = codeEl.textContent || '';
                            const langMatch = ((codeBlockEl.querySelector('code') || {}).className || '').match(/language-(\w+)/);
                            const lang = langMatch ? langMatch[1] : '';
                            blocks.push({ type: 'code', text: codeText, language: lang === 'text' ? 'Plain Text' : (lang || 'Plain Text') });
                        }
                    });
                }

                // 视频
                if (article.querySelector('[data-testid="videoPlayer"], [data-testid="videoComponent"]')) {
                    blocks.push({ type: 'video' });
                }

                return blocks;
            }

            const debug = {};

            const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
            debug.articleCount = articles.length;
            if (!articles.length) return { debug, tweets: [], title: '', authorName: '', date: '', url: window.location.href };

            const firstArticle = articles[0];
            const userNameEl = firstArticle.querySelector('[data-testid="User-Name"]');
            const authorName = getPlainText(userNameEl?.querySelector('span')) ||
                getPlainText(userNameEl).split('\n')[0] || 'Unknown';
            const authorHandleHref = userNameEl?.querySelector('a[href*="/"]')?.getAttribute('href') || '';

            const timeEl = firstArticle.querySelector('time');
            const dateStr = timeEl?.getAttribute('datetime') || '';
            const dateShort = dateStr ? new Date(dateStr).toLocaleDateString('zh-CN') : '';
            const dateISO = dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';

            const firstSpan = firstArticle.querySelector('span[data-text="true"]');
            debug.hasDataText = !!firstSpan;
            debug.sampleDataText = firstSpan ? (firstSpan.textContent || '').slice(0, 50) : '(无)';

            // 从推文链接卡片中提取文章标题
            function findCardTitle(article) {
                const cardWrapper = article.querySelector('[data-testid="card.wrapper"]');
                if (!cardWrapper) return null;
                const cardLink = cardWrapper.querySelector('a');
                if (!cardLink) return null;
                // 卡片标题通常是卡片内第一个字符数足够多的 span
                const spans = cardLink.querySelectorAll('span');
                for (const span of spans) {
                    const text = (span.textContent || '').trim();
                    // 跳过太短的（域名/装饰文本），只取像文章标题的
                    if (text.length > 8 && !text.match(/^https?:\/\//) && !text.match(/^\w+\.\w{2,}$/)) {
                        return text;
                    }
                }
                return null;
            }

            // 清理 markdown 风格字符（去掉开头 # / * 等）
            function cleanMarkdownTitle(text) {
                if (!text) return text;
                return text.replace(/^[#*>\s]+/, '').trim();
            }

            const tweets = [];
            for (const article of articles) {
                const handleHref = article.querySelector('[data-testid="User-Name"] a[href*="/"]')?.getAttribute('href') || '';
                if (tweets.length > 0 && handleHref && authorHandleHref && handleHref !== authorHandleHref) break;

                const blocks = extractTweetBlocks(article);

                // 兜底：og:description
                if (!blocks.some(b => b.type === 'text') && tweets.length === 0) {
                    const ogDesc = document.querySelector('meta[property="og:description"]')?.content ||
                                   document.querySelector('meta[name="twitter:description"]')?.content || '';
                    if (ogDesc) {
                        blocks.unshift({ type: 'text', richText: [[ogDesc]], plainText: ogDesc });
                        debug.usedMeta = true;
                    }
                }

                tweets.push({ blocks });
            }

            // X Article 优先使用原生长文标题；否则用浏览器 tab 标题（去除未读消息数前缀）
            const articleTitleEl = firstArticle.querySelector('[data-testid="twitter-article-title"]');
            const articleTitle = (articleTitleEl?.textContent || '').trim();
            const pageTitle = articleTitle || document.title.replace(/^\(\d+\)\s*/, '').trim();

            // 兜底：若 document.title 为空，则用作者名 + 推文首句
            const cardTitle = findCardTitle(firstArticle);
            const firstText = tweets[0]?.blocks?.find(b => b.type === 'text')?.plainText || '';
            const rawTitle = cardTitle || firstText.slice(0, 60) + (firstText.length > 60 ? '…' : '');
            const fallbackTitle = `${authorName}: ${cleanMarkdownTitle(rawTitle)}`;

            const title = pageTitle || fallbackTitle;

            return { title, authorName, date: dateShort, dateISO, url: window.location.href, tweets, debug };
        }
    });

    if (results && results[0]?.error) {
        console.error('[extractXThread] 脚本错误:', results[0].error);
        throw new Error('页面脚本执行失败: ' + (results[0].error.message || '未知错误'));
    }
    if (results && results[0] && results[0].result) return results[0].result;
    return null;
}
