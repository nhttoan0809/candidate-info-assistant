/* eslint-disable @next/next/no-img-element -- Render retrieved GitHub assets directly, preserving verified source URLs and referrer policy. */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  Code2,
  FolderGit2,
  ImageIcon,
  MessageSquare,
  RefreshCw,
  Square,
  UserRound,
} from 'lucide-react';
import { CandidateHeadline } from './candidate-headline';
import { AtlasMark, Github } from './brand';
import { EvidenceMarkdown, PreparationStatus, SourceLink } from './response-parts';
import type { Bootstrap, ChatMessage } from '@/lib/types';

const suggestions = [
  {
    title: 'Xem dự án qua hình ảnh',
    description: 'Ứng dụng làm gì? Giao diện ra sao?',
    question:
      'Chọn một ứng dụng tiêu biểu trong repo gốc của ứng viên, giới thiệu bài toán giải quyết và đính kèm hình ảnh dự án tìm được cùng link nguồn. Nếu không tìm thấy ảnh, hãy nói rõ.',
    icon: ImageIcon,
  },
  {
    title: 'Đọc code, hiểu kỹ năng',
    description: 'Công nghệ và cách áp dụng trong code.',
    question:
      'Chọn một repo frontend gốc của ứng viên và chỉ ra 3 kỹ năng được thể hiện trong code. Đối chiếu dependencies với file triển khai cụ thể, kèm link nguồn cho từng nhận định.',
    icon: Code2,
  },
  {
    title: 'Giải mã cách xây dựng',
    description: 'Kiến trúc, lựa chọn kỹ thuật và đánh đổi.',
    question:
      'Phân tích kiến trúc của một dự án gốc của ứng viên và giải thích một lựa chọn kỹ thuật đáng chú ý dựa trên code. Nêu một đánh đổi có thể có, phân biệt bằng chứng với suy luận và dẫn nguồn.',
    icon: FolderGit2,
  },
  {
    title: 'Đánh giá độ phù hợp',
    description: 'Đối chiếu với vai trò Frontend Developer.',
    question:
      'Với vị trí Frontend Developer dùng React và TypeScript, hãy đối chiếu repo gốc của ứng viên để nêu điểm phù hợp, điều chưa đủ bằng chứng và 3 câu hỏi phỏng vấn sát dự án. Kèm link nguồn.',
    icon: BriefcaseBusiness,
  },
];

