import OsfSerializer from './osf-serializer';

export default class WorkFlowConfigSerializer extends OsfSerializer {
}

declare module 'ember-data/types/registries/serializer' {
    export default interface SerializerRegistry {
        'workflow-config': WorkFlowConfigSerializer;
    } // eslint-disable-line semi
}
