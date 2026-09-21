/**
 * The integral sign, as outline data.
 *
 * KaTeX's own glyph — U+222B from KaTeX_Size2-Regular, the face `\displaystyle\int` renders
 * with — lifted to a path so the story card can draw it at an exact height.
 *
 * Why a path rather than KaTeX itself: a large operator overflows its own line box, so measuring
 * the rendered element measures the box and not the ink, and the glyph lands about 45% taller
 * than it was asked for. A path also removes a font race — KaTeX loads its faces on first use,
 * which is not something to depend on inside a frame-by-frame capture.
 *
 * Regenerate with fontTools, from core/ (one line):
 *   python -c "from fontTools.ttLib import TTFont; from fontTools.pens.svgPathPen import SVGPathPen; from fontTools.pens.transformPen import TransformPen; from fontTools.misc.transform import Transform; f=TTFont('node_modules/katex/dist/fonts/KaTeX_Size2-Regular.ttf'); gs=f.getGlyphSet(); p=SVGPathPen(gs); gs['integral'].draw(TransformPen(p, Transform(1,0,0,-1,-55,1360))); print(p.getCommands())"
 *
 * The transform flips the font's y-up outline into SVG's y-down and moves the glyph's bounding
 * box to the origin. The viewBox below IS that bounding box, so the ink touches all four edges:
 * scale it to a height and the ink is that height, with no padding to compensate for.
 */
export const INTEGRAL_GLYPH = {
  viewBoxWidth: 889,
  viewBoxHeight: 2222,
  /** ink width / ink height, so the box can be sized from a height alone. */
  aspect: 0.4001,
  path: 'M112 2101Q112 2144 59 2158Q61 2161 65 2164Q84 2184 110 2184Q123 2185 137 2172Q188 2121 241 1871Q269 1741 312 1493Q402 963 536 426Q558 342 569.5 301.0Q581 260 604.0 193.5Q627 127 652.5 86.5Q678 46 709 24Q742 0 773 0Q824 0 855.0 33.0Q886 66 889 115Q889 143 874.0 160.0Q859 177 832 177Q809 177 793.0 161.0Q777 145 777 121Q777 78 830 64L827 60Q824 57 819.0 53.0Q814 49 811 47Q796 37 778 37Q773 37 771 38Q739 47 706 138Q673 228 633 431Q603 577 578 732Q482 1281 354 1795Q322 1922 300 1989Q263 2101 219 2159Q174 2222 110 2222Q65 2222 33.5 2188.0Q2 2154 0 2106Q0 2078 15.0 2061.5Q30 2045 57 2045Q80 2045 96.0 2061.0Q112 2077 112 2101Z',
};
