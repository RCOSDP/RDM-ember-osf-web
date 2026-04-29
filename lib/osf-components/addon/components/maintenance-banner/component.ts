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
    isEmail,
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

                if (isEmail(core)) {
                    return `${escapeHTML(leading)}<a href="mailto:${escapeHTML(core)}">`
                        + `${escapeHTML(core)}</a>${escapeHTML(trailing)}`;
                }

                // scheme:// (loose handling, e.g. htp://)
                const schemeIdx = core.search(/[a-zA-Z]+:\/\//);
                if (schemeIdx >= 0) {
                    const textBefore = core.slice(0, schemeIdx);
                    const urlCandidate = core.slice(schemeIdx);

                    try {
                        const fake = urlCandidate.replace(/^([a-zA-Z]+):\/\//, 'http://');
                        const u = new URL(fake);

                        if (isValidDomain(u.hostname)) {
                            return `${escapeHTML(leading)}${escapeHTML(textBefore)}<a href="${escapeHTML(urlCandidate)}" rel="nofollow">`
                            + `${escapeHTML(urlCandidate)}</a>${escapeHTML(trailing)}`;
                        }
                    } catch {
                        // ignore invalid URL parsing
                    }

                    // fallback: link the prefix part (no strict domain validation)
                    const match = urlCandidate.match(/^([a-zA-Z]+:\/\/([a-zA-Z0-9-]+))/);
                    if (match) {
                        const full = match[1];
                        const host = match[2];

                        // reject invalid host patterns
                        if (!host.startsWith('-') && /^[a-zA-Z0-9-]+$/.test(host)) {
                            const rest = urlCandidate.slice(full.length);
                            return `${escapeHTML(leading)}${escapeHTML(textBefore)}<a href="${escapeHTML(full)}" rel="nofollow">`
                            + `${escapeHTML(full)}</a>${escapeHTML(rest + trailing)}`;
                        }
                    }

                    return `${escapeHTML(leading)}${escapeHTML(chunk)}${escapeHTML(trailing)}`;
                }

                // domain (e.g. abc.com, www.google.com)
                const domainIdx = core.search(/(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/);
                if (domainIdx >= 0) {
                    const textBefore = core.slice(0, domainIdx);
                    const urlCandidate = core.slice(domainIdx);

                    const domainMatch = urlCandidate.match(/^((?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?=$|[^a-zA-Z0-9-])/);
                    if (domainMatch) {
                        const domain = domainMatch[1];
                        const host = domain.replace(/^www\./, '');

                        if (isValidDomain(host)) {
                            const rest = urlCandidate.slice(domain.length);
                            return `${escapeHTML(leading)}${escapeHTML(textBefore)}<a href="http://${escapeHTML(domain)}" rel="nofollow">`
                            + `${escapeHTML(domain)}</a>${escapeHTML(rest + trailing)}`;
                        }
                    }
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
