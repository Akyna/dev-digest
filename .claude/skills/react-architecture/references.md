# References

Sources used to write this skill, grouped by what they contribute.

## Foundational principle

- Kent C. Dodds, ["Colocation"](https://kentcdodds.com/blog/colocation) —
  origin of "place code as close to where it's relevant as possible; things
  that change together should live together." The basis for this skill's
  core rule.

## Feature-based / architecture methodologies

- [alan2207/bulletproof-react](https://github.com/alan2207/bulletproof-react),
  specifically [project-structure.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
  and [project-standards.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md) —
  widely-referenced production React architecture: feature folders,
  unidirectional `shared → features → app` dependency flow.
- [Feature-Sliced Design](https://feature-sliced.design/) — formal
  methodology (layers/slices/segments) for organizing frontend code by
  domain rather than technical type; DDD-influenced. Its
  [Next.js App Router guide](https://feature-sliced.design/blog/nextjs-app-router-guide)
  applies the same ideas specifically to `app/`.
- Robin Wieruch, ["React Folder Structure Best Practices [2026]"](https://www.robinwieruch.de/react-folder-structure/) —
  practical walkthrough of the progression from a flat structure to a
  feature-based one as an app grows.
- Alex Kondov, [Tao of React](https://alexkondov.com/tao-of-react/) and
  [Clean Architecture in React](https://alexkondov.com/full-stack-tao-clean-architecture-react/);
  DEV Community, ["Screaming Architecture — Evolution of a React folder structure"](https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25) —
  critique of generic `container/component` splits in favor of naming that
  "screams" the domain, not the framework.

## Next.js file organization

- Next.js official docs, ["Project Structure"](https://nextjs.org/docs/app/getting-started/project-structure) —
  `page`/`layout`/route groups/private folders conventions.
- Next.js docs, ["Project Organization and File Colocation"](https://nextjs.org/docs/13/app/building-your-application/routing/colocation) —
  confirms colocation is safe-by-default inside `app/`; a route isn't public
  until a `page.js`/`route.js` file exists in that segment.

## Business logic placement

- Felix Gerschau, ["Separation of concerns with React hooks"](https://felixgerschau.com/react-hooks-separation-of-concerns/) —
  custom hooks as the seam between UI and business/data logic.
- profy.dev, ["Path To A Clean(er) React Architecture — Business Logic Separation"](https://profy.dev/article/react-architecture-business-logic-and-dependency-injection) —
  three-layer framing (presentational / business logic / implementation
  glue) used for this skill's hooks-vs-helpers split.

## Component taxonomy

- Cheesecake Labs, ["Rethinking Atomic Design in React Projects"](https://cheesecakelabs.com/blog/rethinking-atomic-design-react-projects/) —
  where atomic design helps (shared design systems) versus where it adds
  ceremony without payoff (ordinary feature components) — basis for this
  skill's narrow atomic-design scoping.
