'use client'

import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react'
import { Rnd } from 'react-rnd'

// ── Public API ────────────────────────────────────────────────────────────────
export interface KebabFlyerRef {
  setBusinessName:   (v: string) => void
  setSubtitle:       (v: string) => void
  setOfferText:      (v: string) => void
  setSlogan:         (v: string) => void
  setMainOffer:      (v: string) => void
  getElements:       () => ElementState[]
  setSelectedId:     (id: string | null) => void
  updateElement:     (id: string, patch: Partial<ElementState>) => void
  deleteElement:     (id: string) => void
}

export interface KebabFlyerTemplateProps {
  imageUrl?:          string
  accentColor?:       string
  scale?:             number
  onElementSelect?:   (el: ElementState | null) => void
  onElementChange?:   (elements: ElementState[]) => void
  onTextChange?:      (field: string, value: string) => void
}

// ── Element state ─────────────────────────────────────────────────────────────
export interface ElementState {
  id:          string
  field:       string
  text:        string
  x:           number
  y:           number
  w:           number
  h:           number
  fontSize:    number
  fontFamily:  string
  color:       string
  fontWeight:  string
  fontStyle:   string
  textAlign:   'left' | 'center' | 'right'
  letterSpacing: number
  lineHeight:  number
  textShadow?: string
  textTransform?: string
}

const FONTS = ['Inter', 'Georgia', 'Playfair Display', 'Montserrat', 'Oswald', 'Dancing Script', 'Arial Black']

