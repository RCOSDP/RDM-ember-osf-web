import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import config from 'ember-get-config';

import GuidNodeWorkflowController, {
    normalizeTemplates,
    WorkflowTemplate,
} from 'ember-osf-web/guid-node/workflow/controller';
import {
    PendingTemplate,
    WorkflowActivationApiResponse,
    WorkflowTemplateApiResponse,
} from 'ember-osf-web/guid-node/workflow/types';
import Node from 'ember-osf-web/models/node';
import { GuidRouteModel } from 'ember-osf-web/resolve-guid/guid-route';
import CurrentUser from 'ember-osf-web/services/current-user';

function buildProjectWorkflowBase(guid: string): string {
    const { OSF } = config;
    const host = OSF.url.replace(/\/$/, '');
    const namespace = OSF.webApiNamespace.replace(/^\//, '').replace(/\/$/, '');
    const base = namespace ? `${host}/${namespace}` : host;
    return `${base}/project/${guid}/workflow/`;
}

function extractErrorMessage(error: unknown): string {
    const err = error as any;
    const response: any = (err && err.responseJSON) || (err && err.payload && err.payload.responseJSON);
    if (response && response.message) {
        return response.message as string;
    }
    if (response && response.data && response.data.message) {
        return response.data.message as string;
    }
    const text = (err && err.responseText) || (err && err.payload && err.payload.responseText);
    if (typeof text === 'string' && text.trim()) {
        return text;
    }
    const message = err && err.message;
    if (typeof message === 'string' && message.trim()) {
        return message;
    }
    return 'Failed to load workflow data.';
}

interface RouteModel {
    node: Node;
    templates: WorkflowTemplate[];
    pendingTemplates: PendingTemplate[];
    providesTemplates: boolean;
    apiBaseUrl: string;
    templatesError?: string | null;
}

function buildDisplayLabel(t: WorkflowTemplateApiResponse): string {
    const short = t.label || t.definition_name || t.definition_key || t.definition_id || t.id;
    return !t.is_local && t.node_title ? `${short} [${t.node_title}]` : short;
}

function extractPendingTemplates(templates: WorkflowTemplateApiResponse[]): PendingTemplate[] {
    return templates
        .filter(t => t.auto_activate && !t.activation_id && t.is_effectively_active)
        .map(t => ({ id: String(t.id), displayLabel: buildDisplayLabel(t) }));
}

export default class GuidNodeWorkflowRoute extends Route {
    @service currentUser!: CurrentUser;

    activate(): void {
        if (typeof window === 'undefined') {
            return;
        }
        window.addEventListener('hashchange', this.hashChangeHandler);
    }

    deactivate(): void {
        if (typeof window === 'undefined') {
            return;
        }
        window.removeEventListener('hashchange', this.hashChangeHandler);
    }

    async model(): Promise<RouteModel> {
        const nodeModel = this.modelFor('guid-node') as GuidRouteModel<Node>;
        const { taskInstance } = nodeModel;
        const node = await taskInstance;
        const guid = node.id;
        const apiBaseUrl = buildProjectWorkflowBase(guid);

        let templates: WorkflowTemplate[] = [];
        let pendingTemplates: PendingTemplate[] = [];
        let providesTemplates = false;
        let templatesError: string | null = null;

        try {
            const [activationsResponse, templatesResponse] = await Promise.all([
                this.currentUser.authenticatedAJAX({
                    url: `${apiBaseUrl}activations/`,
                    type: 'GET',
                }) as Promise<{ data: WorkflowActivationApiResponse[] }>,
                this.currentUser.authenticatedAJAX({
                    url: `${apiBaseUrl}templates/`,
                    type: 'GET',
                }) as Promise<{ data: WorkflowTemplateApiResponse[] }>,
            ]);
            templates = normalizeTemplates(activationsResponse.data);
            pendingTemplates = extractPendingTemplates(templatesResponse.data);
            providesTemplates = templatesResponse.data.some(t => t.is_local);
        } catch (error) {
            templatesError = extractErrorMessage(error);
        }

        return {
            node,
            templates,
            pendingTemplates,
            providesTemplates,
            apiBaseUrl,
            templatesError,
        };
    }

    setupController(controller: Controller, model: RouteModel): void {
        super.setupController(controller, model);
        const workflowController = controller as GuidNodeWorkflowController;
        workflowController.initialize(
            {
                node: model.node,
                templates: model.templates,
                pendingTemplates: model.pendingTemplates,
                providesTemplates: model.providesTemplates,
                apiBaseUrl: model.apiBaseUrl,
                templatesError: model.templatesError,
            },
            typeof window !== 'undefined' ? window.location.hash : '',
        );
    }

    private hashChangeHandler = () => {
        if (typeof window === 'undefined') {
            return;
        }
        const controller = this.controllerFor('guid-node.workflow') as GuidNodeWorkflowController;
        controller.updateSelectionFromHash(window.location.hash);
    }
}
