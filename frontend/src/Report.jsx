import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Report() {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const sessionId = localStorage.getItem('session_id');
  const navigate = useNavigate();
  const reportRef = useRef(null);

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
  }, [sessionId, navigate]);

  const downloadPDF = async () => {
    try {
      // Dynamic import of jsPDF and html2canvas
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);

      const element = reportRef.current;
      if (!element) return;

      // Show loading state
      const loadingText = document.createElement('div');
      loadingText.textContent = 'Generating PDF...';
      loadingText.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 8px; z-index: 10000;';
      document.body.appendChild(loadingText);

      // Create canvas from HTML element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      
      let heightLeft = imgScaledHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgScaledWidth, imgScaledHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgScaledHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgScaledWidth, imgScaledHeight);
        heightLeft -= pdfHeight;
      }

      // Remove loading indicator
      document.body.removeChild(loadingText);

      // Download PDF
      const fileName = `Interview_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem'
    }}>
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <h1 style={{ 
            color: '#667eea', 
            margin: 0,
            fontSize: '2.5rem',
            fontWeight: 700
          }}>
            Interview Report
          </h1>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {!loading && (
              <button 
                onClick={downloadPDF}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              >
                📄 Download PDF
              </button>
            )}
            <button 
              onClick={() => navigate('/')}
              className="btn btn-secondary"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            >
              🏠 Back to Home
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '4rem 2rem',
            color: '#667eea'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>
              Generating detailed analysis... Please wait.
            </p>
          </div>
        ) : (
          <div 
            ref={reportRef}
            style={{ 
              background: '#ffffff', 
              padding: '2.5rem', 
              borderRadius: '16px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              lineHeight: '1.8',
              color: '#1a1a1a'
            }}
          >
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => <h1 style={{color: '#667eea', marginTop: '2rem', marginBottom: '1rem', fontSize: '2rem'}} {...props} />,
                h2: ({node, ...props}) => <h2 style={{color: '#764ba2', marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1.5rem'}} {...props} />,
                h3: ({node, ...props}) => <h3 style={{color: '#764ba2', marginTop: '1.25rem', marginBottom: '0.5rem', fontSize: '1.25rem'}} {...props} />,
                p: ({node, ...props}) => <p style={{marginBottom: '1rem', fontSize: '1rem'}} {...props} />,
                ul: ({node, ...props}) => <ul style={{marginBottom: '1rem', paddingLeft: '2rem'}} {...props} />,
                li: ({node, ...props}) => <li style={{marginBottom: '0.5rem'}} {...props} />,
                strong: ({node, ...props}) => <strong style={{color: '#4c1d95', fontWeight: 600}} {...props} />,
              }}
            >
              {report}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default Report;
