import { expect, test } from '@playwright/test';

const sse = (events: object[]) => ({
  headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
  body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n',
});
const overviewEvents = [
  { type: 'start', messageId: 'overview-default' },
  { type: 'text-start', id: 'overview-text' },
  {
    type: 'text-delta',
    id: 'overview-text',
    delta: '**Dấu ấn dự án công khai.** Chọn một repo để khám phá.',
  },
  { type: 'text-end', id: 'overview-text' },
  { type: 'finish', finishReason: 'stop' },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { connected: true } }));
  await page.route('**/api/chat', (route) =>
    route.request().postDataJSON()?.action === 'overview'
      ? route.fulfill(sse(overviewEvents))
      : route.fallback(),
  );
});

test('personalized heading types without layout shifts, can pause, and exposes the configured bio with GitHub fallback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.request.get('/api/profile');
  expect(response.ok()).toBe(true);
  const data = await response.json();
  await page.goto('/');
  const displayedName = await page.locator('[data-ui~=welcome-subject]').textContent();
  expect([data.profile.name, `@${data.profile.login}`]).toContain(displayedName);
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
    `Tìm hiểu ứng viên ${displayedName} qua các dự án.`,
  );
  const heading = page.locator('[data-ui~=candidate-headline] h1');
  const before = await heading.boundingBox();
  await expect(page.locator('[data-ui~=headline-text]')).not.toHaveText('qua các dự án.', {
    timeout: 6000,
  });
  const after = await heading.boundingBox();
  expect(after?.height).toBe(before?.height);
  await page.getByRole('button', { name: 'Tạm dừng hiệu ứng tiêu đề' }).click();
  const paused = await page.locator('[data-ui~=headline-text]').textContent();
  await page.waitForTimeout(200);
  await expect(page.locator('[data-ui~=headline-text]')).toHaveText(paused || '');
  const bio = page.locator('[data-ui~=candidate-bio]');
  const expectedBio = data.candidateBio?.trim() || data.profile.bio?.trim();
  if (expectedBio) {
    await bio.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(bio).toHaveAttribute('open', '');
    await expect(bio.locator('[data-ui~=bio-content]')).toContainText(expectedBio.split('\n')[0]);
    await expect(bio.locator('[data-ui~=bio-origin]')).toHaveText(
      data.candidateBio?.trim() ? 'Ứng viên tự giới thiệu' : 'Bio từ GitHub',
    );
    const source = bio.getByRole('link', { name: 'Nguồn hồ sơ GitHub' });
    if (data.candidateBio?.trim()) await expect(source).toHaveCount(0);
    else await expect(source).toHaveAttribute('href', data.profile.url);
  } else {
    await expect(bio).toHaveCount(0);
  }
});

test('reduced motion keeps the full static heading and removes typing controls', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('[data-ui~=headline-text]')).toHaveText('qua các dự án.');
  await expect(page.locator('[data-ui~=headline-pause]')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Tổng quan nhanh', exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('desktop sidebar represents actual conversations rather than topic navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Model đã kết nối' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở điều hướng' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Mở hoạt động agent' })).toBeHidden();
  await expect(page.getByLabel('Câu hỏi về ứng viên')).toHaveCSS('font-size', '12px');
  await expect(page.getByRole('tab', { name: 'Tổng quan', exact: true })).toHaveCSS(
    'color',
    'rgb(54, 88, 233)',
  );
  await expect(
    page.getByRole('heading', { name: 'Tổng quan nhanh', exact: true }),
  ).toBeInViewport();
  await expect(page.getByRole('navigation', { name: 'Chủ đề' })).toHaveCount(0);
  await expect(page.getByText('Nguồn của hội thoại')).toBeVisible();
  await expect(page.getByRole('button', { name: /Đọc code, hiểu kỹ năng/ })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Tổng quan', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('[data-ui~=history-item][aria-current=page]')).toContainText(
    'Cuộc trò chuyện mới',
  );
  await page.screenshot({ path: 'test-results/desktop.png' });
});

