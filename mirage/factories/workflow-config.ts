import { Factory } from 'ember-cli-mirage';

import WorkFlowConfigModel from 'ember-osf-web/models/iqbrims-status';

export default Factory.extend<WorkFlowConfigModel>({
});

declare module 'ember-cli-mirage/types/registries/schema' {
    export default interface MirageSchemaRegistry {
        workflowConfigs: WorkFlowConfigModel;
    } // eslint-disable-line semi
}
