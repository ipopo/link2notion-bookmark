// 共享：把用户输入的标签字符串解析为最终标签字符串，并按需补出 schema.options 更新 op。
// 由 article-writer / tweet-writer 复用，避免 30 行重复。

import { uuidv4 } from '../utils/ids.js';

const TAG_COLOR_PALETTE = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

// 入参：
//   tagsInput   — 用户输入的字符串（可空）
//   tagsKey     — findSchemaKey 返回的 { key, name, type } 或 null
//   schema      — 完整的 collection schema 对象
//   collectionId — Database collectionId（用于构造 schema 更新 op）
//
// 返回：
//   { finalTagsStr, schemaUpdateOp }
//   - finalTagsStr：要写入 properties[tagsKey.key] 的字符串；无内容时为 null
//   - schemaUpdateOp：若有新选项，则返回需要 push 到 operations 的更新指令；否则为 null
export function buildTagsForDatabase(tagsInput, tagsKey, schema, collectionId) {
    if (!tagsKey || !tagsInput || !tagsInput.trim()) {
        return { finalTagsStr: null, schemaUpdateOp: null };
    }

    const inputTags = tagsInput.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    if (inputTags.length === 0) {
        return { finalTagsStr: null, schemaUpdateOp: null };
    }

    const existingOptions = schema[tagsKey.key].options || [];
    const existingValues = existingOptions.map(o => o.value);
    const newOptions = [...existingOptions];
    let hasNew = false;

    for (const t of inputTags) {
        if (!existingValues.includes(t)) {
            newOptions.push({
                id: uuidv4(),
                value: t,
                color: TAG_COLOR_PALETTE[Math.floor(Math.random() * TAG_COLOR_PALETTE.length)]
            });
            hasNew = true;
        }
    }

    const schemaUpdateOp = hasNew ? {
        id: collectionId, table: "collection",
        path: ["schema", tagsKey.key], command: "update",
        args: { name: tagsKey.name, type: tagsKey.type, options: newOptions }
    } : null;

    return { finalTagsStr: inputTags.join(','), schemaUpdateOp };
}
