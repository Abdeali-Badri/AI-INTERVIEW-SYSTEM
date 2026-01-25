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
    <div className="home-container" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>AI Interview System</h1>
      <div className="form-group">
        <label>Job Description:</label>
        <textarea 
          value={jd} 
          onChange={(e) => setJd(e.target.value)} 
          placeholder="Paste Job Description here..."
          rows={5}
          style={{ width: '100%', marginBottom: '1rem' }}
        />
      </div>
      <div className="form-group">
        <label>Years of Experience / Details:</label>
        <textarea 
          value={experience} 
          onChange={(e) => setExperience(e.target.value)} 
          placeholder="e.g. 3 years in Python, React..."
          rows={3}
          style={{ width: '100%', marginBottom: '1rem' }}
        />
      </div>
      <button onClick={handleStart} disabled={loading} style={{ padding: '0.5rem 1rem' }}>
        {loading ? 'Starting...' : 'Start Interview'}
      </button>
    </div>
  );
}

export default Home;
