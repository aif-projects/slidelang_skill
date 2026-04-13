import fs from "node:fs/promises";
import path from "node:path";

import { DECKS_DATA_ROOT, ROOT } from "./paths.ts";

export const DEFAULT_PROJECTS_ROOT = DECKS_DATA_ROOT;

export interface DeckPlanAsset {
  id: string;
  title?: string;
  goal?: string;
  prompt?: string;
  mode?: "ref" | "asset";
  role?: string;
  must_include?: string[];
  review_focus?: string[];
}

export interface DeckPlanSlide {
  index: number;
  stem: string;
  title: string;
  goal: string;
  must_include: string[];
  speaker_note: string;
  visual_ref_prompt: string;
  visual_mode?: "ref" | "asset";
  visual_asset_id?: string;
  visual_role?: string;
  review_focus?: string[];
  assets?: DeckPlanAsset[];
}

export interface DeckPlan {
  intent: string;
  project_title: string;
  deck_goal: string;
  slides: DeckPlanSlide[];
  planner_model?: string | null;
}

export function slugify(text: string): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "deck";
}

export function titleCaseSlug(slug: string): string {
  const parts = slug.replace(/_/g, "-").split("-").filter(Boolean);
  return parts.length ? parts.map((part) => part[0]!.toUpperCase() + part.slice(1)).join(" ") : "SlideLang Deck";
}

export function fallbackPlan(intent: string, projectHint: string, slideCount: number): DeckPlan {
  const generic: Array<[string, string]> = [
    ["The Idea In One Picture", "Introduce the overall concept and why it matters."],
    ["The Problem To Solve", "Explain the pain point or motivation behind the deck intent."],
    ["Core Mechanism", "Show the main mechanism or architecture at a causal level."],
    ["How It Runs Step By Step", "Walk through the process in order, keeping one state transition per step."],
    ["Edge Cases And Constraints", "Surface the most important limitations, constraints, or failure modes."],
    ["Why The Approach Works", "Summarize the key correctness or trust argument."],
    ["Takeaways", "End with the practical takeaway for the audience."],
  ];
  const slides: DeckPlanSlide[] = [];
  for (let index = 0; index < slideCount; index += 1) {
    const [title, goal] = generic[Math.min(index, generic.length - 1)]!;
    slides.push({
      index,
      stem: `slide_${String(index).padStart(2, "0")}`,
      title: index > 0 ? title : projectHint,
      goal: index > 0 ? goal : "Explain the intent clearly at a glance.",
      must_include: [
        "Stay faithful to the stated intent and any materials you rely on.",
        "Prefer an explanatory visual over a text wall.",
        "Avoid inventing unsupported technical specifics.",
      ],
      speaker_note: goal,
      visual_ref_prompt: `Create a neutral 16:9 technical explainer slide layout reference for '${index > 0 ? title : projectHint}'. Focus on grouping, hierarchy, and spatial composition. Keep the styling grayscale or low-chroma and do not choose the deck palette, branding, or typography. Use boxes/arrows/labels rather than decorative art.`,
    });
  }
  return {
    intent,
    project_title: projectHint,
    deck_goal: "Create a coherent, technically honest explainer deck that fulfills the intent.",
    slides,
  };
}

export function scaffoldManifest(projectId: string, deckTitle: string): Record<string, any> {
  return {
    id: projectId,
    title: deckTitle,
    outputs: { publish: "publish" },
    defaults: { publish: "slidemaker" },
    workflows: {
      slidemaker: {
        type: "publish_presenter",
        out: "publish/slidemaker",
        title: deckTitle,
        fail_on_error: true,
        compile: {
          resolve_passes: 4,
          finalize_passes: 1,
        },
        slides: [],
      },
    },
  };
}

