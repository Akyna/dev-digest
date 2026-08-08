import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { ConventionsService } from './service.js';

/**
 * L02 — conventions module.
 *   POST  /repos/:id/conventions/extract     → run the extraction pipeline (sync)
 *   GET   /repos/:id/conventions             → list + last_scan_at
 *   PATCH /conventions/:id                   → accept/reject/edit one candidate
 *   POST  /repos/:id/conventions/skill-draft → preview a skill body (no writes)
 *   POST  /repos/:id/conventions/skill       → create the skill (+ optional agent links)
 */

const PatchConventionBody = z.object({
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  rule: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  evidence_snippet: z.string().optional(),
});

const SkillDraftBody = z.object({
  convention_ids: z.array(z.string().uuid()).min(1),
});

const CreateSkillBody = z.object({
  convention_ids: z.array(z.string().uuid()).min(1),
  name: z.string().trim().min(1).max(80),
  description: z.string().optional(),
  type: SkillType.default('convention'),
  enabled: z.boolean().optional(),
  body: z.string().min(1),
  agent_ids: z.array(z.string().uuid()).optional(),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.post('/repos/:id/conventions/extract', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.extract(workspaceId, req.params.id);
  });

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: PatchConventionBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.update(workspaceId, req.params.id, req.body);
    },
  );

  app.post(
    '/repos/:id/conventions/skill-draft',
    { schema: { params: IdParams, body: SkillDraftBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.skillDraft(workspaceId, req.params.id, req.body);
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateSkillBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const body = req.body;
      const skill = await service.createSkill(workspaceId, req.params.id, {
        convention_ids: body.convention_ids,
        name: body.name,
        type: body.type,
        body: body.body,
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.agent_ids !== undefined ? { agent_ids: body.agent_ids } : {}),
      });
      reply.status(201);
      return skill;
    },
  );
}
