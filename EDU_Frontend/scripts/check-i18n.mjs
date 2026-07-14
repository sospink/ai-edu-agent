import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const scope = process.argv.find((arg) => arg.startsWith('--scope='))?.split('=')[1] || 'all';

function loadTsModule(filePath, requireMap = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (id) => {
      if (id in requireMap) return requireMap[id];
      throw new Error(`Unsupported import in i18n resource: ${id}`);
    },
  });
  vm.runInContext(output, context, { filename: filePath });
  return module.exports;
}

function flattenShape(value, prefix = '', result = new Set()) {
  if (Array.isArray(value)) {
    result.add(`${prefix}[]`);
    value.forEach((item, index) => flattenShape(item, `${prefix}[${index}]`, result));
    return result;
  }
  if (value && typeof value === 'object') {
    Object.keys(value).sort().forEach((key) => flattenShape(value[key], prefix ? `${prefix}.${key}` : key, result));
    return result;
  }
  result.add(prefix);
  return result;
}

function flattenValues(value, prefix = '', result = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenValues(item, `${prefix}[${index}]`, result));
    return result;
  }
  if (value && typeof value === 'object') {
    Object.keys(value).sort().forEach((key) => flattenValues(value[key], prefix ? `${prefix}.${key}` : key, result));
    return result;
  }
  result.set(prefix, value);
  return result;
}

function placeholders(value) {
  if (typeof value !== 'string') return [];
  return [...value.matchAll(/\{\{\s*([^},\s]+)[^}]*\}\}/g)].map((match) => match[1]).sort();
}

const i18nDir = path.join(root, 'src/i18n');
const userResources = loadTsModule(path.join(i18nDir, 'userResources.ts'));
const staffResources = loadTsModule(path.join(i18nDir, 'staffResources.ts'));
const marketingResources = loadTsModule(path.join(i18nDir, 'marketingResources.ts'));
const { resources } = loadTsModule(path.join(i18nDir, 'resources.ts'), { './userResources': userResources, './staffResources': staffResources, './marketingResources': marketingResources });
const zhKeys = flattenShape(resources['zh-CN']);
const enKeys = flattenShape(resources['en-US']);
const missingEn = [...zhKeys].filter((key) => !enKeys.has(key));
const missingZh = [...enKeys].filter((key) => !zhKeys.has(key));
const zhValues = flattenValues(resources['zh-CN']);
const enValues = flattenValues(resources['en-US']);
const interpolationMismatches = [...zhValues.keys()].filter((key) => {
  return JSON.stringify(placeholders(zhValues.get(key))) !== JSON.stringify(placeholders(enValues.get(key)));
});

if (missingEn.length || missingZh.length || interpolationMismatches.length) {
  console.error('i18n resource key mismatch:');
  missingEn.forEach((key) => console.error(`  missing en-US: ${key}`));
  missingZh.forEach((key) => console.error(`  missing zh-CN: ${key}`));
  interpolationMismatches.forEach((key) => console.error(`  interpolation mismatch: ${key}`));
  process.exit(1);
}

const teacherSharedFiles = [
  'src/components/admin/LearningManagement.tsx',
  'src/components/admin/ProjectManagement.tsx',
  'src/components/admin/AgentManualEditor.tsx',
  'src/components/admin/LessonMaterialsModal.tsx',
  'src/components/admin/UnitAgentModal.tsx',
];
const scanRoots = scope === 'teacher'
  ? ['src/components/teacher']
  : scope === 'admin'
    ? ['src/components/admin']
    : ['src'];
const excluded = new Set([
  path.join(root, 'src/components/docs/docManifest.ts'),
]);
const excludedDirectories = new Set([
  path.join(root, 'src/i18n'),
]);
const findings = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !excludedDirectories.has(fullPath)) walk(fullPath);
    else if (/\.(ts|tsx)$/.test(entry.name) && !excluded.has(fullPath)) scanFile(fullPath);
  }
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    let text = null;
    if (ts.isJsxText(node)) text = node.getText(sourceFile).trim();
    if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      const isImport = ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent);
      const isObjectKey = ts.isPropertyAssignment(parent) && parent.name === node;
      const isLog = ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.expression.getText(sourceFile) === 'console';
      const isMachineMatch = ts.isCallExpression(parent)
        && ts.isPropertyAccessExpression(parent.expression)
        && ['includes', 'startsWith', 'endsWith', 'indexOf'].includes(parent.expression.name.text);
      if (!isImport && !isObjectKey && !isLog && !isMachineMatch) text = node.text;
    }
    if ([ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail].includes(node.kind)) {
      text = node.text;
    }
    if (text && /\p{Script=Han}/u.test(text)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      findings.push(`${path.relative(root, filePath)}:${line + 1} ${text.replace(/\s+/g, ' ').slice(0, 90)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

scanRoots.map((item) => path.join(root, item)).filter(fs.existsSync).forEach(walk);
if (scope === 'teacher') {
  teacherSharedFiles.map((item) => path.join(root, item)).filter(fs.existsSync).forEach(scanFile);
}
console.log(`i18n resources OK: ${zhKeys.size} keys per locale`);
if (findings.length) {
  console.warn(`i18n visible Chinese debt: ${findings.length} occurrences`);
  findings.slice(0, 500).forEach((item) => console.warn(`  ${item}`));
  if (findings.length > 500) console.warn(`  ... ${findings.length - 500} more`);
  if (strict) process.exit(1);
}
