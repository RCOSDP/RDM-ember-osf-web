import config from 'ember-get-config';
import { ChangesetDef } from 'ember-changeset/types';
import { SchemaBlock } from 'ember-osf-web/packages/registration-schema';
import { PageManager } from 'ember-osf-web/packages/registration-schema/page-manager';

const {
    OSF: {
        url: host,
        webApiNamespace: namespace,
    },
} = config;

export interface SuggestionConfig {
    key: string;
    template?: string;
    button?: string;
    valueField?: string;
    autofill?: { [fieldId: string]: string };
}

export interface SuggestionResult {
    key: string;
    value: { [field: string]: any };
}

export async function fetchSuggestions(
    nodeId: string,
    keys: string[],
    keyword: string,
): Promise<SuggestionResult[]> {
    const baseUrl = `${host.replace(/\/+$/, '')}/${namespace}/project/${nodeId}/metadata/suggestions`;
    const params = new URLSearchParams();
    for (const key of keys) {
        params.append('key[]', key);
    }
    params.append('keyword', keyword);
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
        credentials: 'same-origin',
    });
    if (!response.ok) {
        throw new Error(`Suggestion API error: ${response.status}`);
    }
    const json = await response.json();
    return json.data.attributes.suggestions;
}

/**
 * Resolve the changeset key for a sibling field given the current field's key.
 *
 * Page level:  __responseKey_japan-grant-number → __responseKey_funder
 * Array row:   __responseKey_additional-funding|japan-grant-number → __responseKey_additional-funding|funder
 */
export function resolveAutofillKey(currentResponseKey: string, targetFieldId: string): string {
    const pipeIndex = currentResponseKey.lastIndexOf('|');
    if (pipeIndex >= 0) {
        return currentResponseKey.substring(0, pipeIndex + 1) + targetFieldId;
    }
    return '__responseKey_' + targetFieldId;
}

/**
 * Extract the code from a tooltip string (3rd pipe-delimited segment).
 * e.g. "日本語名|English name|1020" → "1020"
 */
function getTooltipCode(helpText: string): string | undefined {
    const parts = helpText.split('|');
    if (parts.length < 3) {
        return undefined;
    }
    return parts[2].trim();
}

/**
 * Find optionBlocks for a given field ID by searching all schemaBlockGroups.
 * Options are shared across page-level and array-level for the same field,
 * so finding any match is sufficient.
 */
function findOptionBlocks(pageManagers: PageManager[], fieldId: string): SchemaBlock[] | undefined {
    const targetSuffix = `_${fieldId}`;
    for (const pm of pageManagers) {
        for (const group of pm.schemaBlockGroups || []) {
            if (group.registrationResponseKey?.endsWith(targetSuffix) && group.optionBlocks && group.optionBlocks.length) {
                return group.optionBlocks;
            }
            for (const child of group.children || []) {
                if (child.registrationResponseKey?.endsWith(targetSuffix) && child.optionBlocks && child.optionBlocks.length) {
                    return child.optionBlocks;
                }
            }
        }
    }
    return undefined;
}

/**
 * Resolve a value for a target field: if the field has options, match the value
 * against option tooltip codes and return the option text. Otherwise return as-is.
 */
function resolveValueForField(pageManagers: PageManager[], fieldId: string, value: string): string {
    const optionBlocks = findOptionBlocks(pageManagers, fieldId);
    if (!optionBlocks || !optionBlocks.length) {
        return value;
    }
    for (const opt of optionBlocks) {
        if (opt.helpText && getTooltipCode(opt.helpText) === value) {
            return opt.displayText!;
        }
    }
    // No tooltip match — use value directly (option text may equal the code, or free text)
    return value;
}

/**
 * Apply autofill mappings from a selected suggestion to sibling fields.
 * For select fields, resolves codes to option text via tooltip matching.
 */
export function applyAutofill(
    changeset: ChangesetDef,
    currentResponseKey: string,
    autofillMap: { [fieldId: string]: string },
    selectedValue: { [field: string]: any },
    pageManagers: PageManager[],
    onInput: () => void,
): void {
    for (const [fieldId, responseField] of Object.entries(autofillMap)) {
        const rawValue = selectedValue[responseField];
        if (rawValue == null) {
            continue;
        }
        const value = resolveValueForField(pageManagers, fieldId, String(rawValue));
        const targetKey = resolveAutofillKey(currentResponseKey, fieldId);
        changeset.set(targetKey, value);
    }
    onInput();
}
