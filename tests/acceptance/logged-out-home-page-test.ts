import { click, currentURL, visit } from '@ember/test-helpers';
import setupMirage from 'ember-cli-mirage/test-support/setup-mirage';
import { setupApplicationTest } from 'ember-qunit';
import { module, test } from 'qunit';

import config from 'ember-get-config';

const {
    OSF: {
        simplePage,
    },
} = config;

module('Acceptance | logged-out home page', hooks => {
    setupApplicationTest(hooks);
    setupMirage(hooks);

    test('visiting /', async assert => {
        server.create('root', { currentUser: null });
        await visit('/');

        assert.equal(currentURL(), '/', "Still at '/'.");

        // Check navbar.
        assert.dom('nav.navbar').exists();
        assert.dom('nav.navbar .service-name').hasText('OSF HOME');
        assert.dom('nav.navbar .sign-in').exists();

        // Check page.
        assert.dom('h1[class*="hero-brand"]').hasText('Open Science Framework');

        // Check footer.
        assert.dom('footer').exists();

        if (simplePage) {
            return;
        }

        // Check sign-up form.
        assert.dom('[data-test-sign-up-form] .has-error').doesNotExist('Sign up form: no premature validation');
        assert.dom('[data-test-sign-up-form] .help-block').doesNotExist('Sign up form: no validation messages shown');
        await click('[data-test-sign-up-form] [data-test-sign-up-button]');
        assert.dom('[data-test-sign-up-form] .has-error').exists('Sign up form: validation errors present');
        assert.dom('[data-test-sign-up-form] .help-block').exists('Sign up form: validation messages shown');

        // Alt text for integration logos
        assert.dom('[class*="_integrations"] img[alt*="Dropbox logo"]').exists();
        assert.dom('img[alt*="Missing translation"]').doesNotExist();
    });
});
