import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import DS, { AttributesFor } from 'ember-data';
import { layout } from 'ember-osf-web/decorators/component';
import defaultTo from 'ember-osf-web/utils/default-to';
import BaseValidatedComponent from '../base-component';
import template from './template';

@layout(template)
export default class ValidatedText<M extends DS.Model> extends BaseValidatedComponent<M> {
    valuePath!: AttributesFor<M>;

    @service store!: DS.Store;

    // Additional arguments
    password: boolean = defaultTo(this.password, false);
    onKeyUp?: () => void; // Action

    title?: string = this.title;
    retrievalTitle: string = defaultTo(this.retrievalTitle, '');
    retrievalDate: string = defaultTo(this.retrievalDate, '');
    retrievalVersion: string = defaultTo(this.retrievalVersion, '');

    datetimeInitiated: Date = defaultTo(this.datetimeInitiated, new Date());
    datetimeUpdated: Date = defaultTo(this.datetimeUpdated, new Date());

    readonly: boolean = defaultTo(this.readonly, false);

    didInsertElement() {
        if (this.retrievalTitle === 'auto_retrieval' || this.retrievalTitle === 'dual_retrieval') {
            if (!this.value) { // 空の場合のみ
                this.set('value', this.title);
            }
        }
        if (this.retrievalDate === 'auto_retrieval' || this.retrievalDate === 'dual_retrieval') {
            if (!this.value) { // 空の場合のみ
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const date = String(now.getDate()).padStart(2, '0');

                this.set('value', `${year}-${month}-${date}`);
            }
        }
        this.set('readonly', this.readonly === true);

        if (this.retrievalVersion !== '') {
            this.set('value', this.retrievalVersion);
        }
    }

    @action
    getTitle() {
        this.set('value', this.title);
    }

    @action
    getDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');

        this.set('value', `${year}-${month}-${date}`);
    }

    @action
    onChange(event: Event) {
        const target = event.target as HTMLInputElement;
        this.set('value', target.value);
    }
}
