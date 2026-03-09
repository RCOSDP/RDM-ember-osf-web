import Component from '@ember/component';

import { tagName } from '@ember-decorators/component';
import { layout } from 'ember-osf-web/decorators/component';

import { assert } from '@ember/debug';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Intl from 'ember-intl/services/intl';
import NodeModel from 'ember-osf-web/models/node';
import { PageManager } from 'ember-osf-web/packages/registration-schema/page-manager';
import { buildVisualItems, VisualItem } from 'ember-osf-web/packages/registration-schema/ui-group';
import DraftRegistrationManager from 'registries/drafts/draft/draft-registration-manager';
import styles from './styles';
import template from './template';

@layout(template, styles)
@tagName('')
export default class PageRenderer extends Component {
    @service intl!: Intl;

    // Required param
    pageManager!: PageManager;
    draftManager!: DraftRegistrationManager;
    node!: NodeModel;

    init() {
        super.init();
        assert('A pageManger is needed for page-renderer', Boolean(this.pageManager));
        assert('A draftManager is needed for page-renderer', Boolean(this.draftManager));
    }

    @computed('pageManager.schemaBlockGroups')
    get visualItems(): VisualItem[] {
        const groups = this.pageManager.schemaBlockGroups;
        if (!groups) {
            return [];
        }
        return buildVisualItems(groups, text => this.localizeText(text));
    }

    localizeText(text: string): string {
        if (!text.includes('|')) {
            return text;
        }
        const parts = text.split('|');
        return this.intl.locale.includes('ja') ? parts[0] : parts[1];
    }
}
