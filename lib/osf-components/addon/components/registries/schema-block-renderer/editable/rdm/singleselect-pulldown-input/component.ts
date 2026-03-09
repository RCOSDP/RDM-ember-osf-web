import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { assert } from '@ember/debug';
import { action, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';

import { ChangesetDef } from 'ember-changeset/types';
import Intl from 'ember-intl/services/intl';

import { layout } from 'ember-osf-web/decorators/component';
import { SchemaBlock } from 'ember-osf-web/packages/registration-schema';

import template from './template';

@layout(template)
@tagName('')
export default class SingleSelectPulldownInput extends Component {
    @service intl!: Intl;
    // Required param
    optionBlocks!: SchemaBlock[];
    changeset!: ChangesetDef;
    schemaBlock!: SchemaBlock;

    @alias('schemaBlock.registrationResponseKey')
    valuePath!: string;
    onInput!: () => void;
    onMetadataInput!: () => void;

    anotherOption?: string;

    didReceiveAttrs() {
        assert(
            'SchemaBlockRenderer::Editable::SingleSelectPulldownInput requires optionBlocks to render',
            Boolean(this.optionBlocks),
        );
    }

    @computed('schemaBlock.ui')
    get allowFreetext(): boolean {
        const ui = this.schemaBlock.ui;
        return Boolean(ui && ui.item && ui.item.freetext);
    }

    @computed('optionBlocks.[]', 'anotherOption')
    get optionBlockValues() {
        const options = this.optionBlocks
            .map(item => this.getLocalizedItemText(item));
        if (this.anotherOption) {
            options.push(this.anotherOption);
        }
        return options;
    }

    @action
    onChange(option: string) {
        const item = this.optionBlocks.find(b => this.getLocalizedItemText(b) === option);
        const result = item ? item.displayText : option;
        this.changeset.set(this.valuePath, result);
        this.onMetadataInput();
        this.onInput();
        this.set('anotherOption', null);
    }

    @action
    onInputSearch(text: string) {
        if (this.allowFreetext
            && !this.optionBlocks.find(item => item.displayText === text || this.getLocalizedItemText(item) === text)) {
            this.set('anotherOption', text);
        }
        return true;
    }

    getLocalizedItemText(item: SchemaBlock) {
        if (!item.helpText) {
            return `${item.displayText}`;
        }
        const label = this.getLocalizedText(item.helpText);
        return `${label} | ${item.displayText}`;
    }

    getLocalizedText(text: string) {
        if (!text.includes('|')) {
            return text;
        }
        const texts = text.split('|');
        if (this.intl.locale.includes('ja')) {
            return texts[0];
        }
        return texts[1];
    }
}
