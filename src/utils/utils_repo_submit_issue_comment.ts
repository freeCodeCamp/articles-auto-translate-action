
import { context } from '@actions/github';
import { Octokit } from '@octokit/rest';
import { main_options } from '..';
import { compareTwoStrings } from 'string-similarity';

export class utils_repo_submit_issue_comment_options extends main_options {
    str_comment: string;
}
/**
 * Submits a comment to a GitHub issue.
 * @param options - The options for submitting the comment.
 * @returns A promise that resolves when the comment is submitted.
 * @throws An error if the GitHub token is not provided.
 */
export async function utils_repo_submit_issue_comment(options: utils_repo_submit_issue_comment_options) {

    const { str_comment, with_github_token } = options;

    if (!with_github_token) throw new Error('GitHub token was not found');

    const octokit = new Octokit({ auth: with_github_token });
    const { issue, repository } = context.payload;

    if (issue && repository) {
        // Check if the previous comment exists
        const { data: comments } = await octokit.issues.listComments({
            owner: repository.owner.login,
            repo: repository.name,
            issue_number: issue.number
        });
        // console.log('comments:', comments);
        const str_latest_comment_body = comments[comments.length - 1]?.body || '';
        const similar = compareTwoStrings(str_latest_comment_body, str_comment);
        console.log('similar:', similar);
        // If the previous comment is similar to the current comment, overwrite it.
        if (similar > 0.6) {
            await octokit.issues.updateComment({
                owner: repository.owner.login,
                repo: repository.name,
                body: str_comment,
                comment_id: comments[comments.length - 1].id
            });
        } else {
            await octokit.issues.createComment({
                owner: repository.owner.login,
                repo: repository.name,
                body: str_comment,
                issue_number: issue.number
            });
        }
    }
}