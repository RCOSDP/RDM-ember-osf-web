import Component from '@glimmer/component';
import { ChangesetDef } from 'ember-changeset/types';

interface Args {
    changeset: ChangesetDef;
    keys: string[];
}

export default class ValueCheckMark extends Component<Args> {
    get hasValue(): boolean {
        const { changeset, keys } = this.args;
        return keys.some(key => {
            const value = changeset.get(key);
            if (value === null || value === undefined || value === '') {
                return false;
            }
            if (Array.isArray(value)) {
                return value.some((row: any) =>
                    Object.values(row).some((v: any) => v !== null && v !== undefined && v !== ''),
                );
            }
            return true;
        });
    }
}
