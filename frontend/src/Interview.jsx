import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

function Interview() {
  const CAM_W = 320;
  const CAM_H = 240;
  const SIDEBAR_W = 380;
  const [question, setQuestion] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [strikes, setStrikes] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [camKey, setCamKey] = useState(0);
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(localStorage.getItem('session_id') || '');
  const [backendNote, setBackendNote] = useState('');

  // References
  const webcamRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const noiseBaselineRef = useRef(0);
  const calibrationFramesRef = useRef(0);
  const emaAlphaRef = useRef(0.02);
  const audioRef = useRef(null);
  const hasSpokenIntroRef = useRef(false);
  const speakStateRef = useRef('none');
  const lastSpeakTsRef = useRef(0);
  const canvasRef = useRef(null);
  const rafIdRef = useRef(null);
  const dprRef = useRef(window.devicePixelRatio || 1);
  
  // States for cheating detection
  const [warningMsg, setWarningMsg] = useState('');
  const [lookAwayCounter, setLookAwayCounter] = useState(0);
  const [noiseCounter, setNoiseCounter] = useState(0);
  const [lockCamera] = useState(true);
  const TTS_VOLUME = 1;
  const autoplayUnlockedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const constraints = (selectedDeviceId && selectedDeviceId.length > 0)
          ? { video: { deviceId: { exact: selectedDeviceId } }, audio: false }
          : { video: { facingMode: "user" }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setCameraReady(true);
        stream.getTracks().forEach(t => t.stop());
      } catch (e) {
        setCameraError(e);
      }
    })();
    
    const startInterview = async () => {
      const jd = localStorage.getItem('jd') || 'General Software Engineering';
      const experience = localStorage.getItem('experience') || 'Not specified';
      try {
        const res = await axios.post('http://localhost:5000/api/start', { jd, experience });
        const { session_id, intro, question: q, audio } = res.data;
        localStorage.setItem('session_id', session_id);
        localStorage.setItem('intro', intro);
        localStorage.setItem('first_question', q);
        localStorage.setItem('first_audio', audio || '');
        setSessionId(session_id);
        setFeedback(intro);
        setQuestion(q);
        setBackendNote('');
        if (!hasSpokenIntroRef.current) {
          hasSpokenIntroRef.current = true;
          speak(intro + ". " + q, audio || '');
        }
      } catch {
        const jdText = localStorage.getItem('jd') || 'Role';
        const intro = 'Welcome to the interview.';
        const q = `What key experience do you have related to ${jdText}?`;
        setSessionId('');
        setFeedback(intro);
        setQuestion(q);
        setBackendNote('Backend unavailable. Using local fallback.');
        if (!hasSpokenIntroRef.current) {
          hasSpokenIntroRef.current = true;
          speak(intro + ". " + q, '');
        }
      }
    };
    startInterview();
  }, []);

  useEffect(() => {
    
    // Enumerate available video input devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(list => {
          const vids = list.filter(d => d.kind === 'videoinput');
          setDevices(vids);
          if (vids.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(vids[0].deviceId);
          }
        })
        .catch(err => {
          setCameraError(err);
        });
      const handleDeviceChange = async () => {
        try {
          const list = await navigator.mediaDevices.enumerateDevices();
          const vids = list.filter(d => d.kind === 'videoinput');
          setDevices(vids);
          if (lockCamera) {
            const stillPresent = vids.some(v => v.deviceId === selectedDeviceId);
            if (!stillPresent && vids.length > 0) {
              setSelectedDeviceId(vids[0].deviceId);
              setCamKey(k => k + 1);
            }
          }
        } catch {
          /* ignore */
        }
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      // Cleanup will be handled in the effect's final return below
    }

    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        handleAnswerSubmit(text);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    // Initialize Face Mesh
    const faceMesh = new FaceMesh({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }});
    
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onFaceResults);

    // Poll for webcam readiness to render camera even if onUserMedia is delayed
    const pollReady = () => {
      const video = webcamRef.current?.video;
      if (video && video.readyState >= 2 && !cameraReady) {
        setCameraReady(true);
      }
      rafIdRef.current = requestAnimationFrame(pollReady);
    };
    rafIdRef.current = requestAnimationFrame(pollReady);

    if (cameraReady && webcamRef.current && webcamRef.current.video) {
      const loop = async () => {
        const video = webcamRef.current?.video;
        const canvas = canvasRef.current;
        if (video) {
          await faceMesh.send({ image: video });
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const dpr = dprRef.current;
              const targetW = Math.floor(CAM_W * dpr);
              const targetH = Math.floor(CAM_H * dpr);
              if (canvas.width !== targetW || canvas.height !== targetH) {
                canvas.width = targetW;
                canvas.height = targetH;
              }
              ctx.drawImage(video, 0, 0, targetW, targetH);
            }
          }
        }
        rafIdRef.current = requestAnimationFrame(loop);
      };
      rafIdRef.current = requestAnimationFrame(loop);
    }

    // Initialize Audio Monitoring for Murmuring (only when camera is ready)
    if (cameraReady) {
      initAudioMonitoring();
    }

    // Cheating Detection: Visibility Change
    const handleVisibilityChange = () => {
      if (!cameraReady) return;
      if (document.hidden) {
        reportCheat("Tab switch / Window minimized detected");
      }
    };

    if (cameraReady) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // Initial TTS
    const initAudio = localStorage.getItem('first_audio') || '';
    if (!hasSpokenIntroRef.current) {
      hasSpokenIntroRef.current = true;
      speak(feedback + ". " + question, initAudio);
    }

    const unlockAudio = () => {
      if (!autoplayUnlockedRef.current) {
        autoplayUnlockedRef.current = true;
        const initAudio2 = localStorage.getItem('first_audio') || '';
        const txt = (feedback || '') + ". " + (question || '');
        if (txt.trim()) {
          speak(txt, initAudio2);
        }
      }
    };
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
    // Cleanup handled in final return

    return () => {
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      if (cameraReady) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', () => {});
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [cameraReady]); // Added dependency on cameraReady

  const initAudioMonitoring = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;
        sourceRef.current = source;
        noiseBaselineRef.current = 0;
        calibrationFramesRef.current = 0;
        emaAlphaRef.current = 0.02;

        monitorAudioLevel();
    } catch (err) {
        console.error("Audio monitoring init error:", err);
    }
  };

  // Camera access and readiness handled automatically by the hidden Webcam component

  const monitorAudioLevel = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;
      
      const checkAudio = () => {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        let sum = 0;
        for(let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i];
        }
        const average = sum / dataArrayRef.current.length;
        if (calibrationFramesRef.current < 180) {
            noiseBaselineRef.current = (noiseBaselineRef.current * calibrationFramesRef.current + average) / (calibrationFramesRef.current + 1);
            calibrationFramesRef.current += 1;
        }
        if (calibrationFramesRef.current >= 180 && !isRecording && !processing) {
            const alpha = emaAlphaRef.current;
            noiseBaselineRef.current = noiseBaselineRef.current * (1 - alpha) + average * alpha;
        }
        const marginDynamic = Math.max(40, noiseBaselineRef.current * 0.4);
        const threshold = noiseBaselineRef.current + marginDynamic;
        if (average > threshold && !isRecording && !processing) {
             setNoiseCounter(prev => {
                 if (prev > 240) {
                     reportCheat("Suspicious audio/murmuring detected while not answering.");
                     return 0;
                 }
                 return prev + 1;
             });
        } else {
            setNoiseCounter(0);
        }
        
        requestAnimationFrame(checkAudio);
      };
      checkAudio();
  };

  const onFaceResults = (results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
          // No face detected - suspicious?
          // Could be momentary, so we don't strike immediately but maybe warn
          return;
      }
      
      const landmarks = results.multiFaceLandmarks[0];
      
      // Simple Head Pose Estimation using relative positions of nose and ears
      // 1: Nose Tip, 234: Left Ear (approx), 454: Right Ear (approx)
      const nose = landmarks[1];
      const leftEar = landmarks[234];
      const rightEar = landmarks[454];
      
      if (!nose || !leftEar || !rightEar) return;

      // Check horizontal turn (Yaw)
      const distToLeft = Math.abs(nose.x - leftEar.x);
      const distToRight = Math.abs(nose.x - rightEar.x);
      const ratio = distToLeft / (distToRight + 0.001); // avoid div by 0

      // If looking straight, ratio should be around 1.0 (0.5 - 2.0 range)
      // If ratio < 0.2 (Looking Left strongly) or ratio > 5.0 (Looking Right strongly)
      
      let lookingAway = false;
      if (ratio < 0.2 || ratio > 4.0) {
          lookingAway = true;
      }
      
      // Check vertical (Pitch) - roughly using eye vs nose y
      // 10: Top of head, 152: Chin
      // If nose is too close to top or bottom?
      
      if (lookingAway) {
          setLookAwayCounter(prev => {
              if (prev > 60) { // ~2 seconds @ 30fps
                  reportCheat("Looking away from screen detected.");
                  return 0;
              }
              return prev + 1;
          });
          setWarningMsg("⚠️ Please look at the screen!");
      } else {
          setLookAwayCounter(0);
          setWarningMsg("");
      }
  };

  const speak = (text, audioBase64) => {
    // Cancel current speech to avoid overlap
    window.speechSynthesis.cancel();

    const now = Date.now();
    if (now - lastSpeakTsRef.current < 1000) {
      return;
    }
    lastSpeakTsRef.current = now;

    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore error while pausing */
      }
      audioRef.current = null;
    }

    const speakTTS = () => {
      if (text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = TTS_VOLUME;
        window.speechSynthesis.speak(utterance);
        speakStateRef.current = 'tts';
      }
    };

    if (audioBase64) {
        try {
            const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
            audioRef.current = audio;
            speakStateRef.current = 'mp3';
            audio.play()
              .then(() => {
              })
              .catch(err => {
                console.error("Audio play error", err);
                speakStateRef.current = 'none';
                speakTTS();
              });
        } catch (e) {
            console.error("Audio creation error", e);
            speakStateRef.current = 'none';
            speakTTS();
        }
    } else if (text) {
        speakTTS();
    }
  };

  const reportCheat = async (reason) => {
    // Debounce strikes slightly
    if (processing) return;

    try {
      const res = await axios.post('http://localhost:5000/api/cheat_strike', {
        session_id: sessionId
      });
      if (res.data.status === 'terminated') {
        setWarningMsg(res.data.message);
        navigate('/report');
      } else {
        // Use a toast or non-blocking alert if possible, but alert is fine for now
        // To avoid loop with visibility change (alert takes focus), we might want to just show UI error
        // But the requirement says "message pop up".
        
        // Hack: Play a sound
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(() => {});
        setWarningMsg(`${res.data.message} | Reason: ${reason}`);
        setStrikes(res.data.strikes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startRecording = () => {
    if (recognitionRef.current) {
      setIsRecording(true);
      recognitionRef.current.start();
    } else {
      alert("Speech recognition not supported in this browser.");
    }
  };

  const handleAnswerSubmit = async (answerText) => {
    setProcessing(true);
    try {
      const res = await axios.post('http://localhost:5000/api/answer', {
        session_id: sessionId,
        answer: answerText
      });

      const { feedback, next_question, decision, audio } = res.data;

      if (decision === 'INTERVIEW_COMPLETE') {
        setFeedback(feedback);
        speak(feedback + ". The interview is now complete.", audio);
        setTimeout(() => navigate('/report'), 5000);
      } else {
        setFeedback(feedback);
        setQuestion(next_question);
        setTranscript('');
        speak(feedback + ". " + next_question, audio);
      }
    } catch (error) {
      console.error(error);
      const status = error.response?.status;
      const msg = error.response?.data?.error || error.message;
      if (status === 404) {
        alert("Session expired. Please start a new interview.");
        navigate('/');
      } else if (status === 400) {
        alert("Interview ended. Redirecting to report.");
        navigate('/report');
      } else {
        alert(`Error processing answer: ${msg}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="layout">
      {/* Sidebar / Camera */}
      <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
        <h3>Candidate View</h3>
        <div className="camera-frame" style={{ padding: '5px' }}>
            {cameraError ? (
                <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>
                    <p>❌ Camera Error</p>
                    <small>{cameraError.toString()}</small>
                    <p>Please allow camera access in your browser prompt/settings and close other apps using the camera.</p>
                </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  width={CAM_W}
                  height={CAM_H}
                  style={{ display: 'block', width: CAM_W, height: CAM_H }}
                />
                <Webcam
                     key={camKey}
                    ref={webcamRef}
                    audio={false}
                    width={CAM_W}
                    height={CAM_H}
                    screenshotFormat="image/jpeg"
                    style={{ position: 'absolute', top: 0, left: 0, width: CAM_W, height: CAM_H, opacity: 0, pointerEvents: 'none' }}
                     onUserMedia={() => setCameraReady(true)}
                     onUserMediaError={(err) => { setCameraError(err); }}
                     videoConstraints={
                       (selectedDeviceId && selectedDeviceId.length > 0)
                         ? { deviceId: { exact: selectedDeviceId }, width: CAM_W, height: CAM_H, aspectRatio: CAM_W / CAM_H }
                         : { facingMode: "user", width: CAM_W, height: CAM_H, aspectRatio: CAM_W / CAM_H }
                     }
                />
              </>
            )}
             {warningMsg && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(255,0,0,0.7)',
                    color: 'white',
                    textAlign: 'center',
                    padding: '5px',
                    fontWeight: 'bold'
                }}>
                    {warningMsg}
                </div>
            )}
        </div>
        <p style={{ color: 'red', fontWeight: 'bold', height: 24, display: 'flex', alignItems: 'center' }}>Strikes: {strikes}/5</p>
        {devices.length > 1 && (
          <div style={{ marginTop: '0.5rem', height: 32, display: 'flex', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8rem' }}>Camera:</label>{" "}
            <select 
              value={selectedDeviceId || ''} 
              onChange={(e) => { setSelectedDeviceId(e.target.value); setCamKey(k => k + 1); }}
              style={{ fontSize: '0.8rem', height: 24 }}
            >
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ marginTop: 'auto', padding: '1rem', background: '#fff', borderRadius: '8px', height: 140, boxSizing: 'border-box', overflowY: 'auto', width: '100%', maxWidth: 320 }}>
            <small>⚠️ Anti-Cheat Active:</small>
            <ul style={{ fontSize: '0.8rem', paddingLeft: '1.2rem' }}>
                <li>No tab switching</li>
                <li>Keep face visible & centered</li>
                <li>No murmuring/talking when not answering</li>
            </ul>
        </div>
      </div>

      {/* Main Content */}
      <div className="main">
        <div className="header">AI Interviewer</div>
        
        <div className="card" style={{ height: 100, overflowY: 'auto' }}>
            <strong>Feedback:</strong> {feedback || ' '}
            {backendNote && (
                <div style={{ marginTop: 8, color: '#d32f2f', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>⚠️ {backendNote}</span>
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{ padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                        Retry Connection
                    </button>
                </div>
            )}
        </div>

        <div className="question-card">
            <div className="question-text">Q: {question || ' '}</div>
        </div>
        
        {/* Auto-start and audio are now handled programmatically; no manual buttons */}

        {/* If question/feedback were empty, fallback and TTS are already applied automatically */}

        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ height: 28, display: 'flex', alignItems: 'center', width: '100%', maxWidth: '600px' }}>
              <span>Your Answer:</span>
            </div>
            <div style={{ display: 'none' }}>
              {lookAwayCounter}{noiseCounter}
            </div>
            <textarea
              className="answer-area"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={3}
              placeholder="Or type your answer here..."
              style={{ width: '100%', maxWidth: '640px', marginBottom: '1rem' }}
            />
            <button
              className="btn btn-primary"
              onClick={() => handleAnswerSubmit(transcript)}
              disabled={!cameraReady || processing || !transcript.trim()}
              style={{
                padding: '0.6rem 1.2rem',
                marginBottom: '1rem',
                width: 160,
                height: 40
              }}
            >
              Submit Answer
            </button>
            <button 
                className="btn btn-secondary"
                onClick={startRecording} 
                disabled={!cameraReady || isRecording || processing}
                style={{ 
                    padding: '0.75rem 1.5rem', 
                    fontSize: '1.2rem', 
                    background: !cameraReady ? '#9e9e9e' : (isRecording ? 'red' : '#4CAF50'), 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '50px',
                    cursor: 'pointer',
                    width: 140,
                    height: 120
                }}
            >
                {!cameraReady ? 'Enable Camera to Continue' : (isRecording ? 'Listening...' : processing ? 'Processing...' : '🎤 Tap to Speak')}
            </button>
        </div>
      </div>
    </div>
  );
}

export default Interview;
