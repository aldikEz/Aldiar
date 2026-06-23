import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cn } from '../../lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
}

const INJECTED_STYLES = `
  .gsap-reveal { visibility: hidden; }

  .sensibite-grid {
    background-size: 64px 64px;
    background-image:
      linear-gradient(to right, rgba(15, 23, 42, 0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(15, 23, 42, 0.04) 1px, transparent 1px);
    mask-image: radial-gradient(ellipse at center, black 0%, transparent 74%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 74%);
  }

  .hero-type {
    color: #0a0a0a;
    text-shadow: 0 18px 45px rgba(15, 23, 42, 0.10);
    line-height: 0.98;
    padding-block: 0.12em;
  }

  .hero-type-soft {
    background: linear-gradient(180deg, #0a0a0a 0%, #71717a 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 18px 35px rgba(15, 23, 42, 0.10));
    line-height: 0.98;
    padding-block: 0.14em;
  }

  .iphone-hardware {
    background: linear-gradient(145deg, #f7f7f5 0%, #d8d8d2 42%, #ffffff 58%, #c9cac2 100%);
    box-shadow:
      0 42px 90px -36px rgba(15, 23, 42, 0.46),
      0 18px 35px -24px rgba(15, 23, 42, 0.25),
      inset 0 1px 2px rgba(255,255,255,0.9);
  }

  .iphone-screen {
    background:
      radial-gradient(circle at 20% 10%, rgba(30, 64, 175, 0.72), transparent 30%),
      radial-gradient(circle at 84% 22%, rgba(88, 28, 135, 0.46), transparent 33%),
      radial-gradient(circle at 50% 86%, rgba(20, 184, 166, 0.18), transparent 32%),
      linear-gradient(155deg, #020617 0%, #111827 42%, #05060a 100%);
  }

  .lock-clock {
    font-feature-settings: "tnum";
    text-shadow: 0 10px 34px rgba(0,0,0,0.38);
  }

  .ios-glass {
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.34);
    box-shadow:
      0 22px 60px rgba(0, 0, 0, 0.38),
      inset 0 1px 1px rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(28px) saturate(150%);
    -webkit-backdrop-filter: blur(28px) saturate(150%);
  }

  .chat-surface {
    background:
      radial-gradient(circle at 20% 0%, rgba(20, 184, 166, 0.20), transparent 34%),
      linear-gradient(180deg, rgba(2, 6, 23, 0.98), rgba(9, 9, 11, 1));
  }
`;

export interface CinematicHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  tagline1?: string;
  tagline2?: string;
}

