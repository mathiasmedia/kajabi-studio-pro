/**
 * Section wrappers — HeaderSection, ContentSection, FooterSection
 */
import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode, type CSSProperties } from 'react';
import type { BlockComponent, SectionLayoutProps } from './types';
import type { SectionComponent } from './serialize';

function getBlockColWidth(child: ReactElement): string {
  const props = (child.props ?? {}) as Record<string, unknown>;
  if (typeof props.width === 'string' && props.width) return props.width;
  if (typeof props.colWidth === 'string' && props.colWidth) return props.colWidth;
  const ChildType = child.type as Partial<BlockComponent>;
  if (typeof ChildType?.serialize === 'function') {
    try {
      const s = ChildType.serialize(props);
      if (s && typeof s.width === 'string' && s.width) return s.width;
    } catch {
      // ignore
    }
  }
  return '12';
}

function isBlockChild(child: ReactNode): child is ReactElement {
  return (
    isValidElement(child) &&
    typeof child.type === 'function' &&
    'kajabiType' in (child.type as object)
  );
}

function wrapContentChildren(children: ReactNode): ReactNode {
  const wrapped: ReactNode[] = [];
  const counter = { i: 0 };
  const COL_PADDING = 15;
  const ROW_GAP = 28;
  const cols: Array<{ w: number; node: ReactNode; key: string }> = [];

  function pushCol(width: string, content: ReactNode) {
    const w = Number(width) || 12;
    cols.push({ w, node: content, key: `col-${counter.i++}` });
  }

  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (isValidElement(child) && child.type === Fragment) {
        visit((child.props as { children?: ReactNode }).children);
        return;
      }
      if (isValidElement(child) && (child.props as Record<string, unknown>)?.['data-block-wrapper'] === 'true') {
        const inner = (child.props as { children?: ReactNode }).children;
        const innerEl = Children.toArray(inner).find(isBlockChild) as ReactElement | undefined;
        if (innerEl) {
          pushCol(getBlockColWidth(innerEl), child);
          return;
        }
      }
      if (isBlockChild(child)) {
        pushCol(getBlockColWidth(child), cloneElement(child));
        return;
      }
      if (isValidElement(child)) {
        wrapped.push(<Fragment key={`f-${counter.i++}`}>{child}</Fragment>);
      }
    });
  }

  visit(children);

  const isSingleSubFull = cols.length === 1 && cols[0].w < 12;
  for (const c of cols) {
    const basis = `${(c.w / 12) * 100}%`;
    wrapped.push(
      <div
        key={c.key}
        className={`col-md-${c.w}`}
        style={{
          flex: `0 0 ${basis}`,
          maxWidth: basis,
          paddingLeft: `${COL_PADDING}px`,
          paddingRight: `${COL_PADDING}px`,
          marginLeft: isSingleSubFull ? 'auto' : undefined,
          marginRight: isSingleSubFull ? 'auto' : undefined,
          boxSizing: 'border-box',
        }}
      >
        {c.node}
      </div>,
    );
  }

  return (
    <div
      className="row"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-start',
        rowGap: `${ROW_GAP}px`,
        margin: 0,
      }}
    >
      {wrapped}
    </div>
  );
}

const HEADER_ALLOWED = new Set(['logo', 'menu', 'cta', 'social_icons']);
const CONTENT_ALLOWED = new Set([
  'text', 'cta', 'code', 'feature', 'image',
  'pricing', 'social_icons', 'accordion', 'video_embed',
  'video', 'card', 'form', 'link_list',
]);
const FOOTER_ALLOWED = new Set(['logo', 'link_list', 'copyright', 'social_icons']);

function buildSectionStyle(props: SectionLayoutProps): CSSProperties {
  const style: CSSProperties = {};
  if (props.background) style.backgroundColor = props.background;
  if (props.backgroundImage) {
    style.backgroundImage = `url(${props.backgroundImage})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = props.bgPosition ?? 'center';
    if (props.backgroundFixed) style.backgroundAttachment = 'fixed';
  }
  if (props.textColor) style.color = props.textColor;

  const pd = props.paddingDesktop;
  if (pd) {
    style.paddingTop = pd.top ? `${pd.top}px` : undefined;
    style.paddingRight = pd.right ? `${pd.right}px` : undefined;
    style.paddingBottom = pd.bottom ? `${pd.bottom}px` : undefined;
    style.paddingLeft = pd.left ? `${pd.left}px` : undefined;
  }

  if (props.vertical) {
    style.display = 'flex';
    style.flexDirection = 'column';
    style.justifyContent =
      props.vertical === 'top' ? 'flex-start' :
      props.vertical === 'bottom' ? 'flex-end' : 'center';
  }
  if (props.fullHeight) style.minHeight = '100vh';

  return style;
}

function innerStyle(props: SectionLayoutProps): CSSProperties {
  const s: CSSProperties = {
    maxWidth: props.fullWidth ? '100%' : (props.maxWidth ? `${props.maxWidth}px` : '1170px'),
    margin: '0 auto',
    width: '100%',
  };
  if (props.horizontal) {
    s.textAlign = props.horizontal as CSSProperties['textAlign'];
  }
  return s;
}

export const HeaderSection: SectionComponent = (props) => {
  const base = buildSectionStyle(props);
  if (props.sticky) {
    base.position = 'sticky';
    base.top = 0;
    base.zIndex = 40;
  } else if (props.position === 'overlay') {
    base.position = 'absolute';
    base.top = 0;
    base.left = 0;
    base.right = 0;
    base.zIndex = 40;
  }
  const innerH: CSSProperties = {
    ...innerStyle(props),
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    justifyContent:
      props.horizontalAlignment === 'between' ? 'space-between' :
      props.horizontalAlignment === 'around' ? 'space-around' :
      props.horizontalAlignment === 'center' ? 'center' :
      props.horizontalAlignment === 'right' ? 'flex-end' :
      'space-between',
  };
  return (
    <header style={base}>
      <div style={innerH}>{props.children}</div>
    </header>
  );
};
HeaderSection.__kajabiSectionFlavor = 'header';
HeaderSection.__allowedBlockTypes = HEADER_ALLOWED;

export const ContentSection: SectionComponent = (props) => {
  return (
    <section style={buildSectionStyle(props)}>
      <div style={innerStyle(props)}>{wrapContentChildren(props.children)}</div>
    </section>
  );
};
ContentSection.__kajabiSectionFlavor = 'content';
ContentSection.__allowedBlockTypes = CONTENT_ALLOWED;

export const FooterSection: SectionComponent = (props) => {
  const inner: CSSProperties = {
    ...innerStyle(props),
    display: 'flex',
    flexDirection: props.verticalLayout ? 'column' : 'row',
    gap: props.verticalLayout ? 24 : 32,
    alignItems: props.verticalLayout ? 'center' : 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  };
  return (
    <footer style={buildSectionStyle(props)}>
      <div style={inner}>{props.children}</div>
    </footer>
  );
};
FooterSection.__kajabiSectionFlavor = 'footer';
FooterSection.__allowedBlockTypes = FOOTER_ALLOWED;
