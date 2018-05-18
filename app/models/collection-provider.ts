import { attr, hasMany } from '@ember-decorators/data';
import { alias } from '@ember-decorators/object/computed';
import DS from 'ember-data';
import Collection from './collection';
import License from './license';
import OsfModel from './osf-model';
import Taxonomy from './taxonomy';

export default class CollectionProvider extends OsfModel {
    @attr('fixstring') name!: string; // eslint-disable-line no-restricted-globals
    @attr('fixstring') description!: string;
    @attr('string') domain!: string;
    @attr('boolean') domainRedirectEnabled!: boolean;
    @attr('fixstring') example!: string;
    @attr('string') advisoryBoard!: string;
    @attr('fixstring') emailSupport!: string;
    // @attr('array') subjectsAcceptable!: string[];
    @attr('string') footerLinks!: string;
    @attr('boolean') allowSubmissions!: boolean;
    @attr('boolean') allowCommenting!: boolean;
    @attr('string') facebookAppId!: string;
    // @attr('array') additionalProviders!: string[];
    // @attr('string') shareSource!: string;
    // @attr('string') preprintWord!: string;

    // // Reviews settings
    // @attr('array') permissions!: string[];
    // @attr('string') reviewsWorkflow!: string | null;
    // @attr('boolean', { allowNull: true }) reviewsCommentsPrivate!: boolean | null;
    // @attr('boolean', { allowNull: true }) reviewsCommentsAnonymous!: boolean | null;

    // Relationships
    @hasMany('taxonomy') taxonomies!: DS.PromiseManyArray<Taxonomy>;
    @hasMany('taxonomy') highlightedTaxonomies!: DS.PromiseManyArray<Taxonomy>;
    @hasMany('collection', { inverse: 'provider' }) collections!: DS.PromiseManyArray<Collection>;
    @hasMany('license', { inverse: null }) licensesAcceptable!: DS.PromiseManyArray<License>;

    // @alias('links.relationships.preprints.links.related.meta')
    // reviewableStatusCounts!: any;

    // @alias('links.relationships.highlighted_taxonomies.links.related.meta.has_highlighted_subjects')
    // hasHighlightedSubjects!: boolean;

    @alias('relationships.primary_collection.data.id')
    primaryCollection!: string;
}

declare module 'ember-data' {
    interface ModelRegistry {
        'collection-provider': CollectionProvider;
    }
}
