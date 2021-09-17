import Intl from 'ember-intl/services/intl';
import Controller from '@ember/controller';
import EmberError from '@ember/error';
import { action, computed } from '@ember/object';
import { reads } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import config from 'ember-get-config';

import CurrentUser from 'ember-osf-web/services/current-user';

import DS from 'ember-data';
import moment from 'moment';
import GrdmappsConfigModel from 'ember-osf-web/models/grdmapps-config';
import Node from 'ember-osf-web/models/node';
import Analytics from 'ember-osf-web/services/analytics';
import StatusMessages from 'ember-osf-web/services/status-messages';
import Toast from 'ember-toastr/services/toast';

import $ from 'jquery';

interface reqBody {
    count: number;
    nodeId: string;
    timestamp: string;
}

interface microsoftTeamsAttendeeAtCreate {
    emailAddress: { address: string; };
}

interface microsoftTeamsAttendeeAtUpdate {
    address: string;
    name: string;
}

interface webexMeetingsAttendee {
    email: string;
}

interface webexMeetingsCreateInvitee {
    email: string;
}

interface webMeetingAttendeesNow {
    email: string;
    fullname: string;
    profile: string;
}

interface notwebMeetingAttendeesNow {
    email: string;
    fullname: string;
}

interface payload {
    nodeId: string;
    appName: string;
    appNameDisp: string;
    guid: string;
    meetingId: string;
    joinUrl: string;
    action: string;
    info: {
        grdmScenarioStarted: string;
        grdmScenarioCompleted: string;
    };
    error: {
        webappsCreateMeeting: string;
        grdmRegisterMeeting: string;
        slackCreateMeeting: string;
        webappsUpdateMeeting: string; 
        webappsUpdateAttendees: string;
        webappsUpdateAttendeesGrdmMeetingReg: string; 
        grdmUpdateMeetingReg: string;
        slackUpdateMeeting: string; 
        webappsDeleteMeeting: string; 
        grdmDeleteMeetingReg: string;
        slackDeleteMeeting: string; 
        scenarioProcessing: string;
    };
    startDatetime: string;
    endDatetime: string;
    subject: string;
    microsoftTeamsAttendeesCollectionAtCreate: microsoftTeamsAttendeeAtCreate[];
    microsoftTeamsAttendeesCollectionAtUpdate: microsoftTeamsAttendeeAtUpdate[];
    webexMeetingsAttendeesCollection: webexMeetingsAttendee[];
    webexMeetingsCreateInvitees: webexMeetingsCreateInvitee[],
    webexMeetingsDeleteInviteeIds: string[],
    attendees: string[];
    location: string;
    content: string;
    webhook_url: string;
    timestamp: number;
}

const {
    OSF: {
        url: host,
        webApiNamespace: namespace,
    },
} = config;

const infoGrdmScenarioStarted = 'integromat.info.started';
const infoGrdmScenarioCompleted = 'integromat.info.completed';
const errorWebappsCreateMeeting = 'integromat.error.webappsCreateMeeting';
const errorGrdmRegisterMeeting = 'integromat.error.grdmCreateMeeting';
const errorSlackCreateMeeting = 'integromat.error.slackCreateMeeting';
const errorWebappsUpdateMeeting = 'integromat.error.webappsUpdateMeeting';
const errorWebappsUpdateAttendees = 'integromat.error.webappsUpdateAttendees';
const errorWebappsUpdateAttendeesGrdmMeetingReg = 'integromat.error.webappsUpdateAttendeesGrdmMeeting';
const errorGrdmUpdateMeetingReg = 'integromat.error.grdmUpdateMeeting';
const errorSlackUpdateMeeting = 'integromat.error.slackUpdateMeeting';
const errorWebappsDeleteMeeting = 'integromat.error.webappsDeleteMeeting';
const errorGrdmDeleteMeetingReg = 'integromat.error.grdmDeleteMeeting';
const errorSlackDeleteMeeting = 'integromat.error.slackDeleteMeeting';
const errorScenarioProcessing = 'integromat.error.scenarioProcessing';


const nodeUrl = host + namespace + '/project/' + '{}';
const integromatDir = '/integromat'
const startIntegromatScenarioUrl = nodeUrl + integromatDir + '/start_scenario';
const reqestMessagesUrl =  nodeUrl + integromatDir + '/requestNextMessages';
const registerAlternativeWebhookUrl = nodeUrl + integromatDir + '/register_alternative_webhook_url';
const profileUrl = host + '/profile/'

const TIME_LIMIT_EXECUTION_SCENARIO = 60;

export default class GuidNodeGrdmapps extends Controller {
    @service toast!: Toast;
    @service statusMessages!: StatusMessages;
    @service analytics!: Analytics;
    @service intl!: Intl;
    @service currentUser!: CurrentUser;

    @reads('model.taskInstance.value')
    node?: Node;

    isPageDirty = false;

    configCache?: DS.PromiseObject<GrdmappsConfigModel>;

    showCreateWebMeetingDialog = false;
    showUpdateWebMeetingDialog = false;
    showCreateMicrosoftTeamsMeetingDialog = false;
    showCreateWebexMeetingDialog = false;
    showUpdateMicrosoftTeamsMeetingDialog = false;
    showUpdateWebexMeetingsDialog = false;
    showDeleteWebMeetingDialog = false;
    showDetailWebMeetingDialog = false;
    showWorkflows = true;
    showWebMeetingWorkflow = false;
    showRegisterAlternativeWebhookUrl = false;

    currentTime = new Date();
    defaultStartTime = moment(this.currentTime.setMinutes(Math.round(this.currentTime.getMinutes() / 30) * 30)).format('HH:mm');
    defaultEndTime = moment(this.currentTime.setMinutes((Math.round(this.currentTime.getMinutes() / 30) * 30) + 60)).format('HH:mm');

