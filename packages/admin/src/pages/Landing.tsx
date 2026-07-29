import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

function useMousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  return pos;
}

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: '多渠道收集',
    desc: '嵌入式组件、独立提交页、公开看板，从任何场景收集用户反馈',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
    title: '实时洞察',
    desc: '投票趋势、来源分布、响应时间，用数据驱动产品决策',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
    title: '安全可靠',
    desc: '多租户隔离、Webhook HMAC 签名、审计日志，企业级安全',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: '灵活集成',
    desc: 'Webhook、SSO、自定义分类状态，无缝融入你的工作流',
    color: 'from-violet-500 to-purple-500',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    title: '团队协作',
    desc: '指派处理人、内部备注、批量操作，让团队高效处理反馈',
    color: 'from-pink-500 to-rose-500',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    title: '开源免费',
    desc: '完全开源，自托管部署，你的数据永远属于你自己',
    color: 'from-brand-500 to-indigo-500',
  },
];

const stats = [
  { value: '10K+', label: '反馈收集' },
  { value: '99.9%', label: '运行稳定性' },
  { value: '<2h', label: '平均响应' },
  { value: '50+', label: '企业客户' },
];

export function Landing() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const mouse = useMousePosition();

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.hero-badge', { opacity: 0, y: 20, scale: 0.9, duration: 0.5, ease: 'back.out(1.7)' })
      .from('.hero-title-line', { opacity: 0, y: 60, rotationX: -40, duration: 1, stagger: 0.2, ease: 'power4.out' }, '-=0.2')
      .from('.hero-desc', { opacity: 0, y: 30, duration: 0.7 }, '-=0.5')
      .from('.hero-cta', { opacity: 0, y: 25, duration: 0.6, stagger: 0.12, ease: 'back.out(1.5)' }, '-=0.4')
      .from('.hero-visual', { opacity: 0, y: 80, scale: 0.92, duration: 1, ease: 'power3.out' }, '-=0.6');

    gsap.to('.hero-float', { y: -15, duration: 3.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.to('.hero-orbit', { rotation: 360, duration: 20, ease: 'none', repeat: -1 });

    gsap.from('.stat-item', {
      opacity: 0, y: 40, duration: 0.7, stagger: 0.12, ease: 'power2.out',
      scrollTrigger: { trigger: '.stats-section', start: 'top 80%' },
    });

    ScrollTrigger.batch('.feature-card', {
      onEnter: (batch) => {
        gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', overwrite: true });
      },
      start: 'top 85%',
    });

    gsap.set('.feature-card', { opacity: 0, y: 60 });

    gsap.from('.cta-content', {
      opacity: 0, y: 50, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: '.cta-section', start: 'top 75%' },
    });

    gsap.from('.grid-bg', { opacity: 0, duration: 1.5, ease: 'power2.out' });
  }, { scope: containerRef });

  useGSAP(() => {
    if (!heroRef.current) return;
    const x = (mouse.x - window.innerWidth / 2) * 0.015;
    const y = (mouse.y - window.innerHeight / 2) * 0.015;
    gsap.to('.hero-glow-1', { x: x * 2, y: y * 2, duration: 1.5, ease: 'power2.out' });
    gsap.to('.hero-glow-2', { x: -x * 1.5, y: -y * 1.5, duration: 1.5, ease: 'power2.out' });
  }, { scope: heroRef, dependencies: [mouse] });

  return (
    <div ref={containerRef} className="min-h-screen overflow-x-hidden bg-white text-gray-900">
      {/* Grid background */}
      <div className="grid-bg pointer-events-none fixed inset-0 z-0 opacity-[0.03]">
        <div className="h-full w-full" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="hero-glow-1 absolute left-1/4 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-brand-400/20 blur-[100px]" />
        <div className="hero-glow-2 absolute right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-violet-400/15 blur-[80px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex h-16 items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 shadow-md shadow-brand-500/20">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 4.5C3 3.67 3.67 3 4.5 3h7c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5H7l-3 2.5V13H4.5C3.67 13 3 12.33 3 11.5v-7z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight">Nexus Feedback</span>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-gray-800 hover:shadow-lg"
        >
          进入控制台
        </button>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative z-10 flex min-h-[88vh] flex-col items-center justify-center px-6 pt-12 text-center sm:pt-16">
        <div className="hero-badge mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
          </span>
          v2.0 全新上线
        </div>
        <h1 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
          <span className="hero-title-line block">倾听用户声音</span>
          <span className="hero-title-line block bg-gradient-to-r from-brand-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
            驱动产品进化
          </span>
        </h1>
        <p className="hero-desc mt-6 max-w-lg text-lg leading-relaxed text-gray-500 sm:text-xl">
          一款开源的用户反馈管理平台。收集、整理、追踪用户建议，让每一条反馈都能被看见、被处理、被回应。
        </p>
        <div className="hero-cta mt-10 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/30"
          >
            立即开始
          </button>
          <a
            href="https://github.com/nexus-feedback/nexus-feedback"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-gray-200 bg-white px-8 py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
          >
            GitHub ↗
          </a>
        </div>

        {/* Hero visual */}
        <div className="hero-visual hero-float mt-20 w-full max-w-3xl">
          <div className="relative">
            <div className="hero-orbit absolute -inset-4 rounded-3xl border-2 border-dashed border-brand-200/40" />
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-1 shadow-2xl shadow-gray-200/50">
              <div className="rounded-xl bg-gray-50 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                  <span className="ml-3 text-xs text-gray-400">Nexus Feedback Dashboard</span>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {[
                    { label: '总反馈', value: '2,847', color: 'from-blue-600 to-cyan-500' },
                    { label: '待处理', value: '128', color: 'from-amber-500 to-orange-500' },
                    { label: '已解决', value: '2,103', color: 'from-emerald-500 to-teal-500' },
                    { label: '响应中', value: '616', color: 'from-violet-500 to-purple-500' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-white p-3 shadow-sm border border-gray-100">
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                      <p className={`text-lg font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2.5">
                  {[
                    { title: '希望增加深色模式', votes: 234, status: '处理中', color: 'bg-blue-100 text-blue-600' },
                    { title: '导出功能需要支持 CSV', votes: 189, status: '待处理', color: 'bg-amber-100 text-amber-600' },
                    { title: '移动端体验优化', votes: 156, status: '已解决', color: 'bg-green-100 text-green-600' },
                  ].map((f) => (
                    <div key={f.title} className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 shadow-sm border border-gray-100">
                      <span className="text-xs text-gray-600">{f.title}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400 font-medium">▲ {f.votes}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${f.color}`}>{f.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section relative z-10 py-24">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 px-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="stat-item text-center">
              <p className="text-3xl font-bold text-gray-900 sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features-section relative z-10 pb-24 pt-8">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-brand-600 mb-3 tracking-wide uppercase">核心能力</p>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">覆盖反馈生命周期的每一个环节</h2>
            <p className="mt-4 text-gray-500 max-w-md mx-auto">从收集到响应，全程助力产品团队高效协作</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="feature-card group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:border-gray-200 hover:shadow-xl hover:-translate-y-1"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  {f.icon}
                </div>
                <h3 className="mt-5 text-base font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section relative z-10 py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="cta-content">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">准备好收集用户反馈了吗？</h2>
            <p className="mt-4 text-gray-500">几分钟内即可部署，开始倾听你的用户</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-10 rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-10 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/30"
            >
              进入控制台
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-100 py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-sm text-gray-400">
          Nexus Feedback · 开源用户反馈管理平台
        </div>
      </footer>
    </div>
  );
}
