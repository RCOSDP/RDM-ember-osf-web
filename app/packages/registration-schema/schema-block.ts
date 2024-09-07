export type SchemaBlockType =
    'page-heading' |
    'section-heading' |
    'subsection-heading' |
    'paragraph' |
    'question-label' |
    'short-text-input' |
    'long-text-input' |
    'file-input' |
    'contributors-input' |
    'multi-select-input' |
    'single-select-input' |
    'select-input-option' |
    'select-other-option' |
    'japan-grant-number-input' |
    'funding-stream-code-input' |
    'jgn-program-name-ja-input' |
    'jgn-program-name-en-input' |
    'e-rad-award-funder-input' |
    'e-rad-award-number-input' |
    'e-rad-award-title-ja-input' |
    'e-rad-award-title-en-input' |
    'e-rad-award-field-input' |
    'e-rad-researcher-number-input' |
    'e-rad-researcher-name-ja-input' |
    'e-rad-researcher-name-en-input' |
    'e-rad-bunnya-input' |
    'file-metadata-input' |
    'date-input' |
    'file-capacity-input' |
    'file-creators-input' |
    'file-url-input' |
    'file-institution-ja-input' |
    'file-institution-en-input' |
    'file-institution-id-input' |
    'file-data-number-input';

export interface SchemaBlock {
    id?: string;
    blockType?: SchemaBlockType;
    schemaBlockGroupKey?: string;
    registrationResponseKey?: string | null;
    displayText?: string;
    helpText?: string;
    exampleText?: string;
    required?: boolean;
    default?: boolean;
    index?: number;
    pattern?: string;
    spaceNormalization?: boolean;
}
