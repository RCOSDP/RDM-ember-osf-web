import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import DS from 'ember-data';
import Intl from 'ember-intl/services/intl';

import OsfModel from './osf-model';
import SchemaBlock from './schema-block';

const { attr, hasMany } = DS;

export interface AbstractQuestion {
    type: 'string' | 'multiselect' | 'osf-author-import' | 'osf-upload' | 'choose' | 'object';
    format: string;
    required?: boolean;
    description?: string;
    properties?: Subquestion[];
    options?: string[];
}

export interface Subquestion extends AbstractQuestion {
    id: string;
}

export interface Question extends AbstractQuestion {
    qid: string;
    title: string;
    nav: string;
    help?: string;
}

export interface Page {
    id: string;
    title: string;
    questions: Question[];
    type?: 'object';
    description?: string;
    clipboardCopyPaste: boolean;
}

export interface SchemaUI {
    label?: string;
    description?: string;
}

export interface Schema {
    name: string;
    title: string;
    version: number;
    active: boolean;
    config: {
        hasFiles: boolean;
    };
    ui?: SchemaUI;
    pages: Page[];
    description: string;
}

export interface Answer<T> {
    value?: T;
    comments?: any[]; // String?
    extra?: object[];
}

export interface RegistrationMetadata {
    [qid: string]: Answer<string | string[] | boolean | RegistrationMetadata>;
}

export default class RegistrationSchemaModel extends OsfModel {
    @service intl!: Intl;

    @attr('boolean') active!: boolean;
    @attr('fixstring') name!: string;
    @attr('number') schemaVersion!: number;
    @attr('object') schema!: Schema;

    @hasMany('schema-block', { inverse: 'schema', async: false })
    schemaBlocks?: SchemaBlock[];

    @computed('schema.ui.label', 'name')
    get localizedName(): string {
        return this.localizeText(this.schema.ui && this.schema.ui.label) || this.name;
    }

    @computed('schema.{ui.description,description}')
    get localizedDescription(): string {
        return this.localizeText(this.schema.ui && this.schema.ui.description) || this.schema.description;
    }

    private localizeText(text?: string): string | undefined {
        if (!text) {
            return undefined;
        }
        if (!text.includes('|')) {
            return text;
        }
        const texts = text.split('|');
        return this.intl.locale.includes('ja') ? texts[0] : texts[1];
    }
}

declare module 'ember-data/types/registries/model' {
    export default interface ModelRegistry {
        'registration-schema': RegistrationSchemaModel;
    } // eslint-disable-line semi
}
