import Controller from '@ember/controller';
import EmberError from '@ember/error';
import { action, computed, set } from '@ember/object';
import { reads } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import DS from 'ember-data';
import Intl from 'ember-intl/services/intl';
import Node from 'ember-osf-web/models/node';
import WorkFlowConfigModel from 'ember-osf-web/models/workflow-config';
import Analytics from 'ember-osf-web/services/analytics';
import StatusMessages from 'ember-osf-web/services/status-messages';
import Toast from 'ember-toastr/services/toast';

export default class GuidNodeWorkFlow extends Controller {
    [x: string]: any;
    @service toast!: Toast;
    @service intl!: Intl;
    @service statusMessages!: StatusMessages;
    @service analytics!: Analytics;

    @reads('model.taskInstance.value')
    node?: Node;

    isPageDirty = false;
    configCache?: DS.PromiseObject<WorkFlowConfigModel>;

    @computed('config.isFulfilled')
    get loading(): boolean {
        return !this.config || !this.config.get('isFulfilled');
    }

    activeTab = '';
    isStopProcess = false;
    selectedWorkflow = {};
    filePath = {};
    isRegistering = false;
    isEditing = false;
    isProcessDialogVisible = false;
    workflowEngines: string[] = [];
    @tracked selectedWorkflowEngine: string | null = null;
    @tracked workflowName = '';
    @tracked workflowID: string | null = null;
    @tracked creatorToken = 'none';
    @tracked adminToken = 'none';
    @tracked executorToken = 'none';
    @tracked editingWorkflowId: string | null = null;

    workflowsManage: Array<{ id: string; name: string; suspended: boolean }> = [];
    workflowsProcess: Array<{
        engine: string;
        processDefinitionName: string;
        id: string;
        startUserId: string;
        startTime: string;
        endTime: string;
        statusofprocessing: string;
        ended: string;
    }> = [];

    workflowsTask: Array<{
        id: string;
        processInstanceId: string;
        name: string;
        startTime: string;
        endTime: string;
        assignee: string;
    }> = [];

    workflowsManageInfo: Array<{
        engine: string;
        name: string;
        id: string;
        creatorToken: string;
        adminToken: string;
        executorToken: string;
        processId: string;
        filePath: string;
    }> = [];

    workflowsProcessInfo: Array<{
        processDefinitionName: string;
        id: string;
        startUserId: string;
        startTime: string;
        endTime: string;
    }> = [];

    taskDetails: Array<{
        id: string;
        name: string;
        startTime: string;
        endTime: string;
    }> = [];

    constructor(...args: any[]) {
        super(...args);
        this.executeWorkflow();
    }

    async executeWorkflow() {
        await this.loadWorkflowConfig();
        await this.loadDataManage();
        await this.loadDataProcess();
        await this.loadDataTask();
        await this.loadDataManageInfo();
        await this.loadDataProcessInfo();
    }

    async loadWorkflowConfig() {
        const currentUrl = window.location.href;
        const parts = currentUrl.split('/');
        const pid = parts[3];
        const response = await fetch(`/api/v1/project/${pid}/workflow/workflow_connection`);
        const data = await response.json();
        const engineNames: string[] = data.data.map((engine: { name: string }) => engine.name);
        const engineUrls: string[] = data.data.map((engine: { url: string }) => engine.url);
        const engineAccounts: string[] = data.data.map((engine: { account: string }) => engine.account);
        const enginePasswords: string[] = data.data.map((engine: { password: string }) => engine.password);

        this.set('workflowEngines', engineNames);
        this.set('workflowUrls', engineUrls);
        this.set('workflowAccounts', engineAccounts);
        this.set('workflowPasswords', enginePasswords);
    }

