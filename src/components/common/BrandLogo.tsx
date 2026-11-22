import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { getBrandThemeById, type BrandThemeId } from "@/themes/themeRegistry";
import { RelixLogo, type RelixLogoProps } from "./RelixLogo";

export interface BrandLogoProps extends RelixLogoProps {
  /** Tema opcional para pré-visualizações isoladas; quando omitido, lê o tema ativo do contexto. */
  themeId?: BrandThemeId;
}

interface BrandLogoByThemeIdProps extends RelixLogoProps {
  themeId: BrandThemeId;
}

const BrandLogoByThemeId: React.FC<BrandLogoByThemeIdProps> = ({
  themeId,
  variant,
  mode,
  height,
  className,
  ...restProps
}) => {
  const themeDef = getBrandThemeById(themeId);

  switch (themeDef.logoId) {
    case "relix-crimson":
      return (
        <RelixLogo
          variant={variant}
          mode={mode}
          height={height}
          className={className}
          {...restProps}
        />
      );
    default: {
      const _exhaustive: never = themeDef.logoId;
      throw new Error(`Unsupported brand logo id: ${String(_exhaustive)}`);
    }
  }
};

const BrandLogoFromContext: React.FC<RelixLogoProps> = (props) => {
  const { brandTheme } = useTheme();
  return <BrandLogoByThemeId themeId={brandTheme} {...props} />;
};

/**
 * Wrapper desacoplado de logo que acompanha a variação configurada no tema ativo
 * tanto no modo claro quanto no modo escuro, delegando `mode` à variante da logo.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ themeId, ...logoProps }) => {
  if (themeId !== undefined) {
    return <BrandLogoByThemeId themeId={themeId} {...logoProps} />;
  }
  return <BrandLogoFromContext {...logoProps} />;
};

export default BrandLogo;
