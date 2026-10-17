import React from 'react';
import sublogoForest from '../../assets/brand-lynx/SUBLOGO FOREST.svg';
import sublogoSnow from '../../assets/brand-lynx/SUBLOGO SNOW.svg';
import logotipoForest from '../../assets/brand-lynx/LOGOTIPO FOREST.svg';
import logotipoSnow from '../../assets/brand-lynx/LOGOTIPO SNOW.svg';
import iconeForest from '../../assets/brand-lynx/ICONE FOREST.svg';
import iconeSnow from '../../assets/brand-lynx/ICONE SNOW-17.svg';

/**
 * Componente Central de Identidade Visual da Marca Lynx SM / SINCO
 *
 * @param {'sublogo-forest'|'sublogo-snow'|'logotipo-forest'|'logotipo-snow'|'icon-forest'|'icon-snow'} variant
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} size
 */
export const AppLogo = ({
    variant = 'sublogo-snow',
    size = 'md',
    className = '',
    alt = 'Lynx SM / SINCO Industrial Suite',
    clickable = false,
    onClick
}) => {
    const sizeMap = {
        xs: 'h-6 w-auto',
        sm: 'h-8 w-auto',
        md: 'h-10 w-auto',
        lg: 'h-14 w-auto',
        xl: 'h-20 w-auto'
    };

    const variantMap = {
        'sublogo-forest': sublogoForest,
        'sublogo-snow': sublogoSnow,
        'logotipo-forest': logotipoForest,
        'logotipo-snow': logotipoSnow,
        'icon-forest': iconeForest,
        'icon-snow': iconeSnow,
    };

    const logoSrc = variantMap[variant] || sublogoSnow;
    const finalSizeClass = sizeMap[size] || sizeMap.md;

    return (
        <img
            src={logoSrc}
            alt={alt}
            onClick={onClick}
            className={`object-contain transition-transform duration-200 select-none ${finalSizeClass} ${clickable ? 'cursor-pointer hover:scale-105 active:scale-95' : ''} ${className}`}
            draggable={false}
        />
    );
};

export default AppLogo;
