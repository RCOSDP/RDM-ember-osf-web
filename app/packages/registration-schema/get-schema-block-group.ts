import { assert } from '@ember/debug';
import { SchemaBlock, SchemaBlockGroup } from 'ember-osf-web/packages/registration-schema';

function isEmpty(input?: string | null) {
    if (input === undefined || input === null || input === '') {
        return true;
    }
    return false;
}

export function getSchemaBlockGroups(blocks: SchemaBlock[] | undefined) {
    if (!blocks) {
        assert('getSchemaBlockGroups() requires blocks');
        return undefined;
    }
    let currentGroupKey: string | null = null;
    const groupKeysEncountered: string[] = [];
    const responseKeysEncountered: string[] = [];
    const allGroups = blocks.reduce((groups: SchemaBlockGroup[], block: SchemaBlock) => {
        let schemaBlockGroup: SchemaBlockGroup = {};
        if (block.schemaBlockGroupKey) {
            const newGroupStart = (!currentGroupKey) || (currentGroupKey !== block.schemaBlockGroupKey);
            if (newGroupStart) {
                currentGroupKey = block.schemaBlockGroupKey;
                assert('groupKey is used out of order', groupKeysEncountered.indexOf(block.schemaBlockGroupKey) < 0);
                groupKeysEncountered.push(block.schemaBlockGroupKey);
            } else if (currentGroupKey === block.schemaBlockGroupKey) {
                schemaBlockGroup = groups[groups.length - 1];
            }

            switch (block.blockType) {
            case 'question-label':
                schemaBlockGroup.labelBlock = block;
                break;
            case 'long-text-input':
            case 'short-text-input':
            case 'file-input':
            case 'contributors-input':
            case 'single-select-input':
            case 'multi-select-input':
            case 'japan-grant-number-input':
            case 'funding-stream-code-input':
            case 'jgn-program-name-ja-input':
            case 'jgn-program-name-en-input':
            case 'e-rad-award-funder-input':
            case 'e-rad-award-number-input':
            case 'e-rad-award-title-ja-input':
            case 'e-rad-award-title-en-input':
            case 'e-rad-award-field-input':
            case 'e-rad-researcher-number-input':
            case 'e-rad-researcher-name-ja-input':
            case 'e-rad-researcher-name-en-input':
            case 'e-rad-bunnya-input':
            case 'file-metadata-input':
            case 'date-input':
            case 'file-capacity-input':
            case 'file-creators-input':
            case 'file-title-input':
            case 'file-url-input':
            case 'file-institution-ja-input':
            case 'file-institution-en-input':
            case 'file-institution-id-input':

                assert('input block with no registrationResponseKey!', !isEmpty(block.registrationResponseKey));
                assert('question with multiple input blocks!', !schemaBlockGroup.inputBlock);
                assert('non-unique response key used',
                    responseKeysEncountered.indexOf(block.registrationResponseKey!) < 0);
                responseKeysEncountered.push(block.registrationResponseKey!);
                if (schemaBlockGroup.schemaBlockGroupKey) {
                    assert('question with mismatched schemaBlockGroupKey!',
                        schemaBlockGroup.schemaBlockGroupKey === block.schemaBlockGroupKey);
                } else {
                    schemaBlockGroup.schemaBlockGroupKey = block.schemaBlockGroupKey;
                }
                schemaBlockGroup.inputBlock = block;
                schemaBlockGroup.registrationResponseKey = block.registrationResponseKey;
                schemaBlockGroup.groupType = block.blockType;
                break;
            case 'select-input-option':
                if (schemaBlockGroup.inputBlock) {
                    assert('question with mismatched schemaBlockGroupKey!',
                        !isEmpty(block.schemaBlockGroupKey)
                        && schemaBlockGroup.schemaBlockGroupKey === block.schemaBlockGroupKey);
                    schemaBlockGroup.optionBlocks = [
                        ...(schemaBlockGroup.optionBlocks || []),
                        block,
                    ];
                } else {
                    assert('select-option without a question!');
                }
                break;
            default:
                break;
            }
            if (newGroupStart) {
                groups.push(schemaBlockGroup);
            }
            schemaBlockGroup.blocks = [
                ...(schemaBlockGroup.blocks || []),
                block,
            ];
        } else {
            currentGroupKey = null;
            schemaBlockGroup.labelBlock = block;
            schemaBlockGroup.groupType = block.blockType;
            schemaBlockGroup.blocks = [block];
            groups.push(schemaBlockGroup);
        }
        return groups;
    }, []);
    return allGroups;
}
