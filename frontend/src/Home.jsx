import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Home() {
  const [jd, setJd] = useState('');
  const [experience, setExperience] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!jd || !experience) {
      alert('Please fill in both fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/start', {
        jd,
        experience
      });
      
      const { session_id, intro, question, audio } = response.data;
      
      // Store session data in localStorage or pass via state
      localStorage.setItem('jd', jd);
      localStorage.setItem('experience', experience);
      localStorage.setItem('session_id', session_id);
      localStorage.setItem('intro', intro);
      localStorage.setItem('first_question', question);
      localStorage.setItem('first_audio', audio || '');
      
      navigate('/interview');
    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Failed to start interview. Check backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '3rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '700px'
      }}>
        <h1>AI Interview System</h1>
        <p style={{ 
          color: 'rgba(255, 255, 255, 0.9)', 
          textAlign: 'center', 
          marginBottom: '2rem',
          fontSize: '1.1rem'
        }}>
          Enter your details to begin your AI-powered interview
        </p>
        <div className="form-group">
          <label>Job Description:</label>
          <textarea 
            value={jd} 
            onChange={(e) => setJd(e.target.value)} 
            placeholder="Paste Job Description here..."
            rows={5}
          />
        </div>
        <div className="form-group">
          <label>Years of Experience / Details:</label>
          <textarea 
            value={experience} 
            onChange={(e) => setExperience(e.target.value)} 
            placeholder="e.g. 3 years in Python, React..."
            rows={3}
          />
        </div>
        <button 
          onClick={handleStart} 
          disabled={loading || !jd.trim() || !experience.trim()}
          style={{ 
            width: '100%',
            padding: '16px',
            fontSize: '1.2rem',
            background: loading || !jd.trim() || !experience.trim() 
              ? 'rgba(255, 255, 255, 0.5)' 
              : 'white',
            color: loading || !jd.trim() || !experience.trim()
              ? 'rgba(102, 126, 234, 0.5)'
              : '#667eea',
            fontWeight: 700,
            borderRadius: '12px',
            border: 'none',
            cursor: loading || !jd.trim() || !experience.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}
        >
          {loading ? '⏳ Starting Interview...' : '🚀 Start Interview'}
        </button>
      </div>
    </div>
  );
}

export default Home;
