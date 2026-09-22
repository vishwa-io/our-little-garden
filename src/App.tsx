import { type FormEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const GARDEN_IMAGE = '/assets/garden-artwork.png';
const MAX_VISIBLE_FLOWERS = 20;

// The usable planting area is the circular top of the garden.
// Flowers get an inner safety margin so their full buttons stay on the grass.
const MAX_VISIBLE_FLOWERS = 20;
const GARDEN_IMAGE = '/assets/garden-artwork.png';
const FLOWER_MIN_DISTANCE = 7;
const FLOWER_EDGE_MARGIN = 4;


const COLORS = [
  { name: 'coral', value: '#ec6d58' },
  { name: 'sunshine', value: '#f5a354' },
  { name: 'lemon', value: '#f2d56d' },
  { name: 'pink', value: '#e38ca8' },
  { name: 'leaf', value: '#5c9c5e' },
];

type Flower = {
  id: string;
  message: string;
  color: string;
  drawing: string;
  drawingCropped?: boolean;
};

function getFlowerHash(id: string) {
  let hash = 2166136261;

  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededValue(seed: number) {
  let value = seed || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
}

type GardenMask = {
  size: number;
  pixels: Uint8Array;
};

function buildGardenMask(image: HTMLImageElement): GardenMask {
  const size = 240;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { size, pixels: new Uint8Array(size * size) };

  context.drawImage(image, 0, 0, size, size);
  const imageData = context.getImageData(0, 0, size, size);
  const pixels = new Uint8Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const r = imageData.data[offset];
      const g = imageData.data[offset + 1];
      const b = imageData.data[offset + 2];
      const a = imageData.data[offset + 3];

      const brightness = (r + g + b) / 3;
      const isGreenSurface =
        a > 20 &&
        g > r * 1.06 &&
        g > b * 1.15 &&
        brightness > 92;

      pixels[y * size + x] = isGreenSurface ? 1 : 0;
    }
  }

  return { size, pixels };
}

function maskAllowsPoint(mask: GardenMask, x: number, y: number) {
  const px = Math.round((x / 100) * (mask.size - 1));
  const py = Math.round((y / 100) * (mask.size - 1));

  if (px < 0 || py < 0 || px >= mask.size || py >= mask.size) return false;

  // Check a small neighborhood so tiny artwork details do not make
  // otherwise usable grass impossible to plant on.
  let valid = 0;
  let checked = 0;

  for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
    for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      const sampleX = px + offsetX;
      const sampleY = py + offsetY;
      if (
        sampleX >= 0 &&
        sampleY >= 0 &&
        sampleX < mask.size &&
        sampleY < mask.size
      ) {
        checked += 1;
        valid += mask.pixels[sampleY * mask.size + sampleX];
      }
    }
  }

  return valid / checked >= 0.45;
}

function flowerFitsOnGarden(mask: GardenMask, x: number, y: number) {
  // Check the center plus points around the flower's footprint.
  // This keeps the actual flower inside the circular grass surface.
  const radius = FLOWER_EDGE_MARGIN;
  const samples = 16;

  if (!maskAllowsPoint(mask, x, y)) return false;

  for (let index = 0; index < samples; index += 1) {
    const angle = (index / samples) * Math.PI * 2;
    if (
      !maskAllowsPoint(
        mask,
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
      )
    ) {
      return false;
    }
  }

  return true;
}

function getRefreshSeed() {
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(values);
  return values[0] || Math.floor(Math.random() * 4294967295) || 1;
}

function getRandomGardenPoint(seed: number) {
  const angle = seededValue(seed) * Math.PI * 2;

  // A gentle center bias prevents uniform-disk sampling from visually
  // concentrating too many flowers around the outside edge.
  const rawRadius = seededValue(seed ^ 0x68bc21eb);
  const radius = Math.pow(rawRadius, 0.68) * 46;

  return {
    x: 50 + Math.cos(angle) * radius,
    y: 48 + Math.sin(angle) * radius,
  };
}

function getFlowerPositions(
  flowers: Flower[],
  refreshSeed: number,
  gardenMask: GardenMask | null,
) {
  if (!gardenMask) return new Map<string, { x: number; y: number }>();

  const visibleFlowers = flowers
    .slice()
    .sort(
      (first, second) =>
        getFlowerHash(`${refreshSeed}:flower:${first.id}`) -
        getFlowerHash(`${refreshSeed}:flower:${second.id}`),
    )
    .slice(0, MAX_VISIBLE_FLOWERS);

  const positions = new Map<string, { x: number; y: number }>();
  const placed: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < visibleFlowers.length; index += 1) {
    let chosen: { x: number; y: number } | null = null;

    for (let attempt = 0; attempt < 20000; attempt += 1) {
      const candidate = getRandomGardenPoint(
        refreshSeed +
          index * 0x9e3779b9 +
          attempt * 0x85ebca6b,
      );

      if (!flowerFitsOnGarden(gardenMask, candidate.x, candidate.y)) continue;

      const separated = placed.every(
        (position) =>
          Math.hypot(position.x - candidate.x, position.y - candidate.y) >=
          FLOWER_MIN_DISTANCE,
      );

      if (!separated) continue;

      chosen = candidate;
      break;
    }

    if (chosen) {
      placed.push(chosen);
      positions.set(visibleFlowers[index].id, chosen);
    }
  }

  return positions;
}

