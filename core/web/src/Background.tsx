/**
 * Background layer.
 *
 * The source art is square (2048x2048) and the frame is 9:16, so it has to be cropped. The crop
 * is `object-fit: cover` on a 1080x1920 element: the image is scaled until it covers the frame
 * and the overflow is trimmed symmetrically. For a repeating pattern that is the right call —
 * the alternative, letterboxing, would put bars in a format that has no room for them.
 *
 * The scrim is not decoration. These backgrounds are busy white line-art, and the lesson palette
 * is light text on dark. Without a scrim the text is unreadable over the pattern; with it the
 * texture still reads and the type sits cleanly on top. Adjust --scrim, not the text colour.
 */
export const DEFAULT_BACKGROUND = 'bg2.jpeg';

export function Background({ src = DEFAULT_BACKGROUND }: { src?: string | null }) {
  if (!src) return null;
  return (
    <div className="bg-layer" aria-hidden="true">
      <img className="bg-image" src={`./bg/${src}`} alt="" />
      <div className="bg-scrim" />
    </div>
  );
}