export function Welcome({
  data,
  busy,
  onAsk,
  onCompose,
  onRepository,
  overview,
}: {
  data: Bootstrap;
  busy: boolean;
  onAsk: (question: string) => void;
  onCompose: () => void;
  onRepository: (repository: string) => void;
  overview: CandidateOverviewState;
}) {
  const profile = data.profile;
  const customBio = data.candidateBio?.trim();
  const bio = customBio || profile?.bio?.trim();
  const bioPreview = bio?.split(/(?<=[.!?])\s+/)[0];
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState('overview');
  const uid = useId();
  const tabs = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'repositories', label: 'Kho dự án' },
    { id: 'questions', label: 'Câu hỏi thường gặp' },
  ];
  const repositories = [
    ...data.repositories.filter((r) => !r.fork),
    ...data.repositories.filter((r) => r.fork),
  ];
  return (
    <section
      className="mx-auto my-0 w-full max-w-205 p-[28px_42px_24px] text-left max-[769px]:max-w-170 max-[769px]:px-6 max-[769px]:py-6.5 max-[421px]:px-5 max-[421px]:py-[23px] min-[1081px]:max-[1251px]:p-[28px_26px_24px] min-[1550px]:pt-11 min-[1550px]:pb-8.5 [&_[role=tabpanel]:focus-visible]:[outline:3px_solid_#8199ff] [&_[role=tabpanel]:focus-visible]:[outline-offset:4px] [&_[role=tabpanel][hidden]]:hidden [@media(max-height:820px)]:min-[769px]:pt-6"
      aria-labelledby="welcome-title"
    >
      <div className="mb-3 flex items-center gap-[9px] text-[12px] font-medium text-muted max-[769px]:mb-4 max-[769px]:text-[12px] max-[421px]:mb-2.5 [@media(max-height:820px)]:min-[769px]:mb-3">
        <span
          className="grid size-7 place-items-center text-cobalt [&_svg]:h-7 [&_svg]:w-7"
          aria-hidden="true"
        >
          <AtlasMark />
        </span>
        Trợ lý AI tìm hiểu ứng viên
      </div>
      <CandidateHeadline
        name={
          profile?.name ||
          (profile?.login || data.owner ? `@${profile?.login || data.owner}` : 'trên GitHub')
        }
      />
      <p className="m-0 max-w-142.5 text-[14px] leading-[1.85] text-muted max-[769px]:text-[13px] max-[421px]:text-[13px]">
        Một góc nhìn về con người phía sau mã nguồn. Khám phá dự án, công nghệ và dấu ấn hoạt động
        cùng AI — có nguồn để đối chiếu.
      </p>

      <div className="mt-4 flex min-w-0 items-center gap-[11px] border-t border-b border-t-line border-b-line px-0 py-2.5 max-[421px]:mt-3 [&>img]:h-10.5 [&>img]:w-10.5 [&>img]:rounded-[12px] [&>img]:border [&>img]:border-line [&>img]:object-cover">
        {profile?.avatar ? (
          <img src={profile.avatar} alt="" width={42} height={42} />
        ) : (
          <span
            className="grid size-10.5 shrink-0 place-items-center rounded-[12px] bg-pale-blue text-cobalt"
            aria-hidden="true"
          >
            <UserRound size={22} />
          </span>
        )}
        <div className="min-w-0 [&_strong]:block [&_strong]:text-[14px] [&_strong]:font-semibold [&_strong]:wrap-anywhere [&>span]:mb-1 [&>span]:block [&>span]:text-[11px] [&>span]:text-muted">
          <span>{profile ? 'Hồ sơ GitHub công khai' : 'Tài khoản trong phạm vi cấu hình'}</span>
          <strong>
            {profile?.login || data.owner
              ? `@${profile?.login || data.owner}`
              : 'Ứng viên từ nguồn GitHub đã cấu hình'}
          </strong>
        </div>
        {profile && (
          <a
            className="ml-auto flex min-h-11 items-center gap-1.5 p-[8px_0_8px_8px] text-[11px] text-muted hover:text-cobalt max-[769px]:p-2 max-[769px]:[&>span]:hidden min-[1081px]:max-[1251px]:[&>span]:hidden"
            href={profile.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Xem hồ sơ GitHub của ${profile.login}`}
          >
            <Github size={16} aria-hidden="true" />
            <span>{data.repositories.length} repo trong phạm vi</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        )}
      </div>

      <div
        className="mt-5.5 flex gap-5 border-b border-line max-[421px]:mt-3.5 max-[421px]:gap-[15px]"
        role="tablist"
        aria-label="Khám phá ứng viên"
      >
        {tabs.map((item, index) => (
          <button
            key={item.id}
            id={`${uid}-${item.id}-tab`}
            role="tab"
            className="relative min-h-12 py-3 text-[13px] whitespace-nowrap text-muted aria-selected:font-semibold aria-selected:text-cobalt aria-selected:after:absolute aria-selected:after:inset-x-0 aria-selected:after:-bottom-px aria-selected:after:h-0.5 aria-selected:after:bg-cobalt aria-selected:after:content-[''] max-[421px]:text-[11px]"
            aria-selected={tab === item.id}
            aria-controls={`${uid}-${item.id}-panel`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              setTab(tabs[next].id);
              document.getElementById(`${uid}-${tabs[next].id}-tab`)?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-overview-panel`}
        aria-labelledby={`${uid}-overview-tab`}
        hidden={tab !== 'overview'}
        tabIndex={0}
      >
        {bio && (
          <details
            data-ui="candidate-bio"
            className="group/bio mt-4.5 border-l-2 border-l-line p-[0_0_0_14px] max-[769px]:mt-3.5 [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:list-none [&_summary]:rounded-[4px] [&_summary::-webkit-details-marker]:hidden [&[open]_[data-ui~=bio-expand]]:hidden [&[open]_[data-ui~=bio-heading]>svg]:rotate-180 [&[open]_[data-ui~=bio-preview]]:hidden"
          >
            <summary className="group-open/bio:flex group-open/bio:items-center">
              <span
                data-ui="bio-heading"
                className="flex w-full flex-wrap items-center gap-2 text-[12px] font-semibold [&>svg]:shrink-0 [&>svg]:text-muted"
              >
                <span>Đôi nét về ứng viên</span>
                <span
                  data-ui="bio-origin"
                  className="ml-auto text-[10px] font-normal text-muted max-[421px]:text-[9px]"
                >
                  {customBio ? 'Ứng viên tự giới thiệu' : 'Bio từ GitHub'}
                </span>
                <ChevronDown size={15} aria-hidden="true" />
              </span>
              <span
                data-ui="bio-preview"
                className="mt-[7px] line-clamp-2 [display:-webkit-box] overflow-hidden text-[13px] leading-[1.8] text-muted [-webkit-box-orient:vertical] max-[769px]:line-clamp-1"
              >
                {bioPreview}
              </span>
              <span data-ui="bio-expand" className="block p-[8px_0_4px] text-[11px] text-cobalt">
                Đọc giới thiệu
              </span>
            </summary>
            <div
              data-ui="bio-content"
              className="text-[13px] leading-[1.9] text-muted [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:gap-[5px] [&_a]:text-[11px] [&_a]:text-cobalt [&_p]:m-[12px_0_0] [&_p:first-child]:mt-0"
            >
              {bio.split(/\n\s*\n/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {!customBio && profile && (
                <a href={profile.url} target="_blank" rel="noreferrer">
                  Nguồn hồ sơ GitHub
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          </details>
        )}
        <CandidateOverview overview={overview} />

        <div className="mt-5 flex flex-wrap items-center gap-3 max-[421px]:mt-4.5 max-[421px]:flex-col max-[421px]:items-stretch max-[421px]:gap-1">
          <button
            className="inline-flex min-h-12 items-center justify-center gap-5.5 rounded-[9px] bg-cobalt px-4.5 py-3 text-[14px] font-medium text-surface hover:bg-cobalt-hover disabled:opacity-60 max-[421px]:gap-4"
            onClick={onCompose}
          >
            <MessageSquare size={17} aria-hidden="true" />
            Đặt câu hỏi riêng
          </button>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] p-3 text-[13px] text-muted hover:bg-pale-blue hover:text-cobalt max-[421px]:min-h-11"
            onClick={() => {
              setTab('repositories');
              document.getElementById(`${uid}-repositories-tab`)?.focus();
            }}
          >
            Khám phá các repo
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${uid}-repositories-panel`}
        aria-labelledby={`${uid}-repositories-tab`}
        hidden={tab !== 'repositories'}
        tabIndex={0}
      >
        {tab === 'repositories' && (
          <>
            <section
              className="mt-7 scroll-mt-5"
              id="public-repositories"
              aria-labelledby="repositories-title"
            >
              <div className="mb-2.5 [&_h2]:m-[0_0_6px] [&_h2]:text-[15px] [&_h2]:leading-[1.6] [&_h2]:font-semibold [&_h2>span]:ml-[5px] [&_h2>span]:text-[12px] [&_h2>span]:font-normal [&_h2>span]:text-muted [&_p]:m-0 [&_p]:text-[12px] [&_p]:leading-[1.7] [&_p]:text-muted">
                <h2 id="repositories-title">
                  Các repo công khai <span>{repositories.length}</span>
                </h2>
                <p>Chọn một repo để mở cuộc trò chuyện về dự án đó.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-[601px]:grid-cols-1">
                {repositories.slice(0, expanded ? undefined : 4).map((repo) => (
                  <article
                    data-ui="repository-card"
                    className="flex min-w-0 flex-col rounded-[10px] border border-line p-4 [&>p]:m-[9px_0_12px] [&>p]:line-clamp-3 [&>p]:[display:-webkit-box] [&>p]:overflow-hidden [&>p]:text-[12px] [&>p]:leading-[1.8] [&>p]:text-muted [&>p]:[-webkit-box-orient:vertical]"
                    key={repo.name}
                  >
                    <div
                      data-ui="repository-card-heading"
                      className="flex items-start gap-2 text-muted [&_a]:min-w-0 [&_a]:text-[13px] [&_a]:leading-[1.7] [&_a]:font-medium [&_a]:wrap-anywhere [&_a]:text-ink [&_a_svg]:ml-[5px] [&_a_svg]:inline [&_a_svg]:text-muted [&_a:hover]:text-cobalt [&>svg]:mt-0.5"
                    >
                      <FolderGit2 size={18} aria-hidden="true" />
                      <a href={repo.url} target="_blank" rel="noreferrer">
                        {repo.name}
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    </div>
                    <p>
                      {repo.description || 'Chưa có mô tả công khai. Khám phá README cùng trợ lý.'}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 [&_button]:flex [&_button]:min-h-11 [&_button]:items-center [&_button]:gap-[7px] [&_button]:rounded-[7px] [&_button]:bg-pale-blue [&_button]:px-2.5 [&_button]:py-2 [&_button]:text-[12px] [&_button]:text-cobalt [&_button:hover]:bg-cobalt [&_button:hover]:text-surface [&_em]:rounded-[4px] [&_em]:border [&_em]:border-line [&_em]:px-[5px] [&_em]:py-[3px] [&_em]:not-italic [&>span]:flex [&>span]:flex-wrap [&>span]:items-center [&>span]:gap-1.5 [&>span]:text-[10px] [&>span]:text-muted">
                      <span>
                        {repo.language || 'Chưa rõ ngôn ngữ'}
                        {repo.fork && <em>Repo fork</em>}
                      </span>
                      <button
                        onClick={() => onRepository(repo.name)}
                        disabled={busy}
                        aria-label={`Hỏi nhanh về ${repo.name}`}
                      >
                        Hỏi nhanh
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {repositories.length > 4 && (
                <button
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-[7px] text-[12px] text-muted hover:text-cobalt"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                >
                  {expanded ? 'Thu gọn danh sách repo' : `Xem thêm ${repositories.length - 4} repo`}
                  <ArrowDown
                    size={14}
                    className={expanded ? 'rotate-180' : ''}
                    aria-hidden="true"
                  />
                </button>
              )}
              {!repositories.length && (
                <p className="text-[12px] leading-[1.9] text-muted">
                  Chưa tải được danh sách repo. Bạn có thể thử tải lại nguồn GitHub.
                </p>
              )}
            </section>
          </>
        )}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-questions-panel`}
        aria-labelledby={`${uid}-questions-tab`}
        hidden={tab !== 'questions'}
        tabIndex={0}
      >
        {tab === 'questions' && (
          <>
            <section
              className="mt-6 max-[421px]:mt-[23px] min-[1550px]:mt-8.5 [@media(max-height:820px)]:min-[769px]:mt-6"
              aria-labelledby="topics-title"
            >
              <div className="mb-2.5 [&_h2]:m-[0_0_6px] [&_h2]:text-[15px] [&_h2]:leading-[1.6] [&_h2]:font-semibold [&_h2>span]:ml-[5px] [&_h2>span]:text-[12px] [&_h2>span]:font-normal [&_h2>span]:text-muted [&_p]:m-0 [&_p]:text-[12px] [&_p]:leading-[1.7] [&_p]:text-muted">
                <h2 id="topics-title">Câu hỏi thường gặp</h2>
                <p>Chọn một câu hỏi để trợ lý tìm bằng chứng và trả lời.</p>
              </div>
              <div className="grid grid-cols-2 gap-x-5.5 border-t border-t-line max-[769px]:grid-cols-1 min-[1081px]:max-[1251px]:grid-cols-1">
                {suggestions.map((s) => (
                  <button
                    key={s.title}
                    data-ui="suggestion"
                    className="flex min-h-20.5 items-center gap-[11px] border-b border-b-line px-0 py-[13px] text-left hover:bg-sidebar max-[769px]:min-h-20.5 min-[1081px]:max-[1251px]:min-h-19 [&:hover_[data-ui~=suggestion-arrow]]:text-cobalt [&:hover_[data-ui~=suggestion-icon]]:bg-pale-blue [&:hover_[data-ui~=suggestion-icon]]:text-cobalt [&:hover_strong]:text-cobalt"
                    onClick={() => onAsk(s.question)}
                    disabled={busy}
                  >
                    <span
                      data-ui="suggestion-icon"
                      className="grid size-8.5 shrink-0 place-items-center rounded-[8px] bg-sidebar text-muted"
                      aria-hidden="true"
                    >
                      <s.icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1 [&_strong]:block [&_strong]:text-[13px] [&_strong]:leading-[1.6] [&_strong]:font-medium max-[769px]:[&_strong]:text-[14px] min-[1550px]:[&_strong]:text-[14px] [&>span]:mt-1 [&>span]:block [&>span]:text-[11px] [&>span]:leading-[1.75] [&>span]:text-muted max-[769px]:[&>span]:text-[12px] min-[1550px]:[&>span]:text-[12px]">
                      <strong>{s.title}</strong>
                      <span>{s.description}</span>
                    </span>
                    <ArrowUpRight
                      size={16}
                      data-ui="suggestion-arrow"
                      className="ml-auto text-muted"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      <div className="mt-3.5 flex items-start gap-[9px] text-[11px] leading-[1.8] text-muted max-[769px]:text-[12px] [&_p]:m-0 [&_svg]:mt-0.5">
        <BookOpen size={16} aria-hidden="true" />
        <p>Tổng quan từ hồ sơ, README và mẫu hoạt động công khai. Hỏi sâu để đối chiếu mã nguồn.</p>
      </div>
    </section>
  );
}

export function useCandidateOverview() {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: '/api/chat',
        prepareSendMessagesRequest: () => ({ body: { action: 'overview' } }),
      }),
    [],
  );
  const { messages, sendMessage, status, error, stop, regenerate, clearError } =
    useChat<ChatMessage>({ id: 'candidate-overview', transport });
  const started = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => {
    // Deferring also prevents React Strict Mode's setup/cleanup probe from
    // starting a duplicate request or aborting the only overview request.
    const timer = window.setTimeout(() => {
      if (started.current) return;
      started.current = true;
      setHasStarted(true);
      void sendMessage({ text: 'Giới thiệu nhanh về ứng viên.' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sendMessage]);
  useEffect(
    () => () => {
      void stop();
    },
    [stop],
  );
  return { messages, busy, error, stop, regenerate, clearError, started: hasStarted };
}

export type CandidateOverviewState = ReturnType<typeof useCandidateOverview>;

function CandidateOverview({ overview }: { overview: CandidateOverviewState }) {
  const { messages, busy, error, stop, regenerate, clearError, started } = overview;
  const answer = messages.findLast((m) => m.role === 'assistant');
  const text =
    answer?.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n') || '';
  const sources = answer?.parts.find((p) => p.type === 'data-sources')?.data || [];
  const progress = answer?.parts.find((p) => p.type === 'data-progress')?.data;
  const usage = answer?.parts.find((p) => p.type === 'data-usage')?.data;
  return (
    <section
      data-ui="candidate-overview"
      className="mt-5 rounded-[10px] border border-l-3 border-line border-l-cobalt bg-sidebar p-5 max-[601px]:p-4 max-[421px]:mt-4 [&_[data-ui~=markdown]]:text-[14px] [&_[data-ui~=markdown]]:leading-[1.85] [&_[data-ui~=markdown]_p:last-child]:mb-0 [&_[data-ui~=preparation-status]]:m-0 [&_[data-ui~=preparation-status]]:border-0 [&_[data-ui~=preparation-status]]:bg-transparent [&_[data-ui~=preparation-status]]:p-0"
      aria-labelledby="overview-title"
      aria-busy={busy}
    >
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 [&_h2]:m-0 [&_h2]:text-[14px] [&_h2]:font-semibold [&>span]:text-[10px] [&>span]:text-muted">
        <h2 id="overview-title">Tổng quan nhanh</h2>
        <span>
          {busy
            ? 'Đang đọc README & hoạt động'
            : text
              ? 'AI tổng hợp · có dẫn nguồn'
              : 'README & hoạt động GitHub'}
        </span>
      </div>
      {text && <EvidenceMarkdown text={text} sources={sources} streaming={busy} />}
      {!text && !error && (busy || !started) && <PreparationStatus progress={progress} />}
      {error && (
        <p className="mx-0 my-2.5 text-[12px] leading-[1.9] text-muted" role="alert">
          Chưa tạo được bản tổng quan. Bạn vẫn có thể chọn repo hoặc đặt câu hỏi. Hãy kiểm tra kết
          nối và thử lại.
        </p>
      )}
      {!busy && !text && !error && started && (
        <p className="mx-0 my-2.5 text-[12px] leading-[1.9] text-muted">
          Bản tổng quan chưa hoàn tất. Bạn có thể thử lại khi sẵn sàng.
        </p>
      )}
      {usage?.finishReason === 'length' && (
        <p className="mx-0 my-2.5 text-[12px] leading-[1.9] text-muted" role="status">
          Bản tổng quan chưa hoàn tất vì lượt sinh chạm giới hạn. Các thông tin đã trả về vẫn được
          giữ lại.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 [&>button]:flex [&>button]:min-h-9 [&>button]:items-center [&>button]:gap-1.5 [&>button]:px-0 [&>button]:py-1.5 [&>button]:text-[11px] [&>button]:text-muted max-[601px]:[&>button]:min-h-11 [&>button:hover]:text-cobalt">
        {sources.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {sources.slice(0, 2).map((source) => (
              <SourceLink key={source.url} source={source} />
            ))}
          </div>
        )}
        {busy ? (
          <button onClick={() => void stop()}>
            <Square size={12} aria-hidden="true" />
            Dừng tóm tắt
          </button>
        ) : (
          <button
            onClick={() => {
              clearError();
              void regenerate();
            }}
          >
            <RefreshCw size={13} aria-hidden="true" />
            {error || !text ? 'Thử tóm tắt lại' : 'Tóm tắt lại'}
          </button>
        )}
      </div>
    </section>
  );
}
