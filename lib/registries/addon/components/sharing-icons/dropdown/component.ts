import { tagName } from '@ember-decorators/component';
import { service } from '@ember-decorators/service';
import Component from '@ember/component';
import { task } from 'ember-concurrency';
import { DS } from 'ember-data';
import I18n from 'ember-i18n/services/i18n';
import Toast from 'ember-toastr/services/toast';

import { layout } from 'ember-osf-web/decorators/component';
import Collection from 'ember-osf-web/models/collection';
import Registration from 'ember-osf-web/models/registration';
import styles from './styles';
import template from './template';

@tagName('')
@layout(template, styles)
export default class SharingIconsDropdown extends Component.extend({
    didReceiveAttrs(this: SharingIconsDropdown, ...args: any[]) {
        this._super(...args);
        this.getBookMarkCollection.perform();
    },
    getBookMarkCollection: task(function *(this: SharingIconsDropdown) {
        const collections = yield this.store.findAll('collection', {
            adapterOptions: { 'filter[bookmarks]': 'true' },
        });

        if (!collections.length) {
            return;
        }

        this.set('bookmarksCollection', collections.firstObject);
        const bookmarkedRegs = yield this.bookmarksCollection.linkedRegistrations;
        const isBookmarked = Boolean(bookmarkedRegs.filter((reg: any) => reg.id === this.node.id).length);
        this.set('isBookmarked', isBookmarked);
    }),
    updateBookmarks: task(function *(this: SharingIconsDropdown) {
        if (!this.bookmarksCollection || !this.node) {
            return;
        }

        const updateType = this.isBookmarked ? 'remove' : 'add';

        if (this.isBookmarked) {
            this.bookmarksCollection.linkedRegistrations.removeObject(this.node);
        } else {
            this.bookmarksCollection.linkedRegistrations.pushObject(this.node);
        }

        try {
            yield this.bookmarksCollection.save();
        } catch (e) {
            this.toast.error(this.i18n.t(`registries.overview.update_bookmarks.${updateType}.error`));
            throw e;
        }

        this.toast.success(this.i18n.t(`registries.overview.update_bookmarks.${updateType}.success`));
        this.toggleProperty('isBookmarked');
    }).drop(),

}) {
    @service store!: DS.Store;
    @service toast!: Toast;
    @service i18n!: I18n;

    node!: Registration;
    bookmarksCollection!: Collection;
    isBookmarked?: boolean;
}
