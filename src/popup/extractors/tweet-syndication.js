// X/Twitter 推文 syndication API 抓取
// 背景：x.com 页面的 og:title/image 对所有推文都是同一张默认图 / 通用标题，无价值；
// 批量模式下 fetch(x.com) 还会撞上登录墙。改走官方 syndication API
// （cdn.syndication.twimg.com），拿到真实作者、正文与媒体图。
// 仅针对推文 /status/{id} 链接短路；X 主页 / profile 等非 status URL 仍走通用流程。

import { fetchWithTimeout } from '../utils/fetch.js';

export const TWEET_STATUS_RE = /^https?:\/\/(?:x|twitter|vxtwitter|fxtwitter)\.com\/[^/]+\/status\/(\d+)/i;

// 会话级缓存：同一 statusId 在 popup 存活期间只请求一次 syndication
const _tweetMetaCache = new Map();

export async function fetchTweetMeta(url) {
    const m = url.match(TWEET_STATUS_RE);
    if (!m) return null;
    const statusId = m[1];
    if (_tweetMetaCache.has(statusId)) return _tweetMetaCache.get(statusId);

    let meta = null;
    try {
        const res = await fetchWithTimeout(
            `https://cdn.syndication.twimg.com/tweet-result?id=${statusId}&token=a`
        );
        if (res.ok) {
            const data = await res.json();
            const user = data.user || {};
            const authorName = user.name || user.screen_name || 'Unknown';
            // 清洗文末 t.co 短链（通常指向自带媒体，对摘要无价值）
            const text = (data.text || '').replace(/\s*https?:\/\/t\.co\/\S+/g, '').trim();
            const cover = data.mediaDetails?.[0]?.media_url_https || null;
            const title = text
                ? `${authorName} on X: ${text.slice(0, 80)}`.replace(/[…\s]+$/, '')
                : `${authorName} on X`;
            meta = {
                title,
                description: text,
                cover,
                icon: 'https://www.google.com/s2/favicons?domain=x.com&sz=64',
            };
        }
    } catch (e) {
        console.warn('[syndication] 获取推文数据失败:', e);
    }

    _tweetMetaCache.set(statusId, meta);
    return meta;
}
