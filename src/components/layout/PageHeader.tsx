import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Kicker opcional (ex.: nome da seção) em caps pequenas. */
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Ações à direita (botões); empilham em telas estreitas. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página padrão (PRD §8): título serif com hierarquia real,
 * subtítulo e ações. A largura da página continua sendo responsabilidade
 * da rota (o header preenche o contêiner onde for montado).
 */
export function PageHeader({ kicker, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {kicker ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{kicker}</p>
        ) : null}
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
