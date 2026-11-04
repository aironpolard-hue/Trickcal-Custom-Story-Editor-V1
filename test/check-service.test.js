'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compile } = require('../compiler/trickcal');
const { CheckService } = require('../compiler/check-service');

async function main() {
  const root = path.resolve(__dirname, '..');
  const projectRoot = path.join(root, 'projects', '雨夜的末班车');
  const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'trickcal.project.json'), 'utf8'));
  const source = fs.readFileSync(path.join(projectRoot, manifest.entry), 'utf8');
  const presets = fs.readdirSync(path.join(projectRoot, 'presets')).filter(file => file.endsWith('.json')).map(file => ({
    file, ...JSON.parse(fs.readFileSync(path.join(projectRoot, 'presets', file), 'utf8')),
  }));
  const options = { ...manifest, projectRoot, presets };
  const service = new CheckService();
  try {
    const expected = compile(source, options);
    assert.deepStrictEqual(await service.check(source, options), expected);
    const invalid = 'ui show bubble a size broken\nnarration "测试"';
    assert.deepStrictEqual(await service.check(invalid, options), compile(invalid, options));
    const texts = ['narration "第一段"', 'narration "第二段"', 'ui write missing "第三段"'];
    const results = await Promise.all(texts.map(text => service.check(text, options)));
    assert.deepStrictEqual(results, texts.map(text => compile(text, options)));
    const longSource = Array.from({ length: 30000 }, (_, i) => `narration "测试 ${i}"`).join('\n');
    let ticks = 0;
    const heartbeat = setInterval(() => ticks++, 1);
    let longResult;
    try { longResult = await service.check(longSource, options); }
    finally { clearInterval(heartbeat); }
    assert.strictEqual(longResult.story.lines.length, 30000);
    assert.ok(ticks > 0, 'background check must allow the main event loop to run');
    const busy = service.check(longSource, options, 'first-window');
    const obsolete = service.check('narration "旧版本"', options, 'first-window');
    const other = service.check('narration "另一个窗口"', options, 'second-window');
    const latest = service.check('narration "最新版本"', options, 'first-window');
    assert.deepStrictEqual(await obsolete, { superseded: true });
    const [busyResult, otherResult, latestResult] = await Promise.all([busy, other, latest]);
    assert.strictEqual(busyResult.story.lines.length, 30000);
    assert.strictEqual(otherResult.story.lines[0].text, '另一个窗口');
    assert.strictEqual(latestResult.story.lines[0].text, '最新版本');
    await service.worker.terminate();
    assert.deepStrictEqual(await service.check(texts[0], options), compile(texts[0], options));
    console.log('check-service.test.js: ok');
  } finally {
    await service.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
