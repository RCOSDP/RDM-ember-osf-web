export default class TemplateParseError extends Error {
    constructor(message: string, public pos: number) {
        super(`Template parse error at ${pos}: ${message}`);
    }
}
