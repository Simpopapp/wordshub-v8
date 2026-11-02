import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatHero } from "@/components/layout/StatHero";
import { ProgressRing } from "@/components/ProgressRing";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { TYPE_META, getMeta, typeCounts, type TaskType } from "@/lib/pte";
import {
  countDue,
  countErrors,
  endSession,
  sessionFinished,
  sessionNextId,
  startDueSession,
  startMixedSession,
  startSession,
  type MixCounts,
  useSession,
} from "@/lib/session";
import { computeStats, useAppState } from "@/lib/storage";
import { buildDailyPlan } from "@/lib/pte/studyPlan";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/session")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { done?: true } = {};
    // o router serializa params como JSON (true/1) e links antigos usam "1"/"true"
    const d = search["done"];
    if (d === true || d === 1 || d === "1" || d === "true") out.done = true;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Sessão de treino — PTE Master Hub" },
      {
        name: "description",
        content: "Treine 5, 10 ou 15 questões seguidas, com fila inteligente e resumo final.",
      },
      { property: "og:title", content: "Sessão de treino — PTE Master Hub" },
      {
        property: "og:description",
        content: "Treine 5, 10 ou 15 questões seguidas, com fila inteligente e resumo final.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SessionPage,
});

const sizeOptions = [5, 10, 15];

