/* eslint-disable @next/next/no-img-element -- Render retrieved GitHub assets directly, preserving verified source URLs and referrer policy. */
'use client';

import Link from 'next/link';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  FileText,
  FolderGit2,
  History,
  ListFilter,
  LoaderCircle,
  MapPin,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  UserRound,
  Workflow,
  X,
} from 'lucide-react';
import { AtlasMark, Github } from './brand';
import { ProjectGallery } from './project-gallery';
import { Welcome, useCandidateOverview, type CandidateOverviewState } from './welcome';
import { EvidenceMarkdown, PreparationStatus, SourceLink } from './response-parts';
import {
  intentLabels,
  type Activity,
  type Bootstrap,
  type ChatMessage,
  type Evidence,
} from '@/lib/types';

interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  updated: number;
  repository?: string;
}
const storageKey = 'candidate-atlas:sessions:v1';

function newSession(): Session {
  return {
    id: crypto.randomUUID(),
    title: 'Cuộc trò chuyện mới',
    messages: [],
    updated: Date.now(),
  };
}
function textOf(message: ChatMessage) {
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}
function safeSessions(value: unknown): Session[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (s): s is Session =>
        s &&
        typeof s.id === 'string' &&
        typeof s.title === 'string' &&
        (s.repository === undefined ||
          (typeof s.repository === 'string' && /^[\w.-]{1,100}$/.test(s.repository))) &&
        Array.isArray(s.messages) &&
        s.messages.every(
          (m: ChatMessage) =>
            m &&
            typeof m.id === 'string' &&
            ['user', 'assistant'].includes(m.role) &&
            Array.isArray(m.parts) &&
            m.parts.every(
              (p) =>
                p &&
                typeof p.type === 'string' &&
                (p.type !== 'text' || typeof p.text === 'string'),
            ),
        ),
    )
    .slice(0, 12);
}

