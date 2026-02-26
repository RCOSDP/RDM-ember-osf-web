import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';

import FileProviderModel from 'ember-osf-web/models/file-provider';
import Node from 'ember-osf-web/models/node';
import { SelectionManager } from 'ember-osf-web/guid-node/package/selection';
import { WaterButlerFile } from 'ember-osf-web/utils/waterbutler/base';

import { FieldValueWithType } from '../types';

interface FileSelectorValue {
    provider: string;
    files: Array<{ materialized: string; enable: boolean }>;
}

interface FileSelectorArgs {
    node: Node;
    value: FieldValueWithType | undefined;
    onChange: (valueWithType: FieldValueWithType) => void;
    disabled: boolean;
}

class NotifyingSelectionManager extends SelectionManager {
    private onUpdate: () => void;

    constructor(onUpdate: () => void) {
        super();
        this.onUpdate = onUpdate;
    }

    setChecked(item: WaterButlerFile, value: boolean) {
        super.setChecked(item, value);
        this.onUpdate();
    }
}

export default class FileSelector extends Component<FileSelectorArgs> {
    selectionManager: NotifyingSelectionManager;
    @tracked providerName: string = '';

    constructor(owner: unknown, args: FileSelectorArgs) {
        super(owner, args);
        this.selectionManager = new NotifyingSelectionManager(() => this.emitValue());
    }

    @task
    loadProvider = task(function *(this: FileSelector) {
        const providers: FileProviderModel[] = (yield this.args.node.loadAll('files')).toArray();
        const osf = providers.find((p: FileProviderModel) => p.name === 'osfstorage');
        if (osf) {
            this.providerName = osf.name;
        } else {
            const inst = providers.filter((p: FileProviderModel) => p.forInstitutions);
            inst.sort((a: FileProviderModel, b: FileProviderModel) => a.name.localeCompare(b.name));
            this.providerName = inst.length > 0 ? inst[0].name : providers[0].name;
        }
        this.emitValue();
    });

    @action
    initialize() {
        this.loadProvider.perform();
    }

    private emitValue(): void {
        if (!this.providerName) {
            return;
        }
        const files = Object.keys(this.selectionManager.checked).map(materialized => ({
            materialized,
            enable: this.selectionManager.checked[materialized],
        }));
        const value: FileSelectorValue = {
            provider: this.providerName,
            files,
        };
        this.args.onChange({
            value,
            type: 'json',
        });
    }
}
