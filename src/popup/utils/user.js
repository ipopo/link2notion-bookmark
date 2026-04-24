// 从 cookie 读取当前 Notion 用户 ID

export function getCurrentUserId() {
    return new Promise((resolve) => {
        chrome.cookies.get({ url: "https://www.notion.so", name: "notion_user_id" }, (cookie) => {
            resolve(cookie ? cookie.value : null);
        });
    });
}