export function Workspace({ initial }: { initial: Bootstrap }) {
  const [data, setData] = useState(initial);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [drawer, setDrawer] = useState<'profile' | 'activity' | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState(false);
  const [running, setRunning] = useState(false);
  const overview = useCandidateOverview();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch('/api/health');
      const d = await r.json();
      setConnected(d.connected === true);
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    let stored: Session[] = [];
    try {
      stored = safeSessions(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
      /* unavailable/corrupt storage */
    }
    const home = stored.find((s) => !s.messages.length && !s.repository) || newSession();
    const next = [home, ...stored.filter((s) => s.messages.length)].slice(0, 12);
    // Browser-only storage is hydrated after the server-rendered shell mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessions(next);
    setActiveId(next[0].id);
    setHydrated(true);
    void checkConnection();
  }, [checkConnection]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    } catch {
      // Report a failed write to the external browser storage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice('Trình duyệt không lưu được lịch sử. Hội thoại vẫn hoạt động trong phiên này.');
    }
  }, [sessions, hydrated]);
  useEffect(() => {
    if (!drawer && !help) return;
    returnFocus.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>('button, a[href], textarea, [tabindex="0"]') || [],
      ).filter((e) => e.getClientRects().length > 0);
    focusables()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawer(null);
        setHelp(false);
      }
      if (e.key === 'Tab') {
        const items = focusables();
        const first = items[0];
        const last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      returnFocus.current?.focus();
    };
  }, [drawer, help]);

  const updateSession = useCallback((id: string, messages: ChatMessage[]) => {
    const persisted = messages.map((m) => ({
      ...m,
      parts: m.parts.filter((p) => p.type === 'text' || p.type.startsWith('data-')),
    }));
    const first = persisted.find((m) => m.role === 'user');
    setSessions((old) =>
      old.map((s) =>
        s.id === id
          ? {
              ...s,
              messages: persisted,
              title: first ? textOf(first).slice(0, 64) : s.title,
              updated: Date.now(),
            }
          : s,
      ),
    );
  }, []);
  const startNew = () => {
    const s = newSession();
    setSessions((old) => [s, ...old.filter((x) => x.messages.length)].slice(0, 12));
    setActiveId(s.id);
    setDrawer(null);
  };
  const startRepository = (repository: string) => {
    if (!data.repositories.some((r) => r.name === repository)) return;
    const s = { ...newSession(), title: `Dự án ${repository}`, repository };
    setSessions((old) => [s, ...old.filter((x) => x.messages.length)].slice(0, 12));
    setActiveId(s.id);
    setDrawer(null);
  };
  const retryProfile = async () => {
    try {
      const r = await fetch('/api/profile');
      if (!r.ok) throw new Error();
      setData(await r.json());
      setNotice('Đã cập nhật hồ sơ từ GitHub.');
    } catch {
      setNotice('GitHub chưa phản hồi. Thử lại sau hoặc kiểm tra REPO_URL và hạn mức API.');
    }
  };
  const active = sessions.find((s) => s.id === activeId);
  const chatLatest = [...(active?.messages || [])].reverse().find((m) => m.role === 'assistant');
  const showOverview = !active?.messages.length && !active?.repository;
  const latest = showOverview
    ? overview?.messages.findLast((m) => m.role === 'assistant')
    : chatLatest;
  const activeRunning = showOverview ? overview?.busy : running;
  const activity =
    latest?.parts
      .filter((p) => p.type === 'data-activity')
      .map((p) =>
        p.data.status === 'running' && !activeRunning
          ? {
              ...p.data,
              status: 'error' as const,
              detail: 'Bước này chưa hoàn tất; luồng phản hồi đã dừng.',
            }
          : p.data,
      ) || [];
  const sources = latest?.parts.find((p) => p.type === 'data-sources')?.data || [];
  const sidebar = (
    <>
      <Link
        data-ui="brand"
        className="m-[0_7px_32px] flex items-center gap-[9px] font-display text-[16px] font-extrabold tracking-[-.55px] max-[1251px]:text-[15px] [&_small]:mt-1 [&_small]:block [&_small]:font-sans [&_small]:text-[9px] [&_small]:font-normal [&_small]:tracking-[0] [&_small]:text-muted"
        href="/"
        aria-label="Candidate Atlas, trang chủ"
      >
        <span className="size-9 text-cobalt [&_svg]:h-9 [&_svg]:w-9">
          <AtlasMark />
        </span>
        <span>
          {data.appName}
          <small>Tìm hiểu ứng viên qua GitHub</small>
        </span>
      </Link>
      <button
        data-ui="new-chat"
        className="mb-7.5 flex w-full items-center justify-start gap-[9px] rounded-[9px] border border-[#dfe4f0] bg-surface px-[13px] py-3 text-[12px] font-medium shadow-[0_2px_3px_#1c254003] hover:border-[#a6b5ef] hover:bg-[#f2f5ff] [&>span]:ml-auto [&>span]:text-[14px] [&>span]:text-faint"
        onClick={startNew}
      >
        <Plus size={17} /> Cuộc trò chuyện mới
      </button>
      <div className="border-b border-b-line p-[0_11px_21px] [&_[data-ui~=nav-label]]:p-0 [&_p]:mx-0 [&_p]:my-3 [&_p]:text-[11px] [&_p]:leading-[1.9] [&_p]:text-muted [&_strong]:text-[12px] [&_strong]:font-medium [&_strong]:wrap-anywhere [&>div]:mt-[15px] [&>div]:flex [&>div]:items-center [&>div]:gap-2 [&>div]:text-[#53688c]">
        <span data-ui="nav-label" className="px-3 py-0 text-[10px] font-medium text-muted">
          Nguồn của hội thoại
        </span>
        <div>
          <Github size={17} />
          <strong>{data.profile?.login ? `@${data.profile.login}` : 'GitHub ứng viên'}</strong>
        </div>
        <p>Hỏi trong cùng một cuộc trò chuyện. Trợ lý chỉ đọc repo khi câu hỏi cần bằng chứng.</p>
        <span className="inline-block rounded-[5px] bg-mint-pale px-[7px] py-[5px] text-[9px] text-mint">
          {data.repositories.length} repo trong phạm vi
        </span>
      </div>
      <div className="mt-8 flex items-center justify-between pr-3 text-[#8590a4] [@media(max-height:820px)]:min-[769px]:mt-[21px]">
        <span data-ui="nav-label" className="px-3 py-0 text-[10px] font-medium text-muted">
          Cuộc trò chuyện
        </span>
        <History size={14} />
      </div>
      <div className="mt-[13px] overflow-auto">
        {sessions.slice(0, 12).map((s) => (
          <button
            key={s.id}
            data-ui={`history-item ${s.id === activeId ? 'selected' : ''}`}
            className="flex w-full items-center gap-2.5 rounded-[7px] px-3 py-[11px] text-left text-[11px] text-muted hover:bg-[#eef1f7] [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&[data-ui~=selected]]:bg-[#eef1f7]"
            aria-current={s.id === activeId ? 'page' : undefined}
            onClick={() => {
              setActiveId(s.id);
              setDrawer(null);
            }}
          >
            <MessageSquare size={15} />
            <span>{s.title}</span>
          </button>
        ))}
        {!sessions.some((s) => s.messages.length) && (
          <p className="mx-3 my-1 text-[11px] leading-[1.9] text-[#758096]">
            Những câu chuyện bắt đầu
            <br />
            từ một câu hỏi hay.
          </p>
        )}
      </div>
      <div className="mt-auto pt-6">
        <div className="flex items-center gap-[9px] border-t border-t-line px-1.5 py-[17px] [&_div_span]:mt-[5px] [&_div_span]:block [&_div_span]:text-[9px] [&_div_span]:text-muted [&_img]:rounded-[12px] [&_img]:border [&_img]:border-line [&_img]:object-cover [&_strong]:block [&_strong]:overflow-hidden [&_strong]:text-[11px] [&_strong]:font-semibold [&_strong]:text-ellipsis [&>a]:ml-auto [&>a]:p-1.5 [&>div]:min-w-0">
          {data.profile?.avatar ? (
            <img src={data.profile.avatar} alt="" width={38} height={38} />
          ) : (
            <span className="grid size-9.5 place-items-center rounded-[10px] bg-[#e9edfa] text-cobalt">
              <UserRound size={19} />
            </span>
          )}
          <div>
            <strong>{data.profile?.name || data.profile?.login || 'Hồ sơ ứng viên'}</strong>
            <span>Hồ sơ GitHub công khai</span>
          </div>
          {data.profile && (
            <a
              href={data.profile.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Mở hồ sơ GitHub"
            >
              <ArrowUpRight size={17} />
            </a>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-t-line px-0 py-[11px] [&_button]:flex [&_button]:items-center [&_button]:gap-[7px] [&_button]:rounded-[6px] [&_button]:p-2 [&_button]:text-[10px] [&_button]:text-muted max-[769px]:[&_button]:min-h-11 max-[769px]:[&_button]:min-w-11 [&_button:hover]:bg-[#e9edf5]">
          <button
            onClick={() => {
              setDrawer(null);
              setHelp(true);
            }}
          >
            <CircleHelp size={15} /> Về trợ lý
          </button>
          <button
            aria-label="Xóa lịch sử trên thiết bị"
            title="Xóa lịch sử trên thiết bị"
            onClick={() => {
              const s = newSession();
              setSessions([s]);
              setActiveId(s.id);
              setNotice('Đã xóa lịch sử trên thiết bị này.');
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </>
  );
  return (
    <div className="flex h-[100dvh] min-h-130 overflow-hidden max-[769px]:min-h-100">
      <a
        className="fixed top-2 left-2 z-100 -translate-y-[200%] bg-cobalt p-3 text-surface focus:translate-none"
        href="#conversation"
      >
        Đến hội thoại
      </a>
      <aside
        data-ui="sidebar"
        className="flex w-62.5 shrink-0 flex-col border-r border-r-line bg-sidebar p-[29px_17px_0] max-[1251px]:w-55.5 max-[1251px]:pr-3 max-[1251px]:pl-3 max-[769px]:hidden min-[1550px]:w-67.5 min-[1550px]:pr-[23px] min-[1550px]:pl-[23px] [&_nav]:mt-3"
      >
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[75px] shrink-0 items-center justify-between gap-3 border-b border-b-line bg-[#ffffffc9] px-[29px] py-0 max-[1251px]:px-6 max-[1251px]:py-0 max-[769px]:h-16 max-[769px]:p-[0_16px_0_9px] max-[381px]:pr-2">
          <div className="flex min-w-0 items-center gap-[13px] text-[11px] text-[#919aab] max-[769px]:gap-2 [&_strong]:font-medium [&_strong]:text-ink max-[769px]:[&_strong]:text-[12px] max-[769px]:[&>svg]:hidden">
            <button
              className="hidden size-8.5 items-center justify-center rounded-[7px] text-muted hover:bg-[#edf1f8] max-[769px]:inline-flex max-[769px]:h-9.5 max-[769px]:w-9.5"
              aria-label="Mở điều hướng"
              onClick={() => setDrawer('profile')}
            >
              <Menu size={20} />
            </button>
            <span className="whitespace-nowrap text-[#6d778a] max-[769px]:hidden">
              Không gian ứng viên
            </span>
            <ChevronRight size={14} />
            <strong className="max-w-90 overflow-hidden text-ellipsis whitespace-nowrap">
              {active?.title || 'Hội thoại'}
            </strong>
          </div>
          <div className="flex items-center gap-4 max-[769px]:gap-[7px] max-[381px]:gap-[3px]">
            <button
              data-ui={`connection ${connected === true ? 'online' : connected === false ? 'offline' : ''}`}
              className="flex items-center gap-[7px] rounded-[20px] bg-[#f2f4f8] px-2.5 py-[7px] text-[10px] text-muted max-[769px]:px-2 max-[769px]:py-1.5 max-[769px]:text-[9px] [&_i]:h-1.5 [&_i]:w-1.5 [&_i]:rounded-full [&_i]:bg-[#9aa6bd] max-[381px]:[&_span]:text-[8px] [&[data-ui~=offline]]:bg-[#fff1e8] [&[data-ui~=offline]]:text-[#a44d35] [&[data-ui~=offline]_i]:bg-[#b86140] [&[data-ui~=online]]:bg-[#f0f8f4] [&[data-ui~=online]]:text-mint [&[data-ui~=online]_i]:bg-[#239773] [&[data-ui~=online]_i]:shadow-[0_0_0_3px_#23977312]"
              onClick={checkConnection}
              disabled={checking}
              title="Kiểm tra lại kết nối mô hình"
            >
              {checking ? <LoaderCircle size={12} className="animate-spin" /> : <i />}
              <span>
                {connected === true
                  ? 'Model đã kết nối'
                  : connected === false
                    ? 'Model mất kết nối'
                    : 'Đang kết nối'}
              </span>
            </button>
            <a
              href={data.scope || '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8.5 items-center justify-center rounded-[7px] text-muted hover:bg-[#edf1f8] max-[769px]:hidden max-[769px]:h-9.5 max-[769px]:w-9.5"
              aria-label="Mở nguồn GitHub"
            >
              <Github size={18} />
            </a>
            <button
              className="hidden size-8.5 items-center justify-center rounded-[7px] text-muted hover:bg-[#edf1f8] max-[1081px]:inline-flex max-[769px]:h-9.5 max-[769px]:w-9.5"
              aria-label="Mở hoạt động agent"
              onClick={() => setDrawer('activity')}
            >
              <Workflow size={20} />
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <main
            id="conversation"
            className="relative flex min-w-0 flex-1 flex-col bg-surface outline-none"
            tabIndex={-1}
          >
            {data.githubError && (
              <div
                className="m-[14px_25px_0] flex shrink-0 items-center justify-between gap-2.5 rounded-[9px] border border-[#eedad0] bg-[#fff7f0] px-3.5 py-[13px] text-[10px] leading-[1.8] text-[#985e3c] max-[769px]:m-[10px_14px_0] [&_button]:flex [&_button]:items-center [&_button]:gap-[5px] [&_button]:rounded-[5px] [&_button]:border [&_button]:border-[#edcfb9] [&_button]:bg-[#ffefdf] [&_button]:px-2 [&_button]:py-[5px] [&_button]:text-[10px] [&_button]:whitespace-nowrap"
                role="alert"
              >
                <span>{data.githubError}</span>
                <button onClick={retryProfile}>
                  <RefreshCw size={14} /> Thử lại
                </button>
              </div>
            )}
            {hydrated && active ? (
              <Chat
                key={active.id}
                session={active}
                data={data}
                updateSession={updateSession}
                connected={connected}
                setRunning={setRunning}
                onRepository={startRepository}
                overview={overview}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-[15px] text-[12px] text-[#7284a4] [&_svg]:h-12.5 [&_svg]:w-12.5 [&_svg]:text-cobalt">
                <AtlasMark />
                <span>Đang mở không gian khám phá…</span>
              </div>
            )}
          </main>
          <aside className="flex min-h-0 w-[285px] shrink-0 flex-col overflow-hidden border-l border-l-line bg-[#fbfcfe] max-[1251px]:w-65 max-[1081px]:hidden min-[1550px]:w-77.5">
            <Inspector data={data} activities={activity} sources={sources} />
          </aside>
        </div>
      </div>
      {notice && (
        <div
          className="fixed bottom-5.5 left-1/2 z-100 flex max-w-[calc(100%_-_24px)] -translate-x-1/2 items-center gap-2.5 rounded-[10px] border border-[#4c5970] bg-[#25334c] px-[17px] py-[13px] text-[11px] text-surface shadow-[0_6px_30px_#1c254022] [&_button]:ml-2 [&_button]:grid [&_button]:place-items-center"
          role="status"
        >
          <Check size={16} />
          <span>{notice}</span>
          <button aria-label="Đóng thông báo" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {(drawer || help) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17274455] backdrop-blur-[3px] [&:has([data-ui~=mobile-drawer])]:justify-start"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setDrawer(null);
              setHelp(false);
            }
          }}
        >
          <div
            data-ui={help ? '' : 'mobile-drawer'}
            className={
              help
                ? 'relative max-h-[90dvh] w-[min(480px,calc(100%_-_32px))] overflow-auto rounded-[18px] bg-surface p-8.5 shadow-[0_12px_70px_#111d3a30] max-[769px]:p-7 [&_h2]:m-[0_0_16px] [&_h2]:font-display [&_h2]:text-[25px] [&_h2]:leading-[1.5] [&_h2]:font-bold [&_h2]:tracking-[-.6px] max-[769px]:[&_h2]:text-[23px] [&_p]:m-[0_0_14px] [&_p]:text-[12px] [&_p]:leading-[1.9] [&_p]:text-muted'
                : 'relative flex h-full w-72.5 max-w-[90vw] flex-col overflow-auto bg-sidebar p-[32px_17px_0] [&_[data-ui~=brand]]:mb-8 [&_[data-ui~=inspector-heading]]:mt-4 max-[769px]:[&_[data-ui~=inspector-tabs]]:gap-5 [&:has([data-ui~=inspector-heading])]:ml-auto [&:has([data-ui~=inspector-heading])]:overflow-hidden [&:has([data-ui~=inspector-heading])]:bg-[#fbfcfe] [&:has([data-ui~=inspector-heading])]:p-[32px_0_0]'
            }
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={
              help ? 'Về trợ lý' : drawer === 'profile' ? 'Điều hướng' : 'Hoạt động agent'
            }
          >
            <button
              className="absolute top-3.5 right-3 z-3 inline-flex size-8.5 items-center justify-center rounded-[7px] text-muted hover:bg-[#edf1f8] max-[769px]:h-9.5 max-[769px]:w-9.5"
              aria-label="Đóng"
              onClick={() => {
                setDrawer(null);
                setHelp(false);
              }}
            >
              <X size={20} />
            </button>
            {help ? (
              <>
                <AtlasMark className="mb-4 size-13.5 text-cobalt" />
                <h2>
                  Hiểu ứng viên.
                  <br />
                  Từ những điều đã làm.
                </h2>
                <p>
                  Trợ lý đọc dữ liệu GitHub công khai bằng các công cụ có giới hạn. Mỗi câu trả lời
                  đi cùng nguồn để bạn tự đối chiếu.
                </p>
                <p>
                  Hoạt động bên cạnh là các bước thực sự của agent: phân loại câu hỏi, truy xuất dữ
                  liệu và tổng hợp. Hướng tìm hiểu là bản tóm tắt công khai, không phải suy nghĩ nội
                  bộ của mô hình.
                </p>
                <p>
                  Lịch sử chỉ lưu trên trình duyệt này. Câu hỏi và bằng chứng được gửi tới máy chủ
                  mô hình đã cấu hình; token GitHub luôn ở máy chủ ứng dụng.
                </p>
                <button
                  className="mt-5.5 flex items-center gap-[9px] rounded-[8px] bg-cobalt px-[15px] py-3 text-[12px] text-surface"
                  onClick={() => setHelp(false)}
                >
                  Bắt đầu khám phá <ArrowRight size={16} />
                </button>
              </>
            ) : drawer === 'profile' ? (
              sidebar
            ) : (
              <Inspector data={data} activities={activity} sources={sources} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chat({
  session,
  data,
  updateSession,
  connected,
  setRunning,
  onRepository,
  overview,
}: {
  session: Session;
  data: Bootstrap;
  updateSession: (id: string, messages: ChatMessage[]) => void;
  connected: boolean | null;
  setRunning: (running: boolean) => void;
  onRepository: (repository: string) => void;
  overview: CandidateOverviewState;
}) {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState('');
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [composerAttention, setComposerAttention] = useState(0);
  const nearBottom = useRef(true);
  const repositoryStarted = useRef(false);
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages, id, body }) => ({
          body: {
            ...body,
            id,
            messages: messages.slice(-24).map((m) => ({
              id: m.id,
              role: m.role,
              parts: m.parts.filter((p) => p.type === 'text'),
            })),
          },
        }),
      }),
    [],
  );
  const { messages, sendMessage, status, error, stop, regenerate, clearError } =
    useChat<ChatMessage>({ id: session.id, messages: session.messages, transport });
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => {
    if (!session.repository || session.messages.length || repositoryStarted.current) return;
    const timer = window.setTimeout(() => {
      if (repositoryStarted.current) return;
      repositoryStarted.current = true;
      void sendMessage(
        {
          text: `Giới thiệu nhanh dự án ${session.repository}: bài toán, công nghệ và điểm nên tìm hiểu sâu hơn.`,
        },
        { body: { action: 'repository', repository: session.repository } },
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session.repository, session.messages.length, sendMessage]);
  useEffect(() => {
    setRunning(busy);
    return () => setRunning(false);
  }, [busy, setRunning]);
  useEffect(() => {
    updateSession(session.id, messages);
  }, [messages, session.id, updateSession]);
  useEffect(
    () => () => {
      void stop();
    },
    [stop],
  );
  useEffect(() => {
    const container = scrollRef.current;
    if (messages.length && container && nearBottom.current)
      container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
  }, [messages, status]);
  useEffect(() => {
    if (!busy && messages.length) inputRef.current?.focus({ preventScroll: true });
  }, [busy, messages.length]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    clearError();
    setInput('');
    nearBottom.current = true;
    setShowJump(false);
    void sendMessage({ text: text.trim() });
  };
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(input);
  };
  const focusComposer = () => {
    const input = inputRef.current;
    if (!input) return;
    input.scrollIntoView({ block: 'nearest' });
    input.focus({ preventScroll: true });
    setComposerAttention((value) => value + 1);
  };
  const retry = () => {
    clearError();
    void regenerate(
      session.repository && messages.filter((m) => m.role === 'user').length === 1
        ? { body: { action: 'repository', repository: session.repository } }
        : undefined,
    );
  };
  const copy = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(textOf(m));
      setCopied(m.id);
      window.setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('failed');
    }
  };
  return (
    <>
      <div
        className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:#dce2ee_transparent] overflow-y-auto overscroll-contain"
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current!;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          setShowJump(!nearBottom.current);
        }}
      >
        {messages.length === 0 && !session.repository ? (
          <Welcome
            data={data}
            busy={busy}
            onAsk={submit}
            onRepository={onRepository}
            overview={overview}
            onCompose={focusComposer}
          />
        ) : (
          <div
            data-ui="message-list"
            className="mx-auto my-0 max-w-225 p-[26px_37px_24px] max-[1251px]:pr-[25px] max-[1251px]:pl-[25px] max-[769px]:px-[19px] max-[769px]:py-5.5"
          >
            <div className="m-[0_0_28px] text-center text-[9px] text-[#8591a6]">
              <span>Khám phá bằng chứng cùng {data.appName}</span>
            </div>
            {messages.map((m, index) => {
              const text = textOf(m);
              const isLast = index === messages.length - 1;
              const classification = m.parts.find((p) => p.type === 'data-classification')?.data;
              const sources = m.parts.find((p) => p.type === 'data-sources')?.data || [];
              const usage = m.parts.find((p) => p.type === 'data-usage')?.data;
              const progress = m.parts.find((p) => p.type === 'data-progress')?.data;
              const images = m.parts.find((p) => p.type === 'data-images')?.data || [];
              const activities = m.parts
                .filter((p) => p.type === 'data-activity')
                .map((p) =>
                  p.data.status === 'running' && (!busy || !isLast)
                    ? {
                        ...p.data,
                        status: 'error' as const,
                        detail: 'Luồng đã dừng trước khi bước này hoàn tất.',
                      }
                    : p.data,
                );
              return m.role === 'user' ? (
                <article
                  key={m.id}
                  data-ui="user-message"
                  className="m-[18px_0_30px] flex items-start justify-end gap-2.5 [&>div]:max-w-[88%] [&>div]:rounded-[13px_3px_13px_13px] [&>div]:bg-[#eef2fd] [&>div]:px-4 [&>div]:py-[13px] [&>div]:text-[12px] [&>div]:leading-[1.9] [&>div]:wrap-anywhere [&>div]:whitespace-pre-wrap [&>div]:text-[#2d3d67] max-[769px]:[&>div]:max-w-[94%] max-[769px]:[&>div]:text-[12px]"
                >
                  <div>{text}</div>
                  <span className="mt-[3px] grid size-7 shrink-0 place-items-center rounded-full border border-[#dfe6f3] bg-[#e8edf8] text-[8px] text-[#6e7fa2] max-[769px]:hidden">
                    Bạn
                  </span>
                </article>
              ) : (
                <article key={m.id} className="m-[0_0_34px]">
                  <div className="mb-[17px] flex items-center gap-2 [&>strong]:font-display [&>strong]:text-[12px] [&>strong]:font-[750]">
                    <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[8px] bg-pale-blue text-cobalt [&_svg]:h-6 [&_svg]:w-6">
                      <AtlasMark />
                    </span>
                    <strong>{data.appName}</strong>
                    <span className="ml-0.5 rounded-[4px] bg-[#f2f4f8] px-[5px] py-[3px] text-[8px] text-[#7c889d] max-[769px]:text-[7px]">
                      Trợ lý nghiên cứu
                    </span>
                  </div>
                  {classification && (
                    <div className="m-[0_0_12px] inline-flex items-center gap-[5px] rounded-[5px] bg-[#f0f3fc] px-2 py-1.5 text-[9px] text-[#556bb0] [&>span]:ml-[3px] [&>span]:border-l [&>span]:border-l-[#d9e1f5] [&>span]:pl-[7px] [&>span]:text-[8px] [&>span]:text-[#7887a3] max-[769px]:[&>span]:text-[7px]">
                      <ListFilter size={13} /> {intentLabels[classification.intent]}
                      <span>
                        {classification.method === 'model'
                          ? 'Phân loại bởi model'
                          : 'Định tuyến bằng quy tắc'}
                      </span>
                    </div>
                  )}
                  {activities.length > 0 && (
                    <details
                      className="mb-[17px] rounded-[8px] border border-line bg-[#fafbfe] [&_summary]:flex [&_summary]:cursor-pointer [&_summary]:list-none [&_summary]:items-center [&_summary]:gap-1.5 [&_summary]:px-[11px] [&_summary]:py-2.5 [&_summary]:text-[10px] [&_summary]:text-[#677996] [&_summary::-webkit-details-marker]:hidden [&_summary>svg:last-child]:ml-auto [&>div]:border-t [&>div]:border-t-line [&>div]:p-3 [&[open]_summary>svg:last-child]:rotate-180"
                      open={!text && busy && isLast ? true : undefined}
                    >
                      <summary>
                        <Workflow size={14} />
                        {text
                          ? activities.some((a) => a.kind === 'tool')
                            ? `${activities.filter((a) => a.kind === 'tool').length} lượt truy xuất · xem hoạt động`
                            : 'Định tuyến hội thoại · không đọc GitHub'
                          : busy && isLast
                            ? activities.at(-1)?.label || 'Đang tìm hiểu'
                            : 'Hoạt động truy xuất'}
                        <ChevronDown size={13} />
                      </summary>
                      <div>
                        {activities.map((a) => (
                          <div
                            className="flex items-start gap-2 px-0 py-[5px] text-[#6e809f] [&_small]:mt-[3px] [&_small]:block [&_small]:text-[9px] [&_small]:leading-[1.8] [&_small]:text-[#6e7a8f] [&_strong]:block [&_strong]:text-[10px] [&_strong]:font-medium [&>svg]:mt-[3px]"
                            key={a.id}
                          >
                            {a.status === 'running' && busy && isLast ? (
                              <LoaderCircle size={13} className="animate-spin" />
                            ) : a.status === 'error' ? (
                              <X size={13} />
                            ) : (
                              <Check size={13} />
                            )}
                            <span>
                              <strong>{a.label}</strong>
                              <small>{a.detail}</small>
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {text && (
                    <EvidenceMarkdown text={text} sources={sources} streaming={busy && isLast} />
                  )}
                  <ProjectGallery images={images} sources={sources} scope={data.scope} />
                  {busy && isLast && !text && <PreparationStatus progress={progress} />}
                  {!text && !busy && usage?.finishReason !== 'length' && (
                    <p data-ui="empty-answer" className="text-[11px] leading-[1.8] text-[#7d7180]">
                      Chưa có câu trả lời hoàn chỉnh. Bạn có thể thử lại hoặc hỏi cụ thể về một
                      repo.
                    </p>
                  )}
                  {sources.length > 0 && (
                    <div
                      data-ui="answer-sources"
                      className="mt-[21px] border-t border-t-line pt-[13px] [&_details_[data-ui~=source-chip]]:m-[3px] [&_details_summary]:cursor-pointer [&_details_summary]:p-[5px] [&_details_summary]:text-[9px] [&_details_summary]:text-muted [&>div]:flex [&>div]:flex-wrap [&>div]:gap-1.5 [&>span]:mb-[9px] [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:text-[9px] [&>span]:text-[#7888a1]"
                    >
                      <span>
                        <BookOpen size={13} /> Đã truy xuất {sources.length} nguồn
                      </span>
                      <div>
                        {sources.slice(0, 5).map((s) => (
                          <SourceLink key={s.url} source={s} />
                        ))}
                        {sources.length > 5 && (
                          <details>
                            <summary>+{sources.length - 5} nguồn</summary>
                            {sources.slice(5).map((s) => (
                              <SourceLink key={s.url} source={s} />
                            ))}
                          </details>
                        )}
                      </div>
                    </div>
                  )}
                  {usage?.finishReason === 'length' && (
                    <div
                      data-ui="limit-note"
                      className="mt-[15px] rounded-[9px] border border-[#e9dcc5] bg-[#fffaf0] px-[15px] py-[13px] text-[11px] leading-[1.8] text-[#786243] [&_button]:inline-flex [&_button]:items-center [&_button]:gap-1.5 [&_button]:rounded-[6px] [&_button]:border [&_button]:border-[#dfcfb7] [&_button]:bg-surface [&_button]:px-2.5 [&_button]:py-[7px] [&_button:disabled]:opacity-50 [&_p]:m-[5px_0_10px] [&_strong]:font-medium"
                      role="status"
                    >
                      <strong>
                        {text
                          ? 'Câu trả lời chưa hoàn tất.'
                          : 'Chưa có nội dung trả lời hoàn chỉnh.'}
                      </strong>
                      <p>
                        Luồng đã dừng ở giới hạn sinh của lượt này. Bạn có thể yêu cầu bản ngắn hơn
                        để tập trung vào kết luận chính.
                      </p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          submit(
                            'Hãy tóm tắt câu trả lời cho câu hỏi trước trong tối đa 100 từ, chỉ giữ kết luận và nguồn quan trọng nhất.',
                          )
                        }
                      >
                        <RefreshCw size={13} /> Nhận bản tóm tắt
                      </button>
                    </div>
                  )}
                  {text && !(busy && isLast) && (
                    <div
                      data-ui="message-actions"
                      className="mt-[15px] flex flex-wrap items-center gap-[13px] max-[769px]:gap-3 [&_button]:flex [&_button]:items-center [&_button]:gap-[5px] [&_button]:px-0 [&_button]:py-1 [&_button]:text-[9px] [&_button]:text-[#7d8ba0] [&_button:hover]:text-cobalt [&>span]:ml-auto [&>span]:text-[8px] [&>span]:text-[#78879f]"
                    >
                      <button onClick={() => copy(m)} aria-label="Sao chép câu trả lời">
                        {copied === m.id ? <CheckCheck size={15} /> : <Copy size={15} />}
                        {copied === m.id ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                      {isLast && (
                        <button onClick={retry}>
                          <RefreshCw size={14} /> Trả lời lại
                        </button>
                      )}
                      {usage && (
                        <span
                          title={
                            usage.firstTextMs !== undefined
                              ? `Token trả lời đầu tiên sau ${(usage.firstTextMs / 1000).toFixed(1)}s; phân loại ${((usage.classificationMs || 0) / 1000).toFixed(1)}s`
                              : undefined
                          }
                        >
                          {usage.firstTextMs !== undefined &&
                            `Chờ ${(usage.firstTextMs / 1000).toFixed(1)}s · `}
                          {(usage.elapsedMs / 1000).toFixed(1)}s tổng ·{' '}
                          {usage.outputTokens.toLocaleString('vi-VN')} tokens sinh
                        </span>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {busy && messages.at(-1)?.role !== 'assistant' && <PreparationStatus />}
            {error && (
              <div
                data-ui="chat-error"
                className="flex items-center justify-between gap-2.5 rounded-[9px] border border-[#eedad0] bg-[#fff7f0] px-3.5 py-[13px] text-[11px] leading-[1.8] text-[#985e3c] max-[769px]:flex-col max-[769px]:items-start [&_button]:flex [&_button]:items-center [&_button]:gap-[5px] [&_button]:rounded-[5px] [&_button]:border [&_button]:border-[#edcfb9] [&_button]:bg-[#ffefdf] [&_button]:px-2 [&_button]:py-[5px] [&_button]:text-[10px] [&_button]:whitespace-nowrap"
                role="alert"
              >
                <span>
                  {error.message.startsWith('{')
                    ? 'Không thể gửi câu hỏi. Kiểm tra kết nối và thử lại.'
                    : error.message}
                </span>
                <button onClick={retry}>
                  <RefreshCw size={14} /> Thử lại
                </button>
              </div>
            )}
            {copied === 'failed' && (
              <p role="status">
                Không sao chép được. Bạn có thể chọn và sao chép văn bản trực tiếp.
              </p>
            )}
          </div>
        )}
      </div>
      {showJump && (
        <button
          className="absolute bottom-47.5 left-1/2 z-2 grid size-8.5 place-items-center rounded-full border border-line bg-surface shadow-[0_2px_9px_#1c254015]"
          onClick={() => {
            nearBottom.current = true;
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: 'smooth',
            });
            setShowJump(false);
          }}
          aria-label="Cuộn đến phản hồi mới nhất"
        >
          <ArrowDown size={17} />
        </button>
      )}
      <div className="w-full max-w-232.5 shrink-0 [align-self:center] bg-surface p-[12px_36px_16px] max-[1251px]:pr-[25px] max-[1251px]:pl-[25px] max-[1081px]:max-w-190 max-[769px]:p-[10px_15px_max(10px,env(safe-area-inset-bottom))]">
        {messages.length > 0 && !busy && (
          <div className="mb-3 flex flex-wrap gap-2 [&_button]:flex [&_button]:items-center [&_button]:gap-[7px] [&_button]:rounded-[16px] [&_button]:border [&_button]:border-line [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-[10px] [&_button]:text-muted max-[769px]:[&_button]:text-[9px] [&_button:hover]:border-[#c4d0f5] [&_button:hover]:text-cobalt">
            {['Điểm mạnh nổi bật là gì?', 'Dẫn chứng từ code cụ thể?'].map((q) => (
              <button key={q} onClick={() => submit(q)}>
                {q}
                <Plus size={12} />
              </button>
            ))}
          </div>
        )}
        <form
          data-ui={`composer ${busy ? 'composer-busy' : ''}`}
          className="relative isolate rounded-[15px] border border-[#d9dfec] bg-surface p-[16px_16px_11px] shadow-[0_6px_24px_#29345a09,0_2px_5px_#29345a04] transition-[border-color] duration-150 focus-within:border-[#8c9fe9] focus-within:shadow-[0_0_0_3px_#3658e909,0_6px_24px_#29345a09] max-[769px]:rounded-[13px] max-[769px]:p-[13px_13px_10px] [&_textarea]:max-h-45 [&_textarea]:min-h-10.5 [&_textarea]:w-full [&_textarea]:resize-none [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:text-[12px] [&_textarea]:leading-[1.7] [&_textarea]:text-ink [&_textarea]:outline-none max-[769px]:[&_textarea]:min-h-9.5 max-[769px]:[&_textarea]:text-[13px] min-[1550px]:[&_textarea]:text-[14px] [&_textarea::placeholder]:text-[#7a8497] [&_textarea:focus-visible]:outline-none"
          onSubmit={handleSubmit}
        >
          {composerAttention > 0 && (
            <span
              key={composerAttention}
              className="pointer-events-none absolute -inset-1 -z-10 animate-composer-attention rounded-[19px] bg-[conic-gradient(from_var(--composer-border-angle),_transparent_0deg_100deg,_#06b6d4_150deg,_#2563ff_215deg,_#7c3aed_285deg,_#38d9ff_325deg,_transparent_360deg)] after:absolute after:inset-1 after:rounded-[15px] after:bg-surface motion-reduce:[animation:composer-border-fade_3.6s_ease-out_forwards] motion-reduce:bg-cobalt max-[769px]:rounded-[17px] max-[769px]:after:rounded-[13px]"
              aria-hidden="true"
            />
          )}
          <label
            htmlFor="question"
            className="mb-[7px] block text-[11px] font-medium text-ink max-[769px]:text-[11px]"
          >
            Câu hỏi về ứng viên
          </label>
          <textarea
            ref={inputRef}
            id="question"
            value={input}
            maxLength={6000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ví dụ: Dự án nào thể hiện kỹ năng React?"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(input);
              }
            }}
          />
          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-[#5d6980] max-[769px]:text-[10px]">
              <span
                data-ui={`model-orb ${connected ? 'ready' : ''}`}
                className="relative h-[13px] w-[13px] rounded-[4px] border border-[#c3cee9] bg-[#e9edf9] after:absolute after:top-[3px] after:left-[3px] after:h-1 after:w-1 after:rounded-full after:bg-[#7d8cae] after:[content:''] [&[data-ui~=ready]::after]:bg-mint"
              />
              <span>{data.model || 'Chưa cấu hình model'}</span>
              <span className="ml-0.5 rounded-[4px] bg-[#f0f2f7] px-[5px] py-[3px] text-[8px] text-[#6a758a]">
                Ollama
              </span>
            </div>
            <div className="flex items-center gap-3 max-[769px]:gap-1.5">
              <span className="text-[9px] text-[#8891a3] max-[769px]:hidden">
                {input.length > 5500 ? `${input.length}/6000` : 'Enter để gửi'}
              </span>
              {busy ? (
                <button
                  type="button"
                  onClick={() => void stop()}
                  className="grid h-[33px] w-[33px] place-items-center rounded-[9px] bg-[#e9edfc] text-cobalt hover:bg-cobalt-hover disabled:bg-[#eef1f7] disabled:text-[#98a3b8] max-[769px]:h-9.5 max-[769px]:w-9.5"
                  aria-label="Dừng phản hồi"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="grid h-[33px] w-[33px] place-items-center rounded-[9px] bg-cobalt text-surface hover:bg-cobalt-hover disabled:bg-[#eef1f7] disabled:text-[#98a3b8] max-[769px]:h-9.5 max-[769px]:w-9.5"
                  disabled={!input.trim()}
                  aria-label="Gửi câu hỏi"
                >
                  <ArrowUp size={19} />
                </button>
              )}
            </div>
          </div>
        </form>
        <div className="m-[11px_0_0] flex items-center justify-center gap-[5px] text-[8px] leading-[1.6] text-[#7a8496] max-[769px]:text-[8px]">
          <ShieldCheck size={12} />
          <span>AI có thể nhận định chưa chính xác. Luôn đối chiếu nguồn.</span>
          <span className="ml-auto whitespace-nowrap text-[#808a9c] max-[1251px]:hidden">
            ⌘ K để nhập
          </span>
        </div>
      </div>
    </>
  );
}

function Inspector({
  data,
  activities,
  sources,
}: {
  data: Bootstrap;
  activities: Activity[];
  sources: Evidence[];
}) {
  const uid = useId();
  const [tab, setTab] = useState<'activity' | 'sources'>('activity');
  const [expandedRepos, setExpandedRepos] = useState(false);
  const profile = data.profile;
  const languages = [
    ...new Set(
      data.repositories
        .filter((r) => !r.fork)
        .map((r) => r.language)
        .filter(Boolean),
    ),
  ];
  return (
    <div data-ui="inspector" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="max-h-[45%] min-h-0 [scrollbar-width:thin] overflow-y-auto">
        <div
          data-ui="inspector-heading"
          className="m-[23px_20px_21px] flex items-center justify-between [&>span:first-child]:flex [&>span:first-child]:items-center [&>span:first-child]:gap-[7px] [&>span:first-child]:text-[10px] [&>span:first-child]:font-medium"
        >
          <span>
            <BookOpen size={16} /> Hồ sơ & nguồn đối chiếu
          </span>
        </div>
        <div className="m-[0_18px_22px] rounded-[12px] border border-line bg-surface p-[18px_15px_10px] [&_h2]:m-[15px_0_7px] [&_h2]:font-display [&_h2]:text-[16px] [&_h2]:font-[750] [&_h2]:tracking-[-.4px] [&_h2]:wrap-anywhere [&>p:not([data-ui~=evidence-note])]:m-0 [&>p:not([data-ui~=evidence-note])]:text-[10px] [&>p:not([data-ui~=evidence-note])]:leading-[1.8] [&>p:not([data-ui~=evidence-note])]:text-muted">
          <div className="flex items-center justify-between gap-1.5 [&_img]:rounded-[14px] [&_img]:border [&_img]:border-line [&_img]:object-cover">
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={`Ảnh đại diện ${profile.login}`}
                width={52}
                height={52}
              />
            ) : (
              <div className="grid size-13 place-items-center rounded-[14px] bg-pale-blue text-cobalt">
                <UserRound size={25} />
              </div>
            )}
            <span className="flex items-center gap-1 rounded-[5px] bg-[#f0f8f4] px-1.5 py-[5px] text-[8px] text-mint">
              <Github size={12} /> Nguồn công khai
            </span>
          </div>
          <h2>{profile?.name || profile?.login || 'Ứng viên'}</h2>
          <p>{profile?.bio || 'Hồ sơ và kho mã nguồn GitHub công khai.'}</p>
          {profile?.location && (
            <span className="mt-2 flex items-center gap-1 text-[9px] text-muted">
              <MapPin size={12} />
              {profile.location}
            </span>
          )}
          <div className="mx-0 my-4.5 grid grid-cols-[.9fr_1.5fr_.9fr] gap-1 [&_span]:mt-[5px] [&_span]:block [&_span]:text-[8px] [&_span]:whitespace-nowrap [&_span]:text-muted [&_strong]:block [&_strong]:font-display [&_strong]:text-[19px] [&_strong]:font-[650] [&>div]:border-r [&>div]:border-r-line [&>div]:pr-[7px] [&>div+div]:pl-2 max-[1251px]:[&>div+div]:pl-1 [&>div:last-child]:border-r-0">
            <div>
              <strong>{profile ? data.repositories.filter((r) => !r.fork).length : '—'}</strong>
              <span>Repo gốc</span>
            </div>
            <div>
              <strong>{profile ? languages.length : '—'}</strong>
              <span>Ngôn ngữ chính</span>
            </div>
            <div>
              <strong>{profile ? data.repositories.filter((r) => r.fork).length : '—'}</strong>
              <span>Repo fork</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-[5px] [&_span]:rounded-[4px] [&_span]:bg-[#f2f4f9] [&_span]:px-1.5 [&_span]:py-1 [&_span]:text-[8px] [&_span]:text-[#66718a]">
            {languages.slice(0, 5).map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <p
            data-ui="evidence-note"
            className="m-[12px_0_0] text-[8px] leading-[1.75] text-[#788296]"
          >
            Thống kê trong phạm vi đã cấu hình, không phải đánh giá trình độ.
          </p>
        </div>
      </div>
      <div
        data-ui="inspector-tabs"
        className="flex shrink-0 gap-5 border-b border-b-line px-[19px] py-0 [&_button]:relative [&_button]:flex [&_button]:items-center [&_button]:gap-[5px] [&_button]:p-[0_0_11px] [&_button]:text-[10px] [&_button]:text-muted [&_button_span]:rounded-[4px] [&_button_span]:bg-[#edf0f7] [&_button_span]:px-1 [&_button_span]:py-0.5 [&_button_span]:text-[8px] [&_button_span]:text-[#768199] [&_button[aria-selected=true]]:font-medium [&_button[aria-selected=true]]:text-cobalt [&_button[aria-selected=true]::after]:absolute [&_button[aria-selected=true]::after]:right-0 [&_button[aria-selected=true]::after]:-bottom-[1px] [&_button[aria-selected=true]::after]:left-0 [&_button[aria-selected=true]::after]:h-0.5 [&_button[aria-selected=true]::after]:rounded-[2px] [&_button[aria-selected=true]::after]:bg-cobalt [&_button[aria-selected=true]::after]:[content:'']"
        role="tablist"
        aria-label="Chi tiết nghiên cứu"
      >
        <button
          role="tab"
          id={`${uid}-activity-tab`}
          aria-controls={`${uid}-activity-panel`}
          aria-selected={tab === 'activity'}
          onClick={() => setTab('activity')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              setTab('sources');
              document.getElementById(`${uid}-sources-tab`)?.focus();
            }
          }}
        >
          Hoạt động {activities.length > 0 && <span>{activities.length}</span>}
        </button>
        <button
          role="tab"
          id={`${uid}-sources-tab`}
          aria-controls={`${uid}-sources-panel`}
          aria-selected={tab === 'sources'}
          onClick={() => setTab('sources')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              setTab('activity');
              document.getElementById(`${uid}-activity-tab`)?.focus();
            }
          }}
        >
          Nguồn dữ liệu <span>{sources.length}</span>
        </button>
      </div>
      <div
        data-ui="inspector-scroll"
        className="min-h-16 flex-1 [scrollbar-width:thin] overflow-y-auto overscroll-contain"
      >
        {tab === 'activity' ? (
          <div role="tabpanel" id={`${uid}-activity-panel`} aria-labelledby={`${uid}-activity-tab`}>
            {activities.length ? (
              <div className="p-[21px_20px_8px]">
                {activities.map((a) => (
                  <div
                    data-ui={`activity-step ${a.status}`}
                    className="relative flex gap-[9px] pb-[19px] [&_p]:mx-0 [&_p]:my-[5px] [&_p]:text-[9px] [&_p]:leading-[1.8] [&_p]:wrap-anywhere [&_p]:text-[#75829a] [&_small]:text-[8px] [&_small]:text-[#8897ac] [&_strong]:mt-[3px] [&_strong]:block [&_strong]:text-[10px] [&_strong]:font-medium [&:not(:last-child)::before]:absolute [&:not(:last-child)::before]:top-[23px] [&:not(:last-child)::before]:left-2.5 [&:not(:last-child)::before]:h-[calc(100%_-_18px)] [&:not(:last-child)::before]:border-l [&:not(:last-child)::before]:border-l-[#dfe6f1] [&:not(:last-child)::before]:[content:''] [&[data-ui~=error]_[data-ui~=activity-icon]]:border-[#efd8cc] [&[data-ui~=error]_[data-ui~=activity-icon]]:bg-[#fff0e8] [&[data-ui~=error]_[data-ui~=activity-icon]]:text-[#a6563d] [&[data-ui~=running]_[data-ui~=activity-icon]]:border-[#d8e1ff] [&[data-ui~=running]_[data-ui~=activity-icon]]:bg-pale-blue [&[data-ui~=running]_[data-ui~=activity-icon]]:text-cobalt"
                    key={a.id}
                  >
                    <div
                      data-ui="activity-icon"
                      className="grid size-5.5 shrink-0 place-items-center rounded-full border border-[#cde8dc] bg-[#edf8f2] text-mint"
                    >
                      {a.status === 'running' ? (
                        <LoaderCircle size={13} className="animate-spin" />
                      ) : a.status === 'error' ? (
                        <X size={13} />
                      ) : (
                        <Check size={13} />
                      )}
                    </div>
                    <div>
                      <strong>{a.label}</strong>
                      <p>{a.detail}</p>
                      {a.elapsedMs !== undefined && (
                        <small>{(a.elapsedMs / 1000).toFixed(1)} giây</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-5.5 text-left [&_h3]:m-[0_0_8px] [&_h3]:text-[12px] [&_h3]:leading-[1.65] [&_h3]:font-semibold [&>p]:m-0 [&>p]:text-[11px] [&>p]:leading-[1.9] [&>p]:text-muted">
                <h3>Câu trả lời đến từ đâu?</h3>
                <p>Khi bạn hỏi về ứng viên, xem các bước tìm kiếm và nguồn đã đọc tại đây.</p>
                <ul className="m-[18px_0_0] flex list-none flex-col gap-[13px] p-0 text-muted [&_li]:flex [&_li]:items-center [&_li]:gap-[9px] [&_li]:text-[11px] [&_li]:leading-[1.6] [&_svg]:text-muted">
                  <li>
                    <ListFilter size={15} aria-hidden="true" />
                    Hiểu câu hỏi của bạn
                  </li>
                  <li>
                    <Search size={15} aria-hidden="true" />
                    Đọc repo liên quan khi cần
                  </li>
                  <li>
                    <BookOpen size={15} aria-hidden="true" />
                    Dẫn nguồn cho nhận định
                  </li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div
            role="tabpanel"
            id={`${uid}-sources-panel`}
            aria-labelledby={`${uid}-sources-tab`}
            className="p-[10px_19px_18px] [&_a_svg:last-child]:ml-auto [&_small]:mt-[7px] [&_small]:block [&_small]:pl-5.5 [&_small]:text-[8px] [&_small]:text-[#7e8da4] [&_strong]:text-[10px] [&_strong]:font-medium [&_strong]:wrap-anywhere [&>a]:block [&>a]:border-b [&>a]:border-b-line [&>a]:px-0 [&>a]:py-[13px] [&>a>span]:flex [&>a>span]:items-center [&>a>span]:gap-[7px] [&>a>span]:text-[#687e9e]"
          >
            {sources.length ? (
              sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                  <span>
                    <FileText size={15} />
                    <strong>{s.title}</strong>
                    <ArrowUpRight size={14} />
                  </span>
                  <small>
                    {s.kind === 'profile'
                      ? 'Hồ sơ công khai'
                      : s.kind === 'repository'
                        ? 'Repository'
                        : s.kind === 'activity'
                          ? 'Hoạt động GitHub'
                          : 'Tệp trong repo'}
                  </small>
                </a>
              ))
            ) : (
              <div className="px-2.5 py-[25px] text-center text-[#8292ad] [&_p]:text-[10px] [&_p]:leading-[1.8] [&_svg]:m-auto">
                <BookOpen size={24} />
                <p>Nguồn được thêm sau khi agent thực sự truy xuất dữ liệu.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <section
        aria-label="Kho mã nguồn"
        className="mx-[19px] flex max-h-[min(256px,36dvh)] min-h-[min(160px,30dvh)] shrink-0 basis-56 flex-col border-t border-line py-4"
      >
        <div className="mb-[9px] flex shrink-0 items-center justify-between [&_h3]:m-0 [&_h3]:text-[10px] [&_h3]:font-medium [&>span]:text-[9px] [&>span]:text-faint">
          <h3>Kho mã nguồn</h3>
          <span>{data.repositories.length}</span>
        </div>
        <div
          data-ui="inspector-repositories"
          className="min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto overscroll-contain"
        >
          {data.repositories.slice(0, expandedRepos ? undefined : 3).map((r) => (
            <a
              href={r.url}
              key={r.name}
              className="flex items-start gap-[9px] px-0 py-2.5 text-[#65758b] [&_em]:ml-[3px] [&_em]:rounded-[3px] [&_em]:border [&_em]:border-[#e0e5ef] [&_em]:px-[3px] [&_em]:py-0 [&_em]:not-italic [&_span]:mt-1.5 [&_span]:flex [&_span]:items-center [&_span]:gap-1 [&_span]:text-[8px] [&_span]:text-[#7b879b] [&_strong]:block [&_strong]:max-w-41 [&_strong]:overflow-hidden [&_strong]:text-[9px] [&_strong]:font-medium [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-[#4c5c78] [&:hover_strong]:text-cobalt [&>div]:min-w-0 [&>svg:first-child]:mt-0.5 [&>svg:last-child]:mt-0.5 [&>svg:last-child]:ml-auto"
              target="_blank"
              rel="noreferrer"
            >
              <FolderGit2 size={15} />
              <div>
                <strong>{r.name}</strong>
                <span>
                  <i
                    data-ui={`language-dot lang-${r.language?.toLowerCase().replace(/[^a-z]/g, '')}`}
                    className="h-[5px] w-[5px] rounded-full bg-[#94a6d3] [&[data-ui~=lang-c]]:bg-[#b58bc9] [&[data-ui~=lang-javascript]]:bg-[#c9ac49] [&[data-ui~=lang-python]]:bg-[#739e87] [&[data-ui~=lang-typescript]]:bg-[#578cca]"
                  />
                  {r.language || 'Chưa có ngôn ngữ'}
                  {r.fork && <em>Fork</em>}
                </span>
              </div>
              <ArrowUpRight size={13} />
            </a>
          ))}
        </div>
        {data.repositories.length > 3 && (
          <button
            className="flex shrink-0 items-center gap-1.5 p-[10px_0_0] text-[9px] text-[#687b9a] hover:text-cobalt"
            onClick={() => setExpandedRepos((v) => !v)}
          >
            {expandedRepos ? 'Thu gọn' : `Xem tất cả ${data.repositories.length} repo`}
            <ChevronDown size={13} className={expandedRepos ? 'rotate-180' : ''} />
          </button>
        )}
      </section>
      <div className="flex shrink-0 items-center gap-[9px] border-t border-t-line px-5 py-[17px] text-[#7485a2] [&_p]:m-0 [&_p]:text-[9px] [&_p]:leading-[1.8] [&_p]:text-[#5d6d87] [&_p_span]:text-[8px] [&_p_span]:text-[#7c879b]">
        <ShieldCheck size={15} />
        <p>
          Dữ liệu thật. Nguồn rõ ràng.
          <br />
          <span>Không suy đoán thông tin cá nhân.</span>
        </p>
      </div>
    </div>
  );
}
