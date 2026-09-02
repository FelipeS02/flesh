import { cloneElement, ReactElement, SVGProps } from 'react';

export function SvgComponent(svg: ReactElement<SVGProps<SVGSVGElement>>) {
  return (props: SVGProps<SVGSVGElement>) => cloneElement(svg, props);
}
