import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Report() {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const sessionId = localStorage.getItem('session_id');
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    const fetchReport = async () => {
      try {
        const res = await axios.post('http://localhost:5000/api/report', {
          session_id: sessionId
        });
        setReport(res.data.report);
      } catch (error) {
        console.error("Error fetching report:", error);
        setReport("Failed to generate report.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Interview Report</h1>
      {loading ? (
        <p>Generating detailed analysis... Please wait.</p>
      ) : (
        <div style={{ background: '#f9f9f9', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <ReactMarkdown>{report}</ReactMarkdown>
        </div>
      )}
      <button 
        onClick={() => navigate('/')}
        style={{ marginTop: '2rem', padding: '0.5rem 1rem' }}
      >
        Back to Home
      </button>
    </div>
  );
}

export default Report;
