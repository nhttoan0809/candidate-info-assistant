/* eslint-disable @next/next/no-img-element -- Render retrieved GitHub assets directly, preserving verified source URLs and referrer policy. */
'use client';

import { useState } from 'react';
import { ArrowUpRight, ImageIcon } from 'lucide-react';
import { isSafeProjectImage } from '@/lib/project-images';
import { parseScope } from '@/lib/scope';
import type { Evidence, ProjectImage } from '@/lib/types';

export function ProjectGallery({
  images,
  sources,
  scope,
}: {
  images: ProjectImage[];
  sources: Evidence[];
  scope: string;
}) {
  let trusted: ProjectImage[] = [];
  try {
    const configured = parseScope(scope);
    trusted = images.filter(
      (img) => isSafeProjectImage(img, configured) && sources.some((s) => s.url === img.sourceUrl),
    );
  } catch {
    return null;
  }
  if (!trusted.length) return null;
  return (
    <section className="m-[22px_0_16px]" aria-label="Hình ảnh dự án">
      <div className="flex items-center gap-[7px] text-[#536a9a] [&_h3]:m-0 [&_h3]:text-[12px] [&_h3]:font-medium [&>span]:ml-auto [&>span]:text-[9px] [&>span]:text-muted">
        <ImageIcon size={16} />
        <h3>Hình ảnh từ dự án</h3>
        <span>{trusted.length} ảnh</span>
      </div>
      <p className="m-[9px_0_13px] text-[10px] leading-[1.8] text-muted max-[601px]:text-[11px]">
        Ảnh được tìm trong README hoặc thư mục screenshot. Bấm ảnh để xem kích thước gốc.
      </p>
      <div className="grid grid-cols-2 gap-3 max-[601px]:grid-cols-1">
        {trusted.map((img) => (
          <ProjectImageCard image={img} key={img.id} />
        ))}
      </div>
    </section>
  );
}

function ProjectImageCard({ image }: { image: ProjectImage }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="m-0 min-w-0 overflow-hidden rounded-[11px] border border-line bg-surface [&_figcaption]:p-3 [&_figcaption_strong]:block [&_figcaption_strong]:text-[11px] [&_figcaption_strong]:leading-[1.7] [&_figcaption_strong]:font-medium [&_figcaption_strong]:wrap-anywhere [&_figcaption_strong]:text-ink [&_figcaption>a]:mt-[9px] [&_figcaption>a]:inline-flex [&_figcaption>a]:items-center [&_figcaption>a]:gap-1 [&_figcaption>a]:px-0 [&_figcaption>a]:py-[3px] [&_figcaption>a]:text-[10px] [&_figcaption>a]:text-[#4366ae] max-[601px]:[&_figcaption>a]:min-h-8.5 [&_figcaption>span]:mt-1 [&_figcaption>span]:block [&_figcaption>span]:text-[9px] [&_figcaption>span]:leading-[1.8] [&_figcaption>span]:text-muted">
      {failed ? (
        <div
          className="flex aspect-[16/10] flex-col items-center justify-center gap-[9px] bg-canvas p-5 text-center text-[10px] leading-[1.8] text-muted"
          role="status"
        >
          <ImageIcon size={24} />
          <span>Chưa tải được ảnh. Bạn có thể mở file gốc trên GitHub ở bên dưới.</span>
        </div>
      ) : (
        <a
          className="relative block aspect-[16/10] bg-[#eef2f8] max-[601px]:aspect-[16/11] [&_img]:block [&_img]:h-full [&_img]:w-full [&_img]:object-contain [&:hover_[data-ui~=image-expand]]:bg-pale-blue"
          href={image.src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Xem ảnh gốc: ${image.alt}`}
        >
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
          <span
            data-ui="image-expand"
            className="absolute right-[9px] bottom-[9px] grid size-7 place-items-center rounded-[6px] border border-line bg-[#ffffffed] text-cobalt"
          >
            <ArrowUpRight size={16} />
          </span>
        </a>
      )}
      <figcaption>
        <strong>{image.alt}</strong>
        <span>
          {image.repository} · {image.fork ? 'Repo fork · ' : ''}
          {image.origin === 'readme' ? 'Được README tham chiếu' : 'File ảnh trong repo'}
        </span>
        <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
          Xem nguồn GitHub <ArrowUpRight size={12} />
        </a>
      </figcaption>
    </figure>
  );
}
