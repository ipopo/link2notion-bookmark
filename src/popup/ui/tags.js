// 标签建议：从标题解析候选标签 + 渲染芯片 + 与 caption 输入框联动

export function generateTagSuggestions(title) {
    if (!title) return [];
    title = title.replace(/^\(\d+\)\s*/, '');
    // 去除 Twitter/X 标题包装
    title = title.replace(/^X 上的\s+/, '');
    title = title.replace(/\s+on X\s*$/i, '');
    title = title.replace(/\s*\/\s*X\s*$/, '');
    // 去除引号
    title = title.replace(/[""「」『』""]/g, '');

    const tags = [];
    const seen = new Set();
    const addTag = (t) => { if (t && t.length >= 2 && !seen.has(t)) { seen.add(t); tags.push(t); } };

    // 按分隔符拆分（含中文逗号、句号）
    const segments = title.split(/\s+[-–—|·]\s+|\s+\/\s+|\s*：\s*|:\s+|\s*[，,。；]\s*/)
        .map(s => s.trim())
        .filter(s => s.length >= 2);

    // 短段直接作为标签
    for (const seg of segments) {
        if (seg.length <= 12) addTag(seg);
    }

    // 从全文提取英文术语（技术关键词）
    const engTerms = title.match(/[A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*)*/g) || [];
    engTerms.forEach(t => addTag(t));

    return tags.slice(0, 6);
}

export function showTagSuggestions(title) {
    const container = document.getElementById('tagSuggestions');
    const tags = generateTagSuggestions(title);
    if (!tags.length) {
        container.classList.add('hidden');
        return;
    }
    container.innerHTML = '';
    tags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.textContent = tag;
        chip.addEventListener('click', () => toggleTag(tag));
        container.appendChild(chip);
    });
    container.classList.remove('hidden');
    updateTagChipStates();
}

export function hideTagSuggestions() {
    const container = document.getElementById('tagSuggestions');
    container.innerHTML = '';
    container.classList.add('hidden');
}

export function toggleTag(tag) {
    const captionInput = document.getElementById('caption');
    const current = captionInput.value.trim();
    const tags = current ? current.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
    const idx = tags.indexOf(tag);
    if (idx >= 0) {
        tags.splice(idx, 1);
    } else {
        tags.push(tag);
    }
    captionInput.value = tags.join('，');
    chrome.storage.local.set({ 'pending_caption': captionInput.value });
    updateTagChipStates();
}

export function updateTagChipStates() {
    const captionInput = document.getElementById('caption');
    const current = captionInput.value.trim();
    const activeTags = current ? current.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
    document.querySelectorAll('#tagSuggestions .tag-chip').forEach(chip => {
        chip.classList.toggle('active', activeTags.includes(chip.textContent));
    });
}
