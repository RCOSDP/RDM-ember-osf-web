import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import Node from 'ember-osf-web/models/node';
import {
    WorkflowTaskField,
    WorkflowTaskForm,
    WorkflowVariable,
} from '../../types';
import { evaluateExpression } from '../wizard-form/expression-evaluator';
import { FieldHint } from '../wizard-form/types';
import { isValidFieldValue } from './field/component';
import { FieldValueWithType } from './types';

/**
 * Interface for Field components to call back into their parent form.
 * Provides setValue() for autofill: always goes through the view layer (View → Model).
 */
export interface FlowableFormContext {
    setFieldValue(fieldId: string, valueWithType: FieldValueWithType): void;
}

interface FlowableFormArgs {
    form: WorkflowTaskForm;
    variables?: WorkflowVariable[];
    node?: Node;
    fieldHints?: Record<string, FieldHint>;
    fieldContext?: Record<string, unknown>;
    onChange: (variables: WorkflowVariable[], isValid: boolean, isLoading: boolean) => void;
}

export function resolveFlowableType(fieldType: string | undefined): string {
    if (!fieldType) {
        return 'string';
    }
    const normalized = fieldType.toLowerCase();
    if (normalized === 'boolean') {
        return 'boolean';
    }
    if (normalized === 'date') {
        return 'date';
    }
    if (normalized === 'integer' || normalized === 'long') {
        return 'integer';
    }
    if (['double', 'decimal', 'number'].includes(normalized)) {
        return 'double';
    }
    return 'string';
}

interface FieldHandle {
    setValue(valueWithType: FieldValueWithType): void;
}

export default class FlowableForm extends Component<FlowableFormArgs> {
    @tracked fieldValues: Record<string, FieldValueWithType> = {};
    @tracked updatedFieldValues: Record<string, FieldValueWithType> = {};
    @tracked loadingFieldIds: Set<string> = new Set();

    private fieldRegistry = new Map<string, FieldHandle>();

    get formContext(): FlowableFormContext {
        return {
            setFieldValue: (fieldId: string, valueWithType: FieldValueWithType) => {
                this.fieldRegistry.get(fieldId)!.setValue(valueWithType);
            },
        };
    }

    get fields(): WorkflowTaskField[] {
        return this.args.form.fields || [];
    }

    get visibleFields(): WorkflowTaskField[] {
        return this.fields.filter(field => this.isFieldVisible(field));
    }

    get hasFields(): boolean {
        return this.fields.length > 0;
    }

    isFieldVisible(field: WorkflowTaskField): boolean {
        const hints = this.args.fieldHints;
        if (!hints) {
            return true;
        }
        const hint = hints[field.id];
        if (!hint || hint.visible === undefined || hint.visible === true) {
            return true;
        }
        if (hint.visible === false) {
            return false;
        }
        const ctx = this.args.fieldContext;
        if (!ctx) {
            return true;
        }
        return evaluateExpression(hint.visible, ctx);
    }

    get isValid(): boolean {
        return this.fields
            .filter(field => this.isSubmittableField(field) && this.isFieldVisible(field))
            .every(field => {
                const fieldValue = this.updatedFieldValues[field.id];
                if (fieldValue && fieldValue.valid === false) {
                    return false;
                }
                if (!field.required) {
                    return true;
                }
                const value = fieldValue && fieldValue.value;
                return isValidFieldValue(field, value);
            });
    }

    @action
    initialize(_element?: Element): void { // tslint:disable-line:variable-name
        const variables: WorkflowVariable[] = this.args.variables || [];
        const nextValues: Record<string, FieldValueWithType> = {};
        const nextUpdatedValues: Record<string, FieldValueWithType> = {};
        this.fields.forEach(field => {
            const variable = variables.find(v => v.name === field.id);
            let fieldValue: FieldValueWithType;

            if (variable) {
                fieldValue = {
                    ...variable,
                };
            } else {
                let initial = null;
                if (field.value !== undefined) {
                    initial = field.value;
                } else if (field.defaultValue !== undefined) {
                    initial = field.defaultValue;
                }
                fieldValue = {
                    value: initial,
                    type: resolveFlowableType(field.type),
                };
            }

            nextValues[field.id] = fieldValue;
            nextUpdatedValues[field.id] = fieldValue;
        });
        this.fieldValues = nextValues;
        this.updatedFieldValues = nextUpdatedValues;
        this.notifyChange();
    }

    @action
    registerField(fieldId: string, handle: FieldHandle): void {
        this.fieldRegistry.set(fieldId, handle);
    }

    @action
    unregisterField(fieldId: string): void {
        this.fieldRegistry.delete(fieldId);
    }

    @action
    handleFieldChange(fieldId: string, valueWithType: FieldValueWithType): void {
        this.updatedFieldValues = {
            ...this.updatedFieldValues,
            [fieldId]: valueWithType,
        };
        this.notifyChange();
    }

    @action
    handleFieldLoadingChange(fieldId: string, isLoading: boolean): void {
        const next = new Set(this.loadingFieldIds);
        if (isLoading) {
            next.add(fieldId);
        } else {
            next.delete(fieldId);
        }
        this.loadingFieldIds = next;
        this.notifyChange();
    }

    private isSubmittableField(field: WorkflowTaskField): boolean {
        const type = field.type.toLowerCase();
        const displayOnlyTypes = [
            'expression', 'hyperlink', 'link', 'headline', 'headline-with-line', 'spacer', 'horizontal-line',
        ];
        if (displayOnlyTypes.includes(type)) {
            return false;
        }
        if (field.readOnly) {
            return false;
        }
        return true;
    }

    private notifyChange(): void {
        const variables = this.fields
            .filter(field => this.isSubmittableField(field))
            .map(field => {
                const fieldValue = this.updatedFieldValues[field.id];
                return {
                    name: field.id,
                    ...fieldValue,
                };
            });

        this.args.onChange(variables, this.isValid, this.loadingFieldIds.size > 0);
    }
}
