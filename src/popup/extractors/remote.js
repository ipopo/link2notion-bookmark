// 方案A：远程爬虫（用于批量链接模式，非当前标签页）

import { cleanTitle, filterCover } from '../utils/url.js';

export async function fetchRemoteMetadata(url) {
    const result = { title: null, description: null, cover: null, icon: null };
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("Fetch failed");

        const text = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");

        const tagTitle = doc.querySelector('title')?.textContent?.trim();
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.content;
        result.title = cleanTitle(url, tagTitle || ogTitle || url);

        const ogDesc = doc.querySelector('meta[property="og:description"]')?.content;
        const metaDesc = doc.querySelector('meta[name="description"]')?.content;
        result.description = ogDesc || metaDesc || "";

        const ogImage = doc.querySelector('meta[property="og:image"]')?.content;
        if (ogImage && ogImage.startsWith('http')) {
            result.cover = filterCover(url, ogImage);
        }

        try {
            const domain = new URL(url).hostname;
            result.icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } catch (e) { }

    } catch (e) {
        console.warn(`[${url}] 远程抓取失败:`, e);
        result.title = url;
    }
    return result;
}
