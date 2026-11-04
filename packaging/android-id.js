'use strict';
const crypto = require('crypto');

function androidApplicationId(manifest, projectPath) {
  const configured = manifest.android && manifest.android.applicationId;
  if (configured !== undefined) {
    if (typeof configured !== 'string' || configured.length > 200 || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(configured)) {
      throw new Error('Android applicationId 格式无效：请使用小写字母开头的英文分段，例如 com.example.story。');
    }
    return configured;
  }
  const identity = String(manifest.id || projectPath || '');
  if (!identity) throw new Error('项目缺少 ID，无法生成 Android applicationId。');
  const slug = identity.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'story';
  const digest = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 10);
  return `com.trickcal.story.p_${slug}_${digest}`;
}

module.exports = { androidApplicationId };
