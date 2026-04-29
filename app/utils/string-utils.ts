export const escapeHTML = (s: string): string => (
    s.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
);

export const isEmail = (s: string): boolean => (
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s)
);

export const isValidDomain = (host: string): boolean => {
    if (!/^[a-zA-Z0-9.-]+$/.test(host)) { return false; }
    if (host.includes('..')) { return false; }
    if (!host.includes('.')) { return false; }

    const labels = host.split('.');
    if (labels.some(label => /^-|-$/.test(label) || label === '')) {
        return false;
    }

    const tld = labels[labels.length - 1];
    return /^[a-zA-Z]{2,}$/.test(tld);
};

export interface TrimEdgesResult {
    leading: string;
    core: string;
    trailing: string;
}

export const trimEdges = (s: string): TrimEdgesResult => {
    let core = s;
    let leading = '';
    let trailing = '';

    while (/^[(<[{【（「『〔]/.test(core)) {
        leading += core.charAt(0);
        core = core.slice(1);
    }

    while (/[.,!?)\]}】）」』〕、。]$/.test(core)) {
        trailing = core.slice(-1) + trailing;
        core = core.slice(0, -1);
    }

    return { leading, core, trailing };
};
