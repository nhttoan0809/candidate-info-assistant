import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Candidate Atlas · Khám phá ứng viên qua bằng chứng',
  description:
    'Trò chuyện với agent để tìm hiểu dự án, kỹ năng và hồ sơ ứng viên từ nguồn GitHub công khai.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full">
      <body className="m-0 h-full bg-canvas font-sans text-[13px] text-ink antialiased selection:bg-[#dce4ff] motion-reduce:[&_*]:animate-none! motion-reduce:[&_*]:scroll-auto! motion-reduce:[&_*]:transition-none! motion-reduce:[&_*::after]:animate-none! motion-reduce:[&_*::before]:animate-none! [&_:is(button,a)]:transition-[background,color,border-color] [&_:is(button,a)]:duration-160 [&_:is(button,a,summary,textarea):focus-visible]:outline-offset-3 [&_:is(button,a,summary,textarea):focus-visible]:outline-[3px_solid_#8199ff] [&_:is(button,a,textarea)]:[-webkit-tap-highlight-color:transparent] [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_svg]:shrink-0 [&_svg]:stroke-[1.7]">
        {children}
      </body>
    </html>
  );
}
