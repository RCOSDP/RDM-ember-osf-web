import Controller from '@ember/controller';
import { assert } from '@ember/debug';
import { action, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency-decorators';
import DS from 'ember-data';

import MetadataNodeSchemaModel from 'ember-osf-web/models/metadata-node-schema';
import Node from 'ember-osf-web/models/node';
import RegistrationSchema from 'ember-osf-web/models/registration-schema';
import Analytics from 'ember-osf-web/services/analytics';

function checkGRDMSchema(schema: RegistrationSchema) {
    return schema.schema.pages
        .some(page => page.questions
            .some(question => question.qid === 'grdm-files'));
}

export default class GuidNodeMetadata extends Controller {
    @service analytics!: Analytics;
    @service store!: DS.Store;

    queryParams = ['tab'];
    tab?: string;

    draftsQueryParams = { embed: ['initiator', 'registration_schema', 'branched_from'] };
    defaultSchema!: RegistrationSchema;
    selectedSchema!: RegistrationSchema;
    schemas: RegistrationSchema[] = [];
    newModalOpen = false;
    metadataSchema: MetadataNodeSchemaModel | null = null;

    reloadDrafts?: (page?: number) => void; // bound by paginated-list

    @task
    getRegistrationSchemas = task(function *(this: GuidNodeMetadata) {
        const allSchemas: RegistrationSchema[] = [];
        let page = 1;
        while (true) {
            const result = yield this.store.query('registration-schema',
                {
                    filter: {
                        active: true,
                    },
                    page,
                });
            Array.prototype.push.apply(allSchemas, result.toArray());
            if (!result.links.next) { break; }
            page += 1;
        }
        const schemas = allSchemas.filter((a: RegistrationSchema) => checkGRDMSchema(a));
        schemas.sort((a: RegistrationSchema, b: RegistrationSchema) => a.name.length - b.name.length);

        const node: Node = yield this.model.taskInstance;
        const metadataSchema: MetadataNodeSchemaModel = yield this.store
            .findRecord('metadata-node-schema', node.id);
        this.set('metadataSchema', metadataSchema);

        this.set('defaultSchema', schemas.firstObject);
        this.set('selectedSchema', this.defaultSchema);
        this.set('schemas', schemas);
    });

    @alias('model.taskInstance.value') node!: Node | null;

    @computed('tab')
    get activeTab() {
        return this.tab ? this.tab : 'reports';
    }

    @computed('node.{id,root.id,root.userHasAdminPermission}')
    get isComponentRootAdmin() {
        return this.node && this.node.id !== this.node.root.get('id') && this.node.root.get('userHasAdminPermission');
    }

    @action
    changeTab(activeId: string) {
        this.set('tab', activeId === 'reports' ? undefined : activeId);
        this.analytics.click('tab', `Reports tab - Change tab to: ${activeId}`);
    }

    @action
    closeNewModal() {
        this.set('newModalOpen', false);
        this.set('selectedSchema', this.defaultSchema);
    }

    @action
    schemaChanged(schema: RegistrationSchema) {
        this.set('selectedSchema', schema);
        this.analytics.click('radio', `New report - Select schema: ${schema.name}`);
    }

    @action
    async createDraft() {
        const branchedFrom = this.node!;
        assert('Check that the node exists', Boolean(branchedFrom));

        if (this.selectedSchema.name === 'Prereg Challenge' && this.newModalOpen) {
            throw new Error('Unsupported schema: Prereg Challenge');
        }
        const draftRegistration = this.store.createRecord('draft-registration', {
            registrationSupplement: this.selectedSchema.id,
            branchedFrom,
            registrationSchema: this.selectedSchema,
        });
        await draftRegistration.save();
        this.set('newModalOpen', false);
        this.set('selectedSchema', this.defaultSchema);

        this.transitionToRoute(
            'guid-node.reports',
            branchedFrom.id,
            draftRegistration.id,
        );
    }
}

declare module '@ember/controller' {
    interface Registry {
        'guid-node/metadata': GuidNodeMetadata;
    }
}