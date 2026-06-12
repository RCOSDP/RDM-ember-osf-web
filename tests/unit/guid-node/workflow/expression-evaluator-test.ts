import { evaluateExpression } from 'ember-osf-web/guid-node/workflow/-components/wizard-form/expression-evaluator';
import { module, test } from 'qunit';

module('Unit | Workflow | expression-evaluator', () => {
    test('truthy field returns true', assert => {
        assert.ok(evaluateExpression('name', { name: 'Alice' }));
    });

    test('missing field returns false', assert => {
        assert.notOk(evaluateExpression('name', {}));
    });

    test('null field returns false', assert => {
        assert.notOk(evaluateExpression('name', { name: null }));
    });

    test('empty string field returns false', assert => {
        assert.notOk(evaluateExpression('name', { name: '' }));
    });

    test('true literal', assert => {
        assert.ok(evaluateExpression('true', {}));
    });

    test('false literal', assert => {
        assert.notOk(evaluateExpression('false', {}));
    });

    test('field prefixed with true is not confused', assert => {
        assert.ok(evaluateExpression('trueness', { trueness: 'yes' }));
    });

    test('string equality', assert => {
        assert.ok(evaluateExpression("status == 'active'", { status: 'active' }));
    });

    test('string inequality', assert => {
        assert.ok(evaluateExpression("status != 'active'", { status: 'inactive' }));
    });

    test('OR left true', assert => {
        assert.ok(evaluateExpression('a || b', { a: 'x', b: '' }));
    });

    test('OR right true', assert => {
        assert.ok(evaluateExpression('a || b', { a: '', b: 'x' }));
    });

    test('OR both false', assert => {
        assert.notOk(evaluateExpression('a || b', { a: '', b: '' }));
    });

    test('AND both true', assert => {
        assert.ok(evaluateExpression('a && b', { a: 'x', b: 'y' }));
    });

    test('AND left false', assert => {
        assert.notOk(evaluateExpression('a && b', { a: '', b: 'y' }));
    });

    test('NOT truthy', assert => {
        assert.notOk(evaluateExpression('!a', { a: 'x' }));
    });

    test('NOT falsy', assert => {
        assert.ok(evaluateExpression('!a', { a: '' }));
    });

    test('double NOT', assert => {
        assert.ok(evaluateExpression('!!a', { a: 'x' }));
    });

    test('AND binds tighter than OR', assert => {
        // false || (true && true) => true
        assert.ok(evaluateExpression('a || b && c', { a: '', b: 'x', c: 'y' }));
    });

    test('NOT binds tighter than AND', assert => {
        // (!false) && true => true
        assert.ok(evaluateExpression('!a && b', { a: '', b: 'x' }));
    });

    test('parentheses override precedence', assert => {
        // !(false && true) => true
        assert.ok(evaluateExpression('!(a && b)', { a: '', b: 'x' }));
    });

    test('chained OR parses all operands', assert => {
        assert.ok(evaluateExpression('a || b || c', { a: '', b: '', c: 'x' }));
    });

    test('chained OR all empty', assert => {
        assert.notOk(evaluateExpression('a || b || c', { a: '', b: '', c: '' }));
    });

    test('display_template style: last || first || middle', assert => {
        assert.ok(evaluateExpression(
            'last || first || middle',
            { last: '', first: 'Taro', middle: '' },
        ));
    });

    test('throws on empty expression', assert => {
        assert.throws(() => evaluateExpression('', {}), /empty expression/);
    });

    test('throws on trailing garbage', assert => {
        assert.throws(() => evaluateExpression('a b', { a: 'x' }), /unexpected/);
    });

    test('throws on unterminated string', assert => {
        assert.throws(() => evaluateExpression("a == 'open", {}), /unterminated/);
    });
});