export function buildAuthoringGuide(projectId: string, deckTitle: string, intent: string, plan: DeckPlan | null, projectDir: string): string {
  const slides = plan?.slides?.length
    ? plan.slides.map((slide) => `- \`${slide.stem}\`: ${slide.title} — ${slide.goal}`).join("\n")
    : "- Decide this yourself from the sources.";
  const planNote = plan?.slides?.length
    ? "An optional planning hypothesis is available in `brief/deck_plan.json`. Treat it as a loose starting point, not a template."
    : "No deck plan was pre-generated. You are responsible for choosing the slide arc and slide count.";
  return `# SlideLang Authoring Guide

Project: \`${projectId}\`
Placeholder title: \`${deckTitle}\`
Intent: \`${intent}\`

Your job is to author a real SlideLang deck from scratch.

Inputs:
- \`brief/brief.json\`
- \`brief/session_summary.json\`
- \`brief/AUTHORING_GUIDE.md\`
- \`manifest.json\`

${planNote}

\`brief/brief.json\` records the deck intent. It does not prescribe the title, research path, or source set for you. Choose those yourself before you decide the slide arc.

Suggested slide arc:
${slides}

Work from the repo root:

\`\`\`bash
npm run ts:projects -- publish ${projectId} slidemaker
\`\`\`

Minimal valid slide file:

\`\`\`json
{
  "v": "sl0",
  "fr": [1440, 810, 18],
  "meta": {"id": "slide_00", "title": "Slide title"},
  "gd": {"page": 18, "attach": 14, "gap": 8, "txtc": 10},
  "el": [
    ["b", "BOX", 120, 180, 420, 180, "va", null]
  ],
  "tx": [
    ["title", 72, 88, 1120, 52, "ttc", "Slide title", null, {"fs": 42, "ta": "l"}],
    ["body", 156, 228, 320, 76, "mic", "Meaningful explanatory copy.", "BOX", {"fs": 24, "ml": 3}]
  ],
  "cn": []
}
\`\`\`

Authoring rules:
- Choose the deck title yourself and update \`manifest.json\` once you know it.
- Research the topic yourself as needed. Do not assume the scaffold pre-fetched or summarized anything for you.
- Do not rely on prior deck artifacts or starter slide files. Create the slide specs yourself.
- Strict benchmark rule: do not create \`decks/main/theme.json\` or any \`decks/main/slide_*.sl.json\` files until the planned slide refs already exist on disk. If you author deck files first, the run is invalid and should be restarted with a fresh project id.
- Generate the planned SlideLang images before authoring the deck: slide refs under \`assets/refs/\` and any direct embeddable assets under \`assets/generated/\`.
- If \`brief/deck_plan.json\` exists, use each slide's \`visual_ref_prompt\` and optional \`assets\` entries as the starting point for image generation.
- If \`brief/deck_plan.json\` does not exist yet, write it before running the image CLI.
- Create the deck theme yourself in \`decks/main/theme.json\`.
- Create the slide specs yourself under \`decks/main/\`.
- Stay faithful to the intent and to any materials you decide to rely on. If confidence is low, simplify instead of inventing specifics.
- Keep the result editable in native SlideLang. Do not turn the final deck into raster art.
- Use native SlideLang for visuals the layout engine can draw well: boxes, arrows, formulas, stacks, simple diagrams.
- Use generated assets for visuals SlideLang would fake badly: point clouds, textures, continuous gradients, physical scenes, illustrative metaphors.
- Do not treat assets as a last-resort exception. On many technical decks, the best result uses 2-4 embeddable assets, not just a single hero image.
- Default pattern to consider: 1 hero/frame-filling asset plus 1-2 supporting assets on content slides.
- Ask on each slide whether it is best as native, asset, or hybrid and whether an asset would make the explanation more concrete, legible, or memorable than native boxes/arrows/text alone.
- Especially consider assets when the alternative is a placeholder rectangle or a labeled panel pretending to be a visual.
- If a content slide is visually hard, do not stop at the hero image just because the opener already looks strong.
- All-native decks are acceptable only when the whole explanation is genuinely clearer as native SlideLang.
- Use the presenter workflow as the success target.
- Update \`manifest.json\` so the \`slidemaker\` workflow points at the slides you authored.
- Manifest slide entries must be objects, for example:

\`\`\`json
"slides": [
  {"spec": "decks/main/slide_00.sl.json"},
  {"spec": "decks/main/slide_01.sl.json"}
]
\`\`\`

- First-pass density rule:
  - Text-node \`h\` directly counts toward parent density. Keep it tight to the rendered copy.
  - Do not add breathing room by inflating text boxes; add breathing room in the parent panel instead.
  - If a roomy card layout is intentional, raise parent \`td\` / \`tdp\` rather than trimming already-good copy.
  - If short copy still fails density, fix geometry first and wording second.
- Keep iterating until the workflow is clean, not just publishable.
- Use \`npm run ts:projects -- check ${projectId} slidemaker\` for fast iteration when you want layout/finalize feedback without waiting for PNG rendering and browser lint.
- Run \`npm run ts:projects -- budget ${projectId} slidemaker\` before the first publish once your first draft slides exist.
- Debug using \`publish/slidemaker/check/workflow_summary.json\` and the per-slide \`summary.json\` / \`lint.json\` / \`layout.json\` files.
- If the right fix is ambiguous, run \`npm run ts:projects -- check ${projectId} slidemaker\` first, then \`npm run ts:projects -- repair-plan ${projectId} slidemaker\` or add a slide id at the end.
- For generated refs and assets, inspect the actual generated image files and compare them against the generated review checklist before you use them.
- If a ref or asset contains unwanted text or the composition is wrong, rerun the image CLI with \`--slide <stem>\`, \`--asset <id>\`, and \`--retry\` rather than regenerating the whole batch.

Preferred deck theme at \`decks/main/theme.json\`:

\`\`\`json
{
  "paper": "<hex color>",
  "ink": "<hex color>",
  "muted": "<hex color>",
  "line": "<hex color>",
  "cool": "<hex color>",
  "warm": "<hex color>",
  "neutral": "<hex color>",
  "panel": "<hex color>",
  "dark": "<hex color>",
  "font": "<legacy optional CSS font-family string>",
  "font_display": "<CSS font-family string>",
  "font_body": "<CSS font-family string>"
}
\`\`\`

Theme rules:
- Choose your own palette and typography deliberately for this deck.
- Do not copy a default beige/editorial scheme from this guide.
- Refs are layout-only. Use them for grouping and composition, not for palette, branding, or typography decisions.
- \`font_body\` is the canonical required body font. \`font\` is still accepted as a legacy fallback and will default from \`font_body\` if omitted.
- On dark paper, subtle borders usually fail lint. Make \`line\` materially lighter than the background, even if a lower-contrast stroke looks prettier by eye.

Common token cheat sheet:
- Box styles: \`pn\` = primary neutral panel, \`cl\` = clear container, \`sqw\` = square neutral panel, \`sqg\` = square muted panel, \`sqb\` = square cool panel, \`kd\` = dark key panel.
- Text styles: \`ttc\` = title, \`sec\` = section label, \`mic\` = body copy, \`lab\` = small label, \`smc\` = compact small copy.
- Connector styles: \`ca\` / \`cb\` = arrow families, \`dv\` = divider line.
- Use \`manifest.json\` and the repo README as the full reference if you need less common tokens.

Elements & opts cheat sheet:
- Box/module opts: \`td\` / \`tdp\` = hard/preferred density budgets, \`tl\` / \`tlp\` = hard/preferred line budgets, \`mc\` / \`mcp\` = hard/preferred char budgets, \`ov\` = overflow policy, \`to\` = text obstacle, \`co\` = connector obstacle, \`ed\` = editable toggle.
- Visual opts: \`decorative\` = non-essential visual, \`bleed\` = ignore page-fit padding, \`pf\` = page-fit participation.
- Text opts: \`ml\` = max lines, \`fs\` = font size, \`ta\` = align, \`mc\` = char budget override, \`lockx\` / \`locky\` = preserve authored position during repairs.
- \`ab\` / \`rb\` are aliases for those same budget keys. \`ab.pd\` changes preferred density only; use \`td\` or \`rb.hd\` when you need a higher hard density threshold.

Image generation quickstart:
- Preferred command from the repo root: \`npm run ts:images -- --project-root ${projectDir}\`
- That repo CLI calls the SlideLang image API and mirrors generated files back into the local deck.
- Do not rely on local provider API keys for this path.
- The server-side image pipeline routes slide refs through Gemini/NB2 and embeddable assets through OpenAI GPT Image 1.5.
- If \`brief/deck_plan.json\` does not exist yet, write it first with one slide entry per planned slide and include \`stem\`, \`title\`, \`goal\`, and \`visual_ref_prompt\`.
- For embeddable generated images, add either:
  - \`visual_mode: "asset"\` plus \`visual_asset_id\` on the slide, or
  - an \`assets\` array on the slide with entries like \`{ "id": "hero_bg", "mode": "asset", "prompt": "..." }\`
- Use assets more freely than a fallback escape hatch. They are often the biggest quality jump in a deck when they replace fake placeholder visuals with real imagery, and the strongest technical decks often use more than one.
- Do not stop at a single hero asset if content slides would be clearer with small supporting visuals.
- Keep formulas, labels, connector logic, and simple explanatory diagrams native; use assets for the parts SlideLang cannot fake convincingly.
- For embeddable assets, set a background policy:
  - \`"background_policy": "frame_fill"\` when the image should fully own its rectangle or panel
  - \`"background_policy": "transparent_if_supported"\` for isolated supporting visuals
  - do not default to paper-matched deck backgrounds as a fake matte
- Generated assets are auto-registered into \`manifest.json\` and written under \`assets/generated/\`.
- Generated asset metadata and review checklists are written to \`assets/generated/manifest.json\`.
- Refs use the Google GenAI JavaScript client with \`models/gemini-3.1-flash-image-preview\`.
- Assets use OpenAI GPT Image 1.5 and request WebP output; transparent assets request transparency when supported.
- For focused retries, use:
  - \`npm run ts:images -- --project-root ${projectDir} --slide slide_03\`
  - \`npm run ts:images -- --project-root ${projectDir} --slide slide_hero --asset hero_bg --retry\`

Common connector examples:

\`\`\`json
["go", "c1", "A:b", ["B:t", "C:t"], "ca1", 420, {"th": 3.2}]
["pl", "c2", ["A:r", [760, 320], "B:l"], "ca1", {"th": 3.2, "cr": 20}]
["gi", "c3", ["S1:r", "S2:r", "S3:r"], "HUB:l", "ca1", 720, {"th": 3.2}]
\`\`\`

- Use \`pl\` for ordinary one-source \`A -> B\` connectors.
- Use \`go\` for grouped outbound hub flows from one source to many targets.
- Use \`gi\` for grouped inbound hub flows when several peers converge on one target edge.

Worked grouped inbound recipe:

\`\`\`json
["b", "S1", 120, 180, 180, 72, "pn", null],
["b", "S2", 120, 282, 180, 72, "pn", null],
["b", "S3", 120, 384, 180, 72, "pn", null],
["b", "S4", 120, 486, 180, 72, "pn", null],
["b", "HUB", 840, 300, 220, 150, "pn", null],
["gi", "cFan", ["S1:r", "S2:r", "S3:r", "S4:r"], "HUB:l", "ca1", 540, {"th": 3.2}]
\`\`\`

Relative placement helpers for faster edits:
- \`{"stack_below": "HEADER", "gap_after": 20}\`
- \`{"stack_right_of": "CARD_A", "stack_gap": 24, "align_y": "center"}\`
- Supported alignment keys: \`align_x: left|center|right\`, \`align_y: top|center|bottom\`
- Relative placement only works against nodes declared earlier in the spec.

Image layout helpers:
- \`{"bleed": true}\` makes an element ignore page-fit padding checks.
- \`{"decorative": true}\` marks a non-essential visual element so lint can ignore border-visibility noise.
- Common full-bleed image pattern:

\`\`\`json
["img", "BG", 0, 0, 1440, 810, "asset:hero_bg", null, {"bleed": true, "par": "xMidYMid slice"}],
["b", "SCRIM", 0, 520, 1440, 290, "ovd", null, {"bleed": true, "decorative": true}]
\`\`\`

Rules of thumb:
- Use real \`cn\` connectors. Do not fake arrows with ASCII text.
- Prefer boxes, lanes, and connectors over text walls.
- Keep IDs stable and descriptive.
- Do not put \`th\` in slide specs. Define deck styling in \`decks/main/theme.json\` instead.
- Treat \`mc\` as optional. If you omit it, the compiler derives the current char count automatically.
- \`kd\` forces light child text by design. If you parent dark text inside a \`kd\` panel, the panel style will override it.
- Choose the deck title deliberately; the scaffold title is only a placeholder until you set one.
- Stay faithful to your stated intent and any materials you decide to rely on.
- Stay editable: do not embed raster images as the final diagram.
- Decide the slide arc first, then generate the planned slide refs and embeddable assets before authoring the deck.
- Name refs with slide-linked filenames like \`slide_00_ref\`, \`slide_01_ref\`, and so on; the CLI will write the provider-native image extension.
- Do not create any files under \`decks/main/\` until the per-slide refs already exist on disk.
- Let each slide's ref guide composition and spatial positioning for that slide only.
- Do not let refs choose the deck palette, font, or overall brand treatment.
- Use refs as art direction only; keep the final deck native and editable.

Copy-budget guidance for cleaner first passes:
- Keep titles to roughly 3 to 7 words.
- Keep the title and the dek/subtitle in separate text nodes. Do not stack both into one \`ttc\` title block.
- Keep section headers to roughly 4 to 10 words.
- Small contained text areas work best at roughly 12 to 28 words total.
- Wide explanation panels work best at roughly 25 to 55 words total.
- If one box contains 2 or more text nodes, leave headroom; do not fill the box edge to edge.
- When in doubt, split one dense explanation into 2 containers instead of trimming at the very end.
- Parent density also checks child text-box area against parent content area. The default large-region preferred budget is often about \`0.42\`, so oversized text-node \`h\` values can trigger late density repairs even when the copy itself is short.
- Keep text-node \`h\` tight to the expected rendered copy instead of leaving large safety margins.
- If a visually roomy multi-card layout needs more text area than the default budget allows, raise the parent \`td\` / \`tdp\` deliberately instead of fighting the default density rule indirectly.

Parenting guidance:
- Parent text to the box or container it visually belongs to.
- Leave page-level titles and chrome unparented unless they truly live inside a container.
- If a node visually belongs to a neighboring region, reparent it instead of nudging coordinates forever.
- If a parent is only a little too small, resize the parent instead of compressing all child copy.

Overlap guidance:
- If the title overlaps the dek, separate them vertically before trimming copy.
- If a section header overlaps its body text, move the body down or enlarge the parent container.
- If text overlaps a foreign panel, move the text out of that panel instead of shrinking everything.

Suggested first-pass workflow:
1. Read \`brief/brief.json\`.
2. Choose the deck title and research path yourself.
3. Decide the deck arc.
4. Write \`brief/deck_plan.json\` if it does not exist yet.
5. Run \`npm run ts:images -- --project-root ${projectDir}\` to generate the planned refs and embeddable assets through the image API.
6. Review any generated assets visually against the generated checklist and rerun with \`--retry\` if needed.
7. Confirm the refs exist on disk before authoring anything under \`decks/main/\`.
8. Create \`decks/main/theme.json\` from the chosen direction.
9. Create \`decks/main/slide_00.sl.json\`, \`slide_01.sl.json\`, ...
10. Update \`manifest.json\` workflow slides.
11. Run \`npm run ts:projects -- budget ${projectId} slidemaker\` and trim any obvious over-budget nodes first.
12. Run \`npm run ts:projects -- check ${projectId} slidemaker\` for a fast pre-publish pass.
13. Run \`npm run ts:projects -- check ${projectId} slidemaker\` again after substantial edits, then publish once clean.
14. If the best repair is unclear, run \`npm run ts:projects -- repair-plan ${projectId} slidemaker\` after a fresh check.
15. Keep iterating until all success criteria below are true.

Success criteria:
- \`publish_ok: true\`
- \`clean_ok: true\`
- every slide has \`clean_ok: true\`
- deck feels coherent across slides
- visuals explain the intent rather than restating it as text

Final response requirements:
- final status with the exact \`ok\`, \`publish_ok\`, and \`clean_ok\` values
- files changed
- which planned refs/assets you generated and used
- what was hardest about getting to clean_ok
- 2-4 short feedback points about the toolchain, with at least:
  - one thing that worked well
  - one thing that made authoring or repair harder than it should be
  - whether the copy-budget guidance helped you avoid late-stage trims
`;
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function manifestCollisions(projectId: string, roots: string[]): Promise<string[]> {
  const matches: string[] = [];
  for (const root of roots) {
    const candidate = path.join(root, projectId, "manifest.json");
    try {
      await fs.access(candidate);
      matches.push(candidate);
    } catch {}
  }
  return matches;
}

export async function scaffoldProject(
  projectsRoot: string,
  {
    projectId,
    intent,
    plan,
    force = false,
    reservedRoots = [projectsRoot],
  }: {
    projectId: string;
    intent: string;
    plan: DeckPlan | null;
    force?: boolean;
    reservedRoots?: string[];
  },
): Promise<string> {
  const projectDir = path.join(projectsRoot, projectId);
  const targetManifest = path.resolve(path.join(projectDir, "manifest.json"));
  const collisions = (await manifestCollisions(projectId, reservedRoots)).map((entry) => path.resolve(entry));
  const externalCollisions = collisions.filter((entry) => entry !== targetManifest);
  if (externalCollisions.length) {
    const rels = externalCollisions.map((entry) => path.relative(ROOT, entry)).join(", ");
    throw new Error(`Project id '${projectId}' already exists in another project root: ${rels}. Choose a new project id.`);
  }
  try {
    await fs.access(projectDir);
    if (!force) {
      throw new Error(`Project already exists: ${projectDir}`);
    }
    await fs.rm(projectDir, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const decksDir = path.join(projectDir, "decks", "main");
  const briefDir = path.join(projectDir, "brief");
  const assetsDir = path.join(projectDir, "assets");
  const refsDir = path.join(assetsDir, "refs");
  const generatedDir = path.join(assetsDir, "generated");
  await Promise.all([ensureDir(decksDir), ensureDir(briefDir), ensureDir(assetsDir), ensureDir(refsDir), ensureDir(generatedDir)]);

  const deckTitle = String(plan?.project_title ?? titleCaseSlug(projectId));
  const manifest = scaffoldManifest(projectId, deckTitle);
  await fs.writeFile(path.join(projectDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(briefDir, "brief.json"),
    `${JSON.stringify({
      intent,
      project_id: projectId,
      placeholder_title: deckTitle,
      note: "The scaffold records only the user intent. Choose the title, research path, and source materials during authoring.",
    }, null, 2)}\n`,
    "utf8",
  );
  if (plan) {
    await fs.writeFile(path.join(briefDir, "deck_plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  }
  await fs.writeFile(path.join(briefDir, "AUTHORING_GUIDE.md"), buildAuthoringGuide(projectId, deckTitle, intent, plan, projectDir), "utf8");
  await fs.writeFile(
    path.join(briefDir, "session_summary.json"),
    `${JSON.stringify({
      intent,
      project_id: projectId,
      project_dir: projectDir,
      placeholder_title: deckTitle,
      planned_slides: plan?.slides?.map((slide) => ({ stem: slide.stem, title: slide.title })) ?? [],
      planner_model: plan?.planner_model ?? null,
      plan_generated: Boolean(plan),
      refs_dir: refsDir,
    }, null, 2)}\n`,
    "utf8",
  );
  return projectDir;
}
