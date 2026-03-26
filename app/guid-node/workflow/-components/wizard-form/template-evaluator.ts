/**
 * Jinja2-subset template evaluator for ExpressionFormField.
 *
 * Coexists with Flowable UEL (${...}): UEL is resolved first, then this
 * evaluator processes {{ }} / {% %} directives client-side.
 * Output is Markdown text fed into MarkdownToHtml.
 *
 * Supported syntax:
 *   {{ expr }}                  value interpolation
 *   {{ expr | filter(args) }}   filter pipe
 *   {% if expr %}...{% elif expr %}...{% else %}...{% endif %}
 *   {% for x in expr %}...{% endfor %}
 *   {%- / -%} / {{- / -}}      whitespace trimming
 *
 * Expression grammar (recursive descent):
 *   expression  = or_expr
 *   or_expr     = and_expr ( "or" and_expr )*
 *   and_expr    = not_expr ( "and" not_expr )*
 *   not_expr    = "not" not_expr | compare
 *   compare     = access ( ( "==" | "!=" ) access )?
 *   access      = primary ( "." ident | "[" expression "]" )*
 *   primary     = "(" expression ")" | "true" | "false" | string_literal | ident
 *   ident       = [a-zA-Z_\u3000-\u9FFF][a-zA-Z0-9_\u3000-\u9FFF-]*
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Segment {
    type: 'text' | 'expr' | 'tag';
    value: string;
    trimBefore: boolean;
    trimAfter: boolean;
}

type AstNode = TextNode | InterpolationNode | ForNode | IfNode;

interface TextNode {
    type: 'text';
    value: string;
}

interface InterpolationNode {
    type: 'interpolation';
    expr: Expr;
}

interface ForNode {
    type: 'for';
    itemName: string;
    iterable: Expr;
    body: AstNode[];
}

interface IfNode {
    type: 'if';
    branches: IfBranch[];
}

interface IfBranch {
    condition: Expr | null; // null = else
    body: AstNode[];
}


type Expr =
    | { type: 'ident'; name: string }
    | { type: 'string'; value: string }
    | { type: 'boolean'; value: boolean }
    | { type: 'dot'; object: Expr; property: string }
    | { type: 'bracket'; object: Expr; key: Expr }
    | { type: 'compare'; op: '==' | '!='; left: Expr; right: Expr }
    | { type: 'not'; operand: Expr }
    | { type: 'and'; left: Expr; right: Expr }
    | { type: 'or'; left: Expr; right: Expr }
    | { type: 'filter'; operand: Expr; name: string; args: Expr[] };

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

class TemplateParseError extends Error {
    constructor(message: string, public pos: number) {
        super(`Template parse error at ${pos}: ${message}`);
    }
}

// ---------------------------------------------------------------------------
// Tokenizer — split template into text / expr / tag segments
// ---------------------------------------------------------------------------

function tokenize(source: string): Segment[] {
    const segments: Segment[] = [];
    let pos = 0;

    while (pos < source.length) {
        const exprStart = source.indexOf('{{', pos);
        const tagStart = source.indexOf('{%', pos);

        let nearest = -1;
        let kind: 'expr' | 'tag' = 'expr';
        if (exprStart !== -1 && (tagStart === -1 || exprStart <= tagStart)) {
            nearest = exprStart;
            kind = 'expr';
        } else if (tagStart !== -1) {
            nearest = tagStart;
            kind = 'tag';
        }

        if (nearest === -1) {
            segments.push({ type: 'text', value: source.slice(pos), trimBefore: false, trimAfter: false });
            break;
        }

        if (nearest > pos) {
            segments.push({ type: 'text', value: source.slice(pos, nearest), trimBefore: false, trimAfter: false });
        }

        const trimBefore = source[nearest + 2] === '-';
        const contentStart = nearest + 2 + (trimBefore ? 1 : 0);

        const closeTag = kind === 'expr' ? '}}' : '%}';
        // Look for close with optional trim dash
        let closePos = -1;
        let trimAfter = false;
        let searchFrom = contentStart;
        while (searchFrom < source.length) {
            const ci = source.indexOf(closeTag, searchFrom);
            if (ci === -1) {
                throw new TemplateParseError(`unclosed ${kind === 'expr' ? '{{' : '{%'}`, nearest);
            }
            if (ci > contentStart && source[ci - 1] === '-') {
                closePos = ci;
                trimAfter = true;
                break;
            }
            closePos = ci;
            trimAfter = false;
            break;
        }

        const contentEnd = trimAfter ? closePos - 1 : closePos;
        const content = source.slice(contentStart, contentEnd).trim();
        segments.push({ type: kind, value: content, trimBefore, trimAfter });
        pos = closePos + 2;
    }

    // Apply whitespace trimming to adjacent text segments
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.type === 'text') {
            continue;
        }
        if (seg.trimBefore && i > 0 && segments[i - 1].type === 'text') {
            segments[i - 1].value = segments[i - 1].value.replace(/\s+$/, '');
        }
        if (seg.trimAfter && i + 1 < segments.length && segments[i + 1].type === 'text') {
            segments[i + 1].value = segments[i + 1].value.replace(/^\s+/, '');
        }
    }

    return segments;
}

// ---------------------------------------------------------------------------
// Expression parser
// ---------------------------------------------------------------------------

function isIdentStart(ch: string): boolean {
    return /[a-zA-Z_\u3000-\u9FFF]/.test(ch);
}

function isIdentChar(ch: string): boolean {
    return /[a-zA-Z0-9_\u3000-\u9FFF\-]/.test(ch);
}

class ExprParser {
    pos = 0;
    readonly source: string;
    constructor(source: string) { this.source = source; }

    skipWs(): void {
        while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) {
            this.pos++;
        }
    }

    peek(s: string): boolean {
        return this.source.substr(this.pos, s.length) === s;
    }

    private peekKeyword(kw: string): boolean {
        if (!this.peek(kw)) {
            return false;
        }
        const after = this.pos + kw.length;
        return after >= this.source.length || !isIdentChar(this.source[after]);
    }

    parseExpression(): Expr {
        this.skipWs();
        return this.orExpr();
    }

    private orExpr(): Expr {
        let left = this.andExpr();
        while (this.peekKeyword('or')) {
            this.pos += 2;
            this.skipWs();
            left = { type: 'or', left, right: this.andExpr() };
        }
        return left;
    }

    private andExpr(): Expr {
        let left = this.notExpr();
        while (this.peekKeyword('and')) {
            this.pos += 3;
            this.skipWs();
            left = { type: 'and', left, right: this.notExpr() };
        }
        return left;
    }

    private notExpr(): Expr {
        this.skipWs();
        if (this.peekKeyword('not')) {
            this.pos += 3;
            this.skipWs();
            return { type: 'not', operand: this.notExpr() };
        }
        return this.compare();
    }

    private compare(): Expr {
        const left = this.access();
        this.skipWs();
        if (this.peek('==')) {
            this.pos += 2;
            this.skipWs();
            return { type: 'compare', op: '==', left, right: this.access() };
        }
        if (this.peek('!=')) {
            this.pos += 2;
            this.skipWs();
            return { type: 'compare', op: '!=', left, right: this.access() };
        }
        return left;
    }

    private access(): Expr {
        let node = this.primary();
        while (this.pos < this.source.length) {
            this.skipWs();
            if (this.source[this.pos] === '.') {
                this.pos++;
                const prop = this.readIdent();
                node = { type: 'dot', object: node, property: prop };
            } else if (this.source[this.pos] === '[') {
                this.pos++;
                this.skipWs();
                const key = this.parseExpression();
                this.skipWs();
                if (this.source[this.pos] !== ']') {
                    throw new TemplateParseError("expected ']'", this.pos);
                }
                this.pos++;
                node = { type: 'bracket', object: node, key };
            } else if (this.source[this.pos] === '|') {
                this.pos++;
                this.skipWs();
                const name = this.readIdent();
                const args: Expr[] = [];
                this.skipWs();
                if (this.pos < this.source.length && this.source[this.pos] === '(') {
                    this.pos++;
                    this.skipWs();
                    if (this.source[this.pos] !== ')') {
                        args.push(this.parseExpression());
                        this.skipWs();
                        while (this.source[this.pos] === ',') {
                            this.pos++;
                            this.skipWs();
                            args.push(this.parseExpression());
                            this.skipWs();
                        }
                    }
                    if (this.source[this.pos] !== ')') {
                        throw new TemplateParseError("expected ')'", this.pos);
                    }
                    this.pos++;
                }
                node = { type: 'filter', operand: node, name, args };
            } else {
                break;
            }
        }
        return node;
    }

    private primary(): Expr {
        this.skipWs();
        if (this.pos >= this.source.length) {
            throw new TemplateParseError('unexpected end of expression', this.pos);
        }

        const ch = this.source[this.pos];

        if (ch === '(') {
            this.pos++;
            this.skipWs();
            const expr = this.parseExpression();
            this.skipWs();
            if (this.source[this.pos] !== ')') {
                throw new TemplateParseError("expected ')'", this.pos);
            }
            this.pos++;
            return expr;
        }

        if (ch === "'") {
            return { type: 'string', value: this.readString("'") };
        }
        if (ch === '"') {
            return { type: 'string', value: this.readString('"') };
        }

        if (this.peekKeyword('true')) {
            this.pos += 4;
            return { type: 'boolean', value: true };
        }
        if (this.peekKeyword('false')) {
            this.pos += 5;
            return { type: 'boolean', value: false };
        }

        if (isIdentStart(ch)) {
            return { type: 'ident', name: this.readIdent() };
        }

        throw new TemplateParseError(`unexpected character '${ch}'`, this.pos);
    }

    private readString(quote: string): string {
        this.pos++; // skip opening quote
        const start = this.pos;
        const end = this.source.indexOf(quote, start);
        if (end === -1) {
            throw new TemplateParseError('unterminated string literal', start);
        }
        this.pos = end + 1;
        return this.source.substring(start, end);
    }

    readIdent(): string {
        const start = this.pos;
        if (!isIdentStart(this.source[this.pos])) {
            throw new TemplateParseError('expected identifier', this.pos);
        }
        this.pos++;
        while (this.pos < this.source.length && isIdentChar(this.source[this.pos])) {
            this.pos++;
        }
        // Trim trailing hyphens (e.g. prevent matching the dash in "-%}")
        while (this.pos > start + 1 && this.source[this.pos - 1] === '-') {
            this.pos--;
        }
        return this.source.substring(start, this.pos);
    }

}

// ---------------------------------------------------------------------------
// Template parser — segments → AST
// ---------------------------------------------------------------------------

function parseTemplate(segments: Segment[]): AstNode[] {
    let pos = 0;

    function parseNodes(until?: string): AstNode[] {
        const nodes: AstNode[] = [];
        while (pos < segments.length) {
            const seg = segments[pos];

            if (seg.type === 'text') {
                if (seg.value) {
                    nodes.push({ type: 'text', value: seg.value });
                }
                pos++;
                continue;
            }

            if (seg.type === 'expr') {
                const ep = new ExprParser(seg.value);
                const expr = ep.parseExpression();
                assertFullyConsumed(ep, '{{ }}');
                nodes.push({ type: 'interpolation', expr });
                pos++;
                continue;
            }

            // seg.type === 'tag'
            const tagContent = seg.value;

            // Check for closing tags first
            if (until && tagContent === until) {
                return nodes;
            }
            if (tagContent === 'endfor' || tagContent === 'endif' || tagContent.startsWith('elif ') || tagContent === 'else') {
                // Reached a boundary tag — return to caller
                return nodes;
            }

            if (tagContent.startsWith('for ')) {
                nodes.push(parseFor(tagContent));
                continue;
            }

            if (tagContent.startsWith('if ')) {
                nodes.push(parseIf(tagContent));
                continue;
            }

            throw new TemplateParseError(`unknown tag: ${tagContent}`, 0);
        }
        return nodes;
    }

    function assertFullyConsumed(ep: ExprParser, context: string): void {
        ep.skipWs();
        if (ep.pos < ep.source.length) {
            throw new TemplateParseError(
                `unexpected '${ep.source.slice(ep.pos)}' in ${context}`,
                ep.pos,
            );
        }
    }

    function parseFor(tagContent: string): ForNode {
        // "for item in expr"
        const ep = new ExprParser(tagContent.slice(4));
        const itemName = ep.readIdent();
        ep.skipWs();
        if (!ep.peek('in') || isIdentChar(ep.source[ep.pos + 2] || '')) {
            throw new TemplateParseError("expected 'in' in for tag", ep.pos);
        }
        ep.pos += 2;
        const iterable = ep.parseExpression();
        assertFullyConsumed(ep, '{% for %}');
        pos++; // skip for tag segment
        const body = parseNodes('endfor');
        if (pos >= segments.length || segments[pos].value !== 'endfor') {
            throw new TemplateParseError('unclosed {% for %}', 0);
        }
        pos++; // skip endfor
        return { type: 'for', itemName, iterable, body };
    }

    function parseIf(tagContent: string): IfNode {
        const branches: IfBranch[] = [];

        // First branch: if
        const ep = new ExprParser(tagContent.slice(3));
        const condition = ep.parseExpression();
        assertFullyConsumed(ep, '{% if %}');
        branches.push({ condition, body: [] });
        pos++; // skip if tag segment
        branches[0].body = parseNodes();

        // elif / else branches
        while (pos < segments.length) {
            const seg = segments[pos];
            if (seg.type !== 'tag') {
                break;
            }
            if (seg.value.startsWith('elif ')) {
                const elifParser = new ExprParser(seg.value.slice(5));
                const elifCond = elifParser.parseExpression();
                assertFullyConsumed(elifParser, '{% elif %}');
                pos++;
                const body = parseNodes();
                branches.push({ condition: elifCond, body });
            } else if (seg.value === 'else') {
                pos++;
                const body = parseNodes();
                branches.push({ condition: null, body });
            } else if (seg.value === 'endif') {
                pos++; // skip endif
                return { type: 'if', branches };
            } else {
                break;
            }
        }
        throw new TemplateParseError('unclosed {% if %}', 0);
    }

    return parseNodes();
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

type FilterFn = (value: unknown, ...args: unknown[]) => unknown;

const BUILTIN_FILTERS: Record<string, FilterFn> = {
    default(value: unknown, fallback: unknown = '') {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }
        return value;
    },
    length(value: unknown) {
        if (Array.isArray(value)) {
            return value.length;
        }
        if (typeof value === 'string') {
            return value.length;
        }
        return 0;
    },
};

function isTruthy(value: unknown): boolean {
    if (value === false || value === null || value === undefined || value === '' || value === 0) {
        return false;
    }
    if (Array.isArray(value) && value.length === 0) {
        return false;
    }
    return true;
}

function evalExpr(expr: Expr, ctx: Record<string, unknown>): unknown {
    switch (expr.type) {
    case 'ident':
        return ctx[expr.name];
    case 'string':
        return expr.value;
    case 'boolean':
        return expr.value;
    case 'dot': {
        const obj = evalExpr(expr.object, ctx);
        if (obj == null) {
            return undefined;
        }
        return (obj as Record<string, unknown>)[expr.property];
    }
    case 'bracket': {
        const obj = evalExpr(expr.object, ctx);
        const key = evalExpr(expr.key, ctx);
        if (obj == null) {
            return undefined;
        }
        return (obj as Record<string, unknown>)[String(key)];
    }
    case 'compare': {
        const left = evalExpr(expr.left, ctx);
        const right = evalExpr(expr.right, ctx);
        return expr.op === '==' ? left === right : left !== right;
    }
    case 'not':
        return !isTruthy(evalExpr(expr.operand, ctx));
    case 'and':
        return isTruthy(evalExpr(expr.left, ctx)) ? evalExpr(expr.right, ctx) : evalExpr(expr.left, ctx);
    case 'or':
        return isTruthy(evalExpr(expr.left, ctx)) ? evalExpr(expr.left, ctx) : evalExpr(expr.right, ctx);
    case 'filter': {
        const value = evalExpr(expr.operand, ctx);
        const fn = BUILTIN_FILTERS[expr.name];
        if (!fn) {
            throw new Error(`unknown filter: ${expr.name}`);
        }
        const args = expr.args.map(a => evalExpr(a, ctx));
        return fn(value, ...args);
    }
    }
}

function stringify(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
}

function evaluate(nodes: AstNode[], ctx: Record<string, unknown>): string {
    let out = '';
    for (const node of nodes) {
        switch (node.type) {
        case 'text':
            out += node.value;
            break;
        case 'interpolation':
            out += stringify(evalExpr(node.expr, ctx));
            break;
        case 'for': {
            const iterable = evalExpr(node.iterable, ctx);
            if (Array.isArray(iterable)) {
                for (const item of iterable) {
                    const scope = Object.create(ctx) as Record<string, unknown>;
                    scope[node.itemName] = item;
                    out += evaluate(node.body, scope);
                }
            }
            break;
        }
        case 'if':
            for (const branch of node.branches) {
                if (branch.condition === null || isTruthy(evalExpr(branch.condition, ctx))) {
                    out += evaluate(branch.body, ctx);
                    break;
                }
            }
            break;
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function hasTemplateDirectives(text: string): boolean {
    return text.includes('{{') || text.includes('{%');
}

export function evaluateTemplate(template: string, context: Record<string, unknown>): string {
    const segments = tokenize(template);
    const ast = parseTemplate(segments);
    return evaluate(ast, context);
}
