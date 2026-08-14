/** Constants for SkillDetail.

    The tab contract itself lives at the route level (`app/skills/constants.ts`)
    because SkillsListView validates `?tab=` against it before mounting this
    component — two consumers in one route. Re-exported here so the tab-owning
    component stays the obvious place to look for it. */

export { TABS, VALID_TABS, DEFAULT_TAB, type SkillTab } from "../../constants";
