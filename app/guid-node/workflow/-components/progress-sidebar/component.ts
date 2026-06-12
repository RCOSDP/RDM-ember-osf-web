import Component from '@glimmer/component';

import { WorkflowTaskForm, WorkflowVariable } from '../../types';

import {
    getExpressionText,
    markActiveSteps,
    parseProgressSteps,
    ProgressStep,
} from './utils';

interface ProgressSidebarArgs {
    form?: WorkflowTaskForm;
    variables?: WorkflowVariable[];
    wizardSteps?: ProgressStep[];
}

export default class ProgressSidebar extends Component<ProgressSidebarArgs> {
    get expressionText(): string {
        return getExpressionText(this.args.form, this.args.variables);
    }

    get parsedExpression(): { steps: ProgressStep[]; remainingText: string } {
        const result = parseProgressSteps(this.expressionText);
        markActiveSteps(result.steps);
        return result;
    }

    get hasProgressSteps(): boolean {
        if (this.args.wizardSteps) {
            return this.args.wizardSteps.length > 0;
        }
        return this.parsedExpression.steps.length > 0;
    }

    get progressSteps(): ProgressStep[] {
        if (this.args.wizardSteps) {
            return this.args.wizardSteps;
        }
        return this.parsedExpression.steps;
    }
}
