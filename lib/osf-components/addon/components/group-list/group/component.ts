import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { task } from 'ember-concurrency-decorators';

import { layout } from 'ember-osf-web/decorators/component';
import NodeMapcoreGroup from 'ember-osf-web/models/node-mapcore-group';
import defaultTo from 'ember-osf-web/utils/default-to';
import template from './template';

@layout(template)
@tagName('')
export default class NodeMapcoreGroupListGroup extends Component {
    group!: NodeMapcoreGroup;
    shouldShortenName: boolean = defaultTo(this.shouldShortenName, false);

    groupName?: string;

    @task({ restartable: true, on: 'didReceiveAttrs' })
    loadGroup = task(function *(this: NodeMapcoreGroupListGroup) {
        yield Promise.resolve();
        this.set(
            'groupName',
            this.shouldShortenName
                ? this.group && this.group.name
                : this.group.name,
        );
    });
}
