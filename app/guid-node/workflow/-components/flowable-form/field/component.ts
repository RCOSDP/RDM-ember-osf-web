import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import { htmlSafe } from '@ember/template';
import { fetchSuggestions, SuggestionResult } from 'ember-osf-web/utils/suggestion-api';

import { WorkflowVariable } from '../../../types';
import { parseProgressSteps, ProgressStep } from '../../progress-sidebar/utils';
import { evaluateTemplate, hasTemplateDirectives } from '../../wizard-form/template-evaluator';
import { FieldHint, SuggestionConfig } from '../../wizard-form/types';
import { FlowableFormContext, resolveFlowableType } from '../component';
import { FieldValueWithType, WorkflowTaskField, WorkflowTaskFieldOption } from '../types';
import {
    extractArrayInput, extractExportTarget, extractFileMetadata, extractFileSelector, extractFileUploader,
    extractProjectMetadata, FilterClause,
} from '../utils';

function renderTemplateAsHtml(tmpl: string, value: Record<string, any>): ReturnType<typeof htmlSafe> {
    const rendered = tmpl.replace(/\{\{(\w+)\}\}/g, (_: string, field: string) => {
        const v = value[field];
        return v != null ? String(v) : '';
    });
    return htmlSafe(rendered);
}

function getOptionValue(option: WorkflowTaskFieldOption): string | undefined {
    return (option.id !== undefined && option.id !== null) ? option.id : option.name;
}

function isValidFieldValue(field: WorkflowTaskField, value: unknown): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'string' && value.trim() === '') {
        return false;
    }
    const type = field.type.toLowerCase();
    if (['dropdown', 'select', 'radio-buttons', 'radio'].includes(type)) {
        const options = field.options || [];
        const selectable = field.hasEmptyValue ? options.slice(1) : options;
        const validValues = selectable.map(getOptionValue).filter(v => v !== undefined && v !== null && v !== '');
        if (validValues.length > 0 && !validValues.includes(String(value))) {
            return false;
        }
    }
    return true;
}

function toStringValue(fieldValue: FieldValueWithType): string {
    if (fieldValue.type === 'string') {
        return fieldValue.value as string;
    }
    const val = fieldValue.value;
    if (val === null || val === undefined) {
        return '';
    }
    return String(val);
}

function toBooleanValue(fieldValue: FieldValueWithType): boolean {
    if (fieldValue.type === 'boolean') {
        return fieldValue.value as boolean;
    }
    if (fieldValue.type === 'string') {
        const val = fieldValue.value as string;
        return val.toLowerCase() === 'true';
    }
    return false;
}

export { isValidFieldValue, getOptionValue, toStringValue, toBooleanValue };

interface TaskFormFieldArgs {
    field: WorkflowTaskField;
    fieldValues: Record<string, FieldValueWithType>;
    variables: WorkflowVariable[];
    node?: any;
    fieldHints?: Record<string, FieldHint>;
    formContext?: FlowableFormContext;
    fieldContext?: Record<string, unknown>;
    onChange: (fieldId: string, valueWithType: FieldValueWithType) => void;
    onLoadingChange?: (fieldId: string, isLoading: boolean) => void;
    onRegister?: (fieldId: string, handle: { setValue(v: FieldValueWithType): void }) => void;
    onUnregister?: (fieldId: string) => void;
}

export default class TaskFormField extends Component<TaskFormFieldArgs> {
    @tracked updatedValue: FieldValueWithType | null = null;
    @tracked suggestionResults: SuggestionResult[] = [];
    @tracked showSuggestions = false;

    private searchTimer: ReturnType<typeof setTimeout> | null = null;

    // --- Field registry (for autofill via view layer) ---

    setValue(valueWithType: FieldValueWithType): void {
        this.updatedValue = valueWithType;
        this.args.onChange(this.args.field.id, valueWithType);
    }

    @action
    onFieldInsert(): void {
        if (this.args.onRegister) { this.args.onRegister(this.args.field.id, this); }
    }

    @action
    onFieldDestroy(): void {
        if (this.args.onUnregister) { this.args.onUnregister(this.args.field.id); }
    }

    // --- Hint accessors ---

    get hint(): FieldHint | undefined {
        return this.args.fieldHints && this.args.fieldHints[this.args.field.id];
    }

    get suggestionConfigs(): SuggestionConfig[] | null {
        const configs = this.hint && this.hint.suggestion;
        if (!configs || !configs.length) {
            return null;
        }
        return configs.filter((s: SuggestionConfig) => Boolean(s.template));
    }

