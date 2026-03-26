import Component from '@glimmer/component';

import Node from 'ember-osf-web/models/node';
import {
    WorkflowTaskForm,
    WorkflowVariable,
} from '../../types';
import { isCedarForm, isFlowableForm } from '../../utils';
import { extractWizardConfig, WizardNavigation } from '../wizard-form/types';

interface TaskFormArgs {
    form: WorkflowTaskForm;
    variables: WorkflowVariable[];
    node?: Node;
    taskId?: string;
    onChange: (variables: WorkflowVariable[], isValid: boolean) => void;
    onSubmit?: () => void;
    onWizardNavigationChange?: (nav: WizardNavigation) => void;
}

export default class TaskForm extends Component<TaskFormArgs> {
    get hasWizardForm(): boolean {
        return isFlowableForm(this.args.form) && extractWizardConfig(this.args.form.fields) !== null;
    }

    get hasFlowableForm(): boolean {
        return isFlowableForm(this.args.form);
    }

    get hasCedarForm(): boolean {
        return isCedarForm(this.args.form);
    }

    get noFormAvailable(): boolean {
        return !this.hasWizardForm && !this.hasFlowableForm && !this.hasCedarForm;
    }
}
