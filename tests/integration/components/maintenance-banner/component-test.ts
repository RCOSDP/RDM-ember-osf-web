import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import setupMirage from 'ember-cli-mirage/test-support/setup-mirage';
import config from 'ember-get-config';
import { setupRenderingTest } from 'ember-qunit';
import test from 'ember-sinon-qunit/test-support/test';
import { module } from 'qunit';

const {
    OSF: { apiUrl },
} = config;

module('Integration | Component | maintenance-banner', hooks => {
    setupRenderingTest(hooks);
    setupMirage(hooks);

    test('it renders no maintenance', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: null,
        }));

        await render(hbs`{{maintenance-banner}}`);
        assert.dom('.alert').doesNotExist();
    });

    test('it renders maintenance message', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';

        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'longstringy',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);
        assert.dom('.alert').includesText('longstringy');
    });

    test('it renders line breaks as <br>', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'line1\nline2',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert br').exists({ count: 1 });
    });

    test('it escapes HTML to prevent XSS', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: '<script>alert(1)</script>',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert script').doesNotExist();
        assert.dom('.alert').includesText('<script>alert(1)</script>');
    });

    test('it converts email to mailto link', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'test@example.com',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert a')
            .hasAttribute('href', 'mailto:test@example.com')
            .hasText('test@example.com');
    });

    test('it converts valid URL to link', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'https://google.com',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert a')
            .hasAttribute('href', 'https://google.com')
            .hasText('https://google.com');
    });

    test('it supports loose scheme (htp:// still becomes link)', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'htp://google.com',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert a')
            .hasAttribute('href', 'htp://google.com')
            .hasText('htp://google.com');
    });

    test('it does NOT link invalid domain', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'http://-google...com',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert a').doesNotExist();
        assert.dom('.alert').includesText('http://-google...com');
    });

    test('it converts domain without scheme', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'abc.com',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert a')
            .hasAttribute('href', 'http://abc.com')
            .hasText('abc.com');
    });

    test('it handles partial broken URL (g<>gle.com)', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'http://g<>gle.com',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert a').exists({ count: 2 });
    });

    test('it handles mixed content (text + url + newline)', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'line1\nhttps://abc.com\nline3',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert br').exists({ count: 2 });
        assert.dom('.alert a').exists({ count: 1 });
    });

    test('it handles URL surrounded by parentheses', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            meta: { version: '2.8' },
            maintenance: {
                message: 'Please visit (https://google.com) for more info.',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert a')
            .hasAttribute('href', 'https://google.com')
            .hasText('https://google.com');
        assert.dom('.alert').includesText('Please visit (https://google.com) for more info.');
    });
});
