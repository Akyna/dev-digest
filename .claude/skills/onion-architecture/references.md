# References

Sources used to write this skill, grouped by what they contribute.

## Foundational

- Jeffrey Palermo, ["The Onion Architecture: part 1"](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)
  — the origin (2008). Source of the one rule this skill is built on:
  "all code can depend on layers more central, but code cannot depend on
  layers further out from the core." Continues in
  [part 2](https://jeffreypalermo.com/blog/the-onion-architecture-part-2/)
  (interfaces in the core, implementations outside),
  [part 3](https://jeffreypalermo.com/blog/the-onion-architecture-part-3/)
  (wiring / composition root), and
  [part 4 — after four years](https://jeffreypalermo.com/blog/onion-architecture-part-4-after-four-years/)
  (what held up in practice).
- Robert C. Martin, ["The Clean Architecture"](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
  — the Dependency Rule in its most quotable form ("source code
  dependencies can only point inwards"), and the observation that onion,
  hexagonal, and DDD layering are the same structure under different names.
- Herberto Graça, ["Onion Architecture"](https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85)
  — clearest mapping of onion onto ports-and-adapters plus DDD. Source of
  the pragmatism this skill adopts: outer layers may call *any* inner layer
  directly, rather than proxying through each one in turn.
- NDepend, ["Onion Architecture: Going Beyond Layers"](https://blog.ndepend.com/onion-architecture-layers/)
  — why the direction of coupling, not the count of layers, is the thing
  that matters.

## Node / TypeScript application

- [marcoturi/fastify-boilerplate](https://github.com/marcoturi/fastify-boilerplate)
  — Fastify 5 + clean architecture in TypeScript. Its `Route → Handler →
  Domain → Repository` flow and its `*.repository.port.ts` / `*.repository.ts`
  split are the closest published analogue to this repo's
  `routes → service → repository`.
- Wolk Software, ["Implementing SOLID and the onion architecture in Node.js with TypeScript"](http://blog.wolksoftware.com/implementing-solid-and-the-onion-architecture-in-node-js-with-typescript-and-inversifyjs)
  — the canonical Node write-up; the reference for interfaces-in, wiring-out.
- [Melzar/onion-architecture-boilerplate](https://github.com/Melzar/onion-architecture-boilerplate)
  — a full Node/TS tree with onion layer naming, useful as a sanity check on
  where things conventionally land.

## Fastify-specific

- Fastify docs, ["Encapsulation"](https://fastify.dev/docs/latest/Reference/Encapsulation/)
  and ["Decorators"](https://fastify.dev/docs/latest/Reference/Decorators/)
  — why `app.decorate('container', …)` in `app.ts` is the idiomatic seam for
  handing a composition root to route plugins.
- [fastify/fastify-awilix](https://github.com/fastify/fastify-awilix)
  — the library alternative. Cited to justify *not* adopting it: the
  hand-rolled `Container` already provides the override seam that makes
  tests hermetic, and adding an IoC container would be ceremony without a
  new capability.

## Persistence boundary

- Sentry, ["Atomic Repositories in Clean Architecture and TypeScript"](https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/)
  — source of the transaction pattern in this skill: repositories take an
  optional executor (`const invoker = tx ?? db`) and never open their own,
  so the caller controls atomicity without the ORM type escaping the
  infrastructure layer.
- Paul Serban, ["Drizzle ORM Best Practices"](https://www.paulserban.eu/blog/post/drizzle-orm-best-practices-principles-patterns-and-real-world-case-studies/)
  — "repositories return domain types, not database rows"; repository
  methods named for business operations rather than SQL operations; the
  service layer owns the transaction boundary because it knows the scope of
  the business operation.
- Microsoft, ["Designing the infrastructure persistence layer"](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design)
  — repository-per-aggregate, and why the interface belongs in the core
  while the implementation belongs outside it.

## Enforcement (not currently wired up)

The rules in this skill are enforced by review, not by a tool. If that ever
stops being enough, these are the two candidates — and the first is close to
free, since `dependency-cruiser` is **already a `server/` dependency**
(`server/package.json`, installed to back the repo-intel import graph in
`src/adapters/depgraph/index.ts`).

- [sverweij/dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
  and its [rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)
  — `forbidden` rules with `from` / `to` path patterns express every rule in
  this skill directly. Two traps found while prototyping it: putting
  `node_modules` in `options.exclude` drops external packages out of the
  graph so npm-targeting rules silently match nothing (use `doNotFollow`
  instead), and under pnpm those packages resolve to
  `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/…`, so a `^node_modules/`
  anchor never matches.
- [javierbrea/eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)
  — the ESLint-based alternative, which classifies files into element types
  and rules on the relationships. It would be the better choice in a repo
  with an ESLint setup; `server/` currently has none.

## Counterpoint — deliberately included

These bound the skill rather than support it. The layer rules above apply
*inside* a module; they are not an argument for an application-wide
abstraction layer.

- Ben Morris, ["Layers, onions, hexagons and the folly of application-wide abstractions"](https://www.ben-morris.com/onions-hexagons-layers-and-folly-of-application-wide-abstractions/)
  — the real costs: feature implementations scattered across layers, and
  mock-heavy test suites that slow everything down. His conclusion — keep
  repositories and service layers, but scope them per bounded context rather
  than enterprise-wide — is why this skill stops at the module boundary.
- Milan Jovanović, ["Vertical Slice Architecture"](https://milanjovanovic.tech/blog/vertical-slice-architecture)
  and thetshaped.dev, ["Vertical Slice Architecture in Node.js"](https://thetshaped.dev/p/vertical-slice-architecture-in-nodejs-typescript-one-folder-per-use-case)
  — the case against global `controllers/ services/ repositories/` folders:
  one feature ends up scattered across five directories. DevDigest already
  avoids this by slicing first (`src/modules/<name>/`) and layering *within*
  the slice; this skill formalises that hybrid rather than choosing a side.
