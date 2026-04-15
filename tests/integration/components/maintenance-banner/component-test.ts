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
        server.get('/v2/status', () => ({
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
            maintenance: {
                message: 'line1\nline2',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert').hasTextContaining('line1');
        assert.dom('.alert').hasTextContaining('line2');
        assert.dom('.alert br').exists({ count: 1 });
    });

    test('it converts URLs to clickable links', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            maintenance: {
                message: 'Visit https://abc-test.com',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert a')
            .hasAttribute('href', 'https://abc-test.com')
            .hasText('https://abc-test.com');
    });

    test('it escapes HTML to prevent XSS', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            maintenance: {
                message: '<script>alert("xss")</script>',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert script').doesNotExist();
        assert.dom('.alert').includesText('<script>alert("xss")</script>');
    });

    test('it handles mixed content (text + url + newline)', async assert => {
        server.urlPrefix = apiUrl;
        server.namespace = '/v2';
        server.get('/status', () => ({
            maintenance: {
                message: 'line1\nhttps://abc-test.com\nline3',
                level: 1,
            },
        }));

        await render(hbs`{{maintenance-banner}}`);

        assert.dom('.alert br').exists({ count: 2 });
        assert.dom('.alert a').exists({ count: 1 });
        assert.dom('.alert a').hasAttribute('href', 'https://abc-test.com');
    });
});
