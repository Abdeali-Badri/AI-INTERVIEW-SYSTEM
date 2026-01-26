// Vanilla JS interview page:
// - Uses existing Flask APIs at /api/start, /api/answer, /api/cheat_strike, /api/report
// - Camera + simple face orientation anti-cheat
// - Speech recognition (where supported)
// - Plays backend audio (base64 mp3) or falls back to SpeechSynthesis

const questionEl = document.getElementById('question-text');
const feedbackEl = document.getElementById('feedback-text');
const answerEl = document.getElementById('answer-input');
const submitBtn = document.getElementById('submit-btn');
const micBtn = document.getElementById('mic-btn');
const reportBtn = document.getElementById('report-btn');
const statusLine = document.getElementById('status-line');
const strikeCountEl = document.getElementById('strike-count');
const lookWarningEl = document.getElementById('look-warning');
const cameraLoadingEl = document.getElementById('camera-loading');

let sessionId = localStorage.getItem('session_id') || '';
let currentQuestion = localStorage.getItem('first_question') || '';
let isSubmitting = false;
let recognition = null;
let isRecording = false;
let strikes = 0;

const videoEl = document.getElementById('camera-video');
const canvasEl = document.getElementById('camera-canvas');
const canvasCtx = canvasEl.getContext('2d');

// ----- Helpers -----

function speakTextBackend(text, audioBase64) {
  // Cancel any existing TTS
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  if (audioBase64) {
    try {
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audio.play().catch(() => {
        if (text && 'speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(text);
          window.speechSynthesis.speak(u);
        }
      });
      return;
    } catch (e) {
      console.error('Audio play error', e);
    }
  }

  if (text && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  }
}

async function callCheatStrike(reason) {
  try {
    const res = await fetch('/api/cheat_strike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.strikes != null) {
      strikes = data.strikes;
      strikeCountEl.textContent = String(strikes);
    }
    if (data.status === 'terminated') {
      alert(data.message || 'Interview terminated due to suspicious behavior.');
      window.location.href = 'report.html';
    }
  } catch (e) {
    console.error('cheat_strike error', e);
  }
}

// Tab switching detection
document.addEventListener('visibilitychange', () => {
  if (document.hidden && sessionId) {
    callCheatStrike('Tab switch / window hidden');
  }
});

// ----- Camera + FaceMesh anti-cheat -----

async function initCameraAndFaceMesh() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusLine.textContent = 'Camera not supported in this browser.';
    if (cameraLoadingEl) cameraLoadingEl.style.display = 'none';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    videoEl.srcObject = stream;

    if (cameraLoadingEl) cameraLoadingEl.style.display = 'none';

    const faceMesh = new FaceMesh.FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onFaceResults);

    const camera = new Camera.Camera(videoEl, {
      onFrame: async () => {
        await faceMesh.send({ image: videoEl });
      },
      width: 320,
      height: 240,
    });
    camera.start();
  } catch (err) {
    console.error('Camera error', err);
    statusLine.textContent = 'Camera error. Please allow permission and refresh.';
    if (cameraLoadingEl) cameraLoadingEl.style.display = 'none';
  }
}

let lookAwayCounter = 0;

function onFaceResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (results.image) {
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasEl.width,
      canvasEl.height
    );
  }

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    lookAwayCounter++;
  } else {
    const landmarks = results.multiFaceLandmarks[0];
    const nose = landmarks[1];
    const leftEar = landmarks[234];
    const rightEar = landmarks[454];
    if (!nose || !leftEar || !rightEar) {
      lookAwayCounter++;
    } else {
      const distToLeft = Math.abs(nose.x - leftEar.x);
      const distToRight = Math.abs(nose.x - rightEar.x);
      const ratio = distToLeft / (distToRight + 0.0001);
      const lookingAway = ratio < 0.2 || ratio > 4.0;
      if (lookingAway) {
        lookAwayCounter++;
      } else {
        lookAwayCounter = 0;
      }
    }
  }

  if (lookAwayCounter > 60) {
    if (lookWarningEl) lookWarningEl.style.display = 'block';
    callCheatStrike('Looking away from screen');
    lookAwayCounter = 0;
  } else if (lookAwayCounter === 0 && lookWarningEl) {
    lookWarningEl.style.display = 'none';
  }

  canvasCtx.restore();
}

// ----- Speech recognition -----

function initSpeechRecognition() {
  const SR =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if (!SR) {
    micBtn.disabled = true;
    micBtn.textContent = '🎤 Speech not supported';
    return;
  }

  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    answerEl.value = text;
    isRecording = false;
    micBtn.textContent = '🎤 Tap to Speak';
  };

  recognition.onerror = () => {
    isRecording = false;
    micBtn.textContent = '🎤 Tap to Speak';
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.textContent = '🎤 Tap to Speak';
  };
}

