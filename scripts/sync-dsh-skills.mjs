#!/usr/bin/env node
/**
 * 将 Agent EDU Lab 的教学 Skill 同步导出为 DeepSeek Harness (@deepseek-ai/dsh-skill)
 * 标准目录结构：<dshHome>/skills/<kebab-case-slug>/SKILL.md
 *
 * 用法：
 *   node scripts/sync-dsh-skills.mjs                 # 写入 $DSH_HOME/skills 或 ~/.dsh/skills
 *   node scripts/sync-dsh-skills.mjs --dry-run       # 仅预览将要生成的目录与文件
 *   node scripts/sync-dsh-skills.mjs --dir=/tmp/dsh  # 指定目标根目录
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const skillsTsPath = path.join(repoRoot, 'EDU_Frontend', 'src', 'data', 'agentHubSkills.ts');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirArg = args.find((a) => a.startsWith('--dir='));
const dshHome = dirArg
  ? path.resolve(dirArg.slice('--dir='.length))
  : process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const targetSkillsRoot = path.join(dshHome, 'skills');

function extractSkills(tsSource) {
  const startMarker = 'export const AGENT_HUB_SKILLS: AgentHubSkill[] = [';
  const startIdx = tsSource.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error('未在 agentHubSkills.ts 中找到 AGENT_HUB_SKILLS 定义');
  }
  const body = tsSource.slice(startIdx);
  const entries = [];
  const slugRegex = /slug:\s*'([a-z0-9-]+)'/g;
  const matches = [...body.matchAll(slugRegex)];

  for (let i = 0; i < matches.length; i += 1) {
    const slug = matches[i][1];
    const blockStart = matches[i].index;
    const blockEnd = i + 1 < matches.length ? matches[i + 1].index : body.indexOf('\n];', blockStart);
    const chunk = body.slice(blockStart, blockEnd === -1 ? undefined : blockEnd);

    const readSingle = (field) => {
      const m = chunk.match(new RegExp(`${field}:\\s*'([^']*)'`));
      return m ? m[1] : '';
    };
    const readTemplate = (field) => {
      const m = chunk.match(new RegExp(`${field}:\\s*\`([\\s\\S]*?)\`,\\n`));
      return m ? m[1].replace(/\\`/g, '`').replace(/\\\$/g, '$') : '';
    };

    const name = readSingle('name');
    const tagline = readSingle('tagline');
    const relatedCourseTitle = readSingle('relatedCourseTitle');
    const systemPrompt = readTemplate('systemPrompt');

    if (slug && name && systemPrompt) {
      entries.push({ slug, name, tagline, relatedCourseTitle, systemPrompt });
    }
  }
  return entries;
}

function renderSkillMd(skill) {
  const safeDesc = skill.tagline.replace(/"/g, '\\"');
  const safeWhen = `当用户需要进行「${skill.name}」（关联课程：${skill.relatedCourseTitle}）或输入 /${skill.slug} 时触发。`.replace(
    /"/g,
    '\\"'
  );
  return `---
name: ${skill.slug}
description: "${safeDesc}"
whenToUse: "${safeWhen}"
---

# ${skill.name}

> ${skill.tagline}

${skill.systemPrompt}
`;
}

const source = fs.readFileSync(skillsTsPath, 'utf8');
const skills = extractSkills(source);

if (skills.length === 0) {
  console.error('未解析出任何 Skill，请检查 agentHubSkills.ts 格式。');
  process.exit(1);
}

console.log(`解析到 ${skills.length} 个 Edu Lab 教学 Skill，目标目录：${targetSkillsRoot}`);

for (const skill of skills) {
  const skillDir = path.join(targetSkillsRoot, skill.slug);
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (dryRun) {
    console.log(`  [dry-run] /${skill.slug} -> ${skillFile}`);
  } else {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillFile, renderSkillMd(skill), 'utf8');
    console.log(`  ✓ /${skill.slug} -> ${skillFile}`);
  }
}

console.log(
  dryRun
    ? '\n预览完成（未写入文件）。去掉 --dry-run 执行正式同步。'
    : '\n同步完成！现在运行 `npx @deepseek-ai/dsh web` 即可在 DeepSeek Harness 中通过 /<skill-name> 调用。'
);
