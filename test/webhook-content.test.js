const assert = require('node:assert/strict');
const test = require('node:test');
const { buildWebhookArticle } = require('../src/server/utils/webhook-content');
const { WordImportError } = require('../src/server/utils/document-import');

const makeDeps = (overrides = {}) => {
  const calls = { processImages: [], deleteImages: [] };
  const deps = {
    processImages: async (raw) => {
      calls.processImages.push(raw);
      return raw.map((_, i) => `/uploads/images/img${i}.webp`);
    },
    deleteImages: async (urls) => {
      calls.deleteImages.push(urls);
    },
    converters: {},
    ...overrides,
  };
  return { deps, calls };
};

test('multiple file keys are rejected with 400 multiple_files', async () => {
  const converter = async () => assert.fail('converter must not run');
  const { deps } = makeDeps({ converters: { docx: converter, xlsx: converter, pdf: converter } });
  const result = await buildWebhookArticle({ title: 't', docx: 'a', pdf: 'b' }, deps);
  assert.deepEqual(result, { ok: false, status: 400, error: 'multiple_files' });
});

test('without a file, content passes through and image placeholders are replaced', async () => {
  const { deps, calls } = makeDeps();
  const body = {
    content: '<p>a</p><img data-image-index="1" alt="x"><img data-image-index="0">',
    images: ['b64-0', 'b64-1'],
  };
  const result = await buildWebhookArticle(body, deps);
  assert.equal(result.ok, true);
  assert.equal(result.hasFile, false);
  assert.equal(result.fileKey, undefined);
  assert.deepEqual(result.imgs, ['/uploads/images/img0.webp', '/uploads/images/img1.webp']);
  assert.equal(
    result.content,
    '<p>a</p><img src="/uploads/images/img1.webp" alt="x"><img src="/uploads/images/img0.webp">'
  );
  assert.deepEqual(calls.processImages, [['b64-0', 'b64-1']]);
});

test('out-of-range placeholders are removed and non-array images become []', async () => {
  const { deps, calls } = makeDeps();
  const result = await buildWebhookArticle(
    { content: '<p>a</p><img data-image-index="3" alt="x">', images: 'not-an-array' },
    deps
  );
  assert.equal(result.ok, true);
  assert.equal(result.content, '<p>a</p>');
  assert.deepEqual(result.imgs, []);
  assert.deepEqual(calls.processImages, [[]]);
});

test('converter output replaces content and images, reporting the file key', async () => {
  const { deps } = makeDeps({
    converters: {
      docx: async (input) => {
        assert.equal(input, 'base64-doc');
        return { content: '<p>doc</p><img data-image-index="0">', images: ['img-b64'] };
      },
    },
  });
  const result = await buildWebhookArticle({ content: 'ignored', docx: 'base64-doc' }, deps);
  assert.deepEqual(result, {
    ok: true,
    content: '<p>doc</p><img src="/uploads/images/img0.webp">',
    imgs: ['/uploads/images/img0.webp'],
    hasFile: true,
    fileKey: 'docx',
  });
});

test('WordImportError from a converter maps to its status and message', async () => {
  const { deps } = makeDeps({
    converters: {
      xlsx: async () => {
        throw new WordImportError('invalid_xlsx', 400);
      },
    },
  });
  const result = await buildWebhookArticle({ xlsx: 'x' }, deps);
  assert.deepEqual(result, { ok: false, status: 400, error: 'invalid_xlsx' });
});

test('other converter errors are rethrown', async () => {
  const { deps } = makeDeps({
    converters: {
      pdf: async () => {
        throw new Error('boom');
      },
    },
  });
  await assert.rejects(buildWebhookArticle({ pdf: 'x' }, deps), { message: 'boom' });
});

test('image count mismatch with a file deletes saved images and returns 422', async () => {
  const { deps, calls } = makeDeps({
    processImages: async () => ['/uploads/images/only-one.webp'],
    converters: { pdf: async () => ({ content: '<p>x</p>', images: ['a', 'b'] }) },
  });
  deps.deleteImages = async (urls) => {
    calls.deleteImages.push(urls);
  };
  const result = await buildWebhookArticle({ pdf: 'x' }, deps);
  assert.deepEqual(result, { ok: false, status: 422, error: 'pdf_image_save_failed' });
  assert.deepEqual(calls.deleteImages, [['/uploads/images/only-one.webp']]);
});

test('image count mismatch without a file is tolerated', async () => {
  const { deps, calls } = makeDeps({ processImages: async () => [] });
  const result = await buildWebhookArticle({ content: '<p>x</p>', images: ['a'] }, deps);
  assert.equal(result.ok, true);
  assert.deepEqual(calls.deleteImages, []);
});
