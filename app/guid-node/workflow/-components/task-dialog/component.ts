import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import config from 'ember-get-config';

import Intl from 'ember-intl/services/intl';
import Node from 'ember-osf-web/models/node';

import {
    TaskDialogSubmission,
    WorkflowTaskDetail,
    WorkflowVariable,
} from '../../types';
import { workflowAssigneeDisplay } from '../../utils';
import { isFinalStep } from '../progress-sidebar/utils';
import { extractWizardConfig, WizardNavigation } from '../wizard-form/types';

interface WorkflowTaskDialogArgs {
    open: boolean;
    task: WorkflowTaskDetail | null;
    node: Node;
    isLoading: boolean;
    isSubmitting: boolean;
    error: string | null;
    actionError: string | null;
    onClose: () => void;
    onSubmit: (submission: TaskDialogSubmission) => void;
}

export default class WorkflowTaskDialog extends Component<WorkflowTaskDialogArgs> {
    @service intl!: Intl;
    @tracked formVariables: WorkflowVariable[] = [];
    @tracked isFormValid = true;
    @tracked wizardNav: WizardNavigation | null = null;

    get hasTask(): boolean {
        return Boolean(this.args.task);
    }

    get taskTitle(): string {
        const { task } = this.args;
        if (task && task.name) {
            return task.name;
        }
        return '';
    }

    get assigneeLabel(): string {
        return this.assigneeDisplayResult.label;
    }

    get assigneeUrl(): string | null {
        return this.assigneeDisplayResult.url;
    }

    private get assigneeDisplayResult() {
        const { task } = this.args;
        return workflowAssigneeDisplay(
            this.intl,
            task && task.assignee,
            task && task.assignee_user,
            config.OSF.url,
        );
    }

    get isWizardMode(): boolean {
        const { task } = this.args;
        return Boolean(task && task.form && extractWizardConfig(task.form.fields));
    }

    get canComplete(): boolean {
        const { task } = this.args;
        return !task || task.can_complete !== false;
    }

    get isFinalStep(): boolean {
        const { task } = this.args;
        if (!task) {
            return true;
        }
        return isFinalStep(task.form || undefined, task.variables);
    }

    @action
    handleFormChange(variables: WorkflowVariable[], isValid: boolean): void {
        this.formVariables = variables;
        this.isFormValid = isValid;
    }

    @action
    handleWizardNavigationChange(nav: WizardNavigation): void {
        this.wizardNav = nav;
    }

    @action
    handleSubmit(): void {
        if (!this.args.task) {
            return;
        }

        const submission: TaskDialogSubmission = {
            action: 'complete',
            variables: this.formVariables,
        };

        this.args.onSubmit(submission);
    }
}
