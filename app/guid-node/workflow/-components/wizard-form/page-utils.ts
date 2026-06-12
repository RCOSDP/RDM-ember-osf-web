import { ProgressStep, StepStatus } from '../progress-sidebar/utils';
import { evaluateExpression } from './expression-evaluator';
import { RdmWizardPage } from './types';

export interface FlatPage {
    id: string;
    title: string;
    fieldIds: string[];
}

function isPageVisible(page: RdmWizardPage, context: Record<string, unknown>): boolean {
    if (page.visible === undefined || page.visible === true) {
        return true;
    }
    if (page.visible === false) {
        return false;
    }
    return evaluateExpression(page.visible, context);
}

export function flattenPages(pages: RdmWizardPage[]): FlatPage[] {
    const result: FlatPage[] = [];
    for (const page of pages) {
        if (page.type === 'group') {
            if (page.pages) {
                result.push(...flattenPages(page.pages));
            }
        } else {
            result.push({
                id: page.id,
                title: page.title,
                fieldIds: page.fields || [],
            });
        }
    }
    return result;
}

export function getVisiblePages(
    pages: RdmWizardPage[],
    context: Record<string, unknown>,
    parentVisible = true,
): FlatPage[] {
    const result: FlatPage[] = [];
    for (const page of pages) {
        const visible = parentVisible && isPageVisible(page, context);
        if (!visible) {
            continue;
        }
        if (page.type === 'group') {
            if (page.pages) {
                result.push(...getVisiblePages(page.pages, context, visible));
            }
        } else {
            result.push({
                id: page.id,
                title: page.title,
                fieldIds: page.fields || [],
            });
        }
    }
    return result;
}

function resolveStatus(
    pageId: string,
    currentPageId: string,
    visitedPageIds: Set<string>,
): StepStatus {
    if (pageId === currentPageId) {
        return 'current';
    }
    if (visitedPageIds.has(pageId)) {
        return 'completed';
    }
    return 'pending';
}

function hasCurrentInTree(steps: ProgressStep[]): boolean {
    for (const step of steps) {
        if (step.status === 'current' || hasCurrentInTree(step.children)) {
            return true;
        }
    }
    return false;
}

export function buildProgressTree(
    pages: RdmWizardPage[],
    currentPageId: string,
    visitedPageIds: Set<string>,
    context: Record<string, unknown>,
    level = 0,
    parentVisible = true,
): ProgressStep[] {
    const result: ProgressStep[] = [];
    for (const page of pages) {
        const visible = parentVisible && isPageVisible(page, context);
        if (!visible) {
            continue;
        }
        if (page.type === 'group') {
            const children = page.pages
                ? buildProgressTree(page.pages, currentPageId, visitedPageIds, context, level + 1, visible)
                : [];
            const isActive = hasCurrentInTree(children);
            // Determine group status from children
            let status: StepStatus = 'pending';
            if (isActive) {
                status = 'current';
            } else if (children.length > 0 && children.every(c => c.status === 'completed')) {
                status = 'completed';
            }
            result.push({
                name: page.title,
                status,
                level,
                children,
                isActive,
            });
        } else {
            const status = resolveStatus(page.id, currentPageId, visitedPageIds);
            result.push({
                name: page.title,
                status,
                level,
                children: [],
                isActive: status === 'current',
            });
        }
    }
    return result;
}
