import { useEffect, useState } from 'react';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Github } from './brand';
import type { Evidence, Progress } from '@/lib/types';

export function EvidenceMarkdown({
  text,
  sources,
  streaming = false,
}: {
  text: string;
  sources: Evidence[];
  streaming?: boolean;
}) {
  return (
    <div
      data-ui="markdown"
      className="text-[14px] leading-[1.95] wrap-anywhere text-[#37425b] max-[769px]:text-[14px] [&_a]:border-b [&_a]:border-b-[#cdd8f6] [&_a]:text-[#365ac1] [&_a_svg]:ml-0.5 [&_a_svg]:inline [&_a_svg]:align-baseline [&_a:hover]:bg-[#edf2ff] [&_blockquote]:mx-0 [&_blockquote]:my-4 [&_blockquote]:border-l-3 [&_blockquote]:border-l-[#9aaceb] [&_blockquote]:bg-[#f6f8fd] [&_blockquote]:px-[15px] [&_blockquote]:py-3 [&_blockquote]:text-[12px] [&_blockquote]:text-[#5e7295] [&_blockquote_p:last-child]:mb-0 [&_code]:rounded-[4px] [&_code]:bg-[#f0f3f9] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-[#466098] [&_h1]:m-[23px_0_11px] [&_h1]:font-display [&_h1]:text-[23px] [&_h1]:leading-[1.5] [&_h1]:font-[750] [&_h1]:text-ink [&_h2]:m-[23px_0_11px] [&_h2]:font-display [&_h2]:text-[19px] [&_h2]:leading-[1.5] [&_h2]:font-[750] [&_h2]:text-ink [&_h3]:m-[23px_0_11px] [&_h3]:font-display [&_h3]:text-[16px] [&_h3]:leading-[1.5] [&_h3]:font-[750] [&_h3]:text-ink [&_hr]:mx-0 [&_hr]:my-5.5 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-t-line [&_li]:mb-[7px] [&_li]:pl-0.5 [&_li>p]:mb-[7px] [&_ol]:m-[10px_0_18px] [&_ol]:list-decimal [&_ol]:pl-[21px] [&_p]:m-[0_0_14px] [&_pre]:mx-0 [&_pre]:my-[15px] [&_pre]:max-w-full [&_pre]:overflow-auto [&_pre]:rounded-[8px] [&_pre]:border [&_pre]:border-line [&_pre]:bg-[#f3f5fb] [&_pre]:p-4 [&_pre]:leading-[1.6] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[11px] [&_strong]:font-semibold [&_strong]:text-[#273653] [&_table]:m-[14px_0_20px] [&_table]:block [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-x-auto [&_table]:text-[11px] [&_td]:min-w-25 [&_td]:border [&_td]:border-[#e0e6f0] [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-left [&_td]:align-top [&_th]:min-w-25 [&_th]:border [&_th]:border-[#e0e6f0] [&_th]:bg-[#f3f6fc] [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:align-top [&_th]:font-medium [&_ul]:m-[10px_0_18px] [&_ul]:list-disc [&_ul]:pl-[21px] [&>*:first-child]:mt-0"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            sources.some((s) => s.url === href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
                <ArrowUpRight size={12} />
              </a>
            ) : (
              <span title="Liên kết chưa được công cụ xác minh">{children}</span>
            ),
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >
        {text}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block h-[15px] w-[5px] animate-stream-blink rounded-[2px] bg-cobalt align-middle" />
      )}
    </div>
  );
}

export function PreparationStatus({ progress }: { progress?: Progress }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((progress?.elapsedMs || 0) / 1000));
  useEffect(() => {
    const at = Date.now();
    const elapsedMs = progress?.elapsedMs || 0;
    const tick = () => setElapsed(Math.max(0, Math.floor((elapsedMs + Date.now() - at) / 1000)));
    const initialTick = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(timer);
    };
  }, [progress]);
  return (
    <div
      data-ui="preparation-status"
      className="m-[10px_0_20px] rounded-[11px] border border-line bg-[#f9fbff] p-4 [&_[data-ui~=wait-explanation]]:mt-3.5 [&_[data-ui~=wait-explanation]]:border-t [&_[data-ui~=wait-explanation]]:border-t-line [&_[data-ui~=wait-explanation]]:pt-2.5 [&_[data-ui~=wait-explanation]]:text-[10px] [&_p]:m-[9px_0_0] [&_p]:text-[11px] [&_p]:leading-[1.85] [&_p]:text-muted"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 text-[12px] font-medium text-[#4d64a1] [&_small]:ml-auto [&_small]:text-[10px] [&_small]:text-muted [&_small]:tabular-nums">
        <LoaderCircle size={16} className="animate-spin" />
        <span role="status">{progress?.label || 'Đang chuẩn bị phản hồi'}</span>
        <small aria-hidden="true">{elapsed}s</small>
      </div>
      <p>{progress?.detail || 'Đang gửi câu hỏi và chờ máy chủ bắt đầu xử lý.'}</p>
      <div
        className="mt-4 flex flex-col gap-2 [&_i]:block [&_i]:h-[7px] [&_i]:w-[83%] [&_i]:rounded-[6px] [&_i]:bg-[#e9edf7] [&_i:last-child]:w-[56%]"
        aria-hidden="true"
      >
        <i />
        <i />
      </div>
      {elapsed >= 15 && (
        <p data-ui="wait-explanation">
          Model local có thể cần thời gian tải vào bộ nhớ, chờ lượt xử lý hoặc phân tích trước token
          đầu tiên. Bạn có thể dừng bất cứ lúc nào.
        </p>
      )}
    </div>
  );
}

export function SourceLink({ source }: { source: Evidence }) {
  return (
    <a
      data-ui="source-chip"
      className="inline-flex max-w-full items-center gap-1 rounded-[5px] border border-line bg-[#fbfcff] px-[7px] py-[5px] text-[8px] text-[#657998] hover:border-[#bdccf6] hover:text-cobalt [&_span]:max-w-[205px] [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Github size={12} />
      <span>{source.title}</span>
      <ArrowUpRight size={11} />
    </a>
  );
}