// ----- Interview flow -----

async function ensureIntroLoaded() {
  const intro = localStorage.getItem('intro') || '';
  const firstQ = localStorage.getItem('first_question') || '';

  if (!sessionId || !firstQ) {
    // try call /api/start again if something went wrong
    const jd = localStorage.getItem('jd') || 'General Software Engineering';
    const exp = localStorage.getItem('experience') || 'Not specified';
    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, experience: exp }),
      });
      if (!res.ok) throw new Error('start failed');
      const data = await res.json();
      sessionId = data.session_id || '';
      localStorage.setItem('session_id', sessionId);
      localStorage.setItem('intro', data.intro || '');
      localStorage.setItem('first_question', data.question || '');
      localStorage.setItem('first_audio', data.audio || '');
      feedbackEl.textContent = data.intro || '';
      questionEl.textContent = data.question || '';
      currentQuestion = data.question || '';
      speakTextBackend(
        `${data.intro || ''}. ${data.question || ''}`,
        data.audio || ''
      );
      return;
    } catch (e) {
      console.error(e);
      feedbackEl.textContent = 'Welcome to the interview.';
      questionEl.textContent =
        'What key experience do you have related to this role?';
      currentQuestion = questionEl.textContent;
      speakTextBackend(
        `${feedbackEl.textContent}. ${questionEl.textContent}`,
        ''
      );
      return;
    }
  }

  feedbackEl.textContent = intro || 'Welcome to the interview.';
  questionEl.textContent = firstQ;
  currentQuestion = firstQ;

  const audio = localStorage.getItem('first_audio') || '';
  speakTextBackend(`${feedbackEl.textContent}. ${questionEl.textContent}`, audio);
}

async function submitAnswer() {
  const answer = answerEl.value.trim();
  if (!answer || !sessionId || isSubmitting) return;

  isSubmitting = true;
  submitBtn.disabled = true;
  micBtn.disabled = true;
  statusLine.textContent = '⏳ Sending answer...';

  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, answer }),
    });

    if (!res.ok) {
      if (res.status === 404) {
        alert('Session expired. Starting again from home.');
        window.location.href = 'index.html';
        return;
      }
      if (res.status === 400) {
        alert('Interview ended. Redirecting to report.');
        window.location.href = 'report.html';
        return;
      }
      throw new Error(`answer failed: ${res.status}`);
    }

    const data = await res.json();
    const { feedback, next_question, decision, audio } = data;

    feedbackEl.textContent = feedback || '';
    answerEl.value = '';

    if (decision === 'INTERVIEW_COMPLETE') {
      statusLine.textContent =
        'Interview complete. Redirecting to report in a moment...';
      speakTextBackend(
        `${feedback || 'Interview complete.'} The interview is now complete.`,
        audio || ''
      );
      setTimeout(() => {
        window.location.href = 'report.html';
      }, 4000);
    } else {
      questionEl.textContent = next_question || '';
      currentQuestion = next_question || '';
      statusLine.textContent = 'Answer the next question when ready.';
      speakTextBackend(
        `${feedback || ''}. ${next_question || ''}`,
        audio || ''
      );
    }
  } catch (e) {
    console.error(e);
    alert('Error sending answer. Please try again.');
    statusLine.textContent = 'Error sending answer. You can try again.';
  } finally {
    isSubmitting = false;
    submitBtn.disabled = false;
    micBtn.disabled = false;
  }
}

// ----- Event wiring -----

submitBtn.addEventListener('click', submitAnswer);

answerEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    submitAnswer();
  }
});

micBtn.addEventListener('click', () => {
  if (!recognition) {
    initSpeechRecognition();
    if (!recognition) return;
  }
  if (isRecording) {
    recognition.stop();
    return;
  }
  isRecording = true;
  micBtn.textContent = '🎙️ Listening...';
  try {
    recognition.start();
  } catch (e) {
    isRecording = false;
    micBtn.textContent = '🎤 Tap to Speak';
  }
});

reportBtn.addEventListener('click', () => {
  window.location.href = 'report.html';
});

// ----- Bootstrapping -----

(async function bootstrap() {
  // If someone lands here without going through home, send them back.
  if (!localStorage.getItem('jd') || !localStorage.getItem('experience')) {
    window.location.href = 'index.html';
    return;
  }
  initSpeechRecognition();
  await ensureIntroLoaded();
  initCameraAndFaceMesh();
})();

