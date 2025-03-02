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
    getRetrievalTitle: string = defaultTo(this.getRetrievalTitle, '');
    getRetrievalDate: string = defaultTo(this.getRetrievalDate, '');
    getRetrievalVersion: string = defaultTo(this.getRetrievalVersion, '');

    datetimeInitiated: Date = defaultTo(this.datetimeInitiated, new Date());
    datetimeUpdated: Date = defaultTo(this.datetimeUpdated, new Date());

    getEdit: boolean = defaultTo(this.getEdit, false);

    didInsertElement() {
        if (this.datetimeUpdated instanceof Date && !isNaN(this.datetimeUpdated.getTime())
            && this.datetimeInitiated instanceof Date
            && !isNaN(this.datetimeInitiated.getTime())) {
            const diffInMs = this.datetimeUpdated.getTime() - this.datetimeInitiated.getTime();
            const diffInMinutes = diffInMs / 1000 / 60;

            if (
                (this.getRetrievalTitle === 'auto_retrieval' || this.getRetrievalTitle === 'dual_retrieval')
                && diffInMinutes <= 1
            ) {
                this.set('value', this.title);
            }

            if (
                (this.getRetrievalDate === 'auto_retrieval' || this.getRetrievalDate === 'dual_retrieval')
                && diffInMinutes <= 1
            ) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const date = String(now.getDate()).padStart(2, '0');

                this.set('value', `${year}-${month}-${date}`);
            }
        } else {
            // Invalid date values for datetimeInitiated or datetimeUpdated.
        }

        this.set('getEdit', this.getEdit === true);

        if (this.getRetrievalVersion !== '') {
            this.set('value', this.getRetrievalVersion);
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