    get hasSuggestion(): boolean {
        return this.suggestionConfigs !== null && this.suggestionConfigs.length > 0;
    }

    get widthStyle(): string | undefined {
        const width = this.hint && this.hint.ui && this.hint.ui.width;
        if (width === 'narrow') {
            return 'max-width: 25%;';
        }
        if (width === 'half') {
            return 'max-width: 50%;';
        }
        return undefined;
    }

    get isFreetext(): boolean {
        return Boolean(this.hint && this.hint.ui && this.hint.ui.freetext);
    }

    // --- Suggestion / typeahead ---

    get suggestionItems(): Array<{ key: string; html: ReturnType<typeof htmlSafe> }> {
        const configs = this.suggestionConfigs!;
        return this.suggestionResults.map((result, idx) => {
            const config = configs.find(c => c.key === result.key)!;
            return {
                key: String(idx),
                html: renderTemplateAsHtml(config.template!, result.value),
            };
        });
    }

    @action
    onTypeaheadInput(event: Event): void {
        const text = (event.target as HTMLInputElement).value;
        this.setValue({
            value: text === '' ? null : text,
            type: 'string',
        });
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
        }
        this.searchTimer = setTimeout(() => this.doSearch(text), 300);
    }

    @action
    onTypeaheadBlur(): void {
        setTimeout(() => { this.showSuggestions = false; }, 200);
    }

    @action
    onSuggestionSelect(key: string): void {
        const idx = parseInt(key, 10);
        const result = this.suggestionResults[idx];
        const configs = this.suggestionConfigs!;
        const config = configs.find(c => c.key === result.key)!;

        const valueField = config.valueField || config.key.split(':')[1];
        this.setValue({
            value: String(result.value[valueField]),
            type: 'string',
        });
        this.showSuggestions = false;

        if (config.autofill) {
            this.applyAutofill(config.autofill, result.value);
        }
    }

    // --- Standard field handlers ---

    @action
    handleChange(event: Event): void {
        const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        let value: unknown;

        if (this.isBoolean) {
            const input = target as HTMLInputElement;
            value = input.checked;
        } else if (this.type === 'integer' || this.type === 'long') {
            const stringValue = target.value;
            if (stringValue === '') {
                value = null;
            } else {
                const parsed = parseInt(stringValue, 10);
                value = Number.isNaN(parsed) ? null : parsed;
            }
        } else if (this.isNumber) {
            const stringValue = target.value;
            if (stringValue === '') {
                value = null;
            } else {
                const parsed = parseFloat(stringValue);
                value = Number.isNaN(parsed) ? null : parsed;
            }
        } else {
            // string, date, etc.
            const stringValue = target.value;
            value = stringValue === '' ? null : stringValue;
        }

        const valueWithType: FieldValueWithType = {
            value: value !== undefined ? value : null,
            type: resolveFlowableType(this.args.field.type),
        };
        this.updatedValue = valueWithType;
        this.args.onChange(this.args.field.id, valueWithType);
    }

    @action
    handleProjectMetadataSelection(valueWithType: FieldValueWithType): void {
        this.updatedValue = valueWithType;
        this.args.onChange(this.args.field.id, valueWithType);
    }

    @action
    handleFileMetadataSelection(valueWithType: FieldValueWithType): void {
        this.updatedValue = valueWithType;
        this.args.onChange(this.args.field.id, valueWithType);
    }

    @action
    handleFileSelectorChange(valueWithType: FieldValueWithType): void {
        this.updatedValue = valueWithType;
        this.args.onChange(this.args.field.id, valueWithType);
    }

    @action
    handleFileUploaderChange(valueWithType: FieldValueWithType): void {
        this.updatedValue = valueWithType;
        this.args.onChange(this.args.field.id, valueWithType);
    }

    @action
    handleExportTargetChange(valueWithType: FieldValueWithType): void {
        this.updatedValue = valueWithType;
        this.args.onChange(this.args.field.id, valueWithType);
    }

    @action
    handleLoadingChange(isLoading: boolean): void {
        if (this.args.onLoadingChange) { this.args.onLoadingChange(this.args.field.id, isLoading); }
    }

    @action
    handleArrayInputChange(valueWithType: FieldValueWithType): void {
        this.updatedValue = valueWithType;
        this.args.onChange(this.args.field.id, valueWithType);
    }

    get displayValue(): unknown {
        if (this.updatedValue !== null) {
            return this.updatedValue.value;
        }
        const current = this.currentValue;
        return current ? current.value : null;
    }

    get hasRequiredError(): boolean {
        if (!this.isRequired) {
            return false;
        }
        const val = this.displayValue;
        return !isValidFieldValue(this.args.field, val);
    }

    get hasCustomError(): boolean {
        const current = this.updatedValue || this.currentValue;
        return current !== undefined && current !== null && current.valid === false;
    }

    get hasError(): boolean {
        return this.hasRequiredError || this.hasCustomError;
    }
    get type(): string {
        return this.args.field.type;
    }

    get fieldId(): string {
        return `workflow-field-${this.args.field.id}`;
    }

    get isRequired(): boolean {
        return this.args.field.required === true;
    }

    get isReadOnly(): boolean {
        return this.args.field.readOnly === true;
    }

    get placeholder(): string | undefined {
        return this.args.field.placeholder;
    }

    get fieldLabel(): string {
        return this.args.field.name || this.args.field.id;
    }

    get currentValue(): FieldValueWithType | undefined {
        return this.args.fieldValues[this.args.field.id];
    }

    get stringValue(): string {
        if (this.updatedValue !== null) {
            return toStringValue(this.updatedValue);
        }
        const current = this.currentValue;
        if (!current) {
            return '';
        }
        return toStringValue(current);
    }

    get booleanValue(): boolean {
        if (this.updatedValue !== null) {
            return toBooleanValue(this.updatedValue);
        }
        const current = this.currentValue;
        if (!current) {
            return false;
        }
        return toBooleanValue(current);
    }

    get options(): WorkflowTaskFieldOption[] {
        return this.args.field.options || [];
    }

    get optionsWithValue(): Array<{ option: WorkflowTaskFieldOption; value: string }> {
        let opts = this.options;
        if (this.args.field.hasEmptyValue && opts.length > 0) {
            opts = opts.slice(1);
        }
        return opts.map(opt => ({
            option: opt,
            value: getOptionValue(opt) || '',
        }));
    }

    get hasOptions(): boolean {
        return this.options.length > 0;
    }

    get isTextField(): boolean {
        return this.type === 'text' || this.type === 'string';
    }

    get isTextarea(): boolean {
        if (this.isProjectMetadataSelector || this.isArrayInput) {
            return false;
        }
        if (this.isFileSelector || this.isFileUploader || this.isExportTarget) {
            return false;
        }
        return this.type === 'multi-line-text' || this.type === 'textarea';
    }

    get isFileSelector(): boolean {
        return extractFileSelector(this.args.field);
    }

    get fileUploaderPlaceholder() {
        return extractFileUploader(this.args.field);
    }

    get isFileUploader(): boolean {
        return this.fileUploaderPlaceholder !== null;
    }

    get isExportTarget(): boolean {
        return extractExportTarget(this.args.field);
    }

    get arrayInputPlaceholder() {
        return extractArrayInput(this.args.field);
    }

    get isArrayInput(): boolean {
        return this.arrayInputPlaceholder !== null;
    }

    get arrayInputFields() {
        return this.arrayInputPlaceholder ? this.arrayInputPlaceholder.fields : [];
    }

    get arrayFieldHints(): Record<string, FieldHint> | undefined {
        const allHints = this.args.fieldHints;
        if (!allHints) {
            return undefined;
        }
        const prefix = `${this.args.field.id}.`;
        const subHints: Record<string, FieldHint> = {};
        let found = false;
        for (const [key, hint] of Object.entries(allHints)) {
            if (key.startsWith(prefix)) {
                subHints[key.substring(prefix.length)] = hint;
                found = true;
            }
        }
        return found ? subHints : undefined;
    }

    get projectMetadataPlaceholder() {
        return extractProjectMetadata(this.args.field);
    }

    get isProjectMetadataSelector(): boolean {
        return this.projectMetadataPlaceholder !== null;
    }

    get projectMetadataSchemaName(): string | null {
        return this.projectMetadataPlaceholder ? this.projectMetadataPlaceholder.schemaName : null;
    }

    get projectMetadataMultiSelect(): boolean {
        const placeholder = this.projectMetadataPlaceholder;
        return placeholder ? placeholder.multiSelect : false;
    }

    get projectMetadataFilters(): FilterClause[] {
        const placeholder = this.projectMetadataPlaceholder;
        return placeholder ? placeholder.filters : [];
    }

    get fileMetadataPlaceholder() {
        return extractFileMetadata(this.args.field);
    }

    get isFileMetadataSelector(): boolean {
        return this.fileMetadataPlaceholder !== null;
    }

    get fileMetadataSchemaName(): string | null {
        return this.fileMetadataPlaceholder ? this.fileMetadataPlaceholder.schemaName : null;
    }

    get fileMetadataMultiSelect(): boolean {
        const placeholder = this.fileMetadataPlaceholder;
        return placeholder ? placeholder.multiSelect : false;
    }

    get fileMetadataFilters(): FilterClause[] {
        const placeholder = this.fileMetadataPlaceholder;
        return placeholder ? placeholder.filters : [];
    }

    get isPassword(): boolean {
        return this.type === 'password';
    }

    get isNumber(): boolean {
        return ['number', 'integer', 'decimal', 'double', 'long'].includes(this.type);
    }

    get isBoolean(): boolean {
        return this.type === 'boolean' || this.type === 'checkbox';
    }

    get isDate(): boolean {
        return this.type === 'date';
    }

    get isSelect(): boolean {
        return this.type === 'select' || this.type === 'dropdown';
    }

    get isRadio(): boolean {
        return this.type === 'radio-buttons' || this.type === 'radio';
    }

    get isUpload(): boolean {
        return this.type === 'upload' || this.type === 'file';
    }

    get isExpression(): boolean {
        return this.type === 'expression';
    }

    get isHyperlink(): boolean {
        return this.type === 'hyperlink' || this.type === 'link';
    }

    get isHeadline(): boolean {
        return this.type === 'headline';
    }

    get isHeadlineWithLine(): boolean {
        return this.type === 'headline-with-line';
    }

    get isSpacer(): boolean {
        return this.type === 'spacer';
    }

    get isHorizontalLine(): boolean {
        return this.type === 'horizontal-line';
    }

    get isDisplayOnly(): boolean {
        return this.isExpression || this.isHyperlink || this.isHeadline
            || this.isHeadlineWithLine || this.isSpacer || this.isHorizontalLine;
    }

    get expressionText(): string {
        const field = this.args.field as unknown as { expression?: string };
        const expression = field.expression || '';

        // Step 1: ${...} (Flowable UEL) resolution
        const uelResolved = expression.replace(/\$\{([^}]+)\}/g, (_, varName) => {
            const trimmed = varName.trim();
            const variable = this.args.variables.find(v => v.name === trimmed);
            if (variable) {
                return toStringValue(variable);
            }
            const fieldValue = this.args.fieldValues[trimmed];
            if (fieldValue) {
                return toStringValue(fieldValue);
            }
            return '';
        });

        // Step 2: {{ }} / {% %} template directives (client-side)
        if (!hasTemplateDirectives(uelResolved)) {
            return uelResolved;
        }
        // Build context from variables (tracked via currentPageVariables)
        // rather than fieldContext (not tracked by Glimmer).
        const ctx: Record<string, unknown> = {};
        for (const v of this.args.variables) {
            ctx[v.name] = v.value;
        }
        return evaluateTemplate(uelResolved, ctx);
    }

    get hyperlinkUrl(): string {
        const field = this.args.field as unknown as { params?: { hyperlinkUrl?: string } };
        return (field.params && field.params.hyperlinkUrl) || '#';
    }

    get parsedExpression(): { steps: ProgressStep[]; remainingText: string } {
        return parseProgressSteps(this.expressionText);
    }

    get hasProgressSteps(): boolean {
        return this.parsedExpression.steps.length > 0;
    }

    get remainingExpressionText(): string {
        return this.parsedExpression.remainingText;
    }

    private applyAutofill(autofillMap: Record<string, string>, responseValue: Record<string, any>): void {
        const formContext = this.args.formContext!;
        const allHints = this.args.fieldHints || {};

        for (const [targetFieldId, responseField] of Object.entries(autofillMap)) {
            const rawValue = responseValue[responseField];
            if (rawValue == null) {
                continue;
            }
            let resolved = String(rawValue);
            const targetHint = allHints[targetFieldId];
            const targetOptionMap = targetHint && targetHint.ui && targetHint.ui.optionMap;
            if (targetOptionMap && targetOptionMap[resolved]) {
                resolved = targetOptionMap[resolved];
            }
            formContext.setFieldValue(targetFieldId, { value: resolved, type: 'string' });
        }
    }

    private async doSearch(keyword: string): Promise<void> {
        const { node } = this.args;
        if (!node) {
            return;
        }
        const keys = this.suggestionConfigs!.map(c => c.key);
        const results = await fetchSuggestions(node.id, keys, keyword);
        this.suggestionResults = results;
        this.showSuggestions = results.length > 0;
    }
}