    async fetchWorkflowData(
        url: string,
        method: string = 'GET',
        body: any = null,
    ) {
        try {
            const username = this.get('workflowAccounts')[0];
            const password = this.get('workflowPasswords')[0];
            const encodedCredentials = btoa(`${username}:${password}`);

            const headers: HeadersInit = {
                Authorization: `Basic ${encodedCredentials}`,
            };

            if (method === 'POST' && body instanceof FormData) {
                delete headers['Content-Type'];
            } else if (body) {
                headers['Content-Type'] = 'application/json';
            }

            let requestBody = null;
            if (body) {
                if (body instanceof FormData) {
                    requestBody = body;
                } else {
                    requestBody = JSON.stringify(body);
                }
            }

            const response = await fetch(url, {
                method,
                headers,
                body: requestBody,
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`Failed to ${method} request`);
            }

            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            // Error during request
            this.toast.error('Failed to load workflow data');
            throw error;
        }
    }

    async loadDataManage() {
        const workflowUrls = this.get('workflowUrls');
        const pathToAppend = '/process-api/repository/process-definitions';

        if (workflowUrls && workflowUrls.length > 0) {
            const fullUrl = `${workflowUrls[0]}${pathToAppend}`;
            const workflowData = await this.fetchWorkflowData(fullUrl);

            const processedData = workflowData.data.map((item: any) => ({
                id: item.id,
                name: item.name,
                suspended: item.suspended,
            }));

            if (!this.isDestroyed && !this.isDestroying) {
                this.set('workflowsManage', processedData);
            }
        }
    }

    async loadDataProcess() {
        const workflowUrls = this.get('workflowUrls');
        const pathToAppend = '/process-api/history/historic-process-instances';

        if (workflowUrls && workflowUrls.length > 0) {
            const fullUrl = `${workflowUrls[0]}${pathToAppend}`;
            const workflowData2 = await this.fetchWorkflowData(fullUrl);

            const processedData2 = workflowData2.data.map((item: any) => ({
                id: item.id,
                processDefinitionName: item.processDefinitionName,
                startUserId: item.startUserId || '',
                startTime: item.startTime || '',
                endTime: item.endTime || '',
                statusofprocessing: item.status || '',
                ended: item.ended || '',
            }));

            if (!this.isDestroyed && !this.isDestroying) {
                this.set('workflowsProcess', processedData2);
            }
        }
    }

    async loadDataTask() {
        const workflowUrls = this.get('workflowUrls');
        const runtimePath = '/process-api/runtime/process-instances';
        const historicPath = '/process-api/history/historic-task-instances';

        if (workflowUrls && workflowUrls.length > 0) {
            try {
                const [runtimeData, historicData] = await Promise.all([
                    this.fetchWorkflowData(`${workflowUrls[0]}${runtimePath}`),
                    this.fetchWorkflowData(`${workflowUrls[0]}${historicPath}`),
                ]);

                const validIds = new Set(runtimeData.data.map((item: any) => item.id));

                const processedData = historicData.data
                    .filter((item: any) => validIds.has(item.processInstanceId))
                    .map((item: any) => ({
                        id: item.id,
                        processInstanceId: item.processInstanceId,
                        name: item.name,
                        startTime: item.startTime || '',
                        endTime: item.endTime || '',
                        assignee: item.assignee || '',
                    }));

                if (!this.isDestroyed && !this.isDestroying) {
                    this.set('workflowsTask', processedData);
                }

                if (processedData.length > 0) {
                    this.set('activeTab', 'tab1');
                }
            } catch (error) {
                // Data acquisition error
            }
        }
    }

    async loadDataManageInfo() {
        const response = await fetch('/api/v1/addons/workflow/registered_workflows/');
        const data = await response.json();
        this.set('workflowsManageInfo', data.data);
    }

    async loadDataProcessInfo() {
        const workflowUrls = this.get('workflowUrls');
        const pathToAppend = '/process-api/history/historic-process-instances';

        if (workflowUrls && workflowUrls.length > 0) {
            try {
                const workflowData5 = await this.fetchWorkflowData(`${workflowUrls[0]}${pathToAppend}`);
                const workflowsProcess = this.get('workflowsProcess') || [];
                const validIds = new Set(workflowsProcess.map((item: any) => item.id));

                const processedData5 = workflowData5.data
                    .filter((item: any) => validIds.has(item.id))
                    .map((item: any) => ({
                        processDefinitionName: item.processDefinitionName,
                        id: item.id,
                        startUserId: item.startUserId || '',
                        startTime: item.startTime || '',
                        endTime: item.endTime || '',
                    }));

                if (!this.isDestroyed && !this.isDestroying) {
                    this.set('workflowsProcessInfo', processedData5);
                }
            } catch (error) {
                // Data acquisition error
            }
        }
    }

