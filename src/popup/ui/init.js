// popup DOMContentLoaded 初始化：恢复存储、模式 radio、封面检测、事件绑定
// 局部函数（isRestrictedUrl、updateCoverUI、checkCurrentPageCover、updateUIState）
// 依赖大量 DOM 和闭包状态（currentPageCover），保持在 handler 内部而不抽出去

import { extractCurrentTabMetadata } from '../extractors/current-tab.js';
import { showTagSuggestions, hideTagSuggestions, updateTagChipStates } from './tags.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 加载所有状态
    const storageData = await chrome.storage.local.get(['notion_page_id', 'pending_urls', 'pending_caption', 'import_style', 'cover_enabled']);

    if (storageData.notion_page_id) document.getElementById('pageId').value = storageData.notion_page_id;
    if (storageData.pending_caption) document.getElementById('caption').value = storageData.pending_caption;

    const urlsInput = document.getElementById('urls');
    const urlSection = document.getElementById('urlSection');
    const coverControl = document.getElementById('coverControl');
    const toggleCover = document.getElementById('toggleCover');
    const noCoverTip = document.getElementById('noCoverTip');
    const coverText = document.getElementById('coverText');
    const batchUrlTip = document.getElementById('batchUrlTip');
    const batchTools = document.getElementById('batchTools');
    const articleTip = document.getElementById('articleTip');

    const captionSection = document.getElementById('captionSection');
    const captionLabel = document.getElementById('captionLabel');
    const captionTip = document.getElementById('captionTip');

    // 导入样式 Radios
    const styleRadios = document.querySelectorAll('input[name="importStyle"]');

    // 当前页面封面图缓存
    let currentPageCover = null;

    // === 辅助函数：判断是否是特殊 URL（不可执行脚本）===
    const isRestrictedUrl = (url) => {
        if (!url) return true;
        return url.startsWith('chrome://') ||
            url.startsWith('chrome-extension://') ||
            url.startsWith('edge://') ||
            url.startsWith('about:') ||
            url.startsWith('file://') ||
            url.startsWith('devtools://');
    };

    const updateCoverUI = () => {
        if (toggleCover.disabled) {
            noCoverTip.innerText = "该网页无封面图";
            noCoverTip.classList.remove('hidden');
            coverText.classList.add('hidden');
        } else {
            noCoverTip.classList.add('hidden');
            coverText.innerText = "封面图:";
            coverText.classList.remove('hidden');
        }
    };

    // === 辅助函数：检测当前页面封面图 ===
    const checkCurrentPageCover = async () => {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs || !tabs[0]) return;

            const url = tabs[0].url;
            const tabId = tabs[0].id;

            if (isRestrictedUrl(url)) {
                toggleCover.disabled = true;
                toggleCover.checked = false;
                return;
            }

            const meta = await extractCurrentTabMetadata(tabId, url);
            currentPageCover = meta.cover;

            if (currentPageCover) {
                toggleCover.disabled = false;
            } else {
                toggleCover.disabled = true;
                toggleCover.checked = false;
            }
        } catch (e) {
            console.warn('检测封面图失败:', e);
            toggleCover.disabled = true;
        } finally {
            const currentStyle = document.querySelector('input[name="importStyle"]:checked').value;
            if (currentStyle === 'bookmark') {
                updateCoverUI();
            }
        }
    };

    // === 辅助函数：更新 UI 状态 ===
    const updateUIState = async (style) => {
        // 先隐藏所有条件区域
        coverControl.classList.add('hidden');
        articleTip.classList.add('hidden');
        batchUrlTip.classList.add('hidden');
        batchTools.classList.add('hidden');
        hideTagSuggestions();

        if (style === 'article') {
            // 文章模式
            urlSection.classList.remove('hidden');
            captionSection.classList.remove('hidden');
            articleTip.classList.remove('hidden');
            captionLabel.innerText = "标签（选填）";
            captionTip.classList.add('hidden');

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0]) {
                urlsInput.value = tabs[0].url;
                showTagSuggestions(tabs[0].title);
            }
            urlsInput.readOnly = true;
        } else if (style === 'tweet') {
            // 推文页面模式
            urlSection.classList.remove('hidden');
            captionSection.classList.remove('hidden');
            captionLabel.innerText = "标签（选填）";
            captionTip.classList.add('hidden');

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0]) {
                urlsInput.value = tabs[0].url;
                showTagSuggestions(tabs[0].title);
            }
            urlsInput.readOnly = true;
        } else if (style === 'batch') {
            // 批量模式
            urlSection.classList.remove('hidden');
            captionSection.classList.remove('hidden');
            batchUrlTip.classList.remove('hidden');
            batchTools.classList.remove('hidden');
            captionLabel.innerText = "备注（选填）";
            captionTip.innerText = "*多个链接的情况下，备注会被覆盖";
            captionTip.classList.remove('hidden');

            chrome.storage.local.get(['pending_urls'], (res) => {
                urlsInput.value = res.pending_urls || "";
            });
            urlsInput.readOnly = false;
        } else {
            // 默认模式（书签）
            urlSection.classList.remove('hidden');
            captionSection.classList.remove('hidden');
            coverControl.classList.remove('hidden');
            coverControl.style.display = 'flex'; // override hidden properly
            captionLabel.innerText = "备注（选填）";
            captionTip.innerText = "*填写后会显示在bookmark卡片下方";
            captionTip.classList.remove('hidden');

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0]) {
                urlsInput.value = tabs[0].url;
            }
            urlsInput.readOnly = false;

            await checkCurrentPageCover();
            updateCoverUI();
        }
    };

    // 2. 恢复状态并检查是否允许推文模式
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const isTwitterPage = activeTabs[0] && (activeTabs[0].url.includes('x.com') || activeTabs[0].url.includes('twitter.com'));

    const tweetRadioNode = Array.from(styleRadios).find(r => r.value === 'tweet');
    if (!isTwitterPage && tweetRadioNode) {
        tweetRadioNode.disabled = true;
    }

    // 根据当前页面自动选择导入模式
    let initialStyle;
    if (isTwitterPage) {
        initialStyle = 'tweet';
    } else {
        // 非推特页面：尊重用户上次的选择（除了 tweet），默认文章模式
        const saved = storageData.import_style;
        initialStyle = (saved && saved !== 'tweet') ? saved : 'article';
    }

    let targetRadio = Array.from(styleRadios).find(r => r.value === initialStyle);
    if (!targetRadio) targetRadio = styleRadios[0];
    targetRadio.checked = true;

    // 恢复封面图开关状态（默认关闭）
    toggleCover.checked = !!storageData.cover_enabled;

    await updateUIState(initialStyle);

    // === 事件监听 ===

    // Radio 切换监听
    styleRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const style = e.target.value;
                chrome.storage.local.set({ 'import_style': style });
                updateUIState(style);
            }
        });
    });

    // 封面图开关监听
    toggleCover.addEventListener('change', (e) => {
        chrome.storage.local.set({ 'cover_enabled': e.target.checked });
        updateCoverUI();
    });


    // 输入同步 Storage
    const ids = ['urls', 'pageId', 'caption'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', (e) => {
            if (id === 'urls') {
                const currentStyle = document.querySelector('input[name="importStyle"]:checked').value;
                if (currentStyle === 'batch') {
                    chrome.storage.local.set({ 'pending_urls': e.target.value });
                }
            } else {
                const key = id === 'caption' ? 'pending_caption' : 'notion_page_id';
                const obj = {}; obj[key] = e.target.value;
                chrome.storage.local.set(obj);
            }
            // 手动编辑标签时同步芯片选中状态
            if (id === 'caption') updateTagChipStates();
        });
    });

    // === 按钮功能：自动填充和清空 (仅在批量模式可见) ===
    const btnAutoFill = document.getElementById('btnAutoFill');
    const btnClear = document.getElementById('btnClear');

    if (btnAutoFill) {
        btnAutoFill.addEventListener('click', async () => {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0]) {
                const currentUrl = tabs[0].url;
                let val = urlsInput.value.trimEnd();

                if (val.length > 0) {
                    if (!val.includes(currentUrl)) {
                        val += '\n' + currentUrl;
                    }
                } else {
                    val = currentUrl;
                }

                urlsInput.value = val;
                urlsInput.dispatchEvent(new Event('input')); // Save

                const originalText = btnAutoFill.innerText;
                btnAutoFill.innerText = "✅ 已填充";
                setTimeout(() => btnAutoFill.innerText = originalText, 800);
            }
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            urlsInput.value = "";
            urlsInput.dispatchEvent(new Event('input')); // Clear Storage
        });
    }
});
