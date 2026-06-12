import { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';

interface HeroTemplateProps {
  variant?: 'login' | 'app';
  children: ReactNode;
}

export function HeroTemplate({ variant = 'app', children }: HeroTemplateProps) {
  return (
    <section className="hero-template-section hero-template-section-fixed">
      <img src="/bg-hero.svg" alt="" className="hero-template-bg" />
      <div className="hero-template-overlay" aria-hidden="true" />
      <SiteHeader variant={variant} />
      <div className="hero-template-content">
        <div className="page-stack">{children}</div>
      </div>
    </section>
  );
}