test('375px layout has working accessible drawers and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByLabel('Câu hỏi về ứng viên')).toBeVisible();
  await expect(page.getByLabel('Câu hỏi về ứng viên')).toHaveCSS('font-size', '13px');
  await expect(page.getByLabel('Câu hỏi về ứng viên')).toHaveCSS('line-height', '22.1px');
  await expect(
    page.getByRole('heading', { name: 'Tổng quan nhanh', exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  await expect(page.getByRole('dialog', { name: 'Điều hướng' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mở điều hướng' })).toBeFocused();
  await page.getByRole('button', { name: 'Mở hoạt động agent' }).click();
  await expect(page.getByRole('dialog', { name: 'Hoạt động agent' })).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('tab', { name: /Nguồn dữ liệu/ })
    .click();
  await expect(
    page.getByRole('dialog').getByText('Nguồn được thêm sau khi agent thực sự truy xuất dữ liệu.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/mobile.png' });
});

test('overview starts once per workspace, survives new conversations, and retries only explicitly', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/chat', async (route) => {
    if (route.request().postDataJSON()?.action !== 'overview') return route.fallback();
    calls++;
    await route.fulfill(sse(overviewEvents));
  });
  await page.goto('/');
  await expect(page.locator('[data-ui~=candidate-overview] [data-ui~=markdown] strong')).toHaveText(
    'Dấu ấn dự án công khai.',
  );
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Đặt câu hỏi riêng', exact: true }).click();
  await expect(page.getByLabel('Câu hỏi về ứng viên')).toBeFocused();
  await page.getByLabel('Câu hỏi về ứng viên').fill('Chưa gửi');
  expect(calls).toBe(1);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('candidate-atlas:sessions:v1') || '[]'),
  );
  expect(saved[0].messages).toHaveLength(0);
  await page.getByRole('button', { name: 'Tóm tắt lại', exact: true }).click();
  await expect.poll(() => calls).toBe(2);
  await page.locator('[data-ui~=sidebar] [data-ui~=new-chat]').click();
  await expect(
    page.locator('[data-ui~=candidate-overview] [data-ui~=markdown] strong'),
  ).toBeVisible();
  expect(calls).toBe(2);
  await expect(
    page.locator('[data-ui~=candidate-overview] [data-ui~=markdown] strong'),
  ).toBeVisible();
});

test('quick repo action creates its own conversation and subsequent questions use ordinary text history', async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/chat', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'overview') return route.fallback();
    requests.push(body);
    await route.fulfill(
      sse([
        { type: 'start', messageId: `repo-answer-${requests.length}` },
        { type: 'text-start', id: 'repo-text' },
        { type: 'text-delta', id: 'repo-text', delta: '**Bài toán dự án.** Nội dung có nguồn.' },
        { type: 'text-end', id: 'repo-text' },
        { type: 'finish', finishReason: 'stop' },
      ]),
    );
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Kho dự án', exact: true }).click();
  const card = page.locator('[data-ui~=repository-card]').first();
  const name = (await card.locator('[data-ui~=repository-card-heading] a').innerText()).trim();
  await card.getByRole('button', { name: `Hỏi nhanh về ${name}`, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-ui~=message-list] [data-ui~=markdown]')).toContainText(
    'Bài toán dự án',
  );
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ action: 'repository', repository: name });
  await expect(page.locator('[data-ui~=user-message]')).toContainText(name);
  await expect(page.locator('[data-ui~=candidate-overview]')).toHaveCount(0);
  await page.getByLabel('Câu hỏi về ứng viên').fill('Đi sâu hơn vào kiến trúc');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].action).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tổng quan nhanh' })).toBeVisible();
  await page.locator('[data-ui~=history-item]').filter({ hasText: name }).click();
  await expect(page.locator('[data-ui~=message-list] [data-ui~=markdown]').first()).toContainText(
    'Bài toán dự án',
  );
  expect(requests).toHaveLength(2);
});

