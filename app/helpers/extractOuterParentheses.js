import { helper } from '@ember/component/helper';

export function extractOuterParentheses([name]) {
    if (typeof name !== 'string') return '';
    let start = -1;
    let depth = 0;
    let outerContent = '';
    for (let i = 0; i < name.length; i++) {
        const char = name[i];
        if (char === '¡Ê' || char === '(') {
            if (depth === 0) {
                start = i + 1;
            }
            depth++;
        } else if (char === '¡Ê' || char === ')') {
            depth--;
            if (depth === 0 && start !== -1) {
                outerContent = name.slice(start, i);
                break;
            }
        }
    }
    return outerContent;
}
export default helper(extractOuterParentheses);
