// 方案B：直读当前标签页 DOM（专门解决 Twitter/SPA 等远程抓不到的页面）

import { cleanTitle } from '../utils/url.js';
import { fetchRemoteMetadata } from './remote.js';

export async function extractCurrentTabMetadata(tabId, url) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.content;
                const getName = (name) => document.querySelector(`meta[name="${name}"]`)?.content;

                let data = {
                    title: document.title || getMeta('og:title'),
                    description: getMeta('og:description') || getName('description') || "",
                    cover: getMeta('og:image') || "",
                    twitterText: document.querySelector('article div[lang]')?.innerText
                };

                if (window.location.hostname.includes('youtube.com') || window.location.hostname.includes('youtu.be')) {
                    try {
                        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                        for (let script of scripts) {
                            const json = JSON.parse(script.innerText);
                            const videoData = Array.isArray(json)
                                ? json.find(item => item['@type'] === 'VideoObject')
                                : (json['@type'] === 'VideoObject' ? json : null);

                            if (videoData && videoData.description) {
                                data.description = videoData.description;
                            }
                        }
                    } catch (e) { }
                }

                return data;
            }
        });

        if (results && results[0] && results[0].result) {
            const data = results[0].result;

            try {
                const domain = new URL(url).hostname;
                data.icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
            } catch (e) { }

            if (!data.description && data.twitterText) {
                data.description = data.twitterText.slice(0, 200);
            }

            data.cover = (() => {
                if (url.includes('x.com') ||
                    url.includes('twitter.com') ||
                    url.includes('youtube.com') ||
                    url.includes('youtu.be') ||
                    url.includes('bilibili.com')) {
                    return null;
                }
                return data.cover;
            })();

            // 清理标题（移除 X/Twitter 未读消息数前缀）
            data.title = cleanTitle(url, data.title);

            return data;
        }
    } catch (e) {
        console.error("❌ 直读失败，降级为远程抓取:", e);
    }
    return await fetchRemoteMetadata(url);
}
