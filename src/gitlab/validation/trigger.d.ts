import { GitLabWebhookEvent, GitLabActionConfig, TriggerResult } from '../types.js';
export declare class GitLabTriggerValidator {
    private config;
    constructor(config: GitLabActionConfig);
    validateTrigger(event: GitLabWebhookEvent): TriggerResult;
    private validateNoteEvent;
    private validateIssueEvent;
    private validateMergeRequestEvent;
    private containsTriggerPhrase;
    private isBotUser;
    validateDirectTrigger(projectId: number, resourceType: 'issue' | 'merge_request', resourceId: number, prompt: string, userId?: number): TriggerResult;
    validatePipelineTrigger(triggerData: string): TriggerResult;
}
