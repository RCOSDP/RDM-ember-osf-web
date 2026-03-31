import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { action, computed } from '@ember/object';
import { inject as service } from '@ember/service';

import Intl from 'ember-intl/services/intl';
import { layout } from 'ember-osf-web/decorators/component';
import { SchemaBlock } from 'ember-osf-web/packages/registration-schema';
import { resolveTags, TagDefs } from 'ember-osf-web/packages/registration-schema/ui-group';
import styles from './styles';
import template from './template';

@layout(template, styles)
@tagName('')
export default class LabelContent extends Component {
    @service intl!: Intl;
    // Required params
    schemaBlock!: SchemaBlock;

    // Optional params
    inputBlockUI?: SchemaBlock['ui'];
    tagDefs?: TagDefs;
    changeset?: any;
    checkMarkKeys?: string[];

    // Private property
    shouldShowExample = false;
    circleMarker = '\u25CB';
    infoMark = '\u24D8';

    @computed('inputBlockUI')
    get displayTextOverride(): string | undefined {
        return this.inputBlockUI && this.inputBlockUI.sub_label;
    }

    @computed('inputBlockUI')
    get itemMarker(): string | undefined {
        return this.inputBlockUI && this.inputBlockUI.item && this.inputBlockUI.item.marker;
    }

    @computed('inputBlockUI')
    get itemInfo(): string | undefined {
        const info = this.inputBlockUI && this.inputBlockUI.item && this.inputBlockUI.item.info;
        return info ? this.getLocalizedText(info) : undefined;
    }

    @computed('inputBlockUI', 'tagDefs')
    get itemTags() {
        const tags = this.inputBlockUI && this.inputBlockUI.item && this.inputBlockUI.item.tags;
        if (!tags) {
            return undefined;
        }
        if (!this.tagDefs) {
            return undefined;
        }
        return resolveTags(tags, this.tagDefs, text => this.getLocalizedText(text));
    }

    @action
    preventLabelFocus(event: Event) {
        event.preventDefault();
    }

    @action
    toggleShouldShowExample() {
        this.toggleProperty('shouldShowExample');
    }

    @computed('schemaBlock', 'displayTextOverride')
    get localizedDisplayText() {
        const text = this.displayTextOverride || this.schemaBlock.displayText;
        if (!text) {
            return text;
        }
        if (!text.includes('|')) {
            return text;
        }
        const texts = text.split('|');
        if (this.intl.locale.includes('ja')) {
            return texts[0];
        }
        return texts[1];
    }

    @computed('schemaBlock')
    get localizedHelpText() {
        const text = this.schemaBlock.helpText;
        if (!text) {
            return text;
        }
        return this.getLocalizedText(text);
    }

    @computed('localizedHelpText')
    get localizedHelpTextLines() {
        const text = this.localizedHelpText;
        if (!text) {
            return [];
        }

        return text.split('\n').map(line => {
            const urlRegex = /(https?:\/\/[^\s]+)/g;

            const parts = line.split(urlRegex).map(part => ({
                content: part,
                isLink: part.startsWith('https://'),
            }));

            return parts;
        });
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