// ── Static decorative components ──────────────────────────────────────────────
function Corner({ color, position }: { color: string; position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const pos: React.CSSProperties =
    position === 'tl' ? { top: 0, left: 0 } :
    position === 'tr' ? { top: 0, right: 0 } :
    position === 'bl' ? { bottom: 0, left: 0 } :
                        { bottom: 0, right: 0 }
  const flipX = position === 'tr' || position === 'br'
  const flipY = position === 'bl' || position === 'br'
  return (
    <div style={{ position: 'absolute', ...pos, width: 110, height: 110, pointerEvents: 'none', zIndex: 1 }}>
      <svg width="110" height="110" viewBox="0 0 110 110" fill="none"
        style={{ transform: `scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})` }}>
        <line x1="4"  y1="4"  x2="106" y2="4"   stroke={color} strokeWidth="1.5"/>
        <line x1="4"  y1="4"  x2="4"   y2="106" stroke={color} strokeWidth="1.5"/>
        <line x1="14" y1="14" x2="90"  y2="14"  stroke={color} strokeWidth="1"/>
        <line x1="14" y1="14" x2="14"  y2="90"  stroke={color} strokeWidth="1"/>
        <line x1="22" y1="22" x2="60"  y2="22"  stroke={color} strokeWidth="0.6"/>
        <line x1="22" y1="22" x2="22"  y2="60"  stroke={color} strokeWidth="0.6"/>
        <line x1="4"  y1="60" x2="14"  y2="60"  stroke={color} strokeWidth="1"/>
        <line x1="60" y1="4"  x2="60"  y2="14"  stroke={color} strokeWidth="1"/>
      </svg>
    </div>
  )
}

function PremiumBadge({ color, x, y, scale }: { color: string; x: number; y: number; scale?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 124, height: 124, pointerEvents: 'none', zIndex: 2 }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: `2px solid ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 8, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: `1px solid ${color}50` }} />
        <div style={{ fontSize: 12, color, fontWeight: 700 }}>♛</div>
        <div style={{ fontSize: 9, letterSpacing: 1, color, textTransform: 'uppercase', fontWeight: 600 }}>CALIDAD</div>
        <div style={{ fontSize: 19, fontWeight: 900, color, lineHeight: 1 }}>PREMIUM</div>
        <div style={{ fontSize: 8, letterSpacing: 1.5, color, textTransform: 'uppercase' }}>SABOR</div>
        <div style={{ fontSize: 8, color: `${color}80`, textTransform: 'uppercase' }}>INIGUALABLE</div>
        <div style={{ fontSize: 7, color, marginTop: 3, letterSpacing: 4 }}>★ ★ ★</div>
      </div>
    </div>
  )
}

function BottomBadges({ color }: { color: string }) {
  const badges = [
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>, label: 'INGREDIENTES\nFRESCOS' },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2c0 4-4 6-4 10a4 4 0 008 0c0-4-4-6-4-10z"/><path d="M12 12c0 2-2 3-2 5a2 2 0 004 0c0-2-2-3-2-5z"/></svg>, label: 'CARNE DE\nCALIDAD' },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 8C8 10 5.9 16.17 3.82 19.82A2 2 0 006.27 22c5-1 13-7 11-14z"/><path d="M3.82 19.82L8 14"/></svg>, label: 'SABOR\nAUTENTICO' },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>, label: 'HECHO CON\nPASION' },
  ]
  return (
    <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', padding: '0 60px', pointerEvents: 'none', zIndex: 2 }}>
      {badges.map((b, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{b.icon}</div>
          <div style={{ fontSize: 13, color: '#FFFFFF', textAlign: 'center', fontWeight: 600, lineHeight: 1.25, whiteSpace: 'pre-line', letterSpacing: 0.3 }}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Default elements ──────────────────────────────────────────────────────────
function defaultElements(gold: string): ElementState[] {
  return [
    { id: 'businessName', field: 'businessName', text: 'GOLDEN', x: 60, y: 85, w: 960, h: 110, fontSize: 96, fontFamily: 'Georgia', color: gold, fontWeight: '900', fontStyle: 'normal', textAlign: 'center', letterSpacing: 12, lineHeight: 1, textShadow: `0 0 40px ${gold}50`, textTransform: 'uppercase' },
    { id: 'subtitle',     field: 'businessSubtitle', text: 'K E B A B', x: 160, y: 215, w: 760, h: 55, fontSize: 36, fontFamily: 'Georgia', color: gold, fontWeight: '400', fontStyle: 'normal', textAlign: 'center', letterSpacing: 18, lineHeight: 1, textTransform: 'uppercase' },
    { id: 'mainOffer',    field: 'mainOffer',    text: '2x1', x: 80, y: 295, w: 780, h: 235, fontSize: 230, fontFamily: 'Arial Black', color: gold, fontWeight: '900', fontStyle: 'normal', textAlign: 'center', letterSpacing: -8, lineHeight: 0.85, textShadow: `4px 4px 0px rgba(0,0,0,0.5), 0 0 60px ${gold}40` },
    { id: 'offerBanner',  field: 'offerText',    text: 'OFERTA ESPECIAL', x: 155, y: 530, w: 690, h: 56, fontSize: 26, fontFamily: 'Inter', color: gold, fontWeight: '700', fontStyle: 'normal', textAlign: 'center', letterSpacing: 6, lineHeight: 1, textTransform: 'uppercase' },
    { id: 'disfruta',     field: 'disfruta',     text: 'DISFRUTA', x: 100, y: 610, w: 880, h: 60, fontSize: 38, fontFamily: 'Inter', color: '#FFFFFF', fontWeight: '700', fontStyle: 'normal', textAlign: 'center', letterSpacing: 16, lineHeight: 1, textTransform: 'uppercase' },
    { id: 'slogan',       field: 'sloganText',   text: 'el mejor kebab', x: 80, y: 960, w: 920, h: 100, fontSize: 68, fontFamily: 'Georgia', color: gold, fontWeight: '400', fontStyle: 'italic', textAlign: 'center', letterSpacing: 0, lineHeight: 1.1, textShadow: `0 0 30px ${gold}40` },
  ]
}

// ── Component ─────────────────────────────────────────────────────────────────
const KebabFlyerTemplate = forwardRef<KebabFlyerRef, KebabFlyerTemplateProps>(
  ({ imageUrl, accentColor = '#D4AF37', scale = 1, onElementSelect, onElementChange, onTextChange }, ref) => {
    const gold = accentColor
    const [elements, setElements] = useState<ElementState[]>(() => defaultElements(gold))
    const [selectedId, setSelectedIdState] = useState<string | null>(null)
    const prevGold = useRef(gold)

    // Update gold color in all elements that use it
    if (prevGold.current !== gold) {
      prevGold.current = gold
      setElements(prev => prev.map(el => ({
        ...el,
        color: el.color === prevGold.current || el.id !== 'disfruta' ? gold : el.color,
        textShadow: el.textShadow?.replace(/#[0-9a-fA-F]{6}(?:50|40)/g, '') // re-derive below
      })))
    }

    const updateEl = useCallback((id: string, patch: Partial<ElementState>) => {
      setElements(prev => {
        const next = prev.map(el => el.id === id ? { ...el, ...patch } : el)
        onElementChange?.(next)
        return next
      })
    }, [onElementChange])

    useImperativeHandle(ref, () => ({
      setBusinessName(v)  { updateEl('businessName', { text: v }); onTextChange?.('businessName', v) },
      setSubtitle(v)      { updateEl('subtitle',     { text: v }); onTextChange?.('businessSubtitle', v) },
      setOfferText(v)     { updateEl('offerBanner',  { text: v }); onTextChange?.('offerText', v) },
      setSlogan(v)        { updateEl('slogan',        { text: v }); onTextChange?.('sloganText', v) },
      setMainOffer(v)     { updateEl('mainOffer',     { text: v }); onTextChange?.('mainOffer', v) },
      getElements()       { return elements },
      setSelectedId(id)   { setSelectedIdState(id) },
      updateElement(id, patch) { updateEl(id, patch) },
      deleteElement(id)   {
        setElements(prev => prev.filter(el => el.id !== id))
        setSelectedIdState(null)
        onElementSelect?.(null)
      },
    }))

    function selectEl(id: string) {
      setSelectedIdState(id)
      onElementSelect?.(elements.find(e => e.id === id) ?? null)
    }

    function deselect() {
      setSelectedIdState(null)
      onElementSelect?.(null)
    }

    return (
      <div
        onClick={deselect}
        style={{ width: 1080, height: 1350, background: 'radial-gradient(ellipse at 50% 20%, #1c1507 0%, #0A0A0A 55%)', position: 'relative', overflow: 'hidden', userSelect: 'none' }}
      >
        {/* Texture overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(212,175,55,0.025) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none', zIndex: 0 }} />

        {/* Decorative: corners */}
        <Corner color={gold} position="tl" />
        <Corner color={gold} position="tr" />
        <Corner color={gold} position="bl" />
        <Corner color={gold} position="br" />

        {/* Crown (static, centered) */}
        <div style={{ position: 'absolute', top: 42, left: 0, right: 0, textAlign: 'center', fontSize: 38, color: gold, pointerEvents: 'none', zIndex: 2 }}>♛</div>

        {/* Decorative separator below subtitle */}
        <div style={{ position: 'absolute', top: 276, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, pointerEvents: 'none', zIndex: 2 }}>
          <div style={{ width: 160, height: 1, background: `linear-gradient(to right, transparent, ${gold})` }} />
          <div style={{ width: 8, height: 8, background: gold, transform: 'rotate(45deg)' }} />
          <div style={{ width: 160, height: 1, background: `linear-gradient(to left, transparent, ${gold})` }} />
        </div>

        {/* Offer banner border */}
        <div style={{ position: 'absolute', top: 528, left: 150, width: 700, height: 58, border: `1.5px solid ${gold}`, pointerEvents: 'none', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <div style={{ width: 30, height: 1, background: gold }} />
          <div style={{ width: 30, height: 1, background: gold }} />
        </div>

        {/* Dot separator below offer */}
        <div style={{ position: 'absolute', top: 598, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none', zIndex: 2 }}>
          <div style={{ width: 60, height: 1, background: `${gold}60` }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', border: `1px solid ${gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 4, height: 4, background: gold, borderRadius: '50%' }} />
          </div>
          <div style={{ width: 60, height: 1, background: `${gold}60` }} />
        </div>

        {/* Premium badge */}
        <PremiumBadge color={gold} x={900} y={298} />

        {/* Food image */}
        <div style={{ position: 'absolute', top: 668, left: 0, right: 0, height: 460, overflow: 'hidden', zIndex: 1 }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="plato" crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'radial-gradient(ellipse at center, #1a1208 0%, #0A0A0A 100%)' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', border: `2px dashed ${gold}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={`${gold}50`} strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <span style={{ fontSize: 13, color: `${gold}45`, letterSpacing: 2, textTransform: 'uppercase' }}>Foto del plato</span>
            </div>
          )}
          {/* Gradient overlays */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to bottom, #0A0A0A, transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to bottom, transparent, #0A0A0A)', pointerEvents: 'none' }} />
        </div>

        {/* Bottom divider */}
        <div style={{ position: 'absolute', bottom: 160, left: 40, right: 40, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none', zIndex: 3 }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${gold}80)` }} />
          <div style={{ width: 6, height: 6, background: gold, transform: 'rotate(45deg)' }} />
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${gold}80)` }} />
        </div>

        {/* Bottom badges */}
        <BottomBadges color={gold} />

        {/* Bottom gold lines */}
        <div style={{ position: 'absolute', bottom: 20, left: 40, right: 40, height: 1, background: `linear-gradient(to right, transparent, ${gold}55, transparent)`, pointerEvents: 'none', zIndex: 3 }} />
        <div style={{ position: 'absolute', bottom: 24, left: 40, right: 40, height: 1, background: `linear-gradient(to right, transparent, ${gold}28, transparent)`, pointerEvents: 'none', zIndex: 3 }} />

        {/* ── Draggable / resizable text elements ─────────────────── */}
        {elements.map(el => (
          <Rnd
            key={el.id}
            scale={scale}
            position={{ x: el.x, y: el.y }}
            size={{ width: el.w, height: el.h }}
            onDragStop={(_, d) => { updateEl(el.id, { x: d.x, y: d.y }); selectEl(el.id) }}
            onResizeStop={(_, __, ref, ___, pos) => updateEl(el.id, { w: parseInt(ref.style.width), h: parseInt(ref.style.height), x: pos.x, y: pos.y })}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); selectEl(el.id) }}
            style={{ zIndex: 10, cursor: 'move' }}
            resizeHandleStyles={selectedId === el.id ? resizeHandles : {}}
            enableResizing={selectedId === el.id}
            bounds="parent"
          >
            <div
              style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent:
                  el.textAlign === 'center' ? 'center' :
                  el.textAlign === 'right'  ? 'flex-end' : 'flex-start',
                outline: selectedId === el.id ? `2px dashed ${gold}80` : 'none',
                outlineOffset: 4,
                borderRadius: 4,
                boxSizing: 'border-box',
              }}
            >
              <div
                contentEditable
                suppressContentEditableWarning
                onInput={e => {
                  const v = (e.currentTarget as HTMLDivElement).innerText
                  updateEl(el.id, { text: v })
                  onTextChange?.(el.field, v)
                }}
                style={{
                  fontSize:      el.fontSize,
                  fontFamily:    el.fontFamily,
                  color:         el.color,
                  fontWeight:    el.fontWeight,
                  fontStyle:     el.fontStyle,
                  textAlign:     el.textAlign,
                  letterSpacing: el.letterSpacing,
                  lineHeight:    el.lineHeight,
                  textShadow:    el.textShadow,
                  textTransform: el.textTransform as React.CSSProperties['textTransform'],
                  cursor:        'text',
                  outline:       'none',
                  width:         '100%',
                  whiteSpace:    'pre-wrap',
                  wordBreak:     'break-word',
                }}
                dangerouslySetInnerHTML={{ __html: el.text }}
              />
            </div>
          </Rnd>
        ))}
      </div>
    )
  }
)

KebabFlyerTemplate.displayName = 'KebabFlyerTemplate'
export default KebabFlyerTemplate

// ── Resize handle styles (shown only when selected) ───────────────────────────
const handleStyle: React.CSSProperties = {
  width: 10, height: 10, borderRadius: 2,
  background: '#fff', border: '1.5px solid #1A56DB',
}
const resizeHandles = {
  topLeft:     { ...handleStyle, cursor: 'nw-resize' },
  topRight:    { ...handleStyle, cursor: 'ne-resize' },
  bottomLeft:  { ...handleStyle, cursor: 'sw-resize' },
  bottomRight: { ...handleStyle, cursor: 'se-resize' },
  top:         { height: 6, background: 'transparent', border: 'none', cursor: 'n-resize' },
  bottom:      { height: 6, background: 'transparent', border: 'none', cursor: 's-resize' },
  left:        { width:  6, background: 'transparent', border: 'none', cursor: 'w-resize' },
  right:       { width:  6, background: 'transparent', border: 'none', cursor: 'e-resize' },
}