function toFlower(row: { id: string; message: string; color: string; drawing: string }): Flower {
  return {
    id: row.id,
    message: row.message,
    color: row.color,
    drawing: row.drawing,
    drawingCropped: true,
  };
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cropCanvasToContent(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return canvas.toDataURL('image/png');

  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) return canvas.toDataURL('image/png');

  const padding = 18;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + padding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + padding * 2);
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  croppedCanvas.getContext('2d')?.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );
  return croppedCanvas.toDataURL('image/png');
}

function cropDataUrlToContent(dataUrl: string) {
  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      resolve(cropCanvasToContent(canvas));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [isPlanting, setIsPlanting] = useState(false);
  const [message, setMessage] = useState('');
  const [drawingPreview, setDrawingPreview] = useState('');
  const [selectedFlower, setSelectedFlower] = useState<Flower | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [refreshSeed] = useState(getRefreshSeed);
  const [gardenMask, setGardenMask] = useState<GardenMask | null>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setGardenMask(buildGardenMask(image));
    image.src = GARDEN_IMAGE;
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadFlowersFromSupabase() {
      const { data, error } = await supabase
        .from('flowers')
        .select('id, drawing, message, color');

      if (error) {
        console.error('Could not load flowers:', error);
        return;
      }

      if (isCurrent) {
        setFlowers((data ?? []).map(toFlower));
      }
    }

    loadFlowersFromSupabase();

    const channel = supabase
      .channel('flowers-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'flowers' },
        (payload) => {
          const row = payload.new as {
            id: string;
            drawing: string;
            message: string;
            color: string;
          };

          setFlowers((current) =>
            current.some((flower) => flower.id === row.id)
              ? current
              : [...current, toFlower(row)],
          );
        },
      )
      .subscribe();

    return () => {
      isCurrent = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const oldDrawings = flowers.filter((flower) => !flower.drawingCropped);
    if (oldDrawings.length === 0) return undefined;

    Promise.all(
      flowers.map(async (flower) => ({
        ...flower,
        drawing: flower.drawingCropped
          ? flower.drawing
          : await cropDataUrlToContent(flower.drawing),
        drawingCropped: true,
      })),
    ).then((updatedFlowers) => {
      if (isCurrent) setFlowers(updatedFlowers);
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsPlanting(false);
      setSelectedFlower(null);
      setShowGallery(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function canvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function beginDrawing(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const point = canvasPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.strokeStyle = selectedColor;
    context.lineWidth = 14;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    canvas.setPointerCapture(event.pointerId);
    setIsDrawing(true);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    event.preventDefault();
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const point = canvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasDrawing(true);
  }

  function endDrawing(event?: PointerEvent<HTMLCanvasElement>) {
    if (event && canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    setDrawingPreview('');
  }

  function openPlanting() {
    const canvas = canvasRef.current;
    if (!hasDrawing || !canvas) return;
    setDrawingPreview(cropCanvasToContent(canvas));
    setIsPlanting(true);
  }

  async function plantFlower(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || !hasDrawing || !drawingPreview) return;

    const { data, error } = await supabase
      .from('flowers')
      .insert({
        drawing: drawingPreview,
        message: message.trim(),
        color: selectedColor,
      })
      .select('id, drawing, message, color')
      .single();

    if (error || !data) {
      console.error('Could not plant flower:', error);
      return;
    }

    setFlowers((current) =>
      current.some((flower) => flower.id === data.id)
        ? current
        : [...current, toFlower(data)],
    );
    setMessage('');
    setIsPlanting(false);
    clearCanvas();
  }

  return (
    <main className="garden-page">
      <header className="garden-header">
        <div className="brand">
          <h1 data-testid="text-brand">LITTLE GARDEN</h1>
          <p data-testid="text-tagline">leave something lovely behind.</p>
        </div>
        <div className="plant-count" aria-live="polite" data-testid="text-plant-count">
          <span><strong>{flowers.length}</strong> {flowers.length === 1 ? 'plant' : 'plants'} added</span>
        </div>
      </header>

      <section className="garden-layout" aria-label="Our Little Garden">
        <div className="garden-side">
          <div className="garden-stage">
            <img
              className="garden-art"
              src={GARDEN_IMAGE}
              alt="A round, lush illustrated garden"
              data-testid="img-garden"
            />
            <div className="planted-flowers" aria-label="Planted flowers">
              {Array.from(getFlowerPositions(flowers, refreshSeed, gardenMask).entries()).map(([flowerId, position]) => {
                const flower = flowers.find((item) => item.id === flowerId);
                if (!flower) return null;

                return (
                  <button
                    className="planted-flower"
                    key={flower.id}
                    style={{ left: `${position.x}%`, top: `${position.y}%` }}
                    onClick={() => setSelectedFlower(flower)}
                    aria-label={`Read flower message: ${flower.message}`}
                    data-testid={`button-planted-flower-${flower.id}`}
                  >
                    <img src={flower.drawing} alt="" data-testid={`img-planted-flower-${flower.id}`} />
                  </button>
                );
              })}
            </div>
          </div>
          <p className="garden-note" data-testid="text-garden-note">click a flower to read its little note</p>
        </div>

        <aside className="plant-panel">
          <div className="panel-heading">
            <span>ADD SOMETHING TO THE<br />GARDEN?</span>
            <span className="panel-scribble" aria-hidden="true">~</span>
          </div>
          <div className={`drawing-wrap ${hasDrawing ? 'has-drawing' : ''}`}>
            <canvas
              ref={canvasRef}
              width="560"
              height="400"
              onPointerDown={beginDrawing}
              onPointerMove={draw}
              onPointerUp={endDrawing}
              onPointerCancel={endDrawing}
              aria-label="Draw a little flower"
              data-testid="canvas-flower"
            />
            {!hasDrawing && <span className="canvas-hint">draw a tiny flower here</span>}
          </div>
          <div className="control-row">
            <div className="color-picker" aria-label="Flower color">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  className={`color-dot ${selectedColor === color.value ? 'is-selected' : ''}`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setSelectedColor(color.value)}
                  aria-label={`Choose ${color.name}`}
                  aria-pressed={selectedColor === color.value}
                  data-testid={`button-color-${color.name}`}
                />
              ))}
            </div>
            {hasDrawing && (
              <button className="clear-button" onClick={clearCanvas} data-testid="button-clear-drawing">
                clear
              </button>
            )}
          </div>
          <button className="plant-button" onClick={openPlanting} disabled={!hasDrawing} data-testid="button-plant-it">
            PLANT IT <span aria-hidden="true">→</span>
          </button>
        </aside>
      </section>

      <button className="gallery-button" onClick={() => setShowGallery(true)} data-testid="button-see-gallery">
        SEE FLOWER GALLERY
      </button>

      {isPlanting && (
        <div className="modal-backdrop" onClick={() => setIsPlanting(false)}>
          <section className="message-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="message-title">
            <button className="close-button" onClick={() => setIsPlanting(false)} aria-label="Close" data-testid="button-close-plant-modal">×</button>
            <div className="modal-flower">
              <img src={drawingPreview} alt="Your drawn flower" data-testid="img-drawing-preview" />
            </div>
            <p className="modal-eyebrow">a little note for the garden</p>
            <h2 id="message-title">What would you like<br />to leave behind?</h2>
            <form onSubmit={plantFlower}>
              <textarea
                autoFocus
                maxLength={160}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="write something small and lovely..."
                rows={3}
                aria-label="Short note for your flower"
                data-testid="input-flower-message"
              />
              <button className="plant-button modal-submit" type="submit" disabled={!message.trim()} data-testid="button-plant-flower">
                PLANT FLOWER <span aria-hidden="true">→</span>
              </button>
            </form>
          </section>
        </div>
      )}

      {selectedFlower && (
        <div className="modal-backdrop" onClick={() => setSelectedFlower(null)}>
          <section className="note-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Flower message">
            <button className="close-button" onClick={() => setSelectedFlower(null)} aria-label="Close" data-testid="button-close-note-modal">×</button>
            <img className="note-flower" src={selectedFlower.drawing} alt="" data-testid={`img-note-flower-${selectedFlower.id}`} />
            <p className="note-message" data-testid={`text-flower-message-${selectedFlower.id}`}>“{selectedFlower.message}”</p>
            <p className="note-caption">a note left in our little garden</p>
          </section>
        </div>
      )}

      {showGallery && (
        <div className="modal-backdrop" onClick={() => setShowGallery(false)}>
          <section className="gallery-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="gallery-title">
            <button className="close-button" onClick={() => setShowGallery(false)} aria-label="Close" data-testid="button-close-gallery">×</button>
            <p className="modal-eyebrow">all the little things</p>
            <h2 id="gallery-title">Flower gallery</h2>
            {flowers.length === 0 ? (
              <p className="empty-gallery" data-testid="text-empty-gallery">Your garden is waiting for its first flower.</p>
            ) : (
              <div className="gallery-grid" data-testid="gallery-grid">
                {flowers.map((flower) => (
                  <button
                    className="gallery-flower"
                    key={flower.id}
                    onClick={() => { setShowGallery(false); setSelectedFlower(flower); }}
                    data-testid={`button-gallery-flower-${flower.id}`}
                  >
                    <img src={flower.drawing} alt="" />
                    <span>{flower.message}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;