import { categoryLabels, type Lesson } from "./types";

export function LessonsRail({ lessons }: { lessons: Lesson[] }) {
  return (
    <aside className="border-t border-[var(--border)] bg-[var(--surface)] md:border-l md:border-t-0">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <p className="mono text-[10px] uppercase text-[var(--text-muted)]">Lessons Learned</p>
        <h2 className="serif mt-1 text-2xl font-medium text-[var(--text-primary)]">Case memory</h2>
      </div>
      <div className="max-h-[calc(100vh-124px)] space-y-3 overflow-y-auto p-3 pb-20 md:pb-3">
        {lessons.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-5 px-8 text-center">
            <p className="serif italic text-[var(--text-muted)]">
              No lessons yet — first campaign in flight.
            </p>
            <div className="h-12 w-12 rounded-full border border-[#B8954E]/60" />
          </div>
        ) : (
          lessons.map((lesson, index) => (
            <article
              className="relative border border-[var(--border)] border-l-[#B8954E] bg-[#0F0E0C] p-4"
              key={lesson.id}
              style={{
                animation: "lesson-fade-in 240ms ease-out both",
                animationDelay: `${Math.min(index, 4) * 60}ms`,
              }}
            >
              <span className="serif text-3xl leading-none text-[#B8954E]">❝</span>
              <p className="serif mt-2 text-lg italic leading-7 text-[var(--text-primary)]">{lesson.content}</p>
              <p className="mono mt-4 text-[10px] uppercase text-[var(--text-muted)]">
                {categoryLabels[lesson.category]} / {lesson.sourceCompany} /{" "}
                {lesson.outcome === "success" ? "success" : "failure"}
              </p>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
