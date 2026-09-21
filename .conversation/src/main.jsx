import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const GARDEN_IMAGE = '/assets/garden.png';
const STORAGE_KEY = 'our-little-garden-flowers';
const COLORS = [
  { name: 'coral', value: '#ec6d58' },
  { name: 'sunshine', value: '#f5a354' },
  { name: 'lemon', value: '#f2d56d' },
  { name: 'pink', value: '#e38ca8' },
  { name: 'leaf', value: '#5c9c5e' },
];

function loadFlowers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function App() {
  const canvasRef = useRef(null);
  const [flowers, setFlowers] = useState(loadFlowers);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [isPlanting, setIsPlanting] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFlower, setSelectedFlower] = useState(null);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flowers));
  }, [flowers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.4;
    context.strokeStyle = selectedColor;
  }, [selectedColor]);

  function canvasPoint(event) {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    const source = 'touches' in event ? event.touches[0] : event;
    return {
      x: ((source.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((source.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function beginDrawing(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    const point = canvasPoint(event);
    const context = canvas.getContext('2d');
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.strokeStyle = selectedColor;
    setIsDrawing(true);
  }

  function draw(event) {
    if (!isDrawing) return;
    event.preventDefault();
    const point = canvasPoint(event);
    const context = canvasRef.current.getContext('2d');
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasDrawing(true);
  }

  function endDrawing() {
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  }

  function openPlanting() {
    if (hasDrawing) setIsPlanting(true);
  }

  function plantFlower(event) {
    event.preventDefault();
    if (!message.trim() || !hasDrawing) return;

    const canvas = canvasRef.current;
    const flower = {
      id: crypto.randomUUID(),
      message: message.trim(),
      color: selectedColor,
      drawing: canvas.toDataURL('image/png'),
      x: 21 + Math.random() * 58,
      y: 18 + Math.random() * 52,
    };

    setFlowers((current) => [...current, flower]);
    setMessage('');
    setIsPlanting(false);
    clearCanvas();
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <div className="brand-lockup">
          <h1>OUR LITTLE GARDEN</h1>
          <p>leave something lovely behind.</p>
        </div>
        <div className="plant-count" aria-live="polite">
          <span className="count-sprout" aria-hidden="true">✳</span>
          <span><strong>{flowers.length}</strong> {flowers.length === 1 ? 'plant' : 'plants'} planted</span>
        </div>
      </header>

      <section className="garden-layout">
        <div className="garden-side">
          <div className="garden-stage">
            <img
              className="garden-art"
              src={GARDEN_IMAGE}
              alt="A round, lush illustrated garden"
            />
            <div className="planted-flowers" aria-label="Planted flowers">
              {flowers.map((flower) => (
                <button
                  className="planted-flower"
                  key={flower.id}
                  style={{ left: `${flower.x}%`, top: `${flower.y}%` }}
                  onClick={() => setSelectedFlower(flower)}
                  aria-label={`Read flower message: ${flower.message}`}
                >
                  <img src={flower.drawing} alt="" />
                </button>
              ))}
            </div>
          </div>
          <p className="garden-note">click a flower to read its little note</p>
        </div>

        <aside className="plant-panel">
          <div className="panel-heading">
            <span>ADD SOMETHING TO THE<br />GARDEN?</span>
            <span className="tiny-leaf" aria-hidden="true">⌁</span>
          </div>
          <div className={`drawing-wrap ${hasDrawing ? 'has-drawing' : ''}`}>
            <canvas
              ref={canvasRef}
              width="260"
              height="200"
              onPointerDown={beginDrawing}
              onPointerMove={draw}
              onPointerUp={endDrawing}
              onPointerLeave={endDrawing}
              aria-label="Draw a little flower"
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
                />
              ))}
            </div>
            {hasDrawing && (
              <button className="clear-button" onClick={clearCanvas}>clear</button>
            )}
          </div>
          <button className="plant-button" onClick={openPlanting} disabled={!hasDrawing}>
            PLANT IT <span aria-hidden="true">→</span>
          </button>
        </aside>
      </section>

      <button className="gallery-button" onClick={() => setShowGallery(true)}>
        <span aria-hidden="true">❀</span> SEE FLOWER GALLERY
      </button>

      {isPlanting && (
        <div className="modal-backdrop" onClick={() => setIsPlanting(false)}>
          <section className="message-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="message-title">
            <button className="close-button" onClick={() => setIsPlanting(false)} aria-label="Close">×</button>
            <div className="modal-flower">
              <img src={canvasRef.current?.toDataURL('image/png')} alt="Your drawn flower" />
            </div>
            <p className="modal-eyebrow">a little note for the garden</p>
            <h2 id="message-title">What would you like<br />to leave behind?</h2>
            <form onSubmit={plantFlower}>
              <textarea
                autoFocus
                maxLength="160"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="write something small and lovely..."
                rows="3"
              />
              <button className="plant-button modal-submit" type="submit" disabled={!message.trim()}>
                PLANT FLOWER <span aria-hidden="true">→</span>
              </button>
            </form>
          </section>
        </div>
      )}

      {selectedFlower && (
        <div className="modal-backdrop" onClick={() => setSelectedFlower(null)}>
          <section className="note-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Flower message">
            <button className="close-button" onClick={() => setSelectedFlower(null)} aria-label="Close">×</button>
            <img className="note-flower" src={selectedFlower.drawing} alt="" />
            <p className="note-message">“{selectedFlower.message}”</p>
            <p className="note-caption">a note left in our little garden</p>
          </section>
        </div>
      )}

      {showGallery && (
        <div className="modal-backdrop" onClick={() => setShowGallery(false)}>
          <section className="gallery-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="gallery-title">
            <button className="close-button" onClick={() => setShowGallery(false)} aria-label="Close">×</button>
            <p className="modal-eyebrow">all the little things</p>
            <h2 id="gallery-title">Flower gallery</h2>
            {flowers.length === 0 ? (
              <p className="empty-gallery">Your garden is waiting for its first flower.</p>
            ) : (
              <div className="gallery-grid">
                {flowers.map((flower) => (
                  <button className="gallery-flower" key={flower.id} onClick={() => { setShowGallery(false); setSelectedFlower(flower); }}>
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);