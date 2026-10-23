/** Typeahead data shapes and option ordering (shared by the API route, GlobalSearch and the gallery). */

/** Response of GET /api/typeahead?q= */
export type TypeaheadResponse = {
  people: { slug: string; name: string; meta: string | null }[];
  programs: { slug: string; name: string; shortName: string; meta: string | null }[];
};

export type TypeaheadOption =
  | { kind: "person"; key: string; href: string; name: string; meta: string | null; slug: string }
  | { kind: "program"; key: string; href: string; name: string; meta: string | null; shortName: string }
  | { kind: "all"; key: string; href: string };

/** Flattened, keyboard-ordered options: people, programs, then "See all results". */
export function typeaheadOptions(results: TypeaheadResponse | null, term: string): TypeaheadOption[] {
  if (!results) return [];
  return [
    ...results.people.map((p) => ({ kind: "person" as const, key: `p:${p.slug}`, href: `/in/${p.slug}`, name: p.name, meta: p.meta, slug: p.slug })),
    ...results.programs.map((o) => ({ kind: "program" as const, key: `o:${o.slug}`, href: `/programs/${o.slug}`, name: o.name, meta: o.meta, shortName: o.shortName })),
    { kind: "all" as const, key: "all", href: `/search?q=${encodeURIComponent(term)}` },
  ];
}
