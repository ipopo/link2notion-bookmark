// 进度条 UI：showProgress / updateProgressText / hideProgress / completeProgress
// DOM 引用通过函数内 getElementById 惰性访问，避免模块顶层求值时序问题

const $ = (id) => document.getElementById(id);

export function showProgress(text) {
    $('btnImport').classList.add('hidden');
    $('importProgress').classList.remove('hidden');
    $('progressBar').classList.remove('done');
    const pt = $('progressText');
    pt.classList.remove('done');
    pt.textContent = text;
}

export function updateProgressText(text) {
    $('progressText').textContent = text;
}

export function hideProgress() {
    $('importProgress').classList.add('hidden');
    $('btnImport').classList.remove('hidden');
    $('progressBar').classList.remove('done');
    $('progressText').classList.remove('done');
}

export async function completeProgress(text, notionUrl) {
    const progressBar = $('progressBar');
    const progressText = $('progressText');
    progressBar.classList.add('done');
    progressText.classList.add('done');

    if (notionUrl) {
        progressText.textContent = '';

        const msg = document.createElement('div');
        msg.textContent = text;
        progressText.appendChild(msg);

        const linkBtn = document.createElement('a');
        linkBtn.href = '#';
        linkBtn.className = 'notion-link-btn';
        linkBtn.textContent = '📄 在 Notion 中查看';
        linkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: notionUrl });
        });
        progressText.appendChild(linkBtn);

        const countdown = document.createElement('div');
        countdown.className = 'countdown-text';
        progressText.appendChild(countdown);

        for (let i = 3; i > 0; i--) {
            countdown.textContent = `${i} 秒后关闭`;
            await new Promise(r => setTimeout(r, 1000));
        }
    } else {
        progressText.textContent = text;
        await new Promise(r => setTimeout(r, 2000));
    }

    hideProgress();
}
