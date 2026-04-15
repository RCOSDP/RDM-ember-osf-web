import { WorkflowTaskField } from 'ember-osf-web/guid-node/workflow/-components/flowable-form/types';
import {
    extractFileMetadata,
    extractProjectMetadata,
    matchesMetadataFilters,
    parseFilterExpression,
} from 'ember-osf-web/guid-node/workflow/-components/flowable-form/utils';
import { module, test } from 'qunit';

function buildField(placeholder: string): WorkflowTaskField {
    return {
        id: 'f1',
        name: 'f1',
        type: 'multi-line-text',
        placeholder,
    } as WorkflowTaskField;
}

module('Unit | Workflow | flowable-form-utils', () => {
    module('extractFileMetadata', () => {
        test('no options → empty filters, multiSelect false', assert => {
            const meta = extractFileMetadata(buildField('_FILE_METADATA(my-schema)'));
            assert.ok(meta);
            assert.strictEqual(meta!.schemaName, 'my-schema');
            assert.notOk(meta!.multiSelect);
            assert.deepEqual(meta!.filters, []);
        });

        test('MULTISELECT only', assert => {
            const meta = extractFileMetadata(buildField('_FILE_METADATA(my-schema, MULTISELECT)'));
            assert.ok(meta!.multiSelect);
            assert.deepEqual(meta!.filters, []);
        });

        test('single == clause', assert => {
            const meta = extractFileMetadata(buildField(
                '_FILE_METADATA(my-schema, filter=grdm-file:file-type=="dataset")',
            ));
            assert.deepEqual(meta!.filters, [
                { key: 'grdm-file:file-type', op: '==', value: 'dataset' },
            ]);
        });

        test('single != clause', assert => {
            const meta = extractFileMetadata(buildField(
                '_FILE_METADATA(my-schema, filter=grdm-file:file-type!="manuscript")',
            ));
            assert.deepEqual(meta!.filters, [
                { key: 'grdm-file:file-type', op: '!=', value: 'manuscript' },
            ]);
        });

        test('multiple clauses with and, mixed operators', assert => {
            const meta = extractFileMetadata(buildField(
                '_FILE_METADATA(my-schema, filter=a=="x" and b!="y")',
            ));
            assert.deepEqual(meta!.filters, [
                { key: 'a', op: '==', value: 'x' },
                { key: 'b', op: '!=', value: 'y' },
            ]);
        });

        test('MULTISELECT and filter together', assert => {
            const meta = extractFileMetadata(buildField(
                '_FILE_METADATA(my-schema, MULTISELECT, filter=k=="v")',
            ));
            assert.ok(meta!.multiSelect);
            assert.deepEqual(meta!.filters, [{ key: 'k', op: '==', value: 'v' }]);
        });

        test('quoted value containing comma is preserved', assert => {
            const meta = extractFileMetadata(buildField(
                '_FILE_METADATA(my-schema, filter=k=="a,b")',
            ));
            assert.deepEqual(meta!.filters, [{ key: 'k', op: '==', value: 'a,b' }]);
        });

        test('duplicate filter= throws', assert => {
            assert.throws(
                () => extractFileMetadata(buildField(
                    '_FILE_METADATA(my-schema, filter=a=="x", filter=b=="y")',
                )),
                /duplicate 'filter='/,
            );
        });

        test('unquoted value throws', assert => {
            assert.throws(
                () => extractFileMetadata(buildField('_FILE_METADATA(my-schema, filter=k==dataset)')),
                /Invalid filter clause/,
            );
        });

        test('single = throws', assert => {
            assert.throws(
                () => extractFileMetadata(buildField('_FILE_METADATA(my-schema, filter=k="v")')),
                /Invalid filter clause/,
            );
        });

        test('unknown operator throws', assert => {
            assert.throws(
                () => extractFileMetadata(buildField('_FILE_METADATA(my-schema, filter=k<>"v")')),
                /Invalid filter clause/,
            );
        });

        test('or connector throws', assert => {
            assert.throws(
                () => extractFileMetadata(buildField('_FILE_METADATA(my-schema, filter=a=="x" or b=="y")')),
                /Invalid filter clause/,
            );
        });
    });

    module('extractProjectMetadata', () => {
        test('parses filter the same way', assert => {
            const meta = extractProjectMetadata(buildField(
                '_PROJECT_METADATA(my-schema, MULTISELECT, filter=status=="ready")',
            ));
            assert.strictEqual(meta!.schemaName, 'my-schema');
            assert.ok(meta!.multiSelect);
            assert.deepEqual(meta!.filters, [{ key: 'status', op: '==', value: 'ready' }]);
        });
    });

    module('parseFilterExpression', () => {
        test('splits on " and " outside quotes', assert => {
            assert.deepEqual(
                parseFilterExpression('k=="a and b" and x!="y"'),
                [
                    { key: 'k', op: '==', value: 'a and b' },
                    { key: 'x', op: '!=', value: 'y' },
                ],
            );
        });

        test('empty clause throws', assert => {
            assert.throws(() => parseFilterExpression(''), /Invalid filter clause/);
        });
    });

    module('matchesMetadataFilters', () => {
        const dataDataset = { 'grdm-file:file-type': { value: 'dataset' } };
        const dataManuscript = { 'grdm-file:file-type': { value: 'manuscript' } };
        const dataEmpty = {};

        test('no filters → always true', assert => {
            assert.ok(matchesMetadataFilters(dataEmpty, []));
        });

        test('== matches on explicit value', assert => {
            const filters = [{ key: 'grdm-file:file-type', op: '==' as const, value: 'dataset' }];
            assert.ok(matchesMetadataFilters(dataDataset, filters));
            assert.notOk(matchesMetadataFilters(dataManuscript, filters));
        });

        test('== does not match when unset', assert => {
            const filters = [{ key: 'grdm-file:file-type', op: '==' as const, value: 'dataset' }];
            assert.notOk(matchesMetadataFilters(dataEmpty, filters));
        });

        test('!= matches when unset (covers default)', assert => {
            const filters = [{ key: 'grdm-file:file-type', op: '!=' as const, value: 'manuscript' }];
            assert.ok(matchesMetadataFilters(dataEmpty, filters));
            assert.ok(matchesMetadataFilters(dataDataset, filters));
            assert.notOk(matchesMetadataFilters(dataManuscript, filters));
        });

        test('multiple filters are AND-joined', assert => {
            const filters = [
                { key: 'a', op: '==' as const, value: 'x' },
                { key: 'b', op: '==' as const, value: 'y' },
            ];
            assert.ok(matchesMetadataFilters({ a: { value: 'x' }, b: { value: 'y' } }, filters));
            assert.notOk(matchesMetadataFilters({ a: { value: 'x' }, b: { value: 'z' } }, filters));
        });
    });
});
