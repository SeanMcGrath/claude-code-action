export type GitLabUser = {
    id: number;
    username: string;
    name: string;
    email?: string;
    avatar_url?: string;
};
export type GitLabProject = {
    id: number;
    name: string;
    path: string;
    path_with_namespace: string;
    default_branch: string;
    web_url: string;
};
export type GitLabNote = {
    id: number;
    body: string;
    author: GitLabUser;
    created_at: string;
    updated_at: string;
    system: boolean;
    noteable_type: string;
    noteable_id: number;
};
export type GitLabIssue = {
    id: number;
    iid: number;
    title: string;
    description: string;
    state: 'opened' | 'closed';
    created_at: string;
    updated_at: string;
    author: GitLabUser;
    assignees: GitLabUser[];
    labels: string[];
    web_url: string;
    project_id: number;
};
export type GitLabMergeRequest = {
    id: number;
    iid: number;
    title: string;
    description: string;
    state: 'opened' | 'closed' | 'merged';
    created_at: string;
    updated_at: string;
    author: GitLabUser;
    assignees: GitLabUser[];
    labels: string[];
    source_branch: string;
    target_branch: string;
    sha: string;
    web_url: string;
    project_id: number;
    changes_count?: string;
    merge_status?: string;
};
export type GitLabCommit = {
    id: string;
    short_id: string;
    title: string;
    message: string;
    author_name: string;
    author_email: string;
    authored_date: string;
    committer_name: string;
    committer_email: string;
    committed_date: string;
    web_url: string;
};
export type GitLabFile = {
    file_name: string;
    file_path: string;
    size: number;
    encoding: string;
    content_sha256: string;
    ref: string;
    blob_id: string;
    commit_id: string;
    last_commit_id: string;
    content?: string;
};
export type GitLabDiff = {
    old_path: string;
    new_path: string;
    a_mode: string;
    b_mode: string;
    new_file: boolean;
    renamed_file: boolean;
    deleted_file: boolean;
    diff: string;
};
export type GitLabBranch = {
    name: string;
    commit: GitLabCommit;
    merged: boolean;
    protected: boolean;
    developers_can_push: boolean;
    developers_can_merge: boolean;
    can_push: boolean;
    default: boolean;
    web_url: string;
};
export type GitLabWebhookEvent = {
    object_kind: 'note' | 'issue' | 'merge_request' | 'push' | 'tag_push';
    event_type?: string;
    user: GitLabUser;
    project: GitLabProject;
    repository?: {
        name: string;
        url: string;
        description: string;
        homepage: string;
    };
    object_attributes?: any;
    changes?: any;
    assignees?: GitLabUser[];
    labels?: Array<{
        id: number;
        title: string;
        color: string;
    }>;
};
export type GitLabNoteEvent = GitLabWebhookEvent & {
    object_kind: 'note';
    object_attributes: {
        id: number;
        note: string;
        noteable_type: 'Issue' | 'MergeRequest';
        author_id: number;
        created_at: string;
        updated_at: string;
        project_id: number;
        attachment?: string;
        line_code?: string;
        commit_id?: string;
        noteable_id: number;
        system: boolean;
        st_diff?: any;
        url: string;
    };
    issue?: GitLabIssue;
    merge_request?: GitLabMergeRequest;
};
export type GitLabIssueEvent = GitLabWebhookEvent & {
    object_kind: 'issue';
    object_attributes: GitLabIssue;
};
export type GitLabMergeRequestEvent = GitLabWebhookEvent & {
    object_kind: 'merge_request';
    object_attributes: GitLabMergeRequest;
};
export type GitLabConfig = {
    url: string;
    token: string;
    projectId?: number;
    webhookSecret?: string;
};
export type GitLabActionConfig = {
    triggerPhrase: string;
    assigneeTrigger?: string;
    labelTrigger?: string;
    baseBranch: string;
    branchPrefix: string;
    maxTurns: number;
    timeoutMinutes: number;
    claudeModel: string;
    anthropicApiKey?: string;
    customInstructions?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    useBedrock?: boolean;
    useVertex?: boolean;
};
export type TriggerResult = {
    shouldTrigger: boolean;
    triggerType: 'comment' | 'assignee' | 'label' | 'direct' | null;
    resourceType: 'issue' | 'merge_request' | null;
    resourceId: number | null;
    projectId: number | null;
    triggerComment?: GitLabNote;
    triggeredBy: GitLabUser | null;
};
export type GitLabContext = {
    project: GitLabProject;
    issue?: GitLabIssue;
    mergeRequest?: GitLabMergeRequest;
    notes: GitLabNote[];
    triggerResult: TriggerResult;
    files?: GitLabFile[];
    commits?: GitLabCommit[];
    diffs?: GitLabDiff[];
};
