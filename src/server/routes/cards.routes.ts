import { Request, RequestHandler, Response, Router } from "express";
import { authenticateToken } from "../auth";
import {
  enrichCardWithStatus,
  PhoneFinderRuntime,
  phoneFinderRuntime,
} from "../phoneFinder";

export interface CardsRouterOptions {
  authMiddleware?: RequestHandler;
}

export function createCardsRouter(
  runtime: PhoneFinderRuntime,
  options?: CardsRouterOptions
): Router {
  const router = Router();
  const authMiddleware = options?.authMiddleware ?? authenticateToken;

  router.use(authMiddleware);

  // GET /api/cards — Lista todos os cards enriquecidos (sem pushToken)
  router.get("/", async (_req: Request, res: Response): Promise<void> => {
    try {
      const cards = await runtime.cardRepository.findAll();
      const enriched = cards.map((card) =>
        enrichCardWithStatus(card, runtime.presenceService)
      );
      res.json(enriched);
    } catch (error) {
      console.error("[PhoneFinder][Cards] Erro ao listar cards:", error);
      res.status(500).json({ error: "Erro ao listar cards do Phone Finder." });
    }
  });

  // GET /api/cards/:id — Consulta um card específico
  router.get("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const card = await runtime.cardRepository.findById(id);
      if (!card) {
        res.status(404).json({ error: "Card não encontrado." });
        return;
      }

      res.json(enrichCardWithStatus(card, runtime.presenceService));
    } catch (error) {
      console.error("[PhoneFinder][Cards] Erro ao buscar card:", error);
      res.status(500).json({ error: "Erro ao buscar card." });
    }
  });

  // POST /api/cards — Cria novo card
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description } = req.body ?? {};

      if (typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "O nome do card é obrigatório." });
        return;
      }

      if (
        description !== undefined &&
        description !== null &&
        typeof description !== "string"
      ) {
        res.status(400).json({ error: "A descrição do card é inválida." });
        return;
      }

      const normalizedDescription =
        typeof description === "string" && description.trim().length > 0
          ? description.trim()
          : null;

      const created = await runtime.cardRepository.create({
        name: name.trim(),
        description: normalizedDescription,
      });

      res.status(201).json(enrichCardWithStatus(created, runtime.presenceService));
    } catch (error) {
      console.error("[PhoneFinder][Cards] Erro ao criar card:", error);
      res.status(500).json({ error: "Erro ao criar card." });
    }
  });

  // PUT /api/cards/:id — Atualiza nome e/ou descrição
  router.put("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const body = req.body ?? {};
      const updateData: { name?: string; description?: string | null } = {};

      if ("name" in body) {
        if (typeof body.name !== "string" || body.name.trim().length === 0) {
          res.status(400).json({ error: "O nome do card não pode ser vazio." });
          return;
        }
        updateData.name = body.name.trim();
      }

      if ("description" in body) {
        if (body.description === null) {
          updateData.description = null;
        } else if (typeof body.description === "string") {
          updateData.description =
            body.description.trim().length > 0
              ? body.description.trim()
              : null;
        } else {
          res.status(400).json({ error: "A descrição do card é inválida." });
          return;
        }
      }

      const updated = await runtime.cardRepository.update(id, updateData);
      if (!updated) {
        res.status(404).json({ error: "Card não encontrado." });
        return;
      }

      res.json(enrichCardWithStatus(updated, runtime.presenceService));
    } catch (error) {
      console.error("[PhoneFinder][Cards] Erro ao atualizar card:", error);
      res.status(500).json({ error: "Erro ao atualizar card." });
    }
  });

  // DELETE /api/cards/:id — Desvincula (se pareado) e remove o card
  router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const deleted = await runtime.deleteCard(id);
      if (!deleted) {
        res.status(404).json({ error: "Card não encontrado." });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[PhoneFinder][Cards] Erro ao excluir card:", error);
      res.status(500).json({ error: "Erro ao excluir card." });
    }
  });

  // POST /api/cards/:id/pairing-code — Gera código de pareamento de 6 dígitos (TTL 5 min)
  router.post(
    "/:id/pairing-code",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const id = req.params.id as string;
        const pairingCode = await runtime.pairingService.generateCode(id);
        if (!pairingCode) {
          res.status(404).json({ error: "Card não encontrado." });
          return;
        }

        res.json(pairingCode);
      } catch (error) {
        console.error(
          "[PhoneFinder][Cards] Erro ao gerar código de pareamento:",
          error
        );
        res.status(500).json({ error: "Erro ao gerar código de pareamento." });
      }
    }
  );

  // POST /api/cards/:id/unpair — Desvincula aparelho pareado
  router.post(
    "/:id/unpair",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const id = req.params.id as string;
        const updated = await runtime.unpairCard(id);
        if (!updated) {
          res.status(404).json({ error: "Card não encontrado." });
          return;
        }

        res.json({ success: true });
      } catch (error) {
        console.error(
          "[PhoneFinder][Cards] Erro ao desvincular card:",
          error
        );
        res.status(500).json({ error: "Erro ao desvincular dispositivo." });
      }
    }
  );

  // POST /api/cards/:id/locate — Dispara alerta sonoro + vibração + tela vermelha
  router.post(
    "/:id/locate",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const id = req.params.id as string;
        const outcome = await runtime.commandService.dispatchCommand(
          id,
          "locate"
        );
        res.status(outcome.httpStatus).json(outcome.feedback);
      } catch (error) {
        console.error(
          "[PhoneFinder][Cards] Erro ao disparar locate:",
          error
        );
        res.status(500).json({ error: "Erro ao disparar comando localizar." });
      }
    }
  );

  // POST /api/cards/:id/vibrate — Dispara alerta silencioso de vibração
  router.post(
    "/:id/vibrate",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const id = req.params.id as string;
        const outcome = await runtime.commandService.dispatchCommand(
          id,
          "vibrate"
        );
        res.status(outcome.httpStatus).json(outcome.feedback);
      } catch (error) {
        console.error(
          "[PhoneFinder][Cards] Erro ao disparar vibrate:",
          error
        );
        res.status(500).json({ error: "Erro ao disparar comando vibrar." });
      }
    }
  );

  return router;
}

export default createCardsRouter(phoneFinderRuntime);
