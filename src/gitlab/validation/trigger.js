export class GitLabTriggerValidator {
    config;
    constructor(config) {
        this.config = config;
    }
    validateTrigger(event) {
        const result = {
            shouldTrigger: false,
            triggerType: null,
            resourceType: null,
            resourceId: null,
            projectId: event.project.id,
            triggeredBy: event.user,
        };
        // Check if this is a bot or system user
        if (this.isBotUser(event.user)) {
            return result;
        }
        switch (event.object_kind) {
            case 'note':
                return this.validateNoteEvent(event, result);
            case 'issue':
                return this.validateIssueEvent(event, result);
            case 'merge_request':
                return this.validateMergeRequestEvent(event, result);
            default:
                return result;
        }
    }
    validateNoteEvent(event, result) {
        const note = event.object_attributes;
        // Skip system notes
        if (note.system) {
            return result;
        }
        // Check for trigger phrase in note body
        if (this.containsTriggerPhrase(note.note)) {
            result.shouldTrigger = true;
            result.triggerType = 'comment';
            result.triggerComment = {
                id: note.id,
                body: note.note,
                author: event.user,
                created_at: note.created_at,
                updated_at: note.updated_at,
                system: note.system,
                noteable_type: note.noteable_type,
                noteable_id: note.noteable_id,
            };
            if (note.noteable_type === 'Issue' && event.issue) {
                result.resourceType = 'issue';
                result.resourceId = event.issue.iid;
            }
            else if (note.noteable_type === 'MergeRequest' && event.merge_request) {
                result.resourceType = 'merge_request';
                result.resourceId = event.merge_request.iid;
            }
        }
        return result;
    }
    validateIssueEvent(event, result) {
        const issue = event.object_attributes;
        // Check for assignee trigger
        if (this.config.assigneeTrigger && event.assignees) {
            const hasAssigneeTrigger = event.assignees.some(assignee => assignee.username === this.config.assigneeTrigger);
            if (hasAssigneeTrigger) {
                result.shouldTrigger = true;
                result.triggerType = 'assignee';
                result.resourceType = 'issue';
                result.resourceId = issue.iid;
                return result;
            }
        }
        // Check for label trigger
        if (this.config.labelTrigger && event.labels) {
            const hasLabelTrigger = event.labels.some(label => label.title === this.config.labelTrigger);
            if (hasLabelTrigger) {
                result.shouldTrigger = true;
                result.triggerType = 'label';
                result.resourceType = 'issue';
                result.resourceId = issue.iid;
                return result;
            }
        }
        // Check for trigger phrase in title or description (for new issues)
        if (issue.state === 'opened') {
            const hasPhrase = this.containsTriggerPhrase(issue.title) ||
                this.containsTriggerPhrase(issue.description || '');
            if (hasPhrase) {
                result.shouldTrigger = true;
                result.triggerType = 'comment';
                result.resourceType = 'issue';
                result.resourceId = issue.iid;
            }
        }
        return result;
    }
    validateMergeRequestEvent(event, result) {
        const mr = event.object_attributes;
        // Check for assignee trigger
        if (this.config.assigneeTrigger && event.assignees) {
            const hasAssigneeTrigger = event.assignees.some(assignee => assignee.username === this.config.assigneeTrigger);
            if (hasAssigneeTrigger) {
                result.shouldTrigger = true;
                result.triggerType = 'assignee';
                result.resourceType = 'merge_request';
                result.resourceId = mr.iid;
                return result;
            }
        }
        // Check for label trigger
        if (this.config.labelTrigger && event.labels) {
            const hasLabelTrigger = event.labels.some(label => label.title === this.config.labelTrigger);
            if (hasLabelTrigger) {
                result.shouldTrigger = true;
                result.triggerType = 'label';
                result.resourceType = 'merge_request';
                result.resourceId = mr.iid;
                return result;
            }
        }
        // Check for trigger phrase in title or description (for new MRs)
        if (mr.state === 'opened') {
            const hasPhrase = this.containsTriggerPhrase(mr.title) ||
                this.containsTriggerPhrase(mr.description || '');
            if (hasPhrase) {
                result.shouldTrigger = true;
                result.triggerType = 'comment';
                result.resourceType = 'merge_request';
                result.resourceId = mr.iid;
            }
        }
        return result;
    }
    containsTriggerPhrase(text) {
        if (!text)
            return false;
        const normalizedText = text.toLowerCase();
        const normalizedPhrase = this.config.triggerPhrase.toLowerCase();
        // Check for exact phrase match or mention-style match
        return normalizedText.includes(normalizedPhrase) ||
            normalizedText.includes(`@${normalizedPhrase.replace('@', '')}`);
    }
    isBotUser(user) {
        // Common bot user patterns
        const botPatterns = [
            /bot$/i,
            /\[bot\]$/i,
            /^gitlab-/i,
            /^github-/i,
            /service$/i,
            /automation$/i,
        ];
        return botPatterns.some(pattern => pattern.test(user.username)) ||
            botPatterns.some(pattern => pattern.test(user.name || ''));
    }
    // Validate direct trigger (for programmatic invocation)
    validateDirectTrigger(projectId, resourceType, resourceId, prompt, userId) {
        return {
            shouldTrigger: true,
            triggerType: 'direct',
            resourceType,
            resourceId,
            projectId,
            triggeredBy: userId ? { id: userId, username: 'direct', name: 'Direct Trigger' } : null,
        };
    }
    // Validate CI/CD pipeline trigger
    validatePipelineTrigger(triggerData) {
        try {
            const data = JSON.parse(triggerData);
            return {
                shouldTrigger: true,
                triggerType: data.triggerType || 'direct',
                resourceType: data.resourceType,
                resourceId: data.resourceId,
                projectId: data.projectId,
                triggeredBy: data.triggeredBy || null,
            };
        }
        catch (error) {
            return {
                shouldTrigger: false,
                triggerType: null,
                resourceType: null,
                resourceId: null,
                projectId: null,
                triggeredBy: null,
            };
        }
    }
}
