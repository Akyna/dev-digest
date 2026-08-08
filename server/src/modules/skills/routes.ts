import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillSource, SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { IMPORT_BODY_LIMIT } from './constants.js';
import { SkillsService } from './service.js';

/** `/skills/:id/versions/:version` — id is a uuid, version a positive integer. */
const VersionParams = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

/**
 * A1 — skills module (owner A1).
 *   GET    /skills                       → list (workspace-scoped)
 *   GET    /skills/:id                   → one skill
 *   POST   /skills                       → create
 *   PUT    /skills/:id                   → update / toggle enabled (versions body)
 *   DELETE /skills/:id                   → delete
 *   GET    /skills/:id/versions          → body history (newest first)
 *   GET    /skills/:id/versions/:version → one body snapshot
 *   POST   /skills/:id/restore/:version  → restore an old body as a NEW version
 *   POST   /skills/import/preview        → parse a .md/.zip upload, persists nothing
 */

/** A skill name is interpolated into the assembled prompt (as a `###` heading
    and as the `<untrusted source="...">` label), so it is constrained at the
    edge rather than only escaped at render time — defence in depth, since an
    imported name comes from a third party's frontmatter. */
const SkillName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\w][\w .-]*$/, 'Use letters, digits, spaces, dots, dashes or underscores');

const CreateSkillBody = z.object({
  name: SkillName,
  description: z.string().default(''),
  type: SkillType,
  body: z.string().min(1),
  source: SkillSource.optional(),
  enabled: z.boolean().optional(),
});

const UpdateSkillBody = z.object({
  name: SkillName.optional(),
  description: z.string().optional(),
  type: SkillType.optional(),
  body: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

/** Exactly one of `content` (.md text) or `content_b64` (.zip bytes). */
const ImportBody = z
  .object({
    filename: z.string().min(1),
    content: z.string().optional(),
    content_b64: z.string().optional(),
  })
  // Presence, not truthiness: `''` is falsy, so a truthiness XOR both accepts
  // `{ content: '', content_b64: <zip> }` (two keys, wrong branch taken) and
  // rejects a genuine single-key `{ content: '' }` with a misleading message.
  .refine((b) => (b.content !== undefined) !== (b.content_b64 !== undefined), {
    message: 'Provide exactly one of content / content_b64',
  });

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const body = req.body;
    const skill = await service.create(workspaceId, {
      name: body.name,
      description: body.description,
      type: body.type,
      body: body.body,
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    });
    reply.status(201);
    return skill;
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.update(workspaceId, req.params.id, req.body);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.get('/skills/:id/versions/:version', { schema: { params: VersionParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const version = await service.getVersion(workspaceId, req.params.id, req.params.version);
    if (!version) throw new NotFoundError('Skill version not found');
    return version;
  });

  app.post('/skills/:id/restore/:version', { schema: { params: VersionParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.restoreVersion(workspaceId, req.params.id, req.params.version);
    if (!skill) throw new NotFoundError('Skill version not found');
    return skill;
  });

  // A base64 archive does not fit the global 1MB bodyLimit from app.ts, so this
  // one route raises it (Fastify 5 route option, sibling of `schema`).
  app.post(
    '/skills/import/preview',
    { bodyLimit: IMPORT_BODY_LIMIT, schema: { body: ImportBody } },
    async (req) => {
      await getContext(app.container, req);
      const body = req.body;
      return service.importPreview({
        filename: body.filename,
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.content_b64 !== undefined ? { content_b64: body.content_b64 } : {}),
      });
    },
  );
}
