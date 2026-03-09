import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { assert } from '@ember/debug';
import { computed } from '@ember/object';
import { htmlSafe } from '@ember/string';

import { layout } from 'ember-osf-web/decorators/component';
import SchemaBlock from 'ember-osf-web/models/schema-block';
import defaultTo from 'ember-osf-web/utils/default-to';

import template from './template';

const widthMap: Record<string, string> = {
    narrow: '200px',
    half: '50%',
};

const labelBlockTypes = new Set([
    'page-heading',
    'section-heading',
    'subsection-heading',
    'paragraph',
    'question-label',
]);

@layout(template)
@tagName('')
export default class SchemaBlockRenderer extends Component {
    // Required params
    schemaBlock!: SchemaBlock;
    renderStrategy!: Component;

    // Optional params
    disabled: boolean = defaultTo(this.disabled, false);
    shouldShowMessages: boolean = defaultTo(this.shouldShowMessages, true);

    @computed('schemaBlock.blockType')
    get isLabelBlock(): boolean {
        return labelBlockTypes.has(this.schemaBlock.blockType!);
    }

    @computed('schemaBlock.ui')
    get uiItemStyle(): ReturnType<typeof htmlSafe> | undefined {
        const ui = this.schemaBlock.ui;
        if (!ui || !ui.item || !ui.item.width) {
            return undefined;
        }
        const maxW = widthMap[ui.item.width];
        assert(`Unknown ui.item.width: "${ui.item.width}"`, Boolean(maxW));
        const minW = ui.item.width === 'half' ? ';min-width:300px' : '';
        return htmlSafe(`max-width:${maxW}${minW}`);
    }

    didReceiveAttrs() {
        assert('schema-block-renderer requires a schemaBlock to render', Boolean(this.schemaBlock));
        assert('schema-block-renderer requires a renderStrategy to render', Boolean(this.renderStrategy));
    }
}
