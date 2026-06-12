import Component from '@ember/component';
import { action, computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { htmlSafe } from '@ember/string';
import { task } from 'ember-concurrency-decorators';
import Cookies from 'ember-cookies/services/cookies';
import { localClassNames } from 'ember-css-modules';
import config from 'ember-get-config';
import moment from 'moment';

import { layout } from 'ember-osf-web/decorators/component';
import Analytics from 'ember-osf-web/services/analytics';
import CurrentUser from 'ember-osf-web/services/current-user';

import {
    escapeHTML,
    isValidDomain,
    trimEdges,
} from 'ember-osf-web/utils/string-utils';
import styles from './styles';
import template from './template';

interface MaintenanceData {
    level?: number;
    message?: string;
    start?: string;
    end?: string;
}

const {
    OSF: {
        cookieDomain,
        cookies: {
            maintenance: maintenanceCookie,
        },
    },
} = config;

@layout(template, styles)
@localClassNames('MaintenanceBanner')
export default class MaintenanceBanner extends Component {
    @service analytics!: Analytics;
    @service cookies!: Cookies;
    @service currentUser!: CurrentUser;

    maintenance?: MaintenanceData | null;

    @task({ restartable: true })
    getMaintenanceStatus = task(function *(this: MaintenanceBanner): IterableIterator<any> {
        const url: string = `${config.OSF.apiUrl}/v2/status/`;
        const data = yield this.currentUser.authenticatedAJAX({ url });
        this.set('maintenance', data.maintenance);
    });

    @computed('maintenance.start')
    get start(): string | undefined {
        return this.maintenance && this.maintenance.start ? moment(this.maintenance.start).format('lll') : undefined;
    }

    @computed('maintenance.end')
    get end(): string | undefined {
        return this.maintenance && this.maintenance.end ? moment(this.maintenance.end).format('lll') : undefined;
    }

    @computed('maintenance.start')
    get utc(): string | undefined {
        return this.maintenance && this.maintenance.start ? moment(this.maintenance.start).format('ZZ') : undefined;
    }

    @computed('maintenance.level')
    get alertType(): string | undefined {
        const levelMap = ['info', 'warning', 'danger'];
        return this.maintenance && this.maintenance.level ? levelMap[this.maintenance.level - 1] : undefined;
    }

    @computed('maintenance.message')
    get renderedMessage() {
        const text = this.maintenance && this.maintenance.message ? this.maintenance.message : '';
        if (!text) {
            return htmlSafe('');
        }

        const parts: string[] = text.split(/(\s+)/);

        const result = parts.map((part: string) => {
            if (!part) {
                return '';
            }

            // preserve whitespace
            if (/^\s+$/.test(part)) {
                return part;
            }

            // split by dangerous characters to support partial parsing
            const chunks = part.split(/([<>"])/);

            return chunks.map((chunk: string) => {
                if (!chunk) {
                    return '';
                }

                // escape dangerous characters
                if (/[<>"]/.test(chunk)) {
                    return escapeHTML(chunk);
                }

                // extract surrounding punctuation
                const { leading, core, trailing } = trimEdges(chunk);

                // https:// or http:// URLs only
                const schemeIdx = core.search(/https?:\/\//);
                if (schemeIdx >= 0) {
                    const textBefore = core.slice(0, schemeIdx);
                    const rest = core.slice(schemeIdx);

                    // Extract URL portion: stop at whitespace, HTML chars, and Japanese brackets
                    const urlMatch = /^(https?:\/\/[^\s<>"'【（「『〔】）」』〕、。]*)/.exec(rest);
                    if (!urlMatch) {
                        return escapeHTML(leading + core + trailing);
                    }

                    const urlRaw = urlMatch[1];
                    const textAfter = rest.slice(urlRaw.length);

                    // Strip trailing ASCII punctuation and unbalanced brackets from URL
                    const { core: urlFinal, trailing: urlTrailing } = trimEdges(urlRaw);

                    try {
                        const u = new URL(urlFinal);

                        if (isValidDomain(u.hostname)) {
                            return `${escapeHTML(leading)}${escapeHTML(textBefore)}`
                                + `<a href="${escapeHTML(urlFinal)}" rel="nofollow">`
                                + `${escapeHTML(urlFinal)}</a>`
                                + `${escapeHTML(urlTrailing + textAfter + trailing)}`;
                        }
                    } catch {
                        // ignore invalid URL parsing
                    }

                    return `${escapeHTML(leading)}${escapeHTML(core)}${escapeHTML(trailing)}`;
                }

                return escapeHTML(chunk);
            }).join('');
        }).join('');

        return htmlSafe(result.replace(/\n/g, '<br>'));
    }

    didReceiveAttrs(): void {
        if (!this.cookies.exists(maintenanceCookie)) {
            this.getMaintenanceStatus.perform();
        }
    }

    @action
    dismiss() {
        this.analytics.click('button', 'Maintenance Banner - dismiss');
        this.cookies.write(maintenanceCookie, 0, {
            expires: moment().add(24, 'hours').toDate(),
            path: '/',
            domain: cookieDomain,
        });
        this.set('maintenance', null);
    }
}
