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
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString()); // Add time state
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(localStorage.getItem('session_id') || '');
  const [backendNote, setBackendNote] = useState('');

  // Update time every second to test React re-rendering
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
    // Don't clear localStorage data - it might be needed
    // Only clear if we detect corrupted data

    // Check if we have the required data, if not use defaults
    let jd = localStorage.getItem('jd');
    let experience = localStorage.getItem('experience');
    let session_id = localStorage.getItem('session_id');
    let intro = localStorage.getItem('intro');
    let first_question = localStorage.getItem('first_question');

    console.log('Interview page loaded with localStorage data:', {
      jd, experience, session_id, intro, first_question
    });

    // If no basic data, set defaults so the page doesn't stay blank
    if (!jd) {
      jd = 'Software Engineering';
      localStorage.setItem('jd', jd);
    }
    if (!experience) {
      experience = 'Not specified';
      localStorage.setItem('experience', experience);
    }

    // Test camera access immediately
    (async () => {
      try {
        console.log('Testing camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        console.log('Camera access granted!');
        setCameraReady(true);

        // Test the stream
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        // Stop the test stream after 3 seconds
        setTimeout(() => {
          stream.getTracks().forEach(t => t.stop());
          console.log('Camera test completed');
        }, 3000);

      } catch (e) {
        console.error('Camera access denied:', e);
        setCameraError(e);

        // Show user-friendly error
        alert('Camera access is required for this interview. Please allow camera access in your browser and refresh the page.');
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

      // Initialize question count to 0 for new interviews
      localStorage.setItem('question_count', '0');
      localStorage.setItem('max_questions', localStorage.getItem('questionCount') || '5');

      console.log('Initialized question count to 0');

      let storedIntro = intro;
      let storedQuestion = first_question;
      let currentSessionId = session_id;

      // If we don't have the required data, fetch it from backend
      if (!storedIntro || !storedQuestion || !currentSessionId) {
        console.log('Missing data, fetching from backend...');
        try {
          const jd = localStorage.getItem('jd') || 'Software Engineering';
          const experience = localStorage.getItem('experience') || 'Not specified';
          const questionCount = localStorage.getItem('questionCount') || '5';

          console.log('Fetching interview data with:', { jd, experience, questionCount });

          // First test if backend is available
          try {
            await axios.get('/api/health', { timeout: 5000 });
          } catch (healthError) {
            console.error('Backend health check failed:', healthError);
            throw new Error('Backend is not responding');
          }

          const response = await axios.post('/api/start', {
            jd,
            experience,
            questionCount
          }, { timeout: 10000 });

          console.log('Backend response:', response.data);

          const { session_id: newSessionId, intro: newIntro, question: newQuestion, audio } = response.data;

          if (newSessionId && newIntro && newQuestion) {
            // Store the data
            localStorage.setItem('session_id', newSessionId);
            localStorage.setItem('intro', newIntro);
            localStorage.setItem('first_question', newQuestion);
            localStorage.setItem('first_audio', audio || '');

            // Update state
            storedIntro = newIntro;
            storedQuestion = newQuestion;
            currentSessionId = newSessionId;
            setSessionId(newSessionId);

            console.log('Successfully fetched and stored interview data');
          } else {
            throw new Error('Invalid response from backend');
          }
        } catch (error) {
          console.error('Failed to fetch interview data:', error);
          setBackendNote(`Backend connection failed: ${error.message}. Please refresh.`);
          // STRICT MODE: No fallback data.
          // We will let the user see the empty state or error note.
          alert(`Failed to start interview. Error: ${error.message}`);
          return;
        }
      }

      // Use stored data
      const finalIntro = storedIntro;
      const finalQuestion = storedQuestion;

      if (!finalIntro || !finalQuestion) {
        console.error("Missing interview data");
        return;
      }

      setFeedback(finalIntro);
      setQuestion(finalQuestion);

      if (!backendNote) {
        setBackendNote('Interview started successfully.');
      }

      console.log('Set interview state:', { intro: finalIntro, question: finalQuestion, sessionId: currentSessionId });

      // Speak immediately on page load (but only once!)
      if (!hasSpokenIntroRef.current) {
        hasSpokenIntroRef.current = true;

        console.log('Auto-playing intro immediately...');

        // Cancel any existing speech first
        window.speechSynthesis.cancel();

        // Check if we have backend audio from the start
        const firstAudio = localStorage.getItem('first_audio');

        console.log('Audio check - firstAudio:', firstAudio ? 'present' : 'none');
        console.log('Speaking intro and question:', finalIntro, finalQuestion);

        if (firstAudio) {
          console.log('Using backend audio for intro');
          speak(finalIntro + ". " + finalQuestion, firstAudio);
        } else {
          console.log('Using TTS for intro');
          speak(finalIntro + ". " + finalQuestion, '');
        }
      }
    };
    startInterview();
  }, []);

  useEffect(() => {
    // Tab switching detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('TAB SWITCH DETECTED - Triggering strike');
        reportCheat("Tab switching detected!");
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

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
        console.log('Speech recognition result:', event.results);
        const text = event.results[0][0].transcript;
        console.log('Recognized text:', text);
        setTranscript(text);
        setIsRecording(false);

        // Auto-submit after speech recognition
        setTimeout(() => {
          handleAnswerSubmit(text);
        }, 1000);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        alert(`Speech recognition error: ${event.error}. Please try again or type your answer.`);
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      console.log('Speech recognition initialized');
    } else {
      console.error('Speech recognition not supported');
      alert('Speech recognition is not supported in this browser. Please use Chrome or type your answers.');
    }

    // Initialize FaceMesh for anti-cheat
    const initializeFaceMesh = async () => {
      try {
        console.log('Initializing FaceMesh...');

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

        console.log('FaceMesh initialized successfully');
      } catch (error) {
        console.error('FaceMesh initialization failed:', error);
        // Fallback: Simple timer-based anti-cheat
        setInterval(() => {
          if (Math.random() < 0.1) { // 10% chance every interval
            console.log('RANDOM ANTI-CHEAT CHECK');
            reportCheat("Random anti-cheat check - please ensure you're following the rules");
          }
        }, 30000); // Every 30 seconds
      }
    };

    initializeFaceMesh();

    // Initialize audio monitoring for anti-cheat
    initAudioMonitoring();

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
            await faceMeshRef.current.send({ image: webcamRef.current.video });
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
      for (let i = 0; i < dataArrayRef.current.length; i++) {
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
    console.log('Face detection running...');

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      // No face detected - could be camera obstruction or looking away
      console.log('No face detected, incrementing counter');
      setLookAwayCounter(prev => {
        const newCount = prev + 1;
        console.log('Look away counter:', newCount);
        if (newCount > 30) { // ~1 second @ 30fps
          console.log('TRIGGERING CHEAT DETECTION - No face');
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

    if (!nose || !leftEar || !rightEar) {
      console.log('Landmarks not available');
      return;
    }

    // Check horizontal turn (Yaw)
    const distToLeft = Math.abs(nose.x - leftEar.x);
    const distToRight = Math.abs(nose.x - rightEar.x);
    const ratio = distToLeft / (distToRight + 0.001); // avoid div by 0

    // If looking straight, ratio should be around 1.0 (0.5 - 2.0 range)
    // If ratio < 0.2 (Looking Left strongly) or ratio > 5.0 (Looking Right strongly)

    let lookingAway = false;
    if (ratio < 0.2 || ratio > 5.0) {
      lookingAway = true;
      console.log('Looking away detected, ratio:', ratio);
    }

    if (lookingAway) {
      setLookAwayCounter(prev => {
        const newCount = prev + 1;
        console.log('Looking away counter:', newCount);
        if (newCount > 60) { // ~2 seconds @ 30fps
          console.log('TRIGGERING CHEAT DETECTION - Looking away');
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
    console.log('Speak called with:', { text: text.substring(0, 50) + '...', audioBase64: audioBase64 ? 'present' : 'none' });

    // Cancel current speech to avoid overlap
    window.speechSynthesis.cancel();

    // Skip if already speaking the same content
    if (window.speechSynthesis.speaking) {
      console.log('Already speaking, skipping duplicate call');
      return;
    }

    const now = Date.now();
    if (now - lastSpeakTsRef.current < 500) {
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
        console.log('Speaking TTS:', text.substring(0, 50) + '...');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = TTS_VOLUME;
        utterance.rate = 0.9;
        utterance.onstart = () => console.log('TTS started');
        utterance.onend = () => console.log('TTS ended');
        utterance.onerror = (e) => console.error('TTS error:', e);
        window.speechSynthesis.speak(utterance);
        speakStateRef.current = 'tts';
      }
    };

    if (audioBase64) {
      console.log('Using backend audio');
      try {
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        audioRef.current = audio;
        speakStateRef.current = 'mp3';
        audio.onplay = () => console.log('Backend audio started');
        audio.onended = () => console.log('Backend audio ended');
        audio.onerror = (e) => console.error('Backend audio error:', e);
        audio.play()
          .then(() => {
            console.log('Backend audio playing successfully');
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
        audio.play().catch(() => { });
        setWarningMsg(`${res.data.message} | Reason: ${reason}`);
        setStrikes(res.data.strikes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnswerSubmit = async (answerText) => {
    console.log('=== HANDLE ANSWER SUBMIT START ===');
    console.log('Answer text:', answerText);
    console.log('Current session ID:', sessionId);
    console.log('Processing:', processing);

    // Don't allow empty answers
    if (!answerText || !answerText.trim()) {
      alert('Please enter an answer before submitting.');
      return;
    }

    setProcessing(true);
    console.log('Processing set to true');

    try {
      // Get session ID - must have one for backend to work
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        console.log('No session ID found, creating new session...');

        // Create a new session first
        const jd = localStorage.getItem('jd') || 'Software Engineering';
        const experience = localStorage.getItem('experience') || 'Not specified';
        const questionCount = localStorage.getItem('questionCount') || '5';

        console.log('Creating session with:', { jd, experience, questionCount });

        const startRes = await axios.post('/api/start', {
          jd,
          experience,
          questionCount
        });

        console.log('Session creation response:', startRes.data);

        if (!startRes.data.session_id) {
          throw new Error('No session_id in response');
        }

        currentSessionId = startRes.data.session_id;
        setSessionId(currentSessionId);
        localStorage.setItem('session_id', currentSessionId);

        console.log('Created new session:', currentSessionId);
      }

      console.log('Submitting answer to backend...');
      console.log('Session ID:', currentSessionId);
      console.log('Answer:', answerText.trim());

      const res = await axios.post('/api/answer', {
        session_id: currentSessionId,
        answer: answerText.trim()
      });

      console.log('Backend response received:', res.data);
      console.log('Response type:', typeof res.data);

      const { feedback, decision, next_question, audio } = res.data;

      console.log('Parsed response:', { feedback, decision, next_question, audio: audio ? 'present' : 'none' });

      if (feedback && next_question) {
        console.log('Updating UI with new feedback and question');
        setFeedback(feedback);
        setQuestion(next_question);
        setTranscript(''); // Clear transcript

        console.log('UI updated successfully');

        if (decision === 'INTERVIEW_COMPLETE') {
          console.log('Interview complete, navigating to report');
          setProcessing(false);
          navigate('/report');
          return;
        }

        // Check if we're at the question limit BEFORE incrementing
        const currentCount = parseInt(localStorage.getItem('question_count') || '0');
        const maxQuestions = parseInt(localStorage.getItem('max_questions') || '5');
        console.log(`Current question: ${currentCount + 1} of ${maxQuestions}`);

        // If we've already answered max_questions, end interview
        if (currentCount >= maxQuestions) {
          console.log('Question limit reached, ending interview');
          setProcessing(false);
          navigate('/report');
          return;
        }

        // Only increment count AFTER successful submission and BEFORE next question
        const newCount = currentCount + 1;
        localStorage.setItem('question_count', newCount.toString());
        console.log(`Updated question count: ${currentCount} -> ${newCount}`);

        // Play audio
        if (audio) {
          console.log('Playing GTTS audio from backend');
          speak(feedback + ". " + next_question, audio);
        } else {
          console.log('No audio from backend, using TTS fallback');
          speak(feedback + ". " + next_question, '');
        }
      } else {
        console.error('Invalid response structure:', res.data);
        throw new Error('Invalid response from backend: missing feedback or question');
      }

    } catch (error) {
      console.error('Submit error details:', error);
      console.error('Error response:', error.response?.data);

      // Show error to user with more helpful message
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';

      alert(`Error submitting answer: ${errorMessage}. Please try again.`);

    } finally {
      console.log('Submit process completed');
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
                  opacity: 1, // Make it visible!
                  pointerEvents: 'none',
                  borderRadius: '8px',
                  transform: 'scaleX(-1)' // Mirror effect for natural feel
                }}
                onUserMedia={() => {
                  console.log('Webcam user media success!');
                  setCameraReady(true);
                  setCameraError(null);
                }}
                onUserMediaError={(err) => {
                  console.error('Webcam error:', err);
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
        <div style={{ marginTop: 'auto', padding: '1rem', background: '#fff', borderRadius: '8px', height: 200, boxSizing: 'border-box', overflowY: 'auto', width: '100%', maxWidth: 320 }}>
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

          {/* Test Anti-Cheat Button */}
          <div style={{ marginTop: '15px' }}>
            <button
              onClick={() => reportCheat("Manual test - anti-cheat system working!")}
              style={{
                width: '100%',
                padding: '8px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}
            >
              🧪 Test Anti-Cheat
            </button>
            <small style={{ display: 'block', marginTop: '5px', color: '#666', fontSize: '0.7rem' }}>
              Click to test if anti-cheat is working
            </small>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main">
        <div className="header">
          AI Interviewer
          <div style={{ position: 'absolute', right: '20px', top: '20px', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                console.log('Manual audio play triggered');

                // Cancel any existing speech first
                window.speechSynthesis.cancel();

                // Wait a moment then speak
                setTimeout(() => {
                  const intro = feedback || 'Welcome to the AI interview!';
                  const question = question || 'Tell me about your experience.';
                  const utterance = new SpeechSynthesisUtterance(intro + ". " + question);
                  utterance.volume = 1;
                  utterance.rate = 0.9;
                  utterance.onstart = () => console.log('Manual speech started');
                  utterance.onend = () => console.log('Manual speech ended');
                  window.speechSynthesis.speak(utterance);
                }, 100);
              }}
              style={{
                padding: '8px 16px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🔊 Play Audio
            </button>
            <button
              onClick={() => navigate('/report')}
              style={{
                padding: '8px 16px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              📊 View Report
            </button>
          </div>
        </div>

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
            onClick={startRecording}
            disabled={!cameraReady || processing || isRecording}
            style={{
              padding: '0.6rem 1.2rem',
              marginBottom: '1rem',
              background: !cameraReady ? '#9e9e9e' : (isRecording ? '#f44336' : processing ? '#ff9800' : '#4CAF50'),
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              cursor: 'pointer',
              width: 140,
              height: 120,
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}
          >
            {!cameraReady ? '📷 Camera Needed' : (isRecording ? '🎙️ Recording...' : processing ? '⏳ Processing...' : '🎤 Tap to Speak')}
          </button>

          {/* Test Direct Backend URL */}
          <button
            onClick={async () => {
              console.log('=== TESTING DIRECT BACKEND URL ===');
              try {
                console.log('Making request to: http://localhost:5000/api/health');
                const res = await axios.get('http://localhost:5000/api/health');
                console.log('Direct backend response:', res.data);
                alert('Direct backend working! Status: ' + res.data.status);
              } catch (error) {
                console.error('Direct backend error:', error);
                alert('Direct backend failed: ' + error.message);
              }
            }}
            style={{
              padding: '0.8rem 1.5rem',
              marginBottom: '1rem',
              background: '#e91e63',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            🔗 Test Direct Backend
          </button>

          {/* Test Backend Connection */}
          <button
            onClick={async () => {
              console.log('=== TESTING BACKEND CONNECTION ===');
              try {
                console.log('Making request to: /api/health');
                const res = await axios.get('/api/health');
                console.log('Backend health check response:', res.data);
                alert('Backend is working! Status: ' + res.data.status);
              } catch (error) {
                console.error('Backend connection error:', error);
                alert('Backend connection failed: ' + error.message);
              }
            }}
            style={{
              padding: '0.8rem 1.5rem',
              marginBottom: '1rem',
              background: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            🔍 Test Backend
          </button>

          {/* Test Submit API */}
          <button
            onClick={async () => {
              console.log('=== TESTING SUBMIT API ===');
              try {
                const sessionId = localStorage.getItem('session_id') || 'test-session-' + Date.now();
                console.log('Making request to: /api/answer');
                console.log('Session ID:', sessionId);

                const res = await axios.post('/api/answer', {
                  session_id: sessionId,
                  answer: 'Test answer for debugging'
                });
                console.log('Submit API response:', res.data);
                alert('Submit API working! Response: ' + JSON.stringify(res.data, null, 2));
              } catch (error) {
                console.error('Submit API error:', error);
                console.error('Error status:', error.response?.status);
                console.error('Error URL:', error.config?.url);
                alert('Submit API failed: ' + error.message + ' Status: ' + error.response?.status);
              }
            }}
            style={{
              padding: '0.8rem 1.5rem',
              marginBottom: '1rem',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            🧪 Test Submit API
          </button>

          <button
            className="btn btn-secondary"
            onClick={async () => {
              console.log('=== ACTUAL SUBMIT BUTTON CLICKED ===');
              console.log('Answer text:', transcript);
              console.log('Current session ID:', sessionId);
              console.log('Processing:', processing);

              if (!transcript.trim()) {
                alert('Please type an answer first!');
                return;
              }

              // Use the same logic as the test button that works
              try {
                const currentSessionId = sessionId || 'test-session-' + Date.now();
                console.log('Submitting with session:', currentSessionId);

                const res = await axios.post('/api/answer', {
                  session_id: currentSessionId,
                  answer: transcript.trim()
                });

                console.log('Submit response:', res.data);

                const { feedback, decision, next_question, audio } = res.data;

                if (feedback && next_question) {
                  console.log('Updating UI with new feedback and question');
                  setFeedback(feedback);
                  setQuestion(next_question);
                  setTranscript(''); // Clear transcript

                  // Update question count for tracking only (agent decides when to end)
                  const currentCount = parseInt(localStorage.getItem('question_count') || '0');
                  const newCount = currentCount + 1;
                  localStorage.setItem('question_count', newCount.toString());
                  console.log(`Question ${newCount} completed`);

                  // Let the agent decide when to end the interview
                  if (decision === 'INTERVIEW_COMPLETE') {
                    console.log('Agent decided interview is complete, navigating to report');
                    navigate('/report');
                    return;
                  }

                  // Play audio
                  if (audio) {
                    console.log('Playing GTTS audio');
                    speak(feedback + ". " + next_question, audio);
                  } else {
                    console.log('Playing TTS fallback');
                    speak(feedback + ". " + next_question, '');
                  }
                } else {
                  console.error('Invalid response:', res.data);
                  alert('Invalid response from backend');
                }

              } catch (error) {
                console.error('Submit error:', error);
                alert('Submit failed: ' + error.message);
              }
            }}
            disabled={processing}
            style={{
              padding: '0.8rem 1.5rem',
              marginBottom: '1rem',
              background: processing ? '#f44336' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: processing ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {processing ? '⏳ Processing...' : '📝 Submit Answer'}
          </button>

          {/* Status Display */}
          <div style={{
            marginTop: '10px',
            padding: '10px',
            background: '#e3f2fd',
            borderRadius: '5px',
            fontSize: '0.9rem',
            maxWidth: '640px',
            width: '100%',
            border: '1px solid #2196F3'
          }}>
            <strong>📊 Submission Status:</strong><br />
            Processing: {processing ? '⏳ Yes' : '✅ Ready'}<br />
            Text Length: {transcript.length} characters<br />
            Session ID: {sessionId || 'None'}<br />
            Question Count: {localStorage.getItem('question_count') || '0'}/5<br />
            Status: {processing ? 'Submitting...' : 'Ready to submit'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Interview;