test('overview keeps its in-flight stream across conversations without starting another request', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const realFetch = window.fetch;
    window.fetch = async (input, init) => {
      if (
        String(input).endsWith('/api/chat') &&
        JSON.parse(String(init?.body || '{}')).action === 'overview'
      ) {
        const stream = new ReadableStream({
          start(controller) {
            (window as unknown as { pushOverview: (event: unknown) => void }).pushOverview = (
              event,
            ) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
          },
        });
        init?.signal?.addEventListener('abort', () => {
          (window as unknown as { overviewAborted: boolean }).overviewAborted = true;
        });
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
        });
      }
      return realFetch(input, init);
    };
  });
  await page.route('**/api/chat', (route) =>
    route.fulfill(
      sse([
        { type: 'start', messageId: 'greeting' },
        { type: 'text-start', id: 'greeting-text' },
        { type: 'text-delta', id: 'greeting-text', delta: 'Chào bạn!' },
        { type: 'text-end', id: 'greeting-text' },
        { type: 'finish', finishReason: 'stop' },
      ]),
    ),
  );
  await page.goto('/');
  await expect(
    page.locator('[data-ui~=candidate-overview] [data-ui~=preparation-status]'),
  ).toBeVisible();
  const push = (event: unknown) =>
    page.evaluate(
      (e) => (window as unknown as { pushOverview: (event: unknown) => void }).pushOverview(e),
      event,
    );
  await push({ type: 'start', messageId: 'incremental-overview' });
  await push({ type: 'text-start', id: 'intro-text' });
  await push({ type: 'text-delta', id: 'intro-text', delta: '**Dấu ấn' });
  await expect(page.locator('[data-ui~=candidate-overview] [data-ui~=markdown]')).toContainText(
    'Dấu ấn',
  );
  await push({
    type: 'text-delta',
    id: 'intro-text',
    delta: ' công nghệ.** Thông tin đang được trả về.',
  });
  await expect(page.locator('[data-ui~=candidate-overview] strong')).toHaveText(
    'Dấu ấn công nghệ.',
  );
  await expect(page.getByRole('button', { name: 'Dừng tóm tắt' })).toBeVisible();
  await page.getByLabel('Câu hỏi về ứng viên').fill('Hello');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.locator('[data-ui~=message-list] [data-ui~=markdown]')).toContainText(
    'Chào bạn!',
  );
  expect(
    await page.evaluate(() => (window as unknown as { overviewAborted?: boolean }).overviewAborted),
  ).not.toBe(true);
  await push({ type: 'text-end', id: 'intro-text' });
  await push({ type: 'finish', finishReason: 'stop' });
  await page.locator('[data-ui~=sidebar] [data-ui~=new-chat]').click();
  await expect(page.locator('[data-ui~=candidate-overview] [data-ui~=markdown]')).toContainText(
    'Thông tin đang được trả về.',
  );
  await page.locator('[data-ui~=history-item]').filter({ hasText: 'Hello' }).click();
  await expect(page.locator('[data-ui~=message-list] [data-ui~=markdown]')).toContainText(
    'Chào bạn!',
  );
  await page.locator('[data-ui~=sidebar] [data-ui~=new-chat]').click();
  await expect(page.locator('[data-ui~=candidate-overview] [data-ui~=markdown]')).toContainText(
    'Thông tin đang được trả về.',
  );
});

test('overview failure leaves repository controls usable and retries only when requested', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/chat', (route) => {
    if (route.request().postDataJSON()?.action !== 'overview') return route.fallback();
    return ++calls === 1
      ? route.fulfill({ status: 503, json: { error: 'Offline' } })
      : route.fulfill(sse(overviewEvents));
  });
  await page.goto('/');
  await expect(page.locator('[data-ui~=candidate-overview] [role=alert]')).toBeVisible();
  await page.getByRole('tab', { name: 'Kho dự án', exact: true }).click();
  await expect(page.locator('[data-ui~=repository-card] button').first()).toBeEnabled();
  await page.getByRole('tab', { name: 'Tổng quan', exact: true }).click();
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Thử tóm tắt lại' }).click();
  await expect(page.locator('[data-ui~=candidate-overview] [data-ui~=markdown]')).toBeVisible();
  expect(calls).toBe(2);
});

