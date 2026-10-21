import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export const JWT_SECRET = process.env.JWT_SECRET || "hubsupport-jwt-secret-production-key-2026";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateToken(user: { id: string; name: string; email: string; role: string }): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: "Não autorizado. Token de sessão não fornecido." });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      res.status(401).json({ error: "Sessão inválida ou usuário inativo." });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token inválido ou expirado. Faça login novamente." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Acesso negado. Apenas administradores podem executar esta ação." });
    return;
  }
  next();
}

export function requireTechnicianOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.role !== "TECHNICIAN" && req.user.role !== "ADMIN")) {
    res.status(403).json({ error: "Acesso restrito à equipe técnica ou administradores." });
    return;
  }
  next();
}
