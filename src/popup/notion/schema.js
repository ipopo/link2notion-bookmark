// Database schema 辅助：按名称+类型查找已存在的属性，找不到返回 null（不会新建）

export function findSchemaKey(schema, names, type) {
    if (!schema) return null;
    for (const [key, prop] of Object.entries(schema)) {
        if (key === 'title') continue;
        if (names.some(n => prop.name?.toLowerCase() === n.toLowerCase()) && prop.type === type) {
            return { key, name: prop.name, type: prop.type };
        }
    }
    return null;
}
