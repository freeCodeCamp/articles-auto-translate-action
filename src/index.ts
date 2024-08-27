import { getInput } from '@actions/core';
import { context } from '@actions/github';
import { utils_repo_submit_issue_comment } from './utils/utils_repo_submit_issue_comment';
import { task_auto_translate_step_01B_read_article } from './tasks/task_auto_translate_step_01B_read_article';
import { task_auto_translate_step_02_trans_articles } from './tasks/task_auto_translate_step_02_trans_articles';
import { join } from 'path';

export class main_options {
  with_issue_title = getInput('with_issue_title')
  with_issue_body = getInput('with_issue_body')
  with_label_name = getInput('with_label_name')
  with_github_token = getInput('with_github_token')
  with_task_fetch_and_save_force = 'true' === getInput('with_task_fetch_and_save_force')
  with_task_fetch_to_save_path = getInput('with_task_fetch_to_save_path')
  with_task_fetch_to_include_selector = getInput('with_task_fetch_to_include_selector')
  with_task_fetch_to_ignore_selector = getInput('with_task_fetch_to_ignore_selector')
  with_task_translate_openai_api_key = getInput('with_task_translate_openai_api_key')
  with_task_translate_to_save_path = getInput('with_task_translate_to_save_path')
  with_orginal_markdown_file_path = getInput('with_orginal_markdown_file_path')

  step_01_result_metas: any[] = []
  step_01_result_mdfiles: string[] = []
  step_02_result_mdfiles: string[] = []
  str_comment = ''
}

function gen_issue_comment(meta, repo, ref, raw_file, translated_file) {
  return `
- Original URL: [${meta.title}](${meta.originalURL})
- Original author: [${meta.author || 'anonymous'}](${meta.authorURL})
- Markdown file: [click to view](https://github.com/${repo.owner}/${repo.repo}/blob/${join(ref.replace(/^refs\/heads\//, ''), raw_file)})
- Translated file: [click to edit](https://github.com/${repo.owner}/${repo.repo}/edit/${join(ref.replace(/^refs\/heads\//, ''), translated_file)})
- Open in github.dev editor: [click to open github.dev](https://github.dev/${repo.owner}/${repo.repo}/blob/${join(ref.replace(/^refs\/heads\//, ''), translated_file)})
`;

}
async function main() {
  const options = Object.assign(new main_options(), {});
  console.log('Print all options:', options);

  // Run this workflow only if this workflow was triggered by adding the `auto` label
  const { with_label_name } = options;
  console.log('label:', with_label_name)
  if (!(with_label_name.toLowerCase() === 'auto')) {
    console.log("The workflow wasn't triggered by the 'auto' label. Skipping the auto translate action.")
    return;
  };

  let str_task_result = '';

  // Read the meta from the original markdown file
  await task_auto_translate_step_01B_read_article(options);
  await task_auto_translate_step_02_trans_articles(options);

  const count_raw_article = options.step_01_result_mdfiles.length;
  const count_translated_article = options.step_02_result_mdfiles.length;
  if (count_translated_article !== count_raw_article) {
    throw new Error('The number of translated articles is not equal to the number of raw articles');
  }
  let str_comment = `🚀 **Auto Translate**`;
  if (count_raw_article > 1) {
    str_comment += `\n\n📚 **Articles**: ${count_raw_article}`;
    for (let i = 0; i < count_raw_article; i++) {
      str_comment += `==========${i - 1}==========\n\n`;
      str_comment += gen_issue_comment(
        options.step_01_result_metas[i],
        context.repo, context.ref,
        options.step_01_result_mdfiles[i],
        options.step_02_result_mdfiles[i]
      );
      str_comment += '\n\n';
    }
  } else {
    str_comment = gen_issue_comment(
      options.step_01_result_metas[0],
      context.repo, context.ref,
      options.step_01_result_mdfiles[0],
      options.step_02_result_mdfiles[0]
    );
  }
  str_task_result += str_comment;

  Object.assign(options, { str_comment: str_task_result });
  await utils_repo_submit_issue_comment(options);
  return;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .then(() => { })
  .finally(() => { console.log('Done'); });