    times = ['00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '24:00'];

    webMeetingAppName = '';
    webMeetingAppNameDisp = '';
    webMeetingPk = '';
    webMeetingSubject = '';
    webMeetingOrganizerFullname = '';
    webMeetingAttendees : string[] = [];
    webMeetingStartDate = '';
    webMeetingStartTime = '';
    webMeetingEndDate = '';
    webMeetingEndTime = '';
    webMeetingLocation = '';
    webMeetingContent = '';
    webMeetingUpdateMeetingId = '';
    webMeetingDeleteMeetingId = '';
    webMeetingDeleteSubject = '';
    webMeetingDeleteStartDate = '';
    webMeetingDeleteStartTime = '';
    webMeetingDeleteEndDate = '';
    webMeetingDeleteEndTime = '';
    webMeetingJoinUrl = '';
    webMeetingPassword = '';
    webhookUrl = '';

    msgInvalidSubject = '';
    msgInvalidAttendees = '';
    msgInvalidDatetime = '';
    msgInvalidWebhookUrl = '';

    workflowDescription = '';
    alternativeWebhookUrl = '';

    teamsMeetingAttendees : string[] = [];
    notTeamsMeetingAttendees : string[] = [];
    webMeetingAttendeesNow : webMeetingAttendeesNow[] = [];
    notwebMeetingAttendeesNow : notwebMeetingAttendeesNow[] = [];

    @computed('config.isFulfilled')
    get loading(): boolean {
        return !this.config || !this.config.get('isFulfilled');
    }

    @action
    save(this: GuidNodeGrdmapps) {
        if (!this.config) {
            throw new EmberError('Illegal config');
        }
        const config = this.config.content as GrdmappsConfigModel;

        config.save()
            .then(() => {
                this.set('isPageDirty', false);
            })
            .catch(() => {
                this.saveError(config);
            });
    }

    saveError(config: GrdmappsConfigModel) {
        config.rollbackAttributes();
        const message = this.intl.t('integromat.failed_to_save');
        this.toast.error(message);
    }

    camel2space(v: string) {

        const separator = ' ';
        return v
                .replace(/[A-Z][a-z]/g, function (match) {
                    return separator + match;
                })
                .replace(/[A-Z]+$/g, function (match) {
                    return separator + match;
                })
                .trim();
    }

    @action
    startMeeting(this: GuidNodeGrdmapps, v: string) {
        window.open(v, '_blank');
    }

    @action
    displayWorkflows(this: GuidNodeGrdmapps) {
        this.set('showWorkflows', true);
        this.set('showWebMeetingWorkflow', false);
        this.set('webhookUrl', '');
    }

    @action
    setWorkflow(this: GuidNodeGrdmapps, workflow_desp: string) {

        const workflowType = workflow_desp.split('.')[2];

        if (!this.config) {
            throw new EmberError('Illegal config');
        }

        const config = this.config.content as GrdmappsConfigModel;
        const workflows = JSON.parse(config.workflows);
        const nodeWorkflows = JSON.parse(config.node_workflows);

        let workflowId = '';
        let url = '' ;

        for(let i = 0; i < workflows.length; i++){
            if(workflows[i].fields.workflow_description === workflow_desp){
                workflowId = workflows[i].pk
                for(let j = 0; j < nodeWorkflows.length; j++){
                    if(nodeWorkflows[j].fields.workflow === workflowId){
                        if(!nodeWorkflows[j].fields.scenarios){
                            url = nodeWorkflows[j].fields.alternative_webhook_url
                        }
                    }
                }
            }
        }

        this.set('webhookUrl', url);

        if(workflowType === 'web_meeting'){

            this.set('showWorkflows', false);
            this.set('showWebMeetingWorkflow', true);
        }
    }

    @action
    setWebMeetingApp(this: GuidNodeGrdmapps, v: string, action: string) {

        if (!this.config) {
            throw new EmberError('Illegal config');
        }

        const config = this.config.content as GrdmappsConfigModel;
        let appNameDisp = '';

        if(v === config.app_name_microsoft_teams){

            if(action === 'create'){
                this.set('showCreateMicrosoftTeamsMeetingDialog', true);
                this.set('showCreateWebexMeetingDialog', false);
            }else if(action === 'update'){
                this.set('showUpdateMicrosoftTeamsMeetingDialog', true);
                this.set('showUpdateWebexMeetingsDialog', false);
            }
            appNameDisp = this.camel2space(v);
            this.set('webMeetingAppName', v);
            this.set('webMeetingAppNameDisp', appNameDisp);

        }else if(v === config.app_name_webex_meetings){

            if(action === 'create'){
                this.set('showCreateMicrosoftTeamsMeetingDialog', false);
                this.set('showCreateWebexMeetingDialog', true);
            }else if(action === 'update'){
                this.set('showUpdateMicrosoftTeamsMeetingDialog', false);
                this.set('showUpdateWebexMeetingsDialog', true);
            }
            appNameDisp = this.camel2space(v);
            this.set('webMeetingAppName', v);
            this.set('webMeetingAppNameDisp', appNameDisp);

        }else if (!v && !action){

            this.set('showCreateWebMeetingDialog', false);
            this.set('showUpdateWebMeetingDialog', false);
            this.set('showDeleteWebMeetingDialog', false);
            this.set('showCreateMicrosoftTeamsMeetingDialog', false);
            this.set('showCreateWebexMeetingDialog', false);
            this.set('showUpdateMicrosoftTeamsMeetingDialog', false);
            this.set('showUpdateWebexMeetingsDialog', false);
            this.set('showDeleteWebMeetingDialog', false);
            this.set('showDetailWebMeetingDialog', false);

            this.set('webMeetingAppName', '');
            this.set('webMeetingAppNameDisp', '');
            this.set('webMeetingPk', '');
            this.set('webMeetingSubject', '');
            this.set('webMeetingOrganizerFullname', '');
            this.set('webMeetingAttendees', 0);
            this.set('webMeetingStartDate', '');
            this.set('webMeetingStartTime', '');
            this.set('webMeetingEndDate', '');
            this.set('webMeetingEndTime', '');
            this.set('webMeetingLocation', '');
            this.set('webMeetingContent', '');
            this.set('webMeetingUpdateMeetingId', '');
            this.set('webMeetingJoinUrl', '');
            this.set('webMeetingPassword', '');
            this.set('webMeetingDeleteMeetingId', '');
            this.set('webMeetingDeleteSubject', '');
            this.set('webMeetingDeleteStartDate', '');
            this.set('webMeetingDeleteStartTime', '');
            this.set('webMeetingDeleteEndDate', '');
            this.set('webMeetingDeleteEndTime', '');
            this.set('msgInvalidSubject', '');
            this.set('msgInvalidAttendees', '');
            this.set('msgInvalidDatetime', '');
        }
    }

    @action
    resetValue(this: GuidNodeGrdmapps) {

        this.set('workflowDescription', '');
        this.set('alternativeWebhookUrl', '');
        this.set('showRegisterAlternativeWebhookUrl', false);
    }

    @action
    webhookValidationCheck(this: GuidNodeGrdmapps, webhook_url: string) {

        let validFlag = true;

        if(!webhook_url){
            this.set('msgInvalidWebhookUrl', this.intl.t('integromat.meetingDialog.invalid.empty', {item: this.intl.t('integromat.workflows.alternative_webhook_url.label')}));
            validFlag = false;
        }else{
            this.set('msgInvalidWebhookUrl', '');
        }

        return validFlag
    }

    @action
    makeRegisterAlternativeWebhookUrl(this: GuidNodeGrdmapps, workflow_description: string) {

        this.set('workflowDescription', workflow_description);
        this.set('showRegisterAlternativeWebhookUrl', true);
    }

    @action
    registerAlternativeWebhook(this: GuidNodeGrdmapps) {

        const headers = this.currentUser.ajaxHeaders();
        const url = registerAlternativeWebhookUrl.replace('{}', String(this.model.guid));

        //validation check for webhook url input
        if(!this.webhookValidationCheck(this.alternativeWebhookUrl)){
            return;
        }

        const payload = {
            'workflowDescription': this.workflowDescription,
            'alternativeWebhookUrl': this.alternativeWebhookUrl,
        };

        this.resetValue();

        return fetch(
            url,
            {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
        })
        .then((res) => {
                if(!res.ok){
                    this.toast.error(this.intl.t('integromat.fail.registerAlternativeWebhookUrl'));
                    return;
                }
                this.save();
                this.toast.info(this.intl.t('integromat.success.registerAlternativeWebhookUrl'));
            })
            .catch(() => {
                this.toast.error(this.intl.t('integromat.error.failedToRequest'));
            })
    }

    @action
    webMeetingvalidationCheck(this: GuidNodeGrdmapps, subject: string, attendeesNum: number, startDate: string, startTime: string, endDate: string, endTime: string, startDatetime: string, endDatetime: string) {

        const now = new Date();
        const start = new Date(startDatetime);
        const end = new Date(endDatetime);

        let validFlag = true;

        if(!subject){
            this.set('msgInvalidSubject', this.intl.t('integromat.meetingDialog.invalid.empty', {item: this.intl.t('integromat.subject')}));
            validFlag = false;
        }else{
            this.set('msgInvalidSubject', '');
        }

        if(!attendeesNum){
            this.set('msgInvalidAttendees', this.intl.t('integromat.meetingDialog.invalid.empty', {item: this.intl.t('integromat.attendees')}));
            validFlag = false;
        }else{
            this.set('msgInvalidAttendees', '');
        }

        if(!startDate || !startTime || !endDate || !endTime){
            this.set('msgInvalidDatetime', this.intl.t('integromat.meetingDialog.invalid.empty', {item: this.intl.t('integromat.datetime')}));
            validFlag = false;
        }else if(start < now){
            this.set('msgInvalidDatetime', this.intl.t('integromat.meetingDialog.invalid.datetime.past'));
            validFlag = false;
        }else if(end < start){
            this.set('msgInvalidDatetime', this.intl.t('integromat.meetingDialog.invalid.datetime.endBeforeStart'));
            validFlag = false;
        }else{
            this.set('msgInvalidDatetime', '');
        }
        return validFlag
    }

    @action
    createWebMeeting(this: GuidNodeGrdmapps) {
        if (!this.config) {
            throw new EmberError('Illegal config');
        }

        const config = this.config.content as GrdmappsConfigModel;
        const webhookUrl = this.webhookUrl;
        const node_id = config.node_settings_id;
        const appName = this.webMeetingAppName;
        const appNameDisp = this.webMeetingAppNameDisp;
        const guid = String(this.model.guid);
        const webMeetingSubject = this.webMeetingSubject;
        const webMeetingStartDate = moment(this.webMeetingStartDate).format('YYYY-MM-DD');
        const webMeetingStartTime = (<HTMLInputElement>document.querySelectorAll('select[id=create_teams_start_time]')[0]).value;
        const strWebMeetingStartDatetime = webMeetingStartDate + ' ' + webMeetingStartTime;
        const webMeetingEndDate = moment(this.webMeetingEndDate).format('YYYY-MM-DD');
        const webMeetingEndTime = (<HTMLInputElement>document.querySelectorAll('select[id=create_teams_end_time]')[0]).value;
        const strWebMeetingEndDatetime = webMeetingEndDate + ' ' + webMeetingEndTime;
        const webMeetingLocation = this.webMeetingLocation;
        const webMeetingContent = this.webMeetingContent;
        const microsoftTeamsAttendeesChecked = document.querySelectorAll('input[class=microsoftTeamsAttendeesCheck]:checked');
        const webexMeetingsAttendeesChecked = document.querySelectorAll('input[class=webexMeetingsAttendeesCheck]:checked');
        const empty = '';
        const timestamp = new Date().getTime();

        let action = '';
        let microsoftTeamsAttendeesCollectionAtCreate: microsoftTeamsAttendeeAtCreate[] = [];
        let microsoftTeamsAttendeesCollectionAtUpdate: microsoftTeamsAttendeeAtUpdate[] = [];
        let webexMeetingsAttendeesCollection: webexMeetingsAttendee[] = [];
        let arrayAttendees = [];

        let webexMeetingsCreateInvitees: webexMeetingsCreateInvitee[] = [];
        let webexMeetingsDeleteInviteeIds: string[] = [];

        let attendeeNum = 0;

        if (this.webMeetingAppName === config.app_name_microsoft_teams) {

            attendeeNum = microsoftTeamsAttendeesChecked.length;
        }else if (this.webMeetingAppName === config.app_name_webex_meetings) {

            attendeeNum = webexMeetingsAttendeesChecked.length;
        }
        //validation check for input
        if(!this.webMeetingvalidationCheck(webMeetingSubject, attendeeNum, this.webMeetingStartDate, webMeetingStartTime, this.webMeetingEndDate, webMeetingEndTime, strWebMeetingStartDatetime, strWebMeetingEndDatetime)){
            return;
        }

        //make attendees format
        if (this.webMeetingAppName === config.app_name_microsoft_teams) {

            action = 'createMicrosoftTeamsMeeting';

            for(let i = 0; i < microsoftTeamsAttendeesChecked.length; i++){ 
                microsoftTeamsAttendeesCollectionAtCreate.push({'emailAddress': {'address': microsoftTeamsAttendeesChecked[i].id}});
                arrayAttendees.push(microsoftTeamsAttendeesChecked[i].id);
            }
        }else if (this.webMeetingAppName === config.app_name_webex_meetings) {

            action = 'createWebexMeetings';

            for(let i = 0; i < webexMeetingsAttendeesChecked.length; i++){
                webexMeetingsAttendeesCollection.push({'email': webexMeetingsAttendeesChecked[i].id});
                arrayAttendees.push(webexMeetingsAttendeesChecked[i].id);
            }
        }

        const webMeetingStartDatetime = (new Date(strWebMeetingStartDatetime)).toISOString();
        const webMeetingEndDatetime = (new Date(strWebMeetingEndDatetime)).toISOString();

        const payload = {
            'nodeId': node_id,
            'appName': appName,
            'appNameDisp': appNameDisp,
            'guid': guid,
            'meetingId': empty,
            'joinUrl': empty,
            'action': action,
            'info': {
                "grdmScenarioStarted": infoGrdmScenarioStarted,
                'grdmScenarioCompleted': infoGrdmScenarioCompleted,
            },
            'error': {
                'webappsCreateMeeting': errorWebappsCreateMeeting,
                'grdmRegisterMeeting': errorGrdmRegisterMeeting,
                'slackCreateMeeting': errorSlackCreateMeeting,
                'webappsUpdateMeeting': errorWebappsUpdateMeeting,
                'webappsUpdateAttendees': errorWebappsUpdateAttendees,
                'webappsUpdateAttendeesGrdmMeetingReg' : errorWebappsUpdateAttendeesGrdmMeetingReg,
                'grdmUpdateMeetingReg': errorGrdmUpdateMeetingReg,
                'slackUpdateMeeting': errorSlackUpdateMeeting,
                'webappsDeleteMeeting': errorWebappsDeleteMeeting,
                'grdmDeleteMeetingReg': errorGrdmDeleteMeetingReg,
                'slackDeleteMeeting': errorSlackDeleteMeeting,
                'scenarioProcessing': errorScenarioProcessing,
            },
            'startDatetime': webMeetingStartDatetime,
            'endDatetime': webMeetingEndDatetime,
            'subject': webMeetingSubject,
            'microsoftTeamsAttendeesCollectionAtCreate': microsoftTeamsAttendeesCollectionAtCreate,
            'microsoftTeamsAttendeesCollectionAtUpdate': microsoftTeamsAttendeesCollectionAtUpdate,
            'webexMeetingsAttendeesCollection': webexMeetingsAttendeesCollection,
            'webexMeetingsCreateInvitees': webexMeetingsCreateInvitees,
            'webexMeetingsDeleteInviteeIds': webexMeetingsDeleteInviteeIds,
            'attendees': arrayAttendees,
            'location': webMeetingLocation,
            'content': webMeetingContent,
            'webhook_url': webhookUrl,
            'timestamp': timestamp,
        };

        this.setWebMeetingApp('', '');

        return this.reqLaunch(startIntegromatScenarioUrl, payload, appNameDisp);
    }

    @action
    makeUpdateMeetingDialog(this: GuidNodeGrdmapps, meetingPk: string, meetingId: string, joinUrl: string, meetingPassword: string, appId: string, subject: string, attendees:string[], startDatetime: string, endDatetime: string, location: string, content: string) {

        this.set('showUpdateWebMeetingDialog', true);

        if (!this.config) {
            throw new EmberError('Illegal config');
        }

        const config = this.config.content as GrdmappsConfigModel;
        const webMeetingApps = JSON.parse(config.web_meeting_apps);

        let appName = '';

        this.set('webMeetingPk', meetingPk);
        this.set('webMeetingSubject', subject);
        this.set('webMeetingAttendees', attendees);
        this.set('webMeetingStartDate', moment(startDatetime).format('YYYY/MM/DD'));
        this.set('webMeetingStartTime', moment(startDatetime).format('HH:mm'));
        this.set('webMeetingEndDate', moment(endDatetime).format('YYYY/MM/DD'));
        this.set('webMeetingEndTime', moment(endDatetime).format('HH:mm'));
        this.set('webMeetingLocation', location);
        this.set('webMeetingContent', content);
        this.set('webMeetingUpdateMeetingId', meetingId);
        this.set('webMeetingJoinUrl', joinUrl);
        this.set('webMeetingPassword', meetingPassword);

        for(let i=0; i < webMeetingApps.length; i++){

            if(webMeetingApps[i].pk === appId){
                appName = webMeetingApps[i].fields.app_name;
                break;
            }
        }

        this.setWebMeetingApp(appName, 'update');
        this.makeWebMeetingAttendee(appName, 'update');

    }

    makeWebMeetingAttendee(this: GuidNodeGrdmapps, appName: string, type: string) {

        if (!this.config) {
            throw new EmberError('Illegal config');
        }
        const config = this.config.content as GrdmappsConfigModel;

        const nodeMicrosoftTeamsAttendees = JSON.parse(config.node_microsoft_teams_attendees_all);
        const nodeWebexMeetingsAttendees = JSON.parse(config.node_microsoft_teams_attendees_all);

        this.webMeetingAttendeesNow.length = 0;
        this.notwebMeetingAttendeesNow.length = 0;

        if(appName === config.app_name_microsoft_teams){

            for(let j = 0; j < nodeMicrosoftTeamsAttendees.length; j++){

                if(type === 'update' && !(nodeMicrosoftTeamsAttendees[j].fields.microsoft_teams_mail)){
                    continue;
                }
                this.notwebMeetingAttendeesNow.push({'email': nodeMicrosoftTeamsAttendees[j].fields.microsoft_teams_mail, 'fullname': nodeMicrosoftTeamsAttendees[j].fields.fullname});

                for(let k = 0; k < this.webMeetingAttendees.length; k++){
                    if(nodeMicrosoftTeamsAttendees[j].pk === this.webMeetingAttendees[k]){
                        this.webMeetingAttendeesNow.push({'email': nodeMicrosoftTeamsAttendees[j].fields.microsoft_teams_mail, 'fullname': nodeMicrosoftTeamsAttendees[j].fields.fullname, 'profile': profileUrl + nodeMicrosoftTeamsAttendees[j].fields.user_guid});
                        this.notwebMeetingAttendeesNow.pop();
                        break;
                    }
                }
            }
        }else if(appName === config.app_name_webex_meetings){
            for(let l = 0; l < nodeWebexMeetingsAttendees.length; l++){

                if(type === 'update' && !(nodeWebexMeetingsAttendees[l].fields.webex_meetings_mail)){
                    continue;
                }
                this.notwebMeetingAttendeesNow.push({'email': nodeWebexMeetingsAttendees[l].fields.webex_meetings_mail, 'fullname': nodeWebexMeetingsAttendees[l].fields.fullname});

                for(let m = 0; m < this.webMeetingAttendees.length; m++){
                    if(nodeWebexMeetingsAttendees[l].pk === this.webMeetingAttendees[m]){
                        this.webMeetingAttendeesNow.push({'email': nodeWebexMeetingsAttendees[l].fields.webex_meetings_mail, 'fullname': nodeWebexMeetingsAttendees[l].fields.fullname, 'profile': profileUrl + nodeWebexMeetingsAttendees[l].fields.user_guid});
                        this.notwebMeetingAttendeesNow.pop();
                        break;
                    }
                }
            }
        }
    }

    @action
    setDefaultDate(this: GuidNodeGrdmapps) {
        (<any>$('#update_start_date')[0]).value = this.webMeetingStartDate;
        (<any>$('#update_end_date')[0]).value = this.webMeetingEndDate;
    }

    @action
    updateWebMeeting(this: GuidNodeGrdmapps) {
        if (!this.config) {
            throw new EmberError('Illegal config');
        }
        const config = this.config.content as GrdmappsConfigModel;
        const webhookUrl = this.webhookUrl;;
        const node_id = config.node_settings_id;
        const appName = this.webMeetingAppName;
        const appNameDisp = this.webMeetingAppNameDisp;
        const webMeetingSubject = this.webMeetingSubject;
        const webMeetingStartDate = moment(this.webMeetingStartDate).format('YYYY-MM-DD');
        const webMeetingStartTime = (<HTMLInputElement>document.querySelectorAll('select[id=update_start_time]')[0]).value;
        const strWebMeetingStartDatetime = webMeetingStartDate + ' ' + webMeetingStartTime;
        const webMeetingEndDate = moment(this.webMeetingEndDate).format('YYYY-MM-DD');
        const webMeetingEndTime = (<HTMLInputElement>document.querySelectorAll('select[id=update_end_time]')[0]).value;
        const strWebMeetingEndDatetime = webMeetingEndDate + ' ' + webMeetingEndTime;
        const webMeetingLocation = this.webMeetingLocation;
        const webMeetingContent = this.webMeetingContent;
        const webMeetingId = this.webMeetingUpdateMeetingId;
        const webMeetingJoinUrl = this.webMeetingJoinUrl;
        const webMeetingPassword = this.webMeetingPassword;
        const microsoftTeamsAttendeesChecked = document.querySelectorAll('input[class=microsoftTeamsAttendeesCheck]:checked');
        const webexMeetingsAttendeesChecked = document.querySelectorAll('input[class=webexMeetingsAttendeesCheck]:checked');
        const empty = '';
        const timestamp = new Date().getTime();

        const nodeWebMeetingAttendeesRelation =JSON.parse(config.node_web_meetings_attendees_relation)
        const nodeWebexMeetingsAttendees = JSON.parse(config.node_webex_meetings_attendees);

        let action = '';
        let microsoftTeamsAttendeesCollectionAtCreate: microsoftTeamsAttendeeAtCreate[] = [];
        let microsoftTeamsAttendeesCollectionAtUpdate: microsoftTeamsAttendeeAtUpdate[] = [];
        let webexMeetingsAttendeesCollection: webexMeetingsAttendee[] = [];
        let arrayAttendees = [];
        let arrayAttendeePks: string[] = [];

        let arrayCreateAttendeePks = [];
        let arrayDeleteAttendeePks = [];
        let webexMeetingsCreateInvitees: webexMeetingsCreateInvitee[] = [];
        let webexMeetingsDeleteInviteeIds: string[] = [];

        let attendeeNum = 0;

        if (this.webMeetingAppName === config.app_name_microsoft_teams) {

            attendeeNum = microsoftTeamsAttendeesChecked.length;
        }else if (this.webMeetingAppName === config.app_name_webex_meetings) {

            attendeeNum = webexMeetingsAttendeesChecked.length;
        }
        //validation check for input
        if(!this.webMeetingvalidationCheck(webMeetingSubject, attendeeNum, this.webMeetingStartDate, webMeetingStartTime, this.webMeetingEndDate, webMeetingEndTime, strWebMeetingStartDatetime, strWebMeetingEndDatetime)){
            return;
        }
        //make attendees format
        if (appName === config.app_name_microsoft_teams) {

            action = 'updateMicrosoftTeamsMeeting';

            for(let i = 0; i < microsoftTeamsAttendeesChecked.length; i++){ 
                microsoftTeamsAttendeesCollectionAtUpdate.push({'address': microsoftTeamsAttendeesChecked[i].id, 'name': 'Unregistered'});
                arrayAttendees.push(microsoftTeamsAttendeesChecked[i].id);
            }
        }else if (appName === config.app_name_webex_meetings) {

            action = 'updateWebexMeetings';

            for(let i = 0; i < webexMeetingsAttendeesChecked.length; i++){
                webexMeetingsAttendeesCollection.push({'email': webexMeetingsAttendeesChecked[i].id});
                arrayAttendees.push(webexMeetingsAttendeesChecked[i].id);

                for(let j = 0; j < nodeWebexMeetingsAttendees.length; j++){

                    if(webexMeetingsAttendeesChecked[i].id === nodeWebexMeetingsAttendees[j].fields.webex_meetings_mail){
                        arrayAttendeePks.push(nodeWebexMeetingsAttendees[j].pk);
                    }
                }
            }

            arrayCreateAttendeePks = arrayAttendeePks.filter(i => (this.webMeetingAttendees).indexOf(i) == -1)
            arrayDeleteAttendeePks = (this.webMeetingAttendees).filter(i => arrayAttendeePks.indexOf(i) == -1)

            for(let i = 0; i < arrayCreateAttendeePks.length; i++){
                for(let j = 0; j < nodeWebexMeetingsAttendees.length; j++){
                    if(arrayCreateAttendeePks[i] === nodeWebexMeetingsAttendees[j].pk){
                        webexMeetingsCreateInvitees.push({'email': nodeWebexMeetingsAttendees[j].fields.webex_meetings_mail});
                    }
                }
            }

            for(let i = 0; i < arrayDeleteAttendeePks.length; i++){
                for(let j = 0; j < nodeWebMeetingAttendeesRelation.length; j++){
                    if(this.webMeetingPk === nodeWebMeetingAttendeesRelation[j].fields.all_meeting_information){
                        if(arrayDeleteAttendeePks[i] === nodeWebMeetingAttendeesRelation[j].fields.attendees){

                            webexMeetingsDeleteInviteeIds.push(nodeWebMeetingAttendeesRelation[j].fields.webex_meetings_invitee_id);
                        }
                    }
                }
            }
        }

        const webMeetingStartDatetime = (new Date(strWebMeetingStartDatetime)).toISOString();
        const webMeetingEndDatetime = (new Date(strWebMeetingEndDatetime)).toISOString();

        const payload = {
            'nodeId': node_id,
            'appName': appName,
            'appNameDisp': appNameDisp,
            'guid': empty,
            'meetingId': webMeetingId,
            'joinUrl': webMeetingJoinUrl,
            'action': action,
            'info': {
                "grdmScenarioStarted": infoGrdmScenarioStarted,
                'grdmScenarioCompleted': infoGrdmScenarioCompleted,
            },
            'error': {
                'webappsCreateMeeting': errorWebappsCreateMeeting,
                'grdmRegisterMeeting': errorGrdmRegisterMeeting,
                'slackCreateMeeting': errorSlackCreateMeeting,
                'webappsUpdateMeeting': errorWebappsUpdateMeeting,
                'webappsUpdateAttendees': errorWebappsUpdateAttendees,
                'webappsUpdateAttendeesGrdmMeetingReg' : errorWebappsUpdateAttendeesGrdmMeetingReg,
                'grdmUpdateMeetingReg': errorGrdmUpdateMeetingReg,
                'slackUpdateMeeting': errorSlackUpdateMeeting,
                'webappsDeleteMeeting': errorWebappsDeleteMeeting,
                'grdmDeleteMeetingReg': errorGrdmDeleteMeetingReg,
                'slackDeleteMeeting': errorSlackDeleteMeeting,
                'scenarioProcessing': errorScenarioProcessing,
            },
            'startDatetime': webMeetingStartDatetime,
            'endDatetime': webMeetingEndDatetime,
            'subject': webMeetingSubject,
            'microsoftTeamsAttendeesCollectionAtCreate': microsoftTeamsAttendeesCollectionAtCreate,
            'microsoftTeamsAttendeesCollectionAtUpdate': microsoftTeamsAttendeesCollectionAtUpdate,
            'webexMeetingsAttendeesCollection': webexMeetingsAttendeesCollection,
            'webexMeetingsCreateInvitees': webexMeetingsCreateInvitees,
            'webexMeetingsDeleteInviteeIds': webexMeetingsDeleteInviteeIds,
            'attendees': arrayAttendees,
            'location': webMeetingLocation,
            'content': webMeetingContent,
            'password': webMeetingPassword,
            'webhook_url': webhookUrl,
            'timestamp': timestamp,
        };

        this.setWebMeetingApp('', '');

        return this.reqLaunch(startIntegromatScenarioUrl, payload, appName);
    }

    @action
    makeDeleteDialog(this: GuidNodeGrdmapps, meetingId: string, appId: string, subject: string, startDatetime: string, endDatetime: string) {

        if (!this.config) {
            throw new EmberError('Illegal config');
        }

        const config = this.config.content as GrdmappsConfigModel;
        const webMeetingApps = JSON.parse(config.web_meeting_apps);
        let appName = '';

        for(let i=0; i < webMeetingApps.length; i++){

            if(webMeetingApps[i].pk === appId){
                appName = webMeetingApps[i].fields.app_name
                break;
            }
        }

        this.setWebMeetingApp(appName, 'delete');

        this.set('showDeleteWebMeetingDialog', true);
        this.set('webMeetingDeleteMeetingId', meetingId);
        this.set('webMeetingDeleteSubject', subject);
        this.set('webMeetingDeleteStartDate', moment(startDatetime).format('YYYY/MM/DD'));
        this.set('webMeetingDeleteStartTime', moment(startDatetime).format('HH:mm'));
        this.set('webMeetingDeleteEndDate', moment(endDatetime).format('YYYY/MM/DD'));
        this.set('webMeetingDeleteEndTime', moment(endDatetime).format('HH:mm'));

    }

    @action
    deleteWebMeeting(this: GuidNodeGrdmapps) {

        if (!this.config) {
            throw new EmberError('Illegal config');
        }

        const config = this.config.content as GrdmappsConfigModel;
        const webhookUrl = this.webhookUrl;
        const nodeId = config.node_settings_id;
        const appName = this.webMeetingAppName;
        const appNameDisp = this.webMeetingAppNameDisp;
        const webMeetingSubject = this.webMeetingDeleteSubject;
        const strWebMeetingStartDatetime = this.webMeetingDeleteStartDate + ' ' + this.webMeetingDeleteStartTime;
        const strWebMeetingEndDatetime = this.webMeetingDeleteEndDate + ' ' + this.webMeetingDeleteEndTime;
        const timestamp = new Date().getTime();

        const empty = '';
        const emptyList : string[] = [];
        const microsoftTeamsAttendeesCollectionAtCreate: microsoftTeamsAttendeeAtCreate[] = [];
        const microsoftTeamsAttendeesCollectionAtUpdate: microsoftTeamsAttendeeAtUpdate[] = [];
        const webexMeetingsAttendeesCollection: webexMeetingsAttendee[] = [];

        let webexMeetingsCreateInvitees : webexMeetingsCreateInvitee[] = [];
        let webexMeetingsDeleteInviteeIds : string[] = [];

        let action = '';

        if (this.webMeetingAppName === config.app_name_microsoft_teams) {

            action = 'deleteMicrosoftTeamsMeeting';

        }else if (this.webMeetingAppName === config.app_name_webex_meetings) {

            action = 'deleteWebexMeetings';

        }

        const webMeetingStartDatetime = (new Date(strWebMeetingStartDatetime)).toISOString();
        const webMeetingEndDatetime = (new Date(strWebMeetingEndDatetime)).toISOString();

        const payload = {
            'nodeId': nodeId,
            'appName': appName,
            'appNameDisp': appNameDisp,
            'guid': empty,
            'meetingId': this.webMeetingDeleteMeetingId,
            'joinUrl': empty,
            'action': action,
            'info': {
                "grdmScenarioStarted": infoGrdmScenarioStarted,
                'grdmScenarioCompleted': infoGrdmScenarioCompleted,
            },
            'error': {
                'webappsCreateMeeting': errorWebappsCreateMeeting,
                'grdmRegisterMeeting': errorGrdmRegisterMeeting,
                'slackCreateMeeting': errorSlackCreateMeeting,
                'webappsUpdateMeeting': errorWebappsUpdateMeeting,
                'webappsUpdateAttendees': errorWebappsUpdateAttendees,
                'webappsUpdateAttendeesGrdmMeetingReg' : errorWebappsUpdateAttendeesGrdmMeetingReg,
                'grdmUpdateMeetingReg': errorGrdmUpdateMeetingReg,
                'slackUpdateMeeting': errorSlackUpdateMeeting,
                'webappsDeleteMeeting': errorWebappsDeleteMeeting,
                'grdmDeleteMeetingReg': errorGrdmDeleteMeetingReg,
                'slackDeleteMeeting': errorSlackDeleteMeeting,
                'scenarioProcessing': errorScenarioProcessing,
            },
            'startDatetime': webMeetingStartDatetime,
            'endDatetime': webMeetingEndDatetime,
            'subject': webMeetingSubject,
            'microsoftTeamsAttendeesCollectionAtCreate': microsoftTeamsAttendeesCollectionAtCreate,
            'microsoftTeamsAttendeesCollectionAtUpdate': microsoftTeamsAttendeesCollectionAtUpdate,
            'webexMeetingsAttendeesCollection': webexMeetingsAttendeesCollection,
            'webexMeetingsCreateInvitees': webexMeetingsCreateInvitees,
            'webexMeetingsDeleteInviteeIds': webexMeetingsDeleteInviteeIds,
            'attendees': emptyList,
            'location': empty,
            'content': empty,
            'webhook_url': webhookUrl,
            'timestamp': timestamp,
        };

        this.setWebMeetingApp('', '');

        return this.reqLaunch(startIntegromatScenarioUrl, payload, appNameDisp);
    }

    @action
    makeDetailMeetingDialog(this: GuidNodeGrdmapps, meetingPk: string, meetingId: string, joinUrl: string, appId: string, subject: string, organizer_fullname: string, attendees:string[], startDatetime: string, endDatetime: string, location: string, content: string) {

        this.set('showDetailWebMeetingDialog', true);

        if (!this.config) {
            throw new EmberError('Illegal config');
        }

        const config = this.config.content as GrdmappsConfigModel;
        const webMeetingApps = JSON.parse(config.web_meeting_apps);

        let appName = '';

        this.set('webMeetingPk', meetingPk);
        this.set('webMeetingSubject', subject);
        this.set('webMeetingOrganizerFullname', organizer_fullname);
        this.set('webMeetingAttendees', attendees);
        this.set('webMeetingStartDate', moment(startDatetime).format('YYYY/MM/DD'));
        this.set('webMeetingStartTime', moment(startDatetime).format('HH:mm'));
        this.set('webMeetingEndDate', moment(endDatetime).format('YYYY/MM/DD'));
        this.set('webMeetingEndTime', moment(endDatetime).format('HH:mm'));
        this.set('webMeetingLocation', location);
        this.set('webMeetingContent', content);
        this.set('webMeetingUpdateMeetingId', meetingId);
        this.set('webMeetingJoinUrl', joinUrl);

        for(let i=0; i < webMeetingApps.length; i++){

            if(webMeetingApps[i].pk === appId){
                appName = webMeetingApps[i].fields.app_name;
                break;
            }
        }

        this.setWebMeetingApp(appName, 'detail');
        this.makeWebMeetingAttendee(appName, 'detail');
    }

    reqLaunch(url: string, payload: payload, appName: string){

        this.toast.info(this.intl.t('integromat.info.launch'))
        const headers = this.currentUser.ajaxHeaders();
        url = startIntegromatScenarioUrl.replace('{}', String(this.model.guid));

        return fetch(
            url,
            {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
        })
        .then(res => {
            if(!res.ok){
                this.toast.error(this.intl.t('integromat.error.failedToRequest'));
                return;
            }
            return res.json()
        })
        .then(data => {
            let reqBody = {
                'count': 1,
                'nodeId': data.nodeId,
                'timestamp': data.timestamp,
            }
            this.reqMessage(reqestMessagesUrl, reqBody, appName)
        })
        .catch(() => {
            this.toast.error(this.intl.t('integromat.error.failedToRequest'));
        })
    }

    reqMessage(url: string, reqBody: reqBody, appName: string) {

        const headers = this.currentUser.ajaxHeaders();
        url = reqestMessagesUrl.replace('{}', String(this.model.guid));

        return fetch(
            url,
            {
                method: 'POST',
                headers,
                body: JSON.stringify(reqBody)
        })
        .then(res => {
            if(!res.ok){
                this.toast.error(this.intl.t('integromat.error.failedToGetMessage'));
                return;
            }
            return res.json()
        })
        .then(data => {
            if(data.integromatMsg === 'integromat.info.completed'){
                this.toast.info(this.intl.t(data.integromatMsg));
                this.save();
            }else if(data.integromatMsg.match('.error.')){
                this.toast.error(this.intl.t(data.integromatMsg, {appName: appName}));
                this.save();
            }else{
                if(data.notify){
                    this.toast.info(this.intl.t(data.integromatMsg));
                }
                let reqBody = {
                    'count': data.count + 1,
                    'nodeId': data.nodeId,
                    'timestamp': data.timestamp
                }
                if(reqBody.count < TIME_LIMIT_EXECUTION_SCENARIO + 1){
                    this.reqMessage(url, reqBody, appName)
                }
            }
        })
        .catch(() => {
            this.toast.error(this.intl.t('integromat.error.failedToGetMessage'));
        })
    }

    @computed('config.all_web_meetings')
    get all_web_meetings() {
        if (!this.config) {
            return '';
        }
        const config = this.config.content as GrdmappsConfigModel;
        const all_web_meetings = JSON.parse(config.all_web_meetings);
        return all_web_meetings;
    }

    @computed('config.upcoming_web_meetings')
    get upcoming_web_meetings() {
        if (!this.config) {
            return '';
        }
        const config = this.config.content as GrdmappsConfigModel;
        let upcoming_web_meetings = JSON.parse(config.upcoming_web_meetings);
        let web_meeting_apps = JSON.parse(config.web_meeting_apps);

        let previousDatetime;
        let currentDatetime;
        let previousDate = '';
        let currentDate = '';

        for(let i = 0; i < upcoming_web_meetings.length; i++){

            //for display App Name on meeting list
            for(let j = 0; j < web_meeting_apps.length; j++){
                if(upcoming_web_meetings[i].fields.app === web_meeting_apps[j].pk){
                    upcoming_web_meetings[i]['app_name_disp'] = this.camel2space(web_meeting_apps[j].fields.app_name);
                    break;
                }
            }

            //for display Date Bar
            if(i === 0){
                upcoming_web_meetings[i]['date_bar'] = false;
            }else if(i !== 0){

                previousDatetime =new Date(upcoming_web_meetings[i-1].fields.start_datetime);
                currentDatetime =new Date(upcoming_web_meetings[i].fields.start_datetime);

                previousDate = previousDatetime.getFullYear() + '/' + (previousDatetime.getMonth() + 1) + '/' + previousDatetime.getDate();
                currentDate = currentDatetime.getFullYear() + '/' + (currentDatetime.getMonth() + 1) + '/' + currentDatetime.getDate();

                if(currentDate != previousDate){
                    upcoming_web_meetings[i]['date_bar'] = true;
                }else{
                    upcoming_web_meetings[i]['date_bar'] = false;
                }
            }
        }
        return upcoming_web_meetings;
    }

    @computed('config.previous_web_meetings')
    get previous_web_meetings() {
        if (!this.config) {
            return '';
        }
        const config = this.config.content as GrdmappsConfigModel;
        let previous_web_meetings = JSON.parse(config.previous_web_meetings);
        let web_meeting_apps = JSON.parse(config.web_meeting_apps);

        let currentDatetime;
        let nextDatetime;
        let nextDate = '';
        let currentDate = '';

        for(let i = 0; i < previous_web_meetings.length; i++){

            //for display App Name on meeting list
            for(let j = 0; j < web_meeting_apps.length; j++){
                if(previous_web_meetings[i].fields.app === web_meeting_apps[j].pk){
                    previous_web_meetings[i]['app_name_disp'] = this.camel2space(web_meeting_apps[j].fields.app_name);
                    break;
                }
            }

            if(i === 0){
                previous_web_meetings[i]['date_bar'] = false;
            }else if(i !== 0){

                nextDatetime = new Date(previous_web_meetings[i-1].fields.start_datetime);
                currentDatetime = new Date(previous_web_meetings[i].fields.start_datetime);

                nextDate = nextDatetime.getFullYear() + '/' + (nextDatetime.getMonth() + 1) + '/' + nextDatetime.getDate();
                currentDate = currentDatetime.getFullYear() + '/' + (currentDatetime.getMonth() + 1) + '/' + currentDatetime.getDate();

                if(currentDate != nextDate){
                    previous_web_meetings[i]['date_bar'] = true;
                }else{
                    previous_web_meetings[i]['date_bar'] = false;
                }
            }
        }

        return previous_web_meetings;
    }

    @computed('config.node_microsoft_teams_attendees')
    get node_microsoft_teams_attendees() {
        if (!this.config) {
            return '';
        }
        const config = this.config.content as GrdmappsConfigModel;
        const node_microsoft_teams_attendees = JSON.parse(config.node_microsoft_teams_attendees);
        return node_microsoft_teams_attendees;
    }

    @computed('config.node_webex_meetings_attendees')
    get node_webex_meetings_attendees() {
        if (!this.config) {
            return '';
        }
        const config = this.config.content as GrdmappsConfigModel;
        const node_webex_meetings_attendees = JSON.parse(config.node_webex_meetings_attendees);
        return node_webex_meetings_attendees;
    }

    @computed('config.workflows')
    get workflows() {
        if (!this.config) {
            return '';
        }
        const config = this.config.content as GrdmappsConfigModel;
        const workflows = JSON.parse(config.workflows);
        return workflows;
    }

    @computed('config.web_meeting_apps')
    get web_meeting_apps() {
        if (!this.config) {
            return '';
        }
        const config = this.config.content as GrdmappsConfigModel;
        const web_meeting_apps = JSON.parse(config.web_meeting_apps);

        for(let i = 0; i< web_meeting_apps.length; i++){

            web_meeting_apps[i]['app_name_disp'] = this.camel2space(web_meeting_apps[i].fields.app_name)
        }

        return web_meeting_apps;
    }

    @computed('node')
    get config(): DS.PromiseObject<GrdmappsConfigModel> | undefined {
        if (this.configCache) {
            return this.configCache;
        }
        if (!this.node) {
            return undefined;
        }
        this.configCache = this.store.findRecord('grdmapps-config', this.node.id);
        return this.configCache!;
    }
}

declare module '@ember/controller' {
    interface Registry {
        'guid-node/grdmapps': GuidNodeGrdmapps;
    }
}