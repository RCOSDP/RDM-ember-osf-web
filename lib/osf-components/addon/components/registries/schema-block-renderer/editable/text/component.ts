import { tagName } from '@ember-decorators/component';
import Component from '@ember/component';
import { action, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { ChangesetDef } from 'ember-changeset/types';
import { layout } from 'ember-osf-web/decorators/component';
import NodeModel from 'ember-osf-web/models/node';
import { SchemaBlock } from 'ember-osf-web/packages/registration-schema';
import DraftRegistrationManager from 'registries/drafts/draft/draft-registration-manager';
import {
    applyAutofill,
    fetchSuggestions,
    SuggestionConfig,
    SuggestionResult,
} from 'ember-osf-web/utils/suggestion-api';
import { htmlSafe } from '@ember/template';
import { run } from '@ember/runloop';

import styles from './styles';
import template from './template';

/**
 * Render a suggestion template with variable substitution and strip HTML for plain text display.
 */
function renderTemplateAsText(tmpl: string, value: { [field: string]: any }): string {
    const substituted = tmpl.replace(/\{\{(\w+)\}\}/g, (_match: string, field: string) => {
        const v = value[field];
        return v != null ? String(v) : '';
    });
    return substituted.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function renderTemplateAsHtml(tmpl: string, value: { [field: string]: any }): any {
    const rendered = tmpl.replace(/\{\{(\w+)\}\}/g, (_match: string, field: string) => {
        const v = value[field];
        return v != null ? String(v) : '';
    });
    return htmlSafe(rendered);
}

@layout(template, styles)
@tagName('')
export default class Text extends Component {
    changeset!: ChangesetDef;
    schemaBlock!: SchemaBlock;
    node!: NodeModel;
    draftManager!: DraftRegistrationManager;
    onInput!: () => void;

    @alias('schemaBlock.registrationResponseKey')
    valuePath!: string;

    suggestionResults: SuggestionResult[] = [];
    showSuggestions: boolean = false;

    @computed('schemaBlock.suggestion')
    get suggestionConfig(): SuggestionConfig[] | null {
        const raw = this.schemaBlock.suggestion;
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    }

    @computed('schemaBlock.suggestion')
    get hasSuggestion(): boolean {
        const config = this.suggestionConfig;
        return config !== null && config.some(s => Boolean(s.template));
    }

    /**
     * Map from key string → { result, config } for selection lookup.
     */
    @computed('suggestionResults.[]')
    get suggestionMap(): Map<string, { result: SuggestionResult; config: SuggestionConfig }> {
        const configs = this.suggestionConfig!;
        const map = new Map<string, { result: SuggestionResult; config: SuggestionConfig }>();
        let idx = 0;
        for (const result of this.suggestionResults) {
            const config = configs.find(c => c.key === result.key)!;
            map.set(String(idx++), { result, config });
        }
        return map;
    }

    @computed('suggestionResults.[]')
    get suggestionItems(): Array<{ key: string; text: string; html: any }> {
        const configs = this.suggestionConfig!;
        let idx = 0;
        return this.suggestionResults.map(result => {
            const config = configs.find(c => c.key === result.key)!;
            const key = String(idx++);
            const text = renderTemplateAsText(config.template!, result.value);
            const html = renderTemplateAsHtml(config.template!, result.value);
            return { key, text, html };
        });
    }

    @action
    onTypeaheadInput(event: Event) {
        const input = event.target as HTMLInputElement;
        const text = input.value;
        this.changeset.set(this.valuePath, text);
        if (text) {
            run.debounce(this, this._doSearch, text, 300);
        } else {
            this.set('suggestionResults', []);
            this.set('showSuggestions', false);
        }
        this.onInput();
    }

    @action
    onTypeaheadBlur() {
        // Delay to allow mousedown on suggestion item to fire first
        run.later(this, () => this.set('showSuggestions', false), 200);
    }

    @action
    onSuggestionSelect(key: string) {
        const entry = this.suggestionMap.get(key)!;
        const valueField = entry.config.valueField || entry.config.key.split(':')[1];
        this.changeset.set(this.valuePath, String(entry.result.value[valueField]));
        this.set('showSuggestions', false);
        if (entry.config.autofill) {
            applyAutofill(
                this.changeset,
                this.valuePath,
                entry.config.autofill,
                entry.result.value,
                this.draftManager.pageManagers,
                this.onInput,
            );
        } else {
            this.onInput();
        }
    }

    async _doSearch(keyword: string) {
        const configs = this.suggestionConfig!;
        const keys = configs.filter(c => c.template).map(c => c.key);
        const results = await fetchSuggestions(this.node.id, keys, keyword);
        this.set('suggestionResults', results);
        this.set('showSuggestions', results.length > 0);
    }
}