    @action
    async toggleActivate(workflowId: string) {
        const workflowUrls = this.get('workflowUrls');
        const pathToAppend = `/process-api/repository/process-definitions/${workflowId}`;

        if (workflowUrls && workflowUrls.length > 0) {
            try {
                const url = `${workflowUrls[0]}${pathToAppend}`;
                const body = { action: 'activate' };

                await this.fetchWorkflowData(url, 'PUT', body);

                const workflow = this.workflowsManage.find(w => w.id === workflowId);
                if (workflow) {
                    if (!this.isDestroyed && !this.isDestroying) {
                        set(workflow, 'suspended', false);
                    }
                }
            } catch (error) {
                // Error activating workflow
            }
        }
    }

    @action
    async toggleDeactivate(workflowId: string) {
        const workflowUrls = this.get('workflowUrls');
        const pathToAppend = `/process-api/repository/process-definitions/${workflowId}`;

        if (workflowUrls && workflowUrls.length > 0) {
            try {
                const url = `${workflowUrls[0]}${pathToAppend}`;
                const body = { action: 'suspend' };

                await this.fetchWorkflowData(url, 'PUT', body);

                const workflow = this.workflowsManage.find(w => w.id === workflowId);
                if (workflow) {
                    if (!this.isDestroyed && !this.isDestroying) {
                        set(workflow, 'suspended', true);
                    }
                }
            } catch (error) {
                // Error suspending workflow
            }
        }
    }

    @action
    async stopProcess(workflowId: string) {
        this.set('isStopProcess', true);
        const workflowUrls = this.get('workflowUrls');
        const runtimePath = `/process-api/runtime/process-instances/${workflowId}`;
        const historyPath = `/process-api/history/historic-process-instances/${workflowId}`;

        if (workflowUrls && workflowUrls.length > 0) {
            try {
                let processExists = true;

                try {
                    await this.fetchWorkflowData(`${workflowUrls[0]}${runtimePath}`, 'GET');
                } catch (error) {
                    if (error.status === 404) {
                        processExists = false;
                    } else {
                        throw error;
                    }
                }

                if (processExists) {
                    await this.fetchWorkflowData(`${workflowUrls[0]}${runtimePath}`, 'DELETE');
                }

                await this.fetchWorkflowData(`${workflowUrls[0]}${historyPath}`, 'DELETE');

                await this.loadDataProcess();
                await this.loadDataProcessInfo();
            } catch (error) {
                // Error deleting process
            }

            if (!this.isDestroyed && !this.isDestroying) {
                this.set('isStopProcess', false);
            }
        }
    }