test('home tabs expose only their section, support keyboard navigation and preserve the overview', async ({
  page,
}) => {
  let overviews = 0;
  await page.route('**/api/chat', (route) => {
    if (route.request().postDataJSON()?.action !== 'overview') return route.fallback();
    overviews++;
    return route.fulfill(sse(overviewEvents));
  });
  await page.goto('/');
  await expect(page.locator('[data-ui~=candidate-overview] [data-ui~=markdown]')).toBeVisible();
  await expect(page.locator('[data-ui~=repository-card]')).toHaveCount(0);
  await expect(page.locator('[data-ui~=suggestion]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Tổng quan', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Kho dự án', exact: true })).toBeFocused();
  await expect(page.locator('[data-ui~=repository-card]').first()).toBeVisible();
  await expect(page.locator('[data-ui~=candidate-overview]')).toBeHidden();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Câu hỏi thường gặp', exact: true })).toBeFocused();
  await expect(page.locator('[data-ui~=suggestion]')).toHaveCount(4);
  await expect(page.locator('[data-ui~=repository-card]')).toHaveCount(0);
  await page.keyboard.press('Home');
  await expect(page.locator('[data-ui~=candidate-overview] [data-ui~=markdown]')).toBeVisible();
  expect(overviews).toBe(1);
});

test('SSE answer, sources, history and new chat work together', async ({ page }) => {
  const events = [
    { type: 'start', messageId: 'test-answer' },
    {
      type: 'data-classification',
      id: 'intent',
      data: { intent: 'projects', method: 'model', summary: 'Đọc bằng chứng' },
    },
    {
      type: 'data-activity',
      id: 'tool-1',
      data: {
        id: 'tool-1',
        kind: 'tool',
        label: 'Đọc dự án',
        detail: 'test-repo',
        status: 'done',
        elapsedMs: 50,
      },
    },
    {
      type: 'data-sources',
      id: 'evidence',
      data: [
        {
          id: 'repo',
          title: 'test-repo',
          url: 'https://github.com/example/test-repo',
          kind: 'repository',
        },
      ],
    },
    { type: 'text-start', id: 'text-1' },
    {
      type: 'text-delta',
      id: 'text-1',
      delta:
        'Đã đối chiếu **bằng chứng dự án** từ [test-repo](https://github.com/example/test-repo).',
    },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop' },
  ];
  await page.route('**/api/chat', (route) =>
    route.request().postDataJSON()?.action === 'overview'
      ? route.fallback()
      : route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
          body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n',
        }),
  );
  await page.goto('/');
  const question = page.getByLabel('Câu hỏi về ứng viên');
  await question.fill('Phân tích dự án');
  await question.press('Enter');
  await expect(page.locator('[data-ui~=markdown]')).toContainText('bằng chứng dự án');
  await expect(page.locator('[data-ui~=markdown] a')).toHaveAttribute(
    'href',
    'https://github.com/example/test-repo',
  );
  await expect(page.locator('[data-ui~=answer-sources]')).toContainText('Đã truy xuất 1 nguồn');
  await page.reload();
  await page.locator('[data-ui~=history-item]').filter({ hasText: 'Phân tích dự án' }).click();
  await expect(page.locator('[data-ui~=markdown]')).toContainText('bằng chứng dự án');
  await page.locator('[data-ui~=sidebar] [data-ui~=new-chat]').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('[data-ui~=history-item]').filter({ hasText: 'Phân tích dự án' }).click();
  await expect(page.locator('[data-ui~=markdown]')).toContainText('bằng chứng dự án');
});

test('upstream error provides a retry and preserves the question', async ({ page }) => {
  await page.route('**/api/chat', (route) =>
    route.request().postDataJSON()?.action === 'overview'
      ? route.fallback()
      : route.fulfill({ status: 503, json: { error: 'Model unavailable' } }),
  );
  await page.goto('/');
  await page.getByLabel('Câu hỏi về ứng viên').fill('Ứng viên có dự án nào?');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.locator('[data-ui~=chat-error]')).toBeVisible();
  await expect(
    page.locator('[data-ui~=chat-error]').getByRole('button', { name: 'Thử lại' }),
  ).toBeVisible();
  await expect(page.locator('[data-ui~=user-message]')).toContainText('Ứng viên có dự án nào?');
});

test('preparation stays visible after metadata starts streaming and throughout reasoning/tool waits', async ({
  page,
}) => {
  await page.goto('/');
  // A controlled browser-side SSE fixture lets assertions run between real stream chunks.
  await page.evaluate(() => {
    const realFetch = window.fetch;
    window.fetch = async (input, init) => {
      if (String(input).endsWith('/api/chat')) {
        const stream = new ReadableStream({
          start(controller) {
            (window as unknown as { pushChat: (event: unknown) => void }).pushChat = (event) =>
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
          },
        });
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
        });
      }
      return realFetch(input, init);
    };
  });
  await page.getByLabel('Câu hỏi về ứng viên').fill('Phân tích dự án');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.locator('[data-ui~=preparation-status]')).toContainText(
    'Đang chuẩn bị phản hồi',
  );
  const push = async (event: unknown) =>
    page.evaluate(
      (e) => (window as unknown as { pushChat: (event: unknown) => void }).pushChat(e),
      event,
    );
  await push({ type: 'start', messageId: 'delayed' });
  for (const [phase, label] of [
    ['classification', 'Đang hiểu câu hỏi'],
    ['waiting-model', 'Đang chờ mô hình xử lý'],
    ['reasoning', 'Mô hình đang phân tích'],
    ['tool', 'Đang đọc dữ liệu GitHub'],
    ['preparing', 'Đang chuẩn bị câu trả lời'],
  ]) {
    await push({
      type: 'data-progress',
      id: 'progress',
      data: { phase, label, detail: 'Đang xử lý thực tế', elapsedMs: 18000 },
    });
    await expect(page.locator('[data-ui~=preparation-status]')).toContainText(label);
    await expect(page.locator('[data-ui~=markdown]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dừng phản hồi' })).toBeVisible();
  }
  await push({ type: 'text-start', id: 'answer' });
  await push({ type: 'text-delta', id: 'answer', delta: 'Đã có câu trả lời.' });
  await expect(page.locator('[data-ui~=markdown]')).toContainText('Đã có câu trả lời.');
  await expect(page.locator('[data-ui~=preparation-status]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dừng phản hồi' }).click();
  await expect(page.getByRole('button', { name: 'Gửi câu hỏi', exact: true })).toBeVisible();
});

