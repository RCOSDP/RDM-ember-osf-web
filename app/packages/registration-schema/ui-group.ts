import { SchemaBlock, SchemaBlockGroup } from 'ember-osf-web/packages/registration-schema';

// TODO: condition evaluation is not implemented on the Ember side.
// This only returns the unconditional entry; conditional UI switching
// (e.g. based on grdm-file:file-type) requires sift or equivalent.
// See metadata-fields.js resolveUI() for the full implementation.
function resolveUI(ui: SchemaBlock['ui']): Record<string, any> | undefined {
    if (!ui) {
        return undefined;
    }
    if (!Array.isArray(ui)) {
        return ui;
    }
    return ui.find((entry: any) => !entry.condition);
}

export interface ResolvedTag {
    id: string;
    localizedText: string;
    info?: string;
}

export interface UiGroupDef {
    id: string;
    title?: string;
    marker?: string;
    bar?: boolean;
    tags?: string[];
    help?: string;
    info?: string;
    parent?: string;
}

export interface VisualItem {
    schemaBlockGroup?: SchemaBlockGroup;
    uiGroup?: UiGroupDef & { localizedTitle?: string; localizedInfo?: string; resolvedTags?: ResolvedTag[] };
    children?: VisualItem[];
    responseKeys?: string[];
}

function collectTagDefs(tags: any[] | undefined, tagDefs: { [id: string]: { info?: string } }) {
    if (!tags) {
        return;
    }
    for (const tag of tags) {
        if (typeof tag === 'object' && tag.id) {
            tagDefs[tag.id] = { info: tag.info };
        }
    }
}

export function resolveTags(
    tags: any[] | undefined,
    tagDefs: { [id: string]: { info?: string } },
    localizeText: (text: string) => string,
): ResolvedTag[] | undefined {
    if (!tags) {
        return undefined;
    }
    return tags.map(tag => {
        if (typeof tag === 'object') {
            return {
                id: tag.id,
                localizedText: localizeText(tag.id),
                info: tag.info ? localizeText(tag.info) : undefined,
            };
        }
        const def = tagDefs[tag];
        if (!def) {
            throw new Error(`Tag definition not found: ${tag}`);
        }
        return {
            id: tag,
            localizedText: localizeText(tag),
            info: def.info ? localizeText(def.info) : undefined,
        };
    });
}

export type TagDefs = { [id: string]: { info?: string } };

export function buildVisualItems(
    groups: SchemaBlockGroup[],
    localizeText: (text: string) => string,
): { items: VisualItem[]; tagDefs: TagDefs } {
    const root: VisualItem[] = [];
    const groupDefs: { [id: string]: UiGroupDef } = {};
    const groupItems: { [id: string]: VisualItem } = {};
    const tagDefs: { [id: string]: { info?: string } } = {};

    // First pass: collect all tag definitions
    for (const group of groups) {
        const ui = resolveUI(group.inputBlock && group.inputBlock.ui);
        if (!ui) {
            continue;
        }
        if (ui.group && typeof ui.group === 'object') {
            collectTagDefs(ui.group.tags, tagDefs);
        }
        if (ui.item) {
            collectTagDefs(ui.item.tags, tagDefs);
        }
    }

    function ensureGroup(id: string): VisualItem {
        if (groupItems[id]) {
            return groupItems[id];
        }
        const def = groupDefs[id];
        const item: VisualItem = {
            uiGroup: {
                ...def,
                localizedTitle: def.title ? localizeText(def.title) : undefined,
                localizedInfo: def.info ? localizeText(def.info) : undefined,
                resolvedTags: resolveTags(def.tags, tagDefs, localizeText),
            },
            children: [],
        };
        groupItems[id] = item;
        if (def.parent) {
            ensureGroup(def.parent).children!.push(item);
        } else {
            root.push(item);
        }
        return item;
    }

    for (const group of groups) {
        const inputBlock = group.inputBlock;
        if (group.registrationResponseKey && group.registrationResponseKey.match(/^__responseKey_grdm-file:.+$/)) {
            root.push({ schemaBlockGroup: group });
            continue;
        }
        const ui = resolveUI(inputBlock && inputBlock.ui);
        if (!ui || !ui.group) {
            root.push({ schemaBlockGroup: group });
            continue;
        }
        const groupRef = ui.group;
        const groupDef = typeof groupRef === 'object' ? groupRef : null;
        const groupId = groupDef ? groupDef.id : groupRef as string;

        if (groupDef) {
            let parentId: string | undefined;
            if (groupDef.parent) {
                if (typeof groupDef.parent === 'object') {
                    const parentObj = groupDef.parent as UiGroupDef;
                    groupDefs[parentObj.id] = parentObj;
                    parentId = parentObj.id;
                } else {
                    parentId = groupDef.parent as string;
                }
            }
            groupDefs[groupId] = {
                id: groupDef.id,
                title: groupDef.title,
                marker: groupDef.marker,
                bar: groupDef.bar,
                tags: groupDef.tags,
                help: groupDef.help,
                info: groupDef.info,
                parent: parentId,
            };
        }

        ensureGroup(groupId).children!.push({ schemaBlockGroup: group });
    }

    function collectResponseKeys(items: VisualItem[]): void {
        for (const item of items) {
            if (item.children) {
                collectResponseKeys(item.children);
            }
            if (item.schemaBlockGroup && item.schemaBlockGroup.registrationResponseKey) {
                item.responseKeys = [item.schemaBlockGroup.registrationResponseKey];
            } else if (item.children) {
                item.responseKeys = item.children.reduce(
                    (keys: string[], child) => keys.concat(child.responseKeys || []),
                    [],
                );
            }
        }
    }
    collectResponseKeys(root);

    return { items: root, tagDefs };
}
