import { SchemaBlock } from 'ember-osf-web/packages/registration-schema';

export function getPages(blocks: SchemaBlock[]) {
    const pageArray = blocks.reduce(
        (pages, block) => {
            if (pages.length === 0 && block.blockType !== 'page-heading'
                && (block.hideProjectmetadata === true || block.hideProjectmetadata === undefined)) {
                const blankPage: SchemaBlock[] = [];
                pages.push(blankPage);
            }

            const lastPage: SchemaBlock[] = pages.slice(-1)[0] || [];
            if (block.blockType === 'page-heading'
                && (block.hideProjectmetadata === false || block.hideProjectmetadata === undefined)) {
                pages.push([block]);
            } else {
                lastPage.push(block);
            }
            return pages;
        },
        [] as SchemaBlock[][],
    );
    return pageArray;
}
