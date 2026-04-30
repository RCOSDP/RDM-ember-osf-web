import {
    escapeHTML,
    isEmail,
    isValidDomain,
    trimEdges,
} from 'ember-osf-web/utils/string-utils';

import { module, test } from 'qunit';

module('Unit | Utility | string-utils', () => {
    test('escapeHTML escapes dangerous characters', assert => {
        const cases: Array<[string, string]> = [
            ['', ''],
            ['abc', 'abc'],
            ['<script>', '&lt;script&gt;'],
            ['Tom & Jerry', 'Tom &amp; Jerry'],
            ['"quote"', '&quot;quote&quot;'],
            ["'single'", '&#39;single&#39;'],
            ['<>&"\'', '&lt;&gt;&amp;&quot;&#39;'],
        ];

        for (const [input, expected] of cases) {
            assert.strictEqual(escapeHTML(input), expected);
        }
    });

    test('isEmail validates email correctly', assert => {
        const cases: Array<[string, boolean]> = [
            ['test@example.com', true],
            ['user.name+tag@gmail.com', true],
            ['invalid-email', false],
            ['abc@', false],
            ['@domain.com', false],
            ['abc@domain', false],
        ];

        for (const [input, expected] of cases) {
            assert.strictEqual(isEmail(input), expected);
        }
    });

    test('isValidDomain validates domain correctly', assert => {
        const cases: Array<[string, boolean]> = [
            ['google.com', true],
            ['sub.domain.com', true],
            ['abc.co', true],
            ['-google.com', false],
            ['google-.com', false],
            ['google..com', false],
            ['google', false],
            ['g<>gle.com', false],
            ['??', false],
        ];

        for (const [input, expected] of cases) {
            assert.strictEqual(isValidDomain(input), expected);
        }
    });

    test('trimEdges splits leading and trailing punctuation', assert => {
        const cases: Array<[string, { leading: string; core: string; trailing: string }]> = [
            ['', { leading: '', core: '', trailing: '' }],
            ['abc', { leading: '', core: 'abc', trailing: '' }],
            ['(abc)', { leading: '(', core: 'abc', trailing: ')' }],
            ['[(abc)]', { leading: '[(', core: 'abc', trailing: ')]' }],
            ['(https://google.com)', { leading: '(', core: 'https://google.com', trailing: ')' }],
        ];

        for (const [input, expected] of cases) {
            const result = trimEdges(input);
            assert.strictEqual(result.leading, expected.leading);
            assert.strictEqual(result.core, expected.core);
            assert.strictEqual(result.trailing, expected.trailing);
        }
    });
});
