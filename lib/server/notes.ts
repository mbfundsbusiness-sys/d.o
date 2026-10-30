import type { SupabaseClient } from '@supabase/supabase-js';
import { docHtmlToSlides, type Slide } from '@/lib/freelance/slides';

// Trading notes: the user's own notes as slides. Nothing here writes notes the
// user didn't give: slides come from their .docx or from what they say in chat.

export const NOTES_BUCKET = 'trading-notes';
const STORAGE_REF = /storage:([A-Za-z0-9/_.-]+)/g;

export type TradingNote = {
  id: string;
  position: number;
  section: string | null;
  title: string;
  body: string;
  source_file: string | null;
};

export async function listNotes(db: SupabaseClient, userId: string): Promise<TradingNote[]> {
  const { data } = await db
    .from('trading_notes')
    .select('id, position, section, title, body, source_file')
    .eq('user_id', userId)
    .order('position')
    .limit(2000);
  return (data ?? []) as TradingNote[];
}

/** Swaps "storage:<path>" image refs for signed links (1 hour), so private chart images can show. */
export async function withImageLinks(db: SupabaseClient, notes: TradingNote[]): Promise<TradingNote[]> {
  const paths = Array.from(new Set(notes.flatMap((n) => Array.from(n.body.matchAll(STORAGE_REF), (m) => m[1]))));
  if (paths.length === 0) return notes;
  const links = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await db.storage.from(NOTES_BUCKET).createSignedUrls(paths.slice(i, i + 100), 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) links.set(d.path, d.signedUrl);
  }
  return notes.map((n) => ({ ...n, body: n.body.replace(STORAGE_REF, (all, p: string) => links.get(p) ?? all) }));
}

/** Slide index for the assistant's prompt: titles only, bodies are fetched with get_note. */
export function describeNotes(notes: TradingNote[]): string {
  if (notes.length === 0) return 'No trading notes yet.';
  let section: string | null | undefined;
  const lines: string[] = [];
  for (const n of notes) {
    if (n.section !== section) {
      section = n.section;
      lines.push(`${section ?? 'Intro'}:`);
    }
    lines.push(`  #${n.position} ${n.title} id=${n.id}`);
  }
  return lines.join('\n');
}

/** Inserts slides at the end, or in place of an earlier import of the same file. */
export async function saveSlides(db: SupabaseClient, userId: string, slides: Slide[], sourceFile: string): Promise<{ added: number; replaced: number }> {
  const { data: old } = await db.from('trading_notes').select('id, position').eq('user_id', userId).eq('source_file', sourceFile).order('position');
  const { data: last } = await db.from('trading_notes').select('position').eq('user_id', userId).order('position', { ascending: false }).limit(1).maybeSingle();
  const start = old?.length ? old[0].position : (last?.position ?? 0) + 1;
  if (old?.length) {
    // Make room if the new import is longer than the old one, then clear the old slides.
    const extra = slides.length - old.length;
    if (extra > 0) {
      const after = await db.from('trading_notes').select('id, position').eq('user_id', userId).gt('position', old[old.length - 1].position).order('position', { ascending: false });
      for (const n of after.data ?? []) await db.from('trading_notes').update({ position: n.position + extra }).eq('id', n.id);
    }
    await db.from('trading_notes').delete().eq('user_id', userId).eq('source_file', sourceFile);
  }
  const rows = slides.map((s, i) => ({ user_id: userId, position: start + i, section: s.section, title: s.title, body: s.body, source_file: sourceFile }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from('trading_notes').insert(rows.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
  return { added: rows.length, replaced: old?.length ?? 0 };
}

/** Reads an uploaded .docx: images go to the bucket, text becomes slides. */
export async function importDocx(db: SupabaseClient, userId: string, path: string): Promise<{ added: number; replaced: number; images: number }> {
  if (!path.startsWith(`${userId}/`)) throw new Error('not your file');
  const { data: file, error } = await db.storage.from(NOTES_BUCKET).download(path);
  if (error || !file) throw new Error(error?.message ?? 'file not found');
  const buffer = Buffer.from(await file.arrayBuffer());
  const mammoth = await import('mammoth');
  const name = path.split('/').pop()!.replace(/^\d+-/, '');
  const stem = name.replace(/\.docx$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-');
  let images = 0;
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const ext = (image.contentType.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '');
        const imgPath = `${userId}/images/${stem}/${String(++images).padStart(4, '0')}.${ext}`;
        const bytes = await image.readAsBuffer();
        const up = await db.storage.from(NOTES_BUCKET).upload(imgPath, bytes, { contentType: image.contentType, upsert: true });
        return { src: up.error ? '' : `storage:${imgPath}` };
      }),
    }
  );
  const slides = docHtmlToSlides(html.replace(/<img[^>]*src=""[^>]*>/g, ''));
  if (slides.length === 0) throw new Error('no text found in that document');
  const saved = await saveSlides(db, userId, slides, name);
  await db.storage.from(NOTES_BUCKET).remove([path]);
  return { ...saved, images };
}
