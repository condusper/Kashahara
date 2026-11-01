import { Router } from 'express';
import type { CatalogService } from '../services/catalog';
import type { VtuProvider } from '../providers';

export function createCatalogRouter(catalog: CatalogService, provider: VtuProvider): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const resolved = await catalog.getCatalog();
      res.json({
        catalog: resolved,
        version: resolved.version,
        notice: resolved.notice,
        provider: {
          name: provider.name,
          simulated: provider.isSimulated,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
