import { assert } from '@ember/debug';
import { isEmpty } from '@ember/utils';
import { ValidatorFunction } from 'ember-changeset-validations';
import buildMessage from 'ember-changeset-validations/utils/validation-errors';
import File from 'ember-osf-web/models/file';
import NodeModel from 'ember-osf-web/models/node';
import { SchemaBlockGroup } from 'ember-osf-web/packages/registration-schema';
import { allSettled } from 'rsvp';

export function validateFileList(responseKey: string, node?: NodeModel): ValidatorFunction {
    return async (_: string, newValue: File[]) => {
        if (newValue && node) {
            const fileReloads: Array<() => Promise<File>> = [];
            newValue.forEach(file => {
                if (file && !file.isError) {
                    fileReloads.push(file.reload());
                }
            });
            await allSettled(fileReloads);

            const detachedFiles = [];

            for (const file of newValue) {
                if (file.isError || file.belongsTo('target').id() !== node.id) {
                    detachedFiles.push(file.name);
                }
            }
            const projectOrComponent = node.isRoot ? 'project' : 'component';

            if (!isEmpty(detachedFiles)) {
                const missingFilesList = detachedFiles.join(', ');
                const numOfFiles = detachedFiles.length;

                return buildMessage(responseKey, {
                    type: 'presence',
                    context: {
                        type: 'onlyProjectOrComponentFiles',
                        translationArgs: { projectOrComponent, missingFilesList, numOfFiles },
                    },
                });
            }
        }
        return true;
    };
}

export function validateConditionalRequired(
    conditionalRequired: string, groups: SchemaBlockGroup[],
): ValidatorFunction {
    return async (
        key: string,
        newValue: string,
        _: string,
        changes: Record<string, unknown>,
        content: Record<string, unknown>,
    ) => {
        const otherKey = `__responseKey_${conditionalRequired}`;
        const otherGroup = groups.find(group => group.registrationResponseKey === otherKey);
        assert(
            `no response key with label for group ${conditionalRequired} by conditionalRequired`,
            otherGroup != null && otherGroup.labelBlock != null && otherGroup.labelBlock.displayText != null,
        );
        const displayText: string = (otherGroup && otherGroup.labelBlock && otherGroup.labelBlock.displayText) || '';
        const otherValues = { ...content, ...changes } as {[key: string]: string};
        const otherValue = otherValues[otherKey];
        if (!newValue && !otherValue) {
            return buildMessage(key, {
                type: 'presence',
                context: {
                    type: 'invalid_conditional_required',
                    translationArgs: {
                        otherLabel: displayText,
                    },
                },
                value: {
                    [key]: newValue,
                    [otherKey]: otherValue,
                },
            });
        }
        return true;
    };
}
