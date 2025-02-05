import OpenAI from "openai";
import { main_options } from "..";
import { debug } from "@actions/core";
import { ensureFile, readFile, writeFile } from "fs-extra";

// We are using ISO 639-1 language codes here https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
// simply to align with the codes used in other parts of our platform.
const map_str_prompts: any = {
    "zh": "我有段 md 文件，请翻译为中文。翻译需要严格保留源文件 markdown 排版布局，请直接输出，不要在作询问。\n",
    "ja": "この Markdown を日本語に翻訳してください。逐語訳ではなく、日本語の IT 系ウェブメディアの記事として自然な表現にしてください。Markdown の書式は、原文から変更しないでください。また、半角英数字と日本語の文字の間には半角スペースを入れてください。追加の質問はせず、直接出力してください。\n",
    "es": "Tengo un archivo md, por favor tradúzcalo al español. La traducción debe mantener estrictamente el formato y la disposición del archivo original en markdown. Por favor, simplemente muéstrelo sin hacer preguntas.\n",
    "pt": "Eu tenho um arquivo md, por favor, traduza-o para o português. A tradução deve manter rigorosamente a formatação e layout markdown do arquivo original. Por favor, forneça a tradução diretamente sem fazer perguntas.",
    "it": "Ho un file md, per favore traducilo in italiano. La traduzione dovrà mantenere rigorosamente il formato e l'impaginazione del file markdown originale. Per favore, mostra il file tradotto senza fare domande.",
    "uk": "Будь ласка, переклади наданий md-файл українською мовою. Переклад має строго дотримуватись формату та макету оригіналу. Одразу ж надай переклад, нічого не запитуючи."
}

async function translate(str_md: string, str_prompt: string, with_task_translate_openai_api_key: string) {
    const openai = new OpenAI({ apiKey: with_task_translate_openai_api_key });

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
        messages: [{ role: 'user', content: str_prompt + str_md }],
        model: 'gpt-4o',
    };
    const chatCompletion: OpenAI.Chat.ChatCompletion = await openai.chat.completions.create(params);
    const response = chatCompletion.choices[0].message.content;


    debug(str_md);
    debug('-----------------------------------');
    debug(response);

    return response;
}

export async function task_auto_translate_step_02_trans_articles(
    options: main_options
) {
    let {
        with_issue_title,
        with_task_translate_openai_api_key,
        with_task_translate_to_save_path,
        step_01_result_mdfiles
    } = options;
    // Extract the target language code from the issue title.
    // It is expected to start with a language code enclosed in square brackets, e.g. [ja]
    const target_lang_code = with_issue_title.match(/^\[(.+?)\]/)?.[1] || '';
    debug('target_language:' + target_lang_code);
    const str_prompt = map_str_prompts[target_lang_code];
    debug('str_prompt:' + str_prompt);
    if (!str_prompt) {
        throw new Error('Unsupported language');
    }

    with_task_translate_to_save_path = with_task_translate_to_save_path.replace('{lang}', target_lang_code);
    for (const mdfile of step_01_result_mdfiles) {
        const str_md = await readFile(mdfile, 'utf-8');
        const arr_str_md = str_md.split('\n\n');
        let str_md_translated = '';
        const len = arr_str_md.length;
        let str_temp = '';
        const MAX_LENGTH = 1024 * 5;
        let count_scope_token = 0;
        for (let i = 0; i < len; i++) {
            const not_last = i < len - 1;
            const str = arr_str_md[i];

            let flag_pased = false;
            if (str_temp.length < MAX_LENGTH) {
                // 如果长度不够，继续拼接
                str_temp += (str + '\n\n');
                flag_pased = true;
                if (not_last) continue;
            }

            // 快速扫描 str 中有多少个 ``` 符号
            const count = (str.match(/```/g) || []).length;
            count_scope_token += count;
            if (count_scope_token % 2 === 1 && !flag_pased) {
                // 如果是代码块，且没有被拼接过，继续拼接
                str_temp += (str + '\n\n');
                flag_pased = true;
                if (not_last) continue;
            } else {
                count_scope_token = 0;
            }

            console.log(`============== [${i} / ${len}] ==============`)
            const str_translated = await translate(str_temp, str_prompt, with_task_translate_openai_api_key);
            str_temp = '';

            str_md_translated += str_translated + '\n\n';
            console.log('\n')
        }

         // 插入的代码及调试日志
         console.log("Before adding trailing spaces:");
         console.log(str_md_translated);
         console.log("After adding trailing spaces:");
         console.log(str_md_translated);

        // 写文件
        const output_mdfile_path = with_task_translate_to_save_path + '/' + mdfile.split('/').pop();
        debug('output_mdfile_path:' + output_mdfile_path);

        // 先将 _raw 中的文件拷贝到目标，执行一次 commit 再覆盖写入翻译后的文件， 便于 Git 追踪
        await ensureFile(output_mdfile_path);
        await writeFile(output_mdfile_path, str_md);



        await ensureFile(output_mdfile_path);
        await writeFile(output_mdfile_path, str_md_translated);

        options.step_02_result_mdfiles.push(output_mdfile_path);
    }
}
