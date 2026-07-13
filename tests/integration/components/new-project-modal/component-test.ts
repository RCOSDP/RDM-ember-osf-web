import { A } from '@ember/array';
import EmberObject, { action } from '@ember/object';
import Service from '@ember/service';
import { fillIn, render, triggerEvent, triggerKeyEvent } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { setupRenderingTest } from 'ember-qunit';
import { TestContext } from 'ember-test-helpers';
import { module, test } from 'qunit';
import Promise from 'rsvp';
import sinon from 'sinon';

import NewProjectModal from 'osf-components/components/new-project-modal/component';

interface LocalTestContext extends TestContext {
    createActionSpy: sinon.SinonSpy;
}

let createSpyPlaceholder: sinon.SinonSpy | undefined;

class MockNewProjectModal extends NewProjectModal {
    @action
    create(this: any, ...args: any[]) {
        if (createSpyPlaceholder) {
            createSpyPlaceholder(...args);
        }
    }
}

module('Integration | Component | new-project-modal', hooks => {
    setupRenderingTest(hooks);

    hooks.beforeEach(function(this: LocalTestContext) {
        this.createActionSpy = sinon.spy();
        createSpyPlaceholder = this.createActionSpy;

        this.owner.register('component:new-project-modal', MockNewProjectModal);

        const mockUser = EmberObject.create({
            institutions: A([EmberObject.create({ id: 'mock' })]),
            defaultRegion: EmberObject.create({ id: 'us' }),
        });

        this.owner.register('service:current-user', Service.extend({ user: mockUser }));
        this.owner.register('service:features', Service.extend({ isEnabled: () => false }));
        this.owner.register('service:intl', Service.extend({ t: (key: string) => key }));
        this.owner.register('service:toast', Service.extend({ error: sinon.spy(), success: sinon.spy() }));
        this.owner.register('service:analytics', Service.extend({ click: sinon.spy() }));
        this.owner.register('service:store', Service.extend({
            findAll() { return Promise.resolve(A([])); },
        }));
    });

    hooks.afterEach(() => {
        createSpyPlaceholder = undefined;
    });

    test('it renders', async assert => {
        await render(hbs`
            <NewProjectModal @afterProjectCreated={{this.afterProjectCreatedSpy}} />
        `);
        assert.dom('.modal').exists();
        assert.dom('.modal-title').hasText('Create new project');
    });

    test('create button is disabled initially', async assert => {
        await render(hbs`
            <NewProjectModal @afterProjectCreated={{this.afterProjectCreatedSpy}} />
        `);
        assert.dom('[data-test-create-project-submit]').isDisabled();
    });

    test('it renders and initializes correctly', async assert => {
        await render(hbs`
            <NewProjectModal @afterProjectCreated={{this.afterProjectCreatedSpy}} />
        `);

        assert.dom('[data-test-new-project-title]').exists('Input fields for project title exists');
    });

    test(
        'Enter key triggers create action through DOM binding when not composing',
        async function(this: LocalTestContext, assert) {
            await render(hbs`
                <NewProjectModal />
            `);

            const inputSelector = '[data-test-new-project-title]';
            assert.dom(inputSelector).exists('Input field must exist');

            await fillIn(inputSelector, 'My Awesome New Project');

            await triggerKeyEvent(inputSelector, 'keydown', 'Enter');

            assert.ok(
                this.createActionSpy.calledOnce,
                'The create() action on the component should be triggered.',
            );
        },
    );

    test(
        'Enter key does NOT trigger create action when Japanese IME is composing',
        async function(this: LocalTestContext, assert) {
            await render(hbs`
                <NewProjectModal />
            `);

            const inputSelector = '[data-test-new-project-title]';
            assert.dom(inputSelector).exists();

            await fillIn(inputSelector, 'プロジェクト');

            await triggerEvent(inputSelector, 'keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 229,
                which: 229,
                isComposing: true,
                bubbles: true,
                cancelable: true,
            } as any);

            assert.notOk(
                this.createActionSpy.called,
                'The create() action must NOT be triggered during IME composition.',
            );
        },
    );
});
