'use client';

import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const phrases = ['qua các dự án.', 'từ những dòng code.', 'qua dấu ấn GitHub.'];

export function CandidateHeadline({ name }: { name: string }) {
  const [paused, setPaused] = useState(false);
  const [motion, setMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const [typing, setTyping] = useState({ phrase: 0, length: phrases[0].length, deleting: false });
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setMotion(!preference.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    preference.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      preference.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);
  useEffect(() => {
    if (!motion || paused || !visible) return;
    const length = Array.from(phrases[typing.phrase]).length;
    const complete = typing.length === length && !typing.deleting;
    const timer = window.setTimeout(
      () =>
        setTyping((current) => {
          if (complete) return { ...current, deleting: true };
          if (current.deleting && current.length === 0)
            return { phrase: (current.phrase + 1) % phrases.length, length: 0, deleting: false };
          return { ...current, length: current.length + (current.deleting ? -1 : 1) };
        }),
      complete ? 2800 : typing.deleting ? 35 : 65,
    );
    return () => window.clearTimeout(timer);
  }, [motion, paused, visible, typing]);
  const text = motion
    ? Array.from(phrases[typing.phrase]).slice(0, typing.length).join('')
    : phrases[0];
  return (
    <div
      data-ui="candidate-headline"
      className="relative pr-5 [&_[data-ui~=welcome-subject]]:wrap-anywhere [&_[data-ui~=welcome-subject]]:[white-space:normal] [&_[data-ui~=welcome-subject]]:text-cobalt [&_h1]:m-[0_0_14px] [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-[clamp(32px,2.7vw,40px)] [&_h1]:leading-[1.2] [&_h1]:font-[750] [&_h1]:tracking-[-1.3px] [&_h1]:text-balance max-[769px]:[&_h1]:text-[30px] max-[421px]:[&_h1]:text-[27px] max-[421px]:[&_h1]:tracking-[-1px] min-[1081px]:max-[1251px]:[&_h1]:text-[32px] min-[1550px]:[&_h1]:text-[44px] [@media(max-height:820px)]:min-[769px]:[&_h1]:text-[32px]"
    >
      <h1 id="welcome-title">
        <span className="sr-only">Tìm hiểu ứng viên {name} qua các dự án.</span>
        <span aria-hidden="true" className="block">
          Tìm hiểu ứng viên{' '}
          <span data-ui="welcome-subject" className="whitespace-nowrap">
            {name}
          </span>
          <span className="mt-[3px] grid text-ink [&>span]:min-w-0 [&>span]:[text-wrap:initial] [&>span]:[grid-area:1/1]">
            {phrases.map((phrase) => (
              <span className="pointer-events-none invisible" key={phrase}>
                {phrase}
              </span>
            ))}
            <span data-ui="headline-text">
              {text}
              <span
                data-ui={`typing-caret${paused || !motion ? ' paused' : ''}`}
                className="ml-1 inline-block h-[.8em] w-0.5 animate-caret-blink bg-cobalt align-baseline [&[data-ui~=paused]]:animate-none [&[data-ui~=paused]]:opacity-0"
              />
            </span>
          </span>
        </span>
      </h1>
      {motion && (
        <button
          data-ui="headline-pause"
          className="absolute -right-2 -bottom-1.5 grid min-h-11 min-w-11 place-items-center rounded-[8px] text-muted hover:bg-pale-blue hover:text-cobalt"
          type="button"
          aria-label={paused ? 'Tiếp tục hiệu ứng tiêu đề' : 'Tạm dừng hiệu ứng tiêu đề'}
          onClick={() => setPaused((value) => !value)}
          title={paused ? 'Tiếp tục hiệu ứng tiêu đề' : 'Tạm dừng hiệu ứng tiêu đề'}
        >
          {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