function SessionPage() {
  const { done } = Route.useSearch();
  const navigate = useNavigate();
  const app = useAppState();
  const session = useSession();
  const [size, setSize] = useState(10);
  const stats = useMemo(() => computeStats(app), [app]);
  const dueN = countDue(stats, Date.now(), app.settings.verifiedOnly);
  const errN = countErrors(stats, app.settings.verifiedOnly);
  const [mix, setMix] = useState<MixCounts>({ read_aloud: 3, wfd: 5, repeat_sentence: 3 });
  const mixTotal = Object.values(mix).reduce((a, b) => a + (b ?? 0), 0);

  // Plano do dia (fase 3): terceira entrada quando a meta diária permite distribuir.
  const plan = useMemo(() => buildDailyPlan(app, stats), [app, stats]);

  // Resumo da sessão concluída
  if (session.active && (done || sessionFinished())) {
    const graded = session.results.filter((r) => r.score !== null);
    const avg = graded.length
      ? Math.round(graded.reduce((sum, r) => sum + (r.score ?? 0), 0) / graded.length)
      : null;
    const byType = new Map<TaskType, { sum: number; n: number }>();
    for (const r of session.results) {
      if (r.score === null) continue;
      const q = getMeta(r.qid);
      if (!q) continue;
      const cur = byType.get(q.taskType) ?? { sum: 0, n: 0 };
      cur.sum += r.score;
      cur.n += 1;
      byType.set(q.taskType, cur);
    }
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <TopNav />
        <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
          <PageHeader kicker="Sessão concluída" title="Bom trabalho" />

          {/* Número-herói (projeto 12, S3): quantidade concluída é o protagonista */}
          <section
            aria-label="Resumo da sessão"
            className="rounded-2xl border border-border/60 bg-card bg-glow p-6 shadow-card sm:p-8"
          >
            <StatHero
              value={session.results.length}
              label="Questões concluídas"
              hint={
                avg !== null
                  ? `Média de conteúdo: ${avg}% (estimativa de treino)`
                  : "Sem scores automáticos nesta sessão."
              }
            />
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                size="lg"
                className="min-h-11"
                onClick={() => {
                  endSession();
                  setSize(size);
                }}
              >
                Nova sessão
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-11"
                onClick={() => navigate({ to: "/" })}
              >
                Voltar ao início
              </Button>
            </div>
          </section>

          {byType.size > 1 && (
            <div className="flex flex-wrap gap-2">
              {[...byType.entries()].map(([t, v]) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary px-3 py-1 text-xs tabular-nums text-muted-foreground"
                >
                  {TYPE_META[t].label}: {Math.round(v.sum / v.n)}% · {v.n} questão(ões)
                </span>
              ))}
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
            <h2 className="sr-only">Questões desta sessão</h2>
            <ul className="divide-y divide-border/50">
              {session.results.map((r, i) => {
                const q = getMeta(r.qid);
                return (
                  <li
                    key={`${r.qid}-${i}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 text-sm text-foreground/85">
                      <span className="mb-1 block truncate text-xs text-muted-foreground">
                        {q ? TYPE_META[q.taskType].label : "—"}
                      </span>
                      <span className="block break-words">{q?.topic ?? r.qid}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-sm tabular-nums",
                        r.score === null
                          ? "text-muted-foreground"
                          : r.score >= 90
                            ? "text-success"
                            : r.score >= 70
                              ? "text-warning"
                              : "text-destructive",
                      )}
                    >
                      {r.score === null ? "—" : `${r.score}% · ${r.wpm ?? "—"} ppm`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>
      </div>
    );
  }

  // Sessão em andamento
  if (session.active) {
    const nextId = sessionNextId();
    const nextQ = nextId ? getMeta(nextId) : undefined;
    const pct = Math.round((session.index / Math.max(session.size, 1)) * 100);
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <TopNav />
        <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
          <PageHeader kicker="Treino guiado" title="Sessão em andamento" />

          {/* Retomada com ProgressRing compartilhado (projeto 12, S3) — substitui a barra ad-hoc */}
          <section
            aria-label="Progresso da sessão"
            className="rounded-2xl border border-border/60 bg-card p-6 shadow-card sm:p-8"
          >
            <div className="flex items-center gap-4">
              <ProgressRing
                value={session.index / Math.max(session.size, 1)}
                size={64}
                stroke={6}
                role="progressbar"
                aria-label="Progresso da sessão"
                aria-valuemin={0}
                aria-valuemax={session.size}
                aria-valuenow={session.index}
                aria-valuetext={`${session.index} de ${session.size} concluídas`}
              >
                <span className="text-sm font-semibold tabular-nums">{pct}%</span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {session.index} de {session.size} concluídas
                </p>
                {nextQ ? (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    Próxima: {TYPE_META[nextQ.taskType].label} · {nextQ.topic}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap">
              <Button
                size="lg"
                className="min-h-11"
                disabled={!nextId}
                onClick={() => nextId && navigate({ to: "/practice", search: { q: nextId } })}
              >
                Continuar sessão
              </Button>
              <Button size="lg" variant="outline" className="min-h-11" onClick={() => endSession()}>
                Encerrar sessão
              </Button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // Configuração
  const history = app.sessions.slice(0, 10);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <PageHeader
          kicker="Treino guiado"
          title="Sessão de treino"
          subtitle="Questões em sequência, intercalando task types: primeiro as revisões vencidas (repetição espaçada), depois questões novas."
        />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section
            aria-labelledby="session-config-title"
            className="rounded-2xl border border-border/60 bg-card p-5 shadow-card sm:p-6"
          >
            <h2
              id="session-config-title"
              className="font-serif text-lg font-semibold text-foreground"
            >
              Monte sua sessão
            </h2>
            <fieldset className="mt-4 border-0 p-0">
              <legend className="text-sm font-medium text-foreground">Quantas questões?</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {sizeOptions.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    aria-pressed={size === n}
                    variant={size === n ? "default" : "outline"}
                    className={cn("min-h-11 min-w-0 px-2", size !== n && "text-muted-foreground")}
                    onClick={() => setSize(n)}
                  >
                    {n}
                    <span className="sr-only">questões</span>
                  </Button>
                ))}
              </div>
            </fieldset>
            <p className="mt-3 text-sm text-muted-foreground">
              {dueN} {dueN === 1 ? "revisão vencida" : "revisões vencidas"} · {errN}{" "}
              {errN === 1 ? "questão com erro recente" : "questões com erro recente"}
            </p>
            <div className="mt-5 grid gap-2">
              <Button
                size="lg"
                className="min-h-11 w-full"
                onClick={() => {
                  startSession(size, stats);
                  const first = sessionNextId();
                  if (first) navigate({ to: "/practice", search: { q: first } });
                }}
              >
                Começar sessão de {size}
              </Button>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-11 whitespace-normal"
                  disabled={dueN === 0}
                  onClick={() => {
                    startDueSession(Math.min(size, dueN), stats);
                    const first = sessionNextId();
                    if (first) navigate({ to: "/practice", search: { q: first } });
                  }}
                >
                  Fila do dia ({Math.min(size, dueN)})
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-11 whitespace-normal"
                  disabled={errN === 0}
                  onClick={() => {
                    startSession(Math.min(size, errN), stats, { mode: "errors" });
                    const first = sessionNextId();
                    if (first) navigate({ to: "/practice", search: { q: first } });
                  }}
                >
                  Revisar erros ({Math.min(size, errN)})
                </Button>
                {plan.total > 0 ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="min-h-11 whitespace-normal sm:col-span-2"
                    onClick={() => {
                      startMixedSession(plan.counts, stats);
                      const first = sessionNextId();
                      if (first) navigate({ to: "/practice", search: { q: first } });
                    }}
                  >
                    Plano de hoje ({plan.total})
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="session-mix-title"
            className="rounded-2xl border border-border/60 bg-card p-5 shadow-card sm:p-6"
          >
            <h2 id="session-mix-title" className="font-serif text-lg font-semibold text-foreground">
              Sessão mista
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Combine tipos de questão. Os tipos em que você vai pior aparecem primeiro,
              intercalados.
            </p>
            <div className="mt-4 divide-y divide-border/60">
              {(Object.keys(TYPE_META) as TaskType[])
                .filter((t) => TYPE_META[t].ready && typeCounts[t] > 0)
                .map((t) => {
                  const n = mix[t] ?? 0;
                  const set = (v: number) =>
                    setMix((m) => ({ ...m, [t]: Math.max(0, Math.min(typeCounts[t], v)) }));
                  return (
                    <div
                      key={t}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2"
                    >
                      <span className="min-w-0 text-sm leading-snug">{TYPE_META[t].label}</span>
                      <div className="grid grid-cols-[44px_2rem_44px] items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="size-11 p-0"
                          aria-label={`Menos ${TYPE_META[t].label}`}
                          onClick={() => set(n - 1)}
                        >
                          −
                        </Button>
                        <span className="text-center text-sm tabular-nums">{n}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="size-11 p-0"
                          aria-label={`Mais ${TYPE_META[t].label}`}
                          onClick={() => set(n + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <Button
              size="lg"
              variant="outline"
              className="mt-5 w-full min-h-11 whitespace-normal"
              disabled={mixTotal === 0}
              onClick={() => {
                startMixedSession(mix, stats);
                const first = sessionNextId();
                if (first) navigate({ to: "/practice", search: { q: first } });
              }}
            >
              Começar sessão mista de {mixTotal}
            </Button>
          </section>
        </div>

        {history.length > 0 ? (
          <section
            aria-labelledby="session-history-title"
            className="rounded-2xl border border-border/60 bg-card p-5 shadow-card sm:p-6"
          >
            <h2
              id="session-history-title"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Sessões recentes
            </h2>
            <ul className="mt-3 divide-y divide-border/50">
              {history.map((s) => {
                const graded = s.results.filter((r) => r.score !== null);
                const avg = graded.length
                  ? Math.round(graded.reduce((sum, r) => sum + (r.score ?? 0), 0) / graded.length)
                  : null;
                return (
                  <li
                    key={s.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(s.finishedAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {s.results.length} questões
                      {avg !== null ? ` · ${avg}%` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