export function CinematicHero({
  tagline1 = 'Snap your food.',
  tagline2 = 'Spot your triggers.',
  className,
  ...props
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollStartedRef = useRef(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set('.text-track', { autoAlpha: 0, y: 58, scale: 0.9, filter: 'blur(18px)', rotationX: -18 });
      gsap.set('.text-days', { autoAlpha: 1, clipPath: 'inset(-18% 100% -18% 0)' });
      gsap.set('.iphone-stage', { autoAlpha: 0, y: 220, scale: 0.78, rotationX: 20 });
      gsap.set('.notification-card', { autoAlpha: 0, y: -30, scale: 0.96 });
      gsap.set('.chat-screen', { autoAlpha: 0, y: 24, scale: 0.985 });
      gsap.set('.chat-bubble, .assistant-card', { autoAlpha: 0, y: 18, scale: 0.98 });

      const introTl = gsap.timeline({ delay: 0.2 });
      introTl
        .to('.text-track', {
          duration: 1.4,
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          rotationX: 0,
          ease: 'expo.out',
        })
        .to('.text-days', { duration: 1.05, clipPath: 'inset(-18% 0% -18% 0)', ease: 'power4.inOut' }, '-=0.72');

      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=2600',
          pin: true,
          scrub: 0.85,
          anticipatePin: 1,
          onUpdate: (self) => {
            if (autoScrollStartedRef.current || self.progress < 0.018 || self.progress > 0.92) return;

            autoScrollStartedRef.current = true;
            gsap.to(window, {
              scrollTo: self.end,
              duration: 2.6,
              ease: 'power2.inOut',
              overwrite: true,
            });
          },
        },
      });

      scrollTl
        .to(['.hero-text-wrapper', '.sensibite-grid'], {
          scale: 1.04,
          filter: 'blur(14px)',
          opacity: 0.1,
          ease: 'power2.inOut',
          duration: 1,
        })
        .to(
          '.iphone-stage',
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotationX: 0,
            ease: 'expo.out',
            duration: 1.45,
          },
          '<',
        )
        .to(
          '.lock-clock',
          { y: -2, scale: 1.01, ease: 'power2.out', duration: 0.8 },
          '-=0.8',
        )
        .to({}, { duration: 0.35 })
        .to('.notification-card', {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          ease: 'expo.out',
          duration: 0.85,
        })
        .to({}, { duration: 0.65 })
        .to('.lock-layer', { autoAlpha: 0, scale: 1.02, filter: 'blur(10px)', ease: 'power2.inOut', duration: 0.7 })
        .to(
          '.chat-screen',
          { autoAlpha: 1, y: 0, scale: 1, ease: 'expo.out', duration: 0.85 },
          '-=0.45',
        )
        .to('.chat-bubble', { autoAlpha: 1, y: 0, scale: 1, ease: 'expo.out', duration: 0.5 })
        .to('.assistant-card', { autoAlpha: 1, y: 0, scale: 1, ease: 'expo.out', duration: 0.65 }, '-=0.08')
        .to({}, { duration: 0.8 });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#fbfbf8] font-sans text-zinc-950 antialiased',
        className,
      )}
      style={{ perspective: '1500px' }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      <div className="sensibite-grid pointer-events-none absolute inset-0 z-0 opacity-70" aria-hidden="true" />

      <div className="hero-text-wrapper absolute z-10 flex w-screen flex-col items-center justify-center px-5 py-8 text-center">
        <h1 className="text-track gsap-reveal hero-type mb-1 overflow-visible text-5xl font-black tracking-tight md:text-7xl lg:text-[7rem]">
          {tagline1}
        </h1>
        <h1 className="text-days gsap-reveal hero-type-soft overflow-visible text-5xl font-black tracking-tight md:text-7xl lg:text-[7rem]">
          {tagline2}
        </h1>
      </div>

      <div className="iphone-stage gsap-reveal absolute inset-0 z-20 flex items-center justify-center">
        <div className="iphone-hardware relative h-[704px] w-[344px] rounded-[58px] p-[9px] ring-1 ring-zinc-300/80 max-[430px]:scale-[0.86]">
          <div className="absolute -left-[3px] top-[148px] h-14 w-[3px] rounded-l-md bg-zinc-300" />
          <div className="absolute -left-[3px] top-[218px] h-14 w-[3px] rounded-l-md bg-zinc-300" />
          <div className="absolute -right-[3px] top-[190px] h-20 w-[3px] rounded-r-md bg-zinc-300" />

          <div className="relative h-full w-full overflow-hidden rounded-[48px] border-[10px] border-black bg-black">
            <div className="iphone-screen relative h-full w-full overflow-hidden rounded-[38px] text-white">
              <div className="absolute left-1/2 top-3 z-50 h-[30px] w-[112px] -translate-x-1/2 rounded-full bg-black shadow-[0_2px_8px_rgba(0,0,0,0.35)]" />

              <div className="lock-layer absolute inset-0 px-6 pb-7 pt-[68px]">
                <div className="lock-clock text-left text-[34px] font-black leading-none text-white">
                  11:24 PM
                </div>

                <div className="notification-card ios-glass absolute left-4 right-4 top-[124px] z-40 rounded-[24px] p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-[12px] bg-[linear-gradient(135deg,#07111f_0%,#14b8a6_100%)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.26),0_8px_18px_rgba(0,0,0,0.25)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <p className="m-0 text-[13px] font-black leading-none tracking-tight text-white">Health Coach</p>
                        <span className="text-[13px] font-semibold leading-none tracking-tight text-white/72">• now</span>
                      </div>
                      <p className="m-0 mt-1 text-[13px] font-medium leading-snug tracking-tight text-white">
                        Feeling bloated?
                      </p>
                    </div>
                  </div>
                </div>

                <div className="absolute inset-x-10 bottom-4 flex items-center justify-between">
                  <div className="h-11 w-11 rounded-full border border-white/18 bg-black/28 backdrop-blur-xl" />
                  <div className="h-11 w-11 rounded-full border border-white/18 bg-black/28 backdrop-blur-xl" />
                </div>
              </div>

              <div className="chat-screen chat-surface absolute inset-0 px-5 pb-7 pt-[70px]">
                <div className="mb-7 flex items-center justify-between">
                  <div>
                    <p className="m-0 text-[12px] font-semibold tracking-tight text-white/48">11:25 PM</p>
                    <h2 className="m-0 mt-1 text-[22px] font-black tracking-tight text-white">SensiBite</h2>
                  </div>
                  <div className="h-10 w-10 rounded-[13px] bg-[linear-gradient(135deg,#111827_0%,#52525b_100%)] shadow-[0_10px_26px_rgba(24,24,27,0.24)]" />
                </div>

                <div className="flex flex-col gap-4">
                  <div className="chat-bubble ml-auto max-w-[78%] rounded-[24px] rounded-tr-[9px] bg-white px-4 py-3 text-[15px] font-semibold leading-snug tracking-tight text-zinc-950 shadow-[0_14px_34px_rgba(0,0,0,0.25)]">
                    Feeling bloated
                  </div>

                  <div className="assistant-card rounded-[28px] border border-white/10 bg-white/[0.08] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
                    <div className="mb-3 h-1.5 w-12 rounded-full bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.28)]" />
                    <p className="m-0 text-[18px] font-semibold leading-snug tracking-tight text-white">
                      Bloating was logged after similar late fried meals three times this week. SensiBite saved the pattern.
                    </p>
                  </div>
                </div>

                <div className="absolute inset-x-6 bottom-5 h-1.5 rounded-full bg-white/65" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CinematicHero;
