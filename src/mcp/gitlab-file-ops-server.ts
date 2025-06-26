#!/usr/bin/env node
// GitLab File Operations MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "fs/promises";
import { join } from "path";
import fetch from "node-fetch";
import { GitLabAPIClient } from "../gitlab/api/client.js";
import { GitLabConfig } from "../gitlab/types.js";

// Get repository information from environment variables
const PROJECT_ID = process.env.PROJECT_ID;
const BRANCH_NAME = process.env.BRANCH_NAME;
const REPO_DIR = process.env.REPO_DIR || process.cwd();
const GITLAB_URL = process.env.GITLAB_URL;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;

if (!PROJECT_ID || !BRANCH_NAME || !GITLAB_URL || !GITLAB_TOKEN) {
  console.error(
    "Error: PROJECT_ID, BRANCH_NAME, GITLAB_URL, and GITLAB_TOKEN environment variables are required",
  );
  process.exit(1);
}

const config: GitLabConfig = {
  url: GITLAB_URL,
  token: GITLAB_TOKEN,
};

const gitlabClient = new GitLabAPIClient(config);

const server = new McpServer({
  name: "GitLab File Operations Server",
  version: "0.0.1",
});

// Commit files tool
server.tool(
  "commit_files",
  "Commit one or more files to a GitLab repository in a single commit (this will commit them atomically in the remote repository)",
  {
    files: z
      .array(z.string())
      .describe(
        'Array of file paths relative to repository root (e.g. ["src/main.js", "README.md"]). All files must exist locally.',
      ),
    message: z.string().describe("Commit message"),
  },
  async ({ files, message }) => {
    const projectId = parseInt(PROJECT_ID!, 10);
    const branch = BRANCH_NAME!;
    
    try {
      const processedFiles = files.map((filePath) => {
        if (filePath.startsWith("/")) {
          return filePath.slice(1);
        }
        return filePath;
      });

      // Read all files and prepare commit actions
      const actions = await Promise.all(
        processedFiles.map(async (filePath) => {
          const fullPath = filePath.startsWith("/")
            ? filePath
            : join(REPO_DIR, filePath);

          const content = await readFile(fullPath, "utf-8");
          
          // Check if file exists in repository to determine action
          let action: 'create' | 'update' = 'create';
          try {
            await gitlabClient.getFile(projectId, filePath, branch);
            action = 'update';
          } catch (error) {
            // File doesn't exist, will create
            action = 'create';
          }

          return {
            action,
            file_path: filePath,
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64' as const,
          };
        }),
      );

      // Create the commit with all file changes
      const commit = await gitlabClient.createCommit(
        projectId,
        branch,
        message,
        actions,
      );

      const simplifiedResult = {
        commit: {
          id: commit.id,
          short_id: commit.short_id,
          message: commit.message,
          author_name: commit.author_name,
          authored_date: commit.authored_date,
          web_url: commit.web_url,
        },
        files: processedFiles.map((path) => ({ path })),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(simplifiedResult, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Delete files tool
server.tool(
  "delete_files",
  "Delete one or more files from a GitLab repository in a single commit",
  {
    files: z
      .array(z.string())
      .describe(
        'Array of file paths to delete relative to repository root (e.g. ["src/old-file.js", "docs/deprecated.md"])',
      ),
    message: z.string().describe("Commit message"),
  },
  async ({ files, message }) => {
    const projectId = parseInt(PROJECT_ID!, 10);
    const branch = BRANCH_NAME!;
    
    try {
      // Convert absolute paths to relative if they match CWD
      const cwd = process.cwd();
      const processedPaths = files.map((filePath) => {
        if (filePath.startsWith("/")) {
          if (filePath.startsWith(cwd)) {
            // Strip CWD from absolute path
            return filePath.slice(cwd.length + 1);
          } else {
            throw new Error(
              `Path '${filePath}' must be relative to repository root or within current working directory`,
            );
          }
        }
        return filePath;
      });

      // Create delete actions for all files
      const actions = processedPaths.map((filePath) => ({
        action: 'delete' as const,
        file_path: filePath,
      }));

      // Create the commit with all file deletions
      const commit = await gitlabClient.createCommit(
        projectId,
        branch,
        message,
        actions,
      );

      const simplifiedResult = {
        commit: {
          id: commit.id,
          short_id: commit.short_id,
          message: commit.message,
          author_name: commit.author_name,
          authored_date: commit.authored_date,
          web_url: commit.web_url,
        },
        deletedFiles: processedPaths.map((path) => ({ path })),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(simplifiedResult, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Update Claude comment tool
server.tool(
  "update_claude_comment",
  "Update the Claude comment with progress and results (automatically handles both issue and MR comments)",
  {
    body: z.string().describe("The updated comment content"),
  },
  async ({ body }) => {
    try {
      const claudeCommentId = process.env.CLAUDE_COMMENT_ID;
      const resourceType = process.env.RESOURCE_TYPE; // 'issue' or 'merge_request'
      const resourceIid = process.env.RESOURCE_IID;

      if (!claudeCommentId) {
        throw new Error("CLAUDE_COMMENT_ID environment variable is required");
      }
      if (!resourceType) {
        throw new Error("RESOURCE_TYPE environment variable is required");
      }
      if (!resourceIid) {
        throw new Error("RESOURCE_IID environment variable is required");
      }

      const projectId = parseInt(PROJECT_ID!, 10);
      const commentId = parseInt(claudeCommentId, 10);
      const resourceIidInt = parseInt(resourceIid, 10);

      let result;
      if (resourceType === 'issue') {
        result = await gitlabClient.updateIssueNote(
          projectId,
          resourceIidInt,
          commentId,
          body
        );
      } else if (resourceType === 'merge_request') {
        result = await gitlabClient.updateMergeRequestNote(
          projectId,
          resourceIidInt,
          commentId,
          body
        );
      } else {
        throw new Error(`Unknown resource type: ${resourceType}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: result.id,
              body: result.body,
              updated_at: result.updated_at,
              author: result.author.username,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("exit", () => {
    server.close();
  });
}

runServer().catch(console.error);