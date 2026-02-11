import OsfAdapter from './osf-adapter'; // Import OsfAdapter

export default class NodeMapcoreGroupAdapter extends OsfAdapter {
    urlForQuery(query: any, modelName: string) {
        query.visible = true;
        const { nodeId } = query;
        if (nodeId) {
            return `${this.host || ''}/v2/nodes/${nodeId}/map_core/groups`;
        }
        return super.urlForQuery(query, modelName as any);
    }
}

declare module 'ember-data/types/registries/adapter' {
    export default interface AdapterRegistry {
        'node-mapcore-group': NodeMapcoreGroupAdapter;
    } // eslint-disable-line semi
}
