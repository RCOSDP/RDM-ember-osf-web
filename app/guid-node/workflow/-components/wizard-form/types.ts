import { ProgressStep } from '../progress-sidebar/utils';

export interface RdmWizardPage {
    id: string;
    title: string;
    type?: 'group';
    fields?: string[];
    pages?: RdmWizardPage[];
    visible?: string | boolean;
}

export interface RdmWizardNavigation {
    allowBack?: boolean;
    allowHeaderNavigation?: boolean;
}

export interface RdmWizardProgress {
    style?: 'sidebar' | 'steps';
}

export interface SuggestionConfig {
    key: string;
    template?: string;
    valueField?: string;
    autofill?: Record<string, string>;
}

export interface FieldHintUI {
    width?: 'narrow' | 'half' | 'full';
    freetext?: boolean;
    optionMap?: Record<string, string>;
}

export interface FieldHint {
    visible?: string | boolean;
    ui?: FieldHintUI;
    suggestion?: SuggestionConfig[];
}

export interface RdmWizard {
    pages: RdmWizardPage[];
    alias?: Record<string, string>;
    navigation?: RdmWizardNavigation;
    progress?: RdmWizardProgress;
    fieldHints?: Record<string, FieldHint>;
}

export interface WizardNavigation {
    isFirstPage: boolean;
    isLastPage: boolean;
    allowBack: boolean;
    canGoNext: boolean;
    progressSteps: ProgressStep[];
    goNext: () => void;
    goBack: () => void;
    submit: () => void;
}

const WIZARD_FIELD_ID = '_rdmWizard';

/**
 * Extract RdmWizard config from a _rdmWizard ExpressionFormField in the fields array.
 * Returns null if the field is not present.
 */
export function extractWizardConfig(fields?: Array<{ id: string; expression?: string }>): RdmWizard | null {
    if (!fields) {
        return null;
    }
    const field = fields.find(f => f.id === WIZARD_FIELD_ID);
    if (!field) {
        return null;
    }
    if (!field.expression) {
        throw new Error('_rdmWizard field found but expression is empty');
    }
    return JSON.parse(field.expression) as RdmWizard;
}
