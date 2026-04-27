import Intl from 'ember-intl/services/intl';
import pathJoin from 'ember-osf-web/utils/path-join';

import { WorkflowAssigneeUser, WorkflowTaskForm } from './types';

export function isFlowableForm(form: WorkflowTaskForm | undefined | null): boolean {
    if (!form) {
        return false;
    }
    return Array.isArray(form.fields) && form.fields.length > 0;
}

export function isCedarForm(form: WorkflowTaskForm | undefined | null): boolean {
    if (!form) {
        return false;
    }
    return Boolean(form.data);
}

export interface WorkflowAssigneeDisplay {
    label: string;
    url: string | null;
}

export function workflowAssigneeDisplay(
    intl: Intl,
    assignee: string | undefined | null,
    assigneeUser: WorkflowAssigneeUser | null | undefined,
    osfBaseUrl: string,
): WorkflowAssigneeDisplay {
    if (assigneeUser) {
        return {
            label: assigneeUser.fullname,
            url: pathJoin(osfBaseUrl, assigneeUser.id),
        };
    }
    if (!assignee) {
        return { label: intl.t('workflow.console.tasks.dialog.unassigned') as string, url: null };
    }
    const lower = assignee.toLowerCase();
    if (lower === 'executor') {
        return { label: intl.t('workflow.console.tasks.assignee.executor') as string, url: null };
    }
    if (lower === 'creator') {
        return { label: intl.t('workflow.console.tasks.assignee.creator') as string, url: null };
    }
    if (lower === 'manager') {
        return { label: intl.t('workflow.console.tasks.assignee.manager') as string, url: null };
    }
    if (lower === 'contributor') {
        return { label: intl.t('workflow.console.tasks.assignee.contributor') as string, url: null };
    }
    return { label: assignee, url: null };
}