    @action
    async registerWorkflow2() {
        const currentUrl = window.location.href;
        const parts = currentUrl.split('/');
        const pid = parts[3];

        const data = {
            workflowEngine: this.selectedWorkflowEngine,
            workflowName: this.workflowName,
            workflowID: this.workflowID,
            creatorToken: this.creatorToken,
            adminToken: this.adminToken,
            executorToken: this.executorToken,
        };

        const missingFields = Object.keys(data).filter(key => {
            const value = data[key as keyof typeof data];
            return !value;
        });

        if (missingFields.length > 0) {
            this.toast.error(`Missing required fields: ${missingFields.join(', ')}`);
            return;
        }

        try {
            const response = await fetch(`/api/v1/project/${pid}/workflow/register_workflow`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to register workflow: ${JSON.stringify(errorData)}`);
            }

            this.toast.success('Workflow registered successfully.');
            this.set('isRegistering', false);
            await this.loadDataManageInfo();
        } catch (error) {
            // Error registering workflow
            this.toast.error(`Failed to register workflow: ${error.message}`);
            this.set('isRegistering', false);
        }
    }

    @action
    async processRegisterWorkflow() {
        const currentUrl = window.location.href;
        const parts = currentUrl.split('/');
        const pid = parts[3];

        const data = {
            workflowEngine: this.selectedWorkflowEngine,
            workflowName: this.workflowName,
            workflowID: this.workflowID,
            creatorToken: this.creatorToken,
            adminToken: this.adminToken,
            executorToken: this.executorToken,
        };

        const missingFields = Object.keys(data).filter(key => {
            const value = data[key as keyof typeof data];
            return !value;
        });

        if (missingFields.length > 0) {
            this.toast.error(`Missing required fields: ${missingFields.join(', ')}`);
            return;
        }

        try {
            const response = await fetch(`/api/v1/project/${pid}/workflow/register_workflow`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to register workflow: ${JSON.stringify(errorData)}`);
            }

            this.toast.success('Workflow registered successfully.');
            this.set('isRegistering', false);
            await this.loadDataManageInfo();
        } catch (error) {
            // Error registering workflow
            this.toast.error(`Failed to register workflow: ${error.message}`);
            this.set('isRegistering', false);
        }
    }

    @action
    async removeworkflow(workflowId: string) {
        const currentUrl = window.location.href;
        const parts = currentUrl.split('/');
        const pid = parts[3];
        try {
            const response = await fetch(`/api/v1/project/${pid}/workflow/remove_workflow/${workflowId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to remove workflow: ${JSON.stringify(errorData)}`);
            }

            this.toast.success('Workflow removed successfully.');
            await this.loadDataManageInfo();
        } catch (error) {
            // Error removing workflow
            this.toast.error(`Failed to remove workflow: ${error.message}`);
        }
    }

    @action
    async updateWorkflow() {
        const currentUrl = window.location.href;
        const parts = currentUrl.split('/');
        const pid = parts[3];
        const data = {
            workflowName: this.workflowName,
            creatorToken: this.creatorToken,
            adminToken: this.adminToken,
            executorToken: this.executorToken,
        };

        const missingFields = Object.keys(data).filter(key => {
            const value = data[key as keyof typeof data];
            return !value;
        });

        if (missingFields.length > 0) {
            this.toast.error(`Missing required fields: ${missingFields.join(', ')}`);
            return;
        }

        try {
            const response = await fetch(
                `/api/v1/project/${pid}/workflow/register_workflow/${this.editingWorkflowId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                },
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to update workflow: ${JSON.stringify(errorData)}`);
            }

            this.toast.success('Workflow updated successfully.');
            this.set('isRegistering', false);
            this.set('isEditing', false);
            await this.loadDataManageInfo();
        } catch (error) {
            // Error updating workflow
            this.toast.error(`Failed to update workflow: ${error.message}`);
            this.set('isRegistering', false);
            this.set('isEditing', false);
        }
    }

    @action
    editWorkflow(workflowId: string) {
        const workflow = this.workflowsManageInfo.find((w: any) => w.id === workflowId);
        if (workflow) {
            this.set('isRegistering', true);
            this.set('isEditing', true);
            this.editingWorkflowId = workflowId;
            this.selectedWorkflowEngine = workflow.engine;
            this.workflowName = workflow.name;
            this.workflowID = workflow.id;
            this.creatorToken = workflow.creatorToken;
            this.adminToken = workflow.adminToken;
            this.executorToken = workflow.executorToken;
        }
    }

    @action
    setActiveTab(tab: string) {
        this.set('activeTab', tab);
    }

    @action
    registerWorkflow() {
        this.set('isRegistering', true);
        this.set('isEditing', false);
        this.selectedWorkflowEngine = null;
        this.workflowName = '';
        this.workflowID = null;
        this.creatorToken = 'none';
        this.adminToken = 'none';
        this.executorToken = 'none';
    }

    @action
    closeRegisterDialog() {
        this.set('isRegistering', false);
        this.set('isEditing', false);
    }

    @action
    async openProcessDialog(workflowId: string) {
        if (this.isStopProcess) {
            return;
        }

        const workflowUrls = this.get('workflowUrls');
        const pathToProcess = `/process-api/history/historic-task-instances?processInstanceId=${workflowId}`;
        const pathToTaskDetail = '/process-api/history/historic-task-instances/';

        const selectedWorkflow = this.get('workflowsProcessInfo').find(workflow => workflow.id === workflowId);
        this.set('selectedWorkflow', selectedWorkflow);
        this.set('isProcessDialogVisible', true);

        try {
            const response = await fetch('/api/v1/addons/workflow/registered_workflows/');
            const data = await response.json();
            this.set('workflowsManageInfo', data.data);

            const tasks = await this.fetchWorkflowData(`${workflowUrls[0]}${pathToProcess}`);

            if (!tasks || !tasks.data || tasks.data.length === 0) {
                this.set('taskDetails', []);
                return;
            }

            const taskDetails = await Promise.all(
                tasks.data.map(async (task: any) => {
                    const detail = await this.fetchWorkflowData(
                        `${workflowUrls[0]}${pathToTaskDetail}${task.id}`, 'GET', null,
                    );
                    return {
                        id: detail.id,
                        name: detail.name || '',
                        startTime: detail.startTime || '',
                        endTime: detail.endTime || '',
                    };
                }),
            );

            this.set('taskDetails', taskDetails);

            const matchingWorkflow = this.get('workflowsManageInfo').find(
                workflow => workflow.processId === workflowId,
            );
            if (matchingWorkflow) {
                this.set('filePath', matchingWorkflow);
            } else {
                this.set('filePath', '');
            }
        } catch (error) {
            // Failed to load task details
            this.set('taskDetails', []);
        }
    }

    @action
    closeProcessDialog() {
        this.set('isProcessDialogVisible', false);
    }

    @action
    async updatebutton() {
        await this.loadDataProcess();
        await this.loadDataProcessInfo();
    }

    @action
    async updatebuttonTask() {
        await this.loadDataProcess();
        await this.loadDataTask();
    }

    @action
    navigateToTasks(taskId: string): void {
        const workflowUrls = this.get('workflowUrls');
        const baseUrl = workflowUrls && workflowUrls.length > 0 ? workflowUrls[0] : '';

        if (!this.isDestroyed && !this.isDestroying && baseUrl) {
            const taskUrl = `/workflow/#/apps/Workflow_Task_App/tasks/${taskId}`;
            window.open(`${baseUrl}${taskUrl}`, '_blank');
        }
    }

    @computed('config.param1')
    get param1() {
        if (!this.config || !this.config.get('isFulfilled')) {
            return '';
        }
        const config = this.config.content as WorkFlowConfigModel;
        return config.param1;
    }

    set param1(v: string) {
        if (!this.config) {
            throw new EmberError('Illegal config');
        }
        const config = this.config.content as WorkFlowConfigModel;
        config.set('param1', v);
        this.set('isPageDirty', true);
    }

    @action
    updateWorkflowEngine(event: Event) {
        this.selectedWorkflowEngine = (event.target as HTMLSelectElement).value;
    }

    @action
    updateToken(tokenType: string, event: Event) {
        (this as any)[tokenType] = (event.target as HTMLInputElement).value;
    }

    @action
    updateWorkflowName(event: Event) {
        this.workflowName = (event.target as HTMLInputElement).value;
    }

    @action
    updateWorkflowID(event: Event) {
        this.workflowID = (event.target as HTMLInputElement).value;
    }

    @computed('node')
    get config(): DS.PromiseObject<WorkFlowConfigModel> | undefined {
        if (this.configCache) {
            return this.configCache;
        }
        if (!this.node) {
            return undefined;
        }
        this.configCache = this.store.findRecord('workflow-config', this.node.id);
        return this.configCache!;
    }
}

declare module '@ember/controller' {
    interface Registry {
        'guid-node/workflow': GuidNodeWorkFlow;
    }
}
