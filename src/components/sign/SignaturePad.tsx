import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";

export function SignaturePad({ onChange }: { onChange: (value: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const ink = useRef(false);
  const [, setHasInk] = useState(false);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * devicePixelRatio);
    canvas.height = Math.round(rect.height * devicePixelRatio);
    canvas.getContext("2d")?.scale(devicePixelRatio, devicePixelRatio);
  }, []);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); const c = ref.current?.getContext("2d"); if (c) { c.beginPath(); c.moveTo(p.x, p.y); c.strokeStyle = "#173a2d"; c.lineWidth = 2.4; c.lineCap = "round"; } };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const p = point(e); const c = ref.current?.getContext("2d"); c?.lineTo(p.x, p.y); c?.stroke(); if (!ink.current) { ink.current = true; setHasInk(true); } };
  const end = () => { drawing.current = false; const canvas = ref.current; if (canvas && ink.current) onChange(canvas.toDataURL("image/png")); };
  const clear = () => { const canvas = ref.current; if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); ink.current = false; setHasInk(false); onChange(null); };
  return <div><div className="relative h-44 overflow-hidden rounded-xl border border-input bg-background"><canvas ref={ref} className="size-full touch-none" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} /><div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-border" /><PenLine className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /></div><button type="button" onClick={clear} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><Eraser className="size-4" /> Limpar assinatura</button></div>;
}