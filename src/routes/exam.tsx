import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Layers, ClipboardCheck } from "lucide-react";

import { ExamRunner } from "@/components/exam/ExamRunner";
import { PageHeader } from "@/components/layout/PageHeader";
import { SECTION_ICONS } from "@/components/layout/SectionIdentity";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { SECTION_META, SECTION_ORDER } from "@/lib/pte";
import type { Section } from "@/lib/pte/types";
import {
  BLUEPRINT_OMISSIONS,
  estimateSeconds,
  examQuestionCount,
  type ExamId,
} from "@/lib/pte/exam";

export const Route = createFileRoute("/exam")({
  head: () => ({
    meta: [
      { title: "Simulado — PTE Master Hub" },
      {
        name: "description",
        content:
          "Simulado cronometrado do PTE por seção ou completo, com tempos oficiais, auto-submit e resumo comparativo com sua prática.",
      },
      { property: "og:title", content: "Simulado — PTE Master Hub" },
      {
        property: "og:description",
        content:
          "Simulado cronometrado do PTE por seção ou completo, com tempos oficiais e resumo comparativo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamPage,
});

function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `~${m} min`;
  return `~${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`;
}

function ExamPage() {
  const [examId, setExamId] = useState<ExamId | null>(null);
  if (!examId) return <ChoiceScreen onStart={setExamId} />;
  return <ExamRunner key={examId} examId={examId} onExit={() => setExamId(null)} />;
}

function ChoiceScreen({ onStart }: { onStart: (id: ExamId) => void }) {
  const options: { id: ExamId; label: string; description: string; section?: Section }[] = [
    ...SECTION_ORDER.map((s) => ({
      id: s as ExamId,
      label: SECTION_META[s]!.label,
      description: SECTION_META[s]!.description,
      section: s as Section,
    })),
    {
      id: "mini",
      label: "Mini-simulado",
      description: "As quatro seções em sequência, com uma amostra curta de cada tipo.",
    },
    {
      id: "full",
      label: "Simulado completo",
      description: "Blueprint oficial de ~2 h, com as contagens e a ordem do exame real.",
    },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <PageHeader
          kicker="Treino cronometrado"
          title="Simulado"
          subtitle="Questões sorteadas com os tempos oficiais do exame. Ao zerar o cronômetro de cada questão, a resposta é enviada — sem correção imediata. No fim, você compara com sua prática livre."
        />

        <div className="grid gap-3 md:grid-cols-2">
          {options.map((opt) => {
            const Icon = opt.section
              ? SECTION_ICONS[opt.section]
              : opt.id === "mini"
                ? Layers
                : ClipboardCheck;
            return (
              <Button
                key={opt.id}
                type="button"
                variant="outline"
                onClick={() => onStart(opt.id)}
                className="h-auto min-h-32 w-full min-w-0 items-start justify-start whitespace-normal rounded-2xl border-border/60 bg-card p-5 text-left shadow-card transition-colors duration-200 ease-out hover:border-primary/50 motion-reduce:transition-none"
              >
                <span className="flex w-full items-start gap-3 text-left">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  >
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-lg font-semibold text-foreground">
                      {opt.label}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                      {opt.description}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden />
                      {examQuestionCount(opt.id)} questões · {fmtDuration(estimateSeconds(opt.id))}
                    </span>
                  </span>
                </span>
              </Button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          As tentativas do simulado alimentam sua agenda de revisão, mas ficam marcadas como exame e
          não entram na sua média de prática.
        </p>

        <p className="text-xs text-muted-foreground">
          Blueprint oficial: {BLUEPRINT_OMISSIONS.join("; ")}.
        </p>

        <Button variant="ghost" className="min-h-11" onClick={() => history.back()}>
          Voltar
        </Button>
      </main>
    </div>
  );
}
