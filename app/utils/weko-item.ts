const WEKO_ITEM_ID_KEY = 'internal:weko-item-id';
const WORKFLOW_RUN_ID_KEY = 'internal:workflow-run-id';

const MEBYO_SCHEMA_NAME = 'ムーンショット目標2データベース（未病DB）のメタデータ登録';

const WEKO_LABEL_KEYS: Record<string, string> = {
    [MEBYO_SCHEMA_NAME]: 'mebyo',
};

export function getWekoItemId(
    responses: { [key: string]: unknown } | undefined,
): string | null {
    if (!responses) {
        return null;
    }
    const value = responses[WEKO_ITEM_ID_KEY]
        || responses[`__responseKey_${WEKO_ITEM_ID_KEY}`];
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }
    return null;
}

export function getWorkflowRunId(
    responses: { [key: string]: unknown } | undefined,
): string | null {
    if (!responses) {
        return null;
    }
    const value = responses[WORKFLOW_RUN_ID_KEY]
        || responses[`__responseKey_${WORKFLOW_RUN_ID_KEY}`];
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }
    return null;
}

export function getWekoLabelKey(schemaName: string): string {
    return WEKO_LABEL_KEYS[schemaName] || 'default';
}
