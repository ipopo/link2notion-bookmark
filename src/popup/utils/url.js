// URL 与标题工具

// 特定平台强制无封面（它们的 og:image 通常不适合 bookmark）
export function filterCover(url, coverUrl) {
    if (url.includes('x.com') ||
        url.includes('twitter.com') ||
        url.includes('youtube.com') ||
        url.includes('youtu.be') ||
        url.includes('bilibili.com')) {
        return null;
    }
    return coverUrl;
}

// 清理标题（目前仅移除 X/Twitter 的 "(数字) " 未读消息数前缀）
export function cleanTitle(url, title) {
    if (!title) return title;
    if (url.includes('x.com') || url.includes('twitter.com')) {
        return title.replace(/^\(\d+\)\s*/, '');
    }
    return title;
}

export function getNotionUrl(id) {
    return `https://www.notion.so/${id.replace(/-/g, '')}`;
}
