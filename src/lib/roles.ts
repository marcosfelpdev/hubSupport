export const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Administrador" },
  { value: "USER", label: "Colaborador" },
  { value: "SUPPORT", label: "Suporte" },
  { value: "TECHNICIAN", label: "Técnico" },
  { value: "MANAGER", label: "Gestor" },
] as const;

export type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];
