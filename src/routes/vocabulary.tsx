import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CircleCheck, Sparkles } from "lucide-react";

import { TopNav } from "@/components/TopNav";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { Button } from "@/components/ui/button";
import {
  SECTION_META,
  SECTION_ORDER,
  TYPE_META,
  positionInType,
  type Section,
  type TaskType,
} from "@/lib/pte";
import {
  filterVocab,
  flattenVocab,
  vocabCounts,
  vocabDueCount,
  type VocabKindFilter,
  type VocabListItem,
  type VocabSort,
} from "@/lib/plus/vocab";
import { buildStudyQueue, type VocabStudyCard } from "@/lib/plus/vocabStudy";
import { applyVocabStudy, removeVocabItem, toggleVocabStar, useAppState } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vocabulary")({
  head: () => ({
    meta: [
      { title: "Vocabulário — PTE Master Hub" },
      {
        name: "description",
        content:
          "Todas as palavras e frases que você já traduziu no Studie Plus, reunidas em um único lugar para buscar, revisitar a questão de origem e estudar.",
      },
      { property: "og:title", content: "Vocabulário — PTE Master Hub" },
      {
        property: "og:description",
        content:
          "Reúna tudo que você traduziu na prática e estude em um único lugar — material extra do Studie Plus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VocabularyPage,
});

const SORTS: { key: VocabSort; label: string }[] = [
  { key: "recentes", label: "Recentes" },
  { key: "mais-traduzidas", label: "Mais traduzidas" },
  { key: "a-z", label: "A–Z" },
  { key: "para-revisar", label: "Para revisar" },
];

/** Rótulo do tipo de tarefa (sempre via TYPE_META — nunca hardcode). */
function typeLabel(type: string): string {
  const meta = (TYPE_META as Record<string, { label?: string } | undefined>)[type];
  return meta?.label ?? type;
}

function sectionOfType(type: string): Section | undefined {
  const meta = (TYPE_META as Record<string, { section?: Section } | undefined>)[type];
  return meta?.section;
}

function VocabularyPage() {
  const app = useAppState();
  const vocab = app.vocabulary;
  const audioOn = app.settings.plus.plusAudio === true;

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<VocabKindFilter>("todas");
  const [section, setSection] = useState<string>("todas");
  const [starredOnly, setStarredOnly] = useState(false);
  const [sort, setSort] = useState<VocabSort>("recentes");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [studyQueue, setStudyQueue] = useState<VocabStudyCard[] | null>(null);

  const items = useMemo(() => flattenVocab(vocab), [vocab]);
  const now = useMemo(() => Date.now(), []);
  const counts = useMemo(() => vocabCounts(vocab), [vocab]);
  const due = useMemo(() => vocabDueCount(vocab, now), [vocab, now]);

  const sectionOf = useMemo(() => {
    return (it: VocabListItem): string | undefined => {
      if (it.kind === "phrase" && it.type) return sectionOfType(it.type);
      const first = it.sources[0];
      return first ? sectionOfType(first.type) : undefined;
    };
  }, []);

  const visible = useMemo(
    () =>
      filterVocab(items, {
        query,
        kind,
        section,
        starredOnly,
        sort,
        now,
        sectionOf,
      }),
    [items, query, kind, section, starredOnly, sort, now, sectionOf],
  );

  // Seções que realmente têm itens (chips limpos quando o vocabulário é novo).
  const sectionsAvailable = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const s = sectionOf(it);
      if (s) set.add(s);
    }
    return SECTION_ORDER.filter((s) => set.has(s));
  }, [items, sectionOf]);

  const hasAny = counts.total > 0;

  function startStudy() {
    setStudyQueue(buildStudyQueue(items, { now: Date.now() }));
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-16 pt-8 sm:px-6">
        <PageHeader
          kicker="Studie Plus"
          title="Vocabulário"
          subtitle="Material de estudo do Studie Plus — não faz parte do PTE. Tudo que você traduziu na prática fica aqui, com a questão de origem a um toque de distância."
        />

        {!hasAny ? (
          <EmptyState
            icon={Sparkles}
            className="mt-8"
            title="Seu vocabulário começa quando você traduz"
            description="Ative a tradução por palavra e por frase em Ajustes e toque nas palavras e frases durante a prática. Tudo que você traduzir aparece aqui automaticamente."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild size="sm" className="min-h-11 sm:min-h-10">
                  <Link to="/practice">Ir praticar</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="min-h-11 sm:min-h-10">
                  <Link to="/settings">Abrir Ajustes</Link>
                </Button>
              </div>
            }
          />
        ) : studyQueue ? (
          <StudySession queue={studyQueue} audioOn={audioOn} onExit={() => setStudyQueue(null)} />
        ) : (
          <>
            {/* Protagonista da exploração: o convite para revisar hoje */}
            <section className="mt-6 rounded-2xl border border-border/60 bg-card bg-glow p-5 shadow-card ring-1 ring-inset ring-primary/10 sm:p-6">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <p className="text-sm font-medium text-foreground">
                  {counts.words} {counts.words === 1 ? "palavra" : "palavras"} · {counts.phrases}{" "}
                  {counts.phrases === 1 ? "frase" : "frases"}
                  {due > 0 ? (
                    <>
                      {" · "}
                      <span className="text-primary">{due} para revisar hoje</span>
                    </>
                  ) : null}
                </p>
                <Button size="sm" className="min-h-11 sm:min-h-10" onClick={startStudy}>
                  {due > 0 ? `Revisar hoje (${due})` : `Estudar tudo (${counts.total})`}
                </Button>
              </div>
            </section>

            {/* Barra de ferramentas: busca + filtros + ordenação */}
            <div className="mt-6 space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-card">
              <label className="block">
                <span className="sr-only">Buscar no vocabulário</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar palavra, frase ou tradução…"
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Tipo
                </p>
                <div className="flex flex-wrap gap-2 text-sm">
                  {(
                    [
                      ["todas", "Todas"],
                      ["word", "Palavras"],
                      ["phrase", "Frases"],
                    ] as const
                  ).map(([key, label]) => (
                    <FilterChip key={key} active={kind === key} onClick={() => setKind(key)}>
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </div>
              {sectionsAvailable.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Seção
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <FilterChip active={section === "todas"} onClick={() => setSection("todas")}>
                      Todas as seções
                    </FilterChip>
                    {sectionsAvailable.map((s) => (
                      <FilterChip key={s} active={section === s} onClick={() => setSection(s)}>
                        {SECTION_META[s].label}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <FilterChip active={starredOnly} onClick={() => setStarredOnly((v) => !v)}>
                  ★ Favoritas
                </FilterChip>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Ordenar</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as VocabSort)}
                    className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm text-foreground sm:min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Ordenar vocabulário"
                  >
                    {SORTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                className="mt-8"
                title={`Nada encontrado${query ? ` para “${query}”` : ""}`}
                description="Tente outra busca ou limpe os filtros."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 sm:min-h-10"
                    onClick={() => {
                      setQuery("");
                      setKind("todas");
                      setSection("todas");
                      setStarredOnly(false);
                    }}
                  >
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <ul className="mt-6 space-y-3">
                {visible.map((item) => (
                  <VocabCard
                    key={`${item.kind}:${item.key}`}
                    item={item}
                    audioOn={audioOn}
                    confirming={confirmRemove === `${item.kind}:${item.key}`}
                    onAskRemove={() => setConfirmRemove(`${item.kind}:${item.key}`)}
                    onRemove={() => {
                      removeVocabItem(item.kind, item.key);
                      setConfirmRemove(null);
                    }}
                    onCancelRemove={() => setConfirmRemove(null)}
                    onStar={() => toggleVocabStar(item.kind, item.key)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Chip de contexto: leva de volta à questão de origem (o "reencontro" do planejamento). */
function SourceChip({ type, qid, extra }: { type: string; qid?: string; extra?: string }) {
  const pos = qid ? positionInType(qid) : { number: 0, total: 0 };
  const label =
    pos.number > 0
      ? `${typeLabel(type)} · q. ${pos.number}/${pos.total}${extra ?? ""}`
      : typeLabel(type);
  if (!qid || pos.number === 0) {
    return (
      <span className="inline-flex max-w-full items-center whitespace-normal rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
        {label}
      </span>
    );
  }
  return (
    <Link
      to="/practice"
      search={{ q: qid }}
      className="inline-flex min-h-11 max-w-full items-center whitespace-normal rounded-full border border-border px-3 py-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:border-primary/50 hover:text-foreground hover:underline"
    >
      {label}
    </Link>
  );
}

function VocabCard({
  item,
  audioOn,
  confirming,
  onAskRemove,
  onRemove,
  onCancelRemove,
  onStar,
}: {
  item: VocabListItem;
  audioOn: boolean;
  confirming: boolean;
  onAskRemove: () => void;
  onRemove: () => void;
  onCancelRemove: () => void;
  onStar: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isPhrase = item.kind === "phrase";

  return (
    <li className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
      <div className="min-w-0">
        {isPhrase ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="block min-h-11 w-full text-left"
          >
            <span
              className={cn(
                "block font-serif text-lg leading-relaxed text-foreground",
                !open && "line-clamp-2",
              )}
            >
              {item.en}
            </span>
            <span aria-hidden className="mt-0.5 block text-[11px] text-muted-foreground">
              {open ? "▲ frase" : "▼ frase"}
            </span>
          </button>
        ) : (
          <p className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            {item.en}
          </p>
        )}
      </div>

      {isPhrase && !open ? null : (
        <div className="mt-2">
          <p className="text-sm font-medium text-foreground">{item.literal}</p>
          {item.contextual ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.contextual}</p>
          ) : null}
        </div>
      )}

      {/* Ações em faixa própria: nunca comprimem o conteúdo */}
      <div className="mt-3 flex items-center justify-end gap-1">
        <PlusSpeakButton text={item.en} enabled={audioOn} label={`Ouvir pronúncia`} compact />
        <button
          type="button"
          aria-pressed={item.starred === true}
          aria-label={item.starred ? "Remover dos favoritos" : "Marcar como favorito"}
          onClick={onStar}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-sm transition-colors hover:bg-secondary",
            item.starred ? "text-primary" : "text-muted-foreground",
          )}
        >
          {item.starred ? "★" : "☆"}
        </button>
        {confirming ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRemove}
              aria-label="Confirmar remoção"
              className="flex h-11 items-center rounded-full px-3 text-xs font-medium text-foreground hover:bg-secondary"
            >
              Remover mesmo?
            </button>
            <button
              type="button"
              onClick={onCancelRemove}
              aria-label="Cancelar remoção"
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label="Remover do vocabulário"
            onClick={onAskRemove}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            🗑
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>
          traduzida {item.seenCount} {item.seenCount === 1 ? "vez" : "vezes"}
        </span>
        {isPhrase && item.type ? (
          <SourceChip
            type={item.type}
            {...(item.qid !== undefined ? { qid: item.qid } : {})}
            extra={` · frase ${(item.index ?? 0) + 1}`}
          />
        ) : (
          item.sources.map((s) => (
            <SourceChip key={`${s.type}:${s.qid}`} type={s.type} qid={s.qid} />
          ))
        )}
      </div>
    </li>
  );
}

/** Modo de estudo: flashcards com virada e auto-avaliação honesta (lembro / não lembro). */
function StudySession({
  queue,
  audioOn,
  onExit,
}: {
  queue: VocabStudyCard[];
  audioOn: boolean;
  onExit: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState({ sim: 0, nao: 0 });
  const card = queue[idx];

  function grade(remembered: boolean) {
    if (!card) return;
    applyVocabStudy(card.kind, card.key, remembered, Date.now());
    setScore((s) => ({ sim: s.sim + (remembered ? 1 : 0), nao: s.nao + (remembered ? 0 : 1) }));
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === "1" || e.key === "2")) {
        grade(e.key === "2");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return (
      <section className="mt-8 flex flex-col items-center rounded-2xl border border-border/60 bg-card p-8 text-center shadow-card">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success"
        >
          <CircleCheck className="size-7" strokeWidth={2} />
        </span>
        <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">Sessão concluída</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {score.sim} {score.sim === 1 ? "lembrei" : "lembrei"} · {score.nao}{" "}
          {score.nao === 1 ? "voltará em breve" : "voltarão em breve"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          As avaliações atualizam a caixa de revisão de cada item — “não lembrei” traz o cartão de
          volta mais cedo.
        </p>
        <Button size="sm" className="mt-4" onClick={onExit}>
          Voltar à lista
        </Button>
      </section>
    );
  }

  const isPhrase = card.kind === "phrase";
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Modo revisão · Cartão {idx + 1} de {queue.length} · {score.sim} ✓ · {score.nao} ✗
        </p>
        <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-10" onClick={onExit}>
          Encerrar
        </Button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-200"
          style={{ width: `${(idx / queue.length) * 100}%` }}
        />
      </div>
      <div
        aria-label="Cartão de estudo"
        className="mx-auto mt-4 max-w-2xl rounded-2xl bg-card p-6 shadow-pop sm:p-8"
      >
        <button
          type="button"
          aria-expanded={flipped}
          onClick={() => setFlipped((f) => !f)}
          className="block w-full text-center"
        >
          <span
            className={cn(
              "mx-auto block font-serif text-foreground",
              isPhrase ? "text-base leading-relaxed" : "text-3xl font-semibold tracking-tight",
            )}
          >
            {card.en}
          </span>
          <span aria-hidden className="mt-3 block text-[11px] text-muted-foreground">
            {flipped ? "▲ resposta" : "▼ toque para virar"}
          </span>
        </button>

        {flipped ? (
          <>
            <div className="mt-4 border-t border-border pt-4 text-center">
              <p className="text-lg font-semibold text-foreground">{card.literal}</p>
              {card.contextual ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {card.contextual}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                {isPhrase && card.type ? (
                  <SourceChip
                    type={card.type}
                    {...(card.qid !== undefined ? { qid: card.qid } : {})}
                    extra={` · frase ${(card.index ?? 0) + 1}`}
                  />
                ) : (
                  card.sources.map((s) => (
                    <SourceChip key={`${s.type}:${s.qid}`} type={s.type} qid={s.qid} />
                  ))
                )}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => grade(false)}
                >
                  ✗ Não lembrei
                </Button>
                <Button size="sm" className="min-h-[44px]" onClick={() => grade(true)}>
                  ✓ Lembrei
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Teclado: espaço vira o cartão · 1 = não lembrei · 2 = lembrei
              </p>
            </div>
          </>
        ) : (
          <div className="mt-4 flex items-center justify-center">
            <PlusSpeakButton text={card.en} enabled={audioOn} label="Ouvir pronúncia" />
          </div>
        )}
      </div>
    </section>
  );
}
