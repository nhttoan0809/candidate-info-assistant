# Candidate Atlas design

A recruiter's research workspace: a conversation framed by a compact GitHub dossier and a transparent research log. A small orbital mark represents a question meeting evidence. No invented candidate metrics.

## Tokens

- Canvas `#F4F6FA`, surface `#FFFFFF`, ink `#1C2540`, muted `#626D83`, cobalt `#3658E9`, mint `#18745B`.
- Manrope headings, Be Vietnam Pro body; local font files.
- Four/eight pixel spacing, 16px reading text, 1.75 answer line height. Quiet 1px dividers; only the composer has a pronounced shadow.
- Desktop: compact source/history sidebar / flexible chat / source and activity inspector. Welcome and conversation are left-aligned for reading. Mobile: conversation with accessible profile/activity drawers.

## Information hierarchy

- Home content uses three accessible tabs: “Tổng quan” (default, automatic streaming snapshot), “Kho dự án” (repo quick actions), and “Câu hỏi thường gặp” (suggested research questions). Only the selected section is visible. Mount repo/question lists on selection; preserve the overview stream while switching tabs without repeating its request. Support ArrowLeft/ArrowRight, Home/End, tab/panel labels and visible focus.
- First: state the product purpose in plain Vietnamese: an AI assistant for understanding a candidate through public GitHub projects. Explain the available information: projects and images, skills demonstrated by code, architecture, and recruiting fit. Show the actual configured candidate with a link to the retrieved public profile.
- Home hero names the actual configured GitHub candidate (profile name, then login fallback). A reserved final line types three research-oriented phrases; keep a static accessible heading, pause control, reduced-motion support, and suspend timers in hidden browser tabs. Never animate away the candidate's name.
- On page load, automatically stream one sourced snapshot per workspace/page mount, reused across conversations and tabs. The server-owned overview prompt targets 120–170 Vietnamese words: one opening sentence and four bullets for domains, technologies, recent activity and source limits. Fetch profile/inventory, a single sample of up to 30 public GitHub events filtered to the configured actor/repositories, and only original-repo README.md documents (default 12, four concurrent, at most 6,000 excerpt characters total (intro plus technology-related lines)). Never fetch manifests, code, images or arbitrary Markdown links in this overview. Preserve partial evidence when an individual read fails; state missing/skipped/truncated coverage. Keep the configured reasoning behavior and include a server-authored format reminder after tool data. Events are a limited delayed sample, never a contribution calendar or employment record. Repo update timestamps do not establish commit authorship or work history. README technologies are project self-descriptions, not code-verified skills. Exclude forks from achievements.
- The overview tab includes a compact expandable introduction above the AI snapshot. Prefer a nonblank server-configured CANDIDATE_BIO, labeled “Ứng viên tự giới thiệu”. Otherwise use the retrieved GitHub profile bio, labeled “Bio từ GitHub” with its profile source link. Trim both values; hide the introduction if both are missing or blank. Custom bio is public UI copy, not GitHub-verified evidence, and is never supplied to the model as trusted evidence. Keep the automatic snapshot heading visible on mobile entry. Bio and snapshot appear only in the selected overview tab.
- Do not insert a synthetic overview user question into chat history. Keep repository controls usable while the overview waits, preserve its stream on tab/conversation navigation, cancel only on workspace unmount or explicit stop, and retry only explicitly. Repo/profile/README/activity citations must use exact retrieved source URLs.
- Primary actions: “Đặt câu hỏi riêng” focuses the visibly labeled composer. Public repo cards show real descriptions/languages, mark forks and offer “Hỏi nhanh”, which creates a new conversation about that exact repo. The server-owned repository prompt covers purpose, confirmed stack and one investigation angle in 100–150 words, with real streaming and screenshots when found. List four repos initially with an accessible expand control.
- Secondary actions: four quieter topic rows start deeper questions in the current conversation. They do not represent separate conversation modes. Give the input a concrete example.
- Supporting information: source scope, repository counts, model status, activity and evidence support the main task. Avoid a large decorative emblem, equal-weight feature cards, or invented candidate claims. Describe the empty activity panel as guidance, never as work already performed.
- Keep the automatic snapshot heading visible on a typical mobile entry viewport. Allow the welcome area to scroll to repository and topic controls without trapping the source footer behind the composer; retain visible keyboard focus and reduced-motion support.

## Brief review

The clarity redesign's design search recommended a minimal professional layout, a clear primary CTA and quiet secondary content. Keep the existing cool-white, ink and cobalt palette and Vietnamese-capable local fonts; apply the useful hierarchy, contrast, keyboard and reduced-motion guidance. Use concrete recruiting questions and actual configured profile data rather than a generic hero or sample candidate achievements.

## Interaction

The inspector keeps “Kho mã nguồn” in a separate bounded panel (normally 160–256px, adjusted for short viewports). Profile, activity/sources and repository lists scroll independently; long research logs must never push the repository heading, expand control or inspector footer outside the frame.

Sidebar contains actual conversations and the configured data source, with no topic navigation that implies separate chats. Suggestions in the welcome area start real questions in the current conversation. Activity displays actual classifier and tool states; sources come only from successful retrieval. Connection errors have retry. New conversations preserve previous local sessions. Never imply connectivity before checking.

Preparation feedback stays visible until the first answer text, even when SSE metadata/reasoning/tools already stream. Show truthful phase labels, a readable skeleton and elapsed time, with no fake percentages. Social turns use a direct response without research. Truncated responses keep a clear limitation and a concrete summary action.

Project images are a sourced gallery within each assistant response. Use contained previews, README alt/file captions, raw-size and GitHub-source links; collapse to one column on mobile. Preserve layout while loading and expose an honest failure fallback. Images come from verified tool metadata, never from model-authored Markdown.
