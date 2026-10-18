import React, { useEffect, useState, useRef, useCallback } from 'react';
import '../style/TryOn.style.css';
import { initializeEngine, initializeThreejs, selectFrame, measurePd, getDebugInfo, setFrozen, FRAMES } from '../engine';

const CARD_WIDTH_MM = 85.6;  // ISO/IEC 7810 ID-1 card (SUBE, debit, DNI)

const DEBUG = new URLSearchParams(window.location.search).has('debug');

// Compares the card (known 85.6 mm) with the iris ruler on the frozen frame.
// The card must be flat on the forehead, at the same distance as the eyes.
function cardReport(clicks, info) {
    if (!info) return 'Sin cara en el cuadro congelado. Tocá "Seguir" y volvé a congelar.';
    if (clicks.length < 2) {
        return 'Hacé clic en el borde ' + (clicks.length ? 'derecho' : 'izquierdo') + ' de la tarjeta.';
    }
    var cssPx = Math.hypot(clicks[1].x - clicks[0].x, clicks[1].y - clicks[0].y);
    var cardPx = cssPx * clicks[1].cssToVideo;
    var cardScale = cardPx / CARD_WIDTH_MM;
    var irisScale = info.irisPx / 11.7;
    var diff = (irisScale / cardScale - 1) * 100;
    return 'tarjeta: ' + cardPx.toFixed(0) + ' px → ' + cardScale.toFixed(2) + ' px/mm\n' +
        'iris:    ' + irisScale.toFixed(2) + ' px/mm (' + (diff >= 0 ? '+' : '') + diff.toFixed(0) + ' % contra la tarjeta)\n' +
        'app:     ' + info.pxPerMm.toFixed(2) + ' px/mm (escala del anteojo)\n' +
        'con la tarjeta → DP: ' + (info.pupilPx / cardScale).toFixed(1) + ' mm · ancho de cara: ' +
        (info.faceWidthPx / cardScale).toFixed(0) + ' mm\n' +
        'con el iris    → DP: ' + (info.pupilPx / irisScale).toFixed(1) + ' mm · ancho de cara: ' +
        (info.faceWidthPx / irisScale).toFixed(0) + ' mm';
}

// What to tell the person while the PD is being measured, by engine status
const PD_HINTS = {
    ok: 'Midiendo… quedate quieto mirando a la cámara.',
    noface: 'No vemos tu cara. Ponete frente a la cámara.',
    far: 'Acercate más a la cámara.',
    turned: 'Mirá derecho a la cámara, con la cara de frente.'
};

const LOADING_STEPS = [
    { key: 'camera', label: 'Camera access' },
    { key: 'scene', label: '3D scene setup' },
    { key: 'engine', label: 'AI model loading' },
];

