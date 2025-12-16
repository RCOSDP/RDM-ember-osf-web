import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency-decorators';
import DS from 'ember-data';

import { layout } from 'ember-osf-web/decorators/component';
import Node from 'ember-osf-web/models/node';
import NodeMapcoreGroup from 'ember-osf-web/models/node-mapcore-group';
import Ready from 'ember-osf-web/services/ready';
import captureException from 'ember-osf-web/utils/capture-exception';
import defaultTo from 'ember-osf-web/utils/default-to';

import styles from './styles';
import template from './template';

@layout(template, styles)
@tagName('span')
export default class GroupList extends Component {
    // Required arguments
    node?: Node;

    // Optional arguments
    shouldTruncate: boolean = defaultTo(this.shouldTruncate, true);

    // Private properties
    @service store!: DS.Store;
    @service ready!: Ready;

    displayedGroups: NodeMapcoreGroup[] = [];
    totalGroups?: number;

    @alias('loadGroups.isRunning')
    isLoading!: boolean;

    @task({ restartable: true, on: 'didReceiveAttrs' })
    loadGroups = task(function *(this: GroupList) {
        try {
            if (!this.node || this.node.isAnonymous) {
                return;
            }
            const blocker = this.ready.getBlocker();
            const itemsFromResult = (res: any) => {
                const arr = (res && typeof res.toArray === 'function') ? res.toArray() : res || [];
                return arr.map((item: any) => {
                    if (item && typeof item === 'object' && item.__data) {
                        return item.__data;
                    }
                    return item;
                });
            };

            const result = yield this.store.query('node-mapcore-group', { nodeId: this.node.id, page: 1 });
            const groups = itemsFromResult(result) as NodeMapcoreGroup[];
            const meta = (result as any).meta || {};
            this.setProperties({
                displayedGroups: groups,
                totalGroups: meta.total || groups.length,
            });

            blocker.done();
        } catch (e) {
            captureException(e, { errorMessage: 'loadGroups task failed synchronously' });
            throw e;
        }
    });

    @computed('truncated')
    get truncateCount() {
        return this.shouldTruncate ? 3 : undefined;
    }
}
