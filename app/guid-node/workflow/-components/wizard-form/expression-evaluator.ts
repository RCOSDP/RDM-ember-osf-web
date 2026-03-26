/**
 * RDM Wizard visibility expression evaluator.
 *
 * Grammar (recursive descent):
 *   expression  = or_expr
 *   or_expr     = and_expr ( "||" and_expr )*
 *   and_expr    = not_expr ( "&&" not_expr )*
 *   not_expr    = "!" not_expr | compare
 *   compare     = primary ( ( "==" | "!=" ) primary )?
 *   primary     = "(" expression ")" | "true" | "false" | string_literal | field_ref
 *   string_literal = "'" [^']* "'"
 *   field_ref      = [^&|!=()' \t]+
 */

const STOP_CHARS = new Set(['&', '|', '!', '=', '(', ')', "'", ' ', '\t']);

class Parser {
    private pos = 0;
    constructor(private source: string) {}

    parse(context: Record<string, unknown>): boolean {
        this.skipWs();
        if (this.pos >= this.source.length) {
            throw new Error('empty expression');
        }
        const result = this.orExpr(context);
        this.skipWs();
        if (this.pos < this.source.length) {
            throw new Error(`unexpected character '${this.source[this.pos]}' at position ${this.pos}`);
        }
        return result;
    }

    private skipWs(): void {
        while (this.pos < this.source.length && (this.source[this.pos] === ' ' || this.source[this.pos] === '\t')) {
            this.pos++;
        }
    }

    private peek(s: string): boolean {
        return this.source.substr(this.pos, s.length) === s;
    }

    private consume(s: string): void {
        if (!this.peek(s)) {
            throw new Error(`expected '${s}' at position ${this.pos}`);
        }
        this.pos += s.length;
    }

    private orExpr(ctx: Record<string, unknown>): boolean {
        let result = this.andExpr(ctx);
        while (this.pos < this.source.length) {
            this.skipWs();
            if (this.peek('||')) {
                this.consume('||');
                this.skipWs();
                const right = this.andExpr(ctx);
                result = result || right;
            } else {
                break;
            }
        }
        return result;
    }

    private andExpr(ctx: Record<string, unknown>): boolean {
        let result = this.notExpr(ctx);
        while (this.pos < this.source.length) {
            this.skipWs();
            if (this.peek('&&')) {
                this.consume('&&');
                this.skipWs();
                const right = this.notExpr(ctx);
                result = result && right;
            } else {
                break;
            }
        }
        return result;
    }

    private notExpr(ctx: Record<string, unknown>): boolean {
        this.skipWs();
        if (this.pos < this.source.length && this.source[this.pos] === '!' && !this.peek('!=')) {
            this.pos++;
            this.skipWs();
            return !this.notExpr(ctx);
        }
        return this.compare(ctx);
    }

    private compare(ctx: Record<string, unknown>): boolean {
        const left = this.primary(ctx);
        this.skipWs();
        if (this.pos < this.source.length) {
            if (this.peek('==')) {
                this.consume('==');
                this.skipWs();
                const right = this.primary(ctx);
                return left === right;
            }
            if (this.peek('!=')) {
                this.consume('!=');
                this.skipWs();
                const right = this.primary(ctx);
                return left !== right;
            }
        }
        return toBool(left);
    }

    private primary(ctx: Record<string, unknown>): unknown {
        this.skipWs();
        if (this.pos >= this.source.length) {
            throw new Error('unexpected end of expression');
        }

        const ch = this.source[this.pos];

        if (ch === '(') {
            this.pos++;
            this.skipWs();
            const result = this.orExpr(ctx);
            this.skipWs();
            this.consume(')');
            return result;
        }

        if (ch === "'") {
            return this.stringLiteral();
        }

        if (this.peek('true') && (this.pos + 4 >= this.source.length || STOP_CHARS.has(this.source[this.pos + 4]))) {
            this.pos += 4;
            return true;
        }

        if (this.peek('false') && (this.pos + 5 >= this.source.length || STOP_CHARS.has(this.source[this.pos + 5]))) {
            this.pos += 5;
            return false;
        }

        return this.fieldRef(ctx);
    }

    private stringLiteral(): string {
        this.consume("'");
        const start = this.pos;
        const end = this.source.indexOf("'", start);
        if (end === -1) {
            throw new Error('unterminated string literal');
        }
        this.pos = end + 1;
        return this.source.substring(start, end);
    }

    private fieldRef(ctx: Record<string, unknown>): unknown {
        const start = this.pos;
        while (this.pos < this.source.length && !STOP_CHARS.has(this.source[this.pos])) {
            this.pos++;
        }
        const ref = this.source.substring(start, this.pos);
        if (!ref) {
            throw new Error(`expected field reference at position ${start}`);
        }
        const val = ctx[ref];
        if (val === undefined || val === null) {
            return false;
        }
        return val;
    }
}

function toBool(value: unknown): boolean {
    if (value === false || value === null || value === undefined || value === '') {
        return false;
    }
    return true;
}

export function evaluateExpression(expr: string, context: Record<string, unknown>): boolean {
    const result = new Parser(expr).parse(context);
    return toBool(result);
}
