// 方案A：远程爬虫（用于批量书签模式，非当前标签页）

import { cleanTitle, filterCover } from '../utils/url.js';
import { fetchWithTimeout } from '../utils/fetch.js';
import { TWEET_STATUS_RE, fetchTweetMeta } from './tweet-syndication.js';

export async function fetchRemoteMetadata(url) {
    // X/Twitter 推文：短路到 syndication API，拿真实作者/正文/媒体图
    // （x.com 对未登录 fetch 返回登录墙，og 数据无意义）
    if (TWEET_STATUS_RE.test(url)) {
        const tweetMeta = await fetchTweetMeta(url);
        if (tweetMeta) return tweetMeta;
        // syndication 失败 → 降级走下方通用流程
    }

    const result = { title: null, description: null, cover: null, icon: null };
    try {
        const res = await fetchWithTimeout(url);
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
