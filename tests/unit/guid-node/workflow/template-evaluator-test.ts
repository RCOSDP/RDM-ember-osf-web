import {
    evaluateTemplate,
    hasTemplateDirectives,
} from 'ember-osf-web/guid-node/workflow/-components/wizard-form/template-evaluator';
import { module, test } from 'qunit';

module('Unit | Workflow | template-evaluator', () => {
    // -- hasTemplateDirectives ------------------------------------------------

    test('detects {{ }}', assert => {
        assert.ok(hasTemplateDirectives('Hello {{ name }}'));
    });

    test('detects {% %}', assert => {
        assert.ok(hasTemplateDirectives('{% if x %}yes{% endif %}'));
    });

    test('plain text has no directives', assert => {
        assert.notOk(hasTemplateDirectives('no directives here'));
    });

    // -- variable interpolation -----------------------------------------------

    test('interpolates variable', assert => {
        assert.equal(evaluateTemplate('Hello {{ name }}!', { name: 'Alice' }), 'Hello Alice!');
    });

    test('missing variable renders empty', assert => {
        assert.equal(evaluateTemplate('Hello {{ name }}!', {}), 'Hello !');
    });

    test('multiple variables', assert => {
        assert.equal(
            evaluateTemplate('{{ first }} {{ last }}', { first: 'A', last: 'B' }),
            'A B',
        );
    });

    // -- if/else/endif --------------------------------------------------------

    test('if truthy renders body', assert => {
        assert.equal(
            evaluateTemplate('{% if show %}visible{% endif %}', { show: 'yes' }),
            'visible',
        );
    });

    test('if falsy skips body', assert => {
        assert.equal(
            evaluateTemplate('{% if show %}visible{% endif %}', { show: '' }),
            '',
        );
    });

    test('if/else renders else branch when falsy', assert => {
        assert.equal(
            evaluateTemplate('{% if show %}yes{% else %}no{% endif %}', { show: '' }),
            'no',
        );
    });

    test('if/elif/else chain', assert => {
        assert.equal(
            evaluateTemplate(
                '{% if a %}A{% elif b %}B{% else %}C{% endif %}',
                { a: '', b: 'x' },
            ),
            'B',
        );
    });

    test('nested if', assert => {
        assert.equal(
            evaluateTemplate(
                '{% if a %}{% if b %}AB{% endif %}{% endif %}',
                { a: 'x', b: 'y' },
            ),
            'AB',
        );
    });

    test('nested if with outer false', assert => {
        assert.equal(
            evaluateTemplate(
                '{% if a %}{% if b %}AB{% endif %}{% endif %}',
                { a: '', b: 'y' },
            ),
            '',
        );
    });

    // -- expressions in if ----------------------------------------------------

    test('if with or expression', assert => {
        assert.equal(
            evaluateTemplate('{% if a or b %}yes{% endif %}', { a: '', b: 'x' }),
            'yes',
        );
    });

    test('if with and expression', assert => {
        assert.equal(
            evaluateTemplate('{% if a and b %}yes{% endif %}', { a: 'x', b: '' }),
            '',
        );
    });

    test('if with not expression', assert => {
        assert.equal(
            evaluateTemplate('{% if not a %}empty{% endif %}', { a: '' }),
            'empty',
        );
    });

    test('if with comparison', assert => {
        assert.equal(
            evaluateTemplate("{% if status == 'done' %}ok{% endif %}", { status: 'done' }),
            'ok',
        );
    });

    // -- for loop -------------------------------------------------------------

    test('for loop iterates', assert => {
        assert.equal(
            evaluateTemplate('{% for x in items %}[{{ x }}]{% endfor %}', { items: ['a', 'b'] }),
            '[a][b]',
        );
    });

    test('for loop with empty array', assert => {
        assert.equal(
            evaluateTemplate('{% for x in items %}[{{ x }}]{% endfor %}', { items: [] }),
            '',
        );
    });

    test('for loop with object access', assert => {
        assert.equal(
            evaluateTemplate(
                '{% for p in people %}{{ p.name }} {% endfor %}',
                { people: [{ name: 'A' }, { name: 'B' }] },
            ),
            'A B ',
        );
    });

    // -- filters --------------------------------------------------------------

    test('default filter on missing value', assert => {
        assert.equal(
            evaluateTemplate("{{ name | default('N/A') }}", {}),
            'N/A',
        );
    });

    test('default filter on present value', assert => {
        assert.equal(
            evaluateTemplate("{{ name | default('N/A') }}", { name: 'Alice' }),
            'Alice',
        );
    });

    test('length filter', assert => {
        assert.equal(
            evaluateTemplate('{{ items | length }}', { items: [1, 2, 3] }),
            '3',
        );
    });

    // -- whitespace trimming --------------------------------------------------

    test('trim before with {%-', assert => {
        assert.equal(
            evaluateTemplate('hello  {%- if true %} world{% endif %}', {}),
            'hello world',
        );
    });

    test('trim after with -%}', assert => {
        assert.equal(
            evaluateTemplate('{% if true -%}  hello{% endif %}', {}),
            'hello',
        );
    });

    // -- dot access and bracket access ----------------------------------------

    test('dot access', assert => {
        assert.equal(
            evaluateTemplate('{{ user.name }}', { user: { name: 'Bob' } }),
            'Bob',
        );
    });

    test('bracket access', assert => {
        assert.equal(
            evaluateTemplate("{{ data['key'] }}", { data: { key: 'val' } }),
            'val',
        );
    });

    // -- display_template real-world pattern -----------------------------------

    test('display_template name pattern with all fields', assert => {
        const tpl = '{% if last or first %}{% if last %}{{ last }}, {% endif %}{{ first }} {{ middle }}{% endif %}';
        assert.equal(
            evaluateTemplate(tpl, { last: 'Smith', first: 'John', middle: 'A' }),
            'Smith, John A',
        );
    });

    test('display_template name pattern with only first', assert => {
        const tpl = '{% if last or first %}{% if last %}{{ last }}, {% endif %}{{ first }} {{ middle }}{% endif %}';
        assert.equal(
            evaluateTemplate(tpl, { last: '', first: 'Taro', middle: '' }),
            'Taro ',
        );
    });

    test('display_template name pattern with all empty', assert => {
        const tpl = '{% if last or first %}{% if last %}{{ last }}, {% endif %}{{ first }} {{ middle }}{% endif %}';
        assert.equal(
            evaluateTemplate(tpl, { last: '', first: '', middle: '' }),
            '',
        );
    });

    // -- error handling -------------------------------------------------------

    test('throws on unclosed if', assert => {
        assert.throws(
            () => evaluateTemplate('{% if x %}hello', { x: 'y' }),
            /unclosed/i,
        );
    });

    test('throws on unclosed {{', assert => {
        assert.throws(
            () => evaluateTemplate('{{ name', {}),
            /unclosed/i,
        );
    });

    test('throws on unknown tag', assert => {
        assert.throws(
            () => evaluateTemplate('{% while true %}{% endwhile %}', {}),
            /unknown tag/i,
        );
    });

    test('throws on unknown filter', assert => {
        assert.throws(
            () => evaluateTemplate('{{ x | bogus }}', { x: 'v' }),
            /unknown filter/i,
        );
    });
});
