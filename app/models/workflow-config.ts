import DS from 'ember-data';
import OsfModel from './osf-model';

const { attr } = DS;

export default class WorkFlowConfigModel extends OsfModel {
    @attr('string') param1!: string;
}

declare module 'ember-data/types/registries/model' {
    export default interface ModelRegistry {
        'workflow-config': WorkFlowConfigModel;
    } // eslint-disable-line semi
}
