// 带超时的 fetch 包装：统一所有外部抓取（remote / syndication）的超时与中断行为。
// 默认 8s 与原实现一致；调用方可按需覆盖 timeoutMs。

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}
