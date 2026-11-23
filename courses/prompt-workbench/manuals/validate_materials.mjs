// 静态检查材料结构及嵌入命令；不调用模型，不冒充目标 Lab 验收。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const all = ['zh-CN', 'en-US'].map(locale => JSON.parse(readFileSync(join(root, 'steps.' + locale + '.json'), 'utf8')));
let shellCount = 0;
let pythonCount = 0;
for (let index = 0; index < all.length; index++) {
  const steps = all[index];
  const locale = index === 0 ? 'zh-CN' : 'en-US';
  const md = readFileSync(join(root, 'lab.' + locale + '.md'), 'utf8');
  assert.equal(steps.length, 10);
  let minutes = 0;
  for (const [i, step] of steps.entries()) {
    assert.deepEqual(Object.keys(step).sort(), ['title', 'content', 'quickQuestions', 'verification'].sort());
    assert(step.title.startsWith(String(i + 1).padStart(2, '0')));
    minutes += Number(step.title.match(/[(（](\d+)/)[1]);
    assert(md.includes(step.title));
    assert(step.quickQuestions.length >= 2 && step.quickQuestions.every(q => typeof q === 'string'));
    assert.equal(step.verification.type, 'custom');
    assert(step.verification.command.startsWith('cd /workspace/prompt-workbench && '));
    assert.equal(step.verification.command, all[0][i].verification.command);
    const prose = step.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    assert(!/按教师指定重启方式|follow instructor restart instructions|Ctrl\+C/.test(prose));
    if ([5, 8].includes(i)) {
      assert(step.content.some(c => c.type === 'code' && c.code.includes('bash scripts/restart.sh')));
      assert(prose.includes('bash scripts/restart.sh'));
    }
    if (i === 7) {
      const commands = step.content.filter(c => c.type === 'code').map(c => c.code).join('\n');
      assert(prose.includes(index === 0 ? '平台 CLI 标签' : 'platform CLI tab'));
      assert(prose.includes('Course Baseline'));
      assert(commands.includes('pwd') && commands.includes('git diff HEAD'));
      assert(commands.includes('git status'));
      assert(!/^opencode\s*$/m.test(commands));
      assert(step.verification.command.includes('platform CLI entry'));
    }
    const snippets = [step.verification.command];
    for (const block of step.content) {
      assert(['text', 'code'].includes(block.type));
      assert(md.includes(block.type === 'text' ? block.text : block.code));
      if (block.type === 'code') {
        assert.equal(block.language, 'bash');
        snippets.push(block.code);
      } else assert(block.text.length > 100);
    }
    assert.deepEqual(step.content.filter(c => c.type === 'code'), all[0][i].content.filter(c => c.type === 'code'));
    for (const snippet of snippets) {
      assert(!/bash scripts\/check\.sh[ \t]+(?:all|environment|schema|drafts|run|export)\b/.test(snippet));
      const bash = spawnSync('bash', ['-n'], { input: snippet, encoding: 'utf8' });
      assert.equal(bash.status, 0, bash.stderr);
      shellCount++;
      for (const match of snippet.matchAll(/<<'PY'\n([\s\S]*?)\nPY(?:\n|$)/g)) {
        const py = spawnSync(process.env.MATERIALS_PYTHON || 'python3',
          ['-c', 'import sys; compile(sys.stdin.read(), "<manual>", "exec")'],
          { input: match[1], encoding: 'utf8' });
        assert.equal(py.status, 0, py.stderr);
        pythonCount++;
      }
    }
  }
  assert.equal(minutes, 105);
  assert(md.includes('120') && md.includes('15'));
  assert(!md.includes('135'));
  assert(steps[0].content[0].text.includes('120'));
  assert(steps[9].content[0].text.includes('15'));
}
for (const locale of ['zh-CN', 'en-US']) {
  const theory = readFileSync(join(root, '../materials/theory.' + locale + '.md'), 'utf8');
  assert(theory.includes('45') && theory.includes('105'));
  assert(theory.includes('120') && theory.includes('15'));
  assert(!theory.includes('135'));
  assert(!theory.includes('~~~bash'));
  assert(theory.includes('schemas/incident.schema.json'));
}
console.log(JSON.stringify({ languages: 2, stepsPerLanguage: 10, labMinutes: 105, shellSnippets: shellCount, pythonSnippets: pythonCount, status: 'static checks passed; no live Lab acceptance claimed' }, null, 2));
