# Journal Overview + Edit Flows Addendum

**Date:** 2026-04-22 (post-MVP)

## Motivation

Current project Overview tab renders a hardcoded README template (placeholder from Phase 5). User wants to replace it with a richer "research journal" view modeled on `meetings2.html` — timeline + todos + carousel cards + modal detail — **while keeping the GitHub/Primer visual style**.

Also: add edit flows for Project and Experiment Run (placeholder gap flagged before this).

## Scope

Two sub-phases:

### 13a — Journal Overview (read-only)

Replace `/projects/[slug]` Overview tab with a multi-section journal view:

1. **KPI bar** — 4 stats: papers / experiments / meetings / target-venue
2. **Timeline** — horizontal milestone list with dots on a line, "NOW" highlight
3. **Todos panel** — 3 columns (단기/중기/장기) with checkboxes (read-only display in 13a, interactive in 13b)
4. **Filter chips** — All / 회의록 / 보고 / 실험 / 리뷰 (client state)
5. **Entry card grid** — each card is a carousel (summary slide + 3–6 narrative slides)
6. **Entry modal** — 3 panels: Markdown body + artifacts list + mock chatbot

### 13b — Write + edit flows (separate dispatch)

1. Project edit (description, tags, pinned)
2. Run edit (summary, name)
3. Entry CRUD (create journal entry with slides + artifacts)
4. Milestone CRUD
5. Todo CRUD (check/uncheck, add, remove)
6. Mock chatbot input wired (echoes with pre-canned answers)

## Visual style

**GitHub / Primer — not meetings2's gradient/indigo aesthetic.** Specifically:

- Replace slide gradient backgrounds with **flat tone blocks** (top strip + white body) using Primer tokens: `bg-accent-subtle text-accent-fg` for discovery, `bg-danger-subtle text-danger-fg` for failure, `bg-success-subtle text-success-fg` for implement, `bg-attention-subtle text-attention-fg` for question, `bg-canvas-subtle text-fg-muted` for next, `bg-done-subtle text-done-fg` for metric.
- `rounded-md` (6px) not `rounded-2xl`.
- Avatar initials component from Phase 3 (not emoji-only).
- Entry type chip uses existing `<LabelChip>` with appropriate tone (meeting=attention, report=accent, experiment=success, review=done).
- Timeline dots: `bg-fg-default` for past, `bg-accent-emphasis ring-4 ring-accent-subtle` for NOW, `bg-border-default` for future. Line between them: `bg-border-muted` horizontal.
- Carousel controls: small `text-fg-muted hover:text-fg-default` arrows; dot indicators `bg-border-muted` inactive / `bg-fg-default` active.
- Modal: `bg-white` panels, `border-border-default` dividers, no shadows deeper than `shadow-md`.

## Schema additions

```prisma
model ResearchEntry {
  id            String   @id
  projectSlug   String
  date          DateTime
  type          String   // 'meeting' | 'report' | 'experiment' | 'review'
  authorLogin   String
  title         String
  summary       String
  tags          String   // JSON array
  bodyMarkdown  String
  // extensibility (future GitHub/arXiv sync not yet applicable, but keep pattern)
  source        String   @default("internal")
  externalId    String?  @unique
  lastSyncedAt  DateTime?

  project       Project        @relation(fields: [projectSlug], references: [slug], onDelete: Cascade)
  author        Member         @relation(fields: [authorLogin], references: [login])
  artifacts     EntryArtifact[]
  slides        EntrySlide[]
}

model EntryArtifact {
  id         Int    @id @default(autoincrement())
  entryId    String
  type       String // 'notebook' | 'figure' | 'sheet' | 'csv' | 'doc' | 'slide'
  title      String
  href       String
  position   Int
  entry      ResearchEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
}

model EntrySlide {
  id         Int      @id @default(autoincrement())
  entryId    String
  position   Int      // 0 = summary (implicit), 1+ = narrative
  kind       String   // 'discovery' | 'failure' | 'implement' | 'question' | 'next' | 'metric'
  title      String
  body       String
  chip       String?  // optional tag chip
  metricsJson String?  // JSON array of {b, s} for METRIC slides
  code       String?  // optional code snippet
  entry      ResearchEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
}

model Milestone {
  id          Int      @id @default(autoincrement())
  projectSlug String
  date        DateTime
  label       String
  note        String?
  status      String   // 'past' | 'now' | 'future'
  position    Int      // display order

  project     Project  @relation(fields: [projectSlug], references: [slug], onDelete: Cascade)
}

model TodoItem {
  id          Int      @id @default(autoincrement())
  projectSlug String
  bucket      String   // 'short' | 'mid' | 'long'
  text        String
  done        Boolean  @default(false)
  position    Int

  project     Project  @relation(fields: [projectSlug], references: [slug], onDelete: Cascade)
}
```

Project gets back-relations: `entries`, `milestones`, `todos`.

## Seed

Add new project `lldm-unlearning` (or repurpose `long-context-eval`) and port the 8 entries from `meetings2.html` verbatim into `ResearchEntry` + their slides/artifacts.

Port the 6 timeline milestones and 12 todos from meetings2 into `Milestone` and `TodoItem` for that project.

Other 6 existing projects: no entries / milestones / todos (Overview tab renders `EmptyState` telling user "No journal entries yet").

## Acceptance criteria (13a)

- Every project detail Overview tab renders without error.
- Projects with entries: KPI bar, timeline, todos, filter chips, entry grid with carousels, modal on "더보기" click.
- Projects without entries: EmptyState + KPI bar (with zeros where applicable) + (empty) timeline + (empty) todos.
- Carousel navigation works (click zones, progress dots, keyboard arrows when card hovered).
- Filter chips filter the grid client-side.
- Modal opens/closes; renders markdown body (`react-markdown`), artifacts list, mock chatbot scaffold (input + pre-canned responses).
- `pnpm build` clean, typecheck clean, 40+ tests pass (32 existing + new smoke for journal).
- Mock chatbot input can be typed and a canned reply appears — no real LLM call.