test('length-limited answer offers a concrete summary action', async ({ page }) => {
  let lastQuestion = '';
  let requestCount = 0;
  await page.route('**/api/chat', (route) => {
    if (route.request().postDataJSON()?.action === 'overview') return route.fallback();
    lastQuestion = route.request().postDataJSON().messages.at(-1).parts[0].text;
    const events = [
      { type: 'start', messageId: `limited-${++requestCount}` },
      ...(requestCount === 1
        ? [
            { type: 'text-start', id: 'answer' },
            { type: 'text-delta', id: 'answer', delta: 'Một câu trả lời còn dang dở' },
            { type: 'text-end', id: 'answer' },
          ]
        : []),
      {
        type: 'data-usage',
        id: 'usage',
        data: {
          inputTokens: 100,
          outputTokens: 256,
          elapsedMs: 15000,
          steps: 2,
          finishReason: 'length',
          firstTextMs: 10000,
          classificationMs: 500,
        },
      },
      { type: 'finish', finishReason: 'length' },
    ];
    return route.fulfill({
      headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n',
    });
  });
  await page.goto('/');
  await page.getByLabel('Câu hỏi về ứng viên').fill('Phân tích dự án');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.locator('[data-ui~=limit-note]')).toContainText('Câu trả lời chưa hoàn tất.');
  await expect(page.locator('[data-ui~=message-actions]')).toContainText('Chờ 10.0s');
  await page.getByRole('button', { name: 'Nhận bản tóm tắt' }).click();
  await expect.poll(() => lastQuestion).toContain('tối đa 100 từ');
  await expect(page.locator('[data-ui~=limit-note]').last()).toContainText(
    'Chưa có nội dung trả lời hoàn chỉnh.',
  );
  await expect(page.locator('[data-ui~=empty-answer]')).toHaveCount(0);
});

