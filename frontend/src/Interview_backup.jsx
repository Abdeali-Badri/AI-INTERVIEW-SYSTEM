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
  const [question, setQuestion] = useState('Test Question - This should be visible immediately');
  const [feedback, setFeedback] = useState('Test Feedback - This should be visible immediately');
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
  
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const speakStateRef = useRef('none');
  const lastSpeakTsRef = useRef(0);
  const autoplayUnlockedRef = useRef(false);
  
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const noiseBaselineRef = useRef(0);
  const calibrationFramesRef = useRef(0);
  const emaAlphaRef = useRef(0.02);
  const hasSpokenIntroRef = useRef(false);

  // States for cheating detection
  const [warningMsg, setWarningMsg] = useState('');
  const [lookAwayCounter, setLookAwayCounter] = useState(0);
  const [noiseCounter, setNoiseCounter] = useState(0);
  const [lockCamera] = useState(true);
  const TTS_VOLUME = 1;

  useEffect(() => {
    // Clear any cached audio on page load
    localStorage.removeItem('first_audio');
    localStorage.removeItem('intro');
    localStorage.removeItem('first_question');
    
    // Check if we have the required data, if not use defaults
    let jd = localStorage.getItem('jd');
    let experience = localStorage.getItem('experience');
    
    // If no data, set defaults so the page doesn't stay blank
    if (!jd) {
      jd = 'Software Engineering';
      localStorage.setItem('jd', jd);
    }
    if (!experience) {
      experience = 'Not specified';
      localStorage.setItem('experience', experience);
    }

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
      console.log('Starting interview...');
      
      // Stop any existing audio immediately
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Set immediate fallback values
      const fallbackIntro = 'Welcome to the AI interview!';
      const fallbackQuestion = `Tell me about your experience with ${jd}.`;
      
      setFeedback(fallbackIntro);
      setQuestion(fallbackQuestion);
      setBackendNote('Interview started in offline mode.');
      
      console.log('Set immediate fallback:', { intro: fallbackIntro, question: fallbackQuestion });
      
      // Speak only once with the current text
      if (!hasSpokenIntroRef.current) {
        hasSpokenIntroRef.current = true;
        // Small delay to ensure all audio is stopped
        setTimeout(() => {
          speak(fallbackIntro + ". " + fallbackQuestion, '');
        }, 100);
      }
      
      // Try API call in background (but don't change audio/text if it succeeds)
      const questionCount = localStorage.getItem('questionCount') || '5';
      
      try {
        const res = await axios.post('/api/start', { jd, experience, questionCount });
        console.log('API Response:', res.data);
        
        const { session_id, intro, question: q, audio } = res.data;
        
        if (intro && q) {
          localStorage.setItem('session_id', session_id);
          // Don't store audio to prevent conflicts
          localStorage.setItem('intro', intro);
          localStorage.setItem('first_question', q);
          setSessionId(session_id);
          setBackendNote('Backend connected, using fallback for consistency.');
          
          console.log('API connected but keeping current content for consistency');
        }
      } catch (error) {
        console.error('API Error (continuing with fallback):', error);
      }
    };
    startInterview();
  }, []);

  useEffect(() => {
    
    // Enumerate available video input devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          setDevices(videoDevices);
          if (videoDevices.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoDevices[0].deviceId);
          }
        });
    }

    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    // Initialize FaceMesh for anti-cheat
    if (webcamRef.current && canvasRef.current) {
      const faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
      });
      
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      faceMesh.onResults(onFaceResults);
      faceMeshRef.current = faceMesh;

      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (faceMeshRef.current && webcamRef.current && webcamRef.current.video.readyState === 4) {
            await faceMeshRef.current.send({image: webcamRef.current.video});
          }
        },
        width: CAM_W,
        height: CAM_H
      });
      cameraRef.current = camera;
    }

    // Initialize audio monitoring for anti-cheat
    initAudioMonitoring();

    // Cleanup on unmount
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (cameraReady && webcamRef.current && canvasRef.current && faceMeshRef.current && !cameraRef.current) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (faceMeshRef.current && webcamRef.current && webcamRef.current.video.readyState === 4) {
            await faceMeshRef.current.send({image: webcamRef.current.video});
          }
        },
        width: CAM_W,
        height: CAM_H
      });
      cameraRef.current = camera;
      camera.start();
    }
  }, [cameraReady, selectedDeviceId]);

  const initAudioMonitoring = () => {
    try {
        const stream = navigator.mediaDevices.getUserMedia({ audio: true });
        stream.then(s => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(s);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            analyserRef.current = analyser;
            dataArrayRef.current = dataArray;
            sourceRef.current = source;
            noiseBaselineRef.current = 0;
            calibrationFramesRef.current = 0;
            emaAlphaRef.current = 0.02;

            monitorAudioLevel();
        });
    } catch (err) {
        console.error("Audio monitoring init error:", err);
    }
  };

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
      console.log('Face detection results:', results);
      
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
          // No face detected - could be camera obstruction or looking away
          console.log('No face detected, incrementing counter');
          setLookAwayCounter(prev => {
              const newCount = prev + 1;
              console.log('Look away counter:', newCount);
              if (newCount > 10) { // ~0.3 seconds @ 30fps - much faster for testing
                  reportCheat("Face not detected or camera obstructed.");
                  return 0;
              }
              return newCount;
          });
          setWarningMsg("⚠️ Please keep your face visible!");
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
              const newCount = prev + 1;
              if (newCount > 60) { // ~2 seconds @ 30fps
                  reportCheat("Looking away from screen detected.");
                  return 0;
              }
              return newCount;
          });
          setWarningMsg("⚠️ Please look at the screen!");
      } else {
          setLookAwayCounter(0);
          setWarningMsg("");
      }
  };

  const speak = (text, audioBase64) => {
    console.log('Speak called with:', { text, audioBase64: audioBase64 ? 'present' : 'none' });
    
    // Cancel current speech to avoid overlap
    window.speechSynthesis.cancel();

    const now = Date.now();
    if (now - lastSpeakTsRef.current < 1000) {
      console.log('Speak throttled - too soon');
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
        console.log('Speaking TTS:', text);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = TTS_VOLUME;
        window.speechSynthesis.speak(utterance);
        speakStateRef.current = 'tts';
      }
    };

    if (audioBase64) {
        console.log('Using audio base64');
        try {
            const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
            audioRef.current = audio;
            speakStateRef.current = 'mp3';
            audio.play()
              .then(() => {
                console.log('Audio playing successfully');
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
        console.log('Using TTS only');
        speakTTS();
    }
  };

  const reportCheat = async (reason) => {
    // Debounce strikes slightly
    if (processing) return;

    try {
      const res = await axios.post('/api/cheat_strike', {
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

  const handleAnswerSubmit = async (answerText) => {
    setProcessing(true);
    try {
      console.log('Submitting answer:', answerText);
      const res = await axios.post('/api/answer', {
        session_id: sessionId,
        answer: answerText
      });
      console.log('Answer response:', res.data);
      
      const { feedback, decision, next_question, audio } = res.data;
      setFeedback(feedback);
      setQuestion(next_question);
      setBackendNote('');
      
      console.log('Set new state:', { feedback, question: next_question });
      
      if (decision === 'INTERVIEW_COMPLETE') {
        setProcessing(false);
        navigate('/report');
        return;
      }
      
      // Speak the feedback and next question
      speak(feedback + ". " + next_question, audio || '');
      
    } catch (error) {
      console.error('Error submitting answer:', error);
      
      // Fallback response
      const fallbackFeedback = "Thank you for your answer. Let's continue.";
      const fallbackQuestion = `Can you tell me more about your experience with ${localStorage.getItem('jd') || 'software development'}?`;
      
      setFeedback(fallbackFeedback);
      setQuestion(fallbackQuestion);
      setBackendNote('Using fallback response.');
      
      console.log('Fallback response:', { feedback: fallbackFeedback, question: fallbackQuestion });
      
      // Speak the fallback
      speak(fallbackFeedback + ". " + fallbackQuestion, '');
    } finally {
      setProcessing(false);
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

  return (
    <div className="layout">
      {/* Sidebar / Camera */}
      <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
        <h3>Candidate View</h3>
        <div className="camera-frame" style={{ 
          padding: '5px',
          position: 'relative',
          width: CAM_W,
          height: CAM_H
        }}>
            {cameraError ? (
                <div style={{ 
                  color: 'white', 
                  padding: '20px', 
                  textAlign: 'center',
                  width: CAM_W,
                  height: CAM_H,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.8)',
                  borderRadius: '8px'
                }}>
                    <p>❌ Camera Error</p>
                    <small>{cameraError.toString()}</small>
                    <p>Please allow camera access in your browser prompt/settings and close other apps using the camera.</p>
                    <button 
                      onClick={() => {
                        setCameraError(null);
                        setCamKey(k => k + 1);
                      }}
                      style={{
                        marginTop: '10px',
                        padding: '8px 16px',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Retry Camera
                    </button>
                </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  width={CAM_W}
                  height={CAM_H}
                  style={{ 
                    display: 'block', 
                    width: CAM_W, 
                    height: CAM_H,
                    borderRadius: '8px',
                    background: '#000'
                  }}
                />
                <Webcam
                     key={camKey}
                    ref={webcamRef}
                    audio={false}
                    width={CAM_W}
                    height={CAM_H}
                    screenshotFormat="image/jpeg"
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: CAM_W, 
                      height: CAM_H, 
                      opacity: 0, 
                      pointerEvents: 'none',
                      borderRadius: '8px'
                    }}
                     onUserMedia={() => {
                       setCameraReady(true);
                       setCameraError(null);
                     }}
                     onUserMediaError={(err) => { 
                       setCameraError(err); 
                       setCameraReady(false);
                     }}
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
        <div style={{ marginTop: 'auto', padding: '1rem', background: '#fff', borderRadius: '8px', height: 160, boxSizing: 'border-box', overflowY: 'auto', width: '100%', maxWidth: 320 }}>
            <small>⚠️ Anti-Cheat Active:</small>
            <ul style={{ fontSize: '0.8rem', paddingLeft: '1.2rem' }}>
                <li>No tab switching</li>
                <li>Keep face visible & centered</li>
                <li>No murmuring/talking when not answering</li>
            </ul>
            <div style={{ marginTop: '10px', padding: '8px', background: strikes > 0 ? '#ffebee' : '#e8f5e8', borderRadius: '4px', border: `1px solid ${strikes > 0 ? '#f44336' : '#4caf50'}` }}>
                <small style={{ fontWeight: 'bold', color: strikes > 0 ? '#d32f2f' : '#2e7d32' }}>
                    Strikes: {strikes}/5
                </small>
                {strikes > 0 && (
                    <div style={{ marginTop: '4px' }}>
                        <small style={{ color: '#d32f2f' }}>⚠️ Warning issued!</small>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main">
        <div className="header">AI Interviewer</div>
        
        <div className="card" style={{ height: 100, overflowY: 'auto' }}>
            <strong>Feedback:</strong> {feedback || 'Loading...'}
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666' }}>
              Debug: feedback = "{feedback}", question = "{question}"
            </div>
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
            <div className="question-text">Q: {question || 'Loading question...'}</div>
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
                background: !cameraReady ? '#9e9e9e' : (processing ? '#f44336' : '#4CAF50'), 
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
