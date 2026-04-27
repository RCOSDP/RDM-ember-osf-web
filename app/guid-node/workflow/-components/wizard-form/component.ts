import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import Node from 'ember-osf-web/models/node';
import {
    WorkflowTaskForm,
    WorkflowVariable,
} from '../../types';
import { resolveFlowableType } from '../flowable-form/component';
import { FieldValueWithType } from '../flowable-form/types';
import { clearDraft, collectExpiredDrafts, loadDraft, saveDraft } from './draft-utils';
import { buildProgressTree, flattenPages, getVisiblePages } from './page-utils';
import { extractWizardConfig, RdmWizard, WizardNavigation } from './types';

interface WizardFormArgs {
    form: WorkflowTaskForm;
    variables?: WorkflowVariable[];
    node?: Node;
    taskId?: string;
    onChange: (variables: WorkflowVariable[], isValid: boolean) => void;
    onSubmit: () => void;
    onNavigationChange?: (nav: WizardNavigation) => void;
}

const DISPLAY_ONLY_TYPES = new Set([
    'expression', 'hyperlink', 'link', 'headline', 'headline-with-line', 'spacer', 'horizontal-line',
]);

export default class WizardForm extends Component<WizardFormArgs> {
    @tracked currentPageId = '';
    @tracked currentPageForm: WorkflowTaskForm = { fields: [] };
    @tracked currentPageVariables: WorkflowVariable[] = [];
    @tracked visitedPageIds: Set<string> = new Set();
    @tracked pageTitle = '';
    @tracked currentPageValid = true;
    @tracked currentPageLoading = false;

    private allFieldValues: Record<string, FieldValueWithType> = {};
    private draftDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    get wizard(): RdmWizard {
        return extractWizardConfig(this.args.form.fields)!;
    }

    get fieldHints() {
        return this.wizard.fieldHints;
    }

    get fieldContext(): Record<string, unknown> {
        return this.getFieldContext();
    }

    get allowBack(): boolean {
        const nav = this.wizard.navigation;
        return nav ? nav.allowBack !== false : true;
    }

    @action
    initialize(): void {
        collectExpiredDrafts();

        const variables = this.args.variables || [];
        const allFields = this.args.form.fields || [];
        const nextValues: Record<string, FieldValueWithType> = {};

        for (const field of allFields) {
            const variable = variables.find(v => v.name === field.id);
            if (variable) {
                nextValues[field.id] = { value: variable.value, type: variable.type };
            } else {
                let initial = null;
                if (field.value !== undefined) {
                    initial = field.value;
                } else if (field.defaultValue !== undefined) {
                    initial = field.defaultValue;
                }
                nextValues[field.id] = { value: initial, type: resolveFlowableType(field.type) };
            }
        }

        // Restore draft if available
        const { taskId } = this.args;
        const formKey = this.args.form.key || '';
        let restoredPageId = '';
        if (taskId) {
            const draft = loadDraft(taskId, formKey);
            if (draft) {
                for (const [id, fv] of Object.entries(draft.fieldValues)) {
                    if (id in nextValues) {
                        nextValues[id] = { value: fv.value, type: fv.type };
                    }
                }
                restoredPageId = draft.currentPageId;
            }
        }

        this.allFieldValues = nextValues;

        // Set initial page
        const pages = this.getVisiblePages();
        if (restoredPageId && pages.some(p => p.id === restoredPageId)) {
            this.currentPageId = restoredPageId;
            const visited = new Set<string>();
            for (const p of pages) {
                if (p.id === restoredPageId) {
                    break;
                }
                visited.add(p.id);
            }
            this.visitedPageIds = visited;
        } else if (pages.length > 0) {
            this.currentPageId = pages[0].id;
            this.visitedPageIds = new Set();
        }

        this.updatePageForm();
        this.emitNavigation();
        this.emitAllVariables();
    }

    @action
    handlePageFieldChange(pageVariables: WorkflowVariable[], isValid: boolean, isLoading: boolean): void {
        for (const v of pageVariables) {
            this.allFieldValues[v.name] = { value: v.value, type: v.type };
        }
        this.currentPageValid = isValid;
        this.currentPageLoading = isLoading;
        this.emitNavigation();
        this.scheduleDraftSave();
        this.emitAllVariables();
    }

    @action
    goNext(): void {
        const pages = this.getVisiblePages();
        const idx = pages.findIndex(p => p.id === this.currentPageId);
        if (idx < pages.length - 1) {
            const visited = new Set(this.visitedPageIds);
            visited.add(this.currentPageId);
            this.visitedPageIds = visited;
            this.currentPageId = pages[idx + 1].id;
            this.updatePageForm();
            this.scrollToTop();

            this.emitNavigation();
            this.saveDraftNow();
        }
    }