test('verified project images render with sources, survive reload, and handle failures on mobile', async ({
  page,
}) => {
  const profile = await (await page.request.get('/api/profile')).json();
  const scope = new URL(profile.scope).pathname.split('/').filter(Boolean);
  const owner = scope[0];
  const repo = scope[1] || profile.repositories[0].name;
  const commit = 'a'.repeat(40);
  const path = 'screenshots/home.png';
  const picture = {
    id: 'image-fixture',
    repository: repo,
    path,
    alt: 'Giao diện kho hàng',
    origin: 'readme',
    src: `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${path}`,
    sourceUrl: `https://github.com/${owner}/${repo}/blob/${commit}/${path}`,
  };
  let unexpectedImages = 0;
  await page.route('https://evil.test/**', (route) => {
    unexpectedImages++;
    return route.abort();
  });
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r1cAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.route('**/api/chat', (route) => {
    if (route.request().postDataJSON()?.action === 'overview') return route.fallback();
    const events = [
      { type: 'start', messageId: 'with-images' },
      {
        type: 'data-sources',
        id: 'evidence',
        data: [{ id: 'picture-source', title: path, url: picture.sourceUrl, kind: 'file' }],
      },
      {
        type: 'data-images',
        id: 'project-images',
        data: [picture, { ...picture, id: 'unsafe', src: 'https://evil.test/tracker.png' }],
      },
      { type: 'text-start', id: 'answer' },
      { type: 'text-delta', id: 'answer', delta: 'Đây là ảnh được README tham chiếu.' },
      { type: 'text-end', id: 'answer' },
      { type: 'finish', finishReason: 'stop' },
    ];
    return route.fulfill({
      headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n',
    });
  });
  await page.goto('/');
  await page.getByLabel('Câu hỏi về ứng viên').fill('Cho xem hình ảnh ứng dụng');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  const gallery = page.getByRole('region', { name: 'Hình ảnh dự án' });
  await expect(gallery.locator('img')).toHaveCount(1);
  await gallery.locator('img').scrollIntoViewIfNeeded();
  await expect
    .poll(() => gallery.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1);
  await expect(gallery.getByRole('link', { name: 'Xem nguồn GitHub' })).toHaveAttribute(
    'href',
    picture.sourceUrl,
  );
  await page.reload();
  await page
    .locator('[data-ui~=history-item]')
    .filter({ hasText: 'Cho xem hình ảnh ứng dụng' })
    .click();
  await expect(gallery.locator('img')).toHaveCount(1);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route('https://raw.githubusercontent.com/**', (route) => route.abort());
  await page.reload();
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  await page
    .getByRole('dialog')
    .locator('[data-ui~=history-item]')
    .filter({ hasText: 'Cho xem hình ảnh ứng dụng' })
    .click();
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toContainText('Chưa tải được ảnh.');
  await expect(gallery.getByRole('link', { name: 'Xem nguồn GitHub' })).toBeVisible();
  expect(unexpectedImages).toBe(0);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1440, height: 600 },
  { width: 375, height: 812 },
  { width: 844, height: 400 },
]) {
  test(`repository panel stays inside the inspector with long research content at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/chat', (route) =>
      route.fulfill(
        sse([
          overviewEvents[0],
          ...Array.from({ length: 24 }, (_, index) => ({
            type: 'data-activity',
            id: `long-activity-${index}`,
            data: {
              id: `long-activity-${index}`,
              kind: 'tool',
              status: 'done',
              label: `Đọc README ${index}`,
              detail: `repository-${index}`,
              elapsedMs: 400,
            },
          })),
          {
            type: 'data-sources',
            data: Array.from({ length: 40 }, (_, index) => ({
              id: `source-${index}`,
              kind: 'file',
              title: `README ${index}`,
              url: `https://github.com/example/repository/blob/main/README-${index}.md`,
            })),
          },
          ...overviewEvents.slice(1),
        ]),
      ),
    );
    await page.goto('/');
    if (viewport.width <= 1080)
      await page.getByRole('button', { name: 'Mở hoạt động agent' }).click();
    const inspector = page.locator('[data-ui=inspector]:visible');
    const repositories = inspector.getByRole('region', { name: 'Kho mã nguồn', exact: true });
    const research = inspector.locator('[data-ui=inspector-scroll]');
    const list = repositories.locator('[data-ui=inspector-repositories]');
    const assertInsideFrame = async () => {
      const frame = await inspector.boundingBox();
      const panel = await repositories.boundingBox();
      expect(frame).not.toBeNull();
      expect(panel).not.toBeNull();
      expect(panel!.y).toBeGreaterThanOrEqual(frame!.y);
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(viewport.height);
      await expect(repositories.getByRole('heading', { name: 'Kho mã nguồn' })).toBeInViewport({
        ratio: 1,
      });
      await expect(inspector.getByText('Dữ liệu thật. Nguồn rõ ràng.')).toBeInViewport({
        ratio: 1,
      });
    };
    await expect(research.locator('[data-ui~=activity-step]')).toHaveCount(24);
    await assertInsideFrame();
    const initial = await repositories.boundingBox();
    expect(await research.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await research.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect((await repositories.boundingBox())!.y).toBe(initial!.y);
    await inspector.getByRole('tab', { name: /Nguồn dữ liệu/ }).click();
    await expect(research.getByRole('link')).toHaveCount(40);
    await research.getByRole('link').last().focus();
    await assertInsideFrame();
    await repositories.getByRole('button', { name: /Xem tất cả/ }).click();
    expect(await list.getByRole('link').count()).toBeGreaterThan(3);
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await list.getByRole('link').last().focus();
    await expect(list.getByRole('link').last()).toBeInViewport({ ratio: 1 });
    await expect(repositories.getByRole('button', { name: 'Thu gọn' })).toBeInViewport({
      ratio: 1,
    });
    await assertInsideFrame();
    await page.screenshot({
      path: `test-results/inspector-${viewport.width}x${viewport.height}.png`,
    });
  });
}
