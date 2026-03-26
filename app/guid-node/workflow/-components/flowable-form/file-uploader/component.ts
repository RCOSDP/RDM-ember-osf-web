import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency-decorators';
import { all } from 'ember-concurrency';
import DS from 'ember-data';
import Toast from 'ember-toastr/services/toast';
import $ from 'jquery';

import File from 'ember-osf-web/models/file';
import FileProviderModel from 'ember-osf-web/models/file-provider';
import Node from 'ember-osf-web/models/node';
import CurrentUser from 'ember-osf-web/services/current-user';

import { FieldValueWithType } from '../types';

interface FileUploaderArgs {
    node: Node;
    fieldId: string;
    path: string;
    acceptExtensions: string[];
    value: FieldValueWithType | undefined;
    onChange: (valueWithType: FieldValueWithType) => void;
    onLoadingChange?: (isLoading: boolean) => void;
    disabled: boolean;
}

export default class FileUploader extends Component<FileUploaderArgs> {
    @service currentUser!: CurrentUser;
    @service store!: DS.Store;
    @service toast!: Toast;

    @tracked allFiles: File[] = [];
    @tracked targetDirectory: File | null = null;
    @tracked loading = true;
    @tracked filter = '';
    @tracked sort = 'name';

    dropzoneOptions = {
        createImageThumbnails: false,
        method: 'PUT',
        withCredentials: true,
        preventMultipleFiles: false,
        acceptDirectories: false,
        timeout: 1000 * 60 * 60 * 48,
        maxFilesize: null,
    };

    get dropZoneId(): string {
        return `file-uploader-${this.args.fieldId}`;
    }

    get files(): File[] {
        let results = this.allFiles;
        if (this.filter) {
            const filterLower = this.filter.toLowerCase();
            results = results.filter(f => f.name.toLowerCase().includes(filterLower));
        }
        if (this.sort) {
            const reverse = this.sort.startsWith('-');
            const key = reverse ? this.sort.slice(1) : this.sort;
            results = results.slice().sort((a, b) => {
                const av = (a as any)[key] || '';
                const bv = (b as any)[key] || '';
                return reverse ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
            });
        }
        return results;
    }

    get hasRejectedFiles(): boolean {
        if (this.args.acceptExtensions.length === 0) {
            return false;
        }
        return this.allFiles.some(f => !this.isAcceptedExtension(f.name));
    }

    get rejectedFileNames(): string {
        if (this.args.acceptExtensions.length === 0) {
            return '';
        }
        return this.allFiles
            .filter(f => !this.isAcceptedExtension(f.name))
            .map(f => f.name)
            .join(', ');
    }

    private isAcceptedExtension(filename: string): boolean {
        if (this.args.acceptExtensions.length === 0) {
            return true;
        }
        const pos = filename.lastIndexOf('.');
        if (pos <= 0) {
            return false;
        }
        const ext = filename.substring(pos).toLowerCase();
        return this.args.acceptExtensions.includes(ext);
    }

    // --- Lifecycle ---

    @action
    initialize() {
        this.args.onLoadingChange?.(true);
        this.setupFolder.perform().finally(() => {
            this.args.onLoadingChange?.(false);
        });
    }

    // --- Folder setup ---

    @task
    setupFolder = task(function *(this: FileUploader) {
        const providers: FileProviderModel[] = yield this.args.node.get('files');
        const osf = providers.find((p: FileProviderModel) => p.name === 'osfstorage');
        if (!osf) {
            throw new Error('osfstorage provider not found');
        }

        let currentDir: File = yield osf.get('rootFolder');
        const segments = this.args.path.split('/').filter(s => s.length > 0);

        for (const segment of segments) {
            let children: File[] = yield currentDir.loadAll('files');
            let found = children.find(f => f.name === segment);
            if (!found) {
                const newFolderUrl = currentDir.get('links').new_folder;
                yield this.currentUser.authenticatedAJAX({
                    url: `${newFolderUrl}&name=${encodeURIComponent(segment)}`,
                    type: 'PUT',
                });
                children = yield currentDir.loadAll('files');
                found = children.find(f => f.name === segment);
            }
            currentDir = found!;
        }

        this.targetDirectory = currentDir;
        const fileList: File[] = yield currentDir.loadAll('files');
        this.allFiles = fileList;
        this.loading = false;
        this.emitValue();
    });

    // --- File operations ---

    @task
    addFile = task(function *(this: FileUploader, id: string) {
        const duplicate = this.allFiles.find(f => f.id === id);
        const file: File = yield this.store.findRecord(
            'file', id,
            duplicate ? {} : { adapterOptions: { query: { create_guid: 1 } } },
        );
        if (duplicate) {
            this.allFiles = this.allFiles.filter(f => f.id !== id);
        }
        this.allFiles = [...this.allFiles, file];
        this.emitValue();
    });

    @task
    deleteFiles = task(function *(this: FileUploader, files: File[]) {
        yield all(files.map(async (file: File) => {
            await file.destroyRecord();
        }));
        const deletedIds = new Set(files.map(f => f.id));
        this.allFiles = this.allFiles.filter(f => !deletedIds.has(f.id));
        this.emitValue();
    });

    @task
    renameFile = task(function *(
        this: FileUploader,
        file: File,
        name: string,
        conflict?: string,
        conflictingFile?: File,
    ) {
        yield file.rename(name, conflict);
        if (conflictingFile) {
            this.allFiles = this.allFiles.filter(f => f.id !== conflictingFile.id);
        }
        this.emitValue();
    });

    @action
    buildUrl(files: File[]): string | undefined {
        if (!this.targetDirectory) {
            return undefined;
        }
        return `${this.targetDirectory.links.upload}?${$.param({ name: files[0].name })}`;
    }

    @action
    openFile(): void {
        // no-op: file viewing not needed in workflow uploader
    }

    @action
    moveFile(): void {
        // no-op: file moving handled by ScriptTask
    }

    @action
    handleUpdateFilter(filter: string): void {
        this.filter = filter;
    }

    // --- Value emission ---

    private emitValue(): void {
        const files = this.allFiles.map(f => ({
            path: f.path,
            materialized: f.get('materializedPath') || `/${f.name}`,
            enable: true,
        }));
        const result: { value: unknown; type: string; valid?: boolean } = {
            value: { provider: 'osfstorage', files },
            type: 'json',
        };
        if (this.hasRejectedFiles) {
            result.valid = false;
        }
        this.args.onChange(result);
    }
}
