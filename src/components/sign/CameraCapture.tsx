import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, ImageUp, Loader2 } from "lucide-react";

const MAX_SIDE = 900;
const QUALITY = 0.82;

function drawCompressed(source: CanvasImageSource, w: number, h: number, mirror: boolean) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

async function fileToJpeg(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem");
  if (file.size > 12 * 1024 * 1024) throw new Error("Imagem muito grande");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Imagem inválida"));
      i.src = url;
    });
    return drawCompressed(img, img.naturalWidth, img.naturalHeight, false);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CameraCapture({
  photo,
  onPhoto,
}: {
  photo: string | null;
  onPhoto: (dataUrl: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const attachStream = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => {
      // Alguns navegadores só liberam o play após o evento loadedmetadata.
    });
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const start = useCallback(
    async (mode: "user" | "environment" = facing) => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Câmera não disponível neste dispositivo. Envie uma foto da galeria.");
        return;
      }
      setStarting(true);
      try {
        stop();
        const attempts: MediaStreamConstraints[] = [
          {
            video: { facingMode: { exact: mode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
            audio: false,
          },
          {
            video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
            audio: false,
          },
          { video: true, audio: false },
        ];

        let stream: MediaStream | null = null;
        let lastError: unknown = null;
        for (const constraints of attempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch (err) {
            lastError = err;
          }
        }
        if (!stream) throw lastError;

        streamRef.current = stream;
        setFacing(mode);
        setStreaming(true);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("A permissão da câmera está bloqueada. Libere o acesso nas configurações do navegador e tente novamente.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setError("Nenhuma câmera foi encontrada neste aparelho. Você pode enviar uma foto da galeria.");
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          setError("A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.");
        } else {
          setError("Não foi possível iniciar a câmera. Tente abrir este link no Chrome ou Safari, ou envie uma foto.");
        }
      } finally {
        setStarting(false);
      }
    },
    [facing, stop],
  );

  useEffect(() => () => stop(), [stop]);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const dataUrl = drawCompressed(v, v.videoWidth, v.videoHeight, facing === "user");
    stop();
    onPhoto(dataUrl);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      onPhoto(await fileToJpeg(f));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const frame = "relative aspect-square w-full overflow-hidden rounded-2xl bg-muted ring-1 ring-border";

  if (photo) {
    return (
      <div>
        <div className={frame}>
          <img src={photo} alt="Sua foto" className="size-full object-cover" />
          <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-ok text-primary-foreground">
            <Check className="size-4" />
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onPhoto(null);
            start();
          }}
          className="tap-lg mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card font-semibold transition-transform active:scale-[0.98]"
        >
          <RefreshCw className="size-5" /> Tirar novamente
        </button>
      </div>
    );
  }

  if (streaming) {
    return (
      <div>
        <div className={frame}>
          <video
            ref={attachStream}
            playsInline
            muted
            autoPlay
            onLoadedMetadata={(event) => event.currentTarget.play().catch(() => {})}
            className="size-full object-cover"
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
          />
          <button
            type="button"
            onClick={() => start(facing === "user" ? "environment" : "user")}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-card/90 text-foreground"
            aria-label="Alternar câmera"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={capture}
          className="tap-lg mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          <Camera className="size-5" /> Capturar
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => start()}
        disabled={starting}
        className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/60 text-primary transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        {starting ? <Loader2 className="size-12 animate-spin" /> : <Camera className="size-14" />}
        <span className="font-display text-xl font-semibold">TIRAR FOTO</span>
        <span className="text-xs text-muted-foreground">Usaremos a câmera frontal</span>
      </button>
      {error && <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger-ink">{error}</p>}
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ImageUp className="size-4" /> Ou enviar uma foto
        <input type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} />
      </label>
    </div>
  );
}
