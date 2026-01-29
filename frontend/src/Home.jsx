import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

function Home() {
  const [jd, setJd] = useState('');
  const [experience, setExperience] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!jd || !experience) {
      alert('Please fill in both fields.');
      return;
    }

    setLoading(true);
    console.log('Starting interview with:', { jd, experience, questionCount });

    try {
      // Try direct backend connection first
      console.log('Testing direct backend connection...');
      const healthResponse = await fetch('http://localhost:5000/api/health');
      const healthData = await healthResponse.json();
      console.log('Backend health:', healthData);

      console.log('Making API call to /api/start');
      const response = await axios.post('/api/start', {
        jd,
        experience,
        questionCount
      });

      console.log('API Response:', response.data);

      const { session_id, intro, question, audio } = response.data;

      if (!session_id || !intro || !question) {
        console.error('Invalid response from backend:', response.data);
        alert('Invalid response from backend. Check console for details.');
        return;
      }

      localStorage.setItem('jd', jd);
      localStorage.setItem('experience', experience);
      localStorage.setItem('questionCount', questionCount);
      localStorage.setItem('session_id', session_id);
      localStorage.setItem('intro', intro);
      localStorage.setItem('first_question', question);
      localStorage.setItem('first_audio', audio || '');

      console.log('Stored data in localStorage:', {
        session_id, intro, question, audio: audio ? 'present' : 'none'
      });

      navigate('/interview');
    } catch (error) {
      console.error('Error starting interview:', error);
      const serverError = error.response?.data?.error || error.response?.data?.message;
      alert(`Failed to start interview. ${serverError ? 'Server says: ' + serverError : 'Error: ' + error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          padding: '40px',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          maxWidth: '500px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{
              color: '#667eea',
              fontSize: '2.5rem',
              marginBottom: '10px',
              fontWeight: 'bold'
            }}>
              AI Interviewer
            </h1>
            <p style={{
              color: '#666',
              fontSize: '1.1rem',
              marginBottom: '0'
            }}>
              Practice your interview skills with AI
            </p>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#333',
              fontWeight: '600',
              fontSize: '1rem'
            }}>
              Job Description/Role
            </label>
            <input
              type="text"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="e.g. Software Engineer, Data Scientist, Product Manager"
              style={{
                width: '100%',
                padding: '15px',
                border: '2px solid #e1e5e9',
                borderRadius: '10px',
                fontSize: '1rem',
                transition: 'all 0.3s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e1e5e9';
              }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#333',
              fontWeight: '600',
              fontSize: '1rem'
            }}>
              Your Experience
            </label>
            <textarea
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 3 years in Python, React, and cloud technologies..."
              rows={4}
              style={{
                width: '100%',
                padding: '15px',
                border: '2px solid #e1e5e9',
                borderRadius: '10px',
                fontSize: '1rem',
                transition: 'all 0.3s ease',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e1e5e9';
              }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#333',
              fontWeight: '600',
              fontSize: '1rem'
            }}>
              Number of Questions
            </label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '15px',
                border: '2px solid #e1e5e9',
                borderRadius: '10px',
                fontSize: '1rem',
                background: 'white',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <option value={3}>3 Questions (Quick Practice - 10 min)</option>
              <option value={5}>5 Questions (Standard - 15 min)</option>
              <option value={8}>8 Questions (Detailed - 25 min)</option>
              <option value={10}>10 Questions (Comprehensive - 30 min)</option>
            </select>
          </div>

          <button
            onClick={handleStart}
            disabled={loading || !jd.trim() || !experience.trim()}
            style={{
              width: '100%',
              padding: '18px',
              background: loading || !jd.trim() || !experience.trim()
                ? '#ccc'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: loading || !jd.trim() || !experience.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
            }}
          >
            {loading ? '🚀 Starting Interview...' : '🎯 Start Interview'}
          </button>

          <div style={{
            marginTop: '25px',
            padding: '20px',
            background: '#f8f9ff',
            borderRadius: '10px',
            border: '1px solid #e8ebff'
          }}>
            <h3 style={{
              color: '#667eea',
              marginBottom: '15px',
              fontSize: '1rem'
            }}>
              📋 What to expect:
            </h3>
            <ul style={{
              margin: '0',
              paddingLeft: '20px',
              color: '#666',
              fontSize: '0.9rem',
              lineHeight: '1.6'
            }}>
              <li>Camera and microphone access required</li>
              <li>AI-powered questions tailored to your role</li>
              <li>Real-time feedback and evaluation</li>
              <li>Anti-cheat monitoring enabled</li>
              <li>Detailed report at the end</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
