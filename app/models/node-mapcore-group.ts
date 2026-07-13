import { buildValidations } from 'ember-cp-validations';
import DS from 'ember-data';
import OsfModel, { Permission } from './osf-model';

const { attr } = DS;

const Validations = buildValidations({});
export const permissions = Object.freeze(Object.values(Permission));

export default class NodeMapcoreGroupModel extends OsfModel.extend(Validations) {
    @attr('number') nodeGroupId!: number;
    @attr('number') creatorId!: number;
    @attr('fixstring') creator!: string;
    @attr('fixstring') permission!: Permission;
    @attr('number') mapcoreGroupId!: number;
    @attr('fixstring') name!: string;
    @attr('fixstring') created!: string;
    @attr('fixstring') modified!: string;
}

declare module 'ember-data/types/registries/model' {
    export default interface ModelRegistry {
        'node-mapcore-group': NodeMapcoreGroupModel;
    } // eslint-disable-line semi
}
