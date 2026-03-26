import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import Node from 'ember-osf-web/models/node';

import { WorkflowVariable } from '../../../types';
import { FieldHint } from '../../wizard-form/types';
import { resolveFlowableType } from '../component';
import { FieldValueWithType, WorkflowTaskField } from '../types';

interface ArrayInputRow {
    key: number;
    values: Record<string, unknown>;
}

interface ArrayInputArgs {
    fields: WorkflowTaskField[];
    value: FieldValueWithType | undefined;
    node?: Node;
    fieldHints?: Record<string, FieldHint>;
    disabled: boolean;
    onChange: (valueWithType: FieldValueWithType) => void;
}

export default class ArrayInput extends Component<ArrayInputArgs> {
    @tracked rows: ArrayInputRow[] = [];
    @tracked isInitialized = false;

    private nextKey = 0;

    private allocateKey(): number {
        return this.nextKey++;
    }

    get rowForms(): Array<{
        row: ArrayInputRow;
        label: string;
        form: { fields: WorkflowTaskField[] };
        variables: WorkflowVariable[];
    }> {
        return this.rows.map((row, index) => ({
            row,
            label: `#${index + 1}`,
            form: { fields: this.args.fields },
            variables: this.buildVariablesForRow(row),
        }));
    }

    @action
    initialize(): void {
        if (this.isInitialized) {
            return;
        }
        this.isInitialized = true;

        const existing = this.args.value;
        if (existing && Array.isArray(existing.value)) {
            const items = existing.value as Array<Record<string, unknown>>;
            this.rows = items.map(item => ({
                key: this.allocateKey(),
                values: { ...item },
            }));
        }
    }

    @action
    addRow(): void {
        this.rows = [
            ...this.rows,
            { key: this.allocateKey(), values: {} },
        ];
        this.notifyChange();
    }

    @action
    removeRow(key: number): void {
        this.rows = this.rows.filter(row => row.key !== key);
        this.notifyChange();
    }

    @action
    handleRowChange(key: number, variables: WorkflowVariable[]): void {
        const row = this.rows.find(r => r.key === key);
        if (!row) {
            return;
        }
        const values: Record<string, unknown> = {};
        for (const v of variables) {
            values[v.name] = v.value;
        }
        row.values = values;
        this.notifyChange();
    }

    private buildVariablesForRow(row: ArrayInputRow): WorkflowVariable[] {
        return this.args.fields
            .filter(field => !this.isDisplayField(field))
            .map(field => ({
                name: field.id,
                value: row.values[field.id] !== undefined ? row.values[field.id] : null,
                type: resolveFlowableType(field.type),
            }));
    }

    private isDisplayField(field: WorkflowTaskField): boolean {
        const type = field.type.toLowerCase();
        return ['expression', 'hyperlink', 'link', 'headline', 'headline-with-line', 'spacer', 'horizontal-line']
            .includes(type);
    }

    private notifyChange(): void {
        const value = this.rows.map(row => row.values);
        this.args.onChange({
            value,
            type: 'json',
        });
    }
}
