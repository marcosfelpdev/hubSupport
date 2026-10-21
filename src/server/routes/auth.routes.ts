import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { generateToken, authenticateToken } from "../auth";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      res.status(401).json({ error: "E-mail ou senha inválidos. Tente novamente." });
      return;
    }

    if (!user.active) {
      res.status(403).json({ error: "Usuário inativo. Contate o administrador do sistema." });
      return;
    }

    const passwordMatch = await bcrypt.compare(String(password), user.password);
    if (!passwordMatch) {
      res.status(401).json({ error: "E-mail ou senha inválidos. Tente novamente." });
      return;
    }

    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    // Salva cookie seguro HTTP-only
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
    });
  } catch (error) {
    console.error("[Auth] Erro no login:", error);
    res.status(500).json({ error: "Erro interno no servidor ao processar autenticação." });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, (req: Request, res: Response): void => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post("/logout", (req: Request, res: Response): void => {
  res.clearCookie("token");
  res.json({ success: true });
});

export default router;
