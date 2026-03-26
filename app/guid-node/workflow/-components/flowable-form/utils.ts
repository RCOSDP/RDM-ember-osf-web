import { WorkflowTaskField } from './types';

interface MetadataPlaceholder {
    schemaName: string;
    options: string[];
    multiSelect: boolean;
}

export type ProjectMetadataPlaceholder = MetadataPlaceholder;

export type FileMetadataPlaceholder = MetadataPlaceholder;

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
    const segments = raw.split(',').map(part => part.trim()).filter(part => part.length > 0);
    if (segments.length === 0) {
        return null;
    }
    const [schemaName, ...options] = segments;
    const normalizedOptions = options.map(option => option.toUpperCase());
    return {
        schemaName,
        options,
        multiSelect: normalizedOptions.includes('MULTISELECT'),
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
