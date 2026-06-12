import Component from '@ember/component';

import { tagName } from '@ember-decorators/component';
import { layout } from 'ember-osf-web/decorators/component';

import { assert } from '@ember/debug';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Intl from 'ember-intl/services/intl';
import NodeModel from 'ember-osf-web/models/node';
import { PageManager } from 'ember-osf-web/packages/registration-schema/page-manager';
import { buildVisualItems, TagDefs, VisualItem } from 'ember-osf-web/packages/registration-schema/ui-group';
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
    get _built(): { items: VisualItem[]; tagDefs: TagDefs } {
        const groups = this.pageManager.schemaBlockGroups;
        if (!groups) {
            return { items: [], tagDefs: {} };
        }
        return buildVisualItems(groups, text => this.localizeText(text));
    }

    @computed('_built')
    get visualItems(): VisualItem[] {
        return this._built.items;
    }

    @computed('_built')
    get tagDefs(): TagDefs {
        return this._built.tagDefs;
    }

    localizeText(text: string): string {
        if (!text.includes('|')) {
            return text;
        }
        const parts = text.split('|');
        return this.intl.locale.includes('ja') ? parts[0] : parts[1];
    }
}
