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

export interface UiGroupDef {
    id: string;
    title?: string;
    bar?: boolean;
    tags?: string[];
    help?: string;
    info?: string;
    parent?: string;
}

export interface VisualItem {
    schemaBlockGroup?: SchemaBlockGroup;
    uiGroup?: UiGroupDef & { localizedTitle?: string };
    children?: VisualItem[];
}

export function buildVisualItems(
    groups: SchemaBlockGroup[],
    localizeText: (text: string) => string,
): VisualItem[] {
    const root: VisualItem[] = [];
    const groupDefs: { [id: string]: UiGroupDef } = {};
    const groupItems: { [id: string]: VisualItem } = {};

    function ensureGroup(id: string): VisualItem {
        if (groupItems[id]) {
            return groupItems[id];
        }
        const def = groupDefs[id];
        const item: VisualItem = {
            uiGroup: {
                ...def,
                localizedTitle: def.title ? localizeText(def.title) : undefined,
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
                bar: groupDef.bar,
                tags: groupDef.tags,
                help: groupDef.help,
                info: groupDef.info,
                parent: parentId,
            };
        }

        ensureGroup(groupId).children!.push({ schemaBlockGroup: group });
    }

    return root;
}
