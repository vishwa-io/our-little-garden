import { type FormEvent, type PointerEvent, useEffect, useRef, useState } from 'react';

const GARDEN_IMAGE = '/assets/garden-artwork.png';
const STORAGE_KEY = 'our-little-garden-flowers';

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
  x: number;
  y: number;
};

function loadFlowers(): Flower[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const flowers = saved ? JSON.parse(saved) : [];
    return Array.isArray(flowers) ? flowers : [];
  } catch {
    return [];
  }
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flowers, setFlowers] = useState<Flower[]>(loadFlowers);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [isPlanting, setIsPlanting] = useState(false);
  const [message, setMessage] = useState('');
  const [drawingPreview, setDrawingPreview] = useState('');
  const [selectedFlower, setSelectedFlower] = useState<Flower | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flowers));
  }, [flowers]);

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
    context.lineWidth = 10;
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
    setDrawingPreview(canvas.toDataURL('image/png'));
    setIsPlanting(true);
  }

  function plantFlower(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || !hasDrawing || !drawingPreview) return;

    const flower: Flower = {
      id: makeId(),
      message: message.trim(),
      color: selectedColor,
      drawing: drawingPreview,
      x: 19 + Math.random() * 62,
      y: 19 + Math.random() * 56,
    };

    setFlowers((current) => [...current, flower]);
    setMessage('');
    setIsPlanting(false);
    clearCanvas();
  }

  return (
    <main className="garden-page">
      <header className="garden-header">
        <div className="brand">
          <h1 data-testid="text-brand">OUR LITTLE GARDEN</h1>
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
              {flowers.map((flower) => (
                <button
                  className="planted-flower"
                  key={flower.id}
                  style={{ left: `${flower.x}%`, top: `${flower.y}%` }}
                  onClick={() => setSelectedFlower(flower)}
                  aria-label={`Read flower message: ${flower.message}`}
                  data-testid={`button-planted-flower-${flower.id}`}
                >
                  <img src={flower.drawing} alt="" data-testid={`img-planted-flower-${flower.id}`} />
                </button>
              ))}
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