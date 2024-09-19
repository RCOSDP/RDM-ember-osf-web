import DS, { AttributesFor } from 'ember-data';

import { layout } from 'ember-osf-web/decorators/component';
import defaultTo from 'ember-osf-web/utils/default-to';

import { action } from '@ember/object';
import BaseValidatedComponent from '../base-component';
import template from './template';

@layout(template)
export default class ValidatedText<M extends DS.Model> extends BaseValidatedComponent<M> {
    valuePath!: AttributesFor<M>;

    // Additional arguments
    password: boolean = defaultTo(this.password, false);
    onKeyUp?: () => void; // Action
    onChange?: () => void; // Action

    title?: string = this.title;

    @action
    getTitle() {
        this.set('value', this.title);
    }

    @action
    getDate() {
        this.set(
            'value',
            `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new
            Date().getDate()).padStart(2, '0')}`,
        );
    }
}
