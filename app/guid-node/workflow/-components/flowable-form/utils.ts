import { WorkflowTaskField } from './types';

export interface FilterClause {
    key: string;
    op: '==' | '!=';
    value: string;
}

interface MetadataPlaceholder {
    schemaName: string;
    options: string[];
    multiSelect: boolean;
    filters: FilterClause[];
}

export type ProjectMetadataPlaceholder = MetadataPlaceholder;

export type FileMetadataPlaceholder = MetadataPlaceholder;

const FILTER_CLAUSE_RE = /^([A-Za-z0-9:_\-.]+)\s*(==|!=)\s*"([^"]*)"$/;
const AND_SEP = ' and ';
const FILTER_PREFIX = 'filter=';

function splitOutsideQuotes(raw: string, sep: string): string[] {
    const out: string[] = [];
    let buf = '';
    let inQuotes = false;
    let i = 0;
    while (i < raw.length) {
        const ch = raw[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            buf += ch;
            i += 1;
        } else if (!inQuotes && raw.substring(i, i + sep.length) === sep) {
            out.push(buf);
            buf = '';
            i += sep.length;
        } else {
            buf += ch;
            i += 1;
        }
    }
    if (inQuotes) {
        throw new Error(`Unterminated quoted string: ${raw}`);
    }
    out.push(buf);
    return out;
}

export function parseFilterExpression(raw: string): FilterClause[] {
    const clauses = splitOutsideQuotes(raw, AND_SEP);
    return clauses.map(clause => {
        const trimmed = clause.trim();
        const m = trimmed.match(FILTER_CLAUSE_RE);
        if (!m) {
            throw new Error(`Invalid filter clause: ${trimmed}`);
        }
        return { key: m[1], op: m[2] as '==' | '!=', value: m[3] };
    });
}

function extractMetadataPlaceholder(field: WorkflowTaskField, token: '_PROJECT_METADATA' | '_FILE_METADATA'):
MetadataPlaceholder | null {
    if (field.type !== 'multi-line-text') {
        return null;
    }
    const { placeholder } = field;
    if (!placeholder) {
        return null;
    }
    const pattern = new RegExp(`^${token}\\((.+)\\)$`);
    const match = placeholder.match(pattern);
    if (!match) {
        return null;
    }
    const raw = match[1];
    const segments = splitOutsideQuotes(raw, ',').map(part => part.trim()).filter(part => part.length > 0);
    if (segments.length === 0) {
        return null;
    }
    const [schemaName, ...options] = segments;

    const filterOptions = options.filter(o => o.startsWith(FILTER_PREFIX));
    if (filterOptions.length > 1) {
        throw new Error(`${token}: duplicate 'filter=' option`);
    }
    const filters: FilterClause[] = filterOptions.length === 1
        ? parseFilterExpression(filterOptions[0].substring(FILTER_PREFIX.length))
        : [];

    const normalizedOptions = options.map(option => option.toUpperCase());
    return {
        schemaName,
        options,
        multiSelect: normalizedOptions.includes('MULTISELECT'),
        filters,
    };
}

export function extractProjectMetadata(field: WorkflowTaskField): ProjectMetadataPlaceholder | null {
    return extractMetadataPlaceholder(field, '_PROJECT_METADATA');
}

export function extractFileMetadata(field: WorkflowTaskField): FileMetadataPlaceholder | null {
    return extractMetadataPlaceholder(field, '_FILE_METADATA');
}

export function extractFileSelector(field: WorkflowTaskField): boolean {
    if (field.type !== 'multi-line-text') {
        return false;
    }
    return field.placeholder === '_FILE_SELECTOR()';
}

export function extractExportTarget(field: WorkflowTaskField): boolean {
    if (field.type !== 'multi-line-text') {
        return false;
    }
    return field.placeholder === '_EXPORT_TARGET()';
}

export interface ArrayInputPlaceholder {
    fields: WorkflowTaskField[];
}

export interface FileUploaderPlaceholder {
    path: string;
    acceptExtensions: string[];
}

export function extractFileUploader(field: WorkflowTaskField): FileUploaderPlaceholder | null {
    if (field.type !== 'multi-line-text') {
        return null;
    }
    const { placeholder } = field;
    if (!placeholder) {
        return null;
    }
    const match = placeholder.match(/^_FILE_UPLOADER\((.+)\)$/);
    if (!match) {
        return null;
    }
    const raw = match[1];
    const segments = raw.split(',').map(s => s.trim());
    const extStart = segments.findIndex(s => s.startsWith('.'));
    let path: string;
    let acceptExtensions: string[];
    if (extStart === -1) {
        path = raw.trim();
        acceptExtensions = [];
    } else {
        path = segments.slice(0, extStart).join(',').trim();
        acceptExtensions = segments.slice(extStart).map(e => e.toLowerCase());
    }
    return { path, acceptExtensions };
}

export function extractArrayInput(field: WorkflowTaskField): ArrayInputPlaceholder | null {
    if (field.type !== 'multi-line-text') {
        return null;
    }
    const { placeholder } = field;
    if (!placeholder) {
        return null;
    }
    const match = placeholder.match(/^_ARRAY_INPUT\((.+)\)$/s);
    if (!match) {
        return null;
    }
    const fields: WorkflowTaskField[] = JSON.parse(match[1]);
    return { fields };
}

export function matchesMetadataFilters(
    data: { [key: string]: { value?: unknown } | undefined } | null | undefined,
    filters: FilterClause[],
): boolean {
    if (filters.length === 0) {
        return true;
    }
    const source = data || {};
    return filters.every(f => {
        const entry = source[f.key];
        const value = entry ? entry.value : undefined;
        return f.op === '==' ? value === f.value : value !== f.value;
    });
}
