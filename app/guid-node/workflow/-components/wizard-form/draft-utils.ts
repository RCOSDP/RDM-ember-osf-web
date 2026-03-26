const PREFIX = 'rdm-wizard:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface DraftFieldValue {
    value: unknown;
    type: string;
}

interface WizardDraft {
    formKey: string;
    currentPageId: string;
    fieldValues: Record<string, DraftFieldValue>;
    savedAt: number;
}

function storageKey(taskId: string): string {
    return `${PREFIX}${taskId}`;
}

export function saveDraft(
    taskId: string,
    formKey: string,
    currentPageId: string,
    fieldValues: Record<string, DraftFieldValue>,
): void {
    try {
        const draft: WizardDraft = {
            formKey,
            currentPageId,
            fieldValues,
            savedAt: Date.now(),
        };
        localStorage.setItem(storageKey(taskId), JSON.stringify(draft));
    } catch {
        // localStorage unavailable or full — silently skip
    }
}

export function loadDraft(taskId: string, formKey: string): WizardDraft | null {
    try {
        const raw = localStorage.getItem(storageKey(taskId));
        if (!raw) {
            return null;
        }
        const draft = JSON.parse(raw) as WizardDraft;
        if (draft.formKey !== formKey) {
            localStorage.removeItem(storageKey(taskId));
            return null;
        }
        if (Date.now() - draft.savedAt > TTL_MS) {
            localStorage.removeItem(storageKey(taskId));
            return null;
        }
        return draft;
    } catch {
        return null;
    }
}

export function clearDraft(taskId: string): void {
    try {
        localStorage.removeItem(storageKey(taskId));
    } catch {
        // silently skip
    }
}

export function collectExpiredDrafts(): void {
    try {
        const now = Date.now();
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(PREFIX)) {
                continue;
            }
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const draft = JSON.parse(raw) as WizardDraft;
                    if (now - draft.savedAt > TTL_MS) {
                        localStorage.removeItem(key);
                    }
                }
            } catch {
                localStorage.removeItem(key!);
            }
        }
    } catch {
        // silently skip
    }
}
