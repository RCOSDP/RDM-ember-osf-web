import { SelectionManager } from 'ember-osf-web/guid-node/package/selection';
import { WaterButlerFile } from 'ember-osf-web/utils/waterbutler/base';

export default class NotifyingSelectionManager extends SelectionManager {
    private onUpdate: () => void;

    constructor(onUpdate: () => void) {
        super();
        this.onUpdate = onUpdate;
    }

    setChecked(item: WaterButlerFile, value: boolean) {
        super.setChecked(item, value);
        this.onUpdate();
    }
}