    @action
    goBack(): void {
        const pages = this.getVisiblePages();
        const idx = pages.findIndex(p => p.id === this.currentPageId);
        if (idx > 0) {
            this.currentPageId = pages[idx - 1].id;
            this.updatePageForm();
            this.scrollToTop();

            this.emitNavigation();
            this.saveDraftNow();
        }
    }

    @action
    goToPage(pageId: string): void {
        const pages = this.getVisiblePages();
        if (pages.some(p => p.id === pageId)) {
            this.currentPageId = pageId;
            this.updatePageForm();
            this.scrollToTop();

            this.emitNavigation();
        }
    }

    @action
    handleFinalSubmit(): void {
        const { taskId } = this.args;
        if (taskId) {
            clearDraft(taskId);
        }
        this.emitAllVariables();
        this.args.onSubmit();
    }

    private emitNavigation(): void {
        if (!this.args.onNavigationChange) {
            return;
        }
        const pages = this.getVisiblePages();
        const idx = pages.findIndex(p => p.id === this.currentPageId);
        this.args.onNavigationChange({
            isFirstPage: idx <= 0,
            isLastPage: idx >= pages.length - 1,
            allowBack: this.allowBack,
            canGoNext: this.currentPageValid && !this.currentPageLoading,
            progressSteps: buildProgressTree(
                this.wizard.pages,
                this.currentPageId,
                this.visitedPageIds,
                this.getFieldContext(),
            ),
            goNext: () => this.goNext(),
            goBack: () => this.goBack(),
            submit: () => this.handleFinalSubmit(),
        });
    }

    private getFieldContext(): Record<string, unknown> {
        const ctx: Record<string, unknown> = {};
        for (const v of this.args.variables || []) {
            ctx[v.name] = v.value;
        }
        for (const [id, fv] of Object.entries(this.allFieldValues)) {
            ctx[id] = fv.value;
        }
        return ctx;
    }

    private getVisiblePages() {
        return getVisiblePages(this.wizard.pages, this.getFieldContext());
    }

    private updatePageForm(): void {
        const allPages = flattenPages(this.wizard.pages);
        const page = allPages.find(p => p.id === this.currentPageId);
        if (!page) {
            this.currentPageForm = { fields: [] };
            return;
        }
        const fieldIdSet = new Set(page.fieldIds);
        const fields = (this.args.form.fields || []).filter(f => fieldIdSet.has(f.id));
        this.currentPageForm = { fields };
        this.pageTitle = page.title;

        // Resolve alias: for alias fields on this page, use source field's value
        const alias = this.wizard.alias || {};
        for (const field of fields) {
            const sourceId = alias[field.id];
            if (!sourceId) {
                continue;
            }
            const source = this.allFieldValues[sourceId];
            if (source) {
                this.allFieldValues[field.id] = { ...this.allFieldValues[field.id], value: source.value };
            }
        }

        // Build variables: task variables first, then all field values (field values take precedence)
        const vars: WorkflowVariable[] = [];
        const emitted = new Set<string>();
        for (const [id, fv] of Object.entries(this.allFieldValues)) {
            vars.push({ name: id, value: fv.value, type: fv.type });
            emitted.add(id);
        }
        for (const v of this.args.variables || []) {
            if (!emitted.has(v.name)) {
                vars.push(v);
            }
        }
        this.currentPageVariables = vars;
    }

    private emitAllVariables(): void {
        const allFields = this.args.form.fields || [];
        const alias = this.wizard.alias || {};
        const variables: WorkflowVariable[] = [];
        for (const field of allFields) {
            if (DISPLAY_ONLY_TYPES.has(field.type.toLowerCase())) {
                continue;
            }
            if (field.readOnly) {
                // readOnly alias: resolve from source field's current value
                const sourceId = alias[field.id];
                if (sourceId) {
                    const source = this.allFieldValues[sourceId];
                    const aliasFv = this.allFieldValues[field.id];
                    if (source && aliasFv) {
                        variables.push({ name: field.id, value: source.value, type: aliasFv.type });
                    }
                }
                continue;
            }
            const fv = this.allFieldValues[field.id];
            if (fv) {
                variables.push({ name: field.id, value: fv.value, type: fv.type });
            }
        }
        this.args.onChange(variables, true);
    }

    private scrollToTop(): void {
        document.querySelector('.task-dialog__body')!.scrollTop = 0;
    }

    private scheduleDraftSave(): void {
        if (this.draftDebounceTimer) {
            clearTimeout(this.draftDebounceTimer);
        }
        this.draftDebounceTimer = setTimeout(() => this.saveDraftNow(), 1000);
    }

    private saveDraftNow(): void {
        const { taskId } = this.args;
        if (!taskId) {
            return;
        }
        const values: Record<string, { value: unknown; type: string }> = {};
        for (const [id, fv] of Object.entries(this.allFieldValues)) {
            values[id] = { value: fv.value, type: fv.type };
        }
        saveDraft(taskId, this.args.form.key || '', this.currentPageId, values);
    }
}
