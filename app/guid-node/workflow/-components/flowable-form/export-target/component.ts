import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';

import FileProviderModel from 'ember-osf-web/models/file-provider';
import Node from 'ember-osf-web/models/node';

import { FieldValueWithType } from '../types';

interface ExportTargetArgs {
    node: Node;
    value: FieldValueWithType | undefined;
    onChange: (valueWithType: FieldValueWithType) => void;
    onLoadingChange?: (isLoading: boolean) => void;
    disabled: boolean;
}

export default class ExportTarget extends Component<ExportTargetArgs> {
    @tracked providers: FileProviderModel[] = [];
    @tracked selectedProvider: string = '';

    @task
    loadProviders = task(function *(this: ExportTarget) {
        const providers: FileProviderModel[] = (yield this.args.node.loadAll('files')).toArray();
        this.providers = providers;

        // Restore from value or pick default
        if (this.args.value && this.args.value.type === 'string' && this.args.value.value) {
            this.selectedProvider = this.args.value.value as string;
        } else if (providers.length > 0) {
            const osf = providers.find(p => p.name === 'osfstorage');
            this.selectedProvider = osf ? osf.name : providers[0].name;
            this.notifyChange(this.selectedProvider);
        }
    });

    @action
    initialize() {
        this.args.onLoadingChange?.(true);
        this.loadProviders.perform().finally(() => {
            this.args.onLoadingChange?.(false);
        });
    }

    @action
    destinationChanged(event: Event) {
        const value = (event.target as HTMLSelectElement).value;
        this.selectedProvider = value;
        this.notifyChange(value);
    }

    private notifyChange(providerName: string): void {
        this.args.onChange({
            value: providerName,
            type: 'string',
        });
    }
}
