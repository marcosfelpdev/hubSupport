import React, { useId } from 'react';

export interface RelixLogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'full' | 'symbol' | 'app-icon';
  mode?: 'auto' | 'light' | 'dark';
  height?: number;
  className?: string;
}

export const RelixLogo: React.FC<RelixLogoProps> = ({
  variant = 'full',
  mode = 'auto',
  height,
  className = '',
  style,
  ...restProps
}) => {
  const reactId = useId();
  const safeId = reactId.replace(/:/g, '');
  const foldGradId = `relix-ribbon-fold-${safeId}`;
  const mainGradId = `relix-ribbon-main-${safeId}`;

  // Color handling
  // Crimson brand color: #DE1D4B
  // Dark mode text/bracket: #FFFFFF
  // Light mode text/bracket: #121A2D
  let textColorClass = 'text-[#121A2D] dark:text-white';
  let primaryFill = 'currentColor';

  if (mode === 'dark') {
    textColorClass = 'text-white';
    primaryFill = '#FFFFFF';
  } else if (mode === 'light') {
    textColorClass = 'text-[#121A2D]';
    primaryFill = '#121A2D';
  }

  // App icon variant (rounded crimson rectangle with white symbol)
  if (variant === 'app-icon') {
    const width = height !== undefined ? height : undefined;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        height={height}
        width={width}
        className={`inline-block select-none ${className}`}
        style={style}
        role="img"
        aria-label="Relix Icon"
        {...restProps}
      >
        <rect width="512" height="512" rx="112" fill="#DE1D4B" />
        <g id="relix-symbol" transform="translate(84.125, 86.625) scale(1.25)">
          {/* Outer Bracket */}
          <path
            d="M 17 251 L 17 60 C 17 37 37 20 60 20 L 239 20 C 239 28 228 48 202 64 L 60 64 L 60 251 Z"
            fill="#FFFFFF"
          />
          {/* Ribbon R/X Body */}
          <path
            fillRule="evenodd"
            d="M 84 87 L 200 87 C 224 87 240 103 240 127 C 240 148 226 163 202 188 L 258 251 L 204 251 L 171 219 L 138 251 L 84 251 L 140 188 L 84 131 L 84 87 Z M 147 133 L 195 133 L 171 157 Z"
            fill="#FFFFFF"
          />
        </g>
      </svg>
    );
  }

  // Symbol-only variant
  if (variant === 'symbol') {
    const width = height !== undefined ? height : undefined;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 270 270"
        height={height}
        width={width}
        className={`inline-block select-none ${textColorClass} ${className}`}
        style={style}
        role="img"
        aria-label="Relix Symbol"
        {...restProps}
      >
        <defs>
          <linearGradient id={foldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#AA1238" />
            <stop offset="100%" stopColor="#DE1D4B" />
          </linearGradient>
          <linearGradient id={mainGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E62050" />
            <stop offset="100%" stopColor="#DE1D4B" />
          </linearGradient>
        </defs>

        <g id="relix-symbol">
          {/* Outer Bracket */}
          <path
            d="M 17 251 L 17 60 C 17 37 37 20 60 20 L 239 20 C 239 28 228 48 202 64 L 60 64 L 60 251 Z"
            fill={primaryFill}
          />
          {/* Ribbon R/X Body */}
          <path
            fillRule="evenodd"
            d="M 84 87 L 200 87 C 224 87 240 103 240 127 C 240 148 226 163 202 188 L 258 251 L 204 251 L 171 219 L 138 251 L 84 251 L 140 188 L 84 131 L 84 87 Z M 147 133 L 195 133 L 171 157 Z"
            fill={`url(#${mainGradId})`}
          />
          {/* Ribbon Fold Shadow / 3D fold */}
          <path
            d="M 84 87 L 84 131 L 140 188 L 171 157 L 147 133 L 132 133 L 84 87 Z"
            fill={`url(#${foldGradId})`}
            opacity="0.85"
          />
        </g>
      </svg>
    );
  }

  // Full variant (Symbol + Wordmark "relix")
  const width = height !== undefined ? Math.round(height * (780 / 270)) : undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 780 270"
      height={height}
      width={width}
      className={`inline-block select-none ${textColorClass} ${className}`}
      style={style}
      role="img"
      aria-label="Relix"
      {...restProps}
    >
      <defs>
        <linearGradient id={foldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#AA1238" />
          <stop offset="100%" stopColor="#DE1D4B" />
        </linearGradient>
        <linearGradient id={mainGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E62050" />
          <stop offset="100%" stopColor="#DE1D4B" />
        </linearGradient>
      </defs>

      {/* SYMBOL */}
      <g id="relix-symbol">
        {/* Outer Bracket */}
        <path
          d="M 17 251 L 17 60 C 17 37 37 20 60 20 L 239 20 C 239 28 228 48 202 64 L 60 64 L 60 251 Z"
          fill={primaryFill}
        />
        {/* Ribbon R/X Body */}
        <path
          fillRule="evenodd"
          d="M 84 87 L 200 87 C 224 87 240 103 240 127 C 240 148 226 163 202 188 L 258 251 L 204 251 L 171 219 L 138 251 L 84 251 L 140 188 L 84 131 L 84 87 Z M 147 133 L 195 133 L 171 157 Z"
          fill={`url(#${mainGradId})`}
        />
        {/* Ribbon Fold Shadow / 3D fold */}
        <path
          d="M 84 87 L 84 131 L 140 188 L 171 157 L 147 133 L 132 133 L 84 87 Z"
          fill={`url(#${foldGradId})`}
          opacity="0.85"
        />
      </g>

      {/* WORDMARK: relix */}
      <g id="relix-wordmark" fill={primaryFill}>
        {/* r */}
        <path d="M 307 94 L 338 94 L 338 116 C 344 102 356 92 372 92 L 381 92 L 381 123 L 368 123 C 350 123 338 135 338 154 L 338 217 L 307 217 Z" />

        {/* e */}
        <path
          fillRule="evenodd"
          d="M 451 91 C 416 91 388 119 388 155 C 388 191 416 219 453 219 C 478 219 498 206 507 187 L 480 173 C 474 184 464 191 452 191 C 433 191 421 178 419 162 L 513 162 C 514 159 514 156 514 152 C 514 118 486 91 451 91 Z M 419 141 C 422 126 433 116 451 116 C 468 116 479 126 482 141 Z"
        />

        {/* l */}
        <rect x="532" y="50" width="33" height="167" />

        {/* i */}
        <rect x="588" y="50" width="33" height="29" />
        <rect x="588" y="94" width="33" height="123" />

        {/* x: primary diagonal stroke (drawn first underneath crimson diagonal) */}
        <polygon points="635,94 670,94 759,217 724,217" />
      </g>

      {/* x: crimson diagonal stroke (drawn on top) */}
      <polygon points="634,217 669,217 759,94 724,94" fill="#DE1D4B" />
    </svg>
  );
};

export default RelixLogo;
