import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { action } from '@ember/object';

import { layout } from 'ember-osf-web/decorators/component';
import { TagDefs, VisualItem } from 'ember-osf-web/packages/registration-schema/ui-group';

import styles from './styles';
import template from './template';

@layout(template, styles)
@tagName('')
export default class UiVisualItems extends Component {
    items!: VisualItem[];
    baseStrategy!: Component;
    tagDefs?: TagDefs;
    changeset?: any;
    isTopLevel: boolean = false;
    circleMarker = '\u25CB';

    @action
    preventLabelFocus(event: Event) {
        event.preventDefault();
    }
}