export const TryOn = () => {
    const [loadingStep, setLoadingStep] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [frameId, setFrameId] = useState(FRAMES[0].id);
    // pd: null | { measuring, progress, status } | { pdMm (far), nearPdMm, distanceMm, spreadMm }
    //     | { error: 'timeout' | 'unstable' }
    const [pd, setPd] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    // Card check (?debug=1): freeze the frame, click both card edges
    const [frozen, setFrozenState] = useState(false);
    const [cardClicks, setCardClicks] = useState([]);

    const handleFreeze = useCallback(() => {
        var next = !frozen;
        setFrozen(next);
        setFrozenState(next);
        setCardClicks([]);
    }, [frozen]);

    const handleCardClick = useCallback((e) => {
        if (!frozen) return;
        var canvas = document.querySelector('#threejsContainer canvas');
        if (!canvas) return;
        var rect = canvas.getBoundingClientRect();
        var video = document.getElementById('tryon-video');
        // The canvas uses object-fit: cover, so the image may be scaled past the
        // box and cropped; the visible scale is the larger of the two ratios
        var cssPerVideoPx = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
        // Marks are stored relative to the viewport box so page scrolling does not move them
        var box = e.currentTarget.parentElement.getBoundingClientRect();
        var click = { x: e.clientX - box.left, y: e.clientY - box.top, cssToVideo: 1 / cssPerVideoPx };
        setCardClicks(prev => (prev.length >= 2 ? [click] : prev.concat([click])));
    }, [frozen]);

    useEffect(() => {
        if (!DEBUG) return undefined;
        var timer = setInterval(() => setDebugInfo(getDebugInfo()), 250);
        return () => clearInterval(timer);
    }, []);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);

    useEffect(() => {
        async function init() {
            var video = document.getElementById('tryon-video');

            // Step 0: Camera access
            setLoadingStep(0);
            await navigator.mediaDevices.getUserMedia({
                audio: false,
                // 1280×720 doubles the iris size in pixels vs. the 640×480 default,
                // which halves the PD / scale error from one pixel of landmark noise
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            }).then(stream => {
                video.srcObject = stream;
            });

            video.oncanplay = async () => {
                video.play();

                // Step 1: 3D scene setup
                setLoadingStep(1);
                initializeThreejs("glasses_premium.gltf");

                // Step 2: AI model loading
                setLoadingStep(2);
                await initializeEngine();

                // All done — fade out
                setIsFadingOut(true);
                setTimeout(() => {
                    setIsLoading(false);
                }, 500);
            };
        }

        init();
        return () => {};
    }, []);

    const handleScreenshot = useCallback(() => {
        var canvas = document.querySelector('#threejsContainer canvas');
        if (!canvas) return;
        var link = document.createElement('a');
        link.download = 'virtual-tryon-' + Date.now() + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, []);

    const handleFrame = useCallback((id) => {
        setFrameId(id);
        selectFrame(id);
    }, []);

    const handleMeasurePd = useCallback(() => {
        setPd({ measuring: true, progress: 0, status: 'noface' });
        measurePd(function(progress, status) {
            setPd({ measuring: true, progress: progress, status: status });
        }).then(function(result) {
            setPd(result);
        }).catch(function(err) {
            if (err.message !== 'restarted') setPd({ error: err.message });
        });
    }, []);

    const handleRecord = useCallback(() => {
        if (isRecording) {
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop();
            }
            setIsRecording(false);
            return;
        }

        var canvas = document.querySelector('#threejsContainer canvas');
        if (!canvas) return;

        chunksRef.current = [];
        var stream = canvas.captureStream(30);
        var mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';
        var recorder = new MediaRecorder(stream, { mimeType: mimeType });

        recorder.ondataavailable = function(e) {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = function() {
            var blob = new Blob(chunksRef.current, { type: 'video/webm' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.download = 'virtual-tryon-' + Date.now() + '.webm';
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        };

        recorder.start();
        recorderRef.current = recorder;
        setIsRecording(true);
    }, [isRecording]);

    return (
        <div className="tryon-page">
            <div className="tryon-header">
                <h1 className="tryon-title">Virtual Try-On</h1>
                <p className="tryon-subtitle">AI-Powered Glasses Experience</p>
            </div>

            <div className="tryon-viewport">
                {isLoading && (
                    <div className={'tryon-loading' + (isFadingOut ? ' fade-out' : '')}>
                        <div className="tryon-loading-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="6" cy="12" r="4"/>
                                <circle cx="18" cy="12" r="4"/>
                                <path d="M10 12h4"/>
                                <path d="M2 12h0"/>
                                <path d="M22 12h0"/>
                            </svg>
                        </div>
                        <div className="tryon-loading-steps">
                            {LOADING_STEPS.map((step, i) => {
                                var isDone = i < loadingStep;
                                var isActive = i === loadingStep;
                                return (
                                    <div
                                        key={step.key}
                                        className={'tryon-loading-step' + (isDone ? ' done' : '') + (isActive ? ' active' : '')}
                                    >
                                        <div className="tryon-step-indicator">
                                            {isDone ? (
                                                <svg className="tryon-step-check" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="2,5.5 4.5,8 8,2.5"/>
                                                </svg>
                                            ) : isActive ? (
                                                <div className="tryon-step-spinner"></div>
                                            ) : null}
                                        </div>
                                        {step.label}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="tryon-loading-status">Preparing your experience</p>
                    </div>
                )}
                <div id="threejsContainer" onClick={handleCardClick} style={frozen ? { cursor: 'crosshair' } : undefined}>
                    <video id="tryon-video"></video>
                </div>
                {cardClicks.map((c, i) => (
                    <div key={i} className="tryon-card-mark" style={{ left: c.x, top: c.y }} />
                ))}
            </div>

            <div className="tryon-controls tryon-frames">
                {FRAMES.map(f => (
                    <button
                        key={f.id}
                        className={'tryon-btn' + (f.id === frameId ? ' selected' : '')}
                        onClick={() => handleFrame(f.id)}
                    >
                        {f.name}
                    </button>
                ))}
            </div>

            <div className="tryon-controls">
                <button
                    className="tryon-btn"
                    onClick={handleMeasurePd}
                    disabled={isLoading || (pd && pd.measuring)}
                    title="Estimar la distancia pupilar"
                >
                    Medir DP
                </button>
                <button className="tryon-btn" onClick={handleScreenshot} title="Take Screenshot">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                    </svg>
                    Screenshot
                </button>
                <button
                    className={'tryon-btn tryon-btn-record' + (isRecording ? ' recording' : '')}
                    onClick={handleRecord}
                    title={isRecording ? 'Stop Recording' : 'Start Recording'}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isRecording ? (
                            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
                        ) : (
                            <circle cx="12" cy="12" r="7" fill="currentColor"/>
                        )}
                    </svg>
                    {isRecording ? 'Stop' : 'Record'}
                </button>
            </div>

            {pd && (
                <div className="tryon-pd" role="status">
                    {pd.measuring && (
                        <p>
                            {PD_HINTS[pd.status]}
                            {' '}{Math.round(pd.progress * 100)}%
                        </p>
                    )}
                    {pd.pdMm && (
                        <p className="tryon-pd-value">DP estimada: {Math.round(pd.pdMm)} mm <small>(de lejos)</small></p>
                    )}
                    {pd.pdMm && DEBUG && (
                        <p>
                            de lejos {pd.pdMm.toFixed(1)} mm · de cerca (medida) {pd.nearPdMm.toFixed(1)} mm<br />
                            distancia estimada {(pd.distanceMm / 10).toFixed(0)} cm · dispersión {pd.spreadMm.toFixed(1)} mm
                        </p>
                    )}
                    {pd.error === 'timeout' && (
                        <p>No se pudo medir. Acercate a la cámara, mirala de frente y probá de nuevo.</p>
                    )}
                    {pd.error === 'unstable' && (
                        <p>La medición salió inestable. Acercate un poco más, quedate quieto y probá de nuevo.</p>
                    )}
                    <p className="tryon-pd-notice">
                        Es una estimación hecha con la cámara. No reemplaza la medición de tu óptico.
                    </p>
                </div>
            )}

            {DEBUG && (
                <pre className="tryon-debug">
                    {debugInfo
                        ? 'cámara: ' + debugInfo.videoSize + '\n' +
                          'iris: ' + debugInfo.irisPx.toFixed(1) + ' px\n' +
                          'ancho de cara: ' + debugInfo.faceWidthMm.toFixed(0) + ' mm (' + debugInfo.faceWidthPx.toFixed(0) + ' px)\n' +
                          'alto superior: ' + debugInfo.faceHeightMm.toFixed(0) + ' mm\n' +
                          'escala: ' + debugInfo.pxPerMm.toFixed(2) + ' px/mm\n' +
                          'giro (|z| ojos): ' + debugInfo.eyeTilt.toFixed(2) + '  muestras: ' + debugInfo.samples
                        : 'sin cara'}
                </pre>
            )}

            {DEBUG && (
                <div className="tryon-controls">
                    <button className="tryon-btn" onClick={handleFreeze}>
                        {frozen ? 'Seguir' : 'Congelar'}
                    </button>
                </div>
            )}

            {DEBUG && frozen && (
                <pre className="tryon-debug">
                    {cardReport(cardClicks, debugInfo)}
                </pre>
            )}

            <p className="tryon-footer">Powered by MediaPipe + Three.js</p>
        </div>
    );
};
